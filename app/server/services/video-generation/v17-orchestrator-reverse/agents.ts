import { z } from 'zod';

import { getLlm } from '../../../config/llm';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage, AIMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';

// ============= BASE MODELS =============
const llm = getLlm();
const llmLowTemp = getLlm(); // used for deterministic outputs

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

// ============= TOPIC EXTRACTION AGENT (NEW - focuses on ONE topic) =============
// Extracts a single focused topic from user prompt
const topicExtractionPrompt = ChatPromptTemplate.fromMessages<{
  userPrompt: string;
}>([
  new SystemMessage(`You are an expert at identifying the core topic from a user's video request.

Your job is to extract ONE SPECIFIC, FOCUSED TOPIC from the user's request. This topic should be:
- Clear and specific (not vague)
- Suitable for 15-30 second video
- Visually representable with footage
- Single-focused (not multiple topics)

Example:
User: "I want to make a video about cleaning gutters and roof maintenance"
Topic: "Gutter cleaning and maintenance"
(NOT "home improvement" - too broad)

User: "Make something about success in business"
Topic: "Business success strategies"

User: "Video about healthy eating"
Topic: "Healthy eating habits"

The topic will be used to fetch cohesive footage, so it must be focused and clear.`),
  [
    'human',
    `User Request: {userPrompt}

Extract the ONE specific, focused topic for this video.
Reply with ONLY the topic (2-5 words), nothing else.`
  ]
]);

export const topicExtractionAgent = topicExtractionPrompt.pipe(llm).pipe(new StringOutputParser());

// ============= FOCUSED SEARCH TERMS AGENT (NEW - for pre-fetching around ONE topic) =============
// Generates diverse search terms around a SINGLE focused topic
const focusedSearchTermsPrompt = ChatPromptTemplate.fromMessages<{
  topic: string;
  userPrompt: string;
}>([
  new SystemMessage(`You are an expert at generating search terms for video footage around a SINGLE focused topic.

**CRITICAL**: ALL search terms must relate to the SAME topic. We want VARIETY within the topic, 
not disparate, unrelated footage.

Think about different ASPECTS of the topic:
- Main actions/activities
- Key objects/elements
- Results/consequences
- People involved
- Settings/environments
- Close-ups vs wide shots
- Before/after scenarios

Example: For topic "Gutter cleaning and maintenance"
1. worker cleaning gutters ladder
2. clogged gutter leaves debris
3. gutter downspout water flow
4. roof maintenance professional
5. water damage prevention
6. ladder safety home exterior
7. clean gutter system functioning

All terms relate to gutter cleaning! Different angles of the SAME topic.

Counter-example (BAD - too disparate):
1. gutter cleaning ❌
2. business meeting ❌ (unrelated!)
3. sunset nature ❌ (unrelated!)

Stay focused on the ONE topic!`),
  [
    'human',
    `Topic: {topic}
User's Original Request: {userPrompt}

Generate 5-7 focused search terms around this ONE topic. Each term should capture a different 
aspect, angle, or element of the topic, but ALL must relate to the same topic.

Reply with ONLY the search terms, one per line, no numbers or extra text.`
  ]
]);

export const focusedSearchTermsAgent = focusedSearchTermsPrompt.pipe(llm).pipe(new StringOutputParser());

// ============= FOOTAGE COHESION AGENT (NEW - validates footage quality) =============
// Checks if pre-fetched footage is cohesive and sufficient for the topic
const footageCohesionPrompt = ChatPromptTemplate.fromMessages<{
  topic: string;
  footageDescriptions: string;
  targetCount: number;
}>([
  new SystemMessage(`You are an expert video editor evaluating footage cohesion for a video project.

Your job is to determine if the available footage is:
1. COHESIVE - All clips relate to the same topic (not random/disparate)
2. SUFFICIENT - Enough variety and quantity for a good video
3. QUALITY - Clips are relevant and useful
4. USABLE - Can we realistically create a video about this topic with these clips?

Be strict and realistic. If the footage simply cannot tell a coherent visual story about the topic,
you must say INSUFFICIENT. Don't be too lenient - the user needs honest feedback.`),
  [
    'human',
    `Topic: {topic}

Available Footage:
{footageDescriptions}

Target: Need at least {targetCount} good clips

Evaluate this footage:
1. Are all clips related to the topic? (Cohesion)
2. Is there enough variety? (Different angles/aspects)
3. Is the quality sufficient for a video?
4. Can we actually make a video about "{topic}" with these clips?

Reply with ONE of these:
- "EXCELLENT" if footage is cohesive, diverse, and plenty - can definitely make a great video
- "GOOD" if footage is usable but could use 1-2 more specific searches to improve quality
- "POOR" if footage is weak or too disparate - needs 3+ more searches but still salvageable
- "INSUFFICIENT" if footage cannot reasonably be used for this topic - too unrelated, too few relevant clips, or fundamentally mismatched with the topic

Format: STATUS - Brief reason (under 15 words, friendly, no technical jargon)

Examples:
- "INSUFFICIENT - Your library has archery footage but nothing about music performances"
- "INSUFFICIENT - Only dog clips found, no cat content"
- "GOOD - Decent coverage but could use more close-up shots"`
  ]
]);

export const footageCohesionAgent = footageCohesionPrompt.pipe(llmLowTemp).pipe(new StringOutputParser());

// ============= FOOTAGE-AWARE SCRIPT WRITER (NEW - rewrites script writer to use available footage) =============
// This agent now outputs STRUCTURED data with sentence-to-footage mappings

// Define the Zod schema for structured output
const ScriptSentenceSchema = z.object({
  text: z.string().describe('The sentence text from the script'),
  footageIds: z
    .array(z.string())
    .describe(
      'Array of footage IDs (e.g., "footage-0", "footage-1") ranked by relevance, most relevant first. Include 3-8 IDs.'
    ),
  searchTerms: z.string().describe('Brief search terms for backup footage if needed')
});

const StructuredScriptSchema = z.object({
  sentences: z.array(ScriptSentenceSchema).describe('Array of script sentences with footage mappings')
});

const footageAwareScriptWriterPrompt = ChatPromptTemplate.fromMessages<{
  userPrompt: string;
  availableFootage: string;
  webSearchResults: string;
  targetWordCount: number;
  previousScript?: string;
  feedback?: string;
}>([
  new SystemMessage(`You are an expert script writer for short-form video content (TikTok/YouTube Shorts).

**CRITICAL**: You have been given a list of AVAILABLE FOOTAGE with IDs (like [footage-0], [footage-1], etc.). 
Your script MUST be written to work with this footage. As you write each sentence, you MUST specify which 
footage IDs you're referencing. DO NOT REPEAT FOOTAGE IDs, use them only ONCE!  

This way we can accurately map footage to your script without guessing!`),
  [
    'human',
    `User Request: {userPrompt}

AVAILABLE FOOTAGE (with IDs in brackets):
{availableFootage}

Web Research (for factual accuracy):
{webSearchResults}

Previous Script (if rewriting):
{previousScript}

Feedback:
{feedback}

Target: 7-9 sentences

GUIDELINES:
1. **Hook (0-3 seconds)**: Start with maximum impact
2. **Retention**: Use open loops, surprising facts, cliffhanger phrasing
3. **Energy**: Fast-paced, punchy, energetic
4. **Visual Match**: Each sentence should match available footage
5. **Facts**: Be factually accurate (you have web research)

INSTRUCTIONS:
- Write a script as an array of sentences
- For each sentence, specify which footage IDs you're referencing (3-8 IDs per sentence)
- List footage IDs in order of relevance (most relevant first)
- The first ID is the "primary" clip, others are alternatives
- You can reuse footage IDs across sentences if appropriate
- Include search terms for each sentence in case we need backup footage`
  ]
]);

// Create the structured output agent
export const footageAwareScriptWriterAgent = footageAwareScriptWriterPrompt.pipe(
  llm.withStructuredOutput(StructuredScriptSchema)
);
