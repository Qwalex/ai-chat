FROM node:24.13-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY public ./public
COPY blog ./blog

EXPOSE 3000

CMD ["node", "server.js"]
