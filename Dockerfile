FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip py3-requests py3-cryptography py3-click py3-brotli ffmpeg
RUN ln -sf /usr/bin/python3 /usr/bin/python
RUN pip3 install --break-system-packages ytmusicapi yt-dlp

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN NODE_ENV=production npx vite build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["npx", "tsx", "server/index.ts"]
