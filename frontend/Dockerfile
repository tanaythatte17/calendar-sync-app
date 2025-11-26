# ---------- STAGE 1: Build ----------
FROM node:18-alpine AS builder

WORKDIR /app

ARG APP_API_URL
ENV VITE_API_URL=$APP_API_URL

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ---------- STAGE 2: Output build artifacts ----------
FROM alpine:3.18

WORKDIR /output

COPY --from=builder /app/dist ./dist

# This container does NOT run a server – it only provides the built files.
CMD ["sh", "-c", "cp -r dist /output"]
