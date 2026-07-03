import { useMemo } from 'react';
import { WordBaseEdited } from '../types';
import { getSegments } from 'shared/utils/trimming';

type ReducerInput = { data: WordBaseEdited[]; duration: number };
export const useVideoHighlightShim = ({ data, duration }: ReducerInput) => {
  return useMemo(() => {
    const segments = getSegments(data);
    if (data[0]?.isVisible === true) {
      segments[0].start = 0;
    }
    if (data[data.length - 1]?.isVisible === true) {
      segments[segments.length - 1].end = duration;
    }
    const cumulativeDuration = segments.reduce((acc, segment) => acc + (segment.end - segment.start), 0);
    return {
      transcript: data,
      segments,
      duration: cumulativeDuration > 0 ? cumulativeDuration : duration
    };
  }, [duration, data]);
};
