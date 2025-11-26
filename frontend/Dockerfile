# ---------- Stage 1: Build React app ----------
FROM node:18-alpine AS builder
WORKDIR /app

ARG APP_API_URL
ENV VITE_API_URL=$APP_API_URL

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build   # Produces dist/ folder

# ---------- Stage 2: Nginx to serve static files ----------
FROM nginx:alpine

# Copy build into Nginx html folder
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
