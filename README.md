# Jarak Aman Layar Monitor (PiL)

Dashboard web (`docs/`) + firmware ESP32 (`firmware/`) + simulasi fuzzy (`simulasi/`).

Alur data: ESP32 -> broker MQTT (broker.hivemq.com) -> dashboard di GitHub Pages.
Topik MQTT (harus sama di dua tempat): `ihsan-pil/jaraklayar/data`
- dashboard: `docs/js/config.js`
- firmware: `firmware/src/main.cpp` (MQTT_TOPIK)

## Mode dashboard
- **Real-time**: data dari ESP32 (default). Pojok kanan atas menampilkan status: broker terputus, menunggu ESP32, atau ESP32 aktif.
- **Demo**: data dari slider simulasi. Pilih lewat tombol di kartu "Mode data".

## Firmware
Pin: HC-SR04 TRIG 5 / ECHO 18 (pakai pembagi tegangan 1k+2k), BH1750 dan OLED di SDA 21 / SCL 22, LED 25, buzzer 27.
Salin `firmware/src/secrets.h.example` menjadi `secrets.h` bila belum ada, isi WiFi hotspot HP (2.4 GHz).
Upload: `pio run -t upload`, monitor: `pio device monitor -b 115200`.
