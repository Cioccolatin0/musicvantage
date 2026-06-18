# ---- Build frontend ----
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build

# ---- Production ----
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages ytmusicapi yt-dlp

RUN useradd -m -u 1001 user

WORKDIR /app

COPY --chown=user package*.json ./
USER user
RUN npm ci --omit=dev

USER root
COPY --chown=user server/ ./server/
COPY --chown=user shared/ ./shared/
COPY --chown=user routers.ts ./
COPY --chown=user db.ts ./
COPY --chown=user tsconfig.json ./
COPY --chown=user vite.config.ts ./
COPY --chown=user ytmusic_api.py ./
COPY --chown=user public/ ./public/
COPY --from=builder --chown=user /app/dist ./dist/

RUN chown -R user:user /app

USER user

EXPOSE 7860

ENV NODE_ENV=production
ENV PORT=7860

CMD ["npx", "tsx", "server/index.ts"]
