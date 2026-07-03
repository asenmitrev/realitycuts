import { createContext, useContext } from 'react';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type {
  Audio,
  HighlightEditorAction,
  HighlightEditorState,
  PlaylistState,
  VideoAIData,
  VideoObject,
  VideoPlayerAction,
  WordBaseEdited
} from '../../types';
import { highlightEditorReducer, initializeHighlightEditorState } from '../../hooks/useHighlightEditorReducer';
import { initializePlaylistState, playlistReducer } from './reducer';

interface EditorSnapshot {
  playlistState: PlaylistState;
  highlightEditorState: HighlightEditorState;
  audioEnabled: boolean;
  audioIndex: number;
  audio: Audio[];
  volume: number;
}

const getEditorHistoryStorageKey = (videoId: string) => `video-editor-history-${videoId}`;
const normalizeUpdatedAt = (value: unknown): string | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

export interface VideoEditorStoreState {
  playlistState: PlaylistState;
  highlightEditorState: HighlightEditorState;
  pastStates: EditorSnapshot[];
  futureStates: EditorSnapshot[];
  transactionSnapshot: EditorSnapshot | null;
  currentTime: number;
  absoluteCurrentTime: number;
  currentBroll: VideoObject | null;
  playbackRate: number;
  orientation: 'HORIZONTAL' | 'VERTICAL';
  audioEnabled: boolean;
  audioIndex: number;
  audio: Audio[];
  isPlaying: boolean;
  volume: number;
  baseUpdatedAt: string | null;
  hasStaleDraft: boolean;
  staleDraftPayload: unknown | null;
  dispatchPlaylist: (action: VideoPlayerAction) => void;
  dispatchHighlightEditor: (action: HighlightEditorAction) => void;
  hydratePlaylist: (data: VideoAIData) => void;
  resetHighlightEditor: (transcript: WordBaseEdited[]) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  restoreStaleDraft: () => void;
  discardStaleDraft: () => void;
  setBaseUpdatedAt: (updatedAt: string | null) => void;
  beginTransaction: () => void;
  commitTransaction: () => void;
  cancelTransaction: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setCurrentTime: (currentTime: number) => void;
  setAbsoluteCurrentTime: (absoluteCurrentTime: number) => void;
  setCurrentBroll: (currentBroll: VideoObject | null) => void;
  setPlaybackRate: (playbackRate: number) => void;
  setOrientation: (orientation: 'HORIZONTAL' | 'VERTICAL') => void;
  setAudioEnabled: (audioEnabled: boolean) => void;
  setAudioIndex: (audioIndex: number) => void;
  setAudio: (audio: Audio[]) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
}

export const createVideoEditorStore = (data: VideoAIData) => {
  const initialPlaylistState = initializePlaylistState(data);
  const initialHighlightEditorState = initializeHighlightEditorState(data.editedWordsList ?? []);
  const storageKey = getEditorHistoryStorageKey(data._id);
  // Stop persisting editor state to browser storage (it can be huge and exceed quotas).
  // Clear any previously persisted draft immediately to free up space.
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // ignore storage failures
  }
  const shouldRecordHistory = (action: VideoPlayerAction) => action.type !== 'HYDRATE' && action.type !== 'SET_IS_DIRTY';
  const shouldRecordHighlightHistory = (action: HighlightEditorAction) =>
    action.type !== 'RESET' && action.type !== 'SET_DIRTY';
  const takeSnapshot = (state: VideoEditorStoreState): EditorSnapshot => ({
    playlistState: state.playlistState,
    highlightEditorState: state.highlightEditorState,
    audioEnabled: state.audioEnabled,
    audioIndex: state.audioIndex,
    audio: state.audio,
    volume: state.volume
  });
  const applySnapshot = (snapshot: EditorSnapshot) => ({
    playlistState: snapshot.playlistState,
    highlightEditorState: snapshot.highlightEditorState,
    audioEnabled: snapshot.audioEnabled,
    audioIndex: snapshot.audioIndex,
    audio: snapshot.audio,
    volume: snapshot.volume
  });
  const initialUpdatedAt = normalizeUpdatedAt((data as VideoAIData & { updatedAt?: string | Date }).updatedAt);
  return createStore<VideoEditorStoreState>()((set, get) => ({
    playlistState: initialPlaylistState,
    highlightEditorState: initialHighlightEditorState,
    pastStates: [],
    futureStates: [],
    transactionSnapshot: null,
    canUndo: false,
    canRedo: false,
    currentTime: 0,
    absoluteCurrentTime: 0,
    currentBroll: null,
    playbackRate: 1.0,
    orientation: 'HORIZONTAL',
    audioEnabled: !!data.audioEnabled,
    audioIndex: data.audioIndex ?? 0,
    audio: data.audio,
    isPlaying: false,
    volume: data.audioVolume ?? 1,
    baseUpdatedAt: initialUpdatedAt,
    hasStaleDraft: false,
    staleDraftPayload: null,
    dispatchPlaylist: action => {
      set(state => {
        const isAudioAction =
          action.type === 'SET_AUDIO_ENABLED' ||
          action.type === 'SET_AUDIO_INDEX' ||
          action.type === 'SET_AUDIO' ||
          action.type === 'SET_AUDIO_VOLUME';
        const playlistStateUpdate = isAudioAction ? state.playlistState : playlistReducer(state.playlistState, action);
        const patch: Partial<VideoEditorStoreState> = {};
        if (action.type === 'SET_AUDIO_ENABLED') {
          if (state.audioEnabled !== action.payload.audioEnabled) {
            patch.audioEnabled = action.payload.audioEnabled;
          }
        }
        if (action.type === 'SET_AUDIO_INDEX') {
          if (state.audioIndex !== action.payload.audioIndex) {
            patch.audioIndex = action.payload.audioIndex;
          }
        }
        if (action.type === 'SET_AUDIO') {
          if (state.audio !== action.payload.audio) {
            patch.audio = action.payload.audio;
          }
        }
        if (action.type === 'SET_AUDIO_VOLUME') {
          if (state.volume !== action.payload.volume) {
            patch.volume = action.payload.volume;
          }
        }
        const hasAudioPatch = Object.keys(patch).length > 0;
        const playlistChanged = playlistStateUpdate !== state.playlistState;
        if (!playlistChanged && !hasAudioPatch) {
          return {};
        }
        if (!shouldRecordHistory(action)) {
          return {
            ...(playlistChanged ? { playlistState: playlistStateUpdate } : {}),
            ...patch
          };
        }
        const isTransactionOpen = state.transactionSnapshot !== null;
        if (isTransactionOpen) {
          return {
            ...(playlistChanged ? { playlistState: playlistStateUpdate } : {}),
            ...patch,
            canUndo: state.pastStates.length > 0 || state.transactionSnapshot !== null,
            canRedo: state.futureStates.length > 0
          };
        }
        return {
          ...(playlistChanged ? { playlistState: playlistStateUpdate } : {}),
          ...patch,
          pastStates: [...state.pastStates, takeSnapshot(state)],
          futureStates: [],
          canUndo: true,
          canRedo: false
        };
      });
    },
    dispatchHighlightEditor: action => {
      set(state => {
        const nextHighlightEditorState = highlightEditorReducer(state.highlightEditorState, action);
        if (nextHighlightEditorState === state.highlightEditorState) {
          return {};
        }
        if (!shouldRecordHighlightHistory(action)) {
          return { highlightEditorState: nextHighlightEditorState };
        }
        const isTransactionOpen = state.transactionSnapshot !== null;
        if (isTransactionOpen) {
          return {
            highlightEditorState: nextHighlightEditorState,
            canUndo: state.pastStates.length > 0 || state.transactionSnapshot !== null,
            canRedo: state.futureStates.length > 0
          };
        }
        return {
          highlightEditorState: nextHighlightEditorState,
          pastStates: [...state.pastStates, takeSnapshot(state)],
          futureStates: [],
          canUndo: true,
          canRedo: false
        };
      });
    },
    hydratePlaylist: nextData => {
      const state = get();
      const nextPlaylistState = playlistReducer(state.playlistState, { type: 'HYDRATE', payload: { data: nextData } });
      if (nextPlaylistState === state.playlistState) {
        return;
      }
      set({
        playlistState: nextPlaylistState,
        pastStates: [],
        futureStates: [],
        transactionSnapshot: null,
        canUndo: false,
        canRedo: false,
        hasStaleDraft: false,
        staleDraftPayload: null
      });
    },
    resetHighlightEditor: transcript => {
      set({
        highlightEditorState: initializeHighlightEditorState(transcript),
        pastStates: [],
        futureStates: [],
        transactionSnapshot: null,
        canUndo: false,
        canRedo: false,
        hasStaleDraft: false,
        staleDraftPayload: null
      });
    },
    undo: () => {
      set(state => {
        if (state.pastStates.length === 0) {
          return {};
        }
        const previous = state.pastStates[state.pastStates.length - 1];
        return {
          ...applySnapshot(previous),
          pastStates: state.pastStates.slice(0, -1),
          futureStates: [takeSnapshot(state), ...state.futureStates],
          canUndo: state.pastStates.length > 1,
          canRedo: true
        };
      });
    },
    redo: () => {
      set(state => {
        if (state.futureStates.length === 0) {
          return {};
        }
        const [next, ...rest] = state.futureStates;
        return {
          ...applySnapshot(next),
          pastStates: [...state.pastStates, takeSnapshot(state)],
          futureStates: rest,
          canUndo: true,
          canRedo: rest.length > 0
        };
      });
    },
    clearHistory: () => {
      set({
        pastStates: [],
        futureStates: [],
        transactionSnapshot: null,
        canUndo: false,
        canRedo: false,
        hasStaleDraft: false,
        staleDraftPayload: null
      });
    },
    restoreStaleDraft: () => {
      // Draft persistence has been removed, so there is nothing to restore.
    },
    discardStaleDraft: () => set({ hasStaleDraft: false, staleDraftPayload: null }),
    setBaseUpdatedAt: updatedAt => set({ baseUpdatedAt: updatedAt }),
    beginTransaction: () => {
      set(state => {
        if (state.transactionSnapshot) {
          return {};
        }
        return {
          transactionSnapshot: takeSnapshot(state),
          canUndo: state.pastStates.length > 0
        };
      });
    },
    commitTransaction: () => {
      set(state => {
        if (!state.transactionSnapshot) {
          return {};
        }
        const snapshot = state.transactionSnapshot;
        const hasChanges =
          snapshot.playlistState !== state.playlistState || snapshot.highlightEditorState !== state.highlightEditorState;
        if (!hasChanges) {
          return {
            transactionSnapshot: null,
            canUndo: state.pastStates.length > 0,
            canRedo: state.futureStates.length > 0
          };
        }
        return {
          pastStates: [...state.pastStates, snapshot],
          futureStates: [],
          transactionSnapshot: null,
          canUndo: true,
          canRedo: false
        };
      });
    },
    cancelTransaction: () => {
      set(state => {
        if (!state.transactionSnapshot) {
          return {};
        }
        return {
          ...applySnapshot(state.transactionSnapshot),
          transactionSnapshot: null,
          canUndo: state.pastStates.length > 0,
          canRedo: state.futureStates.length > 0
        };
      });
    },
    setCurrentTime: currentTime => set({ currentTime }),
    setAbsoluteCurrentTime: absoluteCurrentTime => set({ absoluteCurrentTime }),
    setCurrentBroll: currentBroll => set({ currentBroll }),
    setPlaybackRate: playbackRate => set({ playbackRate }),
    setOrientation: orientation => set({ orientation }),
    setAudioEnabled: audioEnabled => set({ audioEnabled }),
    setAudioIndex: audioIndex => set({ audioIndex }),
    setAudio: audio => set({ audio }),
    setIsPlaying: isPlaying => set({ isPlaying }),
    setVolume: volume => set({ volume })
  }));
};

export type VideoEditorStore = StoreApi<VideoEditorStoreState>;
export const VideoEditorStoreContext = createContext<VideoEditorStore | null>(null);

export const useVideoEditorStore = <T,>(selector: (state: VideoEditorStoreState) => T): T => {
  const store = useContext(VideoEditorStoreContext);
  if (!store) {
    throw new Error('useVideoEditorStore must be used within VideoEditorStoreProvider');
  }
  return useStore(store, selector);
};

export const useVideoEditorStoreApi = () => {
  const store = useContext(VideoEditorStoreContext);
  if (!store) {
    throw new Error('useVideoEditorStoreApi must be used within VideoEditorStoreProvider');
  }
  return store;
};
