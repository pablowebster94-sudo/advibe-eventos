# Build stage
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install root dependencies (monorepo setup)
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/capture/package.json apps/capture/package.json

RUN npm ci

# Copy source code
COPY apps/backend ./apps/backend
COPY apps/capture ./apps/capture

# Build backend (next.js build needs to run in its directory context)
WORKDIR /app/apps/backend
RUN npm run build

# Runtime stage
FROM node:22-bookworm-slim

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/apps/capture ./apps/capture
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3300

EXPOSE 3300

# Run from root, use workspace to start backend
CMD ["npm", "run", "start", "--workspace", "@advibe/backend"]

