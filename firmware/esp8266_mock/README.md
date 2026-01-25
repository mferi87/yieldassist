# ESP8266 Mock Hub Firmware

This firmware simulates a **YieldAssist Hub** that acts as a gateway for multiple sensors.
It features a local Mock UI to simulate sensor readings (Soil Moisture, Temperature) and communicates with the backend via API Key.

## Prerequisites

- PlatformIO Core or IDE (VSCode with PlatformIO extension).
- ESP8266 board (e.g., NodeMCU, Wemos D1 Mini).

## Setup

1. Open this directory in PlatformIO.
2. Build and Upload the firmware to your ESP8266.

## Configuration & Pairing

1. **Connect to AP**: After flashing, connect your phone/laptop to the WiFi AP named **YieldAssist-Hub**.
2. **Configure**: A captive portal should open (or go to `http://192.168.4.1`).
   - select your **WiFi Network**.
   - Enter **API Server** (e.g., `http://192.168.1.100:8000`).
   - Enter your **User Email**.
   - **NO Password** is required on the device.
3. **Approve on Backend**:
   - The device will start in "Pending Approval" mode.
   - Go to your YieldAssist Backend (or use the API) to **Approve** the Hub associated with your email.
   - Once approved, the Hub receives an API Key automatically.

## Usage (Mock UI)

1. **Access Dashboard**: Once connected to WiFi, find the IP address of the ESP (printed in Serial Monitor) and open it in a browser (e.g., `http://192.168.1.105`).
2. **Control Sensors**:
   - Use the **Sliders** to change values for Soil Moisture and Temperature.
   - The device sends these values to the backend every 5 seconds.
   - **Device ID**: displayed on the dashboard.
   - **Status**: Shows if Connected/Approved.

## Data Flow

- The Hub sends data to `POST /api/hubs/data`.
- Data includes readings for virtual sensors:
  - `moisture` (Soil Moisture)
  - `temp` (Temperature)
