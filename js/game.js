// game.js : tirage d'une partie v0.2.2 (logique pure, sans DOM). Même graine = même partie.
// Paliers cachés ~50/50 : 'moyen-difficile' et 'difficile'. Pas de mode facile.
// Tout se déduit de la mallette elle-même (plaque du n° de série, écrans, barre DEL) : aucun manuel externe.

export function mulberry32(a) {
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const TIME_S = 480;          // 8 min, comme la v0.1.5
export const NSTEPS = 12;
export const WIRE_COLORS = ['rouge', 'noir', 'bleu', 'jaune', 'vert']; // kit Keadic, 5 couleurs
export const TRAP_COLORS = ['rouge', 'vert', 'bleu'];
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXZ'; // sans I ni O (confondus avec 1 et 0)
// Anneau cryptex des KY-040 : 20 crans = 1 tour = 20 lettres (sans K, Q, W, X, Y, Z)
export const RING = 'ABCDEFGHIJLMNOPRSTUV';
export const DETENTS = 20;
// Mots de 4 lettres français, toutes leurs lettres sur l'anneau
export const WORDS = ['NORD', 'CODE', 'LUNE', 'STOP', 'MARS', 'PORT', 'VENT', 'NUIT', 'CAGE', 'BLEU', 'NOIR', 'SOIR', 'TOUR', 'FILS'];

// Étapes : face où elle se joue + titre court (bandeau d'état).
export const STEPS = [
  null,
  { face: 'base',   part: 'enc',    title: 'Signal 1 · encodeurs' },
  { face: 'base',   part: 'traps',  title: 'Trappe' },
  { face: 'base',   part: 'bar',    title: 'Séquence lumineuse' },
  { face: 'base',   part: 'wires',  title: 'Fiches banane' },
  { face: 'base',   part: 'cyd2',   title: 'Verrou de signal' },
  { face: 'base',   part: 'keypad', title: 'Code 1' },
  { face: 'base',   part: 'keys',   title: 'Clés I · II · III' },
  { face: 'base',   part: 'enc',    title: 'Signal 2 · mot (cryptex)' },
  { face: 'base',   part: 'cyd2',   title: 'Verrou saboté' },
  { face: 'base',   part: 'wires',  title: 'Fiches · 2e couche' },
  { face: 'base',   part: 'keypad', title: 'Code 2' },
  { face: 'base',   part: 'toggleTx', title: 'Levier rouge' },
];

export function makeRun(seed) {
  const r = mulberry32(seed >>> 0);
  const int = (n) => Math.floor(r() * n);
  const pick = (a) => a[int(a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const tier = r() < 0.5 ? 'moyen-difficile' : 'difficile';
  const hard = tier === 'difficile';

  // ---- n° de série : C L C - C C L (4 chiffres tous différents, 2 lettres différentes)
  const digits = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
  const l1 = pick(LETTERS); let l2 = pick(LETTERS); while (l2 === l1) l2 = pick(LETTERS);
  const serial = `${digits[0]}${l1}${digits[1]}-${digits[2]}${digits[3]}${l2}`;
  const lot = 100 + int(900); // leurre sur la plaque

  // ---- 1. encodeurs : chiffres du n° dans l'ordre (difficile : en partant de la fin)
  const enc1 = hard ? digits.slice().reverse() : digits.slice();

  // ---- 2. trappe : barre WS2812B de 8 DEL, comptes 4/3/1 ou 5/2/1 ; moyen = la plus fréquente, difficile = la plus rare
  const counts = pick([[4, 3, 1], [5, 2, 1]]);
  const order = shuffle(TRAP_COLORS);
  let bar = []; order.forEach((c, i) => { for (let k = 0; k < counts[i]; k++) bar.push(c); });
  bar = shuffle(bar);
  const trapColors = shuffle(TRAP_COLORS);                // couleur du liseré de T1, T2, T3
  const trapColor = hard ? order[2] : order[0];
  const trap = trapColors.indexOf(trapColor);             // index 0..2

  // ---- 3. séquence lumineuse : 4 DEL (positions 1..8) s'allument sur la barre WS2812B ; on tape leurs positions
  // au clavier 4x4, dans l'ordre (difficile : à l'envers). Rien n'est écrit : il faut regarder et retenir.
  const seq = shuffle([1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4);
  const seqCode = (hard ? seq.slice().reverse() : seq).join('');

  // ---- 4 et 10. fils (5 fiches banane dans le couvercle)
  const ruleWires1 = (w) => {
    const reds = w.map((c, i) => (c === 'rouge' ? i : -1)).filter((i) => i >= 0);
    if (reds.length > 1) return reds[reds.length - 1];
    if (hard && digits[3] % 2 === 0) return 1;
    return lonely(w);
  };
  const ruleWires2 = (w) => {
    const blues = w.map((c, i) => (c === 'bleu' ? i : -1)).filter((i) => i >= 0);
    if (hard && blues.length > 1) return blues[0];
    return lonely(w);
  };
  const drawWires = (rule, avoidSame) => {
    for (let t = 0; t < 400; t++) {
      const w = Array.from({ length: 5 }, () => pick(WIRE_COLORS));
      const ans = rule(w);
      if (ans < 0) continue;
      if (avoidSame && w.join() === avoidSame.join()) continue;
      return { colors: w, cut: ans };
    }
    return { colors: ['rouge', 'noir', 'noir', 'bleu', 'bleu'], cut: 0 };
  };
  const wires1 = drawWires(ruleWires1);
  const wires2 = drawWires(ruleWires2, wires1.colors);

  // ---- 5 et 9. verrous de signal : labyrinthe 5x5 visible sur le CYD 2
  const maze1 = makeMaze(5, r), maze2 = makeMaze(5, r);

  // ---- fragments du code 1 (révélés après les étapes 1, 3, 4, 5 (dictés, jamais écrits)) ; code 2 = code 1 à l'envers
  const frags = Array.from({ length: 4 }, () => int(10));
  const code1 = frags.join('');
  const code2 = code1.split('').reverse().join('');

  // ---- 7. clés I, II, III : chacune « pèse » un chiffre (I = 1er, II = 2e, III = 3e) ; légère → lourde (difficile : l'inverse)
  const keyOrder = [0, 1, 2].sort((a, b) => (hard ? digits[b] - digits[a] : digits[a] - digits[b]));

  // ---- mensonges (œil rouge) : faux fragments ; le reste de la pression est dans app.js (pendant chaque choix)
  const fragLies = shuffle([0, 1, 2, 3]).slice(0, hard ? 3 : 2).sort();
  const lies = { fragLies, encFalse: hard, wire2False: hard, keysTwice: hard };

  const wrong = (n, good) => { let v = int(n); if (v === good) v = (v + 1 + int(n - 1)) % n; return v; };
  const decoys = { wire1: wrong(5, wires1.cut), wire2: wrong(5, wires2.cut), seq: (seq[0] % 8) + 1, frags: frags.map((f) => (f + 1 + int(9)) % 10), keys: keyOrder.slice().reverse() };

  // ---- 8. cryptex : 4 encodeurs en mode lettres (anneau de 20) ; l'Entité épelle un mot (difficile : épelé à l'envers,
  // on le compose à l'endroit). Tiré en dernier pour garder les mêmes parties qu'avant à graine égale.
  const word = pick(WORDS);
  const enc2 = word.split('').map((ch) => RING.indexOf(ch));
  const spell = hard ? word.split('').reverse().join('') : word;
  decoys.word = RING[(enc2[0] + 3 + int(15)) % DETENTS];
  return {
    seed: seed >>> 0, tier, serial, lot, digits, letters: [l1, l2],
    enc1, enc2, word, spell, bar, trapColors, trap, seq, seqCode,
    wires1, wires2, maze1, maze2, frags, code1, code2, keyOrder, lies,
    decoys,
  };
}

// fil sans jumeau (seule couleur présente une fois) ; -1 si zéro ou plusieurs
function lonely(w) {
  const once = w.map((c, i) => (w.filter((x) => x === c).length === 1 ? i : -1)).filter((i) => i >= 0);
  return once.length === 1 ? once[0] : -1;
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
