import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/photo_uploader.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? selectedUsbPath;
  final serverController = TextEditingController();
  final tokenController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _initialize();
  }
  
  Future<void> _initialize() async {
    final uploader = context.read<PhotoUploader>();
    await uploader.initialize();
    
    serverController.text = uploader.serverUrl;
    tokenController.text = uploader.eventToken;
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AdVibe Auto Upload'),
        backgroundColor: Colors.blue[600],
      ),
      body: Consumer<PhotoUploader>(
        builder: (context, uploader, _) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: uploader.isMonitoring ? Colors.green[50] : Colors.grey[100],
                  border: Border.all(
                    color: uploader.isMonitoring ? Colors.green : Colors.grey,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      uploader.isMonitoring ? '✅ Monitoring Active' : '⏸️ Monitoring Inactive',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: uploader.isMonitoring ? Colors.green[700] : Colors.grey[700],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Photos in Queue: ${uploader.photosInQueue}'),
                            Text('Photos Uploaded: ${uploader.photosUploaded}'),
                          ],
                        ),
                        if (selectedUsbPath != null)
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Text('USB Path:'),
                              Text(
                                selectedUsbPath!.split('/').last,
                                style: const TextStyle(fontSize: 12),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              
              // Error message
              if (uploader.lastError != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    border: Border.all(color: Colors.red),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '❌ ${uploader.lastError}',
                    style: TextStyle(color: Colors.red[700]),
                  ),
                ),
              const SizedBox(height: 16),
              
              // Server configuration
              const Text('Configuration', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              
              TextField(
                controller: serverController,
                decoration: InputDecoration(
                  labelText: 'Backend Server',
                  hintText: 'http://192.168.1.7:3300',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onChanged: (value) => context.read<PhotoUploader>().serverUrl = value,
              ),
              const SizedBox(height: 12),
              
              TextField(
                controller: tokenController,
                decoration: InputDecoration(
                  labelText: 'Event Token',
                  hintText: 'KO00hH5dOHuh',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onChanged: (value) => context.read<PhotoUploader>().eventToken = value,
              ),
              const SizedBox(height: 24),
              
              // USB folder selection
              const Text('USB Storage', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final path = await context.read<PhotoUploader>().selectUsbFolder();
                    if (path != null) {
                      setState(() => selectedUsbPath = path);
                    }
                  },
                  icon: const Icon(Icons.folder_open),
                  label: const Text('Select USB Folder'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.all(16),
                    backgroundColor: Colors.blue[600],
                  ),
                ),
              ),
              
              if (selectedUsbPath != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Selected: $selectedUsbPath',
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
              ],
              
              const SizedBox(height: 24),
              
              // Control buttons
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: selectedUsbPath == null
                          ? null
                          : () => context.read<PhotoUploader>().startMonitoring(selectedUsbPath!),
                      icon: const Icon(Icons.play_arrow),
                      label: const Text('Start Monitoring'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.all(16),
                        backgroundColor: Colors.green[600],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: !uploader.isMonitoring
                          ? null
                          : () => context.read<PhotoUploader>().stopMonitoring(),
                      icon: const Icon(Icons.stop),
                      label: const Text('Stop Monitoring'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.all(16),
                        backgroundColor: Colors.red[600],
                      ),
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 24),
              
              // Instructions
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  border: Border.all(color: Colors.blue[200]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'How it works:',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    Text('1. Connect ZV-E10 via USB-OTG to Samsung'),
                    Text('2. Select the USB storage folder'),
                    Text('3. Click "Start Monitoring"'),
                    Text('4. Take photos with ZV-E10'),
                    Text('5. Photos auto-upload to gallery'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  @override
  void dispose() {
    serverController.dispose();
    tokenController.dispose();
    super.dispose();
  }
}
