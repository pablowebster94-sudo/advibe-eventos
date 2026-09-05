import 'package:flutter/foundation.dart';
import 'package:file_picker/file_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'dart:io';
import 'dart:async';
import 'package:logger/logger.dart';
import 'package:uuid/uuid.dart';

class PhotoUploader extends ChangeNotifier {
  final logger = Logger();
  late SharedPreferences _prefs;

  String serverUrl = 'http://192.168.1.7:3300';
  String eventToken = 'KO00hH5dOHuh';
  String eventId = 'cmt42cyva0000gs240hil9f9l';

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
        _seenKeys.add(key);

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
      request.files.add(http.MultipartFile.fromBytes(
        'photo',
        bytes,
        filename: photo.path.split('/').last,
      ));

      final response = await request.send();

      if (response.statusCode == 200 || response.statusCode == 201) {
        await _saveUploadedHash(hash);
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
      lastError = e.toString();
      logger.e('Error uploading photo: $e');
      notifyListeners();
    }
  }

  Future<String> _calculateFileHash(File file) async {
    final bytes = await file.readAsBytes();
    return sha256.convert(bytes).toString();
  }

  bool _isPhotoFile(String path) {
    final extensions = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
    final ext = path.split('.').last.toLowerCase();
    return extensions.contains(ext);
  }

  Future<String?> selectUsbFolder() async {
    final result = await FilePicker.getDirectoryPath();
    return result;
  }
}
