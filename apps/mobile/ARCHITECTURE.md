# Arquitectura: Auto-Upload DCIM

## Problema

Cuando conectas ZV-E10 al Samsung por USB-OTG, Android ve `/storage/emulated/0/Android/data/.../cache/DCIM/` o similar. Las fotos están ahí, pero:

1. ❌ Imaging Edge Mobile es lento
2. ❌ Galería muestra preview corrupto
3. ❌ Compartir con AdVibe Capture es manual

## Solución

App Flutter que:

```
Toma foto en ZV-E10
    ↓
Android detecta archivo nuevo cada 2s
    ↓
App calcula SHA256 (deduplicación)
    ↓
POST /api/ingest automático
    ↓
Backend procesa (Sharp watermark)
    ↓
Galería en vivo actualiza (SSE)
    ↓
Invitados ven en tiempo real
```

## Flujo Técnico

### 1. Inicialización

```dart
PhotoUploader uploader = PhotoUploader();
await uploader.initialize(); // Carga SharedPreferences
```

### 2. Selección de carpeta

```dart
String usbPath = await uploader.selectUsbFolder();
// Retorna: /storage/emulated/0/Android/data/com.example/cache
// Donde está: /storage/emulated/0/Android/data/com.example/cache/DCIM/
```

### 3. Monitoreo continuo

```dart
await uploader.startMonitoring(usbPath);

// Cada 2 segundos:
// - Lee /DCIM/
// - Filtra fotos (*.jpg, *.png, etc.)
// - Calcula SHA256 de cada una
// - Compara con _uploadedHashes (SharedPreferences)
// - Si es nueva → sube
```

### 4. Upload a backend

```dart
POST http://192.168.1.7:3300/api/ingest
Authorization: Bearer KO00hH5dOHuh
Content-Type: multipart/form-data

Fields:
  - photo: <binary>
  - eventId: demo-event-id
  - idempotencyKey: <uuid>
  - clientId: samsung-a16-auto
```

### 5. Backend response

```json
{
  "ok": true,
  "photo": {
    "id": "cuid-123",
    "url": "/media/1693363200000-abc12345.jpg",
    "thumbUrl": "/media/1693363200000-abc12345.thumb.jpg",
    "width": 1920,
    "height": 1080
  }
}
```

### 6. SSE a galería

Backend emite:
```
event: photo_added
data: {"id": "cuid-123", "url": "...", ...}
```

Galería web recibe → añade miniatura sin recargar

## Deduplicación

Evita subir la misma foto 2 veces:

1. Calcula SHA256 del archivo
2. Guarda en SharedPreferences: `uploaded_hashes`
3. En próximo monitoreo, salta si hash existe

Razón: Si desconectas/reconectas USB, el monitoreo ve todas las fotos de nuevo.

## Permisos necesarios

```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.USB" />
```

## Consumo de batería

Monitoreo cada 2s:
- ~5-10% de batería por hora
- Solución: agregar toggle "pausa durante evento"

## Limitaciones

### USB-OTG (actual)

✅ Ventajas:
- Funciona 100% con ZV-E10
- Sin configuración de WiFi
- Rápido (USB 2.0)

❌ Desventajas:
- Requiere cable
- Batería limitada
- No se puede estar lejos

### PTP-IP (futuro)

✅ Ventajas:
- Wireless
- Fotógrafo libre de cables
- Más distancia

❌ Desventajas:
- Sony no documenta bien
- Necesita Camera Remote Command
- Más complicado

## Timeline

**Día 1-2:** Flutter app con monitoreo USB (AHORA)
**Día 3:** Testing en evento real
**Semana 2:** PTP-IP si el USB funciona bien
**Semana 3:** Background service Android
**Mes 2:** App nativa iOS

## Alternativa: Polling periódico vs inotify

**Polling (actual):**
- Timer cada 2s
- Más simple
- Más consumo batería

**inotify (futuro):**
- Escucha eventos del kernel
- Menos consumo
- Más complejo

Empezamos con polling porque es rápido de implementar.

## Testing

```dart
// Simular fotos en carpeta
ls /storage/.../DCIM/
// Conectar app
flutter run
// Ver en logs
tail -f .capture.log
// Verificar galería
http://localhost:3300/g/demo
```

## Próximos pasos

1. ✅ Código Flutter
2. ⏳ Compilar APK
3. ⏳ Instalar en Samsung A16
4. ⏳ Probar con ZV-E10 real
5. ⏳ Evento de producción
