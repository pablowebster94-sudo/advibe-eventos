FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/capture/package.json apps/capture/package.json

RUN npm ci

COPY apps/backend ./apps/backend
COPY apps/capture ./apps/capture

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Build the backend workspace
RUN npm run build --workspace @advibe/backend

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@advibe/backend"]

