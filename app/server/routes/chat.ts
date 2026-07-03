import express from 'express';
import { connectMongo } from '../models/connect';
import { configureDotenv } from '../config/dotenv';
import { asyncHandler } from '../utils/async-handler';
import { authenticateJWT } from '../middleware/auth-middleware';
import { Conversation, IConversation, IChatMessage, IChatMessageAction, IWorkflowState, IPendingMessage } from '../models/conversation';
import { streamMessage } from '../services/chat-orchestrator';
import { ChatStateType } from '../services/chat-orchestrator/state';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { logger } from '../services/logging';
import { AuthenticatedRequest } from '../types';
import { TranscriptionJob } from '../models/transcription-job';
import videoAIDataRepository from '../repositories/video-ai-data.repository';
import { v4 as uuidv4 } from 'uuid';
import { UserProfile } from '../models/user-profile';
import { enqueueChatVideoFinalizationTask } from '../services/task-queue';
import { ChatVideoFinalizationEventData } from 'shared/types/event-contracts';

configureDotenv();

const router = express.Router();

async function ensureConversationMessageIds(conversation: IConversation): Promise<void> {
  let mutated = false;
  for (const msg of conversation.messages) {
    if (!msg.id) {
      msg.id = uuidv4();
      mutated = true;
    }
  }
  if (!mutated) return;
  try {
    await conversation.save();
  } catch (e) {
    // Best-effort only: still return the conversation response.
    logger.warn('Failed to backfill chat message IDs', {
      conversationId: conversation._id?.toString?.(),
      error: e instanceof Error ? e.message : String(e)
    });
  }
}

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

/**
 * Process chat message in background (async, does not block the request)
 * Updates the conversation's pendingMessage as it progresses
 */
async function processMessageInBackground(
  conversationId: string,
  messageId: string,
  userMessage: string,
  userId: string,
  existingLangChainMessages: (HumanMessage | AIMessage)[],
  restoredWorkflowState: IWorkflowState,
  uiContext: 'chat' | 'editor',
  segmentContext?: Array<{ index: number; timeStart: number; timeEnd: number }>
): Promise<void> {
  try {
    logger.info(`[Background] Starting processing for message ${messageId} in conversation ${conversationId}`);

    let fullResponse = '';
    let agentUsed: string | null = null;
    let latestState: Partial<ChatStateType> = {};

    const stream = streamMessage({
      userMessage,
      conversationId,
      userId,
      uiContext,
      existingMessages: existingLangChainMessages,
      workflowState: restoredWorkflowState,
      segmentContext
    });

    for await (const event of stream) {
      const { node, state } = event;

      logger.debug(`[Background] Event from ${node}:`, state);

      // Track the latest state
      latestState = { ...latestState, ...state };

      // Track which agent was used
      if (state.agentUsed) {
        agentUsed = state.agentUsed;
      }

      // Update response content
      if (state.finalResponse) {
        fullResponse = state.finalResponse;
      }

      // Update pending message status in database
      const statusMessage = getNodeStatusMessage(node);
      await Conversation.updateOne(
        { _id: conversationId },
        {
          $set: {
            'pendingMessage.currentNode': node,
            'pendingMessage.currentStatus': statusMessage,
            'pendingMessage.response': fullResponse,
            'pendingMessage.agentUsed': agentUsed
          }
        }
      );
    }

    // Processing complete - build updated workflow state
    const updatedWorkflowState: IWorkflowState = {
      requestedTopic: latestState.requestedTopic || restoredWorkflowState.requestedTopic || '',
      generatedScript: latestState.generatedScript || restoredWorkflowState.generatedScript || '',
      scriptConfirmed: latestState.scriptConfirmed ?? restoredWorkflowState.scriptConfirmed ?? false,
      libraryIds: latestState.libraryIds || restoredWorkflowState.libraryIds || [],
      voiceId: latestState.voiceId || restoredWorkflowState.voiceId || 'JBFqnCBsd6RMkjVDRZzb',
      voiceSelectionPending: latestState.voiceSelectionPending ?? restoredWorkflowState.voiceSelectionPending ?? false,
      pendingVoiceChange: latestState.pendingVoiceChange ?? restoredWorkflowState.pendingVoiceChange ?? false,
      footageDecision: latestState.footageDecision || restoredWorkflowState.footageDecision || '',
      footageFetchStatus: latestState.footageFetchStatus || restoredWorkflowState.footageFetchStatus || 'pending',
      videoAIDataId: latestState.videoAIDataId || restoredWorkflowState.videoAIDataId || '',
      audioUrl: latestState.audioUrl || restoredWorkflowState.audioUrl || '',
      transcriptWithTimings: latestState.transcriptWithTimings || restoredWorkflowState.transcriptWithTimings || [],
      scriptLanguage: latestState.scriptLanguage || restoredWorkflowState.scriptLanguage || ''
    };

    // Map responseActions to message actions (type, label, payload, completed)
    const actions: IChatMessageAction[] | undefined = latestState.responseActions?.length
      ? latestState.responseActions.map(a => ({
          type: a.type,
          label: a.label,
          payload: a.payload,
          completed: a.completed ?? false
        }))
      : undefined;

    // Mark as complete and add assistant message
    const assistantChatMessage: IChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date(),
      agentUsed,
      actions
    };

    await Conversation.updateOne(
      { _id: conversationId },
      {
        $set: {
          'pendingMessage.status': 'complete',
          'pendingMessage.response': fullResponse,
          'pendingMessage.agentUsed': agentUsed,
          'pendingMessage.completedAt': new Date(),
          'pendingMessage.workflowStateUpdates': updatedWorkflowState,
          workflowState: updatedWorkflowState
        },
        $push: {
          messages: assistantChatMessage
        }
      }
    );

    // Increment chat credits usage
    const creditsConsumed = 1;
    await UserProfile.updateOne(
      { firebaseId: userId },
      { $inc: { 'usage.chatCreditsSpent': creditsConsumed } }
    );
    logger.info(`[Background] Charged ${creditsConsumed} chat credits to ${userId}`);

    logger.info(`[Background] Processing complete for message ${messageId}`);
  } catch (error) {
    logger.error(`[Background] Error processing message ${messageId}:`, error);

    // Mark as error
    await Conversation.updateOne(
      { _id: conversationId },
      {
        $set: {
          'pendingMessage.status': 'error',
          'pendingMessage.error': error instanceof Error ? error.message : 'Unknown error',
          'pendingMessage.completedAt': new Date()
        }
      }
    );
  }
}

/**
 * POST /api/chat - Send a message and start async processing
 *
 * Request body:
 * - message: string (required) - The user's message
 * - conversationId: string (optional) - Existing conversation ID to continue
 *
 * Response: JSON with conversationId and messageId for polling
 */
router.post(
  '/',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { message, conversationId, voiceId, uiContext, segmentContext } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check chat credits limit
    const userProfile = await UserProfile.findOne({ firebaseId: userId });
    const creditsRemaining = userProfile?.getChatCreditsRemaining() ?? 0;
    if (creditsRemaining <= 0) {
      return res.status(429).json({
        error: 'Chat limit reached',
        message: 'You have used all your free chat credits this month. Upgrade to continue.',
        limitReached: true,
        creditsRemaining: 0
      });
    }

    try {
      // Get or create conversation
      let conversation: IConversation | null = null;

      if (conversationId) {
        conversation = await Conversation.findOne({
          _id: conversationId,
          userId,
          isActive: true
        });
      }

      if (!conversation) {
        conversation = new Conversation({
          userId,
          messages: [],
          isActive: true
        });
      }

      // Check if there's already a pending message
      if (conversation.pendingMessage?.status === 'processing') {
        return res.status(409).json({
          error: 'A message is already being processed',
          messageId: conversation.pendingMessage.messageId
        });
      }

      // Generate unique message ID
      const messageId = uuidv4();

      // Add user message to conversation
      const userChatMessage: IChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        agentUsed: null
      };
      conversation.messages.push(userChatMessage);

      // Set up pending message state
      const pendingMessage: IPendingMessage = {
        messageId,
        userMessage: message,
        status: 'processing',
        currentNode: 'orchestrator',
        currentStatus: 'Understanding your request',
        response: '',
        agentUsed: null,
        startedAt: new Date()
      };
      conversation.pendingMessage = pendingMessage;

      // If voiceId provided, update workflow state and mark voice_select action completed on last assistant message
      if (voiceId && typeof voiceId === 'string') {
        if (!conversation.workflowState) {
          conversation.workflowState = {};
        }
        conversation.workflowState.voiceId = voiceId;
        // Mark the last assistant message's voice_select action as completed so the button is hidden on reopen
        const messages = conversation.messages;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant' && messages[i].actions?.length) {
            const updated = messages[i].actions!.map(a =>
              a.type === 'voice_select' ? { ...a, completed: true } : a
            );
            messages[i].actions = updated;
            break;
          }
        }
      }

      // Save conversation with pending message
      await conversation.save();

      const savedConversationId = conversation._id!.toString();

      // Convert existing messages to LangChain format for context (exclude the just-added user message)
      const existingLangChainMessages = conversation.messages.slice(0, -1).map(msg => {
        if (msg.role === 'user') {
          return new HumanMessage({ content: msg.content });
        }
        return new AIMessage({ content: msg.content });
      });

      // Restore workflow state from conversation
      const restoredWorkflowState: IWorkflowState = conversation.workflowState || {};

      logger.info(`Starting background processing for message ${messageId} in conversation ${savedConversationId}`);

      // Start background processing (don't await!)
      processMessageInBackground(
        savedConversationId,
        messageId,
        message,
        userId,
        existingLangChainMessages,
        restoredWorkflowState,
        uiContext === 'editor' ? 'editor' : 'chat',
        Array.isArray(segmentContext) ? segmentContext : undefined
      ).catch(err => {
        logger.error(`Background processing failed for ${messageId}:`, err);
      });

      // Return immediately with IDs for polling
      return res.json({
        conversationId: savedConversationId,
        messageId,
        status: 'processing'
      });
    } catch (error) {
      logger.error('Chat error:', error);
      return res.status(500).json({ error: 'An error occurred while processing your message' });
    }
  })
);

/**
 * POST /api/chat/conversations/by-video/:videoAIDataId - Create (or fetch) conversation for a video
 *
 * For legacy/old videos that predate chat, the editor can call this to create an empty conversation
 * associated with the video so chat-mode editing can be enabled.
 *
 * Response: { conversation: { _id, title, messages } }
 */
router.post(
  '/conversations/by-video/:videoAIDataId',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.uid;
    const { videoAIDataId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!videoAIDataId || typeof videoAIDataId !== 'string') {
      return res.status(400).json({ error: 'videoAIDataId is required' });
    }

    // Validate ownership of the video before linking it to a conversation
    const videoAIData = await videoAIDataRepository.findById(videoAIDataId, false);
    if (!videoAIData) {
      return res.status(404).json({ error: 'Video not found' });
    }
    if (videoAIData.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If a conversation already exists for this video, return it (idempotent)
    let conversation = await Conversation.findOne({
      userId,
      isActive: true,
      'workflowState.videoAIDataId': videoAIDataId
    });

    if (!conversation) {
      conversation = new Conversation({
        userId,
        messages: [],
        isActive: true,
        workflowState: {
          videoAIDataId
        }
      });

      await conversation.save();
    }

    return res.json({
      conversation: {
        _id: conversation._id,
        title: conversation.title,
        messages: conversation.messages
      }
    });
  })
);

/**
 * GET /api/chat/status/:conversationId - Poll for message processing status
 *
 * Response:
 * - status: 'processing' | 'complete' | 'error'
 * - currentStatus: Human-readable status message
 * - response: The response content so far (or final response)
 * - agentUsed: Which agent generated the response
 * - workflowState: Updated workflow state (when complete)
 * - error: Error message (if status is 'error')
 */
router.get(
  '/status/:conversationId',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.uid;
    const { conversationId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const pending = conversation.pendingMessage;

    if (!pending) {
      return res.json({
        status: 'idle',
        message: 'No pending message'
      });
    }

    const response: {
      status: string;
      messageId: string;
      currentStatus?: string;
      currentNode?: string;
      response: string;
      agentUsed?: string | null;
      error?: string;
      workflowState?: Partial<IWorkflowState>;
    } = {
      status: pending.status,
      messageId: pending.messageId,
      currentStatus: pending.currentStatus,
      currentNode: pending.currentNode,
      response: pending.response,
      agentUsed: pending.agentUsed
    };

    if (pending.status === 'error') {
      response.error = pending.error;
    }

    if (pending.status === 'complete') {
      // Include workflow state updates
      response.workflowState = {
        videoAIDataId: conversation.workflowState?.videoAIDataId,
        requestedTopic: conversation.workflowState?.requestedTopic,
        generatedScript: conversation.workflowState?.generatedScript,
        scriptConfirmed: conversation.workflowState?.scriptConfirmed,
        footageDecision: conversation.workflowState?.footageDecision,
        footageFetchStatus: conversation.workflowState?.footageFetchStatus,
        audioUrl: conversation.workflowState?.audioUrl
      };

      // Clear pending message after client acknowledges completion
      // (Client should call this endpoint and see 'complete', then it's done)
    }

    return res.json(response);
  })
);

/**
 * GET /api/chat/conversations - List user's conversations
 */
router.get(
  '/conversations',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const conversations = await Conversation.find({
      userId,
      isActive: true
    })
      .select('_id title updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json({ conversations });
  })
);

/**
 * GET /api/chat/conversations/by-video/:videoAIDataId - Get conversation by video ID
 * Returns the conversation (messages only) associated with a given VideoAIData ID.
 */
router.get(
  '/conversations/by-video/:videoAIDataId',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.uid;
    const { videoAIDataId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const conversation = await Conversation.findOne({
      userId,
      'workflowState.videoAIDataId': videoAIDataId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await ensureConversationMessageIds(conversation);

    res.json({
      conversation: {
        _id: conversation._id,
        title: conversation.title,
        messages: conversation.messages
      }
    });
  })
);

/**
 * GET /api/chat/conversations/:id - Get a specific conversation
 */
router.get(
  '/conversations/:id',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.uid;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      userId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await ensureConversationMessageIds(conversation);

    res.json({ conversation });
  })
);

/**
 * POST /api/chat/conversations/:conversationId/actions/complete
 *
 * Marks a specific action on a specific assistant message as completed.
 * This is used for one-time UI actions (e.g. editor_dispatch) so refresh won't replay them.
 *
 * Body: { messageId: string; actionType: string }
 */
router.post(
  '/conversations/:conversationId/actions/complete',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.uid;
    const { conversationId } = req.params;
    const { messageId, actionType } = req.body as { messageId?: string; actionType?: string };

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({ error: 'conversationId is required' });
    }
    if (!messageId || typeof messageId !== 'string') {
      return res.status(400).json({ error: 'messageId is required' });
    }
    if (!actionType || typeof actionType !== 'string') {
      return res.status(400).json({ error: 'actionType is required' });
    }

    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    let updated = false;
    for (const msg of conversation.messages) {
      if (msg.id !== messageId) continue;
      if (!msg.actions?.length) break;
      const next = msg.actions.map(a => (a.type === actionType ? { ...a, completed: true } : a));
      msg.actions = next;
      updated = true;
      break;
    }

    if (updated) {
      await conversation.save();
    }

    return res.json({ success: true, updated });
  })
);

/**
 * DELETE /api/chat/conversations/:id - Delete a conversation
 */
router.delete(
  '/conversations/:id',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.uid;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await Conversation.findOneAndUpdate(
      { _id: id, userId },
      { isActive: false },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true });
  })
);

/**
 * POST /api/chat/finalize-video - Finalize a chat-generated video
 *
 * Creates a TranscriptionJob and enqueues a Lambda task to generate
 * the black-screen video with voiceover and update VideoAIData.
 *
 * Request body:
 * - videoAIDataId: string (required) - The VideoAIData ID to finalize
 *
 * Response:
 * - eventId: string - The TranscriptionJob ID to track progress
 */
router.post(
  '/finalize-video',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.uid;
    const { videoAIDataId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!videoAIDataId || typeof videoAIDataId !== 'string') {
      return res.status(400).json({ error: 'videoAIDataId is required' });
    }

    // Fetch VideoAIData and validate ownership
    const videoAIData = await videoAIDataRepository.findById(videoAIDataId, false);

    if (!videoAIData) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (videoAIData.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userProfile = await UserProfile.findOne({ firebaseId: userId });
    if (userProfile?.isAnonymous) {
      return res.status(403).json({
        error: 'registration_required',
        message: 'Please sign up to finalize your video'
      });
    }

    if (!videoAIData.voiceOver) {
      return res.status(400).json({ error: 'Video has no voiceover audio' });
    }

    // Create TranscriptionJob with data from VideoAIData
    const transcriptionJob = new TranscriptionJob({
      userId,
      status: 'QUEUED',
      title: videoAIData.title || 'Chat-generated video',
      script: videoAIData.formattedTranscript || '',
      transcript: videoAIData.editedWordsList || [],
      jobType: 'SCRIPT'
    });

    await transcriptionJob.save();

    logger.info('Created TranscriptionJob for chat video finalization', {
      tjId: transcriptionJob._id.toString(),
      videoAIDataId,
      userId
    });

    // Enqueue Lambda task
    const eventData: ChatVideoFinalizationEventData = {
      videoAIDataId,
      tjId: transcriptionJob._id.toString(),
      userId,
      voiceOverUrl: videoAIData.voiceOver,
      title: videoAIData.title || 'Chat-generated video',
      version: '1.0.0'
    };

    await enqueueChatVideoFinalizationTask(eventData);

    logger.info('Enqueued chat video finalization task', {
      tjId: transcriptionJob._id.toString(),
      videoAIDataId,
      userId
    });

    res.json({ eventId: transcriptionJob._id.toString() });
  })
);

/**
 * Helper function to send SSE events
 */
function sendSSE(res: express.Response, event: string, data: object): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  // Flush to ensure immediate delivery (important for status updates)
  if (typeof (res as any).flush === 'function') {
    (res as any).flush();
  }
}

/**
 * Map of node names to user-friendly status messages
 */
const NODE_STATUS_MESSAGES: Record<string, string> = {
  orchestrator: 'Understanding your request',
  footage_validation: 'Searching footage library',
  scriptwriter: 'Researching and writing the script',
  footage_fetcher: 'Finding matching footage and generating audio. This can take some time...',
  footage_search: 'Searching for footage clips',
  video_overlay: 'Processing video overlays',
  music_generator: 'Composing background music for your video...',
  voice_changer: 'Regenerating voiceover with new voice...',
  synthesize: 'Preparing response'
};

/**
 * Get user-friendly status message for a node
 */
function getNodeStatusMessage(node: string): string | null {
  return NODE_STATUS_MESSAGES[node] || null;
}

// =====================
// ADMIN ENDPOINTS (UAT only)
// =====================

/**
 * GET /api/chat/admin/conversations - List all conversations from all users
 * Admin endpoint for UAT environment
 */
router.get(
  '/admin/conversations',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { skip = '0', limit = '50', search = '' } = req.query;

    const skipNum = parseInt(skip as string) || 0;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);

    // Build query
    const query: Record<string, unknown> = { isActive: true };

    // Optional search by userId or title
    if (search) {
      query.$or = [
        { userId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .select('_id userId title messages workflowState createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .lean(),
      Conversation.countDocuments(query)
    ]);

    // Transform to include message count and last message preview
    const conversationsWithMeta = conversations.map(conv => ({
      _id: conv._id,
      userId: conv.userId,
      title: conv.title || 'Untitled',
      messageCount: conv.messages?.length || 0,
      lastMessage: conv.messages?.length > 0
        ? conv.messages[conv.messages.length - 1].content.substring(0, 100)
        : '',
      hasVideo: !!conv.workflowState?.videoAIDataId,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }));

    res.json({
      conversations: conversationsWithMeta,
      total,
      skip: skipNum,
      limit: limitNum
    });
  })
);

/**
 * GET /api/chat/admin/conversations/:id - Get full conversation details (admin)
 * Returns complete conversation with all messages for admin viewing
 */
router.get(
  '/admin/conversations/:id',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    const conversation = await Conversation.findById(id).lean();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ conversation });
  })
);

/**
 * GET /api/chat/admin/stats - Get chat statistics for admin dashboard
 */
router.get(
  '/admin/stats',
  authenticateJWT,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { days = '28' } = req.query;
    const daysNum = parseInt(days as string) || 28;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const [
      totalConversations,
      activeConversations,
      conversationsInPeriod,
      uniqueUsersInPeriod,
      conversationsWithVideos
    ] = await Promise.all([
      Conversation.countDocuments({}),
      Conversation.countDocuments({ isActive: true }),
      Conversation.countDocuments({
        createdAt: { $gte: startDate }
      }),
      Conversation.distinct('userId', {
        createdAt: { $gte: startDate }
      }).then(users => users.length),
      Conversation.countDocuments({
        'workflowState.videoAIDataId': { $exists: true, $ne: '' }
      })
    ]);

    res.json({
      totalConversations,
      activeConversations,
      conversationsInPeriod,
      uniqueUsersInPeriod,
      conversationsWithVideos,
      periodDays: daysNum
    });
  })
);

export default router;
