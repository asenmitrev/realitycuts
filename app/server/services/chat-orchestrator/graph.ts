import { StateGraph } from '@langchain/langgraph';
import { ChatState } from './state';
import type { ChatStateType } from './state';
import {
  orchestratorNode,
  scriptWriterNode,
  scriptExtractorNode,
  footageSearchNode,
  footageValidationNode,
  footageFetcherNode,
  videoOverlayNode,
  synthesizeNode,
  musicGeneratorNode,
  appFaqNode,
  voiceChangerNode
} from './nodes';
import { logger } from '../logging';
import { HumanMessage } from '@langchain/core/messages';
import type { IWorkflowState } from '../../models/conversation';

/**
 * Chat Orchestrator Workflow
 *
 * A LangGraph-based orchestrator that routes user messages to specialized agents.
 *
 * Flow:
 * 1. User message → Orchestrator
 * 2. Orchestrator decides:
 *    - Respond directly → End
 *    - Call sub-agent → Route to agent
 * 3. Sub-agent executes → Synthesize
 * 4. Synthesize → End
 *
 * Video Creation Flow (with footage validation):
 * 1. User requests video → Orchestrator
 * 2. Orchestrator routes to footage_validation
 * 3. Footage validation searches clusters and asks Grok:
 *    - If footage matches topic → scriptwriter
 *    - If footage doesn't match → synthesize (with suggestions)
 * 4. Scriptwriter generates script → synthesize
 * 5. User confirms script → Orchestrator routes to footage_fetcher
 * 6. Footage fetcher maps clips to sentences → synthesize
 * 7. Synthesize → End
 *
 * Agents:
 * - orchestrator: Main decision-maker, talks to user
 * - footage_validation: Validates available footage before video creation
 * - scriptwriter: Generates video scripts using Claude + web search
 * - script_extractor: Processes user-provided scripts (skips footage validation)
 * - footage_fetcher: Maps footage clips to each sentence in confirmed script
 * - footage_search: Searches for video clips (for browsing)
 * - video_overlay: Handles text/effects overlays (mock)
 * - music_generator: Generates AI background music via ElevenLabs
 * - app_faq: Answers user questions about the app (features, automations, exports, etc.)
 * - synthesize: Converts agent output to user response
 */

/**
 * Routing function for conditional edges from orchestrator
 */
function routeFromOrchestrator(state: ChatStateType): string {
  const { nextAgent } = state;

  logger.debug(`Routing from orchestrator to: ${nextAgent}`);

  // Valid routing targets
  const validAgents = [
    'scriptwriter',
    'script_extractor',
    'footage_search',
    'footage_validation',
    'footage_fetcher',
    'video_overlay',
    'music_generator',
    'app_faq',
    'voice_changer',
    'synthesize',
    '__end__'
  ];

  if (validAgents.includes(nextAgent)) {
    return nextAgent;
  }

  // Default to end if unknown
  logger.warn(`Unknown next agent: ${nextAgent}, defaulting to __end__`);
  return '__end__';
}

/**
 * Routing function for conditional edges from footage_validation
 * Routes based on the LLM's decision about available footage
 */
function routeFromFootageValidation(state: ChatStateType): string {
  const { footageDecision, nextAgent } = state;

  logger.debug(`Routing from footage_validation - decision: ${footageDecision}, nextAgent: ${nextAgent}`);

  // The node sets nextAgent based on the decision
  if (nextAgent === 'scriptwriter' || nextAgent === 'synthesize') {
    return nextAgent;
  }

  // Fallback based on decision
  if (footageDecision === 'proceed') {
    return 'scriptwriter';
  }

  return 'synthesize';
}

/**
 * Build the chat orchestrator graph
 */
const workflow = new StateGraph(ChatState)
  // Add all nodes
  .addNode('orchestrator', orchestratorNode)
  .addNode('footage_validation', footageValidationNode)
  .addNode('scriptwriter', scriptWriterNode)
  .addNode('script_extractor', scriptExtractorNode)
  .addNode('footage_fetcher', footageFetcherNode)
  .addNode('footage_search', footageSearchNode)
  .addNode('video_overlay', videoOverlayNode)
  .addNode('music_generator', musicGeneratorNode)
  .addNode('app_faq', appFaqNode)
  .addNode('voice_changer', voiceChangerNode)
  .addNode('synthesize', synthesizeNode)

  // Entry point
  .addEdge('__start__', 'orchestrator')

  // Orchestrator routes conditionally
  .addConditionalEdges('orchestrator', routeFromOrchestrator, {
    scriptwriter: 'scriptwriter',
    script_extractor: 'script_extractor',
    footage_search: 'footage_search',
    footage_validation: 'footage_validation',
    footage_fetcher: 'footage_fetcher',
    video_overlay: 'video_overlay',
    music_generator: 'music_generator',
    app_faq: 'app_faq',
    voice_changer: 'voice_changer',
    synthesize: 'synthesize',
    __end__: '__end__'
  })

  // Footage validation routes conditionally based on LLM decision
  .addConditionalEdges('footage_validation', routeFromFootageValidation, {
    scriptwriter: 'scriptwriter',
    synthesize: 'synthesize'
  })

  // All sub-agents go to synthesize
  .addEdge('scriptwriter', 'synthesize')
  .addEdge('script_extractor', 'synthesize')
  .addEdge('footage_fetcher', 'synthesize')
  .addEdge('footage_search', 'synthesize')
  .addEdge('video_overlay', 'synthesize')
  .addEdge('music_generator', 'synthesize')
  // voice_changer routes conditionally: Phase 1 ends directly, Phase 2 goes to synthesize
  .addConditionalEdges('voice_changer', (state: ChatStateType) => state.nextAgent === 'synthesize' ? 'synthesize' : '__end__', {
    synthesize: 'synthesize',
    __end__: '__end__'
  })

  // App FAQ responds directly (no synthesis needed)
  .addEdge('app_faq', '__end__')

  // Synthesize ends the workflow
  .addEdge('synthesize', '__end__');

/**
 * Compiled chat orchestrator graph
 */
export const chatOrchestrator = workflow.compile();

/**
 * Process a chat message through the orchestrator
 *
 * @param userMessage - The user's message
 * @param conversationId - MongoDB conversation ID
 * @param userId - Firebase user ID
 * @param existingMessages - Previous messages in the conversation
 * @param workflowState - Restored workflow state from database (optional)
 * @returns The final state after processing
 */
export async function processMessage(config: {
  userMessage: string;
  conversationId: string;
  userId: string;
  uiContext?: 'chat' | 'editor';
  existingMessages?: ChatStateType['messages'];
  workflowState?: IWorkflowState;
  segmentContext?: Array<{ index: number; timeStart: number; timeEnd: number }>;
}): Promise<ChatStateType> {
  logger.info('Processing chat message through orchestrator...');

  // Restore workflow state from database if provided
  const restored = config.workflowState || {};

  const initialState: Partial<ChatStateType> = {
    userMessage: config.userMessage,
    conversationId: config.conversationId,
    userId: config.userId,
    uiContext: config.uiContext ?? 'chat',
    messages: [
      ...(config.existingMessages || []),
      new HumanMessage({ content: config.userMessage })
    ],
    currentAgent: 'orchestrator',
    nextAgent: '',
    agentOutput: '',
    agentUsed: null,
    finalResponse: '',
    shouldRespond: false,
    isComplete: false,
    // Footage validation fields - restore from DB or use defaults
    requestedTopic: restored.requestedTopic || '',
    clusterSearchResults: '',
    footageDecision: restored.footageDecision || '',
    alternativeSuggestions: '',
    // Script confirmation & footage fetching fields - restore from DB or use defaults
    generatedScript: restored.generatedScript || '',
    userProvidedScript: restored.userProvidedScript || false,
    extractedScriptText: '',
    scriptConfirmed: restored.scriptConfirmed || false,
    libraryIds: restored.libraryIds || [],
    voiceId: restored.voiceId || 'JBFqnCBsd6RMkjVDRZzb', // Default ElevenLabs voice (George)
    voiceSelectionPending: restored.voiceSelectionPending || false,
    pendingVoiceChange: restored.pendingVoiceChange || false,
    generatedAudioPath: '',
    generatedAudioName: '',
    transcriptWithTimings: restored.transcriptWithTimings || [],
    footageFetchStatus: restored.footageFetchStatus || 'pending',
    videoAIDataId: restored.videoAIDataId || '',
    audioUrl: restored.audioUrl || '',
    // Script language fields
    scriptLanguage: restored.scriptLanguage || '',
    // Music generation fields
    musicStyle: '',
    // Editor context - segment timeline for resolving positional clip references
    segmentContext: config.segmentContext || []
  };

  logger.debug('Initial state with restored workflow:', {
    hasScript: !!initialState.generatedScript,
    scriptConfirmed: initialState.scriptConfirmed,
    userProvidedScript: initialState.userProvidedScript,
    requestedTopic: initialState.requestedTopic,
    videoAIDataId: initialState.videoAIDataId,
    voiceSelectionPending: initialState.voiceSelectionPending,
    pendingVoiceChange: initialState.pendingVoiceChange
  });

  const result = await chatOrchestrator.invoke(initialState, {
    recursionLimit: 10
  });

  logger.info('Chat message processed successfully');
  logger.debug('Final response:', result.finalResponse);

  return result;
}

/**
 * Stream a chat message through the orchestrator
 *
 * @param userMessage - The user's message
 * @param conversationId - MongoDB conversation ID
 * @param userId - Firebase user ID
 * @param existingMessages - Previous messages in the conversation
 * @param workflowState - Restored workflow state from database (optional)
 * @returns AsyncGenerator yielding state updates
 */
export async function* streamMessage(config: {
  userMessage: string;
  conversationId: string;
  userId: string;
  uiContext?: 'chat' | 'editor';
  existingMessages?: ChatStateType['messages'];
  workflowState?: IWorkflowState;
  segmentContext?: Array<{ index: number; timeStart: number; timeEnd: number }>;
}): AsyncGenerator<{ node: string; state: Partial<ChatStateType> }> {
  logger.info('Streaming chat message through orchestrator...');

  // Restore workflow state from database if provided
  const restored = config.workflowState || {};

  const initialState: Partial<ChatStateType> = {
    userMessage: config.userMessage,
    conversationId: config.conversationId,
    userId: config.userId,
    uiContext: config.uiContext ?? 'chat',
    messages: [
      ...(config.existingMessages || []),
      new HumanMessage({ content: config.userMessage })
    ],
    currentAgent: 'orchestrator',
    nextAgent: '',
    agentOutput: '',
    agentUsed: null,
    finalResponse: '',
    shouldRespond: false,
    isComplete: false,
    // Footage validation fields - restore from DB or use defaults
    requestedTopic: restored.requestedTopic || '',
    clusterSearchResults: '',
    footageDecision: restored.footageDecision || '',
    alternativeSuggestions: '',
    // Script confirmation & footage fetching fields - restore from DB or use defaults
    generatedScript: restored.generatedScript || '',
    userProvidedScript: restored.userProvidedScript || false,
    extractedScriptText: '',
    scriptConfirmed: restored.scriptConfirmed || false,
    libraryIds: restored.libraryIds || [],
    voiceId: restored.voiceId || 'JBFqnCBsd6RMkjVDRZzb', // Default ElevenLabs voice (George)
    voiceSelectionPending: restored.voiceSelectionPending || false,
    pendingVoiceChange: restored.pendingVoiceChange || false,
    generatedAudioPath: '',
    generatedAudioName: '',
    transcriptWithTimings: restored.transcriptWithTimings || [],
    footageFetchStatus: restored.footageFetchStatus || 'pending',
    videoAIDataId: restored.videoAIDataId || '',
    audioUrl: restored.audioUrl || '',
    // Script language fields
    scriptLanguage: restored.scriptLanguage || '',
    // Music generation fields
    musicStyle: '',
    // Editor context - segment timeline for resolving positional clip references
    segmentContext: config.segmentContext || []
  };

  logger.debug('Initial state with restored workflow:', {
    hasScript: !!initialState.generatedScript,
    scriptConfirmed: initialState.scriptConfirmed,
    userProvidedScript: initialState.userProvidedScript,
    requestedTopic: initialState.requestedTopic,
    videoAIDataId: initialState.videoAIDataId,
    voiceSelectionPending: initialState.voiceSelectionPending,
    pendingVoiceChange: initialState.pendingVoiceChange
  });

  const stream = await chatOrchestrator.stream(initialState, {
    recursionLimit: 10
  });

  for await (const event of stream) {
    // event is { nodeName: stateUpdate }
    const nodeName = Object.keys(event)[0];
    const stateUpdate = event[nodeName as keyof typeof event];

    logger.debug(`Stream event from ${nodeName}:`, stateUpdate);

    yield {
      node: nodeName,
      state: stateUpdate as unknown as Partial<ChatStateType> || {}
    };
  }

  logger.info('Chat stream completed');
}

/**
 * Export the graph for visualization/debugging
 */
export { workflow as chatOrchestratorWorkflow };
