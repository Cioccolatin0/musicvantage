FROM node:20-slim
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip3 install --break-system-packages ytmusicapi yt-dlp
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx vite build
CMD ["npx", "tsx", "server/index.ts"]
