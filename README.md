# AdVibe Eventos

Fotos de la cámara a una galería pública en vivo, sin portátil en el evento.

```
apps/backend    ingest, procesado, galería pública con SSE, QR   (:3300)
apps/capture    PWA "AdVibe Capture" que corre en el celular      (:3301)
tools/          mock de ingest para probar sin celular
docs/           compatibilidad Sony y contrato de ingest
```

Lee `docs/sony-integration.md` antes de tocar nada relacionado con la cámara:
la ZV-E10 original no la soporta el Camera Remote SDK, y eso define la
arquitectura entera.

## Arrancar en local

```bash
npm install
npm run db:push
npm run seed          # imprime el TOKEN del evento de prueba
npm run dev:backend   # :3300
npm run dev:capture   # :3301
```

El seed escupe un token. Ese token es el que se escribe en la PWA.

## Probar sin celular

```bash
node tools/mock-ingest.mjs --token <TOKEN> --count 3
```

Sube fotos sintéticas hablando el contrato real. La galería en
`http://localhost:3300/g/demo` las muestra aparecer sin recargar.

## Configuración

`apps/backend/.env`

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | SQLite del evento |
| `DATA_DIR` | dónde se escriben los JPG procesados |
| `PUBLIC_BASE_URL` | el dominio que se codifica en el QR |
| `ALLOWED_ORIGINS` | orígenes que pueden llamar al ingest (por defecto `*`) |

`apps/capture/.env.local`

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | backend al que sube la PWA |

Desde el celular `localhost` es el propio celular. La pantalla de login de la
PWA tiene un campo **Servidor** para apuntar a la IP del Mac o al túnel HTTPS
sin reconstruir nada.

## Límites conocidos

- El bus de SSE es **en memoria**: sirve para un solo proceso de backend. Con
  varias instancias haría falta Redis pub/sub.
- El Web Share Target necesita **HTTPS o localhost**. Por IP LAN en HTTP el
  service worker no se registra y compartir desde la galería no funciona; el
  botón de añadir fotos sí.
- El Web Share Target es de **Android/Chromium**. iOS no lo implementa: en
  iPhone se usa el botón de añadir fotos.
