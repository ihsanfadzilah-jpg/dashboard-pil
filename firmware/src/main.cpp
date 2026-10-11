// ESP32 DOIT DevKit V1: HC-SR04 + BH1750 + OLED SSD1306 + LED + buzzer
// Fuzzy (jarak, cahaya, durasi) -> OLED, LED, buzzer, dan dikirim ke dashboard lewat MQTT.
#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <BH1750.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "secrets.h"            // WIFI_SSID dan WIFI_PASS (file ini tidak ikut ke GitHub)

#define TRIG   5
#define ECHO   18
#define LED    25
#define BUZZER 27

// ===== MQTT: topik harus SAMA dengan docs/js/config.js =====
const char* MQTT_HOST  = "broker.hivemq.com";
const char* MQTT_TOPIK = "ihsan-pil/jaraklayar/data";

// ===== PENGATURAN =====
const float PERCEPAT_WAKTU = 1.0;     // 1 = waktu asli. Isi 60 untuk uji cepat (1 detik = 1 menit)
const float JARAK_PENGGUNA = 150;     // di atas ini dianggap tidak ada pengguna (cm)

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
BH1750 lightMeter;
WiFiClient espClient;
PubSubClient mqtt(espClient);

float jarak = 200, lux = 300, skor = 0, durasiMenit = 0, aktifDetik = 0;
int idxJarak = 3, idxCahaya = 2, levelRisk = 0;
bool adaPengguna = false;
unsigned long tSensor = 0, tTerakhirAda = 0, tKirim = 0, tCoba = 0;

volatile float skorBuzz = 0;
volatile bool  bunyiAktif = false;

const char* NAMA_JARAK[]  = {"TERLALU DEKAT", "AGAK DEKAT", "IDEAL", "TERLALU JAUH"};
const char* NAMA_CAHAYA[] = {"GELAP", "REDUP", "IDEAL", "SILAU"};
const char* NAMA_STATUS[] = {"AMAN", "WASPADA", "BAHAYA", "KRITIS"};

// Basis aturan [jarak][cahaya][durasi] -> level (0 aman, 1 waspada, 2 bahaya, 3 kritis)
const byte RULE[4][4][3] = {
  { {3,3,3}, {3,3,3}, {3,3,3}, {3,3,3} },   // Terlalu dekat
  { {2,2,3}, {1,1,2}, {1,1,2}, {2,2,3} },   // Agak dekat
  { {1,1,2}, {0,0,1}, {0,0,1}, {1,1,2} },   // Jarak ideal
  { {1,1,2}, {0,1,1}, {0,0,1}, {1,1,2} }    // Terlalu jauh
};
const float Z[4] = {10, 40, 70, 95};

float trapmf(float x, float a, float b, float c, float d) {
  if (x < a || x > d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

int terbesar(float* a, int n) {
  int k = 0;
  for (int i = 1; i < n; i++) if (a[i] > a[k]) k = i;
  return k;
}

float bacaJarak() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long dur = pulseIn(ECHO, HIGH, 30000);
  if (dur == 0) return 400;
  return dur * 0.0343 / 2;
}

void hitungFuzzy(float d, float l, float t) {
  float mj[4] = { trapmf(d, 0, 0, 20, 35), trapmf(d, 20, 35, 45, 55), trapmf(d, 45, 55, 75, 90), trapmf(d, 75, 90, 150, 150) };
  float mc[4] = { trapmf(l, 0, 0, 50, 120), trapmf(l, 80, 150, 250, 350), trapmf(l, 250, 350, 500, 700), trapmf(l, 500, 800, 100000, 100000) };
  float mt[3] = { trapmf(t, 0, 0, 10, 20), trapmf(t, 10, 20, 30, 40), trapmf(t, 30, 45, 100000, 100000) };

  float atas = 0, bawah = 0;
  for (int i = 0; i < 4; i++)
    for (int j = 0; j < 4; j++)
      for (int k = 0; k < 3; k++) {
        float w = min(mj[i], min(mc[j], mt[k]));
        if (w > 0) { atas += w * Z[RULE[i][j][k]]; bawah += w; }
      }

  skor = (bawah > 0) ? atas / bawah : 0;
  levelRisk = (skor < 25) ? 0 : (skor < 55) ? 1 : (skor < 82) ? 2 : 3;
  idxJarak  = terbesar(mj, 4);
  idxCahaya = terbesar(mc, 4);
}

// ===== OLED =====
void tengah(const char* s, int y, int size) {
  oled.setTextSize(size);
  oled.setCursor((128 - (int)strlen(s) * 6 * size) / 2, y);
  oled.print(s);
}
void bingkai() { oled.drawRoundRect(0, 0, 128, 64, 4, SSD1306_WHITE); }

void splash() {
  oled.setTextColor(SSD1306_WHITE);

  oled.clearDisplay(); bingkai();
  tengah("PROYEK PiL", 5, 1);
  oled.drawFastHLine(10, 16, 108, SSD1306_WHITE);
  tengah("RANCANG BANGUN", 22, 1);
  tengah("SISTEM PERINGATAN", 31, 1);
  tengah("JARAK AMAN LAYAR", 40, 1);
  tengah("MONITOR", 49, 1);
  oled.display(); delay(2500);

  oled.clearDisplay(); bingkai();
  tengah("BERBASIS LOGIKA FUZZY", 8, 1);
  tengah("MENGGUNAKAN ESP32-CAM", 18, 1);
  tengah("TERINTEGRASI WEB", 28, 1);
  tengah("DASHBOARD DAN", 38, 1);
  tengah("NOTIFIKASI SUARA AI", 48, 1);
  oled.display(); delay(3000);

  oled.clearDisplay(); bingkai();
  tengah("DISUSUN OLEH", 3, 1);
  tengah("MUHAMMAD", 12, 2);
  tengah("IHSAN NUR", 28, 2);
  tengah("FADZILAH", 44, 2);
  oled.display(); delay(3000);

  for (int p = 0; p <= 100; p += 5) {
    oled.clearDisplay(); bingkai();
    tengah("MEMULAI SISTEM", 14, 1);
    oled.drawRect(14, 30, 100, 10, SSD1306_WHITE);
    oled.fillRect(16, 32, (96 * p) / 100, 6, SSD1306_WHITE);
    tengah(p < 50 ? "Kalibrasi sensor..." : "Menyambung WiFi...", 48, 1);
    oled.display();
    delay(60);
  }
}

void header() {
  oled.fillRect(0, 0, 128, 10, SSD1306_WHITE);
  oled.setTextColor(SSD1306_BLACK);
  oled.setTextSize(1);
  oled.setCursor(3, 1);
  oled.print("JARAK AMAN LAYAR");
  // penanda koneksi: W = WiFi, M = MQTT
  oled.setCursor(104, 1);
  oled.print(WiFi.status() == WL_CONNECTED ? "W" : "-");
  oled.print(mqtt.connected() ? "M" : "-");
  char buf[8];
  snprintf(buf, sizeof(buf), "%dm", (int)durasiMenit);
  oled.setCursor(100 - (int)strlen(buf) * 6, 1);
  oled.print(buf);
  oled.setTextColor(SSD1306_WHITE);
}

void tampilDashboard() {
  oled.invertDisplay(levelRisk == 3 && ((millis() / 300) % 2));
  oled.clearDisplay();
  header();

  oled.setTextSize(2);
  oled.setCursor(0, 13);
  oled.printf("%.0f", jarak);
  oled.setTextSize(1);
  oled.setCursor(oled.getCursorX() + 2, 20);
  oled.print("cm");

  oled.setCursor(72, 13); oled.print("CAHAYA");
  oled.setCursor(72, 22); oled.printf("%.0f lx", lux);

  oled.drawRect(0, 30, 100, 7, SSD1306_WHITE);
  oled.fillRect(2, 32, (int)(skor * 96 / 100), 3, SSD1306_WHITE);
  oled.setCursor(104, 30);
  oled.printf("%d%%", (int)skor);

  oled.setCursor(0, 39); oled.printf("Jarak : %s", NAMA_JARAK[idxJarak]);
  oled.setCursor(0, 47); oled.printf("Cahaya: %s", NAMA_CAHAYA[idxCahaya]);

  oled.fillRect(0, 56, 128, 8, SSD1306_WHITE);
  oled.setTextColor(SSD1306_BLACK);
  char st[24];
  snprintf(st, sizeof(st), "STATUS: %s", NAMA_STATUS[levelRisk]);
  oled.setCursor((128 - (int)strlen(st) * 6) / 2, 56);
  oled.print(st);
  oled.setTextColor(SSD1306_WHITE);
  oled.display();
}

void tampilStandby() {
  oled.invertDisplay(false);
  oled.clearDisplay();
  header();
  tengah("STANDBY", 18, 2);
  tengah("Menunggu pengguna...", 40, 1);
  char buf[24];
  snprintf(buf, sizeof(buf), "Cahaya: %.0f lx", lux);
  tengah(buf, 52, 1);
  oled.display();
}

// ===== LED + buzzer: makin berisiko makin cepat (1000 ms -> 50 ms) =====
void taskAksi(void* p) {
  bool s = false;
  unsigned long t = millis();
  for (;;) {
    float sk = skorBuzz;
    if (bunyiAktif && sk >= 25) {
      if (sk > 90) sk = 90;
      unsigned long interval = 1000 - (sk - 25) * (950.0 / 65.0);
      if (millis() - t >= interval) {
        t = millis();
        s = !s;
        digitalWrite(LED, s);
        digitalWrite(BUZZER, s);
      }
    } else {
      s = false;
      digitalWrite(LED, LOW);
      digitalWrite(BUZZER, LOW);
    }
    delay(5);
  }
}

// ===== WiFi + MQTT (tidak memblokir sensor dan OLED) =====
void jagaKoneksi() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!mqtt.connected() && millis() - tCoba > 5000) {
    tCoba = millis();
    String id = "esp32-pil-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    mqtt.connect(id.c_str());
  }
}

void kirimData() {
  if (!mqtt.connected() || millis() - tKirim < 1000) return;
  tKirim = millis();
  float jk = jarak > 200 ? 200 : jarak;
  float r  = adaPengguna ? skor : 0;
  const char* st = r < 30 ? "Aman" : (r < 65 ? "Waspada" : "Bahaya");   // sama dengan batas di dashboard
  char msg[160];
  snprintf(msg, sizeof(msg),
    "{\"jarak\":%.1f,\"cahaya\":%.0f,\"risiko\":%.0f,\"status\":\"%s\",\"durasi\":%.1f}",
    jk, lux, r, st, durasiMenit);
  mqtt.publish(MQTT_TOPIK, msg);
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  Wire.begin(21, 22);
  Wire.setClock(400000);
  lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);

  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED tidak terdeteksi");
    while (true);
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);     // tersambung di latar belakang saat splash tampil
  mqtt.setServer(MQTT_HOST, 1883);

  splash();
  xTaskCreatePinnedToCore(taskAksi, "aksi", 2048, NULL, 1, NULL, 0);
  tSensor = millis();
}

void loop() {
  jagaKoneksi();
  mqtt.loop();
  kirimData();

  unsigned long now = millis();
  if (now - tSensor >= 300) {
    float dt = (now - tSensor) / 1000.0;
    tSensor = now;

    float d = bacaJarak();
    jarak = 0.6 * jarak + 0.4 * d;
    lux = lightMeter.readLightLevel();
    if (lux < 0) lux = 0;

    adaPengguna = (jarak <= JARAK_PENGGUNA);

    if (adaPengguna) { aktifDetik += dt; tTerakhirAda = now; }
    else if (now - tTerakhirAda > 20000) aktifDetik = 0;     // pergi lebih dari 20 detik: durasi mulai lagi
    durasiMenit = aktifDetik * PERCEPAT_WAKTU / 60.0;

    if (adaPengguna) { hitungFuzzy(jarak, lux, durasiMenit); tampilDashboard(); }
    else             { skor = 0; levelRisk = 0; tampilStandby(); }

    skorBuzz = skor;
    bunyiAktif = adaPengguna;

    Serial.printf("Jarak: %.1f cm | Cahaya: %.0f lx | Durasi: %.1f mnt | Skor: %.0f | %s | WiFi:%s MQTT:%s\n",
                  jarak, lux, durasiMenit, skor, adaPengguna ? NAMA_STATUS[levelRisk] : "STANDBY",
                  WiFi.status() == WL_CONNECTED ? "ok" : "putus", mqtt.connected() ? "ok" : "putus");
  }
}
