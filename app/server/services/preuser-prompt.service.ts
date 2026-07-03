import { v4 as uuidv4 } from 'uuid';
import * as repo from '../repositories/preuser-prompt.repository';
import { generateLibraryName } from '../agents/library-name.agent';
import libraryRepository from '../repositories/library.repository';
import { logger } from '../services/logging';

const makeLibrariesPublic = async (libraryIds: string): Promise<void> => {
  const ids = libraryIds.split(',').map(id => id.trim()).filter(Boolean);
  await Promise.all(
    ids.map(async id => {
      await libraryRepository.update(id, { isPublic: true });
      await libraryRepository.updateBrollIsPublicByLibraryId(id, true);
      logger.info('Library set to public via preuser prompt', { libraryId: id });
    })
  );
};

export const createPrompt = async (prompt: string, libraryIds?: string) => {
  const token = uuidv4();

  let libraryName: string | undefined;
  if (libraryIds) {
    try {
      libraryName = await generateLibraryName(prompt);
      await makeLibrariesPublic(libraryIds);
    } catch (err) {
      logger.error('Failed to generate library name or set libraries public', { err });
    }
  }

  const record = await repo.createPreUserPrompt(token, prompt, libraryIds, libraryName);
  return { token, prompt: record.prompt, libraryName: record.libraryName };
};

export const getPrompt = async (token: string) => {
  return repo.findPreUserPromptByToken(token);
};

export const consumePrompt = async (token: string) => {
  const record = await repo.findPreUserPromptByToken(token);
  if (record) {
    await repo.deletePreUserPromptByToken(token);
    return record.prompt;
  }
  return null;
};

export const getAllPreuserPromptsForAdmin = async (skip: number, limit: number) => {
  return repo.getAllPreuserPromptsForAdmin(skip, limit);
};

export const getPreuserPromptStats = async (days: number) => {
  return repo.getPreuserPromptStats(days);
};
