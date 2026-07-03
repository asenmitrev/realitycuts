import { ChatState, ChatStateType } from './state';
import {
  orchestratorAgent,
  synthesisAgent,
  parseOrchestratorResponse,
  editorCommandAgent,
  parseEditorCommandResponse,
  footageDecisionAgent,
  parseFootageDecision,
  footageSuggestionAgent,
  getVideoGeneratedNote,
  appFaqAgent
} from './agents';
import { mockAgents, MockAgentName } from './mock-agents';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { logger } from '../logging';
import { searchFootageClusters } from './tools';
import { getScriptWriterAgent } from '../video-generation/v13-script-writer/agents';
import { getFocusedSegments } from '../video-generation/v11-proper-context/utils/get-focused-segments';
import { generateVoiceover } from '../tts';
import { annotationRemoverAgent } from '../../agents/annotation-remover.agent';
import { uploadToS3, deleteFromS3Promise, getKeyFromUrl } from '../storage/s3';
import { getS3FileUrl } from '../../config/storage';
import { safelyDelete } from '../fs';
import videoAIDataRepository from '../../repositories/video-ai-data.repository';
import libraryRepository from '../../repositories/library.repository';
import generatedMusicRepository from '../../repositories/generated-music.repository';
import { IVideoAIData, RecroppedVideoFrame } from '../../../../shared/types';
import { getSentencesFromWords } from '../../../../shared/utils/trimming';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { Conversation } from '../../models/conversation';
import { TranscriptionJob } from '../../models/transcription-job';
import { UserProfile } from '../../models/user-profile';
import { getElevenLabsMusic } from '../ai/elevenlabs';
import { generateMusicPrompt, analyzeVideoContent } from '../../agents/music-prompt.agent';

/**
 * Update the pending message status in the database
 * This allows nodes to provide granular progress updates
 */
async function updatePendingStatus(conversationId: string | undefined, status: string): Promise<void> {
  if (!conversationId) return;

  try {
    await Conversation.updateOne(
      { _id: conversationId },
      { $set: { 'pendingMessage.currentStatus': status } }
    );
    logger.debug(`Updated pending status: ${status}`);
  } catch (error) {
    logger.warn('Failed to update pending status:', error);
  }
}

/**
 * Format chat history for the LLM prompt
 */
function formatChatHistory(messages: ChatStateType['messages']): string {
  if (messages.length === 0) return 'No previous conversation.';

  return messages
    .slice(-10) // Keep last 10 messages for context
    .map(msg => {
      const role = msg._getType() === 'human' ? 'User' : 'Assistant';
      return `${role}: ${msg.content}`;
    })
    .join('\n');
}

/**
 * Video creation agents that should be blocked after first video is generated
 */
const VIDEO_CREATION_AGENTS = ['footage_validation', 'scriptwriter', 'script_extractor', 'footage_fetcher'];

/**
 * Orchestrator Node
 *
 * Main decision-making node that:
 * 1. Processes user messages
 * 2. Decides whether to call a sub-agent or respond directly
 * 3. Sets the next agent to route to
 */
export async function orchestratorNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  logger.info('=== ORCHESTRATOR: Processing user message ===');

  const { messages, userMessage, agentOutput, agentUsed, videoAIDataId, generatedScript, uiContext, segmentContext } = state;

  // Voice-change interception: user selected a new voice from the modal while a voice change was pending.
  // Skip the orchestrator LLM entirely and route straight to voice_changer to regenerate audio.
  if (state.pendingVoiceChange) {
    logger.info('Voice change pending — routing directly to voice_changer after voice selection');
    return {
      nextAgent: 'voice_changer',
      currentAgent: 'orchestrator',
      shouldRespond: false
    };
  }

  // Editor-mode interception: if this chat is operating inside the editor, interpret direct editor commands
  // and return them as a one-time action instruction for the frontend.
  if (uiContext === 'editor' && videoAIDataId) {
    try {
      // Build a human-readable segment timeline block so the LLM can resolve
      // positional references like "first clip", "last clip", "clip 2", etc.
      let segmentContextBlock = '';
      if (segmentContext && segmentContext.length > 0) {
        const lines = segmentContext.map(
          seg => `  Clip ${seg.index + 1}: starts at ${seg.timeStart.toFixed(2)}s, ends at ${seg.timeEnd.toFixed(2)}s`
        );
        segmentContextBlock =
          `Video timeline (${segmentContext.length} clip${segmentContext.length === 1 ? '' : 's'}):\n` +
          lines.join('\n') +
          '\n\n';
      }

      const editorResp = await editorCommandAgent.invoke({ userMessage, segmentContextBlock });
      const parsedEditor = parseEditorCommandResponse(editorResp);

      if (parsedEditor.shouldAct && parsedEditor.actionType) {
        const text =
          parsedEditor.assistantText ||
          "Okay — I've applied that change in the editor.";

        return {
          nextAgent: '__end__',
          currentAgent: 'orchestrator',
          finalResponse: text,
          shouldRespond: true,
          isComplete: true,
          responseActions: [
            {
              type: 'editor_dispatch',
              label: 'Apply',
              payload: {
                actionType: parsedEditor.actionType,
                payload: parsedEditor.payload
              }
            }
          ],
          messages: [new AIMessage({ content: text })],
        };
      }
    } catch (e) {
      logger.warn('Editor command agent failed; falling back to normal orchestrator', {
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }

  // Format inputs for the orchestrator
  const chatHistory = formatChatHistory(messages);
  const agentContext = agentOutput && agentUsed
    ? `[Previous agent (${agentUsed}) output: ${agentOutput}]`
    : '';

  // Inform the orchestrator if a script already exists.
  // A script is considered present if it's in workflow state OR if a video already exists
  // (videos not created through chat still have a script stored in VideoAIData.formattedTranscript).
  const scriptExistsNote = (generatedScript && generatedScript.trim().length > 0) || !!videoAIDataId
    ? 'SCRIPT EXISTS: Yes - A script has already been processed. If the user wants to proceed, add footage, or create the video, route to footage_fetcher, NOT script_extractor. Route to script_extractor only if the user wants to give you their own script.'
    : 'SCRIPT EXISTS: No - No script has been processed yet.';

  try {
    // Get orchestrator decision
    const response = await orchestratorAgent.invoke({
      chatHistory,
      userMessage,
      agentOutput: agentContext,
      videoAlreadyGenerated: getVideoGeneratedNote(!!videoAIDataId, uiContext) ?? '',
      scriptExists: scriptExistsNote
    });

    logger.debug('Orchestrator response:', response);

    // Parse the response to check for agent calls
    const parsed = parseOrchestratorResponse(response);

    if (parsed.shouldCallAgent && parsed.agentName) {
      // Check if a video has already been generated in this chat
      // If so, refuse to create another video and direct user to start a new chat
      if (videoAIDataId && VIDEO_CREATION_AGENTS.includes(parsed.agentName)) {
        logger.info(`Video already generated (${videoAIDataId}), refusing to create another`);

        const refusalResponse = "I've already created a video in this chat! To create a new video, please start a new chat. Each chat is designed for one video creation to keep things organized.";

        return {
          nextAgent: '__end__',
          currentAgent: 'orchestrator',
          finalResponse: refusalResponse,
          shouldRespond: true,
          isComplete: true,
          messages: [new AIMessage({ content: refusalResponse })],
        };
      }

      // Intercept script_extractor routing if a script already exists and user wants to proceed
      // This prevents routing back to script_extractor when user asks to add footage after script cleanup
      // Only intercept if the user is NOT providing a new script (parsed.script would be empty/null)
      if (parsed.agentName === 'script_extractor' && generatedScript && generatedScript.trim().length > 0 && !parsed.script) {
        // Check if user is asking to proceed/add footage (not providing a new script)
        const proceedKeywords = ['add footage', 'proceed', 'let\'s go', 'create the video', 'make the video', 'go ahead', 'yes', 'looks good', 'perfect', 'i like it'];
        const userMessageLower = userMessage.toLowerCase();
        const isProceeding = proceedKeywords.some(keyword => userMessageLower.includes(keyword));

        if (isProceeding) {
          logger.info('Script already exists and user wants to proceed - routing to footage_fetcher instead of script_extractor');

          // Route to footage_fetcher instead (will be intercepted for voice selection if needed)
          parsed.agentName = 'footage_fetcher';
        }
      }

      // Intercept footage_fetcher routing to prompt for voice selection first
      // voiceSelectionPending acts as a gate: false = voice step not done yet, true = voice selected
      if (parsed.agentName === 'footage_fetcher' && !state.voiceSelectionPending) {
        logger.info('Intercepting footage_fetcher to prompt for voice selection');

        const voicePromptResponse = "Before we create your video, let's choose a voice for the narration. Please select a voice from the options.";

        return {
          nextAgent: '__end__',
          currentAgent: 'orchestrator',
          finalResponse: voicePromptResponse,
          shouldRespond: true,
          isComplete: true,
          voiceSelectionPending: true,
          responseActions: [{ type: 'voice_select', label: 'Choose voice' }],
          messages: [new AIMessage({ content: voicePromptResponse })],
        };
      }

      logger.info(`Orchestrator routing to: ${parsed.agentName}${parsed.topic ? ` with topic: "${parsed.topic}"` : ''}${parsed.script ? ' with user-provided script' : ''}${parsed.musicStyle ? ` with music style: "${parsed.musicStyle}"` : ''}${parsed.scriptLanguage ? ` with language: "${parsed.scriptLanguage}"` : ''}`);

      return {
        nextAgent: parsed.agentName,
        currentAgent: 'orchestrator',
        shouldRespond: false,
        // Pass the topic to the next agent (used by footage_validation)
        requestedTopic: parsed.topic || '',
        // Pass the extracted script text to script_extractor node
        extractedScriptText: parsed.script || '',
        // Pass the music style to music_generator node
        musicStyle: parsed.musicStyle || '',
        // Pass the script language to scriptwriter node (only when user explicitly requests a language)
        ...(parsed.scriptLanguage ? { scriptLanguage: parsed.scriptLanguage } : {})
      };
    }

    // Direct response - no agent call needed
    logger.info('Orchestrator responding directly');

    return {
      nextAgent: '__end__',
      currentAgent: 'orchestrator',
      finalResponse: parsed.directResponse || response,
      shouldRespond: true,
      isComplete: true,
      messages: [new AIMessage({ content: parsed.directResponse || response })],
    };
  } catch (error) {
    logger.error('Orchestrator error:', error);

    const errorResponse = 'I apologize, but I encountered an issue processing your request. Please try again.';

    return {
      nextAgent: '__end__',
      currentAgent: 'orchestrator',
      finalResponse: errorResponse,
      shouldRespond: true,
      isComplete: true,
      messages: [new AIMessage({ content: errorResponse })],
    };
  }
}

/**
 * Extract text content from a message content that may be a string or array of content blocks
 * Claude's API returns content as an array of { type: 'text', text: '...' } objects
 */
function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: string; text: string } =>
        typeof part === 'object' && part !== null && part.type === 'text' && typeof part.text === 'string'
      )
      .map(part => part.text)
      .join('');
  }
  // Fallback for unexpected types
  return String(content);
}

/**
 * Count sentences in a script
 * Uses basic sentence-ending punctuation detection
 */
function countSentences(text: string): number {
  // Match sentence-ending punctuation followed by space or end of string
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.length;
}

/**
 * Truncate script to a maximum number of sentences
 */
function truncateToSentences(text: string, maxSentences: number): string {
  // Split by sentence-ending punctuation, keeping the delimiter
  const parts = text.split(/(?<=[.!?])\s+/);
  if (parts.length <= maxSentences) {
    return text;
  }
  return parts.slice(0, maxSentences).join(' ').trim();
}

const MAX_SCRIPT_SENTENCES = 5;

/**
 * Scriptwriter Node
 * Uses the v13 script writer agent (Claude + web search) to generate scripts
 */
export async function scriptWriterNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  logger.info('=== SCRIPTWRITER: Generating script ===');

  const { requestedTopic, userMessage, clusterSearchResults, conversationId, messages, scriptLanguage } = state;

  // Use the validated topic if available, otherwise fall back to user message
  const topic = requestedTopic || userMessage;

  // Detect the user's language from recent messages
  const recentUserMessages = messages
    .filter(msg => msg._getType() === 'human')
    .slice(-3)
    .map(msg => msg.content)
    .join('\n');

  // Build language instruction: explicit language takes priority over auto-detection
  const languageInstruction = scriptLanguage
    ? `IMPORTANT: Write the script in ${scriptLanguage}. The user has explicitly requested this language. The ENTIRE script must be in ${scriptLanguage}.`
    : `IMPORTANT: Write the script in the SAME LANGUAGE the user is communicating in. Detect the language from the user's messages below and write the entire script in that language.`;

  try {
    // Build context with available footage info if we have it
    const footageContext = clusterSearchResults
      ? `\n\nAvailable footage in the library:\n${clusterSearchResults}`
      : '';

    const prompt = `Create a short-form video script about: ${topic}${footageContext}

IMPORTANT: Keep the script to ${MAX_SCRIPT_SENTENCES} sentences or fewer.
${languageInstruction}

User's recent messages:
${recentUserMessages}`;

    logger.info(`Invoking v13 script writer agent with topic: "${topic}"`);

    // Update status before the potentially slow operation
    await updatePendingStatus(conversationId, 'Researching and writing your script...');

    // Invoke the v13 React agent with the topic
    const result = await getScriptWriterAgent().invoke({
      messages: [new HumanMessage({ content: prompt })]
    });

    // Extract the final message content from the agent result
    // Claude returns content as array of content blocks, so we need to extract text properly
    const lastMessage = result.messages[result.messages.length - 1];
    let scriptContent = extractTextContent(lastMessage.content);

    logger.debug('Scriptwriter output:', scriptContent);

    // Validate and enforce sentence limit
    const sentenceCount = countSentences(scriptContent);
    let scriptLimitNote = '';

    if (sentenceCount > MAX_SCRIPT_SENTENCES) {
      logger.warn(`Script exceeded ${MAX_SCRIPT_SENTENCES} sentence limit (${sentenceCount} sentences). Truncating.`);
      scriptContent = truncateToSentences(scriptContent, MAX_SCRIPT_SENTENCES);
      scriptLimitNote = `\n\n---\n**Note:** Scripts are currently limited to ${MAX_SCRIPT_SENTENCES} sentences. Longer scripts are not supported yet, but we're working on it!`;
    }

    return {
      agentOutput: scriptContent + scriptLimitNote,
      agentUsed: 'scriptwriter',
      currentAgent: 'scriptwriter',
      nextAgent: 'synthesize',
      // Store the script for later confirmation flow (without the note)
      generatedScript: scriptContent,
      scriptConfirmed: false,
    };
  } catch (error) {
    logger.error('Scriptwriter error:', error);

    return {
      agentOutput: 'Error generating script. Please try again.',
      agentUsed: 'scriptwriter',
      currentAgent: 'scriptwriter',
      nextAgent: 'synthesize'
    };
  }
}

/**
 * Script Extractor Node
 * 
 * Takes a user-provided script and processes it for video generation.
 * This bypasses footage validation and scriptwriter - the user's script is used directly.
 * 
 * Steps:
 * 1. Get the extracted script text from state (passed by orchestrator)
 * 2. Clean annotations using annotation-remover agent
 * 3. Enforce sentence limit (truncate if needed)
 * 4. Store in generatedScript and mark as user-provided
 * 5. Route to synthesize for user confirmation
 */
export async function scriptExtractorNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  logger.info('=== SCRIPT EXTRACTOR: Processing user-provided script ===');

  const { extractedScriptText, conversationId } = state;

  if (!extractedScriptText || extractedScriptText.trim().length === 0) {
    logger.error('No script text provided by user');
    return {
      agentOutput: 'No script text was provided. Please paste your script and try again.',
      agentUsed: 'script_extractor',
      currentAgent: 'script_extractor',
      nextAgent: 'synthesize',
    };
  }

  try {
    // Update status
    await updatePendingStatus(conversationId, 'Processing your script...');

    // Step 1: Clean annotations from the user's script
    logger.info('Cleaning annotations from user-provided script...');
    logger.debug('Script before cleaning:', extractedScriptText);

    const cleanedScriptResponse = await annotationRemoverAgent.invoke({ input: extractedScriptText });
    let scriptContent = extractTextContent(cleanedScriptResponse.content);

    logger.debug('Script after annotation removal:', scriptContent);

    // Step 2: Validate and enforce sentence limit
    const sentenceCount = countSentences(scriptContent);
    let scriptLimitNote = '';

    if (sentenceCount > MAX_SCRIPT_SENTENCES) {
      logger.warn(`User script exceeded ${MAX_SCRIPT_SENTENCES} sentence limit (${sentenceCount} sentences). Truncating.`);
      scriptContent = truncateToSentences(scriptContent, MAX_SCRIPT_SENTENCES);
      scriptLimitNote = `\n\n---\n**Note:** Scripts are currently limited to ${MAX_SCRIPT_SENTENCES} sentences. Your script was truncated. Longer scripts are not supported yet, but we're working on it!`;
    }

    logger.info(`Script processed: ${countSentences(scriptContent)} sentences`);

    return {
      agentOutput: scriptContent + scriptLimitNote,
      agentUsed: 'script_extractor',
      currentAgent: 'script_extractor',
      nextAgent: 'synthesize',
      // Store the script for later confirmation flow (without the note)
      generatedScript: scriptContent,
      userProvidedScript: true,
      scriptConfirmed: false,
      // Use a lower credit cost since we're not doing web search or generation
    };
  } catch (error) {
    logger.error('Script extractor error:', error);

    return {
      agentOutput: 'Error processing your script. Please try again.',
      agentUsed: 'script_extractor',
      currentAgent: 'script_extractor',
      nextAgent: 'synthesize',
    };
  }
}

/**
 * Footage Fetcher Node
 * 
 * 1. Removes annotations from script using annotation-remover agent
 * 2. Generates TTS audio with ElevenLabs to get real word timings
 * 3. Uploads audio to S3 and deletes temp file
 * 4. Uses getFocusedSegments from v11-proper-context for the proven footage matching algorithm
 * 5. Creates VideoAIData model with audio and segments
 */
export async function footageFetcherNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  logger.info('=== FOOTAGE FETCHER: Generating audio and finding footage ===');

  const { generatedScript, libraryIds: stateLibraryIds, userId, conversationId, voiceId, requestedTopic } = state;

  if (!generatedScript) {
    logger.error('No script available for footage fetching');
    return {
      agentOutput: 'No script available to fetch footage for.',
      agentUsed: 'footage_fetcher',
      currentAgent: 'footage_fetcher',
      nextAgent: 'synthesize',
      footageFetchStatus: 'failed',
    };
  }

  // Fetch user's private library IDs from database if not provided in state
  let libraryIds = stateLibraryIds;
  if (!libraryIds || libraryIds.length === 0) {
    logger.info('Fetching user library IDs from database...');
    const userLibraries = await libraryRepository.findAllByUserId(userId || '');
    libraryIds = userLibraries.map(lib => lib._id!.toString());
    logger.info(`Found ${libraryIds.length} user libraries`);
  }

  let audioPath = '';

  try {
    // Step 1: Remove annotations from script before TTS
    await updatePendingStatus(conversationId, 'Preparing your script...');
    logger.info('Removing annotations from script...');
    logger.debug('Script before annotation removal:', generatedScript);
    const cleanedScriptResponse = await annotationRemoverAgent.invoke({ input: generatedScript });
    const cleanedScript = extractTextContent(cleanedScriptResponse.content);
    logger.info('Script cleaned for TTS');
    logger.debug('Script after annotation removal:', cleanedScript);

    // Step 2: Generate TTS audio with ElevenLabs to get real word timings
    await updatePendingStatus(conversationId, 'Generating voiceover audio...');
    logger.info('Generating TTS audio with ElevenLabs...');
    const voice = voiceId || 'JBFqnCBsd6RMkjVDRZzb'; // Default to George voice

    const voiceoverResult = await generateVoiceover(
      cleanedScript,
      true, // isPremium = true to use ElevenLabs with word timings
      voice
    );

    audioPath = voiceoverResult.audioPath;
    const audioName = voiceoverResult.audioName;
    const transcript = voiceoverResult.transcript;

    logger.info(`TTS generated: ${audioName}, ${transcript.length} words with timings`);

    if (!transcript || transcript.length === 0) {
      logger.error('TTS generated but no transcript returned');
      safelyDelete(audioPath);
      return {
        agentOutput: 'Error generating voiceover. Please try again.',
        agentUsed: 'footage_fetcher',
        currentAgent: 'footage_fetcher',
        nextAgent: 'synthesize',
        footageFetchStatus: 'failed',
      };
    }

    const totalDuration = transcript[transcript.length - 1]?.end ?? 30;
    logger.info(`Audio duration: ${totalDuration.toFixed(1)}s`);

    // Step 3: Upload audio to S3 and delete temp file
    await updatePendingStatus(conversationId, 'Saving audio...');
    logger.info('Uploading audio to S3...');
    const s3AudioFilename = `chat-audio/${userId || 'anonymous'}/${uuidv4()}.mp3`;

    await uploadToS3(audioPath, s3AudioFilename, {
      mimeType: 'audio/mpeg',
      originalName: audioName,
      fileSize: fs.statSync(audioPath).size,
      userId: userId || 'anonymous'
    });

    const audioUrl = getS3FileUrl(s3AudioFilename);
    logger.info(`Audio uploaded to S3: ${audioUrl}`);

    // Delete temp file to free up storage
    safelyDelete(audioPath);
    audioPath = ''; // Mark as deleted
    logger.info('Temp audio file deleted');

    // Step 4: Use getFocusedSegments with real word timings
    await updatePendingStatus(conversationId, 'Finding matching footage for your video, this may take awhile...');
    logger.info('Finding footage with getFocusedSegments...');
    const segments = await getFocusedSegments({
      userId: userId || 'default',
      eventId: conversationId || 'chat-footage-fetch',
      selectedTags: [],
      privateLibraryIds: libraryIds,
      libraries: { pexels: false },
      transcript,
      guidance: '', // Script is already specific
      isTalkingHead: false,
      totalDuration,
      brollDuration: 4, // Target 4 second b-roll segments
      useVideoEmbeddings: true,
      enableDuplicateDetection: true,
      isAllPublicLibrariesSelected: true
    });

    logger.info(`getFocusedSegments returned ${segments.length} segments`);

    // Count stats
    const totalAlternatives = segments.reduce((sum, s) => sum + (s.alternatives?.length || 0), 0);
    const segmentsWithFootage = segments.filter(s => s.alternatives && s.alternatives.length > 0).length;

    // Determine fetch status
    let footageFetchStatus: 'found' | 'partial' | 'failed' = 'found';
    if (segmentsWithFootage === 0) {
      footageFetchStatus = 'failed';
      logger.warn('No footage found for any segment');
    } else if (segmentsWithFootage < segments.length) {
      footageFetchStatus = 'partial';
      logger.warn(`Partial coverage: ${segmentsWithFootage}/${segments.length} segments have footage`);
    } else {
      logger.info(`Full coverage: ${totalAlternatives} total alternatives across ${segments.length} segments`);
    }

    // Step 5: Create VideoAIData model
    await updatePendingStatus(conversationId, 'Creating your video...');
    logger.info('Creating VideoAIData model...');

    const videoAIData: Partial<IVideoAIData> = {
      title: requestedTopic || 'Chat-generated video',
      segments,
      formattedTranscript: generatedScript,
      editedWordsList: transcript,
      audioEnabled: false,
      audioIndex: -1, // No background music by default
      audioVolume: 1.0,
      voiceOver: audioUrl,
      audio: [], // No background music
      userId: userId || 'anonymous',
      privateLibraryIds: libraryIds,
      description: `Generated via chat conversation${conversationId ? ` (${conversationId})` : ''}`
    };

    const savedVideoAIData = await videoAIDataRepository.create(videoAIData);
    logger.info(`VideoAIData created with ID: ${savedVideoAIData._id}`);

    // Bookkeeping: TranscriptionJob, recrop data, TTS minutes (non-fatal on failure)
    try {
      const transcriptionJob = new TranscriptionJob({
        userId: userId || 'anonymous',
        status: 'COMPLETED',
        title: requestedTopic || 'Chat-generated video',
        script: cleanedScript,
        transcript,
        jobType: 'SCRIPT'
      });
      await transcriptionJob.save();
      const tjId = transcriptionJob._id.toString();
      logger.info('Created TranscriptionJob for chat video', { tjId });

      const recropData: RecroppedVideoFrame = {
        x1: (1920 - 1080) / 2,
        x2: 1920 - (1920 - 1080) / 2,
        y1: 0,
        y2: 1080,
        frameStart: 0,
        frameEnd: Math.round(totalDuration * 30),
        timeStart: 0,
        timeEnd: totalDuration
      };

      const videoId = savedVideoAIData._id?.toString();
      if (videoId) {
        await videoAIDataRepository.update(videoId, {
          transcriptionJob: tjId,
          croppedInfo: [recropData]
        });
      }

      const minutes = Math.round((totalDuration / 60) * 100) / 100;
      await UserProfile.findOneAndUpdate(
        { firebaseId: userId },
        { $inc: { 'usage.ttsMinutesSpent': minutes } },
        { new: true }
      );
      logger.info('Updated TTS minutes spent', { userId, minutes });
    } catch (bookkeepingError) {
      logger.error('Bookkeeping error after VideoAIData creation (non-fatal)', bookkeepingError);
    }

    return {
      agentOutput: `Video ready for editing!\n✓ Audio duration: ${totalDuration.toFixed(1)}s\n✓ Video ID: ${savedVideoAIData._id}`,
      agentUsed: 'footage_fetcher',
      currentAgent: 'footage_fetcher',
      nextAgent: 'synthesize',
      // Store audio info
      generatedAudioPath: '', // Already deleted
      generatedAudioName: audioName,
      audioUrl,
      transcriptWithTimings: transcript,
      footageFetchStatus,
      // Store VideoAIData ID
      videoAIDataId: savedVideoAIData._id?.toString() || '',
    };
  } catch (error) {
    logger.error('Footage fetcher error:', error);

    // Clean up temp file if it exists
    if (audioPath) {
      safelyDelete(audioPath);
    }

    return {
      agentOutput: 'Error generating voiceover or finding footage. Please try again.',
      agentUsed: 'footage_fetcher',
      currentAgent: 'footage_fetcher',
      nextAgent: 'synthesize',
      footageFetchStatus: 'failed',
    };
  }
}

/**
 * Footage Search Node
 * Wraps the mock footage search agent
 */
export async function footageSearchNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  logger.info('=== FOOTAGE SEARCH: Searching for clips ===');

  const { userMessage } = state;

  try {
    const result = await mockAgents.footage_search({ userMessage });

    logger.debug('Footage search output:', result.content);

    return {
      agentOutput: result.content,
      agentUsed: 'footage_search',
      currentAgent: 'footage_search',
      nextAgent: 'synthesize'
    };
  } catch (error) {
    logger.error('Footage search error:', error);

    return {
      agentOutput: 'Error searching for footage. Please try again.',
      agentUsed: 'footage_search',
      currentAgent: 'footage_search',
      nextAgent: 'synthesize'
    };
  }
}

/**
 * Video Overlay Node
 * Wraps the mock video overlay agent
 */
export async function videoOverlayNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  logger.info('=== VIDEO OVERLAY: Processing overlays ===');

  const { userMessage } = state;

  try {
    const result = await mockAgents.video_overlay({ userMessage });

    logger.debug('Video overlay output:', result.content);

    return {
      agentOutput: result.content,
      agentUsed: 'video_overlay',
      currentAgent: 'video_overlay',
      nextAgent: 'synthesize'
    };
  } catch (error) {
    logger.error('Video overlay error:', error);

    return {
      agentOutput: 'Error processing video overlays. Please try again.',
      agentUsed: 'video_overlay',
      currentAgent: 'video_overlay',
      nextAgent: 'synthesize'
    };
  }
}

/**
 * Synthesize Node
 * Converts agent output into a user-friendly response
 */
export async function synthesizeNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  logger.info('=== SYNTHESIZE: Creating user response ===');

  const { agentOutput, agentUsed, userMessage, footageDecision, requestedTopic, clusterSearchResults } = state;

  // Handle footage validation rejection case - use Grok to synthesize suggestions
  if (footageDecision === 'suggest_alternatives') {
    logger.info('Synthesizing footage validation rejection response with Grok');

    try {
      const suggestionResponse = await footageSuggestionAgent.invoke({
        requestedTopic: requestedTopic || userMessage,
        clusterResults: clusterSearchResults || 'No footage found.'
      });

      logger.debug('Grok suggestion response:', suggestionResponse);

      return {
        finalResponse: suggestionResponse,
        isComplete: true,
        currentAgent: 'synthesize',
        nextAgent: '__end__',
        messages: [new AIMessage({ content: suggestionResponse })]
      };
    } catch (error) {
      logger.error('Footage suggestion synthesis error:', error);

      // Fallback response if Grok fails
      const fallbackResponse = `I couldn't find footage matching "${requestedTopic || userMessage}" in your library. You can load ${requestedTopic || 'that'} footage in your library from the dashboard — click "+ Library" to create a library and add clips. Or ask me what videos you can create with your current library!`;

      return {
        finalResponse: fallbackResponse,
        isComplete: true,
        currentAgent: 'synthesize',
        nextAgent: '__end__',
        messages: [new AIMessage({ content: fallbackResponse })]
      };
    }
  }

  if (!agentOutput || !agentUsed) {
    logger.warn('No agent output to synthesize');

    return {
      finalResponse: 'I completed the task but have no results to show.',
      isComplete: true,
      nextAgent: '__end__',
      messages: [new AIMessage({ content: 'I completed the task but have no results to show.' })]
    };
  }

  try {
    // Use the synthesis agent to create a user-friendly response
    const response = await synthesisAgent.invoke({
      agentName: agentUsed,
      agentOutput,
      userMessage
    });

    logger.debug('Synthesized response:', response);

    return {
      finalResponse: response,
      isComplete: true,
      currentAgent: 'synthesize',
      nextAgent: '__end__',
      messages: [new AIMessage({ content: response })]
    };
  } catch (error) {
    logger.error('Synthesis error:', error);

    // Fallback to raw agent output if synthesis fails
    return {
      finalResponse: agentOutput,
      isComplete: true,
      currentAgent: 'synthesize',
      nextAgent: '__end__',
      messages: [new AIMessage({ content: agentOutput })]
    };
  }
}

/**
 * Voice Changer Node
 *
 * Two-phase flow:
 * Phase 1 (pendingVoiceChange=false): Show voice selector modal to the user.
 * Phase 2 (pendingVoiceChange=true):  A new voiceId has been saved by the client.
 *   Re-generate TTS with the new voice and update the existing VideoAIData in the DB.
 */
export async function voiceChangerNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  const { pendingVoiceChange, videoAIDataId, generatedScript, voiceId, userId, conversationId } = state;

  // Phase 1: no voice picked yet — open the selector
  if (!pendingVoiceChange) {
    logger.info('=== VOICE CHANGER (Phase 1): Opening voice selector ===');

    if (!videoAIDataId) {
      const noVideoMsg = "There's no video yet to change the voice for. Create a video first, then we can swap the voice!";
      return {
        nextAgent: '__end__',
        currentAgent: 'voice_changer',
        finalResponse: noVideoMsg,
        shouldRespond: true,
        isComplete: true,
        messages: [new AIMessage({ content: noVideoMsg })],
      };
    }

    const promptMsg = "Sure! Let's pick a different voice for your narration.";

    return {
      nextAgent: '__end__',
      currentAgent: 'voice_changer',
      finalResponse: promptMsg,
      shouldRespond: true,
      isComplete: true,
      pendingVoiceChange: true,
      responseActions: [{ type: 'voice_select', label: 'Choose voice' }],
      messages: [new AIMessage({ content: promptMsg })],
    };
  }

  // Phase 2: voice has been selected — regenerate audio and update VideoAIData
  logger.info('=== VOICE CHANGER (Phase 2): Regenerating voiceover with new voice ===');

  if (!videoAIDataId) {
    logger.error('Voice changer phase 2: no videoAIDataId in state');
    const errMsg = 'Something went wrong — no video found to update. Please try again.';
    return {
      nextAgent: '__end__',
      currentAgent: 'voice_changer',
      finalResponse: errMsg,
      shouldRespond: true,
      isComplete: true,
      pendingVoiceChange: false,
      messages: [new AIMessage({ content: errMsg })],
    };
  }

  // Prefer state script; fall back to VideoAIData.formattedTranscript, then reconstruct
  // from editedWordsList for legacy videos where the script wasn't stored.
  let script = generatedScript;
  if (!script) {
    logger.info('Voice changer phase 2: generatedScript missing from state, fetching from VideoAIData');
    const videoData = await videoAIDataRepository.findById(videoAIDataId, false);

    if (videoData?.formattedTranscript) {
      script = videoData.formattedTranscript;
      logger.info('Voice changer phase 2: loaded script from VideoAIData.formattedTranscript');
    } else if (videoData?.editedWordsList?.length) {
      // Reconstruct plain-text script from word timings using shared sentence splitter
      const { sentences } = getSentencesFromWords(videoData.editedWordsList);
      script = sentences.map(s => s.content).join(' ');
      logger.info(`Voice changer phase 2: reconstructed script from ${videoData.editedWordsList.length} words → ${sentences.length} sentences`);
    }

    if (!script) {
      logger.error('Voice changer phase 2: no script found in state, formattedTranscript, or editedWordsList');
      const errMsg = "I couldn't find the script for your video. Please try again.";
      return {
        nextAgent: '__end__',
        currentAgent: 'voice_changer',
        finalResponse: errMsg,
        shouldRespond: true,
        isComplete: true,
        pendingVoiceChange: false,
        messages: [new AIMessage({ content: errMsg })],
      };
    }
  }

  let audioPath = '';
  try {
    // Step 1: Strip annotations from script
    await updatePendingStatus(conversationId, 'Preparing script for new voice...');
    const cleanedScriptResponse = await annotationRemoverAgent.invoke({ input: script });
    const cleanedScript = extractTextContent(cleanedScriptResponse.content);

    // Step 2: Generate TTS with new voice
    await updatePendingStatus(conversationId, 'Generating new voiceover...');
    const voice = voiceId || 'JBFqnCBsd6RMkjVDRZzb';
    logger.info(`Regenerating voiceover with voice: ${voice}`);

    const voiceoverResult = await generateVoiceover(cleanedScript, true, voice);
    audioPath = voiceoverResult.audioPath;
    const audioName = voiceoverResult.audioName;
    const transcript = voiceoverResult.transcript;

    if (!transcript || transcript.length === 0) {
      safelyDelete(audioPath);
      const errMsg = 'Error generating the new voiceover. Please try again.';
      return {
        agentOutput: errMsg,
        agentUsed: 'voice_changer',
        currentAgent: 'voice_changer',
        nextAgent: 'synthesize',
        pendingVoiceChange: false,
      };
    }

    // Step 3: Upload to S3
    await updatePendingStatus(conversationId, 'Saving new audio...');
    const s3AudioFilename = `chat-audio/${userId || 'anonymous'}/${uuidv4()}.mp3`;
    await uploadToS3(audioPath, s3AudioFilename, {
      mimeType: 'audio/mpeg',
      originalName: audioName,
      fileSize: fs.statSync(audioPath).size,
      userId: userId || 'anonymous'
    });
    const newAudioUrl = getS3FileUrl(s3AudioFilename);
    safelyDelete(audioPath);
    audioPath = '';
    logger.info(`New audio uploaded: ${newAudioUrl}`);

    // Step 4: Update VideoAIData with new voiceover + transcript.
    // Also clear `source` (the finalized compiled video) so the player falls back to audio-only
    // mode using the new voiceOver URL instead of the old baked-in voice from the compiled video.
    await updatePendingStatus(conversationId, 'Updating your video with the new voice...');

    // Compute new duration from the last word timing
    const totalDuration = transcript[transcript.length - 1]?.end ?? 0;

    // Fetch current data before updating to get the source URL and existing segments
    const existingVideo = await videoAIDataRepository.findById(videoAIDataId, false);
    const oldSourceUrl = existingVideo?.source?.url;

    // Trim segments to the new audio duration: remove segments that start past the end,
    // and cap the timeEnd of any segment that runs over.
    const trimmedSegments = existingVideo?.segments?.length
      ? existingVideo.segments
          .filter(s => s.timeStart < totalDuration)
          .map(s => ({
            _id: s._id,
            alternatives: s.alternatives,
            timeStart: s.timeStart,
            timeEnd: Math.min(s.timeEnd, totalDuration),
            keywords: s.keywords
          }))
      : undefined;

    // Trim croppedInfo the same way
    const trimmedCroppedInfo = existingVideo?.croppedInfo?.length
      ? existingVideo.croppedInfo
          .filter(c => c.timeStart < totalDuration)
          .map(c => ({
            x1: c.x1,
            x2: c.x2,
            y1: c.y1,
            y2: c.y2,
            frameStart: c.frameStart,
            frameEnd: c.frameEnd,
            timeStart: c.timeStart,
            timeEnd: Math.min(c.timeEnd, totalDuration)
          }))
      : undefined;

    await videoAIDataRepository.update(videoAIDataId, {
      voiceOver: newAudioUrl,
      editedWordsList: transcript,
      source: null,
      ...(trimmedSegments !== undefined && { segments: trimmedSegments }),
      ...(trimmedCroppedInfo !== undefined && { croppedInfo: trimmedCroppedInfo })
    });
    logger.info(
      `VideoAIData ${videoAIDataId} updated with new voiceover (source cleared, ` +
        `segments trimmed to ${totalDuration.toFixed(2)}s: ${trimmedSegments?.length ?? 'unchanged'})`
    );

    // Delete the old compiled video from S3 (non-fatal)
    if (oldSourceUrl) {
      try {
        const oldSourceKey = getKeyFromUrl(oldSourceUrl);
        await deleteFromS3Promise(oldSourceKey);
        logger.info(`Deleted old compiled video from S3: ${oldSourceKey}`);
      } catch (s3DeleteError) {
        logger.warn('Failed to delete old compiled video from S3 (non-fatal):', s3DeleteError);
      }
    }

    // Update TTS usage
    try {
      const minutes = Math.round((totalDuration / 60) * 100) / 100;
      await UserProfile.findOneAndUpdate(
        { firebaseId: userId },
        { $inc: { 'usage.ttsMinutesSpent': minutes } },
        { new: true }
      );
    } catch (bookkeepingError) {
      logger.warn('Failed to update TTS usage after voice change (non-fatal)', bookkeepingError);
    }

    return {
      agentOutput: `Voiceover regenerated successfully with new voice. Video ID: ${videoAIDataId}`,
      agentUsed: 'voice_changer',
      currentAgent: 'voice_changer',
      nextAgent: 'synthesize',
      audioUrl: newAudioUrl,
      transcriptWithTimings: transcript,
      pendingVoiceChange: false,
      // Carry videoAIDataId forward so workflowState.videoAIDataId survives in updatedWorkflowState
      videoAIDataId,
      // voice_changed is watched by VideoChatHistory to immediately trigger a video data refetch
      responseActions: [{ type: 'voice_changed', label: 'Voice updated', payload: { videoAIDataId } }],
    };
  } catch (error) {
    logger.error('Voice changer error:', error);
    if (audioPath) safelyDelete(audioPath);

    return {
      agentOutput: 'Error regenerating voiceover. Please try again.',
      agentUsed: 'voice_changer',
      currentAgent: 'voice_changer',
      nextAgent: 'synthesize',
      pendingVoiceChange: false,
    };
  }
}

/**
 * Footage Validation Node
 *
 * Validates that sufficient footage exists for the requested video topic.
 * Uses cluster-based search and LLM decision-making.
 *
 * Flow:
 * 1. Use topic from state (set by orchestrator)
 * 2. Search for footage clusters
 * 3. Pass results to Grok for decision
 * 4. Route to scriptwriter (proceed) or synthesize (suggest alternatives)
 */
export async function footageValidationNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  logger.info('=== FOOTAGE VALIDATION: Checking available footage ===');

  const { userId, requestedTopic, userMessage, conversationId } = state;

  // Use the topic passed from orchestrator, fallback to userMessage if empty
  const topic = requestedTopic || userMessage;

  try {
    // Update status before searching
    await updatePendingStatus(conversationId, 'Searching footage library...');

    // Search for footage clusters
    const { formattedResults, clusters, totalVideos } = await searchFootageClusters(topic, userId);

    logger.info(`Found ${totalVideos} videos across ${clusters.length} clusters`);
    logger.debug('Cluster results:', formattedResults);

    // If no footage at all, skip LLM decision
    if (clusters.length === 0 || totalVideos === 0) {
      logger.info('No footage found - suggesting alternatives');

      return {
        requestedTopic: topic,
        clusterSearchResults: formattedResults,
        footageDecision: 'suggest_alternatives',
        alternativeSuggestions: `You can load footage for "${topic}" in your library from the dashboard — click "+ Library" to create a library, then add clips from YouTube links or upload your own files.`,
        currentAgent: 'footage_validation',
        agentUsed: 'footage_validation',
        nextAgent: 'synthesize',
      };
    }

    // Ask Grok to analyze the clusters and make a decision
    logger.info('Asking Grok to analyze footage clusters...');
    const decisionResponse = await footageDecisionAgent.invoke({
      requestedTopic: topic,
      clusterResults: formattedResults
    });

    logger.debug('Grok decision response:', decisionResponse);

    const { decision, reason, suggestions } = parseFootageDecision(decisionResponse);

    logger.info(`Footage decision: ${decision} - ${reason}`);

    if (decision === 'proceed') {
      return {
        requestedTopic: topic,
        clusterSearchResults: formattedResults,
        footageDecision: 'proceed',
        alternativeSuggestions: '',
        currentAgent: 'footage_validation',
        agentUsed: 'footage_validation',
        nextAgent: 'scriptwriter',
      };
    } else {
      return {
        requestedTopic: topic,
        clusterSearchResults: formattedResults,
        footageDecision: 'suggest_alternatives',
        alternativeSuggestions: suggestions,
        currentAgent: 'footage_validation',
        agentUsed: 'footage_validation',
        agentOutput: reason,
        nextAgent: 'synthesize',
      };
    }
  } catch (error) {
    logger.error('Footage validation error:', error);

    return {
      requestedTopic: topic,
      clusterSearchResults: 'Error searching footage.',
      footageDecision: 'proceed',
      alternativeSuggestions: '',
      currentAgent: 'footage_validation',
      agentUsed: 'footage_validation',
      nextAgent: 'scriptwriter',
    };
  }
}

/**
 * Music Generator Node
 *
 * Generates AI background music via ElevenLabs and adds it to the existing video.
 *
 * Steps:
 * 1. Get videoAIDataId and generatedScript from state
 * 2. Fetch VideoAIData to get audio duration from transcript timings
 * 3. Generate music prompt (use custom musicStyle if provided, or generate from content)
 * 4. Generate music via ElevenLabs
 * 5. Upload to S3 and save to GeneratedMusic collection
 * 6. Update VideoAIData with audio track
 * 7. Route to synthesize
 */
export async function musicGeneratorNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  logger.info('=== MUSIC GENERATOR: Creating background music ===');

  const { videoAIDataId, generatedScript, musicStyle, userId, conversationId, requestedTopic } = state;

  // Validate that a video exists
  if (!videoAIDataId) {
    logger.error('No video exists to add music to');
    return {
      agentOutput: 'No video has been created yet. Please create a video first before adding music.',
      agentUsed: 'music_generator',
      currentAgent: 'music_generator',
      nextAgent: 'synthesize',
    };
  }

  let localMusicPath = '';

  try {
    // Step 1: Fetch VideoAIData to get duration
    await updatePendingStatus(conversationId, 'Preparing to compose your soundtrack...');
    logger.info(`Fetching VideoAIData: ${videoAIDataId}`);

    const videoData = await videoAIDataRepository.findById(videoAIDataId, false);

    if (!videoData) {
      logger.error(`VideoAIData not found: ${videoAIDataId}`);
      return {
        agentOutput: 'Could not find the video. Please try again.',
        agentUsed: 'music_generator',
        currentAgent: 'music_generator',
        nextAgent: 'synthesize',
      };
    }

    // Calculate duration from editedWordsList
    const transcript = videoData.editedWordsList || [];
    const transcriptDuration = transcript.length > 0
      ? transcript[transcript.length - 1].end
      : 30; // Default to 30 seconds if no transcript

    // Convert to milliseconds for ElevenLabs API (minimum 3 seconds, maximum 300 seconds)
    const musicLengthMs = Math.max(3000, Math.min(300000, transcriptDuration * 1000));

    logger.info(`Music duration: ${transcriptDuration}s (${musicLengthMs}ms)`);

    // Step 2: Generate music prompt
    await updatePendingStatus(conversationId, 'Our AI music director is analyzing your content...');

    let finalMusicPrompt: string;
    let estimatedMood = 'neutral';
    let musicPromptReasoning = '';

    const scriptContent = generatedScript || videoData.formattedTranscript || '';
    const title = requestedTopic || videoData.title || 'Untitled Video';

    if (musicStyle && musicStyle.trim()) {
      // User provided a custom music style
      finalMusicPrompt = musicStyle.trim();
      estimatedMood = 'custom';
      musicPromptReasoning = 'User-provided custom music style';
      logger.info(`Using custom music style: "${finalMusicPrompt}"`);
      await updatePendingStatus(conversationId, 'Using your custom music style to compose the perfect soundtrack...');
    } else {
      // Generate optimized music prompt based on content analysis
      logger.info('Generating music prompt from content analysis...');

      const contentAnalysis = analyzeVideoContent(scriptContent, title);
      estimatedMood = contentAnalysis.estimatedMood;

      const musicPromptResponse = await generateMusicPrompt({
        transcript: scriptContent,
        title,
        duration: transcriptDuration,
        videoType: contentAnalysis.suggestedVideoType
      });

      finalMusicPrompt = musicPromptResponse.prompt;
      musicPromptReasoning = musicPromptResponse.reasoning;
      logger.info(`Generated music prompt: "${finalMusicPrompt}"`);
    }

    // Step 3: Generate music using ElevenLabs
    await updatePendingStatus(conversationId, 'Our AI composer is creating your custom instrumental track...');

    const musicFileName = `music_${uuidv4()}.mp3`;
    localMusicPath = `/tmp/${musicFileName}`;

    logger.info('Generating music via ElevenLabs...');
    const music = await getElevenLabsMusic(
      `Create purely instrumental music, no vocals, lyrics, or spoken words, ${finalMusicPrompt}`,
      musicLengthMs,
      localMusicPath
    );

    logger.info('Music generated successfully');

    // Step 4: Upload to S3
    await updatePendingStatus(conversationId, 'Saving your soundtrack...');

    const s3Key = `audio/${musicFileName}`;
    await uploadToS3(localMusicPath, s3Key, {
      mimeType: 'audio/mpeg',
      originalName: musicFileName,
      fileSize: fs.statSync(localMusicPath).size,
      userId: userId || 'anonymous'
    });

    const musicUrl = getS3FileUrl(s3Key);
    logger.info(`Music uploaded to S3: ${musicUrl}`);

    // Step 5: Save to GeneratedMusic collection
    await generatedMusicRepository.create({
      userId: userId || 'anonymous',
      url: musicUrl,
      duration: transcriptDuration,
      prompt: finalMusicPrompt,
      reasoning: musicPromptReasoning,
      estimatedMood,
      filename: musicFileName,
      fileSize: fs.statSync(localMusicPath).size,
      elevenlabsMetadata: music.json?.songMetadata,
      elevenlabsCompositionPlan: music.json?.compositionPlan
    });

    logger.info('Music saved to GeneratedMusic collection');

    // Step 6: Update VideoAIData with audio track
    await updatePendingStatus(conversationId, 'Adding music to your video...');

    const newTrack: IVideoAIData['audio'][number] = {
      id: Date.now(),
      preview: musicUrl,
      duration: transcriptDuration,
      title: `AI Generated ${estimatedMood.charAt(0).toUpperCase() + estimatedMood.slice(1)} Instrumental Music`,
      audioType: 'AI_GENERATED',
      thumbnailUrl: '',
      waveformUrl: '',
      bpm: 0
    };

    const nextAudio: IVideoAIData['audio'] = [...(Array.isArray(videoData.audio) ? videoData.audio : []), newTrack];

    await videoAIDataRepository.update(videoAIDataId, {
      audio: nextAudio,
      audioVolume: typeof videoData.audioVolume === 'number' ? videoData.audioVolume : 0.07,
      audioEnabled: true,
      audioIndex: nextAudio.length - 1
    });

    logger.info('VideoAIData updated with music');

    // Clean up temp file
    safelyDelete(localMusicPath);
    localMusicPath = '';

    return {
      agentOutput: `Background music added!\n✓ Style: ${estimatedMood}\n✓ Duration: ${transcriptDuration.toFixed(1)}s`,
      agentUsed: 'music_generator',
      currentAgent: 'music_generator',
      nextAgent: 'synthesize',
    };
  } catch (error) {
    logger.error('Music generator error:', error);

    // Clean up temp file if it exists
    if (localMusicPath) {
      safelyDelete(localMusicPath);
    }

    return {
      agentOutput: 'Error generating background music. You can add music later in the video editor.',
      agentUsed: 'music_generator',
      currentAgent: 'music_generator',
      nextAgent: 'synthesize',
    };
  }
}

/**
 * App FAQ Node
 *
 * Answers user questions about how the app works, its features, and workflows.
 * This keeps comprehensive app knowledge out of the orchestrator prompt to avoid context rot.
 * The FAQ agent responds directly — no synthesis needed since it already produces user-friendly answers.
 */
export async function appFaqNode(
  state: ChatStateType
): Promise<Partial<ChatStateType>> {
  logger.info('=== APP FAQ: Answering user question about the app ===');

  const { userMessage, messages, uiContext } = state;

  // Format recent chat history for context
  const chatHistory = messages
    .slice(-6)
    .map(msg => {
      const role = msg._getType() === 'human' ? 'User' : 'Assistant';
      return `${role}: ${msg.content}`;
    })
    .join('\n') || 'No previous conversation.';

  try {
    const response = await appFaqAgent.invoke({
      userMessage,
      chatHistory,
      uiContext: uiContext || 'chat'
    });

    logger.debug('App FAQ response:', response);

    return {
      finalResponse: response,
      currentAgent: 'app_faq',
      nextAgent: '__end__',
      isComplete: true,
      shouldRespond: true,
      messages: [new AIMessage({ content: response })],
    };
  } catch (error) {
    logger.error('App FAQ error:', error);

    const fallbackResponse = 'I\'m sorry, I had trouble answering your question. You can find help in the Account tab or reach out to our support team.';

    return {
      finalResponse: fallbackResponse,
      currentAgent: 'app_faq',
      nextAgent: '__end__',
      isComplete: true,
      shouldRespond: true,
      messages: [new AIMessage({ content: fallbackResponse })],
    };
  }
}
