import { useMemo } from 'react';
import { WordBase } from '../types';

export const useVideoCaptionsReducer = ({ data }: { data: WordBase[] }) => {
  return useMemo(() => {
    return { transcript: data };
  }, [data]);
};
