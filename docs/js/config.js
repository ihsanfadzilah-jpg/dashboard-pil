// ===== Pengaturan (ubah di sini) =====
const CONFIG = {
  broker: "wss://broker.hivemq.com:8884/mqtt",
  topic:  "ihsan-pil/jaraklayar/data",   // harus SAMA dengan TOPIC di firmware/src/main.cpp
  istirahatMenit: 20,                     // pengingat istirahat mata (ubah ke 1 untuk mencoba)
  demoAwal: false,                        // false = mulai di mode Real-time (data dari ESP32); true = mulai di mode Demo
  offlineDetik: 6                         // ESP32 dianggap terputus bila tidak ada data selama sekian detik
};
