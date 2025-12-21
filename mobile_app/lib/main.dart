import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_ble_peripheral/flutter_ble_peripheral.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:geolocator/geolocator.dart';
// NOTE: Run 'flutter pub add intl' to support date formatting
// NOTE: Run 'flutter pub add file_picker' for real file uploads (Mocked here for stability)

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
// ⚠️ ANDROID EMULATOR: Use 'http://localhost:4000' (Run 'adb reverse tcp:4000 tcp:4000')
// ⚠️ REAL PHONE: Use your PC IP (e.g., 'http://192.168.1.5:4000')
final String backendUrl = 'https://smart-attendance-system-zrwj.onrender.com';

// BLE UUID (Must match on both Faculty & Student)
final String SERVICE_UUID = "bf27730d-860a-4e09-889c-2d8b6a9e0fe7";

void main() {
  runApp(
    const MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'UniverseOS Smart App',
      home: AuthLoader(),
    ),
  );
}

// ==========================================
// 1. AUTH LOADER (The Gatekeeper 🚦)
// ==========================================
class AuthLoader extends StatefulWidget {
  const AuthLoader({super.key});
  @override
  State<AuthLoader> createState() => _AuthLoaderState();
}

class _AuthLoaderState extends State<AuthLoader> {
  String status = "Connecting to UniverseOS...";

  @override
  void initState() {
    super.initState();
    checkDevice();
  }

  Future<void> checkDevice() async {
    try {
      String deviceId = await _getDeviceId();
      final response = await http.post(
        Uri.parse('$backendUrl/check-user'),
        headers: {"Content-Type": "application/json"},
        body: json.encode({"device_id": deviceId}),
      );

      if (response.statusCode == 200) {
        final user = json.decode(response.body);
        if (user['is_approved'] == true) {
          // ROUTING BASED ON ROLE
          if (user['role'] == 'faculty') {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => FacultyDashboard(user: user)),
            );
          } else {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => StudentDashboard(user: user)),
            );
          }
        } else {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => const PendingApprovalScreen()),
          );
        }
      } else {
        // NEW USER -> GO TO REGISTER
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => SignUpScreen(deviceId: deviceId)),
        );
      }
    } catch (e) {
      setState(
        () => status =
            "Server Connection Failed.\nIs Node.js running?\n\nError: $e",
      );
    }
  }

  Future<String> _getDeviceId() async {
    final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      final AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
      return androidInfo.id;
    }
    return "unknown_device_ios_web";
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: Colors.indigo),
            const SizedBox(height: 20),
            Text(
              status,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.grey, fontSize: 16),
            ),
          ],
        ),
      ),
    );
  }
}

// ==========================================
// 2. REGISTRATION SCREEN (Smart Identity 📝)
// ==========================================
class SignUpScreen extends StatefulWidget {
  final String deviceId;
  const SignUpScreen({super.key, required this.deviceId});
  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController nameCtrl = TextEditingController();
  final TextEditingController ridCtrl = TextEditingController();
  final TextEditingController emailCtrl = TextEditingController();

  String selectedRole = "student";
  String selectedProgram = "B.Tech";
  String selectedBatch = "2025";
  bool isSubmitting = false;

  Future<void> registerUser() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => isSubmitting = true);

    final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    String model = "Unknown Device";
    if (Platform.isAndroid) {
      final info = await deviceInfo.androidInfo;
      model = "${info.brand} ${info.model}";
    }

    try {
      final response = await http.post(
        Uri.parse('$backendUrl/register'),
        headers: {"Content-Type": "application/json"},
        body: json.encode({
          "name": nameCtrl.text,
          "email": emailCtrl.text,
          "rid": ridCtrl.text,
          "program": selectedRole == 'faculty' ? "Faculty" : selectedProgram,
          "batch": selectedRole == 'faculty' ? "Faculty" : selectedBatch,
          "device_id": widget.deviceId,
          "device_model": model,
          "role": selectedRole,
        }),
      );

      if (response.statusCode == 200) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const PendingApprovalScreen()),
        );
      } else {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Error: ${response.body}")));
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Failed: $e")));
    }
    setState(() => isSubmitting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Setup Profile"),
        backgroundColor: Colors.indigo,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                "Who are you?",
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 10),

              // ROLE SELECTION CARDS
              Row(
                children: [
                  Expanded(
                    child: _buildRoleCard("student", Icons.school, Colors.blue),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildRoleCard(
                      "faculty",
                      Icons.person_search,
                      Colors.orange,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 25),

              TextFormField(
                controller: nameCtrl,
                decoration: const InputDecoration(
                  labelText: "Full Name",
                  border: OutlineInputBorder(),
                ),
                validator: (v) => v!.isEmpty ? "Required" : null,
              ),
              const SizedBox(height: 15),
              TextFormField(
                controller: ridCtrl,
                decoration: InputDecoration(
                  labelText: selectedRole == 'student'
                      ? "Roll No"
                      : "Employee ID",
                  border: const OutlineInputBorder(),
                ),
                validator: (v) => v!.isEmpty ? "Required" : null,
              ),
              const SizedBox(height: 15),
              TextFormField(
                controller: emailCtrl,
                decoration: const InputDecoration(
                  labelText: "Email Address",
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 15),

              if (selectedRole == 'student') ...[
                DropdownButtonFormField(
                  value: selectedProgram,
                  items: ["B.Tech", "B.Sc", "M.Tech"]
                      .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                      .toList(),
                  onChanged: (v) =>
                      setState(() => selectedProgram = v.toString()),
                  decoration: const InputDecoration(
                    labelText: "Program",
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 15),
                DropdownButtonFormField(
                  value: selectedBatch,
                  items: ["2023", "2024", "2025"]
                      .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                      .toList(),
                  onChanged: (v) =>
                      setState(() => selectedBatch = v.toString()),
                  decoration: const InputDecoration(
                    labelText: "Batch",
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 25),
              ],

              ElevatedButton(
                onPressed: isSubmitting ? null : registerUser,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.all(15),
                  backgroundColor: Colors.indigo,
                ),
                child: isSubmitting
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        "COMPLETE SETUP",
                        style: TextStyle(color: Colors.white, fontSize: 16),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRoleCard(String role, IconData icon, Color color) {
    bool selected = selectedRole == role;
    return GestureDetector(
      onTap: () => setState(() => selectedRole = role),
      child: Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: selected ? color.withOpacity(0.1) : Colors.white,
          border: Border.all(
            color: selected ? color : Colors.grey.shade300,
            width: 2,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Icon(icon, color: selected ? color : Colors.grey, size: 30),
            const SizedBox(height: 5),
            Text(
              role.toUpperCase(),
              style: TextStyle(
                color: selected ? color : Colors.grey,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ==========================================
// 3. PENDING APPROVAL SCREEN
// ==========================================
class PendingApprovalScreen extends StatelessWidget {
  const PendingApprovalScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(30.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.verified_user_outlined,
                size: 80,
                color: Colors.orange,
              ),
              const SizedBox(height: 20),
              const Text(
                "Verification Pending",
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 10),
              const Text(
                "Your account is waiting for Admin approval. Please contact the IT department or wait.",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 40),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh),
                label: const Text("Check Status"),
                onPressed: () => Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const AuthLoader()),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ==========================================
// 4. FACULTY DASHBOARD 👨‍🏫
// ==========================================
class FacultyDashboard extends StatefulWidget {
  final Map user;
  const FacultyDashboard({super.key, required this.user});
  @override
  State<FacultyDashboard> createState() => _FacultyDashboardState();
}

class _FacultyDashboardState extends State<FacultyDashboard> {
  bool isAdvertising = false;
  final FlutterBlePeripheral blePeripheral = FlutterBlePeripheral();
  Map<String, dynamic>? liveClass;
  String statusMessage = "Loading Schedule...";
  int? currentSessionId;

  @override
  void initState() {
    super.initState();
    fetchLiveSchedule();
  }

  Future<void> fetchLiveSchedule() async {
    try {
      final response = await http.get(
        Uri.parse(
          '$backendUrl/faculty/schedule/now?device_id=${widget.user['device_id']}',
        ),
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        setState(() {
          if (data['active'] == true)
            liveClass = data;
          else {
            liveClass = null;
            statusMessage = "No Class Scheduled Now";
          }
        });
      }
    } catch (e) {
      setState(() => statusMessage = "Network Error");
    }
  }

  Future<void> toggleClass() async {
    if (isAdvertising) {
      await blePeripheral.stop();
      setState(() => isAdvertising = false);
    } else {
      if (liveClass == null) return;
      // 1. Get Location
      Position p = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      // 2. Start Backend Session
      final res = await http.post(
        Uri.parse('$backendUrl/start-class'),
        headers: {"Content-Type": "application/json"},
        body: json.encode({
          "device_id": widget.user['device_id'],
          "subject": liveClass!['subject'],
          "batch": liveClass!['batch'],
          "program": liveClass!['program'],
          "latitude": p.latitude,
          "longitude": p.longitude,
        }),
      );

      if (res.statusCode == 200) {
        currentSessionId = json.decode(res.body)['session_id'];

        // 3. Start BLE
        AdvertiseData data = AdvertiseData(
          serviceUuid: SERVICE_UUID,
          includeDeviceName: false,
          manufacturerId: 1234,
          manufacturerData: Uint8List.fromList([1]),
        );
        await blePeripheral.start(advertiseData: data);
        setState(() => isAdvertising = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Class Started! Broadcasting...")),
        );
      } else {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text("Failed to Start Class")));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Faculty Portal"),
        backgroundColor: Colors.indigo,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: fetchLiveSchedule,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (_) => SignUpScreen(deviceId: "RESET"),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Welcome, Prof. ${widget.user['name']}",
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),

            // 1. CLASS CARD
            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(15),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: liveClass == null
                    ? Center(
                        child: Column(
                          children: [
                            const Icon(
                              Icons.free_breakfast,
                              size: 40,
                              color: Colors.grey,
                            ),
                            const SizedBox(height: 10),
                            Text(statusMessage),
                          ],
                        ),
                      )
                    : Column(
                        children: [
                          const Text(
                            "CURRENT CLASS",
                            style: TextStyle(
                              color: Colors.green,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            liveClass!['subject'],
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            "${liveClass!['batch']} • ${liveClass!['code'] ?? ''}",
                            style: const TextStyle(color: Colors.grey),
                          ),
                          const SizedBox(height: 20),
                          GestureDetector(
                            onTap: toggleClass,
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(15),
                              decoration: BoxDecoration(
                                color: isAdvertising
                                    ? Colors.red
                                    : Colors.indigo,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Center(
                                child: Text(
                                  isAdvertising
                                      ? "STOP CLASS"
                                      : "START ATTENDANCE",
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          if (isAdvertising)
                            Padding(
                              padding: const EdgeInsets.only(top: 10),
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.edit),
                                label: const Text("MANUAL OVERRIDE"),
                                onPressed: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => ManualAttendanceScreen(
                                      batch: liveClass!['batch'],
                                      program: liveClass!['program'],
                                      sessionId: currentSessionId,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
              ),
            ),

            const SizedBox(height: 20),
            const Text(
              "Quick Actions",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),

            // 2. GRID ACTIONS
            GridView.count(
              shrinkWrap: true,
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.3,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _ActionCard(
                  icon: Icons.assignment,
                  label: "Leave Requests",
                  color: Colors.orange,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => FacultyLeaveScreen(
                        deviceId: widget.user['device_id'],
                      ),
                    ),
                  ),
                ),
                _ActionCard(
                  icon: Icons.bar_chart,
                  label: "Reports",
                  color: Colors.blue,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const FacultyReportScreen(),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  const _ActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.color,
  });
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircleAvatar(
              backgroundColor: color.withOpacity(0.1),
              radius: 25,
              child: Icon(icon, size: 30, color: color),
            ),
            const SizedBox(height: 10),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}

// ==========================================
// 5. MANUAL ATTENDANCE (Faculty) ✏️
// ==========================================
class ManualAttendanceScreen extends StatefulWidget {
  final String batch;
  final String program;
  final int? sessionId;
  const ManualAttendanceScreen({
    super.key,
    required this.batch,
    required this.program,
    required this.sessionId,
  });
  @override
  State<ManualAttendanceScreen> createState() => _MAS();
}

class _MAS extends State<ManualAttendanceScreen> {
  List students = [];
  bool loading = true;
  @override
  void initState() {
    super.initState();
    fetch();
  }

  Future fetch() async {
    final res = await http.get(
      Uri.parse(
        '$backendUrl/students/filter?batch=${widget.batch}&program=${widget.program}',
      ),
    );
    if (res.statusCode == 200) setState(() => students = json.decode(res.body));
    setState(() => loading = false);
  }

  Future mark(int id) async {
    if (widget.sessionId == null) return;
    await http.post(
      Uri.parse('$backendUrl/attendance/manual'),
      headers: {"Content-Type": "application/json"},
      body: json.encode({"student_id": id, "session_id": widget.sessionId}),
    );
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text("Marked Present!")));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Manual: ${widget.batch}")),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: students.length,
              itemBuilder: (c, i) => Card(
                child: ListTile(
                  leading: CircleAvatar(child: Text(students[i]['name'][0])),
                  title: Text(students[i]['name']),
                  subtitle: Text(students[i]['roll_no'] ?? ""),
                  trailing: IconButton(
                    icon: const Icon(Icons.check_circle, color: Colors.green),
                    onPressed: () => mark(students[i]['id']),
                  ),
                ),
              ),
            ),
    );
  }
}

// ==========================================
// 6. STUDENT DASHBOARD 🎓
// ==========================================
class StudentDashboard extends StatefulWidget {
  final Map user;
  const StudentDashboard({super.key, required this.user});
  @override
  State<StudentDashboard> createState() => _StudentDashboardState();
}

class _StudentDashboardState extends State<StudentDashboard> {
  bool isScanning = false;
  bool classFound = false;
  bool isMarking = false;
  String statusMsg = "Ready to Scan";

  Future<void> startScan() async {
    await [
      Permission.bluetooth,
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();
    setState(() {
      isScanning = true;
      classFound = false;
      statusMsg = "Scanning nearby...";
    });
    FlutterBluePlus.startScan(
      withServices: [Guid(SERVICE_UUID)],
      timeout: const Duration(seconds: 8),
    );
    FlutterBluePlus.scanResults.listen((r) {
      if (r.isNotEmpty && mounted) {
        setState(() {
          classFound = true;
          statusMsg = "Class Verified!";
          isScanning = false;
        });
        FlutterBluePlus.stopScan();
      }
    });
    Future.delayed(const Duration(seconds: 9), () {
      if (mounted && isScanning)
        setState(() {
          isScanning = false;
          statusMsg = "No Class Found";
        });
    });
  }

  Future<void> mark() async {
    setState(() => isMarking = true);
    try {
      Position p = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      final res = await http.post(
        Uri.parse('$backendUrl/mark-attendance'),
        headers: {"Content-Type": "application/json"},
        body: json.encode({
          "device_id": widget.user['device_id'],
          "latitude": p.latitude,
          "longitude": p.longitude,
        }),
      );

      final body = json.decode(res.body);
      if (res.statusCode == 200) {
        setState(() {
          classFound = false;
          statusMsg = "Attendance Marked ✅";
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Success! ${body['distance']}m away")),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red,
            content: Text(body['error'] ?? "Failed"),
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Error: $e")));
    }
    setState(() => isMarking = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Student Portal"),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (_) => SignUpScreen(deviceId: "RESET"),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const Icon(Icons.school_outlined, size: 80, color: Colors.blue),
            const SizedBox(height: 10),
            Text(
              "Hi, ${widget.user['name']}",
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 30),

            // MAIN ACTION CARD
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(15),
                boxShadow: [
                  BoxShadow(color: Colors.grey.shade200, blurRadius: 10),
                ],
              ),
              child: Column(
                children: [
                  Text(
                    statusMsg,
                    style: TextStyle(
                      color: classFound ? Colors.green : Colors.grey,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (!classFound && statusMsg != "Attendance Marked ✅")
                    ElevatedButton.icon(
                      icon: isScanning
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Icon(Icons.search),
                      label: Text(isScanning ? "Scanning..." : "FIND CLASS"),
                      onPressed: isScanning ? null : startScan,
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 50),
                      ),
                    ),
                  if (classFound)
                    ElevatedButton.icon(
                      icon: const Icon(Icons.check),
                      label: const Text("MARK PRESENT"),
                      onPressed: isMarking ? null : mark,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 50),
                      ),
                    ),
                ],
              ),
            ),

            const SizedBox(height: 30),
            // GRID MENU
            GridView.count(
              shrinkWrap: true,
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              children: [
                _MenuTile(
                  icon: Icons.history,
                  label: "My History",
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) =>
                          HistoryScreen(deviceId: widget.user['device_id']),
                    ),
                  ),
                ),
                _MenuTile(
                  icon: Icons.sick,
                  label: "Apply Leave",
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ApplyLeaveScreen(user: widget.user),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _MenuTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.blue.shade50,
          borderRadius: BorderRadius.circular(15),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 40, color: Colors.blue),
            const SizedBox(height: 10),
            Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}

// ==========================================
// 7. LEAVE MANAGEMENT SYSTEM 🏥
// ==========================================

// STUDENT: Apply Leave Form
class ApplyLeaveScreen extends StatefulWidget {
  final Map user;
  const ApplyLeaveScreen({super.key, required this.user});
  @override
  State<ApplyLeaveScreen> createState() => _ALS();
}

class _ALS extends State<ApplyLeaveScreen> {
  final _key = GlobalKey<FormState>();
  final reasonCtrl = TextEditingController();
  final parentCtrl = TextEditingController();
  DateTimeRange? dates;
  bool loading = false;

  Future submit() async {
    if (!_key.currentState!.validate() || dates == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Please fill all fields and select dates."),
        ),
      );
      return;
    }
    setState(() => loading = true);

    // Simulate API Call
    try {
      final res = await http.post(
        Uri.parse('$backendUrl/leave/apply'),
        headers: {"Content-Type": "application/json"},
        body: json.encode({
          "student_id": widget.user['id'],
          "reason": reasonCtrl.text,
          "start_date": dates!.start.toIso8601String(),
          "end_date": dates!.end.toIso8601String(),
          "parent_contact": parentCtrl.text,
          "file_data":
              "mock_base64_string", // In real app, this would be actual file data
        }),
      );

      if (res.statusCode == 200) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Application Sent Successfully!")),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Server Error. Try again.")),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Connection Error")));
    }
    setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Apply for Leave")),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _key,
          child: ListView(
            children: [
              const Text(
                "Leave Details",
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: reasonCtrl,
                decoration: const InputDecoration(
                  labelText: "Reason for Leave",
                  border: OutlineInputBorder(),
                  hintText: "e.g. Fever, Family Function",
                ),
                maxLines: 3,
                validator: (v) => v!.isEmpty ? "Required" : null,
              ),
              const SizedBox(height: 15),
              ListTile(
                title: Text(
                  dates == null
                      ? "Select Duration"
                      : "${dates!.start.toString().split(' ')[0]} to ${dates!.end.toString().split(' ')[0]}",
                  style: TextStyle(
                    color: dates == null ? Colors.grey : Colors.black,
                  ),
                ),
                trailing: const Icon(
                  Icons.calendar_today,
                  color: Colors.indigo,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(5),
                  side: const BorderSide(color: Colors.grey),
                ),
                onTap: () async {
                  final picked = await showDateRangePicker(
                    context: context,
                    firstDate: DateTime.now(),
                    lastDate: DateTime(2030),
                  );
                  if (picked != null) setState(() => dates = picked);
                },
              ),
              const SizedBox(height: 15),
              TextFormField(
                controller: parentCtrl,
                decoration: const InputDecoration(
                  labelText: "Parent's Phone No",
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.phone,
                validator: (v) => v!.length < 10 ? "Invalid Number" : null,
              ),
              const SizedBox(height: 15),
              OutlinedButton.icon(
                icon: const Icon(Icons.attach_file),
                label: const Text("Attach Medical Certificate (Optional)"),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("File Attached: medical_report.pdf"),
                    ),
                  );
                },
              ),
              const SizedBox(height: 30),
              ElevatedButton(
                onPressed: loading ? null : submit,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.all(15),
                  backgroundColor: Colors.indigo,
                ),
                child: const Text(
                  "SUBMIT APPLICATION",
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
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

// FACULTY: Manage Leaves (Approve/Reject)
class FacultyLeaveScreen extends StatefulWidget {
  final String deviceId;
  const FacultyLeaveScreen({super.key, required this.deviceId});
  @override
  State<FacultyLeaveScreen> createState() => _FLS();
}

class _FLS extends State<FacultyLeaveScreen> {
  List leaves = [];
  bool loading = true;
  @override
  void initState() {
    super.initState();
    fetch();
  }

  Future fetch() async {
    try {
      final res = await http.get(
        Uri.parse('$backendUrl/leave/pending?device_id=${widget.deviceId}'),
      );
      if (res.statusCode == 200) setState(() => leaves = json.decode(res.body));
    } catch (e) {
      /* Handle Error */
    }
    setState(() => loading = false);
  }

  Future action(int id, String status) async {
    await http.put(
      Uri.parse('$backendUrl/leave/update'),
      headers: {"Content-Type": "application/json"},
      body: json.encode({"id": id, "status": status}),
    );
    fetch(); // Refresh list
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Pending Requests")),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : leaves.isEmpty
          ? const Center(
              child: Text(
                "No Pending Requests",
                style: TextStyle(color: Colors.grey),
              ),
            )
          : ListView.builder(
              itemCount: leaves.length,
              itemBuilder: (c, i) {
                final l = leaves[i];
                return Card(
                  margin: const EdgeInsets.all(10),
                  child: Padding(
                    padding: const EdgeInsets.all(15),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              l['student_name'],
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            Text(
                              l['batch'],
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                        const Divider(),
                        Text(
                          "Reason: ${l['reason']}",
                          style: const TextStyle(fontSize: 15),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          "Duration: ${l['start_date'].substring(0, 10)} to ${l['end_date'].substring(0, 10)}",
                        ),
                        Text(
                          "Parent: ${l['parent_contact']}",
                          style: const TextStyle(color: Colors.indigo),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton(
                              onPressed: () => action(l['id'], 'REJECTED'),
                              child: const Text(
                                "DECLINE",
                                style: TextStyle(color: Colors.red),
                              ),
                            ),
                            const SizedBox(width: 10),
                            ElevatedButton(
                              onPressed: () => action(l['id'], 'APPROVED'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                              ),
                              child: const Text(
                                "APPROVE",
                                style: TextStyle(color: Colors.white),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}

// ==========================================
// 8. REPORT & HISTORY SCREENS
// ==========================================
class FacultyReportScreen extends StatefulWidget {
  const FacultyReportScreen({super.key});
  @override
  State<FacultyReportScreen> createState() => _FRS();
}

class _FRS extends State<FacultyReportScreen> {
  List data = [];
  String date = DateTime.now().toIso8601String().split('T')[0];
  @override
  void initState() {
    super.initState();
    load();
  }

  Future load() async {
    final res = await http.get(
      Uri.parse('$backendUrl/attendance/report?date=$date'),
    );
    if (res.statusCode == 200) setState(() => data = json.decode(res.body));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Daily Report")),
      body: Column(
        children: [
          ListTile(
            title: Text(
              "Date: $date",
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            trailing: const Icon(Icons.calendar_month),
            onTap: () async {
              final d = await showDatePicker(
                context: context,
                initialDate: DateTime.now(),
                firstDate: DateTime(2024),
                lastDate: DateTime(2030),
              );
              if (d != null) {
                setState(() => date = d.toIso8601String().split('T')[0]);
                load();
              }
            },
          ),
          const Divider(),
          Expanded(
            child: ListView.builder(
              itemCount: data.length,
              itemBuilder: (c, i) => ListTile(
                leading: CircleAvatar(child: Text(data[i]['student_name'][0])),
                title: Text(data[i]['student_name']),
                subtitle: Text("${data[i]['program']} • ${data[i]['batch']}"),
                trailing: Text(
                  data[i]['status'],
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.green,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class HistoryScreen extends StatefulWidget {
  final String deviceId;
  const HistoryScreen({super.key, required this.deviceId});
  @override
  State<HistoryScreen> createState() => _HS();
}

class _HS extends State<HistoryScreen> {
  List data = [];
  @override
  void initState() {
    super.initState();
    load();
  }

  Future load() async {
    final res = await http.get(
      Uri.parse('$backendUrl/attendance/student/${widget.deviceId}'),
    );
    if (res.statusCode == 200) setState(() => data = json.decode(res.body));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("My Attendance")),
      body: ListView.builder(
        itemCount: data.length,
        itemBuilder: (c, i) {
          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            child: ListTile(
              leading: const Icon(Icons.check_circle, color: Colors.green),
              title: Text(data[i]['program']),
              subtitle: Text(data[i]['date']),
              trailing: Text(
                data[i]['status'],
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          );
        },
      ),
    );
  }
}
