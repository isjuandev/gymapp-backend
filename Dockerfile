# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl and libc6-compat for Prisma engine on Alpine
RUN apk add --no-cache openssl libc6-compat

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY src/prisma ./src/prisma
RUN npx prisma generate

# Copy application source and configs
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Build the NestJS application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

# Stage 2: Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Install openssl for Prisma engine on Alpine runtime
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Copy build artifacts and production node_modules from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma ./src/prisma

# Use non-root node user
USER node

EXPOSE 3000

# Container healthcheck for Coolify / Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
