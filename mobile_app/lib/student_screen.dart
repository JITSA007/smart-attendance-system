import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

class StudentScreen extends StatefulWidget {
  final String userName;
  const StudentScreen({super.key, required this.userName});

  @override
  State<StudentScreen> createState() => _StudentScreenState();
}

class _StudentScreenState extends State<StudentScreen> {
  bool isScanning = false;
  String status = "Ready to mark attendance.";

  void scanForClass() async {
    setState(() {
      isScanning = true;
      status = "Scanning for nearby classes...";
    });

    try {
      // 1. Check if Bluetooth is On
      // Note: adapterState is a Stream, so we take the first value
      var state = await FlutterBluePlus.adapterState.first;
      if (state != BluetoothAdapterState.on) {
        setState(() {
          isScanning = false;
          status = "❌ Bluetooth is OFF. Please turn it on.";
        });
        return;
      }

      // 2. Start Scanning
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 4));

      // 3. Listen for results
      // We listen briefly to count devices, then we will cancel the listener
      var subscription = FlutterBluePlus.scanResults.listen((results) {
        if (mounted) {
          setState(() {
            status = "Found ${results.length} Bluetooth devices nearby.";
          });
        }
      });

      // 4. Wait for scan to finish
      await Future.delayed(const Duration(seconds: 4));

      // 5. Cleanup
      await FlutterBluePlus.stopScan();
      subscription.cancel();

      if (mounted) {
        setState(() => isScanning = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          isScanning = false;
          status = "Error: $e";
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Student: ${widget.userName}")),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.radar, size: 80, color: Colors.indigo),
            const SizedBox(height: 20),
            Text(
              status,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 40),
            ElevatedButton.icon(
              onPressed: isScanning ? null : scanForClass,
              icon: isScanning
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.search),
              label: Text(isScanning ? "Scanning..." : "Mark Attendance"),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 30,
                  vertical: 15,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
