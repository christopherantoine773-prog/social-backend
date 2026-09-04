FROM node:18-slim

RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

RUN npm init -y && npm install express cors

# Copie tout le contenu du dépôt
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
