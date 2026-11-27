// La mallette de l'Entité — HUB (ESP32-S3 N16R8 DORHEA, base). Jeu v0.5.4 (port du web), molettes, joystick, TM1637,
// barrettes WS2812B, voix I2S (2 × MAX98357A). Liaison ESP-NOW avec le 2e S3 et les 2 CYD (pas de fil de données).
// Moniteur série 115200 : TEST (banc hub), TESTALL (banc des 4 cartes), SEED n (partie de la graine n), STATE, VOIX, AIDE.
#include "config.h"
#include "hw.h"
#include "game.h"
#include "bench.h"

enl::Link L;

void handleMsg(const enl::Msg &m) {
  switch (m.h.type) {
    case enl::PING: { enl::Ping p; memcpy(&p, m.data, sizeof p); p.from = enl::HUB; L.send(m.h.src, enl::PONG, &p, sizeof p); break; }
    case enl::S3B_IN: if (m.len >= (int)sizeof(enl::S3bIn)) { enl::S3bIn in; memcpy(&in, m.data, sizeof in); if (g.phase != PH_BENCH) onS3bIn(in); else s3b.in = in; } break;
    case enl::TOUCH: if (m.len >= (int)sizeof(enl::Touch)) { enl::Touch t; memcpy(&t, m.data, sizeof t); onTouch(m.h.src, t); } break;
    case enl::LOG: { char buf[181] = {}; memcpy(buf, m.data, min(m.len, 180)); Serial.printf("[%s] %s\n", enl::roleName(m.h.src), buf); break; }
  }
}
void benchPumpLink() { enl::Msg m; while (L.poll(m)) handleMsg(m); }

String line;
void serialCmd() {
  while (Serial.available()) {
    char ch = Serial.read(); if (ch != '\n' && ch != '\r') { line += ch; continue; }
    line.trim(); String u = line; u.toUpperCase(); line = "";
    if (u == "TEST") runBench();
    else if (u == "TESTALL") benchAll();
    else if (u.startsWith("SEED ")) { uint32_t s = strtoul(u.c_str() + 5, nullptr, 10); startRun(); g.run = makeRun(s, PORT_WIRE); Serial.printf("[jeu] graine %u, %s, serie %s\n", s, g.run.sig.c_str(), g.run.serial); }
    else if (u == "STATE") Serial.printf("phase %d etape %d reste %.0f s, erreurs %d, palier %s, s3b %s (%lu ms), plug %d %d %d %d %d, cles %d, leviers %d, ESP-NOW rx %lu tx %lu err %lu\n",
      g.phase, g.step, g.remaining, g.errors, g.run.tier.c_str(), s3b.init ? "ok" : "absent", (unsigned long)(millis() - s3b.at), s3b.in.plug[0], s3b.in.plug[1], s3b.in.plug[2], s3b.in.plug[3], s3b.in.plug[4], s3b.in.locks, s3b.in.levers, (unsigned long)L.rx, (unsigned long)L.tx, (unsigned long)L.txErr);
    else if (u == "VOIX") Serial.printf("LittleFS %s, voix manquantes jouees : %lu (derniere : %s)\n", fsOk ? "ok" : "ABSENT", (unsigned long)voicesMissing, lastMissing.c_str());
    else if (u.length()) Serial.println("Commandes : TEST, TESTALL, SEED n, STATE, VOIX");
  }
}

void setup() {
  Serial.begin(115200); delay(400);
  Serial.printf("\nEntite HUB %s\n", FW_VERSION);
  hwBegin();
  if (!L.begin(enl::HUB)) Serial.println("ESP-NOW init FAIL");
  Serial.printf("MAC %s, LittleFS %s — tape TEST pour le banc\n", L.mac().c_str(), fsOk ? "ok" : "ABSENT (flasher les voix)");
  delay(30); hwPollButtons(); delay(40); hwPollButtons();
  bool bootBench = digitalRead(PIN_JOY_SW) == LOW;
  startRun();
  if (bootBench) { Serial.println("SW joystick tenu au demarrage : banc"); runBench(); }
}

void loop() {
  benchPumpLink();
  gameTick();
  static uint32_t tl = 0, te = 0, tc = 0; uint32_t now = millis();
  if (now - tl >= 33) { tl = now; renderLeds(); renderTm(); }
  if (now - te >= 66) { te = now; sendEye(); }
  if (now - tc >= 100) { tc = now; sendCyd2(); }
  serialCmd();
  delay(1);
}
