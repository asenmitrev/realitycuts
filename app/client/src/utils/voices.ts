import { ElevenLabsVoice } from '../types';
import { AUDIO_MAP } from './audioMap';
import { UIVoice } from '../components/upload/AudioChoice';

/**
 * Transform premium ElevenLabs voices and free voices into a unified UIVoice array
 * @param premiumVoices - Optional array of ElevenLabs voices from the API
 * @returns Combined array of free and premium voices
 */
export function getVoices(premiumVoices: ElevenLabsVoice[] | undefined): UIVoice[] {
  const freeVoices: UIVoice[] = Object.entries(AUDIO_MAP).map(([k, v]) => ({
    name: k,
    id: k,
    tags: [],
    premium: false,
    preview: v
  }));

  const mappedPremiumVoices: UIVoice[] =
    premiumVoices
      ?.map(voice => ({
        name: voice.name,
        id: voice.voiceId,
        tags: voice.labels ? [voice.labels.use_case] : [],
        premium: true,
        preview: voice.previewUrl
      }))
      .filter((v): v is UIVoice => v.name !== undefined && v.preview !== undefined) ?? [];

  return [...freeVoices, ...mappedPremiumVoices];
}
