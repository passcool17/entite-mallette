# Matériel — v0.3 (« version 3 », 5 molettes + TM1637)

Valise Lykus HC-3010 : panneau couvercle et panneau base de 273 × 169 mm chacun (couvercle 32 mm de profondeur,
base 83 mm). Cotes complètes : `js/panel-config.js` (`LAYOUT`) et le plan `apps-plans/entite-mallette/plan-v03.*`.
Les cotes marquées « hypothèse » sont à **mesurer sur la vraie pièce avant de percer**.

## Couvercle

| Pièce | Position (mm) | Notes |
|---|---|---|
| CYD 1 (l’œil) | x 93,5, y 5, 86 × 50 | centré en haut ; le cadre enjambe le joint en escalier 107 / 110,5 / 114 |
| Haut-parleurs SPK-L / SPK-R | x 5 et x 198, y 5, 70 × 30 × 15 | **à l’horizontale dans les coins du haut**, marge 5 mm, 12,5 mm du cadre de l’œil |
| 5 barrettes WS2812B (8 LED, 55 × 10) | x 5 / 57 / 109 / 161 / 213 ; y 70 (1, 3, 5) et 106 (2, 4) | en **zigzag** : 5 × 55 = 275 mm ne tiennent pas à plat dans 273 mm |
| 5 petites douilles 4 mm (Keadic, 15 mm) | centres (32,5, 92) (84,5, 128) (136,5, 92) (180, 128) (240,5, 92) | une sous chaque barrette ; trou Ø8 mm (hypothèse) |

Câbles banane, de la prise 1 à 5 : **noir** (la barrette 1 pulse en **violet**, le noir ne se verrait pas), bleu, vert, rouge, jaune.
Fiches de 43 mm : il ne reste que ~5 mm entre les panneaux valise fermée, **débrancher avant de fermer**.

## Base (de haut en bas)

| Pièce | Position (mm) | Notes |
|---|---|---|
| 5 ports câbles | x 27,5 / 79,5 / 131,5 / 175 / 235,5, y 5 | |
| Trappes A B C | x 39 / 77,3 / 117,6, y 18, 32,3 × 27 | en haut |
| 5 molettes KY-040 | centres x 14 / 44 / 74 / 104 / 134 ; y 63,5 (1, 3, 5) et 91,5 (2, 4) | zigzag ; bague de 20 crans A–V sans K ni Q |
| Clavier 4 × 4 | x 154, y 28, 69 × 77 | chiffres seulement pendant le jeu |
| Levier ARM (bleu) | x 234,5, y 28, 22 × 46 | **à droite du clavier**, capot charnière en haut, s’ouvre vers le haut, ON = levier en haut |
| Levier TRANSMIT (rouge) | x 234,5, y 80, 22 × 46 | sous ARM, même capot |
| **TM1637 rouge 4 chiffres** | x 20,9, y 110, 42 × 24 (0,56 po, hypothèse) | le chrono `MM:SS`, **au-dessus des 3 serrures** ; clignote les 30 dernières secondes |
| 3 serrures I II III | x 5 / 31,6 / 58,2, y 138, 20,6 × 26 | |
| CYD 2 | x 93,5, y 114, 86 × 50 | n° de série, RÉÉCOUTER, lettres des molettes (étapes 1 et 8), points du code (6 et 11), `SIMON r/4` (3), labyrinthe (5 et 9) |
| Joystick ELEGOO | x 197,25, y 124, 26 × 40 | capuchon Ø24 (hypothèse) ; prévoir un puits dans le couvercle |
| Interrupteur KCD1 | x 235,25, y 136,5, 21 × 15 (hypothèse) | **12 mm** à droite du joystick |
| Porte-fusible | **à l’intérieur de la base** | aucun trou au panneau |

Joint de la base droit à x = 115 (morceaux de 115 et 158 mm). Il n’y a **plus d’OLED** et plus de barre unique de 32 LED.

## Barrettes : chaîne et alimentation (40 WS2812B)

```
5 V / GND ──► les cinq barrettes (réinjecter aux deux bouts de la chaîne)
DIN (330–500 Ω) ──► barrette 1 ── DOUT→DIN ──► 2 ──► 3 ──► 4 ──► 5
```

- Index FastLED `barrette × 8 + led` (0-based), une seule broche de données.
- Pire cas au blanc plein : 40 × 60 mA ≈ **2,4 A** → alimentation **5 V 3 A**, condensateur 1000 µF au début de la chaîne,
  luminosité plafonnée dans le programme. Le Simon n’allume que ~4 LED d’une barrette à la fois.
- Étape 2 (trappe) : chaque barrette montre **deux moitiés de 4 LED** = 10 segments colorés (comptes 5/3/2, 6/3/1 ou 5/4/1).

## Simon (étape 3) : effet K2000 et détection

Constantes communes à l’app (`SIMON` dans `js/game.js`) et au micrologiciel :

```
LEDS 8 · STICKS 5 · STEP_MS 36 · TAIL 3 · LEVELS [255,140,56,16] · SWEEPS 2 · GAP_MS 200
INPUT_STEP_MS 24 (bonne prise : un passage) · ERROR 2 × (140 on / 100 off), niveau 160, rouge
difficile : ×0,88 par tour réussi, planchers STEP 20 / GAP 120
moyen : séries 2→5, 1re pression 8 s, entre deux 2,5 s · difficile : 3→6, 6 s / 2 s
```

Couleurs : violet `#B44AFF`, bleu `#2B7CFF`, vert `#22C55E`, rouge `#E53935`, jaune `#F5C518`.

Détection : les 5 entrées des douilles (pull-up) et les 5 lignes des câbles, déjà prévues pour la baie. Une douille à la masse
sans câble piloté = un **toucher** Simon ; une douille haute seulement quand le câble X est piloté = câble X **branché**
(étapes 4 et 10). Scan ~20 ms, anti-rebond 40–60 ms, relâcher avant la pression suivante.

## Autres pièces

- Leviers lumineux métalliques : trou Ø12,2 mm, 19 + 10,3 mm sous le panneau (≥ 30 mm, la base a 83 mm). Capot ouvert, la valise ne ferme pas.
- KY-040 : CLK, DT, SW chacune (15 broches). TM1637 : CLK, DIO.
- CYD 2 : ESP32 à part, reçoit l’état (UART 115200 ou ESP-NOW) : mode, n° de série, lettres courantes, batterie. Il ne montre jamais une réponse ni le chrono.
