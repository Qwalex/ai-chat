FROM node:24.13.1-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --production

FROM node:24.13.1-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/blog ./blog

RUN mkdir -p public/uploads logs

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/main.js"]
