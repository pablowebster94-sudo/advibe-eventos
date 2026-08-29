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

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|---|
| POST | `/api/ingest` | Bearer | Upload foto |
| GET | `/api/events/:slug/photos` | - | Listar fotos |
| GET | `/api/events/:slug/stream` | - | SSE updates |
| GET | `/api/events/:slug/qr` | - | QR generador |

---

Lee `TESTING.md` para testing en hardware.
