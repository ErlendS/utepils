# syntax = docker/dockerfile:1

ARG NODE_VERSION=24.14.1
ARG PNPM_VERSION=11.0.9
FROM node:${NODE_VERSION}-trixie-slim AS base


WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN npm install -g pnpm@${PNPM_VERSION}

FROM base AS deps

RUN apt-get update -qq \
  && apt-get install --no-install-recommends -y ca-certificates git build-essential node-gyp pkg-config python-is-python3 \
  && rm -rf /var/lib/apt/lists/*

COPY --link pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --prod --frozen-lockfile

COPY --link package.json ./
RUN pnpm install --prod --frozen-lockfile --offline

FROM base AS final

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json server.ts ./
COPY --chown=node:node app ./app
COPY --chown=node:node public ./public

USER node

EXPOSE 3000

CMD ["pnpm", "run", "start"]
