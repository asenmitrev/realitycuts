import { StateGraph } from '@langchain/langgraph';
import { ScriptWriterState } from './state';
import {
  fetchLibraryFootage,
  fetchViralTopicsNode,
  topicNode,
  checkIfTopicIsInHistory,
  annotationRemoverNode,
  generateScriptNode
} from './nodes';
import { checkTopicPresenceInHistory, shouldFetchViralTopics } from './edges';
import { getHistory } from './tools';
import fs from 'fs';
import { logger } from '../../../services/logging';

const workflow = new StateGraph(ScriptWriterState)
  // Add nodes
  .addNode('fetch_library_footage', fetchLibraryFootage)
  .addNode('fetch_viral_topics', fetchViralTopicsNode) // NEW: Fetch viral video topics
  .addNode('determine_topic', topicNode) // React agent as a node!
  .addNode('check_topic_presence_in_history', checkIfTopicIsInHistory)
  .addNode('generate_script', generateScriptNode)
  .addNode('annotation_remover', annotationRemoverNode)
  .addEdge('__start__', 'fetch_library_footage')
  // Conditional edge: fetch viral topics if linkedChannelIds exist
  .addConditionalEdges('fetch_library_footage', shouldFetchViralTopics, {
    yes: 'fetch_viral_topics',
    no: 'determine_topic'
  })
  .addEdge('fetch_viral_topics', 'determine_topic')
  .addEdge('determine_topic', 'check_topic_presence_in_history')
  .addConditionalEdges('check_topic_presence_in_history', checkTopicPresenceInHistory, {
    no: 'generate_script',
    yes: 'determine_topic',
    resample: 'fetch_library_footage'
  })
  .addEdge('generate_script', 'annotation_remover')
  .addEdge('annotation_remover', '__end__');

export const scriptWriterWorkflow = workflow.compile();

// Example usage
async function drawGraph() {
  const graph = scriptWriterWorkflow.getGraph();
  const image = await graph.drawMermaidPng();
  const arrayBuffer = await image.arrayBuffer();
  fs.writeFileSync('graph.png', Buffer.from(arrayBuffer));
}
async function runWorkflow() {
  logger.debug('Starting script writer workflow...\n');

  const initialState: Partial<typeof ScriptWriterState.State> = {
    libraryIds: ['679a3225251ada350706b37b'],
    messages: [],
    history: await getHistory('UCFSxjUiMFlJ_iZaoZ-fc2qQ')
  };

  const result = await scriptWriterWorkflow.invoke(initialState, { recursionLimit: 150 });

  logger.debug('\n=== Final Result ===');
  logger.debug('Total footage items:', result.libraryIds?.length);
  logger.debug('Final script:', result.messages[result.messages.length - 1].content);

  return result.messages[result.messages.length - 1].text;
}
