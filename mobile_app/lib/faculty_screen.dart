import 'package:flutter/material.dart';
import 'package:flutter_ble_peripheral/flutter_ble_peripheral.dart';

class FacultyScreen extends StatefulWidget {
  final String userName;
  const FacultyScreen({super.key, required this.userName});

  @override
  State<FacultyScreen> createState() => _FacultyScreenState();
}

class _FacultyScreenState extends State<FacultyScreen> {
  final FlutterBlePeripheral blePeripheral = FlutterBlePeripheral();
  bool isAdvertising = false;
  String status = "Ready to start class.";

  // A Unique ID for your class (UUID)
  // In a real app, this comes from the database.
  // We use a fixed one for testing.
  final String serviceUuid = "bf27730d-860a-4e09-889c-2d8b6a9e0fe7";

  void toggleClass() async {
    if (isAdvertising) {
      // STOP CLASS
      await blePeripheral.stop();
      setState(() {
        isAdvertising = false;
        status = "Class Stopped.";
      });
    } else {
      // START CLASS
      setState(() => status = "Starting Bluetooth Broadcast...");

      // Define the "Advertisement Data"
      final AdvertiseData advertiseData = AdvertiseData(
        serviceUuid: serviceUuid,
        localName: "SmartClass_CS101",
      );

      // Start Advertising
      try {
        await blePeripheral.start(advertiseData: advertiseData);
        setState(() {
          isAdvertising = true;
          status =
              "📡 Broadcasting Signal...\nStudents can now mark attendance.";
        });
      } catch (e) {
        setState(() => status = "Error starting class: $e");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Prof. ${widget.userName}"),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Visual Indicator
              Container(
                width: 150,
                height: 150,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isAdvertising
                      ? Colors.green.shade100
                      : Colors.grey.shade200,
                  border: Border.all(
                    color: isAdvertising ? Colors.green : Colors.grey,
                    width: 4,
                  ),
                ),
                child: Icon(
                  Icons.bluetooth_audio,
                  size: 80,
                  color: isAdvertising ? Colors.green : Colors.grey,
                ),
              ),
              const SizedBox(height: 30),

              // Status Text
              Text(
                status,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 40),

              // The Big Button
              SizedBox(
                width: double.infinity,
                height: 60,
                child: ElevatedButton(
                  onPressed: toggleClass,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isAdvertising ? Colors.red : Colors.indigo,
                  ),
                  child: Text(
                    isAdvertising ? "STOP ATTENDANCE" : "START CLASS",
                    style: const TextStyle(fontSize: 18, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
