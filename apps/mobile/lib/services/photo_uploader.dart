import 'package:flutter/foundation.dart';
import 'package:file_picker/file_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'dart:io';
import 'dart:async';
import 'package:logger/logger.dart';
import 'package:uuid/uuid.dart';

class PhotoUploader extends ChangeNotifier {
  final logger = Logger();
  late SharedPreferences _prefs;

  String serverUrl = 'https://backend-production-8a2a.up.railway.app';
  String eventToken = 'MmiZ8Ar9QBbO';
  String eventId = 'cmtp9fckd0000mx45al5u3vu6';

  int photosInQueue = 0;
  int photosUploaded = 0;
  bool isMonitoring = false;
  String? lastError;

  Timer? _monitoringTimer;
  Set<String> _uploadedHashes = {};
  final Set<String> _seenKeys = {};

  @override
  void dispose() {
    _monitoringTimer?.cancel();
    super.dispose();
  }

  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
    _loadUploadedHashes();
  }

  void _loadUploadedHashes() {
    final hashes = _prefs.getStringList('uploaded_hashes') ?? [];
    _uploadedHashes = hashes.toSet();
  }

  Future<void> _saveUploadedHash(String hash) async {
    _uploadedHashes.add(hash);
    await _prefs.setStringList('uploaded_hashes', _uploadedHashes.toList());
  }

  Future<void> startMonitoring(String usbPath) async {
    if (isMonitoring) {
      logger.w('Monitoring already active');
      return;
    }

    isMonitoring = true;
    logger.i('Started monitoring: $usbPath');
    notifyListeners();

    _monitoringTimer = Timer.periodic(Duration(seconds: 2), (_) async {
      await _checkForNewPhotos(usbPath);
    });
  }

  Future<void> stopMonitoring() async {
    _monitoringTimer?.cancel();
    isMonitoring = false;
    logger.i('Stopped monitoring');
    notifyListeners();
  }

  /// Resuelve la carpeta a vigilar: si hay un DCIM adentro lo usa,
  /// si no, usa la carpeta tal cual fue seleccionada.
  Directory _resolveWatchDir(String usbPath) {
    final withDcim = Directory('$usbPath/DCIM');
    if (withDcim.existsSync()) return withDcim;
    return Directory(usbPath);
  }

  Future<void> _checkForNewPhotos(String usbPath) async {
    try {
      final watchDir = _resolveWatchDir(usbPath);

      if (!watchDir.existsSync()) {
        logger.w('Watch folder not found: ${watchDir.path}');
        return;
      }

      final photos = watchDir
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => _isPhotoFile(f.path))
          .toList();

      for (final photo in photos) {
        // Filtro barato antes de hashear: ruta + tamano + fecha
        final stat = photo.statSync();
        final key = '${photo.path}|${stat.size}|${stat.modified.millisecondsSinceEpoch}';
        if (_seenKeys.contains(key)) continue;

        final hash = await _calculateFileHash(photo);
        if (_uploadedHashes.contains(hash)) continue;

        logger.i('New photo detected: ${photo.path}');
        await _uploadPhoto(photo, hash);
      }
    } catch (e) {
      lastError = e.toString();
      logger.e('Error checking photos: $e');
      notifyListeners();
    }
  }

  Future<void> _uploadPhoto(File photo, String hash) async {
    try {
      photosInQueue++;
      notifyListeners();

      final idempotencyKey = const Uuid().v4();
      final bytes = await photo.readAsBytes();

      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$serverUrl/api/ingest'),
      );

      request.headers['Authorization'] = 'Bearer $eventToken';
      request.fields['eventId'] = eventId;
      request.fields['idempotencyKey'] = idempotencyKey;
      request.fields['clientId'] = 'samsung-a16-auto';
      final fname = photo.path.split('/').last;
      final lower = fname.toLowerCase();
      final mime = lower.endsWith('.png')
          ? 'image/png'
          : lower.endsWith('.webp')
              ? 'image/webp'
              : lower.endsWith('.heic')
                  ? 'image/heic'
                  : 'image/jpeg';
      request.files.add(http.MultipartFile.fromBytes(
        'photo',
        bytes,
        filename: fname,
        contentType: MediaType.parse(mime),
      ));

      final response = await request.send();

      if (response.statusCode == 200 || response.statusCode == 201) {
        await _saveUploadedHash(hash);
        _seenKeys.add(_keyFor(photo));
        photosUploaded++;
        logger.i('Photo uploaded: ${photo.path}');
      } else {
        final body = await response.stream.bytesToString();
        logger.e('Upload failed: ${response.statusCode} $body');
        lastError = 'Upload failed: ${response.statusCode} $body';
      }

      photosInQueue--;
      notifyListeners();
    } catch (e) {
      photosInQueue--;
      lastError = e.toString();
      logger.e('Error uploading photo: $e');
      notifyListeners();
    }
  }

  String _keyFor(File f) {
    final st = f.statSync();
    return '${f.path}|${st.size}|${st.modified.millisecondsSinceEpoch}';
  }

  Future<String> _calculateFileHash(File file) async {
    final bytes = await file.readAsBytes();
    return sha256.convert(bytes).toString();
  }

  bool _isPhotoFile(String path) {
    final name = path.split('/').last.toLowerCase();
    // Ignora archivos ocultos y los que Android aun esta escribiendo
    if (name.startsWith('.') || name.contains('.pending-')) return false;
    if (name.endsWith('.arw') || name.endsWith('.raw') || name.endsWith('.dng')) return false;
    return name.endsWith('.jpg') || name.endsWith('.jpeg') ||
           name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.heic');
  }

  Future<String?> selectUsbFolder() async {
    final result = await FilePicker.getDirectoryPath();
    return result;
  }
}
