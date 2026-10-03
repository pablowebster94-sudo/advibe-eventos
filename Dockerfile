# Imagen completa, no -slim: better-sqlite3 13 se compila siempre desde el código
# fuente (no trae binarios precompilados) y necesita python3, make y g++.
FROM node:22-bookworm

WORKDIR /app

# Un solo Dockerfile para los dos servicios de Railway (railway.json apunta aquí):
# el backend usa el valor por defecto y el servicio de captura define APP=capture.
ARG APP=backend
# Next incrusta NEXT_PUBLIC_* en el bundle durante el build, y Railway solo pasa
# las variables del servicio al build si están declaradas con ARG.
ARG NEXT_PUBLIC_BACKEND_URL
ENV APP=$APP
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/capture/package.json apps/capture/package.json

RUN npm ci

COPY apps/backend ./apps/backend
COPY apps/capture ./apps/capture

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

RUN npm run build --workspace @advibe/$APP

CMD npm run start --workspace @advibe/$APP
