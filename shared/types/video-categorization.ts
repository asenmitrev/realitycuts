export const FRAMING_CATEGORIES = {
  EXTREME_CLOSE_UP: 'ECU',
  CLOSE_UP: 'CU',
  MEDIUM_CLOSE_UP: 'MCU',
  MEDIUM_SHOT: 'MS',
  MEDIUM_LONG_SHOT: 'MLS',
  LONG_SHOT: 'LS',
  WIDE_SHOT: 'WS',
  UNKNOWN: 'UNK',
  EXTREME_LONG_SHOT: 'ELS'
} as const;

export const FRAMING_CATEGORIES_REVERSE = Object.fromEntries(
  Object.entries(FRAMING_CATEGORIES).map(([key, value]) => [value, key])
);

export const CAMERA_ANGLE_CATEGORIES = {
  UNKNOWN: 'UNK',
  EYE_LEVEL: 'EYEL',
  LOW_ANGLE: 'LA',
  HIGH_ANGLE: 'HA',
  DUTCH_ANGLE: 'DA',
  BIRD_EYE_VIEW: 'BEV',
  WORM_EYE_VIEW: 'WEV',
  SHOULDERS_LEVEL: 'SL',
  HIP_LEVEL: 'HL',
  KNEES_LEVEL: 'KL',
  AERIAL_ANGLE: 'AA'
} as const;

export const CAMERA_ANGLE_CATEGORIES_REVERSE = Object.fromEntries(
  Object.entries(CAMERA_ANGLE_CATEGORIES).map(([key, value]) => [value, key])
);

export const PERSPECTIVE_CATEGORIES = {
  UNKNOWN: 'UNK',
  POINT_OF_VIEW: 'POV',
  OVER_THE_SHOULDER: 'OTS',
  SUBJECTIVE_PERSPECTIVE: 'SP',
  OBJECTIVE_PERSPECTIVE: 'OP'
} as const;

export const PERSPECTIVE_CATEGORIES_REVERSE = Object.fromEntries(
  Object.entries(PERSPECTIVE_CATEGORIES).map(([key, value]) => [value, key])
);

export const DEPTH_OF_FIELD_CATEGORIES = {
  UNKNOWN: 'UNK',
  DEEP_FOCUS: 'DF',
  SHALLOW_FOCUS: 'SF',
  RACK_FOCUS: 'RF',
  SOFT_FOCUS: 'SF',
  SPLIT_DIOPTER_SHOT: 'SDS',
  TILT_SHIFT_SHOT: 'TSS'
} as const;

export const DEPTH_OF_FIELD_CATEGORIES_REVERSE = Object.fromEntries(
  Object.entries(DEPTH_OF_FIELD_CATEGORIES).map(([key, value]) => [value, key])
);

export const COMPLEXITY_CATEGORIES = {
  SIMPLE: 'SIMPLE',
  MODERATE: 'MODERATE',
  COMPLEX: 'COMPLEX',
  UNKNOWN: 'UNKNOWN'
} as const;

export const AROLL_BROLL_CATEGORIES = {
  AROLL: 'AROLL',
  BROLL: 'BROLL',
  UNKNOWN: 'UNKNOWN'
} as const;

export const FOCUS_POSITION_CATEGORIES = {
  LEFT: 'LEFT',
  CENTER: 'CENTER',
  RIGHT: 'RIGHT',
  UNKNOWN: 'UNKNOWN'
} as const;

export const COMPLEXITY_CATEGORIES_REVERSE = Object.fromEntries(
  Object.entries(COMPLEXITY_CATEGORIES).map(([key, value]) => [value, key])
);

export const FOCUS_POSITION_CATEGORIES_REVERSE = Object.fromEntries(
  Object.entries(FOCUS_POSITION_CATEGORIES).map(([key, value]) => [value, key])
);

export type VideoCategorizationMetadata = {
  framing: (typeof FRAMING_CATEGORIES)[keyof typeof FRAMING_CATEGORIES];
  cameraAngle: (typeof CAMERA_ANGLE_CATEGORIES)[keyof typeof CAMERA_ANGLE_CATEGORIES];
  perspective: (typeof PERSPECTIVE_CATEGORIES)[keyof typeof PERSPECTIVE_CATEGORIES];
  depthOfField: (typeof DEPTH_OF_FIELD_CATEGORIES)[keyof typeof DEPTH_OF_FIELD_CATEGORIES];
  complexity: (typeof COMPLEXITY_CATEGORIES)[keyof typeof COMPLEXITY_CATEGORIES];
  arollBroll: (typeof AROLL_BROLL_CATEGORIES)[keyof typeof AROLL_BROLL_CATEGORIES];
  focusPosition: (typeof FOCUS_POSITION_CATEGORIES)[keyof typeof FOCUS_POSITION_CATEGORIES];
};
