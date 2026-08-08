FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install -g npm@latest && npm ci --omit=dev

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 5000

USER node

CMD ["node", "server.js"]