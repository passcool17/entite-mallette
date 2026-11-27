#!/usr/bin/env bash
# Image LittleFS des voix du hub. Règle v0.1.5 (voix/RECETTE-VOIX.md) : on ne fabrique AUCUNE voix ici.
# On prend les répliques mp3Ready = true du manifeste (les mp3 que joue le web v0.5.4) ; intro et depart = les ORIGINAUX
# v0.1.5 figés (voix/raw/*_elevenlabs.mp3, md5 de la recette). Les répliques v0.3 (voix/v0.3/README.md) sont celles
# vérifiées recette ; les autres viennent de la passe v0.2.5g : listées « a_confirmer » dans _voix.txt.
# Aucun réencodage, aucun filtre ici : copie octet pour octet. Les autres répliques sont listées dans _absentes.txt
# (le hub les saute en silence et l'écrit au moniteur série).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=images-voix; STAGE=$OUT/data; rm -rf "$STAGE"; mkdir -p "$STAGE/v"
python3 - "$STAGE/v" <<'PY'
import json, os, shutil, sys, hashlib
dst = sys.argv[1]; m = json.load(open('../voix/manifest.json'))
ok, absent = [], []
for c in m['cues']:
    f = '../' + (c.get('file') or f"voix/{c['id']}.mp3")
    if c['id'] in ('intro', 'depart'): f = f"../voix/raw/{c['id']}_elevenlabs.mp3"
    if c.get('mp3Ready') and os.path.exists(f):
        shutil.copyfile(f, f"{dst}/{c['id']}.mp3"); ok.append(c['id'])
    else:
        absent.append(f"{c['id']}\t{c.get('source')}\tmp3Ready={c.get('mp3Ready')}\t{c['text']}")
open(f"{dst}/_absentes.txt", 'w').write('\n'.join(absent) + '\n')
v03 = {x[:-4] for x in os.listdir('../voix/v0.3') if x.endswith('.mp3')}
open(f"{dst}/_voix.txt", 'w').write('\n'.join(f"{i}\t{'recette_v0.1.5' if i in v03 or i in ('intro','depart') else 'a_confirmer'}" for i in ok) + '\n')
print(f"{sum(1 for i in ok if i in v03 or i in ('intro','depart'))} verifiees recette (v0.1.5 + v0.3), le reste a confirmer")
for ref, md5 in (('intro', 'df8ad9e40818efb583eb7a0da2db5ee2'), ('depart', 'aa0f997bad504297867ba2abd007dd14')):
    h = hashlib.md5(open(f"{dst}/{ref}.mp3", 'rb').read()).hexdigest()
    print(f"{ref}.mp3 md5 {h} {'= v0.1.5 OK' if h == md5 else '!= v0.1.5 (VOIR RECETTE)'}")
print(f"{len(ok)} voix copiees, {len(absent)} absentes (voir {dst}/_absentes.txt)")
PY
MK=$(ls -d "$HOME"/.arduino15/packages/esp32/tools/mklittlefs/*/mklittlefs | tail -1)
"$MK" -c "$STAGE" -p 256 -b 4096 -s 0xCE0000 "$OUT/voix-littlefs.bin" >/dev/null
du -sh "$STAGE" "$OUT/voix-littlefs.bin"
echo "Flasher a 0x310000 (voir README)."
