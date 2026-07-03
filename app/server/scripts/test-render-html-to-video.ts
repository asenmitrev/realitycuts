#!/usr/bin/env tsx
/**
 * Quick test script for renderHtmlToVideo.
 * Run from app/server: yarn test:render-html
 * Or with custom HTML: yarn test:render-html -- path/to/file.html [duration_seconds]
 *
 * Requires: PUPPETEER_EXECUTABLE_PATH (e.g. /Applications/Google Chrome.app/Contents/MacOS/Google Chrome)
 *           ffmpeg in PATH
 */

import path from 'path';
import fs from 'fs';
import { renderHtmlToVideo } from '../services/video-generation/v11-proper-context/utils/render-html-to-video';

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="animation-ready" content="true">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 100vw;
    height: 100vh;
    background: #1a1a2e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, sans-serif;
    overflow: hidden;
  }
  .box {
    width: 200px;
    height: 200px;
    background: linear-gradient(135deg, #e94560, #0f3460);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 24px;
    font-weight: bold;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.9; }
  }
</style>
</head>
<body>
<div class="box">Test</div>
</body>
</html>`;

async function main() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) {
    console.error(
      'Set PUPPETEER_EXECUTABLE_PATH, e.g.:\n' +
        '  export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"'
    );
    process.exit(1);
  }

  const [htmlPath, durationArg] = process.argv.slice(2);
  const html = htmlPath && fs.existsSync(htmlPath)
    ? fs.readFileSync(htmlPath, 'utf-8')
    : SAMPLE_HTML;
  const duration = durationArg ? Number(durationArg) : 2;

  if (htmlPath) console.log('Using HTML from:', path.resolve(htmlPath));
  console.log(`Rendering ${duration}s of HTML to video...`);

  const outputPath = await renderHtmlToVideo(html, duration, {
    executablePath,
    fps: 30,
    width: 1920,
    height: 1080
  });

  const absolutePath = path.resolve(outputPath);
  const exists = fs.existsSync(absolutePath);
  const size = exists ? fs.statSync(absolutePath).size : 0;

  console.log('\nDone!');
  console.log('  Output:', absolutePath);
  console.log('  Size:', (size / 1024).toFixed(1), 'KB');
  console.log('\nOpen with: open', absolutePath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
