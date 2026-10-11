// ===== Pengaturan (ubah di sini) =====
const CONFIG = {
  broker: "wss://broker.hivemq.com:8884/mqtt",
  topic:  "ihsan-pil/jaraklayar/data",   // harus SAMA dengan TOPIC di firmware/src/main.cpp
  istirahatMenit: 20,                     // pengingat istirahat mata (ubah ke 1 untuk mencoba)
  demoAwal: true                          // true = mulai dengan data simulasi; ganti false saat ESP32 sudah siap
};
