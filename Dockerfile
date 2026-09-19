FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 \
       make \
       g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/capture/package.json apps/capture/package.json

RUN npm ci

COPY apps/backend ./apps/backend
COPY apps/capture ./apps/capture

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

RUN npm run build --workspace @advibe/backend

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@advibe/backend"]
