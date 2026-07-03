import { ReactNode, useRef } from 'react';
import { VideoAIData } from '../../types';
import { VideoEditorStore, VideoEditorStoreContext, createVideoEditorStore } from './store';

export const VideoEditorStoreProvider = ({ data, children }: { data: VideoAIData; children: ReactNode }) => {
  const storeRef = useRef<VideoEditorStore>();
  if (!storeRef.current) {
    storeRef.current = createVideoEditorStore(data);
  }
  return <VideoEditorStoreContext.Provider value={storeRef.current}>{children}</VideoEditorStoreContext.Provider>;
};
