// bench.h — banc d'essai du hub : TEST au moniteur série (115200) ou SW du joystick tenu au démarrage.
// TESTALL : lance aussi le banc du 2e S3 et des 2 CYD (leurs lignes arrivent ici en ESP-NOW, préfixées).
#pragma once
#include "game.h"

int benchFails = 0; String benchSummary;
void bres(const String &name, bool pass, const String &detail = "") {
  String l = String("  ") + (pass ? "PASS " : "FAIL ") + name + (detail.length() ? "  (" + detail + ")" : "");
  Serial.println(l); benchSummary += l + "\n"; if (!pass) benchFails++;
}
void bvis(const String &name, const String &detail) { String l = "  VISU " + name + "  (" + detail + ")"; Serial.println(l); benchSummary += l + "\n"; }
bool benchSerialAbort() { while (Serial.available()) { if (Serial.read() == 'q') return true; } return false; }
void benchPumpLink();

void runBench() {
  Phase saved = g.phase; g.phase = PH_BENCH; sayClear(); benchFails = 0; benchSummary = "";
  Serial.printf("\n=== BANC HUB %s — MAC %s ===\n", FW_VERSION, L.mac().c_str());
  { enl::Cyd2 c = {}; c.mode = enl::C_TEST; strcpy(c.text, "HUB"); strcpy(c.sub, "banc en cours"); L.send(enl::CYD2, enl::CYD2_STATE, &c, sizeof c); enl::Eye e = {enl::M_TEST, 0, 0, 0}; L.send(enl::CYD1, enl::EYE, &e, sizeof e); }

  Serial.println("[1] Repos : ne touche a rien (molettes au cran, joystick au centre)");
  struct P { const char *n; uint8_t pin; } ins[] = {{"E1 CLK", 9}, {"E1 DT", 10}, {"E1 SW", 11}, {"E2 CLK", 12}, {"E2 DT", 13}, {"E2 SW", 14}, {"E3 CLK", 15}, {"E3 DT", 16}, {"E3 SW", 17},
    {"E4 CLK", 18}, {"E4 DT", 21}, {"E4 SW", 38}, {"E5 CLK", 39}, {"E5 DT", 40}, {"E5 SW (GPIO1)", 1}, {"JOY SW", 6}};
  for (auto &p : ins) { bool v = digitalRead(p.pin); bres(String(p.n) + " GPIO" + p.pin + " repos HIGH", v, v ? "" : "LOW au repos : court-circuit, module absent ou cran entre deux"); }
  joyCalibrate(); bres("Joystick centre X GPIO4", joyCX > 1000 && joyCX < 3100, String(joyCX)); bres("Joystick centre Y GPIO5", joyCY > 1000 && joyCY < 3100, String(joyCY));

  Serial.println("[2] TM1637 (CLK 7, DIO 8) : 88:88 puis chaque segment");
  uint8_t all[4] = {0xFF, 0xFF, 0xFF, 0xFF}; bool ack = tmShow(all); bres("TM1637 repond (ACK)", ack, ack ? "" : "pas d'ACK : cablage, alim, ou niveau 5 V/3,3 V");
  delay(800); for (int seg = 0; seg < 8; seg++) { uint8_t s[4]; for (int i = 0; i < 4; i++) s[i] = 1 << seg; tmShow(s); delay(180); }
  tmTime(0, true); bvis("TM1637 segments", "regarder : 8 segments x 4 chiffres + deux-points");

  Serial.println("[3] Barrettes WS2812B (GPIO 41 -> 74AHCT125) : chaque barrette R, V, B puis chenillard");
  const uint32_t RGB3[3] = {0xFF0000, 0x00FF00, 0x0000FF};
  for (int b = 0; b < 5; b++) for (int c = 0; c < 3; c++) { ledClear(); for (int i = 0; i < 8; i++) ledSet(b, i, RGB3[c], 1); ledShow(); delay(250); }
  for (int j = 0; j < 40; j++) { ledClear(); ledSet(j / 8, j % 8, 0xFFFFFF, 1); ledShow(); delay(40); }
  ledClear(); ledShow(); bvis("Barrettes", "regarder : 5 x 8 LED, ordre 1->5, sens de chaque barrette (BAR_REVERSED_MASK)");

  Serial.println("[4] Audio I2S (BCLK 42, LRC 47, DIN 48) : 440 Hz GAUCHE, puis 660 Hz DROITE, puis les deux");
  audioTone(440, 1000, 1); delay(1200); audioTone(660, 1000, 2); delay(1200); audioTone(550, 600, 3); delay(800);
  bvis("Ampli GAUCHE / DROITE", "ecouter : le 440 Hz sort a GAUCHE seulement, le 660 Hz a DROITE seulement ; sinon SD_MODE a inverser");
  bres("LittleFS (voix)", fsOk, fsOk ? "" : "partition vide : flasher l'image des voix (README)");
  if (fsOk) {
    int n = 0; File d = LittleFS.open("/v"); if (d) { File f = d.openNextFile(); while (f) { n++; f = d.openNextFile(); } }
    bres("Voix presentes", n > 0, String(n) + " fichiers mp3 dans /v");
    if (voiceFileExists("intro")) { say("intro"); uint32_t t0 = millis(); while (!audioIdle() && millis() - t0 < 8000) delay(20); bvis("Voix intro", "ecouter : « Je suis l'Entite... » dans les deux HP"); }
  }

  Serial.println("[5] 60 s : tourne chaque molette dans les 2 sens, appuie chaque molette, joystick 4 directions + appui (q = passer)");
  bool seenCW[5] = {}, seenCCW[5] = {}, seenSW[5] = {}, seenDir[4] = {}, seenJ = false; int32_t e0[5], s0[5];
  for (int i = 0; i < 5; i++) { e0[i] = enc[i].edges; s0[i] = enc[i].steps; encDelta(i); btnTake(btnEnc[i]); } btnTake(btnJoy);
  uint32_t t0 = millis(), beat = 0;
  while (millis() - t0 < 60000 && !benchSerialAbort()) {
    hwPollButtons();
    for (int i = 0; i < 5; i++) { int d = encDelta(i); if (d > 0) seenCW[i] = true; if (d < 0) seenCCW[i] = true; if (d) Serial.printf("  E%d %+d  (crans %ld, fronts %ld)\n", i + 1, d, (long)(enc[i].steps - s0[i]), (long)(enc[i].edges - e0[i]));
      if (btnTake(btnEnc[i])) { seenSW[i] = true; Serial.printf("  E%d SW appui (GPIO%d)\n", i + 1, ENC_SW[i]); } }
    int jd = joyEvent(); if (jd >= 0) { seenDir[jd] = true; Serial.printf("  joystick %s  (X %d, Y %d)\n", DIR_NAMES[jd], analogRead(PIN_JOY_X), analogRead(PIN_JOY_Y)); }
    if (btnTake(btnJoy)) { seenJ = true; Serial.println("  joystick SW appui"); }
    if (millis() - beat > 15000) { beat = millis(); Serial.printf("  ... %lu s\n", (unsigned long)(60 - (millis() - t0) / 1000)); }
    bool all = seenJ; for (int i = 0; i < 5; i++) all &= seenCW[i] && seenCCW[i] && seenSW[i]; for (int d = 0; d < 4; d++) all &= seenDir[d]; if (all) break;
    delay(2);
  }
  for (int i = 0; i < 5; i++) {
    long st = enc[i].steps - s0[i], ed = enc[i].edges - e0[i];
    bres(String("E") + (i + 1) + " rotation 2 sens (CLK " + ENC_CLK[i] + ", DT " + ENC_DT[i] + ")", seenCW[i] && seenCCW[i], String("fronts nets/cran ~ ") + (st ? String((float)ed / st, 1) : String("?")) + " (4 attendu ; 2 => ENC_HALF_DETENT)");
    bres(String("E") + (i + 1) + " SW GPIO" + ENC_SW[i], seenSW[i]);
  }
  for (int d = 0; d < 4; d++) bres(String("Joystick ") + DIR_NAMES[d], seenDir[d], "si inverse : JOY_SWAP_XY / JOY_INV_X / JOY_INV_Y");
  bres("Joystick SW GPIO6", seenJ);
  bres("GPIO1 vivante (E5 SW)", seenSW[4], seenSW[4] ? "appui vu" : "jamais vu LOW : verifier que GPIO1 sort sur le bandeau DORHEA");

  Serial.println("[6] ESP-NOW : ping 2e S3, CYD 1, CYD 2");
  const uint8_t roles[3] = {enl::S3B, enl::CYD1, enl::CYD2}; bool got[3] = {}; uint32_t tp[3];
  for (int r = 0; r < 3; r++) { tp[r] = micros(); enl::Ping p = {tp[r], enl::HUB}; L.send(roles[r], enl::PING, &p, sizeof p); delay(20); }
  uint32_t tw = millis(); enl::Msg m;
  while (millis() - tw < 1500) { while (L.poll(m)) if (m.h.type == enl::PONG) for (int r = 0; r < 3; r++) if (m.h.src == roles[r] && !got[r]) { got[r] = true; Serial.printf("  PONG %s %.1f ms RSSI %d\n", enl::roleName(roles[r]), (micros() - tp[r]) / 1000.0, m.rssi); } delay(5); }
  for (int r = 0; r < 3; r++) bres(String("ESP-NOW ") + enl::roleName(roles[r]), got[r], got[r] ? "" : "pas de reponse (carte eteinte / pas flashee ?)");

  Serial.printf("=== FIN BANC HUB : %s ===\n", benchFails ? (String(benchFails) + " FAIL").c_str() : "TOUT PASS");
  Serial.println("Resume :"); Serial.print(benchSummary);
  g.phase = saved; if (g.phase == PH_BENCH) g.phase = PH_ARM;
}
void benchAll() {
  enl::Bench b = {1}; L.send(enl::ALL, enl::BENCH, &b, sizeof b);
  Serial.println("BENCH envoye au 2e S3 et aux CYD (leurs lignes s'affichent ici, prefixees)");
  runBench();
}
