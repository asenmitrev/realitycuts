# VideoAI (RealityCuts) - CLAUDE.md

## Project Overview

Full-stack web application for AI-powered video generation and editing. Users upload video libraries, generate videos from prompts using LLMs, edit in a canvas-based editor, and export/download the finished video. There is no social media publishing integration (YouTube/TikTok/Instagram) on this self-hosted branch — it required ongoing OAuth app review from each platform, which isn't feasible to maintain for an open-source project.

The current branch is self-hosted. Lambda, ECS/Fargate, SQS, CDK, Firebase Auth, and CloudWatch are not live architecture here.

## Monorepo Structure

Yarn 4 workspaces.

```
videoai/
├── app/client/          # React 19 + Vite frontend (port 3011 dev)
├── app/server/          # Express + TypeScript backend (port 3010 dev)
├── shared/              # Shared TypeScript types and utilities
├── services/            # Workspace service packages, if present
├── scripts/             # Utility scripts
└── docker-compose.yml   # Local/self-hosted Redis, MinIO, server, client
```

There are no active `functions/` or `tasks/` source directories on this branch. Lambda/ECS paths may still appear in some legacy code names or scripts, but local/EC2-style server execution is the supported path.

## Key Commands

### Development

```bash
yarn install
yarn start:client               # Frontend dev server
yarn start:server               # Backend dev server with ENVIRONMENT=dev
docker compose up               # Self-hosted stack: Redis, MinIO, server, client
```

### Build

```bash
yarn build:prod                 # Client prod build + server build
yarn build:client:uat           # Client UAT build
yarn build:server               # Server bundle
yarn typecheck                  # TypeScript check all workspaces
```

### Test

```bash
yarn test:unit                  # Unit tests
yarn test:unit:app              # Client + server unit tests
yarn workspace server test:unit # Server tests only
yarn workspace client test:unit # Client tests only
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Chakra UI 2, Zustand, React Query, Konva |
| Backend | Node.js 20, Express 4, TypeScript, MongoDB/Mongoose |
| Auth | JWT access/refresh tokens, bcrypt password hashing, httpOnly refresh cookie |
| Queue/Workers | BullMQ + Redis, in-process workers started from `app/server/index.ts` |
| Storage | MinIO via S3-compatible AWS SDK client |
| AI/LLM | LangChain, LangGraph, Anthropic, OpenAI, Qwen, Grok, Vertex AI |
| Media | FFmpeg, ElevenLabs TTS, Deepgram STT, Replicate, Pexels |
| Logging | Winston console + daily rotating log files in `logs/` |
| Testing | Vitest |
| Linting | Biome 2 |

## Architecture

### Backend Layer Structure

```
Routes (app/server/routes/)
  -> Controllers (app/server/controllers/)
    -> Services (app/server/services/)
      -> Repositories (app/server/repositories/)
        -> Models (app/server/models/)
      -> External APIs (LLM, storage)
```

### Runtime Model

- `app/server/index.ts` loads env vars first, connects MongoDB, starts BullMQ workers, then starts Express.
- BullMQ producers live mostly in `app/server/services/task-queue.ts`.
- BullMQ queue names, payloads, and concurrency live in `app/server/services/bullmq/types.ts`.
- Workers are registered in `app/server/services/bullmq/workers.ts` and run in the server process.
- Redis is configured by `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, and `REDIS_PREFIX`.
- File/media storage goes through `app/server/services/storage/s3.ts`, configured for MinIO with path-style S3 access.

### Frontend State Management

| State Type | Tool |
|------------|------|
| Auth / user profile | JWT-backed auth/profile contexts |
| Server cache | React Query |
| UI state | Zustand stores and local component state |
| Form state | React Hook Form |

### AI Chat Orchestration

LangGraph-based multi-agent orchestration lives in `app/server/services/chat-orchestrator/`. Standalone agents live in `app/server/agents/`.

## Self-Hosting

`docker-compose.yml` is the supported local/self-hosted entry point.

Services:

- `redis`: BullMQ broker on port `6379`.
- `minio`: S3-compatible object storage on port `9000`, console on `9001`.
- `minio-init`: creates bucket `1703-media-app-2` and sets public access for local media URLs.
- `server`: Express API on port `3010`, with BullMQ workers running in-process.
- `client`: frontend on port `3011`.

Default MinIO credentials are `minioadmin` / `minioadmin` unless overridden with `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`.

The compose file sets `ENVIRONMENT=local`, `REDIS_HOST=redis`, `MINIO_ENDPOINT=http://minio:9000`, `MEDIA_BASE_URL=http://localhost:9000`, `CLIENT_URL=http://localhost:3011`, and `API_URL=http://localhost:3010`.

MongoDB is configured by `MONGODB_URI`. The compose file currently defaults it to `mongodb://mongo:27017/videoai`; make sure a MongoDB service or reachable external MongoDB is available when using the stack.

## Critical Conventions

### Environment Variables

- Server env loading is centralized in `app/server/config/dotenv.ts`.
- `configureDotenv()` must run before imports that read configuration.
- Server reads `.env.${ENVIRONMENT}` for non-compose local development.
- Client env vars must use Vite's `VITE_` prefix.
- Docker Compose passes key server env vars directly to the `server` container.

### Route Loading Order

In `app/server/app.ts`:

1. `/api/health` is registered before middleware.
2. `/api/chat` mounts before compression so SSE is not buffered.
3. Compression, body parsing, `/api` routes, and error handling follow.
4. Static client files are served last for self-hosted builds.

### Build Outputs

- Server bundle: `app/server/dist_server/`
- Traditional/EC2 server build: `app/server/dist/`
- Client build: `app/client/dist/`

### Storage

The code still uses S3 naming in some abstractions, but the active backend is MinIO:

- `MINIO_BUCKET`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MEDIA_BASE_URL`

### Logging

Use `app/server/services/logging.ts`. It configures Winston console logging plus `winston-daily-rotate-file` output under `logs/app-%DATE%.log`.

## Required Environment Variables

Key server variables:

```bash
# Runtime
ENVIRONMENT=local
PORT=3010
MONGODB_URI=mongodb://...
CLIENT_URL=http://localhost:3011
API_URL=http://localhost:3010

# Auth
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Queue
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_PREFIX=videoai:

# Storage
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=1703-media-app-2
MEDIA_BASE_URL=http://localhost:9000

# LLMs / AI
OPENAI_KEY=...
ANTHROPIC_API_KEY=...
GROK_KEY=...
PERPLEXITY_API_KEY=...
QWEN_KEY=...
QWEN_BASE_URL=...
VERTEX_API_KEY=...
LOCAL_LLM_BASE_URL=...

# Media / Search
TAVILY_API_KEY=...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
REPLICATE_API_TOKEN=...
PINECONE_KEY=...
PEXELS_API_KEY=...
YOUTUBE_API_KEY=...

# Rendering
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
```

Do not add SQS queue URLs, Lambda-specific env vars, CloudWatch log groups, Firebase credentials, or CDK deployment settings as required variables for this branch.

## Testing Notes

- Unit tests use Vitest.
- Client tests use jsdom.
- Server tests run from the `server` workspace.
- `yarn typecheck` runs TypeScript checks across workspaces.
