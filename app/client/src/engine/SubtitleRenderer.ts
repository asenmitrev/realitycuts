// @ts-expect-error: No type declarations for module
import SubtitlesOctopus from '../lib/subtitles-octopus';

export class SubtitleRenderer {
  public octopus?: SubtitlesOctopus;
  private octopusCache?: { bufferCanvas: CanvasImageSource; x: number; y: number };

  initOctopus(options: { subContent: string; fonts: string[]; workerUrl: string }) {
    if (!this.octopus) {
      this.octopus = new SubtitlesOctopus({
        ...options,
        onRender: (bufferCanvas: CanvasImageSource, x: number, y: number) => {
          this.octopusCache = { bufferCanvas, x, y };
        }
      });
      this.octopus.resizeWithTimeout();
    } else {
      this.octopus.setTrack(options.subContent);
    }
  }

  drawSubtitles(context: CanvasRenderingContext2D) {
    if (this.octopusCache) {
      context.drawImage(this.octopusCache?.bufferCanvas, this.octopusCache?.x, this.octopusCache?.y);
    }
  }

  dispose() {
    this.octopus?.dispose();
    delete this.octopus;
  }

  resize() {
    if (this.octopus) {
      this.octopus.resizeWithTimeout();
    }
  }

  setCurrentTime(currentTime: number) {
    if (this.octopus) {
      this.octopus.setCurrentTime(currentTime);
    }
  }
}
