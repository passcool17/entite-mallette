// game.js : tirage d'une partie v0.5 (logique pure, sans DOM). Même graine = même partie.
// v0.5.0 (Pascal 22:24) : étape 1 = « Mot mêlé » (le CYD 2 montre 5 lettres mélangées, jamais le mot ; on forme le mot
// sur E1–E5). Les molettes ne servent qu'à des MOTS de 5 lettres. Le n° de série est en CHIFFRES seulement (4 chiffres).
// v0.5.2 : serrures « deux clés, deux mains » (signal vert, fausses alertes en difficile), trappes : choix au joystick,
// tremblement SG90 sur une erreur (limites Électronique), clé I derrière la trappe A, clé II derrière la trappe B.
// v0.4 (plan d'impression v0.8) : 2 trappes (A, B) et 2 serrures (I, II). Les barrettes gardent 3 couleurs ; les 2 trappes
// montrent la couleur réponse et un leurre, donc les 4 variantes de trappe restent justes.
// v0.3 : 5 molettes (mots de 5 lettres), n° de série à 5 lettres, étape 3 = Simon sur 5 barrettes, trappe sur 10 demi-barrettes.
// Paliers cachés ~50/50 : 'moyen' et 'difficile' (choix de Pascal : moyen à difficile, au hasard). Pas de mode facile.
// Tout se déduit de la mallette elle-même (plaque du n° de série, écrans, barre DEL) : aucun manuel externe.

export function mulberry32(a) {
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const TIME_S = 480;          // 8 min, comme la v0.1.5
export const NSTEPS = 12;
export const WIRE_COLORS = ['rouge', 'noir', 'jaune', 'vert', 'bleu']; // kit Keadic : 5 couleurs, une de chaque (jamais deux pareilles)
export const TRAP_COLORS = ['rouge', 'vert', 'bleu'];
// Anneau cryptex des KY-040 : 20 crans = 1 tour = 20 lettres (sans K, Q, W, X, Y, Z)
export const RING = 'ABCDEFGHIJLMNOPRSTUV';
export const DETENTS = 20;
export const NENC = 5;               // 5 molettes KY-040 (v0.4 / plan v0.8 : en ligne E1–E5)
// Mots de 5 lettres français, toutes leurs lettres sur l'anneau (jamais K, Q, W, X, Y, Z)
// v0.5.0 : mots de l'étape 1 (mot mêlé), rangés par thème (dit à voix haute en moyen). Sans anagramme courante
// (pas CORDE/DÉCOR, LAMPE/PALME, PHARE/HARPE, AGENT/GÉANT, PORTE/OPTER, SABLE/BLASÉ), pour qu'il n'y ait qu'une réponse.
export const THEMES = {
  objet:   ['CABLE', 'VERRE', 'FUSIL', 'PIANO', 'TABLE', 'PLUME'],
  nature:  ['TIGRE', 'ORAGE', 'NUAGE', 'OMBRE', 'GLACE', 'VAGUE', 'FLEUR', 'ARBRE'],
  machine: ['RADIO', 'BOMBE', 'SONDE', 'ROBOT', 'TRAIN'],
};
export const THEME_NAMES = Object.keys(THEMES);
export const WORDS = ['SIGNE', 'PORTE', 'CABLE', 'ROUGE', 'LAMPE', 'CODES', 'VERRE', 'TIGRE', 'SABLE', 'ORAGE', 'PLUME', 'RADIO', 'BOMBE', 'SONDE', 'PANNE', 'FUSIL', 'NUAGE', 'OMBRE', 'GLACE', 'TEMPS', 'VAGUE', 'PIANO', 'FLEUR', 'ROBOT', 'ACIER', 'AGENT', 'TABLE', 'LIGNE', 'FORGE', 'PISTE', 'ARBRE', 'CORDE', 'TRAIN', 'PHARE'];
// Simon (étape 3) : 5 barrettes de 8 LED, une couleur par barrette (barrette 1 = câble noir, pulse violet)
export const STICK_COLORS = ['#B44AFF', '#2B7CFF', '#22C55E', '#E53935', '#F5C518'];
export const STICK_NAMES = ['violet', 'bleu', 'vert', 'rouge', 'jaune'];
// constantes K2000 partagées avec le micrologiciel (DESIGN-v0.3, annexe C)
export const SIMON = {
  LEDS: 8, STICKS: 5, STEP_MS: 36, TAIL: 3, LEVELS: [255, 140, 56, 16], SWEEPS: 2, GAP_MS: 200,
  INPUT_STEP_MS: 24, ERROR_ON_MS: 140, ERROR_OFF_MS: 100, ERROR_FLASHES: 2, ERROR_LEVEL: 160,
  SPEEDUP: 0.88, STEP_MIN: 20, GAP_MIN: 120, PENALTY_S: 8,
  moyen:     { start: 2, target: 5, first: 8000, between: 2500, speedup: false, lastReversed: false },
  difficile: { start: 3, target: 6, first: 6000, between: 2000, speedup: true, lastReversed: true },
};
// v0.5.1 : une note par barrette (gamme pentatonique do ré mi sol la, barrette 1 → 5), jouée dans SPK-L / SPK-R
export const SIMON_NOTES = [262, 294, 330, 392, 440];
// v0.5.1 : étape 10 contre la montre : la barrette 1 se vide LED par LED ; à zéro −8 s, une erreur, et elle se recharge
export const PATCH_CLOCK = { moyen: 30000, difficile: 20000, PENALTY_S: 8 };
// v0.5.1 : étape 8 (cryptex) : en moyen, la barrette n s'allume à chaque lettre épelée ; en difficile, Réécouter coûte 5 s
export const CRYPTEX_REPLAY_COST_S = 5;
// v0.5.2 : tremblement d'une trappe SG90 sur une erreur (Électronique : ±5–8°, ≤ 3 cycles, 80–120 ms par pas, une porte
// à la fois, puis arrêt ; jamais pendant un son fort ni des DEL vives). ledMax = luminosité max des barrettes pendant le tremblement.
export const SERVO_SHAKE = { deg: 6, cycles: 3, stepMs: 100, ledMax: 0.3 };
// v0.5.2 : étape 2 en difficile, les barrettes s'éteignent 5 s après la consigne ; Réécouter les rallume, −5 s
export const TRAP_BARS = { darkMs: 5000, REPLAY_COST_S: 5 };
// v0.5.2 : étape 7 « deux clés, deux mains ». keyTrap[k] = trappe où dort la clé k (I → A, II → B, Impression 3D :
// clé debout sur la tranche, à gauche, sous la porte). windowMs = écart max entre les deux clés (moyen).
export const KEYS7 = { windowMs: 1000, falseAlerts: { moyen: 0, difficile: 2 }, keyTrap: [0, 1], PENALTY_S: 5 };
// timing d'un tour (round = index 0..) : en difficile, ×0,88 par tour réussi, avec planchers
export function simonTiming(tier, round) {
  const P = SIMON[tier] || SIMON.moyen, f = P.speedup ? Math.pow(SIMON.SPEEDUP, round) : 1;
  return { step: Math.max(SIMON.STEP_MIN, Math.round(SIMON.STEP_MS * f)), gap: Math.max(SIMON.GAP_MIN, Math.round(SIMON.GAP_MS * f)) };
}
// durée d'un « temps » (aller-retour K2000) puis pause noire
export const beatMs = (tm) => SIMON.SWEEPS * SIMON.LEDS * tm.step;
// image K2000 d'une barrette au temps t (ms depuis le début du temps) : 8 niveaux 0..255. Seule la barrette active est non nulle.
export function scannerFrame(t, tm, sweeps = SIMON.SWEEPS) {
  const out = new Array(SIMON.LEDS).fill(0);
  const k = Math.floor(t / tm.step); if (k < 0 || k >= sweeps * SIMON.LEDS) return out;
  const sweep = Math.floor(k / SIMON.LEDS), i = k % SIMON.LEDS, fwd = sweep % 2 === 0, head = fwd ? i : SIMON.LEDS - 1 - i;
  for (let d = 0; d <= SIMON.TAIL; d++) { const p = fwd ? head - d : head + d; if (p >= 0 && p < SIMON.LEDS) out[p] = SIMON.LEVELS[d]; }
  return out;
}

// Étapes : face où elle se joue + titre court (bandeau d'état).
export const STEPS = [
  null,
  { face: 'base',   part: 'enc',    title: 'Signal 1 · encodeurs' },
  { face: 'base',   part: 'traps',  title: 'Trappe' },
  { face: 'lid',    part: 'simon',  title: 'Simon · barrettes et prises' },
  { face: 'base',   part: 'wires',  title: 'Baie banane · brancher' },
  { face: 'base',   part: 'cyd2',   title: 'Verrou de signal' },
  { face: 'base',   part: 'keypad', title: 'Code 1' },
  { face: 'base',   part: 'keys',   title: 'Clés I · II' },
  { face: 'base',   part: 'enc',    title: 'Signal 2 · mot (cryptex)' },
  { face: 'base',   part: 'cyd2',   title: 'Verrou saboté' },
  { face: 'base',   part: 'wires',  title: 'Baie banane · 2e couche' },
  { face: 'base',   part: 'keypad', title: 'Code 2' },
  { face: 'base',   part: 'toggleTx', title: 'Levier rouge' },
];

// v0.2.4 : chaque étape tire une VARIANTE de règle dans le bassin de son palier. Deux parties de suite diffèrent
// (app.js compare la signature run.sig à celle de la partie précédente, gardée dans localStorage).
// Bassins de variantes par étape et par palier (moyen / difficile). Toutes se résolvent avec ce qui est sur la mallette
// (plaque, barre DEL, anneau des encodeurs) et ce que l'Entité dicte. Rien n'est jamais écrit à l'écran.
export const POOLS = {
  enc1:   { moyen: ['theme'],                    difficile: ['nu'] },   // v0.5.0 mot mêlé : thème dit + score (moyen) ; rien (difficile)
  trap:   { moyen: ['frequente', 'gauche'],      difficile: ['rare', 'moyenne'] },
  patch1: { moyen: ['route', 'echange', 'debranche'], difficile: ['route', 'echange', 'serie'] },
  code1:  { moyen: ['ordre', 'envers'],          difficile: ['envers', 'plus1'] },
  keys:   { moyen: ['ensemble'],                 difficile: ['lourde', 'legere'] },   // v0.5.2 : moyen = deux clés ensemble au vert ; difficile = ordre par poids après le vert
  word:   { moyen: ['ordre', 'envers'],          difficile: ['envers', 'suivante'] },
  patch2: { moyen: ['double', 'echange'],        difficile: ['double', 'serie'] },
  code2:  { moyen: ['envers', 'rotation'],       difficile: ['envers', 'decale'] },
};
export const SLOTS = Object.keys(POOLS);
export const TIERS = ['moyen', 'difficile'];
// nombre d'étapes à règle différente entre deux signatures
export function sigDiff(a, b) {
  if (!a || !b) return SLOTS.length + 1;
  const A = a.split('|'), B = b.split('|');
  let n = A[0] !== B[0] ? 1 : 0;
  for (let i = 1; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) n++;
  return n;
}
const nextOnRing = (ch) => RING[(RING.indexOf(ch) + 1) % DETENTS];

export function makeRun(seed) {
  const r = mulberry32(seed >>> 0);
  const int = (n) => Math.floor(r() * n);
  const pick = (a) => a[int(a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const tier = r() < 0.5 ? 'moyen' : 'difficile';      // ~50/50, caché (?debug=1 l'affiche)
  const hard = tier === 'difficile';
  const v = {}; for (const k of SLOTS) v[k] = pick(POOLS[k][tier]);

  // ---- n° de série v0.5.0 : 4 chiffres tous différents, affichés « 47-19 » sur le CYD 2 (+ un lot leurre).
  // Il sert aux serrures, au code 2 (décalé) et à la baie banane (rang d'un chiffre). Plus aucune lettre.
  const digits = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
  const serial = `${digits[0]}${digits[1]}-${digits[2]}${digits[3]}`;
  const lot = 100 + int(900); // leurre sur la plaque
  const cues = {};

  // ---- 1. « Mot mêlé » : un mot à thème, ses 5 lettres mélangées sur le CYD 2 (l'énigme, jamais le mot).
  // Mélange : le moins de lettres à leur place possible, et jamais le mot lui-même.
  const theme = pick(THEME_NAMES);
  const word1 = pick(THEMES[theme]);
  let scramble = word1, best = 99;
  for (let k = 0; k < 40; k++) {
    const s = shuffle(word1.split('')).join('');
    if (s === word1) continue;
    const fixed = [...s].filter((ch, i) => ch === word1[i]).length;
    if (fixed < best) { best = fixed; scramble = s; if (fixed === 0) break; }
  }
  const encLetters = word1.split('');
  const enc1 = encLetters.map((ch) => RING.indexOf(ch));
  cues[1] = v.enc1 === 'theme' ? ['clue_mot_melange', `theme_${theme}`] : ['clue_mot_melange'];

  // ---- 2. trappe (v0.3) : 5 barrettes × 2 moitiés de 4 LED = 10 segments ; comptes toujours distincts
  // (3/2/1 sur 5 barrettes est impossible : 3+2+1 = 6). bar[0] = moitié gauche de la barrette 1.
  const counts = pick([[5, 3, 2], [6, 3, 1], [5, 4, 1]]);
  const order = shuffle(TRAP_COLORS);                      // order[0] = la plus présente … order[2] = la plus rare
  let bar = []; order.forEach((c, i) => { for (let k = 0; k < counts[i]; k++) bar.push(c); });
  bar = shuffle(bar);
  const trapColor = { frequente: order[0], moyenne: order[1], rare: order[2], gauche: bar[0] }[v.trap];
  // v0.4 : 2 trappes (A, B) : la couleur réponse + une autre couleur des barrettes, ordre tiré au hasard
  const trapColors = shuffle([trapColor, pick(TRAP_COLORS.filter((c) => c !== trapColor))]);
  const trap = trapColors.indexOf(trapColor);              // index 0..1
  cues[2] = [`clue_trappe_${v.trap}`];

  // ---- 3. Simon (v0.3) : série de barrettes 0..4 (répétitions permises, même de suite). On la reproduit en touchant
  // les prises sous les barrettes. Moyen : tours de 2 à 5 ; difficile : 3 à 6, plus rapide à chaque tour.
  const sp = SIMON[tier];
  const simon = { seq: Array.from({ length: sp.target }, () => int(5)), start: sp.start, target: sp.target, first: sp.first, between: sp.between, lastReversed: !!sp.lastReversed };
  cues[3] = ['clue_simon', 'clue_simon_noir', 'simon_notes'];   // v0.5.1 : « Écoute les notes. »

  // ---- 4 et 10. baie banane 5x5 : 5 câbles ancrés sur la base (ports 0..4, couleurs toutes différentes),
  // chacun se branche dans N'IMPORTE LAQUELLE des 5 prises (0..4 = prises 1..5). Départ : câble c → prise c.
  // Une consigne = req { câble: prise | null (débranché) } ; les autres câbles sont libres.
  const wires = shuffle(WIRE_COLORS);
  const cab = (c) => `cable_${wires[c]}`, pr = (s) => `prise_${s + 1}`;
  const two = () => { const a = int(5); let b = int(4); if (b >= a) b++; return [a, b]; };
  const patchOf = (kind, layer) => {
    const head = layer === 1 ? 'clue_patch' : 'clue_patch2';
    if (kind === 'route') { const [A, N] = two(); return { kind, req: { [A]: N }, cues: ['clue_patch_route', cab(A), pr(N)] }; }
    if (kind === 'echange') { const [X, Y] = two(); return { kind, req: { [X]: Y, [Y]: X }, cues: [`${head}_echange`, cab(X), 'patch_et', cab(Y), 'patch_echange_fin'] }; }
    if (kind === 'debranche') { const [X, Y] = two(); return { kind, req: { [X]: null, [Y]: null }, cues: ['clue_patch_debranche', cab(X), 'patch_et', cab(Y), 'patch_laisse_deux'] }; }
    // serie (v0.5.0) : prise = rang (1..4) d'un CHIFFRE parmi les 4 chiffres du n° de série ; le câble ne part pas déjà de cette prise
    const rank = int(4); let A = int(4); if (A >= rank) A++;
    if (kind === 'serie' && layer === 1) return { kind, req: { [A]: rank }, cues: ['clue_patch_serie', cab(A), 'patch_rang_chiffre', `chiffre_${digits[rank]}`] };
    // couche 2 « serie » : débranche B, puis A dans la prise au rang du chiffre
    let B = int(4); if (B >= A) B++; if (B === rank) B = [0, 1, 2, 3, 4].find((c) => c !== A && c !== rank);
    if (kind === 'serie') return { kind, req: { [B]: null, [A]: rank }, cues: ['clue_patch2_serie', cab(B), 'patch_laisse', cab(A), 'patch_rang_chiffre', `chiffre_${digits[rank]}`] };
    // double (v0.2.3) : débranche B et laisse-le débranché, puis C dans la prise M
    const [Bd, C] = two(); let M = int(4); if (M >= C) M++; if (M === Bd) M = [0, 1, 2, 3, 4].find((s) => s !== C && s !== Bd);
    return { kind, req: { [Bd]: null, [C]: M }, cues: ['clue_patch_double', cab(Bd), 'patch_laisse', cab(C), pr(M)] };
  };
  const patch1 = patchOf(v.patch1, 1);
  const patch2 = patchOf(v.patch2, 2);
  cues[4] = patch1.cues; cues[10] = patch2.cues;

  // ---- 5 et 9. verrous de signal : labyrinthe 5x5 visible sur le CYD 2
  const maze1 = makeMaze(5, r), maze2 = makeMaze(5, r);

  // ---- fragments (dictés après les étapes 1, 3, 4, 5, jamais écrits) ; codes 1 et 2 = règles tirées
  const frags = Array.from({ length: 4 }, () => int(10));
  const code1 = (v.code1 === 'envers' ? frags.slice().reverse() : v.code1 === 'plus1' ? frags.map((f) => (f + 1) % 10) : frags).join('');
  const last = digits[3];                                   // dernier chiffre de la plaque
  const code2 = (v.code2 === 'rotation' ? [frags[2], frags[3], frags[0], frags[1]] : v.code2 === 'decale' ? frags.map((f) => (f + last) % 10) : frags.slice().reverse()).join('');
  cues[6] = [v.code1 === 'ordre' ? 'clue_code1' : `clue_code1_${v.code1}`]; cues[11] = [`clue_code2_${v.code2}`];

  // ---- 7. clés I, II (v0.4 : 2 serrures) : chacune « pèse » un chiffre (I = 1er, II = 2e) ; légère → lourde ou l'inverse
  const keyOrder = [0, 1].sort((a, b) => (v.keys === 'lourde' ? digits[b] - digits[a] : digits[a] - digits[b]));
  cues[7] = v.keys === 'ensemble' ? ['cles_intro'] : ['cles_intro', `clue_cles_${v.keys}`];

  // ---- mensonges (œil rouge) : faux fragments ; le reste de la pression est dans app.js (pendant chaque choix)
  const fragLies = shuffle([0, 1, 2, 3]).slice(0, hard ? 3 : 2).sort();
  const lies = { fragLies, encFalse: hard, wire2False: hard, keysTwice: hard };
  // leurre de branchement : un câble et une prise qui violent la consigne
  const wrongPlug = (p) => {
    const ent = Object.entries(p.req).map(([c, s]) => [+c, s]);
    const tgt = ent.find(([, s]) => s != null);
    if (tgt) { const others = [0, 1, 2, 3, 4].filter((c) => c !== tgt[0]); return { cable: others[int(4)], socket: tgt[1] }; }
    const c = ent[0][0]; let s = int(4); if (s >= c) s++; return { cable: c, socket: s };
  };
  const decoys = { wire1: wrongPlug(patch1), wire2: wrongPlug(patch2), frags: frags.map((f) => (f + 1 + int(9)) % 10), keys: keyOrder.slice().reverse() };

  // ---- 8. cryptex : 5 encodeurs (anneau de 20) ; l'Entité épelle un mot (ordre / à l'envers / « lettre suivante »)
  const word = pick(WORDS.filter((w) => w !== word1));    // v0.5.0 : jamais le mot de l'étape 1
  const encWord = v.word === 'suivante' ? word.split('').map(nextOnRing).join('') : word;
  const enc2 = encWord.split('').map((ch) => RING.indexOf(ch));
  const spell = v.word === 'envers' ? word.split('').reverse().join('') : word;
  cues[8] = [`clue_mot_${v.word}`, ...spell.split('').map((ch) => `lettre_${ch.toLowerCase()}`)];
  decoys.word = RING[(enc2[0] + 3 + int(15)) % DETENTS];
  const sig = [tier, ...SLOTS.map((k) => v[k])].join('|');
  return {
    seed: seed >>> 0, tier, v, sig, serial, lot, digits, theme, word1, scramble, encLetters,
    enc1, enc2, word, encWord, spell, bar, counts, order, trapColors, trap, simon,
    wires, patch1, patch2, maze1, maze2, frags, code1, code2, keyOrder, lies, cues,
    decoys,
  };
}

// Labyrinthe parfait (DFS) n x n. walls[y][x] = bits N1 E2 S4 W8 (1 = mur). Départ en bas à gauche, cible en haut à droite.
export const DIRS = { up: [0, -1, 1, 4], right: [1, 0, 2, 8], down: [0, 1, 4, 1], left: [-1, 0, 8, 2] };
export function makeMaze(n, r) {
  const walls = Array.from({ length: n }, () => Array(n).fill(15));
  const seen = Array.from({ length: n }, () => Array(n).fill(false));
  const stack = [[0, n - 1]]; seen[n - 1][0] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = Object.values(DIRS).filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny][nx]; });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy, b, ob] = opts[Math.floor(r() * opts.length)];
    walls[y][x] &= ~b; walls[y + dy][x + dx] &= ~ob; seen[y + dy][x + dx] = true; stack.push([x + dx, y + dy]);
  }
  return { n, walls, start: [0, n - 1], goal: [n - 1, 0], path: solveMaze(walls, n, [0, n - 1], [n - 1, 0]) };
}
export function canMove(maze, [x, y], dir) {
  const [dx, dy, b] = DIRS[dir]; const nx = x + dx, ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= maze.n || ny >= maze.n) return false;
  return !(maze.walls[y][x] & b);
}
// suite de directions la plus courte (BFS)
function solveMaze(walls, n, s, g) {
  const prev = new Map(), key = ([x, y]) => `${x},${y}`, q = [s]; prev.set(key(s), null);
  while (q.length) {
    const c = q.shift(); if (c[0] === g[0] && c[1] === g[1]) break;
    for (const [d, [dx, dy, b]] of Object.entries(DIRS)) {
      const nx = c[0] + dx, ny = c[1] + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || (walls[c[1]][c[0]] & b) || prev.has(`${nx},${ny}`)) continue;
      prev.set(`${nx},${ny}`, [c, d]); q.push([nx, ny]);
    }
  }
  const out = []; let k = key(g);
  while (prev.get(k)) { const [c, d] = prev.get(k); out.unshift(d); k = key(c); }
  return out;
}
