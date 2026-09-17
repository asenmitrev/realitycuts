FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY shared/package.json ./shared/
COPY app/server/package.json ./app/server/
COPY app/client/package.json ./app/client/

RUN corepack enable && yarn install --mode=skip-build

FROM deps AS builder

WORKDIR /app

COPY shared/ ./shared/
COPY app/server/ ./app/server/

WORKDIR /app/app/server
RUN yarn build

FROM node:20-alpine

WORKDIR /app

# scenedetect (PySceneDetect CLI) is spawned by library video processing.
# opencv-python has no musl wheels, so use Alpine's py3-opencv and install
# scenedetect itself with --no-deps (deps provided via apk). pip must run
# before py3-opencv is installed: that package ships malformed dist metadata
# ("python-4.12.0") that crashes pip's installed-package scan.
# opencv's video backend is GStreamer, not ffmpeg. chromium transitively pulls
# in bare gstreamer + gst-plugins-base, but not the demuxer/decoder plugin
# sets, so without these opencv can open a pipeline but not decode real
# video files (fails with "missing plugin: ID3 tag demuxer" etc).
RUN apk add --no-cache ffmpeg chromium wget python3 py3-pip \
  gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav \
  && pip3 install --no-cache-dir --break-system-packages --no-deps scenedetect \
  && apk add --no-cache py3-opencv py3-numpy py3-click py3-tqdm py3-platformdirs

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# dist_server is a single esbuild bundle; the only things it can't inline
# (native/platform-specific modules) still resolve via node_modules on the
# require() path, so we reuse the node_modules that was installed inside
# this same Linux builder rather than re-installing in an isolated stage.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/app/server/dist_server ./dist
COPY --from=builder /app/app/server/package.json ./package.json
COPY --from=builder /app/shared/package.json ./shared/package.json
# Static media assets referenced by cwd-relative paths at runtime: blank source
# video templates (voiceover-only exports), endscreen clips (UAT), the default
# watermark image, and caption fonts. The export pipeline fails without these.
COPY --from=builder /app/app/server/templates ./templates
COPY --from=builder /app/app/server/images ./images
COPY --from=builder /app/app/server/videos ./videos
COPY --from=builder /app/app/server/fonts ./fonts

EXPOSE 3021

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3021/api/health || exit 1

CMD ["node", "dist/index.js"]
