#!/bin/bash

# start-dev.sh - Inicia backend y PWA sin dependencias externas

set -e

cd "$(dirname "$0")"

# Verifica que npm install esté hecho
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules no encontrado. Ejecuta: npm install"
    exit 1
fi

# Obtén IP local
IP=$(ifconfig 2>/dev/null | grep "inet 192" | head -1 | awk '{print $2}' || echo "")

if [ -z "$IP" ]; then
    echo "❌ No se encontró IP 192.168.x.x en tu red"
    echo "Verifica que estés conectado a WiFi"
    exit 1
fi

echo "🚀 AdVibe Eventos - Dev Servers"
echo "═══════════════════════════════\n"
echo "📱 IP de tu Mac: $IP"
echo "\n✅ Backend:  http://$IP:3300"
echo "✅ PWA:      http://$IP:3301"
echo "✅ Galería:  http://localhost:3300/g/demo\n"
echo "En el Samsung usa:  http://$IP:3301\n"

# Cleanup en caso de cierre
cleanup() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🛑 Deteniendo servidores..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $PWA_PID 2>/dev/null || true
    echo "✅ Servidores detenidos"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Registra trap para limpiar al salir
trap cleanup EXIT INT TERM

# Inicia backend en background
echo "⏳ Iniciando Backend (npm run dev:backend)..."
npm run dev:backend > .backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

# Inicia PWA en background
echo "⏳ Iniciando PWA (npm run dev:capture)..."
npm run dev:capture > .capture.log 2>&1 &
PWA_PID=$!
sleep 3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Ambos servidores iniciados en background"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "PWA PID:    $PWA_PID"
echo ""
echo "Logs:"
echo "  tail -f .backend.log   # Backend logs"
echo "  tail -f .capture.log   # PWA logs"
echo ""
echo "Para detener: Presiona Ctrl+C"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 Lee TESTING.md para pruebas en Samsung"
echo ""

# Espera a que ambos procesos terminen
wait $BACKEND_PID 2>/dev/null || true
wait $PWA_PID 2>/dev/null || true
