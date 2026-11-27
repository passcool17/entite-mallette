# Firmware — La mallette de l'Entité (4 cartes)

27 nov. 2026. Source des broches : `/workspace/mallette-entite/ASSEMBLAGE-CABLAGE.md` (FINAL, 24/24 par S3).
Jeu : port du web **v0.5.4** (`js/game.js`, `js/app.js`, `js/guide.js`). Même graine = même partie que le web
(`tools/test_game.sh` : 304 parties identiques JS = C++, labyrinthes et murs mobiles compris).

**Rien n'est flashé.** Flasher seulement avec l'accord de Pascal.

| Dossier | Carte | Rôle |
|---|---|---|
| `entite_hub/` | ESP32-S3 N16R8 (hub, base) | jeu, molettes, joystick, TM1637, barrettes, voix I2S |
| `entite_s3b/` | ESP32-S3 N16R8 (2e) | clavier, baie banane, serrures, leviers, 2 SG90 |
| `entite_cyd1/` | CYD 1 (couvercle) | l'œil |
| `entite_cyd2/` | CYD 2 (base) | n° de série, lettres, code, labyrinthe, RÉÉCOUTER / INDICE |
| `libraries/` | — | `EntiteGame` (tirage), `EntiteLink` (ESP-NOW), `EntiteCyd` (commun CYD) |

Liaison : **ESP-NOW** en diffusion, canal 1. Pas de fil de données. Aucune autre émission radio.

## Compiler (sans flasher)

Bibliothèques (une fois) :

```bash
arduino-cli lib install "ESP8266Audio" "Adafruit NeoPixel" "Adafruit ILI9341" "XPT2046_Touchscreen" "ESP32Servo"
```

Les 4 cartes :

```bash
tools/build_all.sh
```

## Flasher (avec l'accord de Pascal)

Une carte à la fois. Fermer le moniteur série avant. **CYD : USB seul, jamais USB + 5 V P1 en même temps.**
Le port peut changer : `ls /dev/ttyACM* /dev/ttyUSB*`. S'il manque le droit d'accès au port, Pascal ajoute son compte au groupe `dialout` lui-même.

Hub (S3, USB natif) :

```bash
arduino-cli compile --upload -p /dev/ttyACM0 -b esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,CDCOnBoot=cdc,PartitionScheme=app3M_fat9M_16MB --libraries libraries entite_hub
```

Voix du hub (image LittleFS, à faire une fois, après le hub) :

```bash
tools/make_voice_fs.sh
```

```bash
$(ls -d ~/.arduino15/packages/esp32/tools/esptool_py/*/ | tail -1)esptool --chip esp32s3 -p /dev/ttyACM0 -b 460800 write-flash 0x310000 images-voix/voix-littlefs.bin
```

2e S3 :

```bash
arduino-cli compile --upload -p /dev/ttyACM0 -b esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi,CDCOnBoot=cdc,PartitionScheme=app3M_fat9M_16MB --libraries libraries entite_s3b
```

CYD 1 :

```bash
arduino-cli compile --upload -p /dev/ttyUSB0 -b esp32:esp32:esp32 --libraries libraries entite_cyd1
```

CYD 2 :

```bash
arduino-cli compile --upload -p /dev/ttyUSB0 -b esp32:esp32:esp32 --libraries libraries entite_cyd2
```

Moniteur série (115200) :

```bash
arduino-cli monitor -p /dev/ttyACM0 -c baudrate=115200
```

## Banc d'essai (rapport PASS / FAIL au moniteur série)

Entrer en banc : taper `TEST` au moniteur série, **ou** au démarrage tenir : hub = SW du joystick ; 2e S3 = touche `#` ; CYD = un doigt sur l'écran.
Sur le hub, `TESTALL` lance le banc des 4 cartes (les lignes des autres arrivent préfixées `[S3B]`, `[CYD1]`, `[CYD2]`).

Ordre conseillé (une carte à la fois d'abord) :

1. **Hub** : repos des 16 entrées (doivent être HIGH) ; TM1637 (ACK + segments) ; barrettes (R, V, B par barrette, puis chenillard) ; 440 Hz **gauche seulement**, 660 Hz **droite seulement** ; LittleFS + voix `intro` ; 60 s pour tourner/appuyer les 5 molettes et le joystick (fronts par cran affichés) ; ping ESP-NOW des 3 autres. Ligne dédiée : `GPIO1 vivante (E5 SW)`.
2. **2e S3** : repos des 13 entrées (câbles débranchés) ; 90 s pour les 16 touches, 2 clés, 2 leviers, 5 câbles dans les 5 prises ; ligne dédiée `GPIO2 (JACK5) vivante`. **Servos** : seulement si on tape `SERVO` (30 s) — et seulement après avoir réglé et verrouillé le LM2596 à **5,0–5,2 V** au multimètre, avec 100–220 Ω, sans servo. Mouvement : fermé → +20° → fermé → tremblement ±6°, 3 cycles.
3. **CYD 1 / CYD 2** : couleurs plein écran, DEL RVB, 30 s de tactile (4 coins, coordonnées au série ; `CAL` = calibration 2 points, gardée en mémoire), ping du hub.

## Commandes série du hub

`TEST`, `TESTALL`, `SEED n` (rejoue la partie de la graine n, comme le web), `STATE`, `VOIX`.

## Voix (règle v0.1.5)

Aucune voix n'est créée ni modifiée ici. `tools/make_voice_fs.sh` copie octet pour octet :
- `intro` / `depart` = **originaux v0.1.5** (`voix/raw/*_elevenlabs.mp3`, md5 de `voix/RECETTE-VOIX.md` vérifiés) ;
- les autres mp3 `mp3Ready` du manifeste (ceux du web v0.5.4). 27 sont vérifiés recette (v0.1.5 + lot v0.3) ; les autres (passe v0.2.5g) sont notés `a_confirmer` dans `_voix.txt`.
- **36 répliques n'ont pas de mp3** (`_absentes.txt`, ex. `clue_mot_melange`, `cles_intro`, `obj_trappe_joy`, `noir_coupe`…). Le hub les saute et l'écrit au série (`[voix] manquante : …`). Pour les ajouter : générer selon la recette (Voix), déposer `voix/<id>.mp3`, `mp3Ready: true`, refaire l'image.

## À confirmer sur le matériel (réglages dans `entite_hub/config.h` et en tête de `entite_s3b.ino`)

- GPIO 1 (hub) et GPIO 2 (2e S3) sortent bien sur le bandeau DORHEA (avant soudure) ; le banc le prouve.
- SD_MODE des 2 MAX98357A : 440 Hz doit sortir à gauche seulement, 660 Hz à droite seulement.
- TM1637 : CLK/DIO en drain ouvert ; **mesurer** qu'aucune GPIO 7/8 ne voit plus de 3,3 V (module en 5 V = pull-up 5 V).
- Rail servo LM2596 5,0–5,2 V avant tout servo ; angles `SERVO_CLOSED` / `SERVO_OPEN` à régler sur la vraie trappe.
- KY-040 : fronts par cran (4 attendu ; si 2, `ENC_HALF_DETENT = true`) et sens (`ENC_DIR`).
- Joystick : sens (`JOY_SWAP_XY`, `JOY_INV_X`, `JOY_INV_Y`). Clavier : ordre rangées/colonnes (`KEYMAP`).
- Barrettes : sens de chaque barrette en zigzag (`BAR_REVERSED_MASK`), luminosité max `LED_MAX` (pile 3 A).
- Couleurs physiques des câbles B1–B5 = noir, bleu, vert, rouge, jaune (`PORT_WIRE`).
- Tactile CYD : calibration (`CAL`).

## Différences avec le web

Pas de musique de fond, pas de batterie simulée, une seule réplique trompeuse par étape (comme le web), les « leurres » visuels du web ne sont pas reproduits. LED des leviers : pas de broche libre (inchangé).
