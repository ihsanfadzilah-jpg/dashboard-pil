// ===== Fuzzy Sugeno orde-0: jarak + cahaya -> risiko (0-100) =====
// Sama persis dengan yang dihitung di firmware ESP32.

const turun    = (x, a, b) => Math.min(1, Math.max(0, (b - x) / (b - a)));
const naik     = (x, a, b) => 1 - turun(x, a, b);
const segitiga = (x, a, b, c) => Math.max(0, Math.min((x - a) / (b - a), (c - x) / (c - b)));

// Derajat keanggotaan tiap kategori
function derajat(jarak, cahaya) {
  return {
    j: [turun(jarak, 25, 45), segitiga(jarak, 30, 50, 70), naik(jarak, 55, 75)],              // Dekat, Sedang, Jauh
    c: [turun(cahaya, 50, 150), segitiga(cahaya, 100, 250, 400), naik(cahaya, 350, 500)]      // Gelap, Normal, Terang
  };
}

function hitungRisiko(jarak, cahaya) {
  const { j, c } = derajat(jarak, cahaya);
  const aturan = [[100, 80, 60],   // Dekat  : Gelap, Normal, Terang
                  [ 60, 30, 20],   // Sedang
                  [ 30,  5,  0]];  // Jauh

  let atas = 0, bawah = 0;
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      const w = Math.min(j[a], c[b]);   // AND = min
      atas  += w * aturan[a][b];
      bawah += w;
    }
  }
  return bawah > 0 ? atas / bawah : 0;
}

function tentukanStatus(r) {
  if (r < 30) return "Aman";
  if (r < 65) return "Waspada";
  return "Bahaya";
}

// Kategori yang paling dominan (dipakai untuk memilih kalimat suara)
function kategori(jarak, cahaya) {
  const { j, c } = derajat(jarak, cahaya);
  const maks = arr => arr.indexOf(Math.max(...arr));
  return { jarak: ["Dekat", "Sedang", "Jauh"][maks(j)], cahaya: ["Gelap", "Normal", "Terang"][maks(c)] };
}
