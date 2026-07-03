FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY shared/package.json ./shared/
COPY app/client/package.json ./app/client/
COPY app/server/package.json ./app/server/

RUN corepack enable && yarn install --mode=skip-build

COPY shared/ ./shared/
COPY app/client/ ./app/client/

WORKDIR /app/app/client
RUN yarn build

FROM node:20-alpine

RUN npm install -g serve

WORKDIR /app

COPY --from=builder /app/app/client/dist ./dist

EXPOSE 3011

CMD ["serve", "-s", "dist", "-l", "3011"]
