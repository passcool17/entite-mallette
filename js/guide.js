// guide.js (v0.5.2 : trappe au joystick, serrures « deux clés » au vert ; v0.5.1 : Simon à l'envers au dernier tour en difficile ; v0.5.0 : étape 1 = mot mêlé ; v0.3 ; base v0.2.5) : clarté du jeu (retour de Pascal : « on reste bloqué sans savoir quoi faire »).
// Pour chaque étape : un OBJECTIF court (dit par l'Entité ET écrit dans le bandeau), le ou les MODULES à utiliser
// (contour qui pulse), et 3 niveaux d'INDICES. Règle de Pascal : le bandeau dit QUOI faire et OÙ, jamais une réponse
// calculée (aucun code, sauf ?debug=1). À l'étape 10 le bandeau reprend la consigne dictée (couleur / prise). Seul l'indice 3 DIT (à voix haute) un morceau de la réponse.
// Logique pure (sans DOM) : testable avec node.
import { RING, DIRS, canMove } from './game.js?v=0.5.4';

// objectif : id de réplique (voix/manifest.json) ; le texte du bandeau = le texte de la réplique (même phrase)
export const OBJECTIVE = {
  0: 'obj_armer', 1: 'obj_mot_melange', 2: 'obj_trappe_joy', 3: 'obj_simon', 4: 'obj_cables', 5: 'obj_verrou', 6: 'obj_code',
  7: 'obj_cles', 8: 'obj_mot', 9: 'obj_noir', 10: 'obj_cables2', 11: 'obj_code', 12: 'obj_transmit',
};
// Étape 10 : le bandeau reprend la consigne dictée (couleur / prise, ou rang d'une lettre), pas le résumé vague
// « Rebranche les câbles : nouvelle consigne. ». Ce n'est pas une réponse calculée : c'est le même indice que la voix.
// v0.5.2 : l'objectif de l'étape 7 dépend de la règle (moyen : ensemble ; difficile : dans l'ordre, après le vert)
export function objectiveId(run, step) {
  if (step === 7 && run?.v?.keys) return run.v.keys === 'ensemble' ? 'obj_cles_ensemble' : 'obj_cles_signal';
  return OBJECTIVE[step];
}
export function objectiveIds(run, step) {
  if (step === 10 && run?.cues?.[10]) return run.cues[10];
  const o = objectiveId(run, step);
  return o ? [o] : [];
}
// modules à faire briller (sélecteurs) ; jamais un leurre
export const MODULES = {
  0: ['#gtArm'], 1: ['#encRow', '.cyd2'], 2: ['#jacks', '#traps', '#joy'], 3: ['#jacks'], 4: ['#jacks', '#ports'], 5: ['.cyd2', '#joy'],
  6: ['#keypad'], 7: ['#keyRow'], 8: ['#encRow', '.cyd2'], 9: ['.cyd2', '#joy'], 10: ['#jacks', '#ports'], 11: ['#keypad'], 12: ['#gtTx'],
};
export const HINT_COST = { 1: 0, 2: 15, 3: 30 };   // secondes retirées du chrono
export const AUTO_HINT_MS = 45000;                  // indice 1 automatique après 45 s sans progrès

const H1 = { 1: 'hint1_mot_melange', 2: 'hint1_barre', 3: 'hint1_simon', 4: 'hint1_cables', 5: 'hint1_verrou', 6: 'hint1_code', 7: 'hint1_cles', 8: 'hint1_mot', 9: 'hint1_noir', 10: 'hint1_cables', 11: 'hint1_code', 12: 'hint1_transmit' };
// bandeau des indices : la SOURCE d'information ou la méthode, jamais la valeur
const RULE = 'Indice : écoute la règle, pas à pas';
const STRIP = {
  0: ['Indice : capot bleu, puis levier', 'Indice : deux gestes, capot puis levier', 'Indice : deux gestes, capot puis levier'],
  1: ['Indice : les lettres mélangées sont sur l’écran du bas', 'Indice : un mot de cinq lettres, une lettre par molette', 'Indice : la première lettre est dite'],
  2: ['Indice : compte les moitiés de barrette de chaque couleur', RULE, 'Indice : la bonne trappe est dite'],
  3: ['Indice : Réécouter, sur l’écran du bas, puis regarde les barrettes', 'Indice : une barrette qui pulse = sa prise, dans le même ordre', 'Indice : la première prise est dite'],
  4: ['Indice : écoute la couleur et la prise', RULE, 'Indice : le premier geste est dit'],
  5: ['Indice : contourne les murs', 'Indice : essaie vers la droite et le haut', 'Indice : la première direction est dite'],
  6: ['Indice : reprends les fragments dictés (œil bleu)', 'Indice : écoute la règle et les fragments', 'Indice : le premier chiffre est dit'],
  7: ['Indice : regarde les chiffres du n° de série, sur l’écran du bas', RULE, 'Indice : la première serrure est dite'],
  '7e': ['Indice : les clés sont dans les trappes A et B', 'Indice : au vert, les deux clés ensemble', 'Indice : moins d’une seconde entre les deux'],
  8: ['Indice : Réécouter, puis lis les lettres sur l’écran du bas', RULE, 'Indice : la première molette est dite'],
  12: ['Indice : capot rouge, puis levier', 'Indice : deux gestes, capot puis levier', 'Indice : deux gestes, capot puis levier'],
};
STRIP[9] = STRIP[5]; STRIP[10] = STRIP[4]; STRIP[11] = STRIP[6];
export const hintStrip = (step, level, run) => (step === 7 && run?.v?.keys === 'ensemble' ? STRIP['7e'] : STRIP[step])?.[level - 1] ?? 'Indice';

const cab = (run, c) => `cable_${run.wires[c]}`;
const pr = (s) => `prise_${s + 1}`;
const dig = (d) => `chiffre_${d}`;
const let_ = (ch) => `lettre_${ch.toLowerCase()}`;
const DIR_CUE = { up: 'dir_haut', down: 'dir_bas', left: 'dir_gauche', right: 'dir_droite' };
// premier pas du plus court chemin depuis pos (BFS) ; c'est le déplacement du point, pas le geste du joystick
export function firstMove(maze, pos) {
  const key = (p) => p.join(','), prev = new Map([[key(pos), null]]), q = [pos];
  while (q.length) {
    const c = q.shift();
    if (c[0] === maze.goal[0] && c[1] === maze.goal[1]) { let k = key(c), d = null; while (prev.get(k)) { [k, d] = [prev.get(k)[0], prev.get(k)[1]]; } return d; }
    for (const d of Object.keys(DIRS)) { if (!canMove(maze, c, d)) continue; const n = [c[0] + DIRS[d][0], c[1] + DIRS[d][1]]; if (!prev.has(key(n))) { prev.set(key(n), [key(c), d]); q.push(n); } }
  }
  return null;
}

// répliques d'un indice : niveau 1 = où regarder ; 2 = la règle expliquée (+ rappel des fragments aux codes) ;
// 3 = un morceau de la réponse, dit à voix haute (jamais écrit). ctx = { pos, sabotage, frags (fragments vrais déjà dits) }
export function hintCues(run, step, level, ctx = {}) {
  if (step === 0) return [level === 1 ? 'hint1_armer' : 'hint2_armer'];
  const v = run.v;
  if (level === 1) return [step === 7 && v.keys === 'ensemble' ? 'hint1_cles_ensemble' : H1[step]];
  if (level === 2) {
    switch (step) {
      case 1: return v.enc1 === 'theme' ? ['hint2_mot_melange', `theme_${run.theme}`] : ['hint2_mot_melange'];
      case 2: return [`hint2_trappe_${v.trap}`];
      case 3: return ['hint2_simon'];
      case 4: return [`hint2_patch_${run.patch1.kind}`];
      case 10: return [`hint2_patch_${run.patch2.kind}`];
      case 5: case 9: return ['hint2_verrou'];
      case 6: case 11: {
        const rule = step === 6 ? `hint2_code1_${v.code1}` : `hint2_code2_${v.code2}`;
        return [rule, 'hint_rappel_fragments', ...run.frags.map(dig)];
      }
      case 7: return [v.keys === 'ensemble' ? 'hint2_cles_ensemble' : `hint2_cles_${v.keys}`];
      case 8: return [`hint2_mot_${v.word}`];
      case 12: return ['hint2_transmit'];
    }
  }
  switch (step) {
    case 1: return ['hint3_mot_melange', let_(run.word1[0])];
    case 8: return ['hint3_molette1', let_(RING[run.enc2[0]])];
    case 2: return ['hint3_trappe', `couleur_${run.trapColors[run.trap]}`];
    case 3: { const k = ctx.simonRev ? run.simon.seq[run.simon.target - 1] : run.simon.seq[0];   // dernier tour à l'envers : la 1re prise est la dernière de la série
      return ['hint3_simon', `couleur_${['noir', 'bleu', 'vert', 'rouge', 'jaune'][k]}`]; }
    case 6: return ['hint3_premier_chiffre', dig(run.code1[0])];
    case 11: return ['hint3_premier_chiffre', dig(run.code2[0])];
    case 4: case 10: {
      const p = step === 4 ? run.patch1 : run.patch2;
      const ent = Object.entries(p.req).map(([c, s]) => [+c, s]).sort((a, b) => (a[1] == null ? -1 : 1) - (b[1] == null ? -1 : 1));
      const [c, s] = ent[0];
      return s == null ? ['hint3_debranche', cab(run, c)] : ['hint3_geste', cab(run, c), pr(s)];
    }
    case 5: case 9: {
      const maze = step === 5 ? run.maze1 : run.maze2, d = firstMove(maze, ctx.pos || maze.start);
      return d ? ['hint3_direction', DIR_CUE[d]] : ['hint2_verrou'];
    }
    case 7: return v.keys === 'ensemble' ? ['hint3_cles_ensemble'] : ['hint3_serrure', dig(run.keyOrder[0] + 1)];
    case 12: return ['hint2_transmit'];
  }
  return [H1[step]];
}
// toutes les répliques que le guide peut dire (pour vérifier le manifeste)
export const GUIDE_CUES = [
  ...new Set(Object.values(OBJECTIVE)), ...new Set(Object.values(H1)), 'hint1_armer', 'hint2_armer', 'hint2_verrou', 'hint2_transmit', 'hint_rappel_fragments',
  'hint2_mot_melange', 'hint3_mot_melange', 'theme_objet', 'theme_nature', 'theme_machine', ...['frequente', 'rare', 'moyenne', 'gauche'].map((k) => `hint2_trappe_${k}`),
  'hint2_simon', 'hint3_simon', 'simon_notes', 'simon_envers', ...['route', 'echange', 'debranche', 'serie', 'double'].map((k) => `hint2_patch_${k}`),
  ...['ordre', 'envers', 'plus1'].map((k) => `hint2_code1_${k}`), ...['envers', 'rotation', 'decale'].map((k) => `hint2_code2_${k}`),
  'hint2_cles_legere', 'hint2_cles_lourde', 'obj_cles_ensemble', 'obj_cles_signal', 'hint1_cles_ensemble', 'hint2_cles_ensemble', 'hint3_cles_ensemble',
  'cles_intro', 'cles_maintenant', 'cles_trop_tot', 'cles_pas_ensemble', 'cles_ensemble', ...['ordre', 'envers', 'suivante'].map((k) => `hint2_mot_${k}`),
  'hint3_molette1', 'hint3_trappe', 'hint3_premier_chiffre', 'hint3_geste', 'hint3_debranche', 'hint3_direction', 'hint3_serrure', ...Object.values(DIR_CUE),
];
