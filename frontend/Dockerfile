# ---------- STAGE 1: Build ----------
FROM node:18-alpine AS builder

WORKDIR /app

ARG APP_API_URL
ENV VITE_API_URL=$APP_API_URL

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build


# ---------- STAGE 2: Run with a lightweight static server ----------
FROM node:18-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["serve", "-s", "dist", "-l", "0.0.0.0:8080"]
