#!/bin/bash
# evento.sh - Día de evento: la galería vive en Railway y la PWA de captura corre
# en esta Mac. El celular abre la PWA por la Wi-Fi y las fotos van directo a Railway.
#
#   ./evento.sh
#
# Para otro backend: BACKEND_URL=https://otro.up.railway.app ./evento.sh

set -e
cd "$(dirname "$0")"

BACKEND_URL="${BACKEND_URL:-https://backend-production-09a24.up.railway.app}"
EVENT_SLUG="${EVENT_SLUG:-circuito-gualaceo}"
PORT=3301

# IP de la Mac en la Wi-Fi (en Linux, la primera de hostname -I).
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
[ -z "$IP" ] && IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$IP" ]; then
  echo "❌ No encontré la IP de esta Mac. ¿Está conectada a la Wi-Fi?"
  exit 1
fi

echo "⏳ Comprobando el servidor de Railway..."
if curl -fsS -m 15 "$BACKEND_URL/api/health" >/dev/null; then
  echo "✅ Railway responde"
else
  echo "⚠️  Railway no responde ($BACKEND_URL). Revisa el servicio backend antes de seguir."
fi

# La PWA lee la URL del backend en el build: se fija aquí para no depender
# de lo que hubiera en .env.local.
echo "NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL" > apps/capture/.env.local

if [ ! -d node_modules ]; then
  echo "⏳ Instalando dependencias (solo la primera vez)..."
  npm ci --no-audit --no-fund >/dev/null
fi

echo "⏳ Preparando la app de captura (tarda ~1 minuto)..."
npm run build --workspace @advibe/capture >/dev/null

cat <<MSG

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ LISTO

📱 En el Samsung (misma Wi-Fi que esta Mac), en Chrome:
   http://$IP:$PORT

🖼  Galería:  $BACKEND_URL/g/$EVENT_SLUG
🔳 QR:       $BACKEND_URL/api/events/$EVENT_SLUG/qr

Deja esta ventana abierta durante el evento. Para parar: Ctrl+C
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MSG

PORT=$PORT npm run start --workspace @advibe/capture
