import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterForegroundTask.initCommunicationPort();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AdVibe Auto Upload',
      theme: ThemeData(primarySwatch: Colors.blue, useMaterial3: true),
      home: const HomeScreen(),
    );
  }
}
