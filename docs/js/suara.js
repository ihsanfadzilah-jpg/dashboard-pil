// ===== Suara AI: kalimat mengikuti hasil fuzzy (status, jarak, cahaya) =====
// Dasar umum ergonomi: jarak layar sekitar satu lengan (50-70 cm), ruangan tidak terlalu gelap
// atau silau, dan istirahat mata dengan aturan 20-20-20 (tiap 20 menit lihat jauh 20 detik).

const PESAN = {
  Bahaya: [
    "Bahaya! Jarak Anda terlalu dekat dengan layar. Mundurlah sekarang.",
    "Peringatan! Wajah Anda terlalu dekat ke monitor. Jauhkan sedikit demi kesehatan mata.",
    "Terlalu dekat! Mundur sampai kira-kira sejauh satu lengan dari layar."
  ],
  Waspada: [
    "Perhatian, jarak Anda mulai terlalu dekat dengan layar.",
    "Mohon mundur sedikit dari layar agar mata tidak cepat lelah.",
    "Jarak Anda kurang ideal. Usahakan sekitar satu lengan dari layar."
  ],
  Aman: [
    "Jarak Anda sudah sesuai. Pertahankan posisi ini.",
    "Posisi duduk Anda sudah baik dan aman untuk mata.",
    "Bagus, jarak Anda dengan layar sudah ideal."
  ],
  CahayaSaja: [
    "Jarak Anda sudah sesuai, tetapi kondisi cahaya belum ideal.",
    "Posisi Anda sudah baik. Perbaiki pencahayaan ruangan agar mata lebih nyaman."
  ],
  Jauh: [
    "Jarak Anda cukup jauh dari layar. Dekatkan sedikit agar mata tidak menyipit.",
    "Anda terlalu jauh dari layar. Majukan sedikit supaya tulisan terbaca nyaman."
  ],
  Gelap: [
    "Ruangan terlalu gelap, nyalakan lampu agar mata tidak tegang.",
    "Pencahayaan kurang. Tambahkan cahaya ruangan supaya mata tidak cepat lelah."
  ],
  Terang: [
    "Cahaya ruangan sangat terang, hindari silau pada layar.",
    "Ruangan terlalu terang. Kurangi silau agar mata tetap nyaman."
  ],
  Istirahat: [
    "Sudah dua puluh menit di depan layar. Istirahatkan mata, lihat benda sejauh enam meter selama dua puluh detik.",
    "Waktunya istirahat sebentar. Alihkan pandangan dari layar dan berkedip beberapa kali."
  ]
};

const ULANG_DETIK = { Bahaya: 8, Waspada: 15 };   // diulang selama kondisi belum membaik
let suaraOn = false, kunciLama = "", bunyiTerakhir = 0, tundaBicara = null;
const indeksLama = {};

// Pilih kalimat acak, tidak sama dengan yang terakhir
function pilih(kunci) {
  const arr = PESAN[kunci];
  let i;
  do { i = Math.floor(Math.random() * arr.length); } while (arr.length > 1 && i === indeksLama[kunci]);
  indeksLama[kunci] = i;
  return arr[i];
}

function susunKalimat(d) {
  const k = kategori(d.jarak, d.cahaya);
  let teks;
  if (d.status === "Aman")                               teks = d.jarak > 90 ? pilih("Jauh") : pilih("Aman");
  else if (d.jarak >= 50 && k.cahaya !== "Normal")       teks = pilih("CahayaSaja");   // jarak sudah baik, masalahnya cahaya
  else                                                   teks = pilih(d.status);
  if (k.cahaya === "Gelap")  teks += " " + pilih("Gelap");
  if (k.cahaya === "Terang") teks += " " + pilih("Terang");
  return teks;
}

function bicara(teks) {
  clearTimeout(tundaBicara);
  tundaBicara = setTimeout(() => {          // jeda singkat supaya tidak bertumpuk saat slider digeser
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(teks);
    u.lang = "id-ID"; u.rate = 0.95;
    const v = speechSynthesis.getVoices().find(x => x.lang.toLowerCase().startsWith("id"));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }, 500);
}

// Dipanggil app.js setiap ada data baru
function suaraProses(d) {
  const k = kategori(d.jarak, d.cahaya);
  const kunci = d.status + "-" + k.cahaya + "-" + (d.jarak > 90 ? "jauh" : "");
  const jeda = (ULANG_DETIK[d.status] || Infinity) * 1000;

  if (kunci !== kunciLama || Date.now() - bunyiTerakhir > jeda) {
    const teks = susunKalimat(d);
    document.getElementById("saran").textContent = teks;   // tampil juga sebagai teks di dashboard
    if (suaraOn) bicara(teks);
    kunciLama = kunci; bunyiTerakhir = Date.now();
  }
}

document.getElementById("btnSuara").onclick = () => {
  suaraOn = !suaraOn;
  document.getElementById("btnSuara").textContent = suaraOn ? "Matikan suara" : "Aktifkan suara";
  if (suaraOn) bicara("Suara peringatan aktif");
};

// Pengingat istirahat mata (aturan 20-20-20)
setInterval(() => { if (suaraOn) bicara(pilih("Istirahat")); }, CONFIG.istirahatMenit * 60000);
