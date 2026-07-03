import { useContext } from 'react';
import type { HighlightEditorAction, VideoPlayerAction, WordBaseEdited } from '../types';
import { useStore } from 'zustand';
import { VideoEditorStoreContext } from '../stores/video-editor/store';
import type { VideoEditorStore } from '../stores/video-editor/store';

export const useEditorStateMachine = ({
  store
}: {
  transcript: WordBaseEdited[];
  store?: VideoEditorStore;
}) => {
  const storeFromContext = useContext(VideoEditorStoreContext);
  const resolvedStore = store ?? storeFromContext;
  if (!resolvedStore) {
    throw new Error('useEditorStateMachine must be used within VideoEditorStoreProvider or with a store argument');
  }
  const playlistState = useStore(resolvedStore, state => state.playlistState);
  const highlightEditorState = useStore(resolvedStore, state => state.highlightEditorState);
  const dispatchPlaylist = useStore(resolvedStore, state => state.dispatchPlaylist);
  const dispatchHighlightEditor = useStore(resolvedStore, state => state.dispatchHighlightEditor);
  const undo = useStore(resolvedStore, state => state.undo);
  const redo = useStore(resolvedStore, state => state.redo);
  const canUndo = useStore(resolvedStore, state => state.canUndo);
  const canRedo = useStore(resolvedStore, state => state.canRedo);
  const beginTransaction = useStore(resolvedStore, state => state.beginTransaction);
  const commitTransaction = useStore(resolvedStore, state => state.commitTransaction);
  const cancelTransaction = useStore(resolvedStore, state => state.cancelTransaction);

  const dispatch = (action: VideoPlayerAction | HighlightEditorAction) => {
    if ('payload' in action && action.type in { HYDRATE: true, SET_IS_DIRTY: true, REPLACE_SEGMENTS: true }) {
      dispatchPlaylist(action as VideoPlayerAction);
      return;
    }
    const playlistTypes: VideoPlayerAction['type'][] = [
      'SET_IS_DIRTY',
      'HYDRATE',
      'REPLACE_SEGMENTS',
      'TOGGLE_CURRENT_ALT_ENABLED',
      'TOGGLE_CURRENT_ALT_VARIATION',
      'CHANGE_VIDEO_TIME',
      'ADD_ALTS',
      'REMOVE_SEGMENT',
      'REPLACE_ALTS',
      'CHANGE_VIDEO_POSITION',
      'TOGGLE_VIDEO_VISIBLE',
      'SET_AUDIO_ENABLED',
      'SET_AUDIO_INDEX',
      'SET_AUDIO',
      'SET_AUDIO_VOLUME'
    ];
    if (playlistTypes.includes(action.type as VideoPlayerAction['type'])) {
      dispatchPlaylist(action as VideoPlayerAction);
      return;
    }
    dispatchHighlightEditor(action as HighlightEditorAction);
  };

  return {
    playlistState,
    highlightEditorState,
    dispatchPlaylist,
    dispatchHighlightEditor,
    dispatch,
    undo,
    redo,
    canUndo,
    canRedo,
    beginTransaction,
    commitTransaction,
    cancelTransaction
  };
};
