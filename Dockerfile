FROM node:24.13-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY public ./public
COPY blog ./blog
COPY utils ./utils

EXPOSE 3000

CMD ["node", "server.js"]
