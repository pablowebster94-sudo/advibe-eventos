import 'dart:async';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

@pragma('vm:entry-point')
void startCallback() {
  FlutterForegroundTask.setTaskHandler(UploadTaskHandler());
}

class UploadTaskHandler extends TaskHandler {
  String _serverUrl = '';
  String _eventToken = '';
  String _eventId = '';
  String _watchPath = '';

  int _uploaded = 0;
  int _queue = 0;
  String? _lastError;
  bool _busy = false;

  Set<String> _uploadedHashes = {};
  SharedPreferences? _prefs;

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    _prefs = await SharedPreferences.getInstance();
    await _prefs!.reload();
    _serverUrl = _prefs!.getString('cfg_server') ?? '';
    _eventToken = _prefs!.getString('cfg_token') ?? '';
    _eventId = _prefs!.getString('cfg_event_id') ?? '';
    _watchPath = _prefs!.getString('cfg_path') ?? '';
    _uploadedHashes = (_prefs!.getStringList('uploaded_hashes') ?? []).toSet();
    _uploaded = _prefs!.getInt('stat_uploaded') ?? 0;
  }

  @override
  Future<void> onRepeatEvent(DateTime timestamp) async {
    if (_busy) return;
    _busy = true;
    try {
      await _scan();
    } catch (e) {
      _lastError = e.toString();
    }
    _busy = false;
    _send();
  }

  void _send() {
    FlutterForegroundTask.sendDataToMain({
      'uploaded': _uploaded,
      'queue': _queue,
      'error': _lastError,
    });
    FlutterForegroundTask.updateService(
      notificationTitle: 'AdVibe Auto Upload',
      notificationText: 'Subidas: $_uploaded  ·  En cola: $_queue',
    );
  }

  Directory _resolveDir() {
    final withDcim = Directory('$_watchPath/DCIM');
    if (withDcim.existsSync()) return withDcim;
    return Directory(_watchPath);
  }

  bool _isPhoto(String path) {
    final name = path.split('/').last.toLowerCase();
    if (name.startsWith('.') || name.contains('.pending-')) return false;
    if (name.endsWith('.arw') || name.endsWith('.raw') || name.endsWith('.dng')) return false;
    return name.endsWith('.jpg') || name.endsWith('.jpeg') ||
           name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.heic');
  }

  Future<void> _scan() async {
    final dir = _resolveDir();
    if (!dir.existsSync()) {
      _lastError = 'Carpeta no encontrada: ${dir.path}';
      return;
    }

    final photos = dir
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => _isPhoto(f.path))
        .toList();

    for (final photo in photos) {
      final bytes = await photo.readAsBytes();
      final hash = sha256.convert(bytes).toString();
      if (_uploadedHashes.contains(hash)) continue;

      _queue++;
      _send();
      final ok = await _upload(photo, bytes, hash);
      _queue--;
      if (ok) {
        _uploaded++;
        _uploadedHashes.add(hash);
        await _prefs!.setStringList('uploaded_hashes', _uploadedHashes.toList());
        await _prefs!.setInt('stat_uploaded', _uploaded);
        _lastError = null;
      }
      _send();
    }
  }

  Future<bool> _upload(File photo, List<int> bytes, String hash) async {
    try {
      final fname = photo.path.split('/').last;
      final lower = fname.toLowerCase();
      final mime = lower.endsWith('.png')
          ? 'image/png'
          : lower.endsWith('.webp')
              ? 'image/webp'
              : lower.endsWith('.heic')
                  ? 'image/heic'
                  : 'image/jpeg';

      final request = http.MultipartRequest('POST', Uri.parse('$_serverUrl/api/ingest'));
      request.headers['Authorization'] = 'Bearer $_eventToken';
      request.fields['eventId'] = _eventId;
      request.fields['idempotencyKey'] = const Uuid().v4();
      request.fields['clientId'] = 'samsung-a16-auto';
      request.files.add(http.MultipartFile.fromBytes(
        'photo', bytes, filename: fname, contentType: MediaType.parse(mime),
      ));

      final response = await request.send().timeout(const Duration(seconds: 60));
      if (response.statusCode == 200 || response.statusCode == 201) return true;

      final body = await response.stream.bytesToString();
      _lastError = '${response.statusCode} $body';
      return false;
    } catch (e) {
      _lastError = e.toString();
      return false;
    }
  }

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {}
}
