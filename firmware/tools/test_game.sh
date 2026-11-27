#!/usr/bin/env bash
# Compare makeRun C++ (EntiteGame.h) et JS (js/game.js) sur 300 graines + 4 grandes. Sortie : OK ou le diff.
set -e; cd "$(dirname "$0")"
CXX="${CXX:-$(command -v g++ || echo "/home/box/opt/zig-venv/bin/python -m ziglang c++")}"
$CXX -std=c++17 -O1 -I../libraries/EntiteGame/src test_game.cpp -o /tmp/entite_test_game
node dump_run.mjs 300 > /tmp/entite_js.txt
/tmp/entite_test_game 300 > /tmp/entite_cpp.txt
if diff /tmp/entite_js.txt /tmp/entite_cpp.txt > /tmp/entite_diff.txt; then echo "OK : $(wc -l < /tmp/entite_js.txt) parties identiques JS = C++"; else head -c 3000 /tmp/entite_diff.txt; exit 1; fi
