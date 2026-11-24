// panel-config.js : dimensions réelles de la mallette et des pièces (simulateur ET futur panneau imprimé en 3D).
// Toutes les valeurs sont en millimètres. Fiche officielle Lykus HC-3010 (v0.2.0, 23 nov. 2026).

export const CASE = {
  model: 'Lykus HC-3010',
  exterior: { width: 335, height: 260, depth: 130 },
  interior: { width: 300, height: 200, depth: 120 },
  baseDepth: 83,                        // profondeur utile de la base (électronique sous le panneau)
  lidDepth: 32,                         // profondeur du couvercle (corrigé : n'est pas 17 mm)
  // Panneau de la base : zone utile 273 x 169, coupé en deux moitiés pour le lit 256 mm de la Bambu P1S
  panel: { width: 273, height: 169, halves: [{ width: 136.5, height: 169 }, { width: 136.5, height: 169 }] },
  servos: { available: 5, used: 3 },    // SG90 : 3 trappes, 2 en réserve
};

// Pièces que Pascal a déjà (zéro achat de plus). w x h = encombrement vu de face.
export const PARTS = {
  // Dessus (extérieur)
  latch:     { hole: 12, w: 20.6, h: 26, count: 2, note: 'Gebildet 12 mm métal (loquets d’armement), points rouge/vert' },
  keySwitch: { hole: 12, w: 20.6, h: 26, count: 3, note: 'Gebildet 12 mm métal, clés I, II, III, points rouge/vert' },
  // Flancs
  toggle:    { w: 22, h: 46, note: 'interrupteur à levier sous cache de sécurité basculant (armement)' },
  jacks:     { count: 5, hole: 8, pitch: 18, note: 'fiches et douilles banane Keadic, 5 couleurs (rouge, noir, bleu, jaune, vert)' },
  serial:    { w: 70, h: 22, note: 'plaque de n° de série rivetée' },
  // Couvercle (32 mm)
  cyd1:      { w: 86, h: 50, screen: { w: 57.6, h: 43.2 }, note: 'CYD 1 ESP32-2432S028 2,8 po ILI9341 240x320 : œil de l’Entité' },
  ledBar:    { w: 53, h: 10, leds: 8, note: 'barrette WS2812B 8 DEL' },
  pocket:    { w: 90, h: 60, depth: 6, note: 'pochette à fiche (note tactique)' },
  // Base (83 mm)
  encoder:   { w: 26, h: 19, shaft: 6, count: 4, note: 'KY-040 encodeur rotatif + poussoir' },
  oled:      { w: 27, h: 27, screen: { w: 22, h: 11 }, note: 'OLED 0,96 po I2C 128x64' },
  joystick:  { w: 35, h: 35, note: 'joystick compact 2 axes + poussoir' },
  cyd2:      { w: 86, h: 50, screen: { w: 57.6, h: 43.2 }, note: 'CYD 2 ESP32-2432S028 2,8 po : écran interactif (verrou de signal, labyrinthe)' },
  keypad:    { w: 69, h: 77, note: 'clavier membrane 4x4' },
  tm1637:    { w: 42, h: 24, note: 'afficheur 4 chiffres 0,56 po' },
  trap:      { w: 32.3, h: 27, count: 3, note: 'trappe motorisée servo SG90' },
  transmit:  { d: 44, note: 'gros bouton rouge lumineux TRANSMIT' },
  speaker:   { d: 40, power: '3 W', impedance: '8 Ω', note: 'haut-parleur 3 W 8 Ω sous grille (DFPlayer SPK1/SPK2)' },
};

// Implantation du panneau de la base (paysage 273 x 169). Le joint des deux moitiés est à x = 136,5 ;
// rien de fragile ne le chevauche. Pas de lecteur RFID (retiré le 23 nov. 2026 : peu d'intérêt, câblage compliqué).
export const LAYOUT = {
  base: {
    width: 273, height: 169, seam: 136.5,
    tm1637:   { x: 6,   y: 6,   w: 42, h: 24 },
    oled:     { x: 54,  y: 4,   w: 27, h: 27 },
    encoders: { x: 6,   y: 38,  w: 124, h: 26 },   // 4 x KY-040, pas de 31 mm
    traps:    { x: 6,   y: 72,  w: 103, h: 27 },   // T1, T2, T3
    transmit: { x: 74,  y: 108, w: 50, h: 50 },
    speaker:  { x: 8,   y: 108, w: 52, h: 52 },
    cyd2:     { x: 143, y: 6,   w: 86, h: 50 },
    joystick: { x: 234, y: 13,  w: 35, h: 35 },
    keypad:   { x: 150, y: 66,  w: 69, h: 77 },
      label:    { x: 143, y: 150, w: 126, h: 14 },
  },
  lid: {
    width: 273, height: 169, depth: 32,
    cyd1:   { x: 20,  y: 30, w: 86, h: 50 },
    ledBar: { x: 20,  y: 92, w: 53, h: 10 },
    pocket: { x: 160, y: 30, w: 90, h: 60 },
  },
};
