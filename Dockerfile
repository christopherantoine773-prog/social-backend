FROM node:18

# Installation de ffmpeg et python3 pour yt-dlp
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip && \
    pip3 install --break-system-packages yt-dlp

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
