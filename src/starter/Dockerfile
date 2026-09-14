# syntax=docker/dockerfile:1
# Stage 1: build the static app.
FROM node:22-alpine AS build
WORKDIR /app
ENV npm_config_fund=false npm_config_audit=false npm_config_update_notifier=false
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve dist/ with Caddy. No Node, no build tools, no source in the final image.
FROM caddy:2-alpine
# Origins the page may call (Content-Security-Policy connect-src). Override at runtime, see docker-compose.yml.
ENV CONNECT_SRC="http://localhost:11434 http://127.0.0.1:11434 http://localhost:8080 http://127.0.0.1:8080"
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
EXPOSE 8080
