FROM node:20-slim

RUN apt-get update && apt-get install -y python3 python3-pip && \
    pip3 install --break-system-packages ytmusicapi requests yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx vite build
CMD ["npx", "tsx", "server/index.ts"]
