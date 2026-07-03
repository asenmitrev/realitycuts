import { getAssFileString } from 'shared/utils/captions';
import {
  VideoObject,
  PlaybackSource,
  isVideoSource,
  PLAYBACK_STATE,
  OnPlayCallback,
  AudioData,
  CaptionSettings,
  WordBase,
  HighlightSegment,
  RecroppedVideoFrame,
  VideoMetadata
} from '../types';
import { AUDIO_VOLUME_MODIFIER } from '../const';
import { VideoPlaylist } from './VideoPlaylist';
import { RenderingEngine } from './RenderingEngine';
import { convertToBlobUrl } from './convertToBlobUrl';
const AUDIO_FADE_OUT_SECONDS = 5;

// Video cache is a pool of video elements to cache stuff
type OnBrollChange = (broll: VideoObject | null) => void;
export class PlaybackManager {
  private source: PlaybackSource;
  private renderer?: RenderingEngine;
  private currentTime: number = 0;
  private playlist: VideoPlaylist;
  private audio?: HTMLAudioElement;
  private audioVolume: number = AUDIO_VOLUME_MODIFIER;
  private subtitles?: string;
  public onPlay?: OnPlayCallback;
  private onBrollChange?: OnBrollChange;

  constructor(url: string, playlist: VideoPlaylist, type: 'video' | 'audio' = 'video') {
    this.playlist = playlist;
    this.currentTime = 0;
    this.source = this.createSource(url, type);
  }

  init(
    segments: HighlightSegment[],
    audioEnabled: boolean,
    renderer: RenderingEngine,
    onPlay: OnPlayCallback,
    onBrollChange: OnBrollChange
  ) {
    this.onPlay = onPlay;
    this.onBrollChange = onBrollChange;
    if (!this.renderer) {
      this.renderer = renderer;
      const mediaElement = this.source.element;
      if (mediaElement) {
        this.renderer.initSource(
          mediaElement,
          this.audio,
          this.handlePlay.bind(this),
          this.handlePause.bind(this),
          this.handleEnd.bind(this),
          audioEnabled,
          segments
        );
      }
    } else {
      this.renderer.segments = segments;
    }
    this.playlist.reloadCache();
  }

  initCaptions(captions: CaptionSettings, metadata: VideoMetadata, words: WordBase[], canvas: HTMLCanvasElement) {
    const isVertical = this.renderer?.layout === 'VERTICAL';
    const dimensions = isVertical
      ? {
        width: 1080,
        height: 1920
      }
      : {};
    this.subtitles = getAssFileString({
      videoMetadata: metadata,
      transcript: words,
      subtitleSettings: captions,
      isVertical,
      ...dimensions
    });

    const options = {
      canvas, // canvas element
      workerUrl: '/subtitles-octopus-worker.js',
      fonts: ['/Roboto-Regular.ttf', '/Montserrat.ttf', '/Poppins-Medium.ttf', '/FiraSansCondensed.ttf'],
      subContent: this.subtitles
    };
    this.renderer?.initCaptions(options);
  }

  async play() {
    this.state = PLAYBACK_STATE.PLAYING;
    const bRoll = this.playlist?.handlePlay(this.currentTime);
    if (this.renderer) {
      this.renderer.currentlyPlayingVideo = bRoll?.[0];
    }
    if (this.audio && this.audioEnabled) {
      this.audio.currentTime = this.currentTime;
      try {
        await this.audio.play();
      } catch (error) {
        console.warn('Failed to play audio:', error);
      }
    }
    try {
      await this.source?.element?.play();
    } catch (error) {
      console.warn('Failed to play source media:', error);
    }
  }

  pause() {
    this.source?.element?.pause();
    if (this.audio) {
      this.audio.pause();
    }
    this.state = PLAYBACK_STATE.PAUSED;
  }

  seek(time: number) {
    if (this.source?.element?.currentTime !== time) {
      this.renderer?.seek(time);
      if (this.audio) {
        this.audio.currentTime = time;
      }
      const bRoll = this.playlist?.handlePlay(this.currentTime)[0];
      if (bRoll?.element) {
        bRoll.element.currentTime = time - bRoll.timeStart + (bRoll.offsetStart ?? 0);
      }
      if (this.state === PLAYBACK_STATE.PAUSED) {
        this.handlePlay(time);
      } else if (this.state === PLAYBACK_STATE.PLAYING) {
        if (bRoll?.element && typeof bRoll.element.play === 'function') {
          bRoll.element.play();
        }
        this.audio?.play();
      }
    }
  }

  handleEnd() {
    this.state = PLAYBACK_STATE.PAUSED;
  }

  handlePause() {
    this.state = PLAYBACK_STATE.PAUSED;
  }

  handlePlay(currentTime: number) {
    // Only proceed with callback if there's a change in currentTime
    this.currentTime = currentTime;
    const [currentlyPlayingBroll, nextBroll] = this.playlist.handlePlay(
      this.source.element?.currentTime ?? currentTime
    );
    const hasMedia =
      currentlyPlayingBroll?.element ||
      (currentlyPlayingBroll?.brollType === 'AI_PHOTO' && currentlyPlayingBroll?.imageElement);
    const currentlyPlayingVideo =
      currentlyPlayingBroll && currentlyPlayingBroll.isVisible && hasMedia
        ? currentlyPlayingBroll
        : undefined;
    this.renderer!.currentlyPlayingVideo = currentlyPlayingVideo ?? undefined;
    this.onBrollChange?.(currentlyPlayingVideo ?? null);

    if (
      nextBroll?.element &&
      typeof nextBroll.element.play === 'function' &&
      nextBroll.timeStart - currentTime < 0.1
    ) {
      nextBroll.element.play();
    }

    this.applyAudioFadeOut(currentTime);

    this.onPlay?.(currentTime, this.source.element?.currentTime ?? 0, currentlyPlayingBroll);
  }

  redraw() {
    this.handlePlay(this.currentTime);
    this.renderer!.draw();
  }

  initAudio(data: AudioData): HTMLAudioElement {
    const element = document.createElement('audio');
    element.src = data.preview;
    element.volume = this.audioVolume;
    convertToBlobUrl(data.preview).then(blob => {
      const wasPlaying = !element.paused;
      const currentTime = element.currentTime;
      element.pause();
      element.src = blob;
      element.currentTime = currentTime;
      if (wasPlaying) {
        element.play().catch(() => {});
      }
    });

    return element;
  }

  createSource(url: string, type: 'video' | 'audio'): PlaybackSource {
    const element: HTMLMediaElement =
      type === 'video'
        ? (() => {
            const video = document.createElement('video');
            video.src = url;
            video.volume = 1;
            video.muted = false;
            video.autoplay = false;
            video.loop = false;
            video.playsInline = true;
            return video;
          })()
        : (() => {
            const audio = document.createElement('audio');
            audio.src = url;
            audio.volume = 1;
            audio.muted = false;
            audio.autoplay = false;
            audio.loop = false;
            return audio;
          })();
    return {
      url,
      element
    };
  }

  destroy() {
    // Clean up audio element
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio.remove();
      this.audio = undefined;
    }

    // Clean up source video element
    if (this.source?.element) {
      this.source.element.pause();
      this.source.element.src = '';
      this.source.element.remove();
      this.source.element = undefined;
    }

    this.playlist?.destroy();
    this.renderer?.destroy();
    delete this.renderer;

    // Clear callbacks
    this.onPlay = undefined;
  }

  setPlaylist(videoMap: VideoObject[][], altMap: number[]) {
    this.playlist.setPlaylist(videoMap, altMap, this.currentTime);
  }

  async setAudio(data: AudioData) {
    if (this.renderer) {
      this.audio?.pause();
      this.audio?.remove();
      this.renderer.audio?.remove();
      this.audio = this.initAudio(data);
      this.renderer.audio = this.audio;
      if (this.state === PLAYBACK_STATE.PLAYING) {
        this.renderer.audio.currentTime = this.currentTime;
        this.renderer.audio.play().catch(() => {});
      }
    }
  }

  setAudioVolume(audioVolume: number = AUDIO_VOLUME_MODIFIER) {
    if (this.audio) this.audio.volume = audioVolume;
    this.audioVolume = audioVolume;
  }

  toggleAudio(isEnabled: boolean) {
    this.audioEnabled = isEnabled;
    if (!isEnabled) {
      this.audio?.pause();
    } else if (this.audio && isEnabled && this.state === PLAYBACK_STATE.PLAYING) {
      this.audio.currentTime = this.currentTime;
      this.audio.play();
    }
  }

  updateRecropInfo(recropInfo: RecroppedVideoFrame[]) {
    if (this.renderer) {
      this.renderer.verticalRecropInfo = recropInfo;
    }
  }

  updateOrientation(orientation: 'VERTICAL' | 'HORIZONTAL') {
    this.renderer?.updateOrientation(orientation);
  }

  get aspectRatio() {
    if (isVideoSource(this.source) && this.source.element) {
      const { videoWidth, videoHeight } = this.source.element;
      return videoWidth / videoHeight;
    }
    return 16 / 9;
  }
  get duration() {
    return this.source?.element?.duration ?? 0;
  }

  get state() {
    return this.renderer!.state;
  }

  set state(state: PLAYBACK_STATE) {
    this.renderer!.state = state;
  }

  get audioEnabled() {
    return !!this.renderer?.audioEnabled;
  }

  set audioEnabled(isEnabled: boolean) {
    this.renderer!.audioEnabled = isEnabled;
  }

  private applyAudioFadeOut(currentTime: number): void {
    if (!this.audio || !this.audioEnabled || !this.source?.element?.duration) return;

    if (this.source.element.duration - AUDIO_FADE_OUT_SECONDS < currentTime) {
      this.audio.volume = Math.max(
        (this.audioVolume * (this.source.element.duration - currentTime)) / AUDIO_FADE_OUT_SECONDS,
        0
      );
    }
  }

  setPlaybackRate(rate: number) {
    if (rate <= 0) return;

    if (this.source?.element) {
      this.source.element.playbackRate = rate;
    }

    if (this.audio) {
      this.audio.playbackRate = rate;
    }

    // Update any currently playing B-roll videos
    this.playlist?.updatePlaybackRate(rate);
  }
}
