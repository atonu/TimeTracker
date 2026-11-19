# syntax=docker/dockerfile:1

# The install and the Next.js build always run natively on the build machine (BUILDPLATFORM).
# Building under arm64 emulation crashes (qemu: Illegal instruction), and the output is plain JavaScript,
# so the same build can be used for both amd64 and arm64 images. Only the small final stage runs per target.
FROM --platform=$BUILDPLATFORM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Public address of the site (used for share-preview links). Set with --build-arg.
ARG NEXT_PUBLIC_SITE_URL=https://tickwell.atonu.online
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/.data
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
# Rooms are saved here when no MONGODB_URI is set (mount a volume to keep them)
RUN mkdir -p /app/.data && chown app:app /app/.data
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/manifest.webmanifest >/dev/null || exit 1
CMD ["node", "server.js"]
