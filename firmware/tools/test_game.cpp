// g++ -std=c++17 -I../libraries/EntiteGame/src test_game.cpp : même résumé que dump_run.mjs
#include "EntiteGame.h"
#include <iostream>
#include <sstream>
using namespace entite;
static const char *TC[3] = {"rouge", "vert", "bleu"};
static std::string joinI(const int *a, int n, const char *sep = ",") { std::ostringstream o; for (int i = 0; i < n; i++) o << (i ? sep : "") << a[i]; return o.str(); }
static std::string joinS(const std::vector<std::string> &v) { std::ostringstream o; for (size_t i = 0; i < v.size(); i++) o << (i ? " " : "") << v[i]; return o.str(); }
static std::string mz(const Maze &m) { std::ostringstream o; for (int y = 0; y < 5; y++) for (int x = 0; x < 5; x++) o << ((x || y) ? "," : "") << (int)m.walls[y][x]; o << "/"; for (size_t i = 0; i < m.path.size(); i++) o << (i ? "," : "") << DIR_NAMES[m.path[i]]; return o.str(); }
int main(int argc, char **argv) {
  int N = argc > 1 ? atoi(argv[1]) : 300; std::vector<uint32_t> seeds; for (int i = 1; i <= N; i++) seeds.push_back(i);
  for (uint32_t s : {0xdeadbeefu, 123456789u, 4294967295u, 2654435761u}) seeds.push_back(s);
  for (uint32_t s : seeds) {
    Run r = makeRun(s); std::ostringstream o;
    int req1[5], req2[5]; for (int i = 0; i < 5; i++) { req1[i] = r.patch1.req[i]; req2[i] = r.patch2.req[i]; }
    std::string bar, wires, tcs; for (int i = 0; i < 10; i++) bar += std::string(i ? "," : "") + TC[r.bar[i]];
    for (int i = 0; i < 5; i++) wires += std::string(i ? "," : "") + WIRE_COLORS[r.wires[i]];
    tcs = std::string(TC[r.trapColors[0]]) + "," + TC[r.trapColors[1]];
    std::string seq; for (int v : r.simonSeq) seq += std::to_string(v);
    std::string sw = r.swap5.ok ? std::to_string(r.swap5.cx) + "," + std::to_string(r.swap5.cy) + "," + DIR_NAMES[r.swap5.cd] + ">" + std::to_string(r.swap5.ox) + "," + std::to_string(r.swap5.oy) + "," + DIR_NAMES[r.swap5.od] : "-";
    std::string fl; for (int v : r.fragLies) fl += std::to_string(v);
    o << s << " | " << r.sig << " | " << r.serial << " | " << r.lot << " | " << r.word1 << " | " << r.scramble << " | " << bar << " | " << tcs << " | " << r.trap << " | " << seq
      << " | " << wires << " | " << joinI(req1, 5) << " | " << joinS(r.patch1.cues) << " | " << joinI(req2, 5) << " | " << joinS(r.patch2.cues) << " | " << mz(r.maze1) << " | " << mz(r.maze2) << " | " << sw
      << " | " << joinI(r.frags, 4, "") << " | " << r.code1 << " | " << r.code2 << " | " << joinI(r.keyOrder, 2, "") << " | " << fl << " | " << r.decoyWire1.cable << r.decoyWire1.socket << r.decoyWire2.cable << r.decoyWire2.socket
      << " | " << joinI(r.decoyFrags, 4, "") << " | " << r.word << " | " << joinI(r.enc2, 5) << " | " << joinS(r.cues[8]) << " | " << r.decoyWord;
    std::cout << o.str() << "\n";
  }
}
