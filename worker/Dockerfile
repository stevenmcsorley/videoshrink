# Worker Service Dockerfile
FROM node:20-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

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

# Expose no ports (worker doesn't need HTTP)

# Run worker
CMD ["npm", "run", "start"]
