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

# Next incrusta NEXT_PUBLIC_* en el bundle durante el build, y Railway solo pasa
# las variables del servicio al build de un Dockerfile si están declaradas con ARG.
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

RUN npm run build --workspace @advibe/capture

EXPOSE 3301

CMD ["npm", "run", "start", "--workspace", "@advibe/capture"]
