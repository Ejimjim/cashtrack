FROM node:22-alpine AS dashboard-builder
WORKDIR /dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ .
RUN npm run build

FROM node:22-alpine AS app
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ .
COPY --from=dashboard-builder /dashboard/dist ./public
RUN chmod +x start.sh
CMD ["sh", "start.sh"]
