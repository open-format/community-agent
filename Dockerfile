# syntax = docker/dockerfile:1

# Adjust BUN_VERSION as desired
ARG BUN_VERSION=1.2.5
FROM --platform=$BUILDPLATFORM node:lts-slim AS base
WORKDIR /app

# Install only the essential build dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential python3 make && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install bun globally
RUN npm i -g bun

# Copy package files
COPY package.json bun.lockb ./

# Install ALL dependencies for development
RUN bun install

# Copy application code
COPY . .

# Production stage
FROM base AS prod
RUN bun install --production

# Use the slim bun image for runtime
FROM oven/bun:${BUN_VERSION}-slim AS runtime
WORKDIR /app

# Copy built files and production dependencies
COPY --from=prod /app/node_modules node_modules
COPY . .

# Set production environment
ENV NODE_ENV="production"

# Expose the port and start the server
EXPOSE 8080
CMD [ "bun", "run", "start" ]
