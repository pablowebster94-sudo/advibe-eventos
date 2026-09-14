# AdVibe Eventos - Galería de Fotos en Vivo

MVP para capturar y distribuir fotos de eventos en tiempo real.

**Estado:** ✅ Build de producción verificado. Listo para testing en hardware.

## Inicio Rápido

```bash
cd ~/advibe-eventos
./start-dev.sh
```

Esto inicia backend y PWA automáticamente. Luego abre en Samsung:

```
http://TU_IP:3301
```

## Arquitectura

```
Sony ZV-E10 → Imaging Edge Mobile → Samsung Galaxy A16
  ↓ (Web Share Target)
PWA AdVibe Capture (3301)
  ↓ (POST /api/ingest)
Backend Next.js (3300)
  ↓ (SQLite + Sharp)
Galería pública (/g/demo)
```

## Testing en Samsung

Ver `TESTING.md` para instrucciones completas:

```bash
cat TESTING.md
```

**Resumen:**
1. `./start-dev.sh` en Mac
2. Chrome flag en Samsung: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
3. Abre `http://IP:3301` → Instala como PWA
4. Comparte foto desde Galería
5. Verifica en Mac: `http://localhost:3300/g/demo`

## Build Producción

```bash
# Backend
cd apps/backend && npm run build

# PWA
cd apps/capture && npm run build
```

Ambos compilan exitosamente sin errores.

## Stack

- **Backend:** Next.js 16 + SQLite + Sharp
- **PWA:** Next.js 16 + React 19 + Tailwind
- **Database:** SQLite con better-sqlite3
- **Offline:** IndexedDB + exponential backoff

## Base de Datos

SQLite en `./data/advibe.db`

**Evento demo:**
- Token: `KO00hH5dOHuh`
- Slug: `demo`
- ID: `demo-event-id`

## Crear un evento nuevo

Desde la propia aplicación, sin terminal: abre `/nuevo` en el backend, escribe la
clave de administración y el nombre del evento. La pantalla devuelve el **token**
que el operador teclea en la PWA, el enlace de la galería y su **QR** listo para
proyectar.

La creación va detrás de `ADMIN_TOKEN` (ver `apps/backend/.env.example`), un
credencial aparte del token de cada evento. **Si `ADMIN_TOKEN` no está
configurado, la creación queda cerrada** y responde `503`: un despliegue público
sin configurar no debe quedar como un formulario abierto donde cualquiera crea
eventos.

El token de un evento se muestra **una sola vez**, al crearlo. No hay endpoint
que lo liste después.

Equivalente por API:

```bash
curl -X POST https://TU_BACKEND/api/events \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Boda Ana y Luis","brandName":"AdVibe"}'
```

El `slug` es opcional: si falta, se deriva del nombre (`boda-ana-luis`).
`npm run seed` sigue existiendo para levantar el evento de prueba en local.

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|---|
| POST | `/api/events` | Bearer `ADMIN_TOKEN` | Crear evento |
| POST | `/api/ingest` | Bearer | Upload foto |
| GET | `/api/events/:slug/photos` | - | Listar fotos |
| GET | `/api/events/:slug/stream` | - | SSE updates |
| GET | `/api/events/:slug/qr` | - | QR generador |

---

Lee `TESTING.md` para testing en hardware.


## Producción sin llevar la Mac al evento

El despliegue es **Railway**, con dos servicios del mismo repositorio:

- **backend**: Next.js + SQLite + Sharp + almacenamiento de fotos.
- **capture**: PWA de captura.

El filesystem de un servicio de Railway es efímero: se pierde en cada redeploy.
La base SQLite y las fotos viven en un **Volume** montado en `/data`, y las dos
rutas se inyectan por variable de entorno (`DB_PATH` y `DATA_DIR`), nunca
hardcodeadas.

### Servicio backend

El build lo describe `railway.json` en la raíz del repositorio: builder
`DOCKERFILE` sobre el `Dockerfile` de la raíz (no el de `apps/backend/`, que
quedó del primer despliegue), healthcheck en `/api/health` y arranque con
`npm run start --workspace @advibe/backend`.

Volume montado en:

```
/data
```

Variables:

```
DB_PATH=/data/advibe.db
DATA_DIR=/data/media
PORT=3000
ADMIN_TOKEN=<una-clave-larga-privada>
PUBLIC_BASE_URL=https://TU-BACKEND.up.railway.app
ALLOWED_ORIGINS=https://TU-CAPTURE.up.railway.app
```

`PORT` va explícito para que el puerto del contenedor y el del dominio público
coincidan sin depender de autodetección: el `Dockerfile` hace `EXPOSE 3000`.

`lib/database.ts` acepta `DATABASE_PATH` o `DB_PATH`, y crea el directorio y el
esquema si no existen: un Volume recién montado y vacío arranca solo, sin
`prisma db push` ni ningún paso manual. `ALLOWED_ORIGINS` es opcional; si falta,
el CORS del ingest queda abierto (`*`).

Desde cero con el CLI, un comando por línea (zsh interactivo en macOS no
interpreta `#` como comentario, así que estas líneas no llevan ninguno):

```
railway init --name advibe-eventos
railway add --service backend
railway volume add --service backend --mount-path /data
railway variables --service backend --set "DB_PATH=/data/advibe.db" --set "DATA_DIR=/data/media" --set "PORT=3000" --set "ADMIN_TOKEN=$ADMIN_TOKEN"
railway up --detach --service backend
railway domain --service backend --port 3000
railway variables --service backend --set "PUBLIC_BASE_URL=https://EL-DOMINIO.up.railway.app"
railway up --detach --service backend
```

El segundo `railway up` es necesario: `PUBLIC_BASE_URL` sólo se conoce después
de generar el dominio, y de ella salen las URLs de galería y QR.

Comprobación de que el contenedor arrancó, el Volume montó y el esquema se creó:

```
curl -s https://EL-DOMINIO.up.railway.app/api/health
```

### Alta del evento en producción

```
curl -s -X POST https://EL-DOMINIO.up.railway.app/api/events -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"slug":"ruta-iglesias","name":"Ruta de las Iglesias - Beer Run 5K"}'
```

Devuelve `id`, `slug`, `token`, `galleryUrl` y `qrUrl`. El `token` se devuelve
**una sola vez**, al crear el evento: no hay endpoint que lo liste después. Es
lo que se teclea en la PWA de captura y lo que se configura en la app Flutter.

Omitir `brandName` lo guarda como NULL, que es lo que se quiere cuando el sello
sobre la foto es el logo del evento (`apps/backend/brand/logo-opt.png`) y no un
texto: `lib/photos.ts` usa el logo si existe y sólo cae al texto si no lo hay.

### Servicio capture

Dockerfile: `apps/capture/Dockerfile`, configurado en los ajustes del servicio.

Variable:

```
NEXT_PUBLIC_BACKEND_URL=https://TU-BACKEND.up.railway.app
```

Después genera el dominio público del servicio capture.

### Flujo final

```
Sony ZV-E10
   ↓
Imaging Edge Mobile
   ↓
Samsung Galaxy A16
   ↓
AdVibe Capture (Internet)
   ↓
Backend AdVibe
   ↓
/data  ← Volume persistente
   ├── advibe.db
   └── media/
   ↓
Galería pública + QR
```

**No se necesita ninguna API de IA para AdVibe Eventos.**

La Mac puede estar apagada durante el evento. El Samsung solo necesita Internet.

El `ADMIN_TOKEN` sirve exclusivamente para crear eventos y nunca debe publicarse. El token de cada evento es la credencial que autoriza las subidas.
