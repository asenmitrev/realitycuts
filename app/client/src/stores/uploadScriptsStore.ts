import { create } from 'zustand';

export interface VideoScript {
  id: string;
  title: string;
  script: string;
}

const createEmptyScript = (): VideoScript => ({
  id: crypto.randomUUID(),
  title: '',
  script: ''
});

interface UploadScriptsState {
  videoScripts: VideoScript[];
  setVideoScripts: (updater: VideoScript[] | ((prev: VideoScript[]) => VideoScript[])) => void;
  resetVideoScripts: () => void;
}

export const useUploadScriptsStore = create<UploadScriptsState>(set => ({
  videoScripts: [createEmptyScript()],
  setVideoScripts: updater =>
    set(state => ({
      videoScripts: typeof updater === 'function' ? (updater as (prev: VideoScript[]) => VideoScript[])(state.videoScripts) : updater
    })),
  resetVideoScripts: () => set({ videoScripts: [createEmptyScript()] })
}));
