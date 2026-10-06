import { z } from 'zod';
import { getTavilyWebSearch } from './tools';
import { ScriptWriterState } from './state';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { getLlm } from '../../../config/llm';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { GraphRecursionError } from '@langchain/langgraph';
import { getSampledLibraryInfo } from '../../../agents/library-aware-script.agent';
import { annotationRemoverAgent } from '../../../agents/annotation-remover.agent';
import { getScriptWriterAgent, SCRIPT_WRITER_LLM_OPTIONS, scriptWriterPrompt } from './agents';

// One agent step + one tool step per search; 8 leaves room for two searches and the final answer.
const SCRIPT_AGENT_RECURSION_LIMIT = 8;
import { logger } from '../../../services/logging';
export async function fetchLibraryFootage(
  state: typeof ScriptWriterState.State
): Promise<Partial<typeof ScriptWriterState.State>> {
  logger.info('[ScriptWriter] Fetching library footage', {
    libraryIds: state.libraryIds,
    sample: state.librarySamples + 1
  });

  // Execute the tool
  const libraryInfo = await getSampledLibraryInfo(state.libraryIds);

  logger.info('[ScriptWriter] Library footage sampled', { libraryInfoLength: libraryInfo.length });

  return {
    libraryInfo: libraryInfo,
    librarySamples: state.librarySamples + 1,
    topicRetries: 0
  };
}

export async function fetchViralTopicsNode(
  _state: typeof ScriptWriterState.State
): Promise<Partial<typeof ScriptWriterState.State>> {
  // Viral video tracking was removed; this node is now a no-op passthrough.
  return {
    viralVideoContext: '',
    viralTopics: []
  };
}

export async function topicNode(
  state: typeof ScriptWriterState.State
): Promise<Partial<typeof ScriptWriterState.State>> {
  logger.info('[ScriptWriter] Generating topic', {
    attempt: state.topicRetries + 1,
    previousTopicsCount: state.previousTopics?.length ?? 0
  });

  const { messages, previousTopics, viralVideoContext } = state;
  const userPrompt = state.userPrompt;
  const libraryContent = state.libraryInfo;

  // Build the prompt with optional viral video context
  let promptTemplate = `The user has asked you to generate a new topic for a video. The user has also provided a summary of what they have in their video library in terms of b-roll. You will respond with just the topic.\n 
  Here is the initial question:
  \n ------- \n
  {userPrompt}  `;

  // Add viral video context if available
  if (viralVideoContext && viralVideoContext.length > 0) {
    promptTemplate += `
  \n ------- \n
  VIRAL VIDEO INSIGHTS:
  \n ------- \n
  {viralVideoContext}
  
  NOTE: These viral short-form videos have performed exceptionally well. PRIORITISE REUSING TOPICS FROM THE VIRAL VIDEOS, even if library footage is not perfect, unless these topics were tried before.`;
  }

  promptTemplate += `\n ------- \n
  Here is the library content:
  \n ------- \n
  {libraryContent}`;

  promptTemplate += `
  \n ------- \n
  Avoid these topics that were tried before: {previousTopics}
  \n ------- \n
  Formulate an improved question:`;

  const prompt = ChatPromptTemplate.fromTemplate(promptTemplate);

  const model = getLlm(SCRIPT_WRITER_LLM_OPTIONS);

  const response = await prompt.pipe(model).invoke({
    userPrompt,
    libraryContent,
    previousTopics,
    viralVideoContext: viralVideoContext || ''
  });

  const topicContent = response.content as string;
  logger.info('[ScriptWriter] Topic generated', { topic: topicContent });

  return {
    messages: [response],
    topic: topicContent,
    previousTopics: [topicContent],
    topicRetries: state.topicRetries + 1
  };
}

export async function checkIfTopicIsInHistory(
  state: typeof ScriptWriterState.State
): Promise<Partial<typeof ScriptWriterState.State>> {
  logger.info('[ScriptWriter] Checking topic against history', { topic: state.topic });
  const { topic, history } = state;

  const prompt = ChatPromptTemplate.fromTemplate(
    `The user has asked you to check if a topic is in the history of videos that have been created. You will receive a history of videos, that consist of the video scripts.\n 
  Here is the history:
  \n ------- \n
  {history} 
  \n ------- \n
  Here is the topic:
  \n ------- \n
  {topic} 
  \n ------- \n
Give a binary score 'yes' or 'no' score to indicate whether the topic is already in the history of videos that have been created. Make sure to be precise and accurate.
  Yes: The topic is already in the history of videos that have been created.
  No: The topic is not in the history of videos that have been created.`
  );
  const tool = {
    name: 'determine_topic_presence_in_history',
    description: 'Determine if the topic is already in the history of videos that have been created.',
    schema: z.object({
      binaryScore: z.string().describe("Topic presence score 'yes' or 'no'")
    })
  };

  const model = getLlm(SCRIPT_WRITER_LLM_OPTIONS).bindTools([tool]);
  const response = await prompt.pipe(model).invoke({ history, topic });
  const binaryScore = response.tool_calls?.[0]?.args?.binaryScore;
  logger.info('[ScriptWriter] Topic history check result', { topic, alreadyInHistory: binaryScore });
  return {
    messages: [response]
  };
}

export async function tavilyWebSearchNode(
  state: typeof ScriptWriterState.State
): Promise<Partial<typeof ScriptWriterState.State>> {
  logger.debug('Tavily Web Search Node');

  const toolNode = new ToolNode([getTavilyWebSearch()]);

  const messageWithSingleToolCall = new AIMessage({
    content: '',
    tool_calls:
      'tool_calls' in state.messages[state.messages.length - 1]
        ? (state.messages[state.messages.length - 1] as AIMessage).tool_calls!
        : []
  });

  // ToolNode expects messages as input, not the full state
  const result = await toolNode.invoke({ messages: [messageWithSingleToolCall] });

  logger.debug('Tavily Web Search Result:', result.messages[0].content);

  return {
    messages: result.messages,
    searchResults: result.messages[0].content
  };
}
export async function generateScriptNode(
  state: typeof ScriptWriterState.State
): Promise<Partial<typeof ScriptWriterState.State>> {
  const { topic, userPrompt, longForm } = state;
  const wordCount = longForm ? '500' : '150-180';
  logger.info('[ScriptWriter] Generating script', { topic, longForm, targetWordCount: wordCount });
  const inputMessages: BaseMessage[] = [
    new HumanMessage(`Here is the user provided prompt:
  \n ------- \n
  ${userPrompt} 
  \n ------- \n
  Here is the topic:
  \n ------- \n
  ${topic}   
  \n ------- \n
  Length: Aim for ${
    longForm ? '4 minutes' : '60 seconds'
  } of speaking time (roughly ${wordCount} words). THE LENGTH OF ${wordCount} words is VERY important. Focus on a single topic, don't mix topics.

  Formulate an improved script, without annotations or anything of the sort:`)
  ];

  // The agent used to loop on web search until it hit the context window. Stream it so that, if it
  // still runs out of steps, we keep whatever research it gathered and write the script without tools.
  let messages: BaseMessage[] = inputMessages;
  try {
    const stream = await getScriptWriterAgent().stream(
      { messages: inputMessages },
      { recursionLimit: SCRIPT_AGENT_RECURSION_LIMIT, streamMode: 'values' }
    );
    for await (const chunk of stream) {
      messages = chunk.messages;
    }
  } catch (error) {
    if (!(error instanceof GraphRecursionError)) {
      throw error;
    }
    logger.warn('[ScriptWriter] Agent hit its step limit, writing script without tools', {
      topic,
      steps: messages.length
    });
  }

  messages.forEach((message: BaseMessage, index: number) => {
    const toolCalls = 'tool_calls' in message ? (message as AIMessage).tool_calls : undefined;
    if (toolCalls && toolCalls.length > 0) {
      logger.info('[ScriptWriter] Agent tool call', {
        step: index,
        tools: toolCalls.map(call => ({ name: call.name, args: call.args }))
      });
    } else {
      logger.info('[ScriptWriter] Agent step', { step: index, type: message._getType(), preview: message.text?.slice(0, 300) });
    }
  });

  let finalMessage = messages[messages.length - 1];
  const finishedCleanly =
    finalMessage._getType() === 'ai' && !(finalMessage as AIMessage).tool_calls?.length && finalMessage.text.trim();
  if (!finishedCleanly) {
    finalMessage = await writeScriptWithoutTools(inputMessages, messages);
  }

  logger.info('[ScriptWriter] Script generated', { topic, script: finalMessage.text });
  return {
    messages: [finalMessage]
  };
}

async function writeScriptWithoutTools(inputMessages: BaseMessage[], agentMessages: BaseMessage[]): Promise<AIMessage> {
  const research = agentMessages
    .filter((message): message is ToolMessage => message._getType() === 'tool')
    .map(message => message.text)
    .join('\n\n');

  const messages: BaseMessage[] = [new SystemMessage(scriptWriterPrompt), ...inputMessages];
  if (research) {
    messages.push(new HumanMessage(`Research notes from web search:\n${research}`));
  }
  messages.push(new HumanMessage('Write the script now. Reply with only the script.'));

  return getLlm(SCRIPT_WRITER_LLM_OPTIONS).invoke(messages);
}

export async function annotationRemoverNode(
  state: typeof ScriptWriterState.State
): Promise<Partial<typeof ScriptWriterState.State>> {
  const { messages } = state;
  const script = messages[messages.length - 1].text;
  logger.info('[ScriptWriter] Removing annotations from script');

  const response = await annotationRemoverAgent.invoke({ input: script });

  logger.info('[ScriptWriter] Final script ready', { script: response.text });

  return {
    messages: [response]
  };
}
// runWorkflow().then(() => logger.debug('end'));
// drawGraph();
