// panel-config.js : dimensions réelles de la mallette et des pièces (simulateur ET futur panneau imprimé en 3D).
// Toutes les valeurs sont en millimètres. Fiche officielle Lykus HC-3010 (v0.2.3, 23 nov. 2026). Implantation v0.8 (plan d'impression approuvé le 25 nov. 2026, 07:32 ; jeu en ligne v0.4).
// Rien n'est percé dans les parois étanches : les flancs restent vides, tout est sur les panneaux intérieurs.

export const CASE = {
  model: 'Lykus HC-3010',
  exterior: { width: 335, height: 260, depth: 130 },
  interior: { width: 300, height: 200, depth: 120 },
  baseDepth: 83,                        // profondeur utile de la base (électronique sous le panneau)
  lidDepth: 32,                         // profondeur du couvercle (corrigé : n'est pas 17 mm)
  // Panneau de la base : zone utile 273 x 169, coupé en deux pour le lit 256 mm de la Bambu P1S (v0.3 : joint x = 115)
  panel: { width: 273, height: 169, halves: [{ width: 115, height: 169 }, { width: 158, height: 169 }] },
  servos: { available: 5, used: 2 },    // SG90 : 2 trappes (A, B), 3 en réserve
};

// Pièces que Pascal a déjà (zéro achat de plus). w x h = encombrement vu de face.
// v0.2.1 : TOUT est à l'intérieur de la valise ouverte. Coque (dessus, flancs) : aucun composant, aucun perçage.
// v0.2.2 : 5 câbles banane qui partent de la base et montent se brancher dans les douilles du couvercle ; KY-040 sans boutons + / −.
// v0.2.3 : vraie baie banane 5x5 (n'importe quel câble dans n'importe quelle prise, matrice GPIO), 5 couleurs Keadic
//          distinctes (rouge, noir, jaune, vert, bleu : une de chaque), KY-040 = lettres seulement, CYD 2 = n° de série + bouton tactile RÉÉCOUTER (labyrinthe aux étapes 5 et 9).
//          Toujours 0 pièce à l'extérieur de la valise.
export const PARTS = {
  // Couvercle intérieur (32 mm)
  cyd1:      { w: 86, h: 50, screen: { w: 57.6, h: 43.2 }, note: 'CYD 1 ESP32-2432S028 2,8 po ILI9341 240x320 : œil de l’Entité, au centre du haut du couvercle' },
  speaker:   { w: 70, h: 30, depth: 15, cone: { w: 38, h: 27 }, count: 2, power: '3 W', impedance: '8 Ω', note: 'v0.3 : deux haut-parleurs RECTANGULAIRES 70×30×15 mm, à l’horizontale dans les coins du haut (SPK-L, SPK-R), fil JST 45 cm (DFPlayer SPK1/SPK2)' },
  ledSticks: { count: 5, w: 55, h: 10, leds: 8, total: 40, chain: 'DIN→DOUT 1→2→3→4→5', stick: 'CANADUINO WS2812B 8 LED ~55×10 mm (5050)', power: '5 V 3 A, 300–500 Ω sur DIN, 1000 µF, réinjection 5 V aux deux bouts', colors: ['#B44AFF', '#2B7CFF', '#22C55E', '#E53935', '#F5C518'], note: 'v0.3 : 5 barrettes séparées en zigzag (1, 3, 5 en haut ; 2, 4 en bas). Étape 2 : 10 moitiés de 4 LED (comptes distincts). Étape 3 : Simon, effet K2000 dans la couleur de la prise.' },
  jacks:     { count: 5, hole: 8, height: 15, flange: 12, note: 'petites douilles banane Keadic 4 mm (15 mm à cosse), une sous chaque barrette ; n’importe quel câble dans n’importe quelle prise ; Simon = toucher court. Trou Ø8 = hypothèse, MESURER' },
  cables:    { count: 5, length: 300, from: 'base.cablePorts', to: 'lid.jacks', colors: ['rouge', 'noir', 'jaune', 'vert', 'bleu'], hex: { rouge: '#e53935', noir: '#1b1d22', jaune: '#f5c518', vert: '#22c55e', bleu: '#2b7cff' }, plug: 43, note: 'câbles silicone Keadic, 5 couleurs distinctes, fiche mâle 43 mm (débrancher avant de fermer : ≈ 5 mm de jeu valise fermée), ancrés sur la base' },
  cablePort: { hole: 6, count: 5, note: 'passe-câble (ancrage) en haut de la base, sous les douilles du couvercle' },
  patchbay:  { matrix: '5x5', detect: 'GPIO : chaque fiche de câble = sortie (pilotée à tour de rôle), chaque prise = entrée pull-up ; scan 5x5 toutes les 20 ms. Prise à la masse sans câble piloté = toucher Simon.', pins: { cables: 5, sockets: 5 }, note: 'routage couleur → prise aux étapes 4 et 10 ; toucher Simon à l’étape 3' },
  // Base (83 mm)
  tm1637:    { w: 42, h: 24, digits: 4, color: 'rouge', note: 'v0.3 : chrono MM:SS, 7 segments rouge 0,56 po (CLK, DIO), au-dessus des serrures. Plus d’OLED.' },
  encoder:   { w: 26, h: 19, cap: 15, shaft: 6, count: 5, detents: 20, modes: { cryptex: 'ABCDEFGHIJLMNOPRSTUV' }, note: 'v0.3 : 5 × KY-040 en zigzag, 20 crans/tour + poussoir ; LETTRES SEULEMENT (anneau de 20 lettres, sans K Q W X Y Z), lettres courantes en grand sur le CYD 2 aux étapes 1 et 8 ; chiffres au clavier 4x4' },
  cyd2:      { w: 86, h: 50, screen: { w: 57.6, h: 43.2 }, touch: true, note: 'CYD 2 ESP32-2432S028 2,8 po tactile, en bas au centre : n° de série (LCLC-LCLCL), RÉÉCOUTER (≥ 44 px), 5 lettres courantes aux étapes 1 et 8, SIMON n/N à l’étape 3, labyrinthe aux étapes 5 et 9 ; jauge batterie en haut à droite. Traverse le joint x = 115 : cadre 3D.' },
  joystick:  { w: 26, h: 40, height: 32, capHole: 24, note: 'joystick analogique ELEGOO (kit) PCB 40×26 mm, 26 mm vers l’écran, 40 mm vertical, broches en bas (VCC GND X Y Key) ; trou Ø24 = hypothèse ; puits dans le couvercle' },
  kcd1:      { w: 21, h: 15, note: 'interrupteur à bascule KCD1 (alimentation), en haut à droite (plan v0.8) ; découpe 21×15 = hypothèse, MESURER' },
  fuse:      { inside: true, note: 'porte-fusible À L’INTÉRIEUR de la base, sous le panneau : aucun trou au panneau' },
  keySwitch: { hole: 12, w: 20.6, h: 26, count: 2, note: 'serrures Gebildet 12 mm métal, clés I, II (v0.4 / plan v0.8), points rouge/vert, en bas à gauche sous le TM1637' },
  keypad:    { w: 69, h: 77, note: 'clavier membrane 4x4 : chiffres seulement (pas de lettres, pas de RFID)' },
  trap:      { w: 32.3, h: 27, count: 2, module: { w: 33.9, h: 37.2 }, note: 'trappes motorisées servo SG90 (A, B), au centre de la base, au-dessus de CYD 2 (plan v0.8)' },
  guardedToggle: { w: 22, h: 46, count: 2, hole: 12.2, below: 30, note: 'leviers métalliques lumineux sous capot (ARM bleu, TRANSMIT rouge), v0.4 / plan v0.8 : sous les ports B1–B5, côte à côte (platine 17×46,6, cuvette 8 mm), cache ouvert vertical, plus de balayage à plat ; levier ON en haut. Capot ouvert : la valise ne ferme pas.' },
};

// Implantation v0.8 (plan d'impression Impression 3D · Bambu P1S, approuvé par Pascal le 25 nov. 2026 à 07:32 ;
// noms 20:28 : trappes A B, serrures I II). Source : print3d/entite-mallette/fixations/v0.8-explore/build/clearances-v0.8.json.
// Panneaux 273 × 169 mm, coin haut gauche, x à droite, y vers le bas, base charnière en haut. Base : joint droit x = 115.
export const LAYOUT = {
  lid: {
    width: 273, height: 169, depth: 32, seam: [[110.5, 0], [110.5, 68], [107, 68], [107, 84], [114, 84], [114, 108], [122, 108], [122, 169]],
    spkL:   { x: 5, y: 9, w: 70, h: 30 },
    cyd1:   { x: 93.5, y: 9, w: 86.0, h: 50 },
    spkR:   { x: 198, y: 9, w: 70, h: 30 },
    amps:   [{ x: 53, y: 41, w: 22, h: 20 }, { x: 198, y: 41, w: 22, h: 20 }],   // MAX98357A (cachés)
    sticks: [
      { n: 1, x: 5,   y: 70, w: 55, h: 10 }, { n: 2, x: 57,  y: 88, w: 55, h: 10 }, { n: 3, x: 109, y: 70, w: 55, h: 10 },
      { n: 4, x: 161, y: 88, w: 55, h: 10 }, { n: 5, x: 213, y: 70, w: 55, h: 10 },
    ],
    jacks: [
      { n: 1, x: 26.5, y: 86, w: 12, h: 18 }, { n: 2, x: 78.5, y: 104, w: 12, h: 18 }, { n: 3, x: 130.5, y: 86, w: 12, h: 18 },
      { n: 4, x: 174,  y: 104, w: 12, h: 18 }, { n: 5, x: 234.5, y: 86, w: 12, h: 18 },
    ],
    cableCorridor: { x: 80, y: 134, w: 24, h: 35 },
  },
  base: {
    width: 273, height: 169, seam: 115,
    cablePorts: [8.5, 22.5, 36.5, 50.5, 64.5].map((x) => ({ x, y: 9, w: 10, h: 10 })),     // B1–B5
    cableCorridor: { x: 80, y: 0, w: 24, h: 44 },
    encoders:  [140, 162, 184, 206, 228].map((cx, i) => ({ n: i + 1, cx, cy: 33.5, pcb: { x: cx - 9.5, y: 10.3, w: 19, h: 38.7 } })),   // E1–E5 en ligne
    kcd1:      { x: 243, y: 10, w: 21, h: 15 },
    toggleArm: { x: 8.5, y: 22.4, w: 17.0, h: 46.6 },       // platine 17×46,6, cuvette 8 mm, cache ouvert vertical
    toggleTx:  { x: 40.5, y: 22.4, w: 17.0, h: 46.6 },
    hub:       { x: 8.5, y: 75, w: 60.0, h: 30 },          // caché
    tm1637:    { x: 8.5, y: 111, w: 42.0, h: 24 },
    keySwitches: [{ x: 8.5, y: 138.5, w: 20.6, h: 26.0 }, { x: 31.1, y: 138.5, w: 20.6, h: 26.0 }],   // I, II
    traps:     [{ x: 125, y: 54.8, w: 33.9, h: 37.2 }, { x: 161, y: 54.8, w: 33.9, h: 37.2 }],        // A, B (modules)
    cyd2:      { x: 93.5, y: 110, w: 86.0, h: 50 },
    keypad:    { x: 197, y: 52, w: 69, h: 77 },
    keypadRibbon: { x: 234.5, y: 129, w: 31.5, h: 9 },
    joystick:  { x: 192.5, y: 131, w: 40.0, h: 26 },     // KY-023, cuvette 12 mm, sous le clavier
    dcJack:    { x: 258, y: 141, w: 15, h: 16 },         // paroi droite
  },
  shell: { top: [], sides: [] },                    // coque : rien
};
