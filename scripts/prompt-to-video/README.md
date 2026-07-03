# prompt-to-video

Generate a video from a text prompt.

**Pipeline:**
1. Claude generates a self-contained HTML animation from your prompt
2. Puppeteer opens the page and screenshots every frame
3. ffmpeg stitches the frames into an MP4

## Setup

```bash
cd scripts/prompt-to-video
npm install
```

Requires `ANTHROPIC_API_KEY` – loaded automatically from `../../app/server/.env`.

## Usage

```bash
# Basic
node index.js "a neon galaxy spinning through deep space"

# Custom duration, resolution and output path
node index.js "looping lava lamp with purple blobs" \
  --duration 8 \
  --fps 30 \
  --width 1080 \
  --height 1920 \
  --output lava-lamp.mp4

# HTML is saved by default (output.mp4 → output.html). Override with:
node index.js "bouncing colorful balls" --save-html custom-name.html
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `-d, --duration <s>` | `6` | Video duration in seconds |
| `-f, --fps <fps>` | `30` | Frames per second |
| `-W, --width <px>` | `1080` | Video width |
| `-H, --height <px>` | `1920` | Video height (portrait by default) |
| `-o, --output <file>` | `output.mp4` | Output file path |
| `-s, --save-html <file>` | `{output}.html` | Path for the generated HTML (default: same name as video, .html) |
| `-m, --model <model>` | `claude-opus-4-5` | Claude model to use |
