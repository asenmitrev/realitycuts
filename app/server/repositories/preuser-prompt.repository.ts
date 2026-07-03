import PreUserPrompt, { IPreUserPrompt } from '../models/preuser-prompt';

export const createPreUserPrompt = async (
  token: string,
  prompt: string,
  libraryIds?: string,
  libraryName?: string
): Promise<IPreUserPrompt> => {
  return PreUserPrompt.create({ token, prompt, libraryIds, libraryName });
};

export const findPreUserPromptByToken = async (token: string): Promise<IPreUserPrompt | null> => {
  return PreUserPrompt.findOne({ token });
};

export const deletePreUserPromptByToken = async (token: string): Promise<void> => {
  await PreUserPrompt.deleteOne({ token });
};

export const getAllPreuserPromptsForAdmin = async (
  skip: number,
  limit: number
): Promise<{ prompts: IPreUserPrompt[]; total: number }> => {
  const [prompts, total] = await Promise.all([
    PreUserPrompt.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    PreUserPrompt.countDocuments()
  ]);
  return { prompts, total };
};

export const getPreuserPromptStats = async (days: number) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const totalCount = await PreUserPrompt.countDocuments({
    createdAt: { $gte: cutoffDate }
  });

  const withLibrariesCount = await PreUserPrompt.countDocuments({
    createdAt: { $gte: cutoffDate },
    libraryIds: { $exists: true, $nin: [null, '', undefined] }
  });

  return {
    totalCount,
    withLibrariesCount,
    withoutLibrariesCount: totalCount - withLibrariesCount
  };
};
