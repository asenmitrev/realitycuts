import {
  Alternative,
  VideoCategorizationMetadata,
  COMPLEXITY_CATEGORIES,
  FRAMING_CATEGORIES
} from '../../../../types/video-ai-data';
import _ from 'lodash';
import { logger } from '../../../logging';
const getDesiredTime = (
  actualDuration: number,
  framing?: VideoCategorizationMetadata['framing'],
  complexity?: VideoCategorizationMetadata['complexity']
): number[] => {
  let output = [4, 6];
  if (
    (
      [FRAMING_CATEGORIES.WIDE_SHOT, FRAMING_CATEGORIES.MEDIUM_LONG_SHOT, FRAMING_CATEGORIES.EXTREME_LONG_SHOT] as any
    ).includes(framing)
  ) {
    // WIDE
    if (complexity === COMPLEXITY_CATEGORIES.SIMPLE) {
      output = [4, 7];
    } else if (complexity === COMPLEXITY_CATEGORIES.MODERATE) {
      output = [5, 10];
    } else if (complexity === COMPLEXITY_CATEGORIES.COMPLEX) {
      output = [7, 12];
    }
    output = [4, 9];
  } else if (([FRAMING_CATEGORIES.MEDIUM_SHOT, FRAMING_CATEGORIES.MEDIUM_LONG_SHOT] as any).includes(framing)) {
    // MEDIUM
    if (complexity === COMPLEXITY_CATEGORIES.SIMPLE) {
      output = [3.5, 6];
    } else if (complexity === COMPLEXITY_CATEGORIES.MODERATE) {
      output = [4.5, 8];
    } else if (complexity === COMPLEXITY_CATEGORIES.COMPLEX) {
      output = [6, 9];
    }
    output = [4.5, 6.5];
  } else if (
    (
      [FRAMING_CATEGORIES.EXTREME_CLOSE_UP, FRAMING_CATEGORIES.CLOSE_UP, FRAMING_CATEGORIES.MEDIUM_CLOSE_UP] as any
    ).includes(framing)
  ) {
    // CLOSE UP
    if (complexity === COMPLEXITY_CATEGORIES.SIMPLE) {
      output = [2, 3.5];
    } else if (complexity === COMPLEXITY_CATEGORIES.MODERATE) {
      output = [2.5, 5];
    } else if (complexity === COMPLEXITY_CATEGORIES.COMPLEX) {
      output = [3.5, 6];
    }
    output = [2.5, 4];
  }
  output = [3.5, 4.5];
  if (output[0] > actualDuration) {
    output = [2, actualDuration];
  }
  return [output[0], Math.min(output[1], actualDuration)];
};

const getPieceBounds = (rankedAlternatives: Alternative[]): { bounds: number[]; alternative: Alternative }[] => {
  const durations = rankedAlternatives.map(a => ({
    bounds: getDesiredTime(a.duration ?? 2, a.framing, a.complexity),
    alternative: a
  }));
  return durations;
};

type AltWithBounds = { bounds: number[]; alternative: Alternative; isCompromise?: boolean };

const getSubsetsWithEarlyStop = (
  durations: AltWithBounds[],
  desiredDuration: number,
  maxIterations: number = 1000
): AltWithBounds[] | null => {
  let subsets: AltWithBounds[][] = [[]];
  let iterations = 0;

  for (const value of durations) {
    const newSubsets: AltWithBounds[][] = [];

    for (const subset of subsets) {
      // Add the new subset with current value
      const newSubset = [...subset, value];
      newSubsets.push(newSubset);

      iterations++;
      if (iterations >= maxIterations) {
        logger.debug(`Reached max iterations (${maxIterations}) when generating subsets`);
        return null;
      }

      // Check if this subset matches our criteria (early stopping)
      const totalDuration = newSubset.reduce(
        (acc, v) => {
          return [acc[0] + v.bounds[0], acc[1] + v.bounds[1]];
        },
        [0, 0]
      );

      if (totalDuration[0] < desiredDuration && totalDuration[1] > desiredDuration) {
        return newSubset;
      }
    }

    // Add new subsets to existing ones
    subsets = subsets.concat(newSubsets);
  }

  return null;
};

const getTheMatchingAlternativesSolution = (
  rankedAlternatives: Alternative[],
  desiredDuration: number
): AltWithBounds[] => {
  const durations = getPieceBounds(rankedAlternatives);
  let output: AltWithBounds[] = [];

  // Try to find a matching subset with early stopping
  const result = getSubsetsWithEarlyStop(durations, desiredDuration, 10000);

  if (result) {
    output = result;
  } else if (durations.length > 0) {
    // Fallback to compromise solution
    output = [durations[0]].map(d => ({
      ...d,
      isCompromise: true,
      bounds: [
        Math.min(d.alternative.duration ?? 10, desiredDuration),
        Math.min(d.alternative.duration ?? 10, desiredDuration)
      ]
    }));
  }

  return output;
};

export const getTheFinalSolution = (rankedAlternatives: Alternative[], desiredDuration: number): AltWithBounds[] => {
  logger.debug('--- GET THE FINAL SOLUTION ---');
  logger.debug(`Ranked alternatives: ${rankedAlternatives.length}`);
  logger.debug(`Desired duration: ${desiredDuration}`);
  const matchingAlternatives = getTheMatchingAlternativesSolution(rankedAlternatives, desiredDuration).reverse();
  let totalDuration = matchingAlternatives.reduce((acc, v) => acc + v.bounds[1], 0);
  let currentAlt = matchingAlternatives[0];

  if (!currentAlt) {
    return [];
  }
  if (currentAlt?.isCompromise) {
    logger.debug(
      `COMPROMISE DETECTED. Desired duration: ${desiredDuration}, alternativeDuration: ${currentAlt.bounds[1]}`
    );
    return [currentAlt];
  }
  while (totalDuration > desiredDuration) {
    if (!currentAlt) {
      break;
    }
    const difference = totalDuration - desiredDuration;
    currentAlt.bounds[2] = Math.max(currentAlt.bounds[1] - difference, currentAlt.bounds[0]);
    totalDuration = matchingAlternatives.reduce((acc, v) => acc + (v.bounds[2] ?? v.bounds[1]), 0);

    currentAlt = matchingAlternatives[matchingAlternatives.indexOf(currentAlt) + 1];
  }
  return matchingAlternatives.reverse();
};
