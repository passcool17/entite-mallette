#!/usr/bin/env bash
# Compile les 4 cartes (aucun flash). Usage : tools/build_all.sh   -> tailles dans sizes.txt
set -euo pipefail
cd "$(dirname "$0")/.."
A=${ARDUINO_CLI:-arduino-cli}; command -v "$A" >/dev/null || A=/home/box/.local/bin/arduino-cli
S3="esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,CDCOnBoot=cdc,PartitionScheme=app3M_fat9M_16MB"
CYD="esp32:esp32:esp32"
: > sizes.txt
for sk in entite_hub:$S3 entite_s3b:$S3 entite_cyd1:$CYD entite_cyd2:$CYD; do
  name=${sk%%:*}; fq=${sk#*:}
  echo "== $name ($fq)"
  out=$("$A" compile -b "$fq" --libraries libraries --warnings default --output-dir "bin-$name" "$name" 2>&1) || { echo "$out" | tail -30; exit 1; }
  echo "$out" | grep -E "Sketch uses|Global variables" | sed "s/^/$name: /" | tee -a sizes.txt
done
echo "OK : 4 cartes compilees, 0 erreur (bin-*/ non versionnes)"
