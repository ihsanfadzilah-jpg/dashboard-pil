(function () {
  const BROKER = "wss://broker.hivemq.com:8884/mqtt";   // samakan dengan alamat broker di js/config.js
  const TOPIK  = "ihsan-pil/jaraklayar/kamera";

  const stat = document.getElementById("kam-status");
  const sens = document.getElementById("kam-sensor");
  const cam  = document.getElementById("kam-cam");
  if (!stat || !sens || !cam) return;

  const warna = { aman: "#166534", waspada: "#a16207", dekat: "#991b1b", idle: "#334155" };
  const teks  = { aman: "AMAN", waspada: "WASPADA", dekat: "TERLALU DEKAT", idle: "Wajah belum terdeteksi" };

  const c = mqtt.connect(BROKER, { clientId: "dash-kamera-" + Math.random().toString(16).slice(2, 8) });
  c.on("connect", () => c.subscribe(TOPIK));
  c.on("message", (_t, m) => {
    try {
      const d = JSON.parse(m.toString());
      stat.textContent = teks[d.status] || "-";
      stat.style.background = warna[d.status] || warna.idle;
      sens.textContent = d.sensor_cm != null ? d.sensor_cm.toFixed(1) : "–";
      cam.textContent  = d.camera_cm != null ? d.camera_cm.toFixed(1) : "–";
    } catch (e) {}
  });
})();