// EntiteCyd.h — firmware commun des deux CYD (ELEGOO ESP32-2432S028R : ILI9341 240×320, tactile XPT2046, 4 Mo).
// Inclure APRÈS « #define CYD_ROLE 1 » (CYD 1, l'œil du couvercle) ou « #define CYD_ROLE 2 » (CYD 2, écran de la base).
// Données : ESP-NOW uniquement (pas d'UART de données). Alim : 5 V sur P1 ; jamais USB + VIN en même temps sans diode.
// Banc : TEST au moniteur série (115200), ou doigt posé sur l'écran au démarrage, ou commande BENCH du hub.
#pragma once
#ifndef CYD_ROLE
#error "definir CYD_ROLE 1 ou 2 avant d'inclure EntiteCyd.h"
#endif
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <XPT2046_Touchscreen.h>
#include <Preferences.h>
#include <EntiteLink.h>

#define CYD_FW_VERSION "cyd-1.0.0"
// ---- broches de la carte (fixes, ne pas réutiliser)
static const int TFT_MISO = 12, TFT_MOSI = 13, TFT_SCK = 14, TFT_CS = 15, TFT_DC = 2, TFT_BL = 21;
static const int T_CLK = 25, T_MISO = 39, T_MOSI = 32, T_CS = 33, T_IRQ = 36;
static const int LED_R = 4, LED_G = 16, LED_B = 17;   // DEL RVB, actives à LOW

SPIClass hspi(HSPI), tspi(VSPI);
Adafruit_ILI9341 tft(&hspi, TFT_DC, TFT_CS, -1);
XPT2046_Touchscreen ts(T_CS, T_IRQ);
Preferences prefs;
enl::Link L;
static const uint8_t MY_ROLE = CYD_ROLE == 1 ? enl::CYD1 : enl::CYD2;
int calX0 = 300, calX1 = 3800, calY0 = 300, calY1 = 3800;   // calibration par défaut, À CONFIRMER (banc : CAL)
uint32_t lastHub = 0;

void rgb(bool r, bool g, bool b) { digitalWrite(LED_R, !r); digitalWrite(LED_G, !g); digitalWrite(LED_B, !b); }
bool touchXY(int &x, int &y, int &z) {
  if (!ts.touched()) return false;
  TS_Point p = ts.getPoint(); z = p.z;
  x = map(p.x, calX0, calX1, 0, tft.width()); y = map(p.y, calY0, calY1, 0, tft.height());
  x = constrain(x, 0, tft.width() - 1); y = constrain(y, 0, tft.height() - 1); return true;
}
bool touchRaw(int &rx, int &ry) { if (!ts.touched()) return false; TS_Point p = ts.getPoint(); rx = p.x; ry = p.y; return true; }
void centerText(const char *s, int y, uint8_t size, uint16_t col, uint16_t bg = ILI9341_BLACK) {
  tft.setTextSize(size); tft.setTextColor(col, bg); int16_t x1, y1; uint16_t w, h; tft.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
  tft.setCursor((tft.width() - w) / 2, y); tft.print(s);
}

// ---------------- banc
String benchOut;
void blog(const String &s) { Serial.println(s); enl::LogLine l = {}; strncpy(l.txt, s.c_str(), sizeof l.txt - 1); L.send(enl::HUB, enl::LOG, &l, sizeof l); }
void calibrate() {
  int rx, ry, ax = 0, ay = 0, bx = 0, by = 0;
  for (int k = 0; k < 2; k++) {
    tft.fillScreen(ILI9341_BLACK); int cx = k ? tft.width() - 20 : 20, cy = k ? tft.height() - 20 : 20;
    tft.drawFastHLine(cx - 10, cy, 21, ILI9341_WHITE); tft.drawFastVLine(cx, cy - 10, 21, ILI9341_WHITE);
    centerText(k ? "TOUCHE LA CROIX EN BAS A DROITE" : "TOUCHE LA CROIX EN HAUT A GAUCHE", 110, 1, ILI9341_WHITE);
    while (ts.touched()) delay(10);
    uint32_t t0 = millis(); bool got = false;
    while (millis() - t0 < 20000 && !got) { if (touchRaw(rx, ry)) { delay(80); if (touchRaw(rx, ry)) got = true; } delay(10); }
    if (!got) { blog("  calibration : pas de toucher, gardee"); return; }
    (k ? bx : ax) = rx; (k ? by : ay) = ry;
  }
  // croix à 20 px du bord : on extrapole aux bords
  float sx = (bx - ax) / float(tft.width() - 40), sy = (by - ay) / float(tft.height() - 40);
  calX0 = ax - 20 * sx; calX1 = bx + 20 * sx; calY0 = ay - 20 * sy; calY1 = by + 20 * sy;
  prefs.putInt("x0", calX0); prefs.putInt("x1", calX1); prefs.putInt("y0", calY0); prefs.putInt("y1", calY1);
  blog(String("  calibration enregistree : x ") + calX0 + ".." + calX1 + "  y " + calY0 + ".." + calY1);
}
void runBench() {
  int fails = 0;
  blog(String("=== BANC CYD") + CYD_ROLE + " " CYD_FW_VERSION " — MAC " + L.mac() + " ===");
  blog("[1] Couleurs plein ecran (regarder : rouge, vert, bleu, blanc, noir, sans bande morte)");
  const uint16_t C[5] = {ILI9341_RED, ILI9341_GREEN, ILI9341_BLUE, ILI9341_WHITE, ILI9341_BLACK}; const char *N[5] = {"ROUGE", "VERT", "BLEU", "BLANC", "NOIR"};
  for (int i = 0; i < 5; i++) { tft.fillScreen(C[i]); blog(String("  ") + N[i]); delay(700); }
  blog("  ecran : VISUEL (a confirmer par Pascal)");
  blog("[2] DEL RVB de la carte : R, V, B");
  rgb(1, 0, 0); delay(400); rgb(0, 1, 0); delay(400); rgb(0, 0, 1); delay(400); rgb(0, 0, 0);
  blog("[3] Tactile 30 s : touche les 4 coins (coordonnees au serie). Tape CAL au serie pour calibrer.");
  tft.fillScreen(ILI9341_BLACK); centerText("TOUCHE LES 4 COINS", 100, 2, ILI9341_YELLOW);
  bool q[4] = {}; uint32_t t0 = millis(), lastP = 0; String line;
  while (millis() - t0 < 30000) {
    int x, y, z; if (touchXY(x, y, z) && millis() - lastP > 120) {
      lastP = millis(); TS_Point p = ts.getPoint(); tft.fillCircle(x, y, 3, ILI9341_CYAN);
      int qi = (x >= tft.width() / 2) + 2 * (y >= tft.height() / 2); if (!q[qi]) { q[qi] = true; }
      Serial.printf("  touch x=%d y=%d (brut %d,%d z=%d) quart %d\n", x, y, p.x, p.y, z, qi + 1);
    }
    while (Serial.available()) { char ch = Serial.read(); if (ch == '\n' || ch == '\r') { line.trim(); line.toUpperCase(); if (line == "CAL") { calibrate(); tft.fillScreen(ILI9341_BLACK); t0 = millis(); } line = ""; } else line += ch; }
    delay(5);
  }
  int nq = q[0] + q[1] + q[2] + q[3];
  blog(String("  tactile : ") + nq + "/4 quarts " + (nq == 4 ? "PASS" : "FAIL")); if (nq < 4) fails++;
  blog("[4] ESP-NOW ping hub");
  uint32_t tp = micros(); enl::Ping pg = {tp, MY_ROLE}; L.send(enl::HUB, enl::PING, &pg, sizeof pg);
  bool pong = false; uint32_t tw = millis(); enl::Msg m;
  while (millis() - tw < 1500 && !pong) { while (L.poll(m)) if (m.h.type == enl::PONG && m.h.src == enl::HUB) { pong = true; blog(String("  PONG hub ") + (micros() - tp) / 1000.0 + " ms RSSI " + m.rssi + " PASS"); } delay(5); }
  if (!pong) { blog("  hub muet FAIL (hub eteint ?)"); fails++; }
  blog(String("=== FIN BANC CYD") + CYD_ROLE + " : " + (fails ? String(fails) + " FAIL" : "TOUT PASS") + " ===");
  tft.fillScreen(ILI9341_BLACK);
}

void cydCommonSetup() {
  Serial.begin(115200); delay(200);
  pinMode(LED_R, OUTPUT); pinMode(LED_G, OUTPUT); pinMode(LED_B, OUTPUT); rgb(0, 0, 0);
  pinMode(TFT_BL, OUTPUT); digitalWrite(TFT_BL, HIGH);
  hspi.begin(TFT_SCK, TFT_MISO, TFT_MOSI, TFT_CS); tft.begin(40000000); tft.setRotation(1); tft.fillScreen(ILI9341_BLACK); tft.cp437(true);
  tspi.begin(T_CLK, T_MISO, T_MOSI, T_CS); ts.begin(tspi); ts.setRotation(1);
  prefs.begin("entite-cyd", false);
  calX0 = prefs.getInt("x0", calX0); calX1 = prefs.getInt("x1", calX1); calY0 = prefs.getInt("y0", calY0); calY1 = prefs.getInt("y1", calY1);
  Serial.printf("\nEntite CYD%d %s\n", CYD_ROLE, CYD_FW_VERSION);
  if (!L.begin(MY_ROLE)) Serial.println("ESP-NOW init FAIL");
  Serial.println("MAC " + L.mac() + " — tape TEST pour le banc, CAL pour calibrer le tactile");
  if (ts.touched()) { Serial.println("doigt sur l'ecran au demarrage : banc"); runBench(); }
}
String serLine;
void cydSerial() {
  while (Serial.available()) { char ch = Serial.read(); if (ch == '\n' || ch == '\r') { serLine.trim(); serLine.toUpperCase(); if (serLine == "TEST") runBench(); else if (serLine == "CAL") calibrate(); serLine = ""; } else serLine += ch; }
}
// renvoie vrai si le message a été traité (ping / banc)
bool cydCommonMsg(const enl::Msg &m) {
  if (m.h.src == enl::HUB) lastHub = millis();
  if (m.h.type == enl::PING) { enl::Ping p; memcpy(&p, m.data, sizeof p); p.from = MY_ROLE; L.send(m.h.src, enl::PONG, &p, sizeof p); return true; }
  if (m.h.type == enl::BENCH && m.len >= 1 && m.data[0]) { runBench(); return true; }
  return false;
}
