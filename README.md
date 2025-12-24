# 📍 Proximity-Based Smart Attendance System

![Status](https://img.shields.io/badge/Status-Active-success)
![Platform](https://img.shields.io/badge/Platform-iOS%20|%20Android%20|%20Web-blue)
![Stack](https://img.shields.io/badge/Stack-Flutter%20|%20Next.js%20|%20Node.js-orange)

A robust, full-stack attendance solution designed to eliminate proxy attendance in educational institutions. This system utilizes **Bluetooth Low Energy (BLE)** for proof-of-presence, **Geofencing** for location validation, and **Hardware ID Binding** to prevent unauthorized device switching.

---

## 🚀 Key Features

### 📱 Mobile App (Student & Faculty)
* **Role-Based Access:** Distinct interfaces for Faculty (Host) and Students (Attendee).
* **BLE Handshake:** Faculty device acts as a BLE Peripheral advertising a secure, rotating session token. Student devices scan and validate proximity via RSSI (Signal Strength).
* **Strict Device Binding:** Student accounts are locked to a single hardware ID (Android ID/iOS Vendor ID). Login on a new device requires Admin approval.
* **Geofencing:** Backend validates that GPS coordinates are within the institution's boundaries.

### 💻 Web Admin Panel
* **Device Management:** View pending device requests, approve bulk batches, or reset device locks for lost phones.
* **Live Dashboard:** Visual analytics of daily attendance, active classes, and student metrics.
* **Batch & Timetable:** Manage subjects, faculty allocations, and class schedules.

---

## 🛠 Tech Stack

**Monorepo Structure** managed via Turborepo/Yarn Workspaces.

| Component | Technology | Key Libraries |
| :--- | :--- | :--- |
| **Mobile** | Flutter (Dart) | `flutter_blue_plus` (Scanning), `flutter_ble_peripheral` (Advertising), `device_info_plus` |
| **Web Admin** | Next.js (React) | `Tailwind CSS`, `Recharts` |
| **Backend** | Node.js (Express) | `jsonwebtoken` (Auth), `cors` |
| **Database** | PostgreSQL | `Prisma ORM` |
| **Infrastructure** | Docker | `Redis` (Caching), `Supabase` (Hosted DB) |

---

## 🏗 Architecture

The system relies on a **"Proof of Presence"** workflow:

1.  **Advertisement:** Faculty starts a class; the phone advertises a dynamic `SessionToken` via BLE.
2.  **Discovery:** Student app scans for the specific Service UUID.
3.  **Filtration:** App filters results based on RSSI (e.g., > -75dBm) to ensure the student is inside the room.
4.  **Submission:** Student app sends `SessionToken` + `DeviceID` + `GPS` to the server via API.
5.  **Validation:** Server validates the token, checks the device lock, and verifies the Geofence before marking "Present".

---

## 📂 Project Structure

```bash
smart-attendance-monorepo/
├── apps/
│   ├── api/                 # Express.js REST API
│   ├── web-admin/           # Next.js Dashboard
│   └── mobile-app/          # Flutter Cross-platform App
├── packages/
│   ├── database/            # Prisma Schema & Migrations
│   └── shared-types/        # TypeScript Interfaces
└── docker-compose.yml       # DB setup

## 👨‍💻 About the Developer

**Jitendra Prajapat** *Assistant Professor, School of Engineering and Technology* *Ph.D. Scholar, Computer Science*

I am an academic and researcher with a focus on bridging the gap between theoretical computer science and practical, real-world applications. My research interests include **Robotics Process Automation (RPA)**, **Cyber Security**, and **AI/ML**, specifically applying these technologies to solve institutional challenges.

This project represents my commitment to building secure, scalable, and intelligent systems for the educational sector.

* **Research Focus:** AI/ML in Security, RPA, and Web Technologies.
* **Location:** Jaipur, Rajasthan, India.

---
