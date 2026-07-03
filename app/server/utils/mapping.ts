import { UploadType } from 'shared/types';

export const mapUploadTypeToJobType = (uploadType: UploadType) => {
  if (uploadType === 'highlight') return 'HIGHLIGHT';
  if (uploadType === 'video') return 'B_ROLL';
  if (uploadType === 'audio') return 'AUDIO';
  if (uploadType === 'script') return 'SCRIPT';
  if (uploadType === 'prompt') return 'PROMPT';
  return 'B_ROLL';
};

export function mapFrancResultToDeepgramLanguage(francResult: string) {
  switch (francResult) {
    case 'eng':
      return 'en';
    case 'spa':
      return 'es';
    case 'rus':
      return 'ru';
    case 'fra':
      return 'fr';
    case 'deu':
      return 'de';
    case 'ita':
      return 'it';
    case 'bul':
      return 'bg';
    case 'tur':
      return 'tr';
    default:
      return undefined;
  }
}
