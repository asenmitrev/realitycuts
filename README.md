# RealityCuts

Self-hosted, AI-powered video generation and editing. Upload your own footage libraries, generate narrated videos from a script or a prompt, fine-tune them in a canvas editor, and export the result — or put the whole pipeline on a schedule.

## Quick Start

Requirements: Docker (for Redis, MinIO, server, client) and a reachable MongoDB instance.

```bash
yarn install
docker compose up
```

- Client: http://localhost:3020
- API: http://localhost:3021
- MinIO console: http://localhost:9001 (default credentials `minioadmin` / `minioadmin`)

For development outside Docker, run `yarn start:server` and `yarn start:client` with a `.env.dev` configured per `app/server/config/dotenv.ts` (see [CLAUDE.md](CLAUDE.md) for the full environment variable reference). You will need API keys for the AI services you plan to use — at minimum an LLM provider (Anthropic, OpenAI, or a local endpoint) and ElevenLabs for text-to-speech.

## How to Use the App

### 1. Add a library with footage

Libraries are your pools of B-roll footage. When a video is generated, the AI picks the clips that best match each line of the script from the libraries you select — so the richer your library, the better the output.

1. Sign up / log in, then open **Libraries** in the navigation and click **Add Library** (or go to `/library/add`).
2. Give the library a name and drag video clips (or images) into the dropzone. Short, single-subject clips work best — they give the AI more precise material to match against the script.
3. Submit. Your files are uploaded and processed in the background: each clip is analyzed and described so it can be matched to script content later. You can watch the status on the library processing page.
4. Once processing finishes, the library shows up in **Libraries** and can be selected when creating videos. You can add more footage to an existing library at any time from its detail page.

You can also skip building your own library and rely on public libraries or Pexels stock footage when creating a video.

### 2. Create a video

1. Click **Upload** (or go to `/upload`) and choose a video type:
   - **Faceless Video** — paste a script and the AI generates the voiceover (pick a voice from the voice selector), or upload a pre-recorded audio file instead.
   - **Talking Head Video** — upload a pre-recorded video of yourself speaking; the AI transcribes it and layers in matching B-roll.
   - **Highlight** — submit a long video to be cut into highlight clips.
2. Choose the orientation (vertical for Shorts/Reels/TikTok, horizontal for standard video) and select which libraries to draw footage from — your own, public ones, and/or Pexels.
3. Submit and watch the progress screen. The pipeline transcribes/generates the audio, matches footage to each segment of the script, and assembles a draft video.
4. When it's done, the video appears under **Videos**. Open it in the editor to fine-tune:
   - swap individual clips (search your libraries or Pexels for replacement footage),
   - edit and style the captions,
   - adjust audio/music,
   - use the built-in AI chat to request edits in plain language.
5. Click **Export** to render the final video, then download it from the export details page (also listed under exports for later).

### 3. Automate video creation

Automations generate videos on a schedule without any manual input per video — the AI writes a fresh script on your topic each run, then produces the video with your saved settings.

1. Open **Automations** (`/automation-configs`) and click **New**.
2. Fill in the three sections of the form:
   - **Basic information** — optional branding: a watermark logo and its position, hashtags to append to video descriptions, and background music (describe a style, or leave empty to let the AI choose).
   - **Content settings** — the **automation topic** (describe what the videos should be about, including any specific instructions or call-to-actions), the voiceover voice, a caption style preset, orientation, and which libraries/Pexels to source footage from. You can also attach PDF source documents — the automation extracts scripts from their content instead of inventing topics from scratch.
   - **Schedule** — **daily** (one or more times per day) or **weekly** (pick days of the week and a time).
3. Use **Test generation** to produce a one-off video with the current settings and preview the result before committing.
4. Save and make sure the automation is toggled **on**. Videos are generated automatically at the scheduled times and appear under **Videos**, where you can review, edit, and export them like any manually created video. The scripts panel on the automation lets you review and edit upcoming generated scripts.

## Development

```bash
yarn typecheck    # TypeScript across all workspaces
yarn test:unit    # Unit tests (Vitest)
yarn build:prod   # Production build (client + server)
```

See [CLAUDE.md](CLAUDE.md) for architecture details, conventions, and the full environment variable reference.
