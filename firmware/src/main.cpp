#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <BH1750.h>

// ====== GANTI TOPIK INI ======
#include "secrets.h"   // isi WIFI_SSID dan WIFI_PASS di file ini
const char* TOPIC     = "ihsan-pil/jaraklayar/data";   // harus sama dengan dashboard
// =======================

const char* BROKER = "broker.hivemq.com";
const int TRIG = 13, ECHO = 12, SDA_PIN = 14, SCL_PIN = 15;

WiFiClient net;
PubSubClient mqtt(net);
BH1750 lux;

// ---- Fungsi keanggotaan ----
float down(float x, float a, float b) { return x <= a ? 1 : (x >= b ? 0 : (b - x) / (b - a)); }
float up(float x, float a, float b)   { return 1 - down(x, a, b); }
float tri(float x, float a, float b, float c) {
  if (x <= a || x >= c) return 0;
  return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
}

// ---- Fuzzy Sugeno orde-0: 2 input (jarak, cahaya) -> 1 output (risiko 0-100) ----
float fuzzyRisiko(float cm, float lx) {
  float j[3] = { down(cm, 25, 45), tri(cm, 30, 50, 70), up(cm, 55, 75) };      // dekat, sedang, jauh
  float c[3] = { down(lx, 50, 150), tri(lx, 100, 250, 400), up(lx, 350, 500) }; // gelap, normal, terang
  const float z[3][3] = { {100, 80, 60}, {60, 30, 20}, {30, 5, 0} };           // aturan (baris=jarak, kolom=cahaya)
  float num = 0, den = 0;
  for (int a = 0; a < 3; a++) for (int b = 0; b < 3; b++) {
    float w = min(j[a], c[b]);
    num += w * z[a][b]; den += w;
  }
  return den > 0 ? num / den : 0;
}

float bacaJarak() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long t = pulseIn(ECHO, HIGH, 30000);
  return t == 0 ? 200 : t * 0.0343 / 2;
}

void konek() {
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  while (!mqtt.connected()) {
    String id = "esp32cam-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (!mqtt.connect(id.c_str())) delay(2000);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  Wire.begin(SDA_PIN, SCL_PIN);
  lux.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  mqtt.setServer(BROKER, 1883);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED || !mqtt.connected()) konek();
  mqtt.loop();

  float cm = bacaJarak(), lx = lux.readLightLevel();
  float r = fuzzyRisiko(cm, lx);
  const char* st = r < 30 ? "Aman" : (r < 65 ? "Waspada" : "Bahaya");

  char buf[128];
  snprintf(buf, sizeof(buf), "{\"jarak\":%.1f,\"cahaya\":%.0f,\"risiko\":%.0f,\"status\":\"%s\"}", cm, lx, r, st);
  mqtt.publish(TOPIC, buf);
  Serial.println(buf);
  delay(1000);
}
