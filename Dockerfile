# Build stage
FROM node:23-alpine AS builder

# Add build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and TypeScript config
COPY package.json yarn.lock tsconfig.json ./

# Copy TypeScript source files
COPY *.ts ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Build application
RUN yarn compile && yarn build

# Production stage
FROM node:23-alpine
RUN apk add --no-cache curl

# Add security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/yarn.lock ./

# Set production environment
ENV NODE_ENV=production \
    MARIADB_HOST=127.0.0.1 \
    MARIADB_PORT=3306 \
    MARIADB_USER=root \
    MARIADB_PASS=test_password \
    MARIADB_DB=test_db \
    LOG_LEVEL=info

# Install only production dependencies
RUN yarn install --production --frozen-lockfile

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${PORT}/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Set entry command
CMD ["node", "dist/index.js"]
