const $ = id => document.getElementById(id);

const X0 = 76, SKALA = 5.34;      // posisi layar dan skala cm -> piksel pada gambar
const MAX_RIWAYAT = 40;

let demoOn = CONFIG.demoAwal, brokerOn = false;
let statusLama = "";
let target = 60, tampilJarak = 60;
const riwayat = [];

/* ---------- Tampilkan satu data ke seluruh dashboard ---------- */
function tampil(d) {
  const st = d.status;
  $("status").textContent = st;
  $("status").className = "status " + st;
  $("scene").setAttribute("class", "s-" + st);

  $("jarak").textContent = d.jarak;
  $("cahaya").textContent = d.cahaya;
  $("cahayaKet").textContent = d.cahaya < 100 ? "Ruangan gelap" : (d.cahaya < 350 ? "Pencahayaan normal" : "Ruangan terang");
  $("risiko").textContent = d.risiko;
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

/* ---------- Mode demo ---------- */
function kirimDemo() {
  const jarak = +$("sj").value, cahaya = +$("sc").value;
  $("dj").textContent = jarak; $("dc").textContent = cahaya;
  const risiko = Math.round(hitungRisiko(jarak, cahaya));
  tampil({ jarak, cahaya, risiko, status: tentukanStatus(risiko) });
}
function aturDemo() {
  $("demoBox").classList.toggle("buka", demoOn);
  setPill();
  if (demoOn) kirimDemo();
}
$("demoOn").onchange = e => { demoOn = e.target.checked; aturDemo(); };
$("sj").oninput = kirimDemo;
$("sc").oninput = kirimDemo;

/* ---------- Status koneksi ---------- */
function setPill() {
  const p = $("conn");
  p.textContent = demoOn ? "Mode demo" : (brokerOn ? "Terhubung ke broker" : "Terputus");
  p.className = "pill" + (demoOn || brokerOn ? " on" : "");
}

/* ---------- MQTT (data dari ESP32) ---------- */
function sambungMQTT() {
  if (typeof mqtt === "undefined") return;
  const c = mqtt.connect(CONFIG.broker);
  c.on("connect", () => { brokerOn = true; c.subscribe(CONFIG.topic); setPill(); });
  c.on("close",   () => { brokerOn = false; setPill(); });
  c.on("message", (_, payload) => {
    if (demoOn) return;
    try { tampil(JSON.parse(payload.toString())); } catch (e) {}
  });
}

/* ---------- Mulai ---------- */
$("demoOn").checked = demoOn;
aturDemo();
animasi();
sambungMQTT();
