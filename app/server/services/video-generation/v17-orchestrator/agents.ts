import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage, AIMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';

import { getLlm } from '../../../config/llm';

// ============= BASE MODELS =============
const llm = getLlm();
const llmLowTemp = getLlm(); // used for deterministic outputs (e.g. footage adequacy)

// ============= TOPIC WRITER AGENT =============
// Suggests topics based on available footage and user prompt
const topicWriterPrompt = ChatPromptTemplate.fromMessages<{
  userPrompt: string;
  libraryInfo: string;
  previousAttempts: string;
}>([
  new SystemMessage(
    `You are a creative topic writer for short-form video content. Your job is to suggest engaging topics based on available footage.`
  ),
  [
    'human',
    `User Request: {userPrompt}

Available Footage:
{libraryInfo}

Previous Failed Attempts: {previousAttempts}

Generate a specific, engaging topic for a 15-30 second video that:
1. Matches the user's request
2. Can be supported by the available footage
3. Is different from previous failed attempts
4. Is perfect for short-form content (TikTok/YouTube Shorts)

Reply with ONLY the topic, nothing else.`
  ]
]);

export const topicWriterAgent = topicWriterPrompt.pipe(llm).pipe(new StringOutputParser());

// ============= HISTORIAN AGENT =============
// Checks if topic has been covered before
const historianPrompt = ChatPromptTemplate.fromMessages<{
  topic: string;
  history: string;
}>([
  new SystemMessage(`You are a historian who checks if a topic has already been covered in previous videos.`),
  [
    'human',
    `Topic to check: {topic}

Previous video scripts:
{history}

Has this topic already been covered in the previous scripts?
Consider topics as "already covered" if they discuss the same subject matter, even if worded differently.

Reply with exactly "YES" if already covered, or "NO" if it's new.`
  ]
]);

export const historianAgent = historianPrompt.pipe(llm).pipe(new StringOutputParser());

// ============= WEB RESEARCHER AGENT =============
// Searches the web for factual information about the topic
const webResearcherPrompt = ChatPromptTemplate.fromMessages<{
  topic: string;
  userPrompt: string;
}>([
  new SystemMessage(`You are a research assistant that determines what factual information to search for. Your training data has a knowledge cutoff and may be outdated — always prioritize finding the most recent, up-to-date information available on the web, especially for current events, breaking news, or anything that may have changed recently.`),
  [
    'human',
    `Topic: {topic}
User Request: {userPrompt}

Generate a concise web search query (5-10 words) to find factual, accurate information about this topic.
Prioritize finding RECENT and CURRENT information — include terms like "latest", "recent", or the current year when the topic may involve recent events, news, or developments.
Focus on getting facts, dates, statistics, or verifiable information.

Reply with ONLY the search query, nothing else.`
  ]
]);

export const webResearcherAgent = webResearcherPrompt.pipe(llm).pipe(new StringOutputParser());

// ============= SCRIPT WRITER AGENT =============
// Writes scripts based on topics, can search web for facts
const scriptWriterPrompt = ChatPromptTemplate.fromMessages<{
  topic: string;
  userPrompt: string;
  libraryInfo: string;
  webSearchResults: string;
  feedback: string;
  targetWordCount: number;
}>([
  new SystemMessage(`You are an expert script writer for short-form video content (TikTok/YouTube Shorts).

CRITICAL: Your training data has a knowledge cutoff date and may be months or years out of date. The world continues to change after your cutoff — events happen, records are broken, people are elected or removed from office, companies rise and fall, scientific discoveries are made. NEVER assume something hasn't happened just because you don't know about it. If web search results are provided, treat them as ground truth — they reflect the real, current state of the world. Do not second-guess, fact-check, or dismiss information from web search results as "unverified" or "possibly fake news". The search results ARE the facts for your script.`),
  [
    'human',
    `Create a script for this topic: {topic}

User's original request: {userPrompt}

Web research (if any):
{webSearchResults}

Feedback from previous attempts:
{feedback}

GUIDELINES:
1. **Hook (0-3 seconds)**: Start with maximum impact, grab attention immediately
2. **Retention**: Use open loops, surprising facts, cliffhanger phrasing
3. **Energy**: Fast-paced, punchy, energetic delivery
4. **Facts**: Include real, verifiable facts (use web search if needed)
5. **Ending**: Pay off the hook, add intrigue, encourage engagement
6. **Length**: Target {targetWordCount} words (15-30 seconds of speaking)

IMPORTANT:
- Focus on ONE topic only, don't mix topics
- Make sure the script can be visualized with the available footage
- Web search results above are factual and current — use them and trust them, even if the events postdate your training knowledge
- If you still need to verify additional facts, say "NEED_WEB_SEARCH: [your search query]"
- Reply with ONLY the script text, no annotations or explanations
- Do not include a title, just the script.

If you need web research, reply with: NEED_WEB_SEARCH: your search query
Otherwise, reply with the complete script.`
  ]
]);

export const scriptWriterAgent = scriptWriterPrompt.pipe(llm).pipe(new StringOutputParser());

// ============= ORCHESTRATOR AGENT =============
// Coordinates all other agents
const orchestratorPrompt = ChatPromptTemplate.fromMessages<{
  currentState: string;
  agentHistory: string;
}>([
  new SystemMessage(`You are an orchestrator coordinating multiple agents to generate video scripts with footage.

Available agents:
- topic_writer: Suggests video topics based on available footage
- historian: Checks if a topic was already covered
- script_writer: Writes the script for a topic
- footage_fetcher: Finds footage for each sentence in the script
- finalize: Completes the workflow

Your job is to decide which agent should run next based on the current state.`),
  [
    'human',
    `Current State:
{currentState}

Agent Execution History:
{agentHistory}

Based on this state, which agent should run next?
Reply with ONLY the agent name: topic_writer, historian, script_writer, footage_fetcher, or finalize`
  ]
]);

// Note: Currently not used - orchestrator uses deterministic routing
// Kept for future LLM-based routing implementation
export const orchestratorAgent = orchestratorPrompt.pipe(llm).pipe(new StringOutputParser());

// ============= SEARCH TERM GENERATION AGENT =============
// Generates optimized search terms for footage matching
const searchOptimizationLLM = getLlm();

const searchOptimizationChatPrompt = ChatPromptTemplate.fromMessages<{
  sentence: string;
  context: string;
  previousSearchTerms: string;
  feedback: string;
}>([
  new SystemMessage(`You are an expert at optimizing search terms for video footage.`),
  new AIMessage(`
Your task is to provide a search term for finding b-roll footage that matches a sentence in a script.

Create a concise, effective search term (3-5 words) that:
- Captures the core visual concept of the sentence
- Considers emotion and tone (tension, calmness, excitement, sadness)
- Matches the footage pace with sentence energy
- Considers visual conditions (indoor/outdoor, day/night, environment)
- Avoids repetition with previous search terms
- Ensures subject relevance

Example: For "Murders occur once every month" → "attacker in dark streets"

**Response Format**: Return ONLY the search term, no extra text, explanations, or greetings.
`),
  [
    'human',
    `Sentence: {sentence}
Full Script Context: {context}
Previous Search Terms Used: {previousSearchTerms}
Feedback from previous attempt: {feedback}`
  ]
]);

export const searchTermGenerationAgent = searchOptimizationChatPrompt
  .pipe(searchOptimizationLLM)
  .pipe(new StringOutputParser());

// ============= FOOTAGE APPROPRIATENESS AGENT =============
// Evaluates if footage matches the script sentence
const appropriatenessLLM = getLlm();

const appropriatenessChatPrompt = ChatPromptTemplate.fromMessages<{
  script: string;
  footageDescription: string;
}>([
  new SystemMessage('You are a video editor evaluating b-roll footage for a script.'),
  [
    'human',
    `You will receive a footage description for a sentence in a script. The sentence is highlighted with ** symbols.

Example: "This is my script, and **this sentence is highlighted**, but the rest is not."

The footage will cover the highlighted sentence. Evaluate if the footage is appropriate.

Reply with "yes" if appropriate, "no" if not.

Script: {script}
Footage Description: {footageDescription}
    `
  ]
]);

export const footageAppropriatenessAgent = appropriatenessChatPrompt
  .pipe(appropriatenessLLM)
  .pipe(new StringOutputParser());

const chatPrompt = ChatPromptTemplate.fromMessages<{ input: string }>([
  new SystemMessage(
    `You are an expert at analyzing user input for video creation. Another LLM has generated a script, but it sometimes inserts annotations into the script of what to show. Please remove those thoughts and return only the script. NOTHING ELSE, as I will use the script as is. Return any punctuation, comas, points, colons, semicolons as they are in the original please.
  
PLEASE DO THIS CAREFULLY, RETURN ONLY THE SENTENCE PLEASE!`
  ),
  ['human', `Script: {input}`]
]);

export const annotationRemoverAgent = chatPrompt.pipe(llm);

// ============= FOOTAGE ADEQUACY AGENT =============
// Evaluates if the found footage is adequate for the sentence
const footageAdequacyPrompt = ChatPromptTemplate.fromMessages<{
  sentence: string;
  searchTerms: string;
  footageOptions: string;
  context: string;
}>([
  new SystemMessage(`You are a video editor evaluating whether available footage is adequate for a script sentence.
Your job is to determine if the footage options found can appropriately visualize the sentence.`),
  [
    'human',
    `Sentence: {sentence}

Search Terms Used: {searchTerms}

Available Footage (top options with scores):
{footageOptions}

Full Script Context:
{context}

Evaluate if these footage options are adequate to visualize this sentence. Consider:
1. Relevance: Does the footage relate to the sentence content?
2. Quality: Are the scores reasonable (>0.5 indicates good match)?
3. Quantity: Are there enough options (at least 2-3 good alternatives)?
4. Visual Match: Can the footage effectively convey what's being said?

Reply with ONLY "YES" if the footage is fully adequate, "PARTIAL" if it's not perfect, but not completely inadequate or "NO" if it's insufficient and the sentence needs rewriting or different search terms.`
  ]
]);

export const footageAdequacyAgent = footageAdequacyPrompt.pipe(llmLowTemp).pipe(new StringOutputParser());
