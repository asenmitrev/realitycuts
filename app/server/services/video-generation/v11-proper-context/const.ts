export const SHOT_TYPE = {
  WIDE: 'wide',
  MEDIUM: 'medium',
  CLOSE_UP: 'close_up'
} as const;

export type ShotType = (typeof SHOT_TYPE)[keyof typeof SHOT_TYPE];
