const $ = id => document.getElementById(id);

const X0 = 76, SKALA = 5.34;      // posisi layar dan skala cm -> piksel pada gambar
const MAX_RIWAYAT = 40;

let demoOn = CONFIG.demoAwal, brokerOn = false;
let lastData = 0, lastD = null, sepi = false;
let statusLama = "";
let target = 60, tampilJarak = 60;
const riwayat = [];

/* ---------- Tampilkan satu data ke seluruh dashboard ---------- */
function tampil(d) {
  if (d.status === "Kritis") d.status = "Bahaya";
  const st = d.status;
  $("status").textContent = st;
  $("status").className = "status " + st;
  $("scene").setAttribute("class", "s-" + st);

  $("jarak").textContent = d.jarak;
  $("cahaya").textContent = d.cahaya;
  $("cahayaKet").textContent = d.cahaya < 100 ? "Ruangan gelap" : (d.cahaya < 350 ? "Pencahayaan normal" : "Ruangan terang");
  $("risiko").textContent = d.risiko;
  $("durasiKet").textContent = "Durasi di depan layar: " + (d.durasi === undefined ? "–" : d.durasi + " menit");
  $("barFill").style.width = d.risiko + "%";
  $("barFill").parentNode.style.setProperty("--sc", "var(--" + (st === "Aman" ? "ok" : st === "Waspada" ? "warn" : "bad") + ")");

  // ilustrasi
  target = Math.min(d.jarak, 100);
  $("dimTxt").textContent = d.jarak + " cm";
  $("gelap").setAttribute("opacity", (0.6 * (1 - Math.min(d.cahaya, 500) / 500)).toFixed(2));

  // grafik riwayat
  riwayat.push(d.risiko);
  if (riwayat.length > MAX_RIWAYAT) riwayat.shift();
  const pts = riwayat.map((r, i) => (i * 400 / (MAX_RIWAYAT - 1)).toFixed(1) + "," + (130 - r * 1.2).toFixed(1));
  $("line").setAttribute("points", pts.join(" "));

  // peringatan
  if (st !== statusLama && st !== "Aman") {
    if ($("log").querySelector(".kosong")) $("log").innerHTML = "";
    const li = document.createElement("li");
    li.innerHTML = new Date().toLocaleTimeString("id-ID") + " <b class='" + st + "'>" + st + "</b>, jarak " + d.jarak + " cm";
    $("log").prepend(li);
    while ($("log").children.length > 5) $("log").lastChild.remove();
  }
  suaraProses(d);
  statusLama = st;
}

/* ---------- Gerakan mata (halus) ---------- */
const kurangGerak = matchMedia("(prefers-reduced-motion: reduce)").matches;
function animasi() {
  tampilJarak += (target - tampilJarak) * (kurangGerak ? 1 : 0.15);
  const x = X0 + tampilJarak * SKALA;
  $("eye").setAttribute("transform", "translate(" + x + " 95)");
  $("drop").setAttribute("x1", x); $("drop").setAttribute("x2", x);
  $("dim").setAttribute("x2", x);
  $("tickR").setAttribute("x1", x); $("tickR").setAttribute("x2", x);
  $("dimTxt").setAttribute("x", (X0 + x) / 2);
  requestAnimationFrame(animasi);
}

/* Suara AI ada di js/suara.js */

/* ---------- Mode data: Real-time / Demo ---------- */
const espOnline = () => Date.now() - lastData < CONFIG.offlineDetik * 1000;

function kirimDemo() {
  const jarak = +$("sj").value, cahaya = +$("sc").value;
  $("dj").textContent = jarak; $("dc").textContent = cahaya;
  const risiko = Math.round(hitungRisiko(jarak, cahaya));
  tampil({ jarak, cahaya, risiko, status: tentukanStatus(risiko) });
}

function tampilMenunggu() {
  $("status").textContent = "Menunggu ESP32";
  $("status").className = "status";
  $("scene").setAttribute("class", "s-none");
  $("saran").textContent = "Nyalakan ESP32 dan pastikan terhubung ke WiFi. Data muncul otomatis.";
  $("jarak").textContent = "–"; $("cahaya").textContent = "–"; $("risiko").textContent = "–";
  $("cahayaKet").textContent = "–"; $("durasiKet").textContent = "Durasi di depan layar: –";
  $("barFill").style.width = "0%";
}

function setPill() {
  const p = $("conn");
  let teks, kelas = "";
  if (demoOn)             { teks = "Mode demo"; kelas = " on"; }
  else if (!brokerOn)     { teks = "Real-time: broker terputus"; }
  else if (!espOnline())  { teks = "Real-time: menunggu ESP32"; kelas = " wait"; }
  else                    { teks = "Real-time: ESP32 aktif"; kelas = " on"; }
  p.textContent = teks;
  p.className = "pill" + kelas;
}

function aturMode(demo) {
  demoOn = demo;
  $("modeRT").classList.toggle("on", !demo);   $("modeRT").setAttribute("aria-pressed", String(!demo));
  $("modeDemo").classList.toggle("on", demo);  $("modeDemo").setAttribute("aria-pressed", String(demo));
  $("demoBox").classList.toggle("buka", demo);
  $("modeKet").textContent = demo ? "Data berasal dari slider simulasi di bawah."
                                  : "Data berasal dari ESP32 lewat broker MQTT.";
  setPill();
  if (demo) kirimDemo();
  else if (lastD && espOnline()) tampil(lastD);
  else tampilMenunggu();
}
$("modeRT").onclick   = () => aturMode(false);
$("modeDemo").onclick = () => aturMode(true);
$("sj").oninput = kirimDemo;
$("sc").oninput = kirimDemo;

/* ---------- MQTT (data dari ESP32) ---------- */
function sambungMQTT() {
  if (typeof mqtt === "undefined") { setPill(); return; }
  const c = mqtt.connect(CONFIG.broker, { clientId: "dash-" + Math.random().toString(16).slice(2, 8), reconnectPeriod: 3000 });
  c.on("connect", () => { brokerOn = true; c.subscribe(CONFIG.topic); setPill(); });
  c.on("close",   () => { brokerOn = false; setPill(); });
  c.on("message", (_, payload) => {
    let d;
    try { d = JSON.parse(payload.toString()); } catch (e) { return; }
    if (typeof d.jarak !== "number" || typeof d.cahaya !== "number") return;
    lastData = Date.now(); lastD = d; sepi = false;
    if (!demoOn) tampil(d);
    setPill();
  });
}

/* Cek berkala: tandai ESP32 terputus bila data berhenti */
setInterval(() => {
  setPill();
  if (!demoOn && lastD && !espOnline() && !sepi) { sepi = true; tampilMenunggu(); }
}, 1000);

/* ---------- Mulai ---------- */
aturMode(CONFIG.demoAwal);
animasi();
sambungMQTT();
