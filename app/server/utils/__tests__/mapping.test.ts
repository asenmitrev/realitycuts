import { mapUploadTypeToJobType, mapFrancResultToDeepgramLanguage } from '../mapping';
import { describe, test, expect } from 'vitest';
describe('mapUploadTypeToJobType', () => {
  test('should map highlight upload type correctly', () => {
    expect(mapUploadTypeToJobType('highlight')).toBe('HIGHLIGHT');
  });

  test('should map video upload type correctly', () => {
    expect(mapUploadTypeToJobType('video')).toBe('B_ROLL');
  });

  test('should map audio upload type correctly', () => {
    expect(mapUploadTypeToJobType('audio')).toBe('AUDIO');
  });

  test('should map script upload type correctly', () => {
    expect(mapUploadTypeToJobType('script')).toBe('SCRIPT');
  });

  test('should return B_ROLL for unknown upload types', () => {
    // @ts-expect-error Testing invalid input
    expect(mapUploadTypeToJobType('unknown')).toBe('B_ROLL');
  });
});

describe('mapFrancResultToDeepgramLanguage', () => {
  test('should map English correctly', () => {
    expect(mapFrancResultToDeepgramLanguage('eng')).toBe('en');
  });

  test('should map Spanish correctly', () => {
    expect(mapFrancResultToDeepgramLanguage('spa')).toBe('es');
  });

  test('should map Russian correctly', () => {
    expect(mapFrancResultToDeepgramLanguage('rus')).toBe('ru');
  });

  test('should map French correctly', () => {
    expect(mapFrancResultToDeepgramLanguage('fra')).toBe('fr');
  });

  test('should map German correctly', () => {
    expect(mapFrancResultToDeepgramLanguage('deu')).toBe('de');
  });

  test('should map Italian correctly', () => {
    expect(mapFrancResultToDeepgramLanguage('ita')).toBe('it');
  });

  test('should map Bulgarian correctly', () => {
    expect(mapFrancResultToDeepgramLanguage('bul')).toBe('bg');
  });

  test('should return undefined for unknown language codes', () => {
    expect(mapFrancResultToDeepgramLanguage('xyz')).toBeUndefined();
  });
});
