############################
# 1) Dependencies stage
# - Installs all dependencies (including dev)
# - Optimized for layer caching
############################
FROM node:22-alpine AS deps

# Set working directory
WORKDIR /app

# Enable Corepack to use pnpm
RUN corepack enable

# Copy only dependency manifests
# This allows Docker to cache pnpm install
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (dev + prod)
RUN pnpm install --frozen-lockfile


############################
# 2) Build stage
# - Compiles TypeScript to dist/
############################
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

# Reuse node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the NestJS application
RUN pnpm run build


############################
# 3) Production dependencies stage
# - Installs only production dependencies
# - Reduces final image size
############################
FROM node:22-alpine AS prod-deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod


############################
# 4) Runtime (final) stage
# - Minimal image
# - Runs as non-root user
############################
FROM node:22-alpine AS runner

WORKDIR /app

# Explicitly set production mode
ENV NODE_ENV=production

# Create non-root user (security best practice)
RUN addgroup -S app && adduser -S app -G app

# Copy only what is strictly necessary
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Switch to non-root user
USER app

# Start the application
CMD ["node", "dist/main.js"]
