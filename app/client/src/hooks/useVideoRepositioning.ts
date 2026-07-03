import { useCallback, useEffect, useState } from 'react';
import type { VideoObject, VideoPlayerAction } from '../types';
import { useVideoEditorStore, useVideoEditorStoreApi } from '../stores/video-editor/store';

export const useVideoRepositioning = ({
  canvas,
  currentlyPlayingVideo,
  debouncedDispatch
}: {
  canvas: React.RefObject<HTMLCanvasElement>;
  currentlyPlayingVideo?: VideoObject;
  debouncedDispatch: (action: VideoPlayerAction) => void;
}) => {
  const [dragging, setDragging] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const store = useVideoEditorStoreApi();
  const currentBroll = useVideoEditorStore(state => state.currentBroll);

  const handleStart = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement, MouseEvent> | React.TouchEvent<HTMLCanvasElement>) => {
      const broll = store.getState().currentBroll;
      const cv = canvas.current;
      if (cv && broll) {
        const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
        setDragging(true);
        store.getState().beginTransaction();
        setStartPosition({
          x: 3 * clientX + broll.leftPosition * cv.width,
          y: 3 * clientY + broll.topPosition * cv.height
        });
      }
    },
    [canvas, store]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement, MouseEvent> | React.TouchEvent<HTMLCanvasElement>) => {
      if (dragging && currentlyPlayingVideo) {
        const cv = canvas.current;
        if (!cv) {
          return;
        }
        const broll = currentBroll;
        if (!broll) {
          return;
        }
        const width = cv.width;
        const height = cv.height;
        const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
        const leftPosition = Math.max(0, Math.min(2, (-3 * clientX + startPosition.x) / width));
        const topPosition = Math.max(0, Math.min(2, (-3 * clientY + startPosition.y) / height));

        debouncedDispatch({
          type: 'CHANGE_VIDEO_POSITION',
          payload: {
            video: currentlyPlayingVideo,
            leftPosition,
            topPosition
          }
        });
      }
    },
    [canvas, currentBroll, currentlyPlayingVideo, debouncedDispatch, dragging, startPosition]
  );

  useEffect(() => {
    const onMouseUp = () => {
      if (store.getState().transactionSnapshot) {
        store.getState().commitTransaction();
      }
      setDragging(false);
    };

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchend', onMouseUp);

    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchend', onMouseUp);
    };
  }, [store]);

  return { handleStart, handleMove, dragging };
};
