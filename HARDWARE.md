# Matériel — v0.4 (plan d’impression v0.8 : 5 molettes, 2 trappes, 2 serrures, TM1637)

Valise Lykus HC-3010 : panneau couvercle et panneau base de 273 × 169 mm chacun (couvercle 32 mm de profondeur,
base 83 mm). Cotes complètes : `js/panel-config.js` (`LAYOUT`), tirées du plan d’impression **v0.8** (Impression 3D · Bambu P1S,
approuvé par Pascal le 25 nov. 2026 à 07:32 ; noms 20:28 : trappes A B, serrures I II) :
`print3d/entite-mallette/fixations/v0.8-explore/build/clearances-v0.8.json`. Rectangles en mm `[x1, y1, x2, y2]`, x à droite, y vers le bas.
Les cotes marquées « hypothèse » sont à **mesurer sur la vraie pièce avant de percer**.

## Couvercle

| Pièce | Position (mm) | Notes |
|---|---|---|
| CYD 1 (l’œil) | verre [93,5, 9, 179,5, 59] | centré en haut ; cadre pont [82,5 – 190,5] sur le joint en escalier |
| Haut-parleurs SPK-L / SPK-R | [5, 9, 75, 39] et [198, 9, 268, 39], 70 × 30 × 15 ; 2 × MAX98357A dessous (cachés) | **à l’horizontale dans les coins du haut**, marge 5 mm, 12,5 mm du cadre de l’œil |
| 5 barrettes WS2812B (8 LED, 55 × 10) | x 5 / 57 / 109 / 161 / 213 ; y 70 (1, 3, 5) et 88 (2, 4) | en **zigzag** : 5 × 55 = 275 mm ne tiennent pas à plat dans 273 mm |
| 5 petites douilles 4 mm (Keadic, 15 mm) | collerettes Ø12 à x 26,5 / 78,5 / 130,5 / 174 / 234,5 ; y 86 (1, 3, 5) et 104 (2, 4) | une sous chaque barrette ; trou Ø8 mm (hypothèse) |

Câbles banane, de la prise 1 à 5 : **noir** (la barrette 1 pulse en **violet**, le noir ne se verrait pas), bleu, vert, rouge, jaune.
Fiches de 43 mm : il ne reste que ~5 mm entre les panneaux valise fermée, **débrancher avant de fermer**.

## Base (plan v0.8)

| Pièce | Rectangle (mm) | Notes |
|---|---|---|
| 5 ports câbles B1–B5 | 10 × 10 à x 8,5 / 22,5 / 36,5 / 50,5 / 64,5, y 9–19 | en haut à gauche |
| Couloir câble charnière | [80, 0, 104, 44] | faisceau fixe en gaine tressée, pince y = 30 |
| 5 molettes KY-040 E1–E5 | axes x 140 / 162 / 184 / 206 / 228, y 33,5 (PCB [130,5 – 237,5 × 10,3 – 49]) | **en ligne** ; bague de 20 crans A–V sans K ni Q |
| Interrupteur KCD1 | [243, 10, 264, 25] | en haut à droite |
| Levier ARM (bleu) | platine [8,5, 22,4, 25,5, 69] | sous les ports, **côte à côte** avec TRANSMIT ; cuvette 8 mm ; cache ouvert vertical, plus de balayage à plat |
| Levier TRANSMIT (rouge) | platine [40,5, 22,4, 57,5, 69] | idem |
| Hub électronique (caché) | [8,5, 75, 68,5, 105] | sous le panneau |
| **TM1637 rouge 4 chiffres** | [8,5, 111, 50,5, 135] | le chrono `MM:SS`, **au-dessus des 2 serrures** ; clignote les 30 dernières secondes |
| 2 serrures I II | [8,5, 138,5, 29,1, 164,5] et [31,1, 138,5, 51,7, 164,5] | en bas à gauche |
| 2 trappes A B (modules SG90) | [125, 54,8, 158,9, 92] et [161, 54,8, 194,9, 92] | au centre, au-dessus de CYD 2 |
| CYD 2 | verre [93,5, 110, 179,5, 160] | n° de série, RÉÉCOUTER, lettres des molettes (étapes 1 et 8), points du code (6 et 11), `SIMON r/4` (3), labyrinthe (5 et 9) |
| Clavier 4 × 4 | [197, 52, 266, 129] | chiffres seulement pendant le jeu ; berceau pile dessous ; nappe [234,5, 129, 266, 138] |
| Joystick KY-023 | [192,5, 131, 232,5, 157] | sous le clavier, à droite de CYD 2, cuvette 12 mm |
| Prise DC 5,5 × 2,1 | paroi droite [258, 141, 273, 157] | recharge (chargeur 12,6 V) |
| Porte-fusible | **à l’intérieur de la base** | aucun trou au panneau |

## Jeux v0.5 : limites matériel (Électronique 25 nov. ~22 h 30 ; Impression 3D 22 h 33)

Sources : `/workspace/mallette-entite/v0.5-jeux-reponses-materiel.md` et le plan v0.8 §13 (`preview_poche-cle-trappes-v0.8.png`).
Le simulateur reste dans ces limites. **Aucun numéro de GPIO n’est figé** : le code du jeu n’en code aucun.

- **Serrures I et II** (Gebildet E1020, 2 positions) : 1 contact sec par serrure, `INPUT_PULLUP`, repos = HIGH,
  **clé tournée = LOW**. Lues sur le 2e ESP32-S3 N16R8 (ou 2 bits d’un MCP23017 0x20/0x21).
- **Bouton SW du joystick KY-023** : actif bas, `INPUT_PULLUP`, lu sur le maître. Utilisé en v0.5 : étape 2 (gauche = A,
  droite = B, appui = ouvrir) et étape 9 (appui = éclair du labyrinthe).
- **Tremblement d’une trappe SG90 sur une erreur** : ±5 à 8°, **3 cycles au plus**, 80 à 120 ms par pas, **une seule porte
  à la fois**, puis détacher ou tenir. Jamais pendant un son fort ni un flash de LED vif.
- **Clé dans les trappes A et B** : la clé tient debout sur la tranche dans une fente verticale, **à gauche**, sous le
  plancher du compartiment ; on ouvre la porte et on la prend par le haut. Mini-clé 35 × 15 × 2 : tout dans le module ;
  clé typique 50 × 22 × 2,5 : avec un puits de 3 à 5 mm dans le capot. Pas de poche extérieure. Aucune pièce déplacée.
- **Barrettes vivantes (v0.5.1)** : Simon = une note par barrette (do ré mi sol la, générées par l’ESP32 en I2S vers les
  MAX98357A) ; étapes 4/10 : la barrette au-dessus d’une douille prend la couleur du câble détecté (câble noir → violet) ;
  étape 10 : la barrette 1 sert de chrono (8 LED) ; étape 8 (moyen) : la barrette n s’allume à chaque lettre épelée.
  Aucun matériel en plus : la détection câble/douille et les 40 LED sont déjà au plan.
- **Trappes et serrures (v0.5.2)** : étape 2, le maître lit le joystick (X : gauche = A, droite = B) et SW (appui = ouvrir).
  Mauvaise trappe : tremblement du SG90 de cette porte, ±6°, 3 cycles, 100 ms par pas, puis tenir porte fermée ;
  pendant ce temps le maître coupe la voix (DFPlayer en pause) et limite les 40 LED à 30 % ; le son d'erreur et le flash
  rouge viennent après. Clé I rangée derrière la trappe A, clé II derrière la B. Étape 7 : signal = 40 LED vertes + bip ;
  les deux contacts doivent passer à LOW à moins de 1 s (moyen) ou dans l'ordre (difficile). Une serrure LOW **avant** le
  signal = « trop tôt » ; le firmware attend que les deux contacts soient revenus à HIGH (clés remises droites) avant le
  signal suivant.
- **Labyrinthe dans le noir, mur mobile, clavier bloqué (v0.5.3)** : étape 9, le maître n'envoie au CYD 2 que les cases autour
  du point (moyen : 3×3 ; difficile : croix de 5 cases) ; un appui sur SW (KY-023, actif bas) envoie tout le labyrinthe
  pendant 1 s (−5 s ; 2 éclairs en moyen, 1 en difficile). Étape 5 (difficile) : 8 s après la fin de la consigne, le maître
  échange un mur contre un autre (le labyrinthe reste un arbre, donc résoluble). Codes 1 et 2 : après une erreur, le maître
  ne lit plus la matrice 4×4 pendant 3 s et joue un bip bas. Aucun matériel en plus, aucune broche nouvelle.
- **N° de série (v0.5.0)** : 4 chiffres seulement (`47-19`) sur le CYD 2, plus un lot leurre. Les molettes ne servent
  qu’à des mots de 5 lettres.

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
