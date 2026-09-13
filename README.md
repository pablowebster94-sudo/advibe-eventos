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
