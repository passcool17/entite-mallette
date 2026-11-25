// panel-config.js : dimensions réelles de la mallette et des pièces (simulateur ET futur panneau imprimé en 3D).
// Toutes les valeurs sont en millimètres. Fiche officielle Lykus HC-3010 (v0.2.3, 23 nov. 2026). Implantation v0.3 (24 nov. 2026).
// Rien n'est percé dans les parois étanches : les flancs restent vides, tout est sur les panneaux intérieurs.

export const CASE = {
  model: 'Lykus HC-3010',
  exterior: { width: 335, height: 260, depth: 130 },
  interior: { width: 300, height: 200, depth: 120 },
  baseDepth: 83,                        // profondeur utile de la base (électronique sous le panneau)
  lidDepth: 32,                         // profondeur du couvercle (corrigé : n'est pas 17 mm)
  // Panneau de la base : zone utile 273 x 169, coupé en deux pour le lit 256 mm de la Bambu P1S (v0.3 : joint x = 115)
  panel: { width: 273, height: 169, halves: [{ width: 115, height: 169 }, { width: 158, height: 169 }] },
  servos: { available: 5, used: 3 },    // SG90 : 3 trappes, 2 en réserve
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
  kcd1:      { w: 21, h: 15, note: 'interrupteur à bascule KCD1 (alimentation), 12 mm à droite du joystick ; découpe 21×15 = hypothèse, MESURER' },
  fuse:      { inside: true, note: 'porte-fusible À L’INTÉRIEUR de la base, sous le panneau : aucun trou au panneau' },
  keySwitch: { hole: 12, w: 20.6, h: 26, count: 3, note: 'serrures Gebildet 12 mm métal, clés I, II, III, points rouge/vert' },
  keypad:    { w: 69, h: 77, note: 'clavier membrane 4x4 : chiffres seulement (pas de lettres, pas de RFID)' },
  trap:      { w: 32.3, h: 27, count: 3, note: 'trappes motorisées servo SG90 (A, B, C), en haut de la base' },
  guardedToggle: { w: 22, h: 46, count: 2, hole: 12.2, below: 30, note: 'leviers métalliques lumineux sous capot (ARM bleu, TRANSMIT rouge), à droite du clavier, empilés ; capot charnière en HAUT, s’ouvre vers le haut ; levier ON en haut. Capot ouvert : la valise ne ferme pas.' },
};

// Implantation v0.3 (plan retenu par Pascal le 24 nov. 2026, 19 h 41 : plan-v03.*). Panneaux 273 × 169 mm, coin haut gauche.
// Base : joint droit x = 115 (pièces 115 et 158 mm, lit P1S 256). Couvercle : joint en escalier x = 107 / 110,5 / 114.
export const LAYOUT = {
  lid: {
    width: 273, height: 169, depth: 32, seam: [107, 110.5, 114],
    spkL:   { x: 5,    y: 5,   w: 70, h: 30 },
    cyd1:   { x: 93.5, y: 5,   w: 86, h: 50 },
    spkR:   { x: 198,  y: 5,   w: 70, h: 30 },
    sticks: [
      { n: 1, x: 5,   y: 70,  w: 55, h: 10 }, { n: 2, x: 57,  y: 106, w: 55, h: 10 }, { n: 3, x: 109, y: 70, w: 55, h: 10 },
      { n: 4, x: 161, y: 106, w: 55, h: 10 }, { n: 5, x: 213, y: 70,  w: 55, h: 10 },
    ],
    jacks: [
      { n: 1, x: 26.5, y: 86, w: 12, h: 12 }, { n: 2, x: 78.5, y: 122, w: 12, h: 12 }, { n: 3, x: 130.5, y: 86, w: 12, h: 12 },
      { n: 4, x: 174,  y: 122, w: 12, h: 12 }, { n: 5, x: 234.5, y: 86, w: 12, h: 12 },
    ],
  },
  base: {
    width: 273, height: 169, seam: 115,
    cablePorts: [{ x: 27.5, y: 5 }, { x: 79.5, y: 5 }, { x: 131.5, y: 5 }, { x: 175, y: 5 }, { x: 235.5, y: 5 }].map((p) => ({ ...p, w: 10, h: 10 })),
    traps:     [{ x: 39, y: 18 }, { x: 77.3, y: 18 }, { x: 117.6, y: 18 }].map((p) => ({ ...p, w: 32.3, h: 27 })),
    encoders:  [14, 44, 74, 104, 134].map((cx, i) => ({ cx, cy: i % 2 ? 91.5 : 63.5, w: 15, h: 16.5 })),
    keypad:    { x: 154,   y: 28,  w: 69, h: 77 },
    toggleArm: { x: 234.5, y: 28,  w: 22, h: 46 },
    toggleTx:  { x: 234.5, y: 80,  w: 22, h: 46 },
    tm1637:    { x: 20.9,  y: 110, w: 42, h: 24 },
    keySwitches: [5, 31.6, 58.2].map((x) => ({ x, y: 138, w: 20.6, h: 26 })),
    cyd2:      { x: 93.5,  y: 114, w: 86, h: 50 },
    joystick:  { x: 197.25, y: 124, w: 26, h: 40 },
    kcd1:      { x: 235.25, y: 136.5, w: 21, h: 15 },
  },
  shell: { top: [], sides: [] },                    // coque : rien
};
