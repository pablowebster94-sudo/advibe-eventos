# AdVibe Auto Upload

App Flutter para detectar y subir automáticamente fotos de la ZV-E10 a través de USB.

## Características

- ✅ Detección automática de fotos en carpeta USB
- ✅ Auto-upload sin intervención manual
- ✅ Deduplicación por SHA256
- ✅ Monitoreo cada 2 segundos
- ✅ Contador de fotos en cola/subidas
- ✅ Configuración de servidor y token

## Requisitos

- Flutter 3.0+
- Android 10+ (para USB OTG host)
- Samsung Galaxy A16 (u otro dispositivo Android)
- Cable USB-OTG

## Instalación

```bash
cd apps/mobile
flutter pub get
flutter run
```

## Cómo usar

1. Conecta ZV-E10 al Samsung con cable USB-OTG
2. Abre la app
3. Ingresa:
   - Backend Server: `http://192.168.1.7:3300`
   - Event Token: `KO00hH5dOHuh`
4. Selecciona carpeta USB (donde está DCIM/)
5. Click en "Start Monitoring"
6. Toma fotos con ZV-E10
7. Las fotos aparecen automáticamente en la galería

## Arquitectura

### Servicio Principal: `PhotoUploader`

- **startMonitoring(path)** - Inicia monitoreo cada 2s
- **_checkForNewPhotos(path)** - Detecta fotos nuevas
- **_uploadPhoto(file, hash)** - Sube a backend
- **_calculateFileHash(file)** - SHA256 para deduplicación
- **_saveUploadedHash(hash)** - Guarda en SharedPreferences

### Flow de datos

```
ZV-E10 (USB)
    ↓
Samsung (Android)
    ↓
PhotoUploader (monitoreo cada 2s)
    ↓
Detecta nueva foto
    ↓
Calcula SHA256
    ↓
Verifica si ya se subió
    ↓
POST /api/ingest
    ↓
Backend procesa
    ↓
SQLite guarda
    ↓
Galería en vivo actualiza (SSE)
```

## Dependencias

- `file_picker: ^8.0.0` - Seleccionar carpeta
- `permission_handler: ^11.4.0` - Permisos
- `usb_serial: ^0.4.0` - Detección USB (opcional)
- `http: ^1.1.0` - Requests al backend
- `shared_preferences: ^2.0.0` - Almacén local
- `crypto: ^3.0.0` - SHA256
- `logger: ^2.0.0` - Logging
- `provider: ^6.0.0` - State management

## Configuración

Edita `lib/services/photo_uploader.dart`:

```dart
String serverUrl = 'http://192.168.1.7:3300';
String eventToken = 'KO00hH5dOHuh';
String eventId = 'demo-event-id';
```

## Build para producción

```bash
flutter build apk --release
```

## Limitaciones actuales

- Solo Android (Flutter Android es suficiente)
- Requiere USB-OTG (no wireless)
- Monitoreo cada 2 segundos (consumo de batería)

## Próximos pasos

- [ ] PTP-IP (wireless)
- [ ] Background service (Android)
- [ ] Notificaciones push
- [ ] Interfaz mejorada
- [ ] App nativa iOS

## Troubleshooting

**"DCIM folder not found"**
- Verifica que seleccionaste la carpeta raíz del USB
- Debería ver carpetas como "DCIM", "Misc", etc.

**"Upload failed: 401"**
- Verifica token en configuración
- Verifica que backend esté corriendo

**"USB not detected"**
- Usa cable USB-OTG de calidad
- Reinicia app
- Reconecta USB

## Licencia

MIT - AdVibe
