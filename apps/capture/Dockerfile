FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/capture/package.json apps/capture/package.json

RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=3301
ENV HOSTNAME=0.0.0.0

RUN npm run build --workspace @advibe/capture

EXPOSE 3301

CMD ["npm", "run", "start", "--workspace", "@advibe/capture"]
