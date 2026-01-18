# Backend Dockerfile - Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Install FFmpeg tools for ffprobe
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install FFmpeg tools for ffprobe
RUN apk add --no-cache ffmpeg

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma

# Install production dependencies only
RUN npm ci --only=production

# Generate Prisma Client in production stage
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]
