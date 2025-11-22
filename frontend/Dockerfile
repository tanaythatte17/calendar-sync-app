# ---------- STAGE 1: Build ----------
FROM node:18-alpine AS builder

WORKDIR /app

# Accept build-time arguments
ARG APP_API_URL

# Export as environment variables so Vite can read them during build
ENV VITE_API_URL=$APP_API_URL

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build


# ---------- STAGE 2: Serve via NGINX ----------
FROM nginx:alpine

# Copy build output to Nginx web root
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
