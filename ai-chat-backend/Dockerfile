FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 build-base
ENV npm_config_python=/usr/bin/python3

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --production

FROM node:24-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/blog ./blog

RUN mkdir -p public/uploads logs

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/main.js"]
