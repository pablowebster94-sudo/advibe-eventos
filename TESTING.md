# Prueba End-to-End en Samsung Galaxy A16

## REQUISITOS

- MacBook (servidor) con repositorio clonado
- Samsung Galaxy A16 con Chrome instalado
- Ambos en la MISMA RED WiFi
- Sony ZV-E10 con Imaging Edge Mobile (o foto JPEG para simular)

## PASO 1: OBTÉN LA IP DE TU MAC

Terminal en Mac:

```bash
ifconfig | grep "inet 192"
```

Anota algo como `inet 192.168.1.7`.

## PASO 2: INICIA LOS SERVIDORES

Terminal en Mac:

```bash
cd ~/advibe-eventos  # O dónde hayas clonado
./start-dev.sh
```

Espera a ver:
```
✨ Ambos servidores iniciados en tmux
Backend:  http://192.168.1.7:3300
PWA:      http://192.168.1.7:3301
```

## PASO 3: CONFIGURA CHROME EN SAMSUNG

En Samsung Galaxy A16:

1. Abre Chrome
2. Ve a: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
3. En el campo de texto pega:
   ```
   http://192.168.1.7:3301,http://192.168.1.7:3300
   ```
4. Selecciona "Enabled"
5. Toca "Relaunch"

## PASO 4: ABRE LA PWA

En Chrome del Samsung:

```
http://192.168.1.7:3301
```

## PASO 5: INSTALA COMO PWA

En Chrome (3 puntos arriba-derecha):
1. "Instalar aplicación"
2. Confirmar

## PASO 6: COMPARTE UNA FOTO

### Opción A: Usando Imaging Edge Mobile + Sony ZV-E10

1. Conecta ZV-E10 → Imaging Edge Mobile descarga foto
2. Galería → Compartir → AdVibe Capture
3. Token: `KO00hH5dOHuh`
4. Server: `http://192.168.1.7:3300`
5. Upload

### Opción B: Simular con foto local (rápido)

1. Descarga una foto al Samsung (Telegram, email, etc.)
2. Galería → Compartir → AdVibe Capture
3. Token: `KO00hH5dOHuh`
4. Server: `http://192.168.1.7:3300`
5. Upload

## PASO 7: VERIFICA EN LA MAC

Abre en navegador:

```
http://localhost:3300/g/demo
```

✅ Deberías ver la foto que subiste.

## PASO 8: VERIFICA SSE (EN VIVO)

1. Mantén abierto `http://localhost:3300/g/demo` en la Mac
2. Sube otra foto desde Samsung
3. La galería se actualiza SIN recargar

✅ Si aparece sola, SSE funciona.

## PASO 9: VERIFICA DEDUPLICACIÓN

1. Intenta subir la MISMA foto dos veces
2. Debería rechazar la segunda como "duplicada"

✅ Si ves "duplicate: true", la deduplicación funciona.

## TROUBLESHOOTING

**"Connection refused"**
```bash
# Verifica IP
ifconfig | grep "inet 192"

# Verifica backend
curl http://localhost:3300
```

**Chrome no acepta flag**
- Desinstala app de Samsung
- Limpia caché de Chrome
- Reinstala

**Foto no sube**
- Verifica que backend muestre: `POST /api/ingest 200`
- Prueba manual:
```bash
curl -X POST http://localhost:3300/api/ingest \
  -H "Authorization: Bearer KO00hH5dOHuh" \
  -F "photo=@foto.jpg;type=image/jpeg" \
  -F "eventId=demo-event-id" \
  -F "idempotencyKey=$(uuidgen)" \
  -F "clientId=samsung-test"
```

## CHECKLIST

```
[ ] IP local obtenida (192.168.x.x)
[ ] start-dev.sh ejecutado
[ ] Chrome flag configurada en Samsung
[ ] PWA instalada en Samsung
[ ] Foto subida desde Samsung
[ ] Foto visible en http://localhost:3300/g/demo
[ ] SSE funciona (actualización en vivo)
[ ] Deduplicación funciona (rechazo de duplicado)
```

Si todo ✅, MVP funciona.

## PRÓXIMO

- Prueba con 100+ fotos en evento real
- Simula WiFi intermitente
- Verifica que cola offline reintente
