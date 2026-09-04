FROM node:18-slim

# Installation de ffmpeg et yt-dlp
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Installation de express et cors directement
RUN npm init -y && npm install express cors

COPY server.js .

EXPOSE 3000
CMD ["node", "server.js"]
