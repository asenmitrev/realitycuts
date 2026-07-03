import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

export const ScriptWriterState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => []
  }),
  topic: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ''
  }),
  userPrompt: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ''
  }),
  previousTopics: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => []
  }),
  libraryIds: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => []
  }),
  history: Annotation<string>({
    reducer: (x, y) => x.concat(y),
    default: () => ''
  }),
  // Used to filter viral topics against automation history (avoid repeating topics across runs).
  // This should match `AutomationHistory.channelId` values written in `generation-processor.ts`.
  historyKey: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ''
  }),
  libraryInfo: Annotation<string>({
    reducer: (x, y) => x.concat(y),
    default: () => ''
  }),
  topicRetries: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0
  }),
  searchResults: Annotation<string>({
    reducer: (x, y) => x.concat(y),
    default: () => ''
  }),
  longForm: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false
  }),
  viralTopics: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => []
  }),
  viralVideoContext: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ''
  }),
  linkedChannelIds: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => []
  }),
  userId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ''
  })
});
