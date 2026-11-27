// EntiteGame.h — port C++ fidèle de js/game.js (v0.5.4) : makeRun(seed). Même graine = même partie que le web.
// Logique pure (pas d'Arduino) : testée sur PC contre node (tools/test_game.sh).
#pragma once
#include <stdint.h>
#include <string>
#include <vector>
#include <cmath>
#include <cstdio>
#include <algorithm>

namespace entite {

static const int TIME_S = 480, NSTEPS = 12, DETENTS = 20, NENC = 5;
static const char *RING = "ABCDEFGHIJLMNOPRSTUV";
static const char *WIRE_COLORS[5] = {"rouge", "noir", "jaune", "vert", "bleu"};
static const char *TRAP_COLORS[3] = {"rouge", "vert", "bleu"};
static const char *THEME_NAMES[3] = {"objet", "nature", "machine"};
static const std::vector<std::vector<const char *>> THEMES = {
  {"CABLE", "VERRE", "FUSIL", "PIANO", "TABLE", "PLUME"},
  {"TIGRE", "ORAGE", "NUAGE", "OMBRE", "GLACE", "VAGUE", "FLEUR", "ARBRE"},
  {"RADIO", "BOMBE", "SONDE", "ROBOT", "TRAIN"}};
static const std::vector<const char *> WORDS = {"SIGNE", "PORTE", "CABLE", "ROUGE", "LAMPE", "CODES", "VERRE", "TIGRE", "SABLE", "ORAGE", "PLUME", "RADIO", "BOMBE", "SONDE", "PANNE", "FUSIL", "NUAGE", "OMBRE", "GLACE", "TEMPS", "VAGUE", "PIANO", "FLEUR", "ROBOT", "ACIER", "AGENT", "TABLE", "LIGNE", "FORGE", "PISTE", "ARBRE", "CORDE", "TRAIN", "PHARE"};
// Simon
static const uint8_t SIMON_LEDS = 8;
static const uint16_t SIMON_NOTES[5] = {262, 294, 330, 392, 440};
static const uint32_t STICK_RGB[5] = {0xB44AFF, 0x2B7CFF, 0x22C55E, 0xE53935, 0xF5C518};
struct SimonTier { int start, target, first, between; bool speedup, lastReversed; };
static const SimonTier SIMON_MOYEN = {2, 5, 8000, 2500, false, false};
static const SimonTier SIMON_DIFF = {3, 6, 6000, 2000, true, true};
static const int SIMON_STEP_MS = 36, SIMON_GAP_MS = 200, SIMON_STEP_MIN = 20, SIMON_GAP_MIN = 120, SIMON_SWEEPS = 2;
static const double SIMON_SPEEDUP = 0.88;
static const int PATCH_CLOCK_MOYEN = 30000, PATCH_CLOCK_DIFF = 20000, PATCH_PENALTY_S = 8;
static const int CRYPTEX_REPLAY_COST_S = 5, TRAP_DARK_MS = 5000, TRAP_REPLAY_COST_S = 5;
static const int KEYS_WINDOW_MS = 1000, KEYS_PENALTY_S = 5, KEYPAD_LOCK_MS = 3000, MAZE_SWAP_AFTER_MS = 8000;
static const int SHAKE_DEG = 6, SHAKE_CYCLES = 3, SHAKE_STEP_MS = 100;
static const int HINT_COST[4] = {0, 0, 15, 30};
static const uint32_t AUTO_HINT_MS = 45000;

// DIRS : up, right, down, left = {dx, dy, bit, bit opposé} (même ordre que Object.keys(DIRS))
enum Dir : uint8_t { UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3, NODIR = 255 };
static const int8_t DIRS[4][4] = {{0, -1, 1, 4}, {1, 0, 2, 8}, {0, 1, 4, 1}, {-1, 0, 8, 2}};
static const char *DIR_NAMES[4] = {"up", "right", "down", "left"};

struct Rng {  // mulberry32, identique au JS (double / 2^32)
  uint32_t a;
  explicit Rng(uint32_t s) : a(s) {}
  double next() {
    a += 0x6d2b79f5u; uint32_t t = (a ^ (a >> 15)) * (1u | a);
    t = (t + ((t ^ (t >> 7)) * (61u | t))) ^ t;
    return (double)(t ^ (t >> 14)) / 4294967296.0;
  }
  int i(int n) { return (int)std::floor(next() * n); }
};

struct Maze {
  int n = 5; uint8_t walls[5][5]; int sx, sy, gx, gy; std::vector<uint8_t> path;
  bool canMove(int x, int y, int d) const {
    int nx = x + DIRS[d][0], ny = y + DIRS[d][1];
    if (nx < 0 || ny < 0 || nx >= n || ny >= n) return false;
    return !(walls[y][x] & DIRS[d][2]);
  }
  std::vector<uint8_t> solve(int fx, int fy) const {  // BFS, ordre des DIRS
    int prevC[25], prevD[25]; bool seen[25] = {false};
    int q[25], qh = 0, qt = 0; q[qt++] = fy * n + fx; seen[fy * n + fx] = true; prevC[fy * n + fx] = -1;
    while (qh < qt) {
      int c = q[qh++], cx = c % n, cy = c / n; if (cx == gx && cy == gy) break;
      for (int d = 0; d < 4; d++) {
        int nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || (walls[cy][cx] & DIRS[d][2]) || seen[ny * n + nx]) continue;
        seen[ny * n + nx] = true; prevC[ny * n + nx] = c; prevD[ny * n + nx] = d; q[qt++] = ny * n + nx;
      }
    }
    std::vector<uint8_t> out; int k = gy * n + gx; if (!seen[k]) return out;
    while (prevC[k] >= 0) { out.insert(out.begin(), (uint8_t)prevD[k]); k = prevC[k]; }
    return out;
  }
  void setWall(int x, int y, int d, bool closed) {
    int nx = x + DIRS[d][0], ny = y + DIRS[d][1];
    if (closed) { walls[y][x] |= DIRS[d][2]; walls[ny][nx] |= DIRS[d][3]; }
    else { walls[y][x] &= ~DIRS[d][2]; walls[ny][nx] &= ~DIRS[d][3]; }
    path = solve(sx, sy);
  }
};

static inline Maze makeMaze(int n, Rng &r) {
  Maze m; m.n = n;
  for (int y = 0; y < n; y++) for (int x = 0; x < n; x++) m.walls[y][x] = 15;
  bool seen[5][5] = {{false}}; std::vector<std::pair<int, int>> st; st.push_back({0, n - 1}); seen[n - 1][0] = true;
  while (!st.empty()) {
    int x = st.back().first, y = st.back().second; int opts[4], no = 0;
    for (int d = 0; d < 4; d++) { int nx = x + DIRS[d][0], ny = y + DIRS[d][1]; if (nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny][nx]) opts[no++] = d; }
    if (!no) { st.pop_back(); continue; }
    int d = opts[(int)std::floor(r.next() * no)];
    m.walls[y][x] &= ~DIRS[d][2]; m.walls[y + DIRS[d][1]][x + DIRS[d][0]] &= ~DIRS[d][3];
    seen[y + DIRS[d][1]][x + DIRS[d][0]] = true; st.push_back({x + DIRS[d][0], y + DIRS[d][1]});
  }
  m.sx = 0; m.sy = n - 1; m.gx = n - 1; m.gy = 0; m.path = m.solve(m.sx, m.sy);
  return m;
}

struct WallSwap { bool ok = false; int cx, cy, cd, ox, oy, od; };
static inline WallSwap wallSwap(const Maze &maze, uint32_t seed) {
  WallSwap w; int n = maze.n; Rng rr((seed ^ 0x5a17c3u));
  std::vector<std::pair<int, int>> cells; cells.push_back({maze.sx, maze.sy});
  for (uint8_t d : maze.path) { auto c = cells.back(); cells.push_back({c.first + DIRS[d][0], c.second + DIRS[d][1]}); }
  struct Cand { int cx, cy, cd, ox, oy, od; }; std::vector<Cand> cands;
  for (size_t i = 1; i + 2 < cells.size(); i++) {
    auto a = cells[i], b = cells[i + 1]; int dir = maze.path[i];
    std::vector<std::pair<int, int>> side; side.push_back(a); size_t qh = 0;  // ordre d'insertion = Set JS
    auto has = [&](int x, int y) { for (auto &s : side) if (s.first == x && s.second == y) return true; return false; };
    while (qh < side.size()) {
      auto c = side[qh++];
      for (int dd = 0; dd < 4; dd++) {
        if (!maze.canMove(c.first, c.second, dd)) continue;
        int nx = c.first + DIRS[dd][0], ny = c.second + DIRS[dd][1];
        if (c == a && nx == b.first && ny == b.second) continue;
        if (!has(nx, ny)) side.push_back({nx, ny});
      }
    }
    for (auto &c : side)
      for (int dd = 0; dd < 4; dd++) {
        int nx = c.first + DIRS[dd][0], ny = c.second + DIRS[dd][1];
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || has(nx, ny) || maze.canMove(c.first, c.second, dd)) continue;
        cands.push_back({a.first, a.second, dir, c.first, c.second, dd});
      }
  }
  if (cands.empty()) return w;
  const Cand &c = cands[(int)std::floor(rr.next() * cands.size())];
  w.ok = true; w.cx = c.cx; w.cy = c.cy; w.cd = c.cd; w.ox = c.ox; w.oy = c.oy; w.od = c.od; return w;
}

// Consigne de branchement : req[câble] = REQ_FREE (libre), REQ_OUT (débranché) ou n° de prise 0..4
static const int8_t REQ_FREE = -2, REQ_OUT = -1;
struct Patch { std::string kind; int8_t req[5]; std::vector<std::string> cues; };
struct Plug { int cable, socket; };

struct Run {
  uint32_t seed; bool hard; std::string tier;
  std::string vEnc1, vTrap, vPatch1, vCode1, vKeys, vWord, vPatch2, vCode2;
  int digits[4]; char serial[6]; int lot;
  std::string theme, word1, scramble; int enc1[5];
  int counts[3]; int order[3]; int bar[10]; int trapColors[2]; int trap;
  SimonTier simonT; std::vector<int> simonSeq;
  int wires[5];  // couleur (index WIRE_COLORS) du câble c, tirée par le web ; le matériel impose ses couleurs (voir hub)
  Patch patch1, patch2; Maze maze1, maze2; WallSwap swap5;
  int frags[4]; std::string code1, code2; int keyOrder[2];
  std::vector<int> fragLies; bool encFalse, wire2False, keysTwice;
  Plug decoyWire1, decoyWire2; int decoyFrags[4]; int decoyKeys[2]; char decoyWord;
  std::string word, encWord, spell; int enc2[5];
  std::vector<std::string> cues[13];
  std::string sig;
};

static inline int ringIdx(char ch) { for (int i = 0; i < DETENTS; i++) if (RING[i] == ch) return i; return -1; }
static inline std::string lower1(char c) { std::string s(1, (char)(c - 'A' + 'a')); return s; }

// fixedWires : couleurs imposées par le matériel (câble du port c) ; le tirage du web est quand même consommé
static inline Run makeRun(uint32_t seed, const int *fixedWires = nullptr) {
  Run R; Rng r(seed); R.seed = seed;
  auto pickS = [&](const std::vector<const char *> &a) { return std::string(a[r.i((int)a.size())]); };
  R.hard = !(r.next() < 0.5); R.tier = R.hard ? "difficile" : "moyen";
  bool h = R.hard;
  R.vEnc1 = h ? pickS({"nu"}) : pickS({"theme"});
  R.vTrap = h ? pickS({"rare", "moyenne"}) : pickS({"frequente", "gauche"});
  R.vPatch1 = h ? pickS({"route", "echange", "serie"}) : pickS({"route", "echange", "debranche"});
  R.vCode1 = h ? pickS({"envers", "plus1"}) : pickS({"ordre", "envers"});
  R.vKeys = h ? pickS({"lourde", "legere"}) : pickS({"ensemble"});
  R.vWord = h ? pickS({"envers", "suivante"}) : pickS({"ordre", "envers"});
  R.vPatch2 = h ? pickS({"double", "serie"}) : pickS({"double", "echange"});
  R.vCode2 = h ? pickS({"envers", "decale"}) : pickS({"envers", "rotation"});
  auto shuffleI = [&](std::vector<int> a) { for (int i = (int)a.size() - 1; i > 0; i--) { int j = r.i(i + 1); std::swap(a[i], a[j]); } return a; };
  std::vector<int> d10 = shuffleI({0, 1, 2, 3, 4, 5, 6, 7, 8, 9});
  for (int i = 0; i < 4; i++) R.digits[i] = d10[i];
  snprintf(R.serial, sizeof R.serial, "%d%d-%d%d", R.digits[0], R.digits[1], R.digits[2], R.digits[3]);
  R.lot = 100 + r.i(900);
  // 1. mot mêlé
  int th = r.i(3); R.theme = THEME_NAMES[th];
  R.word1 = THEMES[th][r.i((int)THEMES[th].size())];
  R.scramble = R.word1; int best = 99;
  for (int k = 0; k < 40; k++) {
    std::vector<int> ix = shuffleI({0, 1, 2, 3, 4}); std::string s; for (int i : ix) s += R.word1[i];
    if (s == R.word1) continue;
    int fixed = 0; for (int i = 0; i < 5; i++) if (s[i] == R.word1[i]) fixed++;
    if (fixed < best) { best = fixed; R.scramble = s; if (fixed == 0) break; }
  }
  for (int i = 0; i < 5; i++) R.enc1[i] = ringIdx(R.word1[i]);
  R.cues[1] = {"clue_mot_melange"}; if (R.vEnc1 == "theme") R.cues[1].push_back("theme_" + R.theme);
  // 2. trappe
  static const int CNT[3][3] = {{5, 3, 2}, {6, 3, 1}, {5, 4, 1}};
  int ci = r.i(3); for (int i = 0; i < 3; i++) R.counts[i] = CNT[ci][i];
  std::vector<int> ord = shuffleI({0, 1, 2}); for (int i = 0; i < 3; i++) R.order[i] = ord[i];
  std::vector<int> bar; for (int i = 0; i < 3; i++) for (int k = 0; k < R.counts[i]; k++) bar.push_back(ord[i]);
  bar = shuffleI(bar); for (int i = 0; i < 10; i++) R.bar[i] = bar[i];
  int trapColor = R.vTrap == "frequente" ? ord[0] : R.vTrap == "moyenne" ? ord[1] : R.vTrap == "rare" ? ord[2] : bar[0];
  std::vector<int> oth; for (int c = 0; c < 3; c++) if (c != trapColor) oth.push_back(c);
  int other = oth[r.i(2)];
  std::vector<int> tc = shuffleI({trapColor, other}); R.trapColors[0] = tc[0]; R.trapColors[1] = tc[1];
  R.trap = tc[0] == trapColor ? 0 : 1;
  R.cues[2] = {"clue_trappe_" + R.vTrap};
  // 3. Simon
  R.simonT = h ? SIMON_DIFF : SIMON_MOYEN;
  for (int i = 0; i < R.simonT.target; i++) R.simonSeq.push_back(r.i(5));
  R.cues[3] = {"clue_simon", "clue_simon_noir", "simon_notes"};
  // 4 et 10. baie banane
  std::vector<int> w = shuffleI({0, 1, 2, 3, 4}); for (int i = 0; i < 5; i++) R.wires[i] = fixedWires ? fixedWires[i] : w[i];
  auto cab = [&](int c) { return std::string("cable_") + WIRE_COLORS[R.wires[c]]; };
  auto pr = [&](int s) { return std::string("prise_") + std::to_string(s + 1); };
  auto two = [&](int &a, int &b) { a = r.i(5); b = r.i(4); if (b >= a) b++; };
  auto patchOf = [&](const std::string &kind, int layer) {
    Patch p; p.kind = kind; for (int i = 0; i < 5; i++) p.req[i] = REQ_FREE;
    std::string head = layer == 1 ? "clue_patch" : "clue_patch2";
    if (kind == "route") { int A, N; two(A, N); p.req[A] = N; p.cues = {"clue_patch_route", cab(A), pr(N)}; return p; }
    if (kind == "echange") { int X, Y; two(X, Y); p.req[X] = Y; p.req[Y] = X; p.cues = {head + "_echange", cab(X), "patch_et", cab(Y), "patch_echange_fin"}; return p; }
    if (kind == "debranche") { int X, Y; two(X, Y); p.req[X] = REQ_OUT; p.req[Y] = REQ_OUT; p.cues = {"clue_patch_debranche", cab(X), "patch_et", cab(Y), "patch_laisse_deux"}; return p; }
    int rank = r.i(4); int A = r.i(4); if (A >= rank) A++;
    if (kind == "serie" && layer == 1) { p.req[A] = rank; p.cues = {"clue_patch_serie", cab(A), "patch_rang_chiffre", "chiffre_" + std::to_string(R.digits[rank])}; return p; }
    int B = r.i(4); if (B >= A) B++;  // tiré aussi pour « double » (comme le JS)
    if (B == rank) for (int c = 0; c < 5; c++) if (c != A && c != rank) { B = c; break; }
    if (kind == "serie") {
      p.req[B] = REQ_OUT; p.req[A] = rank;
      p.cues = {"clue_patch2_serie", cab(B), "patch_laisse", cab(A), "patch_rang_chiffre", "chiffre_" + std::to_string(R.digits[rank])}; return p;
    }
    int Bd, C; two(Bd, C); int M = r.i(4); if (M >= C) M++;
    if (M == Bd) for (int s = 0; s < 5; s++) if (s != C && s != Bd) { M = s; break; }
    p.req[Bd] = REQ_OUT; p.req[C] = M; p.cues = {"clue_patch_double", cab(Bd), "patch_laisse", cab(C), pr(M)}; return p;
  };
  R.patch1 = patchOf(R.vPatch1, 1); R.patch2 = patchOf(R.vPatch2, 2);
  R.cues[4] = R.patch1.cues; R.cues[10] = R.patch2.cues;
  // 5 et 9. labyrinthes
  R.maze1 = makeMaze(5, r); R.maze2 = makeMaze(5, r);
  if (h) R.swap5 = wallSwap(R.maze1, seed);
  // fragments et codes
  for (int i = 0; i < 4; i++) R.frags[i] = r.i(10);
  int *f = R.frags; int c1[4], c2[4]; int last = R.digits[3];
  for (int i = 0; i < 4; i++) c1[i] = R.vCode1 == "envers" ? f[3 - i] : R.vCode1 == "plus1" ? (f[i] + 1) % 10 : f[i];
  static const int ROT[4] = {2, 3, 0, 1};
  for (int i = 0; i < 4; i++) c2[i] = R.vCode2 == "rotation" ? f[ROT[i]] : R.vCode2 == "decale" ? (f[i] + last) % 10 : f[3 - i];
  for (int i = 0; i < 4; i++) { R.code1 += (char)('0' + c1[i]); R.code2 += (char)('0' + c2[i]); }
  R.cues[6] = {R.vCode1 == "ordre" ? std::string("clue_code1") : "clue_code1_" + R.vCode1};
  R.cues[11] = {"clue_code2_" + R.vCode2};
  // 7. clés
  bool heavyFirst = R.vKeys == "lourde";
  bool swap = heavyFirst ? (R.digits[1] > R.digits[0]) : (R.digits[1] < R.digits[0]);
  R.keyOrder[0] = swap ? 1 : 0; R.keyOrder[1] = swap ? 0 : 1;
  R.cues[7] = {"cles_intro"}; if (R.vKeys != "ensemble") R.cues[7].push_back("clue_cles_" + R.vKeys);
  // mensonges
  std::vector<int> fl = shuffleI({0, 1, 2, 3}); fl.resize(h ? 3 : 2); std::sort(fl.begin(), fl.end()); R.fragLies = fl;
  R.encFalse = h; R.wire2False = h; R.keysTwice = h;
  auto wrongPlug = [&](const Patch &p) {
    Plug o; int tgt = -1; for (int c = 0; c < 5; c++) if (p.req[c] >= 0) { tgt = c; break; }
    if (tgt >= 0) { std::vector<int> others; for (int c = 0; c < 5; c++) if (c != tgt) others.push_back(c); o.cable = others[r.i(4)]; o.socket = p.req[tgt]; return o; }
    int c = -1; for (int k = 0; k < 5; k++) if (p.req[k] != REQ_FREE) { c = k; break; }
    int s = r.i(4); if (s >= c) s++; o.cable = c; o.socket = s; return o;
  };
  R.decoyWire1 = wrongPlug(R.patch1); R.decoyWire2 = wrongPlug(R.patch2);
  for (int i = 0; i < 4; i++) R.decoyFrags[i] = (f[i] + 1 + r.i(9)) % 10;
  R.decoyKeys[0] = R.keyOrder[1]; R.decoyKeys[1] = R.keyOrder[0];
  // 8. cryptex
  std::vector<const char *> pool; for (auto wd : WORDS) if (R.word1 != wd) pool.push_back(wd);
  R.word = pool[r.i((int)pool.size())];
  R.encWord = R.word; if (R.vWord == "suivante") for (auto &ch : R.encWord) ch = RING[(ringIdx(ch) + 1) % DETENTS];
  for (int i = 0; i < 5; i++) R.enc2[i] = ringIdx(R.encWord[i]);
  R.spell = R.word; if (R.vWord == "envers") std::reverse(R.spell.begin(), R.spell.end());
  R.cues[8] = {"clue_mot_" + R.vWord}; for (char ch : R.spell) R.cues[8].push_back("lettre_" + lower1(ch));
  R.decoyWord = RING[(R.enc2[0] + 3 + r.i(15)) % DETENTS];
  R.sig = R.tier + "|" + R.vEnc1 + "|" + R.vTrap + "|" + R.vPatch1 + "|" + R.vCode1 + "|" + R.vKeys + "|" + R.vWord + "|" + R.vPatch2 + "|" + R.vCode2;
  return R;
}

// objectif (guide.js) et indices
static inline std::string objectiveId(const Run &R, int step) {
  static const char *O[13] = {"obj_armer", "obj_mot_melange", "obj_trappe_joy", "obj_simon", "obj_cables", "obj_verrou", "obj_code", "obj_cles", "obj_mot", "obj_noir", "obj_cables2", "obj_code", "obj_transmit"};
  if (step == 7) return R.vKeys == "ensemble" ? "obj_cles_ensemble" : "obj_cles_signal";
  return O[step];
}
static inline int firstMove(const Maze &m, int px, int py) { auto p = m.solve(px, py); return p.empty() ? NODIR : p[0]; }

}  // namespace entite
