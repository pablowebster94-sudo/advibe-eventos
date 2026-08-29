#!/bin/bash

# start-dev.sh - Inicia backend y PWA en dos terminales tmux

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
echo "===============================\n"
echo "📱 IP de tu Mac: $IP"
echo "\n✅ Backend:  http://$IP:3300"
echo "✅ PWA:      http://$IP:3301"
echo "✅ Galería:  http://localhost:3300/g/demo\n"
echo "En el Samsung usa:  http://$IP:3301\n"

# Crea sesión tmux
SESSION="advibe-dev"

if tmux has-session -t $SESSION 2>/dev/null; then
    echo "⚠️  Sesión $SESSION ya existe. Matando..."
    tmux kill-session -t $SESSION
fi

# Nueva sesión con 2 ventanas
tmux new-session -d -s $SESSION -n backend
tmux new-window -t $SESSION -n capture

# Backend en ventana 1
tmux send-keys -t $SESSION:backend "cd $(pwd) && npm run dev:backend" Enter
sleep 2

# PWA en ventana 2
tmux send-keys -t $SESSION:capture "cd $(pwd) && npm run dev:capture" Enter
sleep 2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Ambos servidores iniciados en tmux"
echo ""
echo "Para ver logs:"
echo "  tmux attach -t $SESSION:backend    # Backend"
echo "  tmux attach -t $SESSION:capture    # PWA"
echo ""
echo "Para matar todo:"
echo "  tmux kill-session -t $SESSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 Lee TESTING.md para pruebas en Samsung"
