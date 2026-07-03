import { TTSVoiceType } from '../types';
import alloy from '../assets/voice/alloy.wav';
import echo from '../assets/voice/echo.wav';
import fable from '../assets/voice/fable.wav';
import onyx from '../assets/voice/onyx.wav';
import nova from '../assets/voice/nova.wav';
import shimmer from '../assets/voice/shimmer.wav';
import ash from '../assets/voice/ash.wav';
import ballad from '../assets/voice/ballad.wav';
import coral from '../assets/voice/coral.wav';
import sage from '../assets/voice/sage.wav';
import verse from '../assets/voice/verse.wav';

export const AUDIO_MAP: { [key in TTSVoiceType]: string } = {
  alloy,
  echo,
  fable,
  onyx,
  nova,
  shimmer,
  ash,
  ballad,
  coral,
  sage,
  verse
};
