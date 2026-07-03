import { ILibrary } from '../types';

export const calculateTotalProgress = (library: Omit<ILibrary, 'processedFiles'>) => {
  if (!library.asyncProgress) {
    return library.progress;
  }
  if (library.status === 'PROCESSED') {
    return 100;
  }
  const allProgresses = Object.entries(library.asyncProgress)
    .filter(([key]) => key !== 'emailSent')
    .reduce((acc, [_, progress]) => acc + progress, 0);
  const totalProgress =
    (allProgresses / Object.keys(library.asyncProgress).filter(key => key !== 'emailSent').length) * 100;
  return library.status === 'PROCESSING'
    ? Math.round(totalProgress)
    : library.status === 'REPROCESSING'
    ? library.progress
    : 100;
};

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function approximateMinutesFromText(text: string): number {
  const wordsPerSecond = 15;
  return Math.round((text.length / (wordsPerSecond * 60)) * 100) / 100;
}
