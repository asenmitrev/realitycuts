import puppeteer, { type Browser } from 'puppeteer-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../../../logging';

export type RenderHtmlToVideoOptions = {
  fps?: number;
  width?: number;
  height?: number;
  /**
   * Path to the Chromium/Chrome executable.
   * Defaults to the PUPPETEER_EXECUTABLE_PATH env var (for local dev).
   * In Lambda, pass the path resolved by @sparticuz/chromium-min.
   */
  executablePath?: string;
  /**
   * Extra CLI args to pass to the browser launch (e.g. from @sparticuz/chromium-min).
   */
  browserArgs?: string[];
};

const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

/** Hold the initial frame for this many ms before CSS/JS animations begin. */
const ANIMATION_DELAY_MS = 500;

const BASE_BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-web-security',
];

/**
 * Renders animated HTML to an MP4 video file using Puppeteer (frame capture) and ffmpeg.
 * Adapted from scripts/prompt-to-video/index.js.
 * Expects HTML to include <meta name="animation-ready" content="true"> for sync.
 *
 * Local dev: set PUPPETEER_EXECUTABLE_PATH to your Chrome/Chromium binary, e.g.:
 *   export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
 * Lambda: pass executablePath from @sparticuz/chromium-min via options.
 */
export async function renderHtmlToVideo(
  html: string,
  duration: number,
  options?: RenderHtmlToVideoOptions
): Promise<string> {
  const fps = options?.fps ?? DEFAULT_FPS;
  const width = options?.width ?? DEFAULT_WIDTH;
  const height = options?.height ?? DEFAULT_HEIGHT;
  const executablePath = options?.executablePath ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  const totalFrames = Math.ceil(duration * fps);
  const frameIntervalMs = 1000 / fps;
  const frameDigits = String(totalFrames).length;

  if (!executablePath) {
    throw new Error(
      'renderHtmlToVideo: no Chromium executable found. ' +
      'Set PUPPETEER_EXECUTABLE_PATH env var for local dev, or pass options.executablePath.'
    );
  }

  const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html-video-frames-'));
  const outputPath = path.join(os.tmpdir(), `html-video-${Date.now()}.mp4`);

  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      protocolTimeout: 300_000, // 5 min — frame capture can be slow on Lambda (evaluate + rAF + screenshot per frame)
      args: [
        ...BASE_BROWSER_ARGS,
        ...(options?.browserArgs ?? []),
        `--window-size=${width},${height}`
      ]
    });

    const page = await browser.newPage();
    // Avoid Runtime.callFunctionOn / screenshot timeouts when capturing many frames on Lambda.
    if (typeof page.setDefaultTimeout === 'function') {
      page.setDefaultTimeout(300_000); // 5 min
    }
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    // Use domcontentloaded to avoid hanging on external resources (LLM may output URLs despite "inline only").
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    await page
      .waitForFunction(
        () => document.querySelector('meta[name="animation-ready"]') !== null,
        { timeout: 10000 }
      )
      .catch(() => {
        logger.debug('animation-ready meta tag not found, continuing anyway');
      });

    await new Promise(r => setTimeout(r, 300));

    // Freeze all animations so the browser clock can't drift them between
    // evaluate() and screenshot(). We seek with currentTime on paused anims.
    await page.evaluate(() => {
      document.getAnimations().forEach(anim => {
        try { anim.pause(); } catch (_) { /* ignore */ }
      });
    });

    for (let i = 0; i < totalFrames; i++) {
      const targetTimeMs = i * frameIntervalMs;
      const animTimeMs = Math.max(0, targetTimeMs - ANIMATION_DELAY_MS);
      await page.evaluate((timeMs: number) => {
        // Pause any animations that appeared since last frame (e.g. triggered by JS).
        document.getAnimations().forEach(anim => {
          try {
            if (anim.playState !== 'paused') anim.pause();
            anim.currentTime = timeMs;
          } catch (_) {
            /* ignore */
          }
        });
        if (typeof (window as unknown as { __tick?: (ms: number) => void }).__tick === 'function') {
          (window as unknown as { __tick: (ms: number) => void }).__tick(timeMs);
        }
        // Wait for the browser to paint the seeked state. rAF can hang in headless when
        // animations are paused (compositor may not schedule paints), so use setTimeout fallback.
        // NOTE: Avoid named `const fn = () => {}` bindings here — tsx/esbuild rewrites them as
        // `__name(fn, "name")` which is undefined in the browser's evaluate context.
        return new Promise<void>(resolve => {
          let done = false;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!done) { done = true; resolve(); }
          }));
          setTimeout(() => { if (!done) { done = true; resolve(); } }, 50); // fallback: never hang
        });
      }, animTimeMs);

      const paddedIndex = String(i).padStart(frameDigits, '0');
      const framePath = path.join(framesDir, `frame-${paddedIndex}.png`);
      await page.screenshot({ path: framePath, type: 'png' });
    }

    await browser.close();
    browser = undefined;
  } finally {
    if (browser) {
      await browser.close().catch(() => { });
    }
  }

  await new Promise<void>((resolve, reject) => {
    const inputPattern = path.join(framesDir, `frame-%0${frameDigits}d.png`);
    ffmpeg()
      .input(inputPattern)
      .inputOptions([`-framerate ${fps}`])
      .videoCodec('libx264')
      .outputOptions(['-pix_fmt yuv420p', '-crf 18', '-preset fast', `-r ${fps}`])
      .output(outputPath)
      .on('error', (err: Error) => {
        reject(err);
      })
      .on('end', () => resolve())
      .run();
  });

  try {
    fs.rmSync(framesDir, { recursive: true, force: true });
  } catch (e) {
    logger.warn('Failed to remove temp frames dir', { framesDir, error: e });
  }

  return outputPath;
}
