import { z } from 'zod';
import { getTavilyWebSearch } from './tools';
import { ScriptWriterState } from './state';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { getLlm } from '../../../config/llm';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { getSampledLibraryInfo } from '../../../agents/library-aware-script.agent';
import { annotationRemoverAgent } from '../../../agents/annotation-remover.agent';
import { getScriptWriterAgent } from './agents';
import { logger } from '../../../services/logging';
export async function fetchLibraryFootage(
  state: typeof ScriptWriterState.State
): Promise<Partial<typeof ScriptWriterState.State>> {
  logger.debug('Fetching library footage');

  // Execute the tool
  const libraryInfo = await getSampledLibraryInfo(state.libraryIds);

  return {
    messages: [{ name: 'assistant' as const, content: libraryInfo } as AIMessage],
    libraryInfo: libraryInfo,
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
  logger.debug('Generating new topic');

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

  const model = getLlm();

  const response = await prompt.pipe(model).invoke({
    userPrompt,
    libraryContent,
    previousTopics,
    viralVideoContext: viralVideoContext || ''
  });

  const topicContent = response.content as string;
  logger.debug('Topic:', topicContent);

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
  logger.debug('Checking if topic is in history');
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

  const model = getLlm().bindTools([tool]);
  const response = await prompt.pipe(model).invoke({ history, topic });
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
  logger.debug('Generating script');
  const { topic, userPrompt, longForm } = state;
  const wordCount = longForm ? '500' : '150-180';
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

  const { messages } = await getScriptWriterAgent().invoke({ messages: inputMessages }, { recursionLimit: 16 });

  for (const message of messages) {
    logger.debug('Script Writer Message ---\n\n', message.text);
    logger.debug('--- Script Writer Message End ---\n\n');
  }

  logger.debug('Script:', messages[messages.length - 1].text);
  return {
    messages: [messages[messages.length - 1]]
  };
}

export async function annotationRemoverNode(
  state: typeof ScriptWriterState.State
): Promise<Partial<typeof ScriptWriterState.State>> {
  logger.debug('Annotation Remover Node');
  const { messages } = state;
  const script = messages[messages.length - 1].text;

  const response = await annotationRemoverAgent.invoke({ input: script });

  return {
    messages: [response]
  };
}
// runWorkflow().then(() => logger.debug('end'));
// drawGraph();
