import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/upload_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final serverController = TextEditingController();
  final tokenController = TextEditingController();
  final eventIdController = TextEditingController();

  String? selectedPath;
  bool isRunning = false;
  int uploaded = 0;
  int queue = 0;
  String? lastError;

  SharedPreferences? prefs;

  @override
  void initState() {
    super.initState();
    FlutterForegroundTask.addTaskDataCallback(_onData);
    _init();
  }

  void _onData(Object data) {
    if (data is Map) {
      setState(() {
        uploaded = data['uploaded'] ?? uploaded;
        queue = data['queue'] ?? queue;
        lastError = data['error'];
      });
    }
  }

  Future<void> _init() async {
    prefs = await SharedPreferences.getInstance();
    serverController.text = prefs!.getString('cfg_server') ?? 'http://192.168.1.7:3300';
    tokenController.text = prefs!.getString('cfg_token') ?? 'KO00hH5dOHuh';
    eventIdController.text = prefs!.getString('cfg_event_id') ?? 'cmt42cyva0000gs240hil9f9l';
    final running = await FlutterForegroundTask.isRunningService;
    setState(() {
      selectedPath = prefs!.getString('cfg_path');
      uploaded = prefs!.getInt('stat_uploaded') ?? 0;
      isRunning = running;
    });
    _initService();
  }

  void _initService() {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'advibe_upload',
        channelName: 'AdVibe Auto Upload',
        channelImportance: NotificationChannelImportance.LOW,
        priority: NotificationPriority.LOW,
      ),
      iosNotificationOptions: const IOSNotificationOptions(),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(3000),
        autoRunOnBoot: false,
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );
  }

  Future<void> _saveConfig() async {
    await prefs!.setString('cfg_server', serverController.text.trim());
    await prefs!.setString('cfg_token', tokenController.text.trim());
    await prefs!.setString('cfg_event_id', eventIdController.text.trim());
    if (selectedPath != null) await prefs!.setString('cfg_path', selectedPath!);
  }

  Future<void> _start() async {
    await _saveConfig();
    await FlutterForegroundTask.requestNotificationPermission();
    await FlutterForegroundTask.startService(
      serviceTypes: [ForegroundServiceTypes.dataSync],
      notificationTitle: 'AdVibe Auto Upload',
      notificationText: 'Vigilando la carpeta...',
      callback: startCallback,
    );
    setState(() => isRunning = true);
  }

  Future<void> _stop() async {
    await FlutterForegroundTask.stopService();
    setState(() => isRunning = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AdVibe Auto Upload'),
        backgroundColor: Colors.blue[600],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isRunning ? Colors.green[50] : Colors.grey[100],
                border: Border.all(color: isRunning ? Colors.green : Colors.grey),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isRunning ? 'Monitoreo activo' : 'Monitoreo detenido',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isRunning ? Colors.green[700] : Colors.grey[700],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text('En cola: $queue'),
                  Text('Subidas: $uploaded'),
                  if (selectedPath != null) ...[
                    const SizedBox(height: 8),
                    Text('Carpeta: ${selectedPath!.split('/').last}',
                        style: const TextStyle(fontSize: 12)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (lastError != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange[50],
                  border: Border.all(color: Colors.orange),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('Ultimo error: $lastError',
                    style: TextStyle(color: Colors.orange[900], fontSize: 12)),
              ),
            const SizedBox(height: 16),

            const Text('Configuracion',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              controller: serverController,
              decoration: InputDecoration(
                labelText: 'Backend',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: tokenController,
              decoration: InputDecoration(
                labelText: 'Event Token',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: eventIdController,
              decoration: InputDecoration(
                labelText: 'Event ID',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: isRunning
                    ? null
                    : () async {
                        final path = await FilePicker.getDirectoryPath();
                        if (path != null) {
                          setState(() => selectedPath = path);
                          await prefs!.setString('cfg_path', path);
                        }
                      },
                icon: const Icon(Icons.folder_open),
                label: const Text('Elegir carpeta'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.all(16),
                  backgroundColor: Colors.blue[600],
                ),
              ),
            ),
            if (selectedPath != null) ...[
              const SizedBox(height: 8),
              Text(selectedPath!,
                  style: TextStyle(fontSize: 12, color: Colors.grey[600])),
            ],
            const SizedBox(height: 24),

            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: (selectedPath == null || isRunning) ? null : _start,
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('Iniciar'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.all(16),
                      backgroundColor: Colors.green[600],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: !isRunning ? null : _stop,
                    icon: const Icon(Icons.stop),
                    label: const Text('Detener'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.all(16),
                      backgroundColor: Colors.red[600],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                border: Border.all(color: Colors.blue[200]!),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Como funciona:', style: TextStyle(fontWeight: FontWeight.bold)),
                  SizedBox(height: 8),
                  Text('1. Elige la carpeta donde caen las fotos'),
                  Text('2. Toca Iniciar'),
                  Text('3. Pasa fotos desde la camara'),
                  Text('4. Suben solas, aunque cambies de app'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    FlutterForegroundTask.removeTaskDataCallback(_onData);
    serverController.dispose();
    tokenController.dispose();
    eventIdController.dispose();
    super.dispose();
  }
}
