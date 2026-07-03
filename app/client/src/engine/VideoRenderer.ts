import { RecroppedVideoFrame } from '../types';
import { findCropInfo } from 'shared/utils/vertical';
import { VideoObject } from '../types';

export class VideoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  public layout: 'VERTICAL' | 'HORIZONTAL' = 'VERTICAL';
  public verticalRecropInfo?: RecroppedVideoFrame[];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    if (!this.ctx) {
      console.error('Failed to get 2D context from canvas');
    }
  }

  drawOverlayVideo(
    source: HTMLVideoElement | null,
    currentlyPlayingVideo: HTMLVideoElement,
    currentlyPlayingVideoObject: VideoObject
  ) {
    if (!currentlyPlayingVideo || !this.ctx) return;

    const videoWidth =
      this.layout === 'VERTICAL' || !source ? this.canvas.width : source.videoWidth;
    const videoHeight =
      this.layout === 'VERTICAL' || !source ? this.canvas.height : source.videoHeight;

    const scale = Math.min(
      currentlyPlayingVideo.videoWidth / videoWidth,
      currentlyPlayingVideo.videoHeight / videoHeight
    );

    const scaledWidth = videoWidth * scale;
    const scaledHeight = videoHeight * scale;

    // Constrain position values between 0 and 2
    const leftPercentage = Math.max(0, Math.min(2, currentlyPlayingVideoObject?.leftPosition ?? 0));
    const topPercentage = Math.max(0, Math.min(2, currentlyPlayingVideoObject?.topPosition ?? 0));

    // Calculate drawing offsets
    const dx = (currentlyPlayingVideo.videoWidth - scaledWidth) * 0.5 * leftPercentage;
    const dy = (currentlyPlayingVideo.videoHeight - scaledHeight) * 0.5 * topPercentage;

    this.ctx.drawImage(
      currentlyPlayingVideo,
      Math.round(dx * 100) / 100,
      Math.round(dy * 100) / 100,
      Math.round(scaledWidth * 100) / 100,
      Math.round(scaledHeight * 100) / 100,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
  }

  drawOverlayImage(
    source: HTMLVideoElement | null,
    image: HTMLImageElement,
    currentlyPlayingVideoObject: VideoObject,
    zoomScale: number = 1
  ) {
    if (!image || !this.ctx || !image.complete || image.naturalWidth === 0) return;

    const videoWidth =
      this.layout === 'VERTICAL' || !source ? this.canvas.width : source.videoWidth;
    const videoHeight =
      this.layout === 'VERTICAL' || !source ? this.canvas.height : source.videoHeight;

    const scale = Math.min(
      image.naturalWidth / videoWidth,
      image.naturalHeight / videoHeight
    );

    let scaledWidth = videoWidth * scale;
    let scaledHeight = videoHeight * scale;

    const leftPercentage = Math.max(0, Math.min(2, currentlyPlayingVideoObject?.leftPosition ?? 0));
    const topPercentage = Math.max(0, Math.min(2, currentlyPlayingVideoObject?.topPosition ?? 0));

    let dx = (image.naturalWidth - scaledWidth) * 0.5 * leftPercentage;
    let dy = (image.naturalHeight - scaledHeight) * 0.5 * topPercentage;

    // Apply zoom-in effect: crop a smaller region of the source to simulate zoom
    if (zoomScale > 1) {
      const prevWidth = scaledWidth;
      const prevHeight = scaledHeight;
      scaledWidth /= zoomScale;
      scaledHeight /= zoomScale;
      dx += (prevWidth - scaledWidth) / 2;
      dy += (prevHeight - scaledHeight) / 2;
    }

    this.ctx.drawImage(
      image,
      Math.round(dx * 100) / 100,
      Math.round(dy * 100) / 100,
      Math.round(scaledWidth * 100) / 100,
      Math.round(scaledHeight * 100) / 100,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
  }

  drawSource(source: HTMLVideoElement | null) {
    if (!this.ctx) return;

    if (!source) {
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    if (this.layout === 'VERTICAL' && this.verticalRecropInfo?.length) {
      this.drawVerticalSource(source);
    } else {
      this.drawStandardSource(source);
    }
  }

  private drawVerticalSource(video: HTMLVideoElement) {
    if (!this.ctx || !this.verticalRecropInfo?.length) return;

    const croppedFrame = findCropInfo(this.verticalRecropInfo, video.currentTime);

    if (croppedFrame) {
      const { x1, y1, x2, y2 } = croppedFrame;
      const sourceWidth = x2 - x1;
      const sourceHeight = y2 - y1;

      this.ctx.drawImage(video, x1, y1, sourceWidth, sourceHeight, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.drawStandardSource(video);
    }
  }

  private drawStandardSource(video: HTMLVideoElement) {
    if (!this.ctx) return;

    // Calculate scaling to maintain aspect ratio
    const scaleWidth = this.canvas.width / video.videoWidth;
    const scaleHeight = this.canvas.height / video.videoHeight;
    const scale = Math.min(scaleWidth, scaleHeight);

    // Calculate dimensions and position
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    const x = (this.canvas.width - width) / 2;
    const y = (this.canvas.height - height) / 2;

    this.ctx.drawImage(video, x, y, width, height);
  }

  // Optional: Clear the canvas before drawing
  clearCanvas() {
    if (this.ctx) {
      // this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
