/**
 * Chat Orchestrator Module
 *
 * A LangGraph-based chat orchestrator for video generation assistance.
 * Routes user messages to specialized sub-agents (scriptwriter, footage search, video overlay).
 *
 * Key features:
 * - Footage validation: validates available footage before video creation
 *   and suggests alternatives if the user's footage doesn't match the requested topic.
 * - Script extractor: allows users to provide their own scripts and bypass
 *   footage validation when they confirm they want to use available footage.
 */

export { ChatState, ChatStateType } from './state';
export { chatOrchestrator, processMessage, streamMessage } from './graph';
export {
  orchestratorLLM,
  orchestratorAgent,
  synthesisAgent,
  footageDecisionAgent,
  parseFootageDecision,
  parseOrchestratorResponse,
  footageSuggestionAgent,
  getVideoGeneratedNote
} from './agents';
export { mockAgents, scriptWriterAgent, footageSearchAgent, videoOverlayAgent } from './mock-agents';
export type { MockAgentInput, MockAgentOutput, MockAgentName } from './mock-agents';
export { searchLibraryFootageTool, searchFootageClusters } from './tools';
export { footageValidationNode, scriptExtractorNode } from './nodes';
