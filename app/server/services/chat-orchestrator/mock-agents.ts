/**
 * Mock Sub-Agents for Chat Orchestrator
 *
 * These are placeholder implementations that return predefined strings.
 * They will be replaced with actual LLM-powered agents later.
 */

export interface MockAgentInput {
  userMessage: string;
  context?: string;
}

export interface MockAgentOutput {
  content: string;
  agentName: string;
}

/**
 * Mock Scriptwriter Agent
 * Will eventually generate video scripts based on user input
 */
export async function scriptWriterAgent(input: MockAgentInput): Promise<MockAgentOutput> {
  // Simulate some processing time
  await delay(100);

  const topic = extractTopic(input.userMessage);

  return {
    content: `[MOCK SCRIPTWRITER] I would generate a compelling video script about "${topic}". The script would include:
- An attention-grabbing hook
- Key talking points structured for engagement
- A strong call-to-action ending

Ready to create your script when the real implementation is connected!`,
    agentName: 'scriptwriter'
  };
}

/**
 * Mock Footage Search Agent
 * Will eventually search for relevant video footage
 */
export async function footageSearchAgent(input: MockAgentInput): Promise<MockAgentOutput> {
  // Simulate some processing time
  await delay(100);

  const query = extractTopic(input.userMessage);

  return {
    content: `[MOCK FOOTAGE SEARCH] I searched for footage related to "${query}" and found:
- 5 high-quality stock video clips
- 3 clips from your personal library
- 2 trending clips that match your style

Ready to search your actual footage library when connected!`,
    agentName: 'footage_search'
  };
}

/**
 * Mock Video Overlay Agent
 * Will eventually handle text overlays, effects, and visual enhancements
 */
export async function videoOverlayAgent(input: MockAgentInput): Promise<MockAgentOutput> {
  // Simulate some processing time
  await delay(100);

  return {
    content: `[MOCK VIDEO OVERLAY] I would add the following to your video:
- Dynamic text overlays with your key points
- Smooth transitions between clips
- Brand-consistent color grading
- Engaging visual effects

Ready to apply real overlays when the implementation is complete!`,
    agentName: 'video_overlay'
  };
}

/**
 * Helper function to extract a topic/query from user message
 */
function extractTopic(message: string): string {
  // Simple extraction - take first 50 chars or until first period
  const cleaned = message.trim();
  const endIndex = Math.min(
    cleaned.indexOf('.') > 0 ? cleaned.indexOf('.') : cleaned.length,
    50
  );
  return cleaned.substring(0, endIndex) || 'your video';
}

/**
 * Simple delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Agent registry for easy lookup
 */
export const mockAgents = {
  scriptwriter: scriptWriterAgent,
  footage_search: footageSearchAgent,
  video_overlay: videoOverlayAgent
} as const;

export type MockAgentName = keyof typeof mockAgents;
