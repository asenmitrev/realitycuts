import { describe, test, expect } from 'vitest';

// Helper function copied from vector-search.service.ts for testing
const calculateLeftPositionFromFaces = (
  faceDetectionResults?: any,
  videoDimensions?: { width: number; height: number; aspect_ratio: number; orientation: string }
): number => {
  if (!faceDetectionResults) {
    return 1; // Default center position
  }

  // Check both frame timestamps and use the one with more faces, or 0.5s by default
  const frame05s = faceDetectionResults.frame05s;
  const frame25s = faceDetectionResults.frame25s;

  let selectedFrame = frame05s;
  if (frame25s && frame25s.faceCount > 0 && (!frame05s || frame25s.faceCount > frame05s.faceCount)) {
    selectedFrame = frame25s;
  }

  if (!selectedFrame || !selectedFrame.faces || selectedFrame.faces.length === 0) {
    return 1; // Default center position if no faces detected
  }

  // For multiple faces, use the most prominent one (largest area or highest confidence)
  let prominentFace = selectedFrame.faces[0];
  for (const face of selectedFrame.faces) {
    const currentArea = face.width * face.height;
    const prominentArea = prominentFace.width * prominentFace.height;

    // Choose face with higher confidence, or larger area if confidence is similar
    if (
      face.confidence > prominentFace.confidence + 0.1 ||
      (Math.abs(face.confidence - prominentFace.confidence) <= 0.1 && currentArea > prominentArea)
    ) {
      prominentFace = face;
    }
  }

  // Calculate the center of the face
  const faceCenterX = prominentFace.x + prominentFace.width / 2;

  // Use actual video width if available, otherwise fall back to estimation
  let videoWidth: number;
  if (videoDimensions?.width) {
    videoWidth = videoDimensions.width;
  } else {
    // Fallback estimation based on video orientation
    const isVertical =
      videoDimensions?.orientation === 'portrait' ||
      (videoDimensions?.width && videoDimensions?.height && videoDimensions.width < videoDimensions.height);

    if (isVertical) {
      videoWidth = Math.max(
        faceCenterX * 1.3,
        prominentFace.x + prominentFace.width * 3,
        1080 // Common vertical video width
      );
    } else {
      videoWidth = Math.max(
        faceCenterX * 1.2,
        prominentFace.x + prominentFace.width * 4,
        1920 // Common horizontal video width
      );
    }
  }

  const faceCenterRatio = faceCenterX / videoWidth;

  // Convert face position to leftPosition scale
  if (faceCenterRatio < 0.33) {
    return 0.75; // Face on left side -> position video to show left area
  } else if (faceCenterRatio > 0.67) {
    return 1.25; // Face on right side -> position video to show right area
  } else {
    return 1; // Face in center -> keep centered
  }
};

describe('Vector Search Service - Face Detection with Video Dimensions', () => {
  describe('calculateLeftPositionFromFaces', () => {
    test('should return default center position when no face detection results', () => {
      expect(calculateLeftPositionFromFaces()).toBe(1);
      expect(calculateLeftPositionFromFaces(null)).toBe(1);
      expect(calculateLeftPositionFromFaces({})).toBe(1);
    });

    test('should return center position when no faces detected', () => {
      const faceDetectionResults = {
        frame05s: { faceCount: 0, faces: [] },
        frame25s: { faceCount: 0, faces: [] }
      };
      expect(calculateLeftPositionFromFaces(faceDetectionResults)).toBe(1);
    });

    test('should use actual video dimensions for accurate positioning - landscape video', () => {
      const videoDimensions = {
        width: 1920,
        height: 1080,
        aspect_ratio: 16 / 9,
        orientation: 'landscape'
      };

      // Face on the left (x=300, center=375)
      const faceDetectionResults = {
        frame05s: {
          faceCount: 1,
          faces: [{ x: 300, y: 200, width: 150, height: 150, confidence: 0.9 }]
        }
      };

      // 375 / 1920 = 0.195 < 0.33, should be left position
      expect(calculateLeftPositionFromFaces(faceDetectionResults, videoDimensions)).toBe(0.75);
    });

    test('should use actual video dimensions for accurate positioning - center face', () => {
      const videoDimensions = {
        width: 1920,
        height: 1080,
        aspect_ratio: 16 / 9,
        orientation: 'landscape'
      };

      // Face in center (x=860, center=960)
      const faceDetectionResults = {
        frame05s: {
          faceCount: 1,
          faces: [{ x: 860, y: 200, width: 200, height: 200, confidence: 0.9 }]
        }
      };

      // 960 / 1920 = 0.5, should be center position
      expect(calculateLeftPositionFromFaces(faceDetectionResults, videoDimensions)).toBe(1);
    });

    test('should use actual video dimensions for accurate positioning - right face', () => {
      const videoDimensions = {
        width: 1920,
        height: 1080,
        aspect_ratio: 16 / 9,
        orientation: 'landscape'
      };

      // Face on the right (x=1400, center=1500)
      const faceDetectionResults = {
        frame05s: {
          faceCount: 1,
          faces: [{ x: 1400, y: 200, width: 200, height: 200, confidence: 0.9 }]
        }
      };

      // 1500 / 1920 = 0.78 > 0.67, should be right position
      expect(calculateLeftPositionFromFaces(faceDetectionResults, videoDimensions)).toBe(1.25);
    });

    test('should work with vertical videos using actual dimensions', () => {
      const videoDimensions = {
        width: 1080,
        height: 1920,
        aspect_ratio: 9 / 16,
        orientation: 'portrait'
      };

      // Face on the left (x=200, center=275)
      const faceDetectionResults = {
        frame05s: {
          faceCount: 1,
          faces: [{ x: 200, y: 400, width: 150, height: 150, confidence: 0.9 }]
        }
      };

      // 275 / 1080 = 0.25 < 0.33, should be left position
      expect(calculateLeftPositionFromFaces(faceDetectionResults, videoDimensions)).toBe(0.75);
    });

    test('should fallback to estimation when video dimensions not available', () => {
      const faceDetectionResults = {
        frame05s: {
          faceCount: 1,
          faces: [{ x: 100, y: 200, width: 150, height: 150, confidence: 0.9 }]
        }
      };

      // Should use fallback estimation logic
      expect(calculateLeftPositionFromFaces(faceDetectionResults)).toBe(0.75);
    });

    test('should handle partial video dimensions', () => {
      const videoDimensions = {
        width: 1920,
        height: 1080,
        aspect_ratio: 16 / 9,
        orientation: 'landscape'
      };

      const faceDetectionResults = {
        frame05s: {
          faceCount: 1,
          faces: [{ x: 960, y: 200, width: 200, height: 200, confidence: 0.9 }]
        }
      };

      // Should use the actual width: (960 + 100) / 1920 = 0.55, center position
      expect(calculateLeftPositionFromFaces(faceDetectionResults, videoDimensions)).toBe(1);
    });

    test('should prefer frame with more faces', () => {
      const videoDimensions = {
        width: 1920,
        height: 1080,
        aspect_ratio: 16 / 9,
        orientation: 'landscape'
      };

      const faceDetectionResults = {
        frame05s: {
          faceCount: 1,
          faces: [{ x: 300, y: 200, width: 150, height: 150, confidence: 0.9 }]
        },
        frame25s: {
          faceCount: 2,
          faces: [
            { x: 1400, y: 200, width: 150, height: 150, confidence: 0.9 },
            { x: 800, y: 300, width: 100, height: 100, confidence: 0.7 }
          ]
        }
      };

      // Should use frame25s (2 faces) and pick the first face (higher confidence)
      // Face at x=1400, center=1475, 1475/1920 = 0.77 > 0.67, should be right position
      expect(calculateLeftPositionFromFaces(faceDetectionResults, videoDimensions)).toBe(1.25);
    });

    test('should pick most prominent face from multiple faces', () => {
      const videoDimensions = {
        width: 1920,
        height: 1080,
        aspect_ratio: 16 / 9,
        orientation: 'landscape'
      };

      const faceDetectionResults = {
        frame05s: {
          faceCount: 2,
          faces: [
            { x: 300, y: 200, width: 100, height: 100, confidence: 0.7 }, // smaller, lower confidence
            { x: 800, y: 200, width: 200, height: 200, confidence: 0.9 } // larger, higher confidence
          ]
        }
      };

      // Should pick the second face (higher confidence and larger)
      // Face center at x=900, 900/1920 = 0.47, should be center position
      expect(calculateLeftPositionFromFaces(faceDetectionResults, videoDimensions)).toBe(1);
    });
  });
});
