import { VideoObject, PLAYBACK_STATE, HighlightSegment, RecroppedVideoFrame } from '../types';
import { SubtitleRenderer } from './SubtitleRenderer';
import { VideoRenderer } from './VideoRenderer';

export class RenderingEngine {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private _currentlyPlayingVideo?: HTMLVideoElement;
  public source?: HTMLMediaElement;
  private boundOnBuffering: () => void;
  private boundOnEndBuffering: () => void;
  private spinnerAngle: number = 0;
  private destroyed: boolean = false;
  public audio?: HTMLAudioElement;
  private _buffering: boolean = false;
  private _currentlyPlayingVideoObject?: VideoObject;
  public state: PLAYBACK_STATE = PLAYBACK_STATE.PAUSED;
  private onEnd: () => void = () => { };
  public audioEnabled: boolean = false;
  public segments?: HighlightSegment[];
  private subtitleRenderer: SubtitleRenderer;
  private videoRenderer: VideoRenderer;
  private onPlay: (currentTime: number) => void = () => { };
  private animationFrameId: number | null = null;
  private eventListeners: Array<{ element: HTMLElement; event: string; handler: EventListener }> = [];
  private _currentPlaybackTime: number = 0;

  constructor(cv: HTMLCanvasElement, subtitleRenderer: SubtitleRenderer, videoRenderer: VideoRenderer) {
    if (!cv) {
      throw new Error('No canvas found on screen.');
    }
    this.canvas = cv;
    const context = cv.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('No context found.');
    }
    this.boundOnBuffering = this.onBuffering.bind(this);
    this.boundOnEndBuffering = this.onEndBuffering.bind(this);
    this.context = context;
    this.subtitleRenderer = subtitleRenderer;
    this.videoRenderer = videoRenderer;
  }

  updateOrientation(orientation: 'VERTICAL' | 'HORIZONTAL') {
    this.videoRenderer.layout = orientation;
    this.subtitleRenderer.resize();
  }

  initCaptions(options: { subContent: string; fonts: string[]; workerUrl: string }) {
    this.draw();
    this.subtitleRenderer.initOctopus(options);
  }

  seek(time: number) {
    if (!this.source) {
      console.warn('Cannot seek: no source element available');
      return;
    }

    let cumulativeTime = 0;
    if (this.segments?.length) {
      for (const segment of this.segments ?? []) {
        const segmentDuration = segment.end - segment.start;
        if (cumulativeTime + segmentDuration > time && cumulativeTime <= time) {
          this.source!.currentTime = segment.start + time - cumulativeTime;
          break;
        } else {
          cumulativeTime += segmentDuration;
        }
      }
    } else {
      this.source.currentTime = time;
    }
  }

  initSource(
    source: HTMLMediaElement,
    audio: HTMLAudioElement | undefined,
    onPlay: (currentTime: number) => void,
    _: () => void,
    onEnd: () => void,
    audioEnabled: boolean,
    segments?: HighlightSegment[]
  ) {
    this.source = source;
    this.audio = audio;
    this.segments = segments;
    this.audioEnabled = audioEnabled;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const renderer = this;
    this.onEnd = () => {
      this.audio?.pause();
      this.pauseCurrentVideo();
      this.source?.load();
      onEnd();
    };

    this.onEnd = this.onEnd.bind(this);
    this.onPlay = onPlay;

    source.load();

    // Add logic to jump to the start of the first segment
    if (this.segments && this.segments.length > 0) {
      this.source.currentTime = this.segments[0].start;
    }

    this.startAnimationLoop();

    source.addEventListener('ended', this.onEnd);
    renderer.draw();
  }

  private startAnimationLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const playLoop = () => {
      if (this.destroyed) {
        return;
      }

      this.draw();
      this.updatePlayback();
      this.animationFrameId = requestAnimationFrame(playLoop);
    };

    this.animationFrameId = requestAnimationFrame(playLoop);
  }

  private updatePlayback() {
    const source = this.source;
    if (!source) {
      return;
    }
    let currentTime = source.currentTime;
    const isInHighlight = !!this.segments?.length;
    // get cumulative current time
    if (isInHighlight) {
      const nextSegment = this.segments?.findIndex(s => s.start > source.currentTime) ?? -2;
      let currentSegment =
        nextSegment === -2
          ? -2
          : nextSegment === -1
            ? this.segments!.length - 1
            : nextSegment > 0
              ? nextSegment - 1
              : nextSegment;
      if (currentSegment >= 0 && currentTime >= this.segments![currentSegment].end) {
        if (this.segments![currentSegment + 1]) {
          currentSegment = currentSegment + 1;
          source.currentTime = this.segments![currentSegment].start + 0.002; // Add one ms for algorithm to avoid rounding errors on video playback
        } else {
          this.state = PLAYBACK_STATE.PAUSED;
          source.pause();
          this.audio?.pause();
        }
      }
      if (currentSegment >= 0) {
        currentTime = this.segments!.slice(0, currentSegment).reduce((acc, item) => {
          acc += item.end - item.start;
          return acc;
        }, 0);
        currentTime += source.currentTime - this.segments![currentSegment].start;
      }
    }
    // check if segment is exceeded
    // start new segment
    if (isMediaPlaying(source) || this.state === PLAYBACK_STATE.PLAYING) {
      this.playCurrentVideo(currentTime);
      this.onPlay(currentTime);
    } else if (!this.buffering) {
      this.pauseCurrentVideo();
    } else if (this.state === PLAYBACK_STATE.PAUSED) {
      this.pauseCurrentVideo();
    }
    if (this.buffering && this._currentlyPlayingVideo) {
      if (this._currentlyPlayingVideo.readyState >= this._currentlyPlayingVideo.HAVE_ENOUGH_DATA) {
        this.onEndBuffering();
      }
    }
    this._currentPlaybackTime = currentTime;
    this.subtitleRenderer.setCurrentTime(currentTime);
  }

  private get drawable(): HTMLVideoElement | null {
    return this.source instanceof HTMLVideoElement ? this.source : null;
  }

  draw() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    try {
      const drawable = this.drawable;

      if (this.buffering && this.state === PLAYBACK_STATE.PLAYING) {
        this.drawSpinner();
      } else if (
        this._currentlyPlayingVideoObject?.brollType === 'AI_PHOTO' &&
        this._currentlyPlayingVideoObject?.imageElement
      ) {
        const videoObj = this._currentlyPlayingVideoObject;
        const elapsed = this._currentPlaybackTime - videoObj.timeStart;
        const duration = videoObj.timeEnd - videoObj.timeStart;
        const progress = Math.max(0, Math.min(1, elapsed / duration));
        const zoomScale = 1 + progress * 0.08; // Subtle zoom from 1.0x to 1.08x

        this.videoRenderer.drawOverlayImage(
          drawable,
          this._currentlyPlayingVideoObject.imageElement,
          this._currentlyPlayingVideoObject,
          zoomScale
        );
      } else if (this._currentlyPlayingVideo && this._currentlyPlayingVideoObject) {
        this.videoRenderer.drawOverlayVideo(
          drawable,
          this._currentlyPlayingVideo,
          this._currentlyPlayingVideoObject
        );
      } else {
        this.videoRenderer.drawSource(drawable);
      }

      this.subtitleRenderer.drawSubtitles(this.context);
    } catch (error) {
      console.error('Error during rendering:', error);
    }
  }

  drawSpinner() {
    const angle = this.spinnerAngle;
    // Set the center and radius of the spinner
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    const radius = 20;

    // Set the initial angle and angular speed
    const angularSpeed = 0.1;
    const ctx = this.context;

    // Draw the spinner
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, angle, angle + 1.5 * Math.PI, false); // Draw a partial arc
    ctx.strokeStyle = '#3498db'; // Set the color
    ctx.lineWidth = 3; // Set the line width
    ctx.stroke();
    ctx.closePath();

    // Return the updated angle
    this.spinnerAngle += angularSpeed;
  }

  playCurrentVideo(currentTime: number) {
    if (this._currentlyPlayingVideo && !isMediaPlaying(this._currentlyPlayingVideo)) {
      this._currentlyPlayingVideo.currentTime =
        currentTime -
        this._currentlyPlayingVideoObject!.timeStart +
        (this._currentlyPlayingVideoObject?.offsetStart ?? 0);

      if (this._currentlyPlayingVideo.attributes.getNamedItem('data-loading')?.value === '1') {
        this.onBuffering();
      } else {
        this._currentlyPlayingVideo.play();
      }
    }
  }
  pauseCurrentVideo() {
    if (this._currentlyPlayingVideo && isMediaPlaying(this._currentlyPlayingVideo)) {
      this._currentlyPlayingVideo.pause();
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.subtitleRenderer.dispose();
    this.cleanupEventListeners();

    delete this.source;
    delete this.audio;
    delete this._currentlyPlayingVideo;
    delete this._currentlyPlayingVideoObject;
  }

  cleanupEventListeners() {
    this.source?.removeEventListener('ended', this.onEnd);

    // Remove all registered event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }

  removeEventListener(element: HTMLElement, event: string, handler: EventListener) {
    this.eventListeners = this.eventListeners.filter(
      ({ element: e, event: ev, handler: h }) => !(e === element && ev === event && h === handler)
    );
  }

  onBuffering() {
    this.buffering = true;
    this.source?.pause();
    this.audio?.pause();
  }

  onEndBuffering() {
    if (this.buffering && this.state === PLAYBACK_STATE.PLAYING) {
      this.source?.play().catch(e => {
        console.log(e);
      });

      if (this.audioEnabled) {
        this.audio?.play();
      }
    }
    this.buffering = false;
  }

  set verticalRecropInfo(recropInfo: RecroppedVideoFrame[]) {
    this.videoRenderer.verticalRecropInfo = recropInfo;
  }

  get layout() {
    return this.videoRenderer.layout;
  }

  set buffering(v: boolean) {
    this._buffering = v;
  }

  get buffering() {
    return this._buffering;
  }

  set currentlyPlayingVideo(video: VideoObject | undefined) {
    const prevPlayingVideo = this._currentlyPlayingVideo;
    this._currentlyPlayingVideo = isVideoElement(video?.element) ? video.element : undefined;
    this._currentlyPlayingVideoObject = video;
    if (this._currentlyPlayingVideo && this._currentlyPlayingVideo !== prevPlayingVideo) {
      if (prevPlayingVideo) {
        this.removeEventListener(prevPlayingVideo, 'waiting', this.boundOnBuffering);
        this.removeEventListener(prevPlayingVideo, 'playing', this.boundOnEndBuffering);
      }
      this._currentlyPlayingVideo.play().catch(() => {
        // Ignore autoplay/interrupt errors; rendering loop keeps playback in sync.
      });
      this.registerEventListener(this._currentlyPlayingVideo, 'waiting', this.boundOnBuffering);
      this.registerEventListener(this._currentlyPlayingVideo, 'playing', this.boundOnEndBuffering);
    } else if (prevPlayingVideo) {
      this.removeEventListener(prevPlayingVideo, 'waiting', this.boundOnBuffering);
      this.removeEventListener(prevPlayingVideo, 'playing', this.boundOnEndBuffering);
    }
  }

  get currentlyPlayingVideo() {
    return this._currentlyPlayingVideoObject;
  }

  private registerEventListener(element: HTMLElement, event: string, handler: EventListener) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

}

const isMediaPlaying = (media: HTMLMediaElement) => {
  return !!(!media.paused && !media.ended);
};

const isVideoElement = (element: unknown): element is HTMLVideoElement => {
  return element instanceof HTMLVideoElement;
};
