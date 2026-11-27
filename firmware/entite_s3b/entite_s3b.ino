// La mallette de l'Entité — 2e ESP32-S3 N16R8 (DORHEA) : clavier 4×4, baie banane (5 lignes × 5 prises), serrures I/II,
// leviers ARM/TRANSMIT, 2 SG90 (trappes A/B). Données vers le hub en ESP-NOW. Broches FINAL (ASSEMBLAGE-CABLAGE.md §4.4).
// Banc : taper TEST dans le moniteur série (115200), ou garder « # » appuyé au démarrage, ou commande BENCH du hub.
#include <ESP32Servo.h>
#include <EntiteLink.h>

#define FW_VERSION "s3b-1.0.0"
// ---- broches FINAL (Pascal 09:16 / 09:54) — ne pas changer
static const uint8_t ROW[4] = {4, 5, 6, 7};          // clavier R1–R4 (sorties, LOW pour lire)
static const uint8_t COL[4] = {8, 9, 10, 11};        // clavier C1–C4 (INPUT_PULLUP)
static const uint8_t LINE[5] = {12, 13, 14, 15, 16}; // lignes câbles L1–L5 (ports B1–B5)
static const uint8_t JACK[5] = {17, 18, 21, 38, 2};  // JACK1–JACK5 (INPUT_PULLUP, 1 kΩ côté douille) ; JACK5 = GPIO 2
static const uint8_t LOCK[2] = {39, 40};             // serrure I, serrure II (tournée = LOW)
static const uint8_t LEVER[2] = {41, 42};            // ARM, TRANSMIT (actif = LOW)
static const uint8_t SERVO_PIN[2] = {47, 48};        // SG90 trappe A, trappe B
static const char KEYMAP[4][5] = {"123A", "456B", "789C", "*0#D"};  // ordre rangées/colonnes : à vérifier sur le pavé réel
// ---- servos : angles À CONFIRMER sur la vraie trappe (commencer petit)
static const int SERVO_CLOSED[2] = {10, 10}, SERVO_OPEN[2] = {95, 95};

enl::Link L;
Servo servo[2];
enl::S3bIn st = {};
bool bench = false;
uint32_t lastSend = 0; bool dirty = true;

// ---------- entrées avec anti-rebond
struct Deb { uint8_t pin; bool stable = true, last = true; uint32_t t = 0; uint16_t ms = 40; };
Deb locks[2], levers[2];
bool readDeb(Deb &d) { bool v = digitalRead(d.pin); if (v != d.last) { d.last = v; d.t = millis(); } else if (v != d.stable && millis() - d.t >= d.ms) { d.stable = v; return true; } return false; }

// ---------- clavier
char keyDown = 0; uint32_t keyT = 0; char keyCand = 0;
char scanKeypad() {
  char found = 0; int n = 0;
  for (int r = 0; r < 4; r++) {
    digitalWrite(ROW[r], LOW); delayMicroseconds(8);
    for (int c = 0; c < 4; c++) if (!digitalRead(COL[c])) { found = KEYMAP[r][c]; n++; }
    digitalWrite(ROW[r], HIGH);
  }
  return n == 1 ? found : (n > 1 ? '?' : 0);
}
void pushKey(char k) { memmove(st.keys, st.keys + 1, 3); st.keys[3] = k; st.keySeq++; dirty = true; }
void pollKeypad() {
  char k = scanKeypad();
  if (k != keyCand) { keyCand = k; keyT = millis(); return; }
  if (millis() - keyT < 30 || k == keyDown) return;
  keyDown = k; if (k && k != '?') pushKey(k);
}

// ---------- baie banane : on tire une ligne à LOW, les autres en haute impédance, on lit les 5 prises
int8_t plugRaw[5], plugCnt[5];
void scanCables() {
  int8_t now[5];
  for (int c = 0; c < 5; c++) {
    pinMode(LINE[c], OUTPUT); digitalWrite(LINE[c], LOW); delayMicroseconds(30);
    int s = -1, n = 0; for (int j = 0; j < 5; j++) if (!digitalRead(JACK[j])) { s = j; n++; }
    pinMode(LINE[c], INPUT);
    now[c] = n > 1 ? -2 : s;
  }
  for (int c = 0; c < 5; c++) {
    if (now[c] != plugRaw[c]) { plugRaw[c] = now[c]; plugCnt[c] = 0; continue; }
    if (plugCnt[c] < 3 && ++plugCnt[c] == 3 && st.plug[c] != now[c]) {
      if (now[c] >= 0) { memmove(st.touches, st.touches + 1, 3); st.touches[3] = now[c]; st.touchSeq++; }   // une fiche entre dans une prise
      st.plug[c] = now[c]; dirty = true;
    }
  }
}

// ---------- servos (rail LM2596 réglé 5,0–5,2 V AVANT tout branchement)
void servoGo(int i, int deg, int holdMs) { if (!servo[i].attached()) servo[i].attach(SERVO_PIN[i], 500, 2400); servo[i].write(deg); delay(holdMs); }
void servoDetach(int i) { if (servo[i].attached()) servo[i].detach(); }
void servoShake(int i) {  // ±6°, 3 cycles, 100 ms par pas, une porte, puis porte fermée et détachée
  int c = SERVO_CLOSED[i];
  servoGo(i, c, 150);
  for (int k = 0; k < 3; k++) { servoGo(i, c + 6, 100); servoGo(i, max(0, c - 6), 100); }
  servoGo(i, c, 200); servoDetach(i);
}
void servoCmd(const enl::S3bCmd &c) {
  if (c.trap > 1) return;
  if (c.act == enl::SV_OPEN) { servoGo(c.trap, SERVO_OPEN[c.trap], 600); servoDetach(c.trap); }
  else if (c.act == enl::SV_CLOSE) { servoGo(c.trap, SERVO_CLOSED[c.trap], 600); servoDetach(c.trap); }
  else if (c.act == enl::SV_SHAKE) servoShake(c.trap);
  else if (c.act == enl::SV_DETACH) servoDetach(c.trap);
}

// ---------- banc
String benchLog;
void blog(const String &s) { Serial.println(s); benchLog += s + "\n"; enl::LogLine l = {}; strncpy(l.txt, s.c_str(), sizeof l.txt - 1); L.send(enl::HUB, enl::LOG, &l, sizeof l); }
bool waitSerialWord(const char *word, uint32_t ms) {
  String buf; uint32_t t0 = millis();
  while (millis() - t0 < ms) { while (Serial.available()) { char ch = Serial.read(); if (ch == '\n' || ch == '\r') { buf.trim(); buf.toUpperCase(); if (buf == word) return true; buf = ""; } else buf += ch; } delay(5); }
  return false;
}
void runBench(bool servoAllowedFromHub) {
  bench = true; st.bench = 1; dirty = true;
  int fails = 0;
  blog("=== BANC 2e S3 " FW_VERSION " — MAC " + L.mac() + " ===");
  // 1. repos : toutes les entrées doivent être HIGH (rien d'appuyé, clés droites, leviers bas, câbles débranchés)
  blog("[1] Repos (rien d'appuye, cles droites, leviers bas, CABLES DEBRANCHES)");
  struct P { const char *n; uint8_t pin; } ins[] = {{"C1", 8}, {"C2", 9}, {"C3", 10}, {"C4", 11}, {"JACK1", 17}, {"JACK2", 18}, {"JACK3", 21}, {"JACK4", 38}, {"JACK5(GPIO2)", 2}, {"SERRURE_I", 39}, {"SERRURE_II", 40}, {"ARM", 41}, {"TX", 42}};
  for (auto &p : ins) { bool v = digitalRead(p.pin); blog(String("  ") + p.n + " GPIO" + p.pin + " = " + (v ? "HIGH  PASS" : "LOW   FAIL (court-circuit vers GND ou action en cours ?)")); if (!v) fails++; }
  // 2. actions : 90 s pour tout essayer
  blog("[2] 90 s : appuie les 16 touches, tourne/remets chaque cle, leve/baisse chaque levier, branche chaque cable B1-B5 dans chaque prise 1-5");
  bool seenKey[16] = {}, seenLock[2] = {}, seenLever[2] = {}, seenCable[5] = {}, seenJack[5] = {};
  uint8_t ks = st.keySeq, ts = st.touchSeq; uint32_t t0 = millis(), lastBeat = 0;
  while (millis() - t0 < 90000) {
    pollKeypad(); scanCables();
    for (int i = 0; i < 2; i++) { if (readDeb(locks[i])) blog(String("  serrure ") + (i ? "II" : "I") + (locks[i].stable ? " -> droite (HIGH)" : " -> tournee (LOW)")); if (!locks[i].stable) seenLock[i] = true;
                                  if (readDeb(levers[i])) blog(String("  levier ") + (i ? "TX" : "ARM") + (levers[i].stable ? " -> bas (HIGH)" : " -> leve (LOW)")); if (!levers[i].stable) seenLever[i] = true; }
    while (ks != st.keySeq) { ks++; char k = st.keys[3 - (uint8_t)(st.keySeq - ks)]; const char *all = "123A456B789C*0#D"; const char *f = strchr(all, k); if (f) seenKey[f - all] = true; blog(String("  touche ") + k); }
    while (ts != st.touchSeq) { ts++; }
    for (int c = 0; c < 5; c++) if (st.plug[c] >= 0) { if (!seenCable[c] || !seenJack[st.plug[c]]) blog(String("  cable B") + (c + 1) + " -> prise " + (st.plug[c] + 1)); seenCable[c] = true; seenJack[st.plug[c]] = true; }
    if (millis() - lastBeat > 15000) { lastBeat = millis(); blog(String("  ... ") + (90 - (millis() - t0) / 1000) + " s"); }
    delay(2);
  }
  String miss;
  for (int i = 0; i < 16; i++) if (!seenKey[i]) miss += "123A456B789C*0#D"[i];
  blog(String("  clavier : ") + (miss.length() ? "FAIL, jamais vues : " + miss : "PASS (16/16)")); if (miss.length()) fails++;
  for (int i = 0; i < 2; i++) { blog(String("  serrure ") + (i ? "II GPIO40" : "I GPIO39") + (seenLock[i] ? " PASS" : " FAIL (jamais LOW)")); if (!seenLock[i]) fails++; }
  for (int i = 0; i < 2; i++) { blog(String("  levier ") + (i ? "TX GPIO42" : "ARM GPIO41") + (seenLever[i] ? " PASS" : " FAIL (jamais LOW)")); if (!seenLever[i]) fails++; }
  for (int c = 0; c < 5; c++) { blog(String("  ligne L") + (c + 1) + " GPIO" + LINE[c] + (seenCable[c] ? " PASS" : " FAIL (jamais vue)")); if (!seenCable[c]) fails++; }
  for (int j = 0; j < 5; j++) { blog(String("  prise JACK") + (j + 1) + " GPIO" + JACK[j] + (seenJack[j] ? " PASS" : " FAIL (jamais vue)")); if (!seenJack[j]) fails++; }
  blog(String("  GPIO2 (JACK5) vivante : ") + (seenJack[4] ? "OUI" : "NON / non testee"));
  // 3. servos : seulement après confirmation du rail
  bool doServo = servoAllowedFromHub;
  if (!doServo) { blog("[3] SERVOS : rail LM2596 regle et verrouille a 5,0-5,2 V au multimetre ? Tape SERVO (30 s) sinon saute."); doServo = waitSerialWord("SERVO", 30000); }
  if (doServo) {
    for (int i = 0; i < 2; i++) {
      blog(String("  SG90 ") + (i ? "B GPIO48" : "A GPIO47") + " : ferme -> +20 deg -> ferme -> tremblement");
      servoGo(i, SERVO_CLOSED[i], 400); servoGo(i, SERVO_CLOSED[i] + 20, 400); servoGo(i, SERVO_CLOSED[i], 400); servoShake(i);
      blog("  -> a regarder : mouvement net, pas de grognement, 5,0-5,2 V tenus (VISUEL)");
    }
  } else blog("[3] SERVOS : SAUTE (pas de confirmation du rail)");
  // 4. ESP-NOW
  blog("[4] ESP-NOW ping hub");
  uint32_t tp = micros(); enl::Ping pg = {tp, enl::S3B}; L.send(enl::HUB, enl::PING, &pg, sizeof pg);
  bool pong = false; uint32_t tw = millis(); enl::Msg m;
  while (millis() - tw < 1500 && !pong) { while (L.poll(m)) if (m.h.type == enl::PONG && m.h.src == enl::HUB) { pong = true; blog(String("  PONG hub en ") + (micros() - tp) / 1000.0 + " ms, RSSI " + m.rssi + " PASS"); } delay(5); }
  if (!pong) { blog("  hub muet FAIL (hub eteint ?)"); fails++; }
  blog(String("=== FIN BANC 2e S3 : ") + (fails ? String(fails) + " FAIL" : "TOUT PASS") + " ===");
  bench = false; st.bench = 0; dirty = true;
}

void setup() {
  Serial.begin(115200); delay(300);
  for (int r = 0; r < 4; r++) { pinMode(ROW[r], OUTPUT); digitalWrite(ROW[r], HIGH); }
  for (int c = 0; c < 4; c++) pinMode(COL[c], INPUT_PULLUP);
  for (int c = 0; c < 5; c++) { pinMode(LINE[c], INPUT); pinMode(JACK[c], INPUT_PULLUP); st.plug[c] = -1; plugRaw[c] = -1; }
  for (int i = 0; i < 2; i++) { locks[i].pin = LOCK[i]; levers[i].pin = LEVER[i]; pinMode(LOCK[i], INPUT_PULLUP); pinMode(LEVER[i], INPUT_PULLUP); locks[i].stable = locks[i].last = digitalRead(LOCK[i]); levers[i].stable = levers[i].last = digitalRead(LEVER[i]); }
  ESP32PWM::allocateTimer(0); ESP32PWM::allocateTimer(1);
  Serial.printf("\nEntite 2e S3 %s\n", FW_VERSION);
  if (!L.begin(enl::S3B)) Serial.println("ESP-NOW init FAIL");
  Serial.println("MAC " + L.mac() + " — tape TEST pour le banc");
  bool bootBench = scanKeypad() == '#';
  if (bootBench) { Serial.println("# tenu au demarrage : banc"); runBench(false); }
}

String line;
void loop() {
  pollKeypad();
  static uint32_t tc = 0; if (millis() - tc >= 10) { tc = millis(); scanCables(); }
  for (int i = 0; i < 2; i++) {
    if (readDeb(locks[i])) { bitWrite(st.locks, i, !locks[i].stable); dirty = true; }
    if (readDeb(levers[i])) { bitWrite(st.levers, i, !levers[i].stable); dirty = true; }
  }
  enl::Msg m;
  while (L.poll(m)) {
    if (m.h.type == enl::PING) { enl::Ping p; memcpy(&p, m.data, sizeof p); p.from = enl::S3B; L.send(m.h.src, enl::PONG, &p, sizeof p); }
    else if (m.h.type == enl::S3B_CMD && m.len >= (int)sizeof(enl::S3bCmd)) { enl::S3bCmd c; memcpy(&c, m.data, sizeof c); if (c.act == enl::SV_SWEEP_TEST) runBench(true); else servoCmd(c); }
    else if (m.h.type == enl::BENCH && m.len >= 1 && m.data[0]) runBench(false);
  }
  if (dirty || millis() - lastSend > 250) { L.send(enl::HUB, enl::S3B_IN, &st, sizeof st); lastSend = millis(); dirty = false; }
  while (Serial.available()) { char ch = Serial.read(); if (ch == '\n' || ch == '\r') { line.trim(); line.toUpperCase(); if (line == "TEST") runBench(false); else if (line == "STATE") Serial.printf("plug %d %d %d %d %d locks %d levers %d keys %u\n", st.plug[0], st.plug[1], st.plug[2], st.plug[3], st.plug[4], st.locks, st.levers, st.keySeq); line = ""; } else line += ch; }
}
