import { ScriptWriterState } from './state';
import { scriptWriterWorkflow } from './graph';

export const generateScript = async (
  userPrompt: string,
  libraryIds: string[],
  history: string,
  longForm: boolean = false,
  userId?: string,
  linkedChannelIds?: string[],
  historyKey?: string
): Promise<string> => {
  const initialState: Partial<typeof ScriptWriterState.State> = {
    libraryIds,
    messages: [],
    history,
    historyKey: historyKey || '',
    longForm,
    userPrompt,
    userId: userId || '',
    linkedChannelIds: linkedChannelIds || []
  };
  const result = await scriptWriterWorkflow.invoke(initialState, { recursionLimit: 150 });

  return result.messages[result.messages.length - 1].text;
};
