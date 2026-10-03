# Imagen completa, no -slim: better-sqlite3 13 se compila siempre desde el código
# fuente (no trae binarios precompilados) y necesita python3, make y g++.
FROM node:22-bookworm

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/capture/package.json apps/capture/package.json

RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=3300
ENV HOSTNAME=0.0.0.0

RUN npm run build --workspace @advibe/backend

EXPOSE 3300

CMD ["npm", "run", "start", "--workspace", "@advibe/backend"]
