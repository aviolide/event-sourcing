############################
# 1) Dependencies stage
############################
FROM node:22-alpine AS deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile


############################
# 2) Build stage
############################
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build


############################
# 3) Production dependencies
############################
FROM node:22-alpine AS prod-deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod


############################
# 4) Runtime
############################
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER app

CMD ["node", "dist/main.js"]
