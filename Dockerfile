FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx vite build
CMD ["npx", "tsx", "server/index.ts"]
