// game.h — déroulé du jeu sur le hub, port du web v0.5.4 (js/app.js + js/game.js + js/guide.js).
// La partie est tirée par entite::makeRun(graine) : identique au web pour la même graine (tools/test_game.sh).
// Simplifications matériel (voir README) : un seul « leurre » par étape, pas de musique de fond, pas de batterie simulée.
#pragma once
#include <EntiteGame.h>
#include <EntiteLink.h>
#include "hw.h"
using namespace entite;

enum Phase : uint8_t { PH_ARM_WAIT_DOWN, PH_ARM, PH_PLAY, PH_WIN, PH_BOOM, PH_BENCH };
struct S3bView { enl::S3bIn in = {}; bool seen = false; uint32_t at = 0; uint8_t keySeq = 0, touchSeq = 0; bool init = false; };

struct Game {
  Run run; Phase phase = PH_ARM_WAIT_DOWN; int step = 0;
  float remaining = TIME_S; uint32_t lastTick = 0; int errors = 0; bool said30 = false, said10 = false;
  int hint = 0; uint32_t progressT = 0;
  // pression (une réplique trompeuse par étape)
  uint32_t pressAt = 0; int pressKind = 0; bool pressDone = false, pressWaited = false; uint32_t quietFrom = 0;
  // effets
  uint32_t okUntil = 0, koUntil = 0, lieUntil = 0;
  // étapes 1 et 8
  int encPos[5]; int melScore = -1; bool encTaunted = false;
  // étape 2
  int trapSel = -1; bool trapOpen[2] = {false, false}; uint32_t barT0 = 0; bool waitBarT0 = false; uint32_t shakeUntil = 0;
  // étape 3 (Simon)
  struct { int len = 0, round = 0; uint8_t ph = 0; uint32_t t0 = 0, deadline = 0, resumeAt = 0; int step = 36, gap = 200; std::vector<int> input; bool taunted = false; int flashS = -1; uint32_t flashT = 0; bool flashErr = false; int lastNote = -1; } sim;
  // étapes 5 et 9
  int px = 0, py = 0; uint32_t cueEndAt = 0; bool swapDone = false; uint32_t glitchUntil = 0;
  int flashes = 0; uint32_t flashUntil = 0; bool sabotage = false; uint32_t sabT = 0, sabEnd = 0; bool noirPending = false;
  // étapes 6 et 11
  std::string code; uint32_t codeLockUntil = 0;
  // étape 7
  struct { uint8_t ph = 0; int alerts = 0; uint32_t nextAt = 0, signalAt = 0, first = 0; std::vector<int> turned; bool waitRelease = false; } k7;
  // étape 10
  uint32_t pclockT0 = 0; int pclockTotal = 0; bool waitPclock = false;
  // étape 12 / leviers
  uint8_t prevLevers = 0, prevLocks = 0; bool txHeld = false;
  uint32_t endAt = 0;
  bool waitCue = false; int afterCue = 0;   // action à faire quand la file de voix se vide
};
Game g; S3bView s3b;
extern enl::Link L;

// ---------------- voix
void voice(const std::vector<std::string> &ids, bool lie = false, bool now = false) {
  if (now) sayClear();
  for (auto &id : ids) say(id.c_str(), lie);
  if (lie) g.lieUntil = millis() + 2500;
}
void voice1(const char *id, bool lie = false, bool now = false) { voice({id}, lie, now); }
std::string chiffre(int d) { return "chiffre_" + std::to_string(d); }
std::string cableCue(int c) { return std::string("cable_") + WIRE_COLORS[g.run.wires[c]]; }
std::string priseCue(int s) { return "prise_" + std::to_string(s + 1); }
std::string couleur(int tc) { return std::string("couleur_") + TRAP_COLORS[tc]; }

// ---------------- servos (sur le 2e S3)
uint8_t svSeq = 0;
void servo(uint8_t trap, uint8_t act) { enl::S3bCmd c = {trap, act, ++svSeq}; for (int i = 0; i < 2; i++) L.send(enl::S3B, enl::S3B_CMD, &c, sizeof c); }

void nextStep(int n);
void endGame(bool win);
void progress() { g.progressT = millis(); }
void good(int nextN, int fragIdx = -1, const char *okLine = "outcome_ok") {
  sayClear();
  g.okUntil = millis() + 900; progress();
  audioTone(880, 120);
  if (fragIdx >= 0) {
    bool lie = std::find(g.run.fragLies.begin(), g.run.fragLies.end(), fragIdx) != g.run.fragLies.end();
    if (lie) voice({"clue_fragment", chiffre(g.run.decoyFrags[fragIdx])}, true);
    voice({"clue_fragment", chiffre(g.run.frags[fragIdx])});
  } else voice1(okLine);
  if (nextN) nextStep(nextN);
}
void bad(int sec, const char *line = "outcome_faux") {
  audioTone(110, 300); g.koUntil = millis() + 600; g.errors++; g.remaining -= sec;
  voice1(line);
  Serial.printf("[jeu] faux : -%d s (reste %.0f s)\n", sec, g.remaining);
}
void pressure(uint32_t ms, int kind) { g.pressAt = millis() + ms; g.pressKind = kind; g.pressDone = false; g.pressWaited = false; g.quietFrom = 0; }

// ---------------- indices (guide.js)
std::vector<std::string> hintCues(int step, int level) {
  Run &R = g.run;
  static const char *H1[13] = {"hint1_armer", "hint1_mot_melange", "hint1_barre", "hint1_simon", "hint1_cables", "hint1_verrou", "hint1_code", "hint1_cles", "hint1_mot", "hint1_noir", "hint1_cables", "hint1_code", "hint1_transmit"};
  if (step == 0) return {level == 1 ? "hint1_armer" : "hint2_armer"};
  if (level == 1) return {step == 7 && R.vKeys == "ensemble" ? "hint1_cles_ensemble" : H1[step]};
  if (level == 2) {
    switch (step) {
      case 1: if (R.vEnc1 == "theme") return {"hint2_mot_melange", "theme_" + R.theme}; return {"hint2_mot_melange"};
      case 2: return {"hint2_trappe_" + R.vTrap};
      case 3: return {"hint2_simon"};
      case 4: return {"hint2_patch_" + R.patch1.kind};
      case 10: return {"hint2_patch_" + R.patch2.kind};
      case 5: case 9: return {"hint2_verrou"};
      case 6: case 11: { std::vector<std::string> v = {step == 6 ? "hint2_code1_" + R.vCode1 : "hint2_code2_" + R.vCode2, "hint_rappel_fragments"}; for (int f : R.frags) v.push_back(chiffre(f)); return v; }
      case 7: return {R.vKeys == "ensemble" ? std::string("hint2_cles_ensemble") : "hint2_cles_" + R.vKeys};
      case 8: return {"hint2_mot_" + R.vWord};
      case 12: return {"hint2_transmit"};
    }
  }
  switch (step) {
    case 1: return {"hint3_mot_melange", "lettre_" + lower1(R.word1[0])};
    case 8: return {"hint3_molette1", "lettre_" + lower1(RING[R.enc2[0]])};
    case 2: return {"hint3_trappe", couleur(R.trapColors[R.trap])};
    case 3: { static const char *SC[5] = {"noir", "bleu", "vert", "rouge", "jaune"}; bool rev = R.simonT.lastReversed && g.sim.len == R.simonT.target;
      return {"hint3_simon", std::string("couleur_") + SC[rev ? R.simonSeq[R.simonT.target - 1] : R.simonSeq[0]]}; }
    case 6: return {"hint3_premier_chiffre", chiffre(R.code1[0] - '0')};
    case 11: return {"hint3_premier_chiffre", chiffre(R.code2[0] - '0')};
    case 4: case 10: { Patch &p = step == 4 ? R.patch1 : R.patch2; int c = -1;
      for (int k = 0; k < 5; k++) if (p.req[k] == REQ_OUT) { c = k; break; }
      if (c >= 0) return {"hint3_debranche", cableCue(c)};
      for (int k = 0; k < 5; k++) if (p.req[k] >= 0) return {"hint3_geste", cableCue(k), priseCue(p.req[k])};
      break; }
    case 5: case 9: { static const char *DC[4] = {"dir_haut", "dir_droite", "dir_bas", "dir_gauche"}; Maze &m = step == 5 ? R.maze1 : R.maze2; int d = firstMove(m, g.px, g.py);
      if (d != NODIR) return {"hint3_direction", DC[d]}; return {"hint2_verrou"}; }
    case 7: if (R.vKeys == "ensemble") return {"hint3_cles_ensemble"}; return {"hint3_serrure", chiffre(R.keyOrder[0] + 1)};
    case 12: return {"hint2_transmit"};
  }
  return {H1[step]};
}
void simonReplay(uint32_t delayMs);
void giveHint(int level, bool autoHint = false) {
  int k = g.phase == PH_PLAY ? g.step : g.phase == PH_ARM ? 0 : -1; if (k < 0 || level > 3 || level <= g.hint) return;
  g.hint = level; int cost = autoHint ? 0 : HINT_COST[level];
  if (cost) g.remaining -= cost;
  Serial.printf("[jeu] indice %d (etape %d) -%d s\n", level, k, cost);
  voice(hintCues(k, level), false, true);
  if (k == 3 && level <= 2) simonReplay(0);
}

// ---------------- déroulé
void setEncRandom() { for (int i = 0; i < 5; i++) g.encPos[i] = esp_random() % DETENTS; g.encTaunted = false; g.melScore = -1; }
void nextStep(int n) {
  g.step = n; g.hint = 0; g.codeLockUntil = 0; g.pressAt = 0; g.waitCue = false; g.afterCue = 0; progress();
  g.sim.ph = 0;
  std::string O = objectiveId(g.run, n);
  auto C = [&](int k) { std::vector<std::string> v = {O}; for (auto &x : g.run.cues[k]) v.push_back(x); return v; };
  Serial.printf("[jeu] etape %d/12\n", n);
  switch (n) {
    case 1: setEncRandom(); voice(C(1)); if (g.run.encFalse) pressure(4000, 1); break;
    case 2: g.trapSel = -1; g.barT0 = 0; voice(C(2)); g.waitCue = true; g.afterCue = 2; pressure(5500, 2); break;
    case 3: g.code = ""; g.sim = {}; g.sim.len = g.run.simonT.start; g.sim.ph = 1; voice(C(3)); g.waitCue = true; g.afterCue = 3; break;
    case 4: voice(C(4)); pressure(6000, 4); break;
    case 5: g.px = g.run.maze1.sx; g.py = g.run.maze1.sy; g.swapDone = false; g.glitchUntil = 0; g.cueEndAt = 0;
      voice({O, "clue_verrou"}); g.waitCue = true; g.afterCue = 5; pressure(9000, 5); break;
    case 6: g.code = ""; voice(C(6)); pressure(6000, 6); break;
    case 7: { int other = (g.run.trap + 1) % 2; if (!g.trapOpen[other]) { servo(other, enl::SV_OPEN); g.trapOpen[other] = true; }
      g.k7 = {}; voice(C(7)); g.waitCue = true; g.afterCue = 7; break; }
    case 8: setEncRandom(); voice(C(8)); if (g.run.encFalse) pressure(5000, 8); break;
    case 9: g.px = g.run.maze2.sx; g.py = g.run.maze2.sy; g.flashes = g.run.hard ? 1 : 2; g.flashUntil = 0; g.sabotage = false; g.sabT = millis() + 5000;
      voice({O}); g.waitCue = true; g.afterCue = 9; break;
    case 10: g.pclockTotal = g.run.hard ? PATCH_CLOCK_DIFF : PATCH_CLOCK_MOYEN; g.pclockT0 = 0; voice(C(10)); g.waitCue = true; g.afterCue = 10;
      if (g.run.wire2False) pressure(6000, 10); break;
    case 11: g.code = ""; voice(C(11)); pressure(7000, 11); break;
    case 12: voice({O, "clue_transmit"}); voice1("taunt_sceller", true); break;
  }
}
void startRun() {
  uint32_t seed = esp_random();
  g = Game(); g.run = makeRun(seed, PORT_WIRE);
  Serial.printf("[jeu] partie graine %u, palier %s, signature %s, serie %s\n", seed, g.run.tier.c_str(), g.run.sig.c_str(), g.run.serial);
  for (int i = 0; i < 2; i++) servo(i, enl::SV_CLOSE);
  g.prevLevers = s3b.in.levers; g.prevLocks = s3b.in.locks;
  g.phase = (s3b.in.levers & 1) ? PH_ARM_WAIT_DOWN : PH_ARM;
  voice1("intro"); voice1("arm_cache");
}
void endGame(bool win) {
  g.phase = win ? PH_WIN : PH_BOOM; g.endAt = millis(); sayClear();
  voice1(win ? "outcome_victoire" : "outcome_boom");
  Serial.printf("[jeu] FIN : %s, erreurs %d, reste %.0f s\n", win ? "VICTOIRE" : "ECHEC", g.errors, g.remaining);
}

// ---------------- Simon
void simonReplay(uint32_t delayMs) { if (g.step != 3 || !g.sim.ph) return; g.sim.ph = 1; g.sim.input.clear(); g.sim.resumeAt = millis() + delayMs; }
bool simonReversed() { return g.run.simonT.lastReversed && g.sim.len == g.run.simonT.target; }
int simonWant(int i) { int n = g.sim.len; return simonReversed() ? g.run.simonSeq[n - 1 - i] : g.run.simonSeq[i]; }
void simonPlay() {
  double f = g.run.simonT.speedup ? pow(SIMON_SPEEDUP, g.sim.round) : 1;
  g.sim.step = std::max(SIMON_STEP_MIN, (int)lround(SIMON_STEP_MS * f)); g.sim.gap = std::max(SIMON_GAP_MIN, (int)lround(SIMON_GAP_MS * f));
  g.sim.ph = 2; g.sim.t0 = millis(); g.sim.input.clear(); g.sim.lastNote = -1;
}
void simonFail() { g.sim.flashS = -1; g.sim.flashErr = true; g.sim.flashT = millis(); bad(8); g.sim.ph = 1; g.sim.input.clear(); g.sim.resumeAt = millis() + 1400; }
void simonTouch(int s) {
  if (g.sim.ph != 3) return;   // pendant la lecture : ne compte pas
  if (s != simonWant(g.sim.input.size())) { simonFail(); return; }
  g.sim.input.push_back(s); g.sim.flashS = s; g.sim.flashErr = false; g.sim.flashT = millis(); audioTone(SIMON_NOTES[s], 200); progress();
  if ((int)g.sim.input.size() < g.sim.len) { g.sim.deadline = millis() + g.run.simonT.between; return; }
  if (g.sim.len >= g.run.simonT.target) { g.sim.ph = 0; good(4, 1); return; }
  g.sim.len++; g.sim.round++; g.sim.ph = 1; g.sim.input.clear();
  if (simonReversed()) { voice1("simon_envers", false, true); g.sim.resumeAt = millis() + 700; g.waitCue = true; g.afterCue = 3; }
  else g.sim.resumeAt = millis() + 700;
}
void simonTick() {
  uint32_t now = millis();
  if (g.sim.ph == 1 && !g.waitCue && now >= g.sim.resumeAt) simonPlay();
  if (g.sim.ph == 2) {
    int beat = SIMON_SWEEPS * SIMON_LEDS * g.sim.step, per = beat + g.sim.gap; int t = now - g.sim.t0, k = t / per;
    if (k < g.sim.len && k != g.sim.lastNote && (t - k * per) < beat) { g.sim.lastNote = k; audioTone(SIMON_NOTES[g.run.simonSeq[k]], beat); }
    if (t >= g.sim.len * per) { g.sim.ph = 3; g.sim.deadline = now + g.run.simonT.first; if (!g.sim.taunted) { g.sim.taunted = true; pressure(1500, 3); } }
  }
  if (g.sim.ph == 3 && now > g.sim.deadline) simonFail();
}

// ---------------- labyrinthes
void mazeMove(int d) {
  Maze &m = g.step == 5 ? g.run.maze1 : g.run.maze2;
  if (g.sabotage) d = (d + 2) % 4;   // commandes inversées
  if (!m.canMove(g.px, g.py, d)) { audioTone(150, 80); return; }
  g.px += DIRS[d][0]; g.py += DIRS[d][1]; audioTone(660, 30); progress();
  if (g.px == m.gx && g.py == m.gy) { if (g.sabotage) g.sabotage = false; good(g.step == 5 ? 6 : 10, g.step == 5 ? 3 : -1); }
}

// ---------------- baie banane
bool patchDone(const Patch &p) {
  for (int c = 0; c < 5; c++) { if (p.req[c] == REQ_FREE) continue; if (p.req[c] == REQ_OUT ? s3b.in.plug[c] != -1 : s3b.in.plug[c] != p.req[c]) return false; }
  return true;
}

// ---------------- clavier
void keypadKey(char k) {
  if (g.phase != PH_PLAY || (g.step != 6 && g.step != 11)) return;
  if (millis() < g.codeLockUntil) { audioTone(120, 80); return; }
  if (k < '0' || k > '9') { if (k == '*' || k == 'D') g.code = ""; return; }   // * ou D = effacer
  g.code += k; audioTone(1200, 25); progress();
  if (g.code.size() < 4) return;
  const std::string &want = g.step == 6 ? g.run.code1 : g.run.code2;
  if (g.code == want) good(g.step == 6 ? 7 : 12);
  else { g.code = ""; g.codeLockUntil = millis() + KEYPAD_LOCK_MS; bad(5); voice1("code_bloque"); }
}

// ---------------- clés (étape 7)
void keysArm() {   // programme le signal vert après 0..2 fausses alertes (difficile)
  g.k7.ph = 1; g.k7.turned.clear(); g.k7.first = 0;
  g.k7.nextAt = millis() + (g.k7.alerts < (g.run.hard ? 2 : 0) ? 1600 + esp_random() % 1200 : 1800 + esp_random() % 1400);
}
void keysFail(const char *line) { g.k7.ph = 0; g.k7.waitRelease = true; bad(KEYS_PENALTY_S, line); }
void keyTurn(int k) {
  if (g.step != 7 || g.k7.waitRelease) return;
  if (std::find(g.k7.turned.begin(), g.k7.turned.end(), k) != g.k7.turned.end()) return;
  audioTone(500, 40);
  if (g.k7.ph != 2) { keysFail("cles_trop_tot"); return; }
  if (g.run.vKeys != "ensemble" && k != g.run.keyOrder[g.k7.turned.size()]) { keysFail("outcome_faux"); return; }
  g.k7.turned.push_back(k); progress();
  if (g.k7.turned.size() == 1) { g.k7.first = millis(); return; }
  if (g.run.vKeys == "ensemble" && millis() - g.k7.first > KEYS_WINDOW_MS) { keysFail("cles_pas_ensemble"); return; }
  g.k7.ph = 3; good(8, -1, g.run.vKeys == "ensemble" ? "cles_ensemble" : "outcome_ok");
}
void keysTick() {
  if (g.step != 7) return;
  if (g.k7.waitRelease) { if ((s3b.in.locks & 3) == 0) { g.k7.waitRelease = false; keysArm(); } return; }
  if (g.k7.ph == 1 && millis() >= g.k7.nextAt && audioIdle()) {
    if (g.k7.alerts < (g.run.hard ? 2 : 0)) { g.k7.alerts++; voice1("cles_maintenant", true, true); g.k7.nextAt = millis() + 1600 + esp_random() % 1200; }
    else { g.k7.ph = 2; g.k7.signalAt = millis(); audioTone(1000, 250); }
  }
}

// ---------------- entrées du 2e S3
void onS3bIn(const enl::S3bIn &in) {
  enl::S3bIn old = s3b.in; s3b.in = in; s3b.at = millis();
  if (!s3b.init) { s3b.init = true; s3b.keySeq = in.keySeq; s3b.touchSeq = in.touchSeq; g.prevLevers = in.levers; g.prevLocks = in.locks; if ((in.levers & 1) && g.phase == PH_ARM) g.phase = PH_ARM_WAIT_DOWN; return; }
  uint8_t nk = in.keySeq - s3b.keySeq; if (nk > 4) nk = 4;
  for (int i = 4 - nk; i < 4; i++) keypadKey(in.keys[i]);
  s3b.keySeq = in.keySeq;
  uint8_t nt = in.touchSeq - s3b.touchSeq; if (nt > 4) nt = 4;
  for (int i = 4 - nt; i < 4; i++) if (g.phase == PH_PLAY && g.step == 3) simonTouch(in.touches[i]); else audioTone(700, 20);
  s3b.touchSeq = in.touchSeq;
  // leviers : front montant = levé
  uint8_t up = in.levers & ~old.levers;
  if (up & 1) { if (g.phase == PH_ARM) { g.phase = PH_PLAY; g.lastTick = millis(); audioTone(440, 150); voice1("depart", false, true); nextStep(1); } }
  if ((in.levers & 1) == 0 && g.phase == PH_ARM_WAIT_DOWN) g.phase = PH_ARM;
  if (up & 2) { if (g.phase == PH_PLAY) { if (g.step == 12) endGame(true); else bad(8); } }
  uint8_t turned = in.locks & ~old.locks;
  for (int k = 0; k < 2; k++) if (turned & (1 << k)) keyTurn(k);
  if (g.phase == PH_PLAY && (g.step == 4 || g.step == 10) && memcmp(old.plug, in.plug, 5)) {
    progress(); audioTone(520, 30);
    if (patchDone(g.step == 4 ? g.run.patch1 : g.run.patch2)) good(g.step == 4 ? 5 : 11, g.step == 4 ? 2 : -1);
  }
}

// ---------------- boucle de jeu
void pressureFire() {
  Run &R = g.run;
  switch (g.pressKind) {
    case 1: { int i = 0; int w = (R.enc1[i] + 3) % DETENTS; voice({"taunt_cetait", "lettre_" + lower1(RING[w]), "taunt_depeche"}, true, true); break; }
    case 2: { int w = (R.trap + 1) % 2; voice({"taunt_trappe", couleur(R.trapColors[w])}, true, true); break; }
    case 3: if (g.sim.ph == 3) voice1("taunt_regarde", true, true); break;
    case 4: voice({"taunt_branche", cableCue(R.decoyWire1.cable), priseCue(R.decoyWire1.socket)}, true, true); break;
    case 5: voice1("taunt_lent", false, true); break;
    case 6: voice({"taunt_cetait", chiffre(R.decoyFrags[esp_random() % 4]), "taunt_depeche"}, true, true); break;
    case 8: voice({"taunt_cetait", "lettre_" + lower1(R.decoyWord), "taunt_depeche"}, true, true); break;
    case 10: voice({"taunt_branche", cableCue(R.decoyWire2.cable), priseCue(R.decoyWire2.socket)}, true, true); break;
    case 11: voice1("taunt_rouge", true, true); break;
  }
}
void gameTick() {
  uint32_t now = millis();
  hwPollButtons();
  // fin de consigne -> actions différées
  if (g.waitCue && audioIdle()) {
    g.waitCue = false;
    switch (g.afterCue) {
      case 2: g.barT0 = now; break;
      case 3: if (g.sim.ph == 1) g.sim.resumeAt = std::max(g.sim.resumeAt, now); break;
      case 5: g.cueEndAt = now; break;
      case 7: keysArm(); break;
      case 9: voice1("noir_coupe"); break;
      case 10: g.pclockT0 = now; break;
    }
  }
  if (g.phase == PH_PLAY) {
    float dt = (now - g.lastTick) / 1000.0f; g.lastTick = now; g.remaining -= dt;
    if (g.remaining <= 30 && !g.said30) { g.said30 = true; voice1("outcome_trente", false, true); }
    if (g.remaining <= 10 && !g.said10) { g.said10 = true; voice1("outcome_dix", false, true); }
    if (g.remaining <= 0) { g.remaining = 0; endGame(false); return; }
    // pression : jamais pendant une voix ; 1,5 s de calme après
    if (g.pressAt && !g.pressDone && now >= g.pressAt) {
      if (!audioIdle() || now < g.shakeUntil) { g.pressWaited = true; g.quietFrom = 0; }
      else if (!g.pressWaited) { g.pressDone = true; pressureFire(); }
      else { if (!g.quietFrom) g.quietFrom = now; if (now - g.quietFrom >= 1500) { g.pressDone = true; pressureFire(); } }
    }
    if (g.hint == 0 && g.step != 3 && now - g.progressT > AUTO_HINT_MS) giveHint(1, true);
    // molettes
    if (g.step == 1 || g.step == 8) {
      for (int i = 0; i < 5; i++) { int d = encDelta(i); if (d) { g.encPos[i] = ((g.encPos[i] + d) % DETENTS + DETENTS) % DETENTS; audioTone(1800, 4); progress(); } }
      bool pushed = false; for (int i = 0; i < 5; i++) pushed |= btnTake(btnEnc[i]);
      if (pushed) {
        const int *tgt = g.step == 1 ? g.run.enc1 : g.run.enc2; int ok = 0; for (int i = 0; i < 5; i++) ok += g.encPos[i] == tgt[i];
        if (ok == 5) good(g.step == 1 ? 2 : 9, g.step == 1 ? 0 : -1);
        else if (g.step == 1) { if (g.run.vEnc1 == "theme") g.melScore = ok; bad(g.run.vEnc1 == "theme" ? 5 : 8); }
        else bad(5);
      }
    } else { for (int i = 0; i < 5; i++) { encDelta(i); btnTake(btnEnc[i]); } }
    // joystick
    int jd = joyEvent(); bool jp = btnTake(btnJoy);
    if (g.step == 2) {
      if (jd == 3) g.trapSel = 0; if (jd == 1) g.trapSel = 1;
      if (jp && g.trapSel >= 0 && now >= g.shakeUntil) {
        if (g.trapSel == g.run.trap) { servo(g.trapSel, enl::SV_OPEN); g.trapOpen[g.trapSel] = true; good(3); }
        else { servo(g.trapSel, enl::SV_SHAKE); g.shakeUntil = now + 1100; sayClear(); bad(5); }
      }
    } else if (g.step == 5 || g.step == 9) {
      if (jd >= 0) mazeMove(jd);
      if (g.step == 5 && g.run.swap5.ok && !g.swapDone && g.cueEndAt && now - g.cueEndAt > (uint32_t)MAZE_SWAP_AFTER_MS) {
        WallSwap &w = g.run.swap5; g.run.maze1.setWall(w.cx, w.cy, w.cd, true); g.run.maze1.setWall(w.ox, w.oy, w.od, false);
        g.swapDone = true; g.glitchUntil = now + 900; audioTone(90, 250);
      }
      if (g.step == 9) {
        if (jp) { if (g.flashes > 0 && now >= g.flashUntil) { g.flashes--; g.flashUntil = now + 1000; g.remaining -= 5; audioTone(2000, 60); if (g.run.hard && audioIdle()) voice1("noir_eclair"); } else audioTone(150, 80); }
        uint32_t sabMs = g.run.hard ? 8000 : 5500;
        if (!g.sabotage && now > g.sabT && audioIdle()) { g.sabotage = true; g.sabEnd = now + sabMs; voice1("sabotage_joystick", true, true); }
        if (g.sabotage && now > g.sabEnd) { g.sabotage = false; g.sabT = now + 7000; voice1("sabotage_fin"); }
      }
    }
    if (g.step == 3) simonTick();
    if (g.step == 7) keysTick();
    if (g.step == 10 && g.pclockT0 && now - g.pclockT0 > (uint32_t)g.pclockTotal) { g.pclockT0 = now; bad(PATCH_PENALTY_S); }
  } else {
    for (int i = 0; i < 5; i++) { encDelta(i); btnTake(btnEnc[i]); }
    joyEvent(); bool jp = btnTake(btnJoy);
    if ((g.phase == PH_WIN || g.phase == PH_BOOM) && (jp || now - g.endAt > 60000) && audioIdle()) startRun();
    if (g.phase == PH_ARM && jp) giveHint(g.hint + 1);
  }
}

// ---------------- rendu : barrettes, TM1637, œil, CYD 2
static const uint32_t C_TRAP[3] = {0xE53935, 0x22C55E, 0x2B7CFF};
static const uint32_t STICK_OF_WIRE[5] = {0xE53935, 0xB44AFF, 0xF5C518, 0x22C55E, 0x2B7CFF};   // rouge, noir->violet, jaune, vert, bleu
void scanner(int bar, int t, int step, uint32_t col, int sweeps = SIMON_SWEEPS) {
  static const uint8_t LV[4] = {255, 140, 56, 16}; int k = t / step; if (k < 0 || k >= sweeps * SIMON_LEDS) return;
  int sweep = k / SIMON_LEDS, i = k % SIMON_LEDS; bool fwd = sweep % 2 == 0; int head = fwd ? i : SIMON_LEDS - 1 - i;
  for (int d = 0; d <= 3; d++) { int p = fwd ? head - d : head + d; if (p >= 0 && p < SIMON_LEDS) ledSet(bar, p, col, LV[d] / 255.0f); }
}
void renderLeds() {
  uint32_t now = millis(); ledClear(); ledCap = now < g.shakeUntil ? 77 : 255;
  if (g.phase == PH_PLAY && g.step == 2) {
    bool dark = g.run.hard && g.barT0 && now - g.barT0 > (uint32_t)TRAP_DARK_MS;
    if (!dark) for (int h = 0; h < 10; h++) for (int i = 0; i < 4; i++) ledSet(h / 2, (h % 2) * 4 + i, C_TRAP[g.run.bar[h]], 1);
  } else if (g.phase == PH_PLAY && g.step == 3) {
    if (g.sim.ph == 2) { int beat = SIMON_SWEEPS * SIMON_LEDS * g.sim.step, per = beat + g.sim.gap, t = now - g.sim.t0, k = t / per, w = t - k * per;
      if (k < g.sim.len && w < beat) scanner(g.run.simonSeq[k], w, g.sim.step, STICK_RGB[g.run.simonSeq[k]]); }
    if (g.sim.flashT && now - g.sim.flashT < 700) {
      if (g.sim.flashErr) { if ((now - g.sim.flashT) % 240 < 140) for (int b = 0; b < 5; b++) for (int i = 0; i < 8; i++) ledSet(b, i, 0xFF2A1F, 160 / 255.0f); }
      else scanner(g.sim.flashS, now - g.sim.flashT, 24, STICK_RGB[g.sim.flashS], 1);
    }
  } else if (g.phase == PH_PLAY && g.step == 7 && g.k7.ph == 2) { for (int b = 0; b < 5; b++) for (int i = 0; i < 8; i++) ledSet(b, i, 0x22C55E, 1); }
  else if (g.phase == PH_PLAY && (g.step == 4 || g.step == 10)) {
    for (int c = 0; c < 5; c++) { int s = s3b.in.plug[c]; if (s >= 0) for (int i = 0; i < 8; i++) ledSet(s, i, STICK_OF_WIRE[g.run.wires[c]], 0.7f); }
    if (g.step == 10 && g.pclockTotal) { uint32_t el = g.pclockT0 ? now - g.pclockT0 : 0; int left = std::max(0, g.pclockTotal - (int)el); int n = (left * 8 + g.pclockTotal - 1) / g.pclockTotal; bool low = left < g.pclockTotal / 4;
      for (int i = 0; i < 8; i++) { if (i < n) ledSet(0, i, low ? 0xE53935 : 0xFFA000, low && (now / 200) % 2 ? 0.5f : 1); else ledSet(0, i, 0, 0); } }
  } else if (g.phase == PH_PLAY && g.step == 8 && !g.run.hard) {
    // barrette n allumée pendant que la lettre n est épelée
    static int k = -1; static uint32_t kt = 0; static char lastId[32] = "";
    if (strcmp(voiceNow, lastId)) { strncpy(lastId, voiceNow, 31); if (!strncmp(voiceNow, "clue_mot_", 9)) k = -1; else if (!strncmp(voiceNow, "lettre_", 7)) { k++; kt = now; } }
    if (k >= 0 && k < 5 && now - kt < 1400) { int s = g.run.vWord == "envers" ? 4 - k : k; for (int i = 0; i < 8; i++) ledSet(s, i, 0x00E5FF, 1); }
  } else if (g.phase == PH_PLAY) {
    int done = (g.step - 1) * 40 / 12; for (int j = 0; j < 40; j++) { if (j < done) ledSet(j / 8, j % 8, 0x00E5FF, 0.45f); else if (j == done && (now / 300) % 2) ledSet(j / 8, j % 8, 0xFFA000, 1); }
  } else if (g.phase == PH_WIN) { int a = (int)((sinf(now / 500.0f) + 1) / 2 * 40); for (int j = 0; j <= a && j < 40; j++) ledSet(j / 8, j % 8, 0x00E5FF, 0.8f); }
  else if (g.phase == PH_BOOM) { if ((now / 90) % 2) for (int j = 0; j < 40; j++) ledSet(j / 8, j % 8, 0xE53935, 1); }
  else { int k = (now / 900) % 5; scanner(k, now % 900, 900 / 16, 0x3D8BFF); }
  if (g.phase == PH_PLAY && g.step != 3 && now < g.lieUntil && now >= g.shakeUntil) for (int j = 0; j < 40; j++) if (esp_random() % 100 < 35) ledSet(j / 8, j % 8, 0xE53935, 1);
  if (now < g.okUntil && g.step != 3) for (int j = 0; j < 40; j += 3) ledSet(j / 8, j % 8, 0x22C55E, 1);
  if (now < g.koUntil && g.step != 3 && now >= g.shakeUntil) for (int j = 1; j < 40; j += 3) ledSet(j / 8, j % 8, 0xE53935, 1);
  ledShow();
}
void renderTm() {
  static uint32_t last = 0; uint32_t now = millis(); if (now - last < 100) return; last = now;
  int sec = (int)ceilf(g.remaining);
  bool blink = g.phase == PH_PLAY && sec <= 30 && (now / 250) % 2;
  if (g.phase == PH_ARM || g.phase == PH_ARM_WAIT_DOWN) tmTime(TIME_S, true);
  else if (g.phase == PH_BOOM) tmTime(0, (now / 300) % 2);
  else tmTime(sec, (now / 500) % 2 == 0 || g.phase != PH_PLAY, blink);
}
void sendEye() {
  enl::Eye e = {}; uint32_t now = millis();
  e.level = voiceLevel;
  if (g.phase == PH_WIN) e.mood = enl::M_WIN; else if (g.phase == PH_BOOM) e.mood = enl::M_BOOM;
  else if (now < g.koUntil) e.mood = enl::M_KO; else if (now < g.okUntil) e.mood = enl::M_OK;
  else if (voiceBusy && voiceLie) e.mood = enl::M_LIE; else if (voiceBusy) e.mood = enl::M_CLUE;
  else if (g.phase == PH_PLAY && g.remaining <= 30) e.mood = enl::M_ALERT; else e.mood = enl::M_CALM;
  L.send(enl::CYD1, enl::EYE, &e, sizeof e);
}
void sendCyd2() {
  enl::Cyd2 c = {}; uint32_t now = millis(); Run &R = g.run;
  c.step = g.phase == PH_PLAY ? g.step : 0; strncpy(c.serial, R.serial, 5); c.lot = R.lot; c.timeLeft = std::max(0, (int)g.remaining); c.battPct = 100;
  c.flags = (g.sabotage ? 1 : 0) | (now < g.flashUntil ? 2 : 0) | (now < g.glitchUntil ? 4 : 0) | (voiceBusy ? 8 : 0);
  if (g.phase == PH_ARM || g.phase == PH_ARM_WAIT_DOWN) { c.mode = enl::C_ARM; if (g.phase == PH_ARM_WAIT_DOWN) strcpy(c.sub, "levier ARM en bas"); }
  else if (g.phase == PH_WIN) c.mode = enl::C_WIN; else if (g.phase == PH_BOOM) c.mode = enl::C_BOOM;
  else switch (g.step) {
    case 1: case 8: c.mode = enl::C_LETTERS; for (int i = 0; i < 5; i++) c.text[i] = RING[g.encPos[i]];
      if (g.step == 1) { if (g.melScore >= 0) snprintf(c.sub, sizeof c.sub, "%s  %d/5", R.scramble.c_str(), g.melScore); else strncpy(c.sub, R.scramble.c_str(), sizeof c.sub - 1); } break;
    case 6: case 11: c.mode = enl::C_CODE; if (now < g.codeLockUntil) strcpy(c.text, "BLOQUE"); else { for (int i = 0; i < 4; i++) c.text[i] = i < (int)g.code.size() ? '*' : '-'; } break;
    case 3: c.mode = enl::C_SIMON; snprintf(c.text, sizeof c.text, "SIMON %d/%d", g.sim.len - R.simonT.start + 1, R.simonT.target - R.simonT.start + 1); strcpy(c.sub, g.sim.ph == 3 ? "touche les prises" : "regarde"); break;
    case 5: case 9: {
      c.mode = enl::C_MAZE; Maze &m = g.step == 5 ? R.maze1 : R.maze2; c.px = g.px; c.py = g.py; c.gx = m.gx; c.gy = m.gy;
      bool dark = g.step == 9 && now >= g.flashUntil;
      for (int y = 0; y < 5; y++) for (int x = 0; x < 5; x++) {
        bool vis = true;
        if (dark) { int dx = abs(x - g.px), dy = abs(y - g.py); vis = R.hard ? (dx + dy <= 1) : (dx <= 1 && dy <= 1); }
        c.walls[y * 5 + x] = vis ? m.walls[y][x] : 0xFF;
      }
      strcpy(c.text, g.step == 5 ? "VERROU" : "NOIR"); if (g.step == 9) snprintf(c.sub, sizeof c.sub, "eclairs : %d", g.flashes); break; }
    case 2: c.mode = enl::C_TRAP; strcpy(c.text, g.trapSel == 0 ? "< A" : g.trapSel == 1 ? "B >" : "A  ?  B"); strcpy(c.sub, "joystick, puis appuie"); break;
    case 7: c.mode = enl::C_KEYS; strcpy(c.text, "CLES I II"); break;
    case 4: case 10: c.mode = enl::C_PATCH; strcpy(c.text, g.step == 4 ? "BAIE" : "BAIE 2"); break;
    case 12: c.mode = enl::C_TX; strcpy(c.text, "TRANSMIT"); break;
  }
  L.send(enl::CYD2, enl::CYD2_STATE, &c, sizeof c);
}
void onTouch(uint8_t from, const enl::Touch &t) {
  if (from != enl::CYD2 || !t.zone) return;
  if (t.zone == 2) { giveHint(g.hint + 1); return; }
  // RÉÉCOUTER : rejoue la consigne de l'étape (coûts du web : cryptex difficile −5 s ; trappe difficile −5 s et barrettes rallumées)
  if (g.phase == PH_ARM) { voice1("arm_cache", false, true); return; }
  if (g.phase != PH_PLAY) return;
  int s = g.step; std::vector<std::string> v = {objectiveId(g.run, s)}; for (auto &x : g.run.cues[s]) v.push_back(x);
  if (s == 5) v = {objectiveId(g.run, 5), "clue_verrou"}; if (s == 9) v = {objectiveId(g.run, 9)}; if (s == 12) v = {objectiveId(g.run, 12), "clue_transmit"};
  if (s == 8 && g.run.hard) g.remaining -= CRYPTEX_REPLAY_COST_S;
  if (s == 2 && g.run.hard) { g.remaining -= TRAP_REPLAY_COST_S; g.barT0 = 0; g.waitCue = true; g.afterCue = 2; }
  voice(v, false, true);
  if (s == 3) { simonReplay(0); g.waitCue = true; g.afterCue = 3; }
}
