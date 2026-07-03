export interface ChatMessageAction {
  type: string;
  label: string;
  payload?: unknown;
  completed?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  agentUsed?: string | null;
  isStreaming?: boolean; // True while message is being streamed
  actions?: ChatMessageAction[];
}

export interface SendMessageRequest {
  message: string;
  conversationId?: string;
}

export interface SendMessageResponse {
  id: string;
  role: 'assistant';
  content: string;
  timestamp: string;
  conversationId?: string;
  agentUsed?: string | null;
}

/**
 * SSE Stream Events
 */
export type StreamEventType = 'token' | 'done' | 'error' | 'status';

export interface StreamTokenEvent {
  type: 'token';
  content: string;
  node?: string;
}

export interface StreamDoneEvent {
  type: 'done';
  id: string;
  conversationId?: string;
  role: 'assistant';
  content: string;
  timestamp: string;
  agentUsed?: string | null;
  workflowState?: Partial<WorkflowState>;
}

export interface StreamErrorEvent {
  type: 'error';
  message: string;
}

export interface StreamStatusEvent {
  type: 'status';
  status: string;
  node: string;
}

export type StreamEvent = StreamTokenEvent | StreamDoneEvent | StreamErrorEvent | StreamStatusEvent;

/**
 * Conversation list types
 */
export interface ConversationSummary {
  _id: string;
  title: string;
  updatedAt: string;
}

/**
 * Workflow state that persists across messages
 */
export interface WorkflowState {
  requestedTopic?: string;
  generatedScript?: string;
  scriptConfirmed?: boolean;
  libraryIds?: string[];
  voiceId?: string;
  footageDecision?: 'proceed' | 'suggest_alternatives' | '';
  footageFetchStatus?: 'pending' | 'found' | 'partial' | 'failed';
  videoAIDataId?: string;
  audioUrl?: string;
}

/**
 * Pending message state for async processing
 */
export interface PendingMessage {
  messageId: string;
  userMessage: string;
  status: 'processing' | 'complete' | 'error';
  currentNode?: string;
  currentStatus?: string;
  response: string;
  agentUsed?: string | null;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface ConversationDetail {
  _id: string;
  userId: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    agentUsed?: string | null;
    actions?: ChatMessageAction[];
  }>;
  workflowState?: WorkflowState;
  pendingMessage?: PendingMessage;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Video Preview Types
 */
export interface VideoPreviewSegment {
  timeStart: number;
  timeEnd: number;
  alternatives: Array<{
    link: string;
    preview: string;
    thumbnailUrl: string;
    brollType?: 'VIDEO' | 'IMAGE' | 'AI_PHOTO' | 'SVG_INFOGRAPHIC';
  }>;
}

export interface VideoPreviewData {
  voiceOver: string;
  segments: VideoPreviewSegment[];
}

export interface VideoPreviewClip {
  url: string;
  thumbnail: string;
  timeStart: number;
  timeEnd: number;
  brollType?: 'VIDEO' | 'IMAGE' | 'AI_PHOTO' | 'SVG_INFOGRAPHIC';
}
