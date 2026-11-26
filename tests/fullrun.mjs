// tests/fullrun.mjs
// Contrôle qualité avant chaque push (et avant d'assembler la valise).
// Joue des parties complètes (étapes 0 à 12, dans l'ordre) jusqu'à ce que
// TOUTES les variantes de chaque étape et les DEUX paliers (moyen + difficile)
// soient couverts. ?debug=1 sert UNIQUEMENT à lire les réponses générées :
// la saisie se fait par de vrais taps/clics, comme un joueur.
//
// Chaque partie vérifie aussi :
//   - v0.3 étape 3 = Simon : chaque tour, les barrettes jouent (K2000, ≤ 4 LED à la fois) exactement la série
//     attendue ; on la reproduit en touchant les prises ; tours 2→5 (moyen) / 3→6 (difficile), plus rapide en difficile
//   - Réécouter (et l'indice 1 une partie sur cinq) rejoue le même tour, sans pénalité
//   - une mauvaise prise : −8 s, l'étape ne recule pas, le tour se rejoue ; toucher pendant la lecture ne compte pas
//   - une barrette répétée deux fois de suite est acceptée ; un toucher par glisser (la fiche revient) compte
//   - trop lent (1re graine de chaque palier) : faux, le tour se rejoue
//   - étape 2 : 5 barrettes = 10 moitiés de 4 LED, comptes distincts ; étapes 1 et 8 : les 5 lettres courantes sur le CYD 2
//   - un indice sur une autre étape n'empêche pas d'avancer
//   - aux étapes code (6, 11) : un faux code puis le bon, et l'étape n'avance qu'après le bon
//   - à chaque réussite : l'index d'étape avance et l'id de voix passe à la réussite + l'objectif suivant
//
// Usage :
//   node tests/fullrun.mjs
//   node tests/fullrun.mjs http://127.0.0.1:8794/
//   node tests/fullrun.mjs https://passcool17.github.io/entite-mallette/
//   node tests/fullrun.mjs --base-url URL
//   node tests/fullrun.mjs --seeds 0,26,28
//   node tests/fullrun.mjs --seeds 3,42,77,501,1234          # ad hoc : couverture = WARN, pas FAIL
//   node tests/fullrun.mjs --seeds 3,42,77 --require-coverage
//   npm run qa
//   node tests/fullrun.mjs --qa
//   node tests/fullrun.mjs --qa --base-url https://passcool17.github.io/entite-mallette/
//   FULLRUN_BASE=... node tests/fullrun.mjs
// Graines optionnelles (débogage seulement ; la couverture complète n'est exigée
// que pour le jeu par défaut et pour --qa / npm run qa) :
//   node tests/fullrun.mjs http://127.0.0.1:8794/ 0 26 28 142 9
// Viewport : 412×915 (Galaxy S20 FE, portrait).
// --qa / CI : 20 graines fixes par palier + quelques aléatoires journalisées ;
//   audio court-circuité (voiceLog + --mute-audio), serveur local auto si pas de --base-url.

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { makeRun, RING, DETENTS, POOLS, SLOTS, TIERS, NENC, SIMON } from '../js/game.js?v=0.5.2';
import { OBJECTIVE, hintCues, objectiveId } from '../js/guide.js?v=0.5.2';

const require = createRequire(import.meta.url);
function loadChromium() {
  const candidates = [
    'playwright',
    'playwright-core',
    '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.js',
    '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs',
  ];
  for (const id of candidates) {
    try { return require(id).chromium; } catch { /* next */ }
  }
  throw new Error('playwright introuvable : lancer npm ci (devDependency playwright)');
}
const chromium = loadChromium();

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEW = { width: 412, height: 915 };

// 20 moyen + 20 difficile (v0.3 : 26 variantes, la séquence clavier n'existe plus). Liste fixe pour CI reproductible.
const QA_FIXED = {
  moyen:     [0, 7, 8, 9, 12, 14, 15, 18, 19, 21, 23, 24, 27, 28, 29, 32, 35, 39, 45, 46],
  difficile: [1, 2, 3, 4, 5, 6, 10, 11, 13, 16, 17, 20, 22, 25, 26, 30, 31, 33, 34, 36],
};
const QA_RANDOM_PER_TIER = 2;

function parseArgv(argv) {
  const envCi = process.env.CI === 'true' || process.env.CI === '1';
  const out = {
    base: process.env.FULLRUN_BASE || '',
    seeds: null,
    qa: envCi || process.env.FULLRUN_QA === '1',
    stubAudio: null,
    autoServe: false,
    explicitSeeds: false,
    requireCoverage: process.env.FULLRUN_REQUIRE_COVERAGE === '1',
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--qa') out.qa = true;
    else if (a === '--base-url' || a === '--base') out.base = argv[++i] || '';
    else if (a.startsWith('--base-url=')) out.base = a.slice('--base-url='.length);
    else if (a === '--seeds') {
      out.seeds = String(argv[++i] || '').split(/[,\s]+/).filter(Boolean).map(Number);
      out.explicitSeeds = true;
    } else if (a.startsWith('--seeds=')) {
      out.seeds = a.slice('--seeds='.length).split(/[,\s]+/).filter(Boolean).map(Number);
      out.explicitSeeds = true;
    } else if (a === '--stub-audio') out.stubAudio = true;
    else if (a === '--no-stub-audio') out.stubAudio = false;
    else if (a === '--serve') out.autoServe = true;
    else if (a === '--require-coverage') out.requireCoverage = true;
    else if (a === '--no-require-coverage') out.requireCoverage = false;
    else if (a.startsWith('-')) {
      console.error('option inconnue :', a);
      process.exit(2);
    } else rest.push(a);
  }
  for (const r of rest) {
    if (/^https?:\/\//i.test(r)) {
      if (!out.base) out.base = r;
    } else if (/^\d+$/.test(r)) {
      if (!out.seeds) out.seeds = [];
      out.seeds.push(Number(r));
      out.explicitSeeds = true;
    } else if (!out.base) out.base = r;
  }
  if (out.stubAudio == null) out.stubAudio = !!out.qa;
  if (out.qa && !out.base) out.autoServe = true;
  if (!out.base && !out.autoServe) out.base = 'http://127.0.0.1:8794/';
  if (out.base) out.base = out.base.replace(/\/?$/, '/');
  return out;
}

const ARGS = parseArgv(process.argv.slice(2));

function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  if (process.env.CI === 'true' || process.env.CI === '1') return undefined;
  if (existsSync('/opt/google/chrome/chrome')) return '/opt/google/chrome/chrome';
  return undefined;
}

function launchOptions() {
  const opts = {
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--disable-dev-shm-usage',
    ],
  };
  const exe = chromePath();
  if (exe) opts.executablePath = exe;
  return opts;
}

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port }, () => { s.end(); resolve(true); });
    s.on('error', () => resolve(false));
  });
}

async function startStaticServer() {
  const preferred = Number(process.env.FULLRUN_PORT) || 8794;
  if (await portOpen(preferred)) {
    const base = `http://127.0.0.1:${preferred}/`;
    console.log(`serveur déjà ouvert  ${base}`);
    return { base, stop: async () => {} };
  }
  const port = preferred;
  const child = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  child.stderr.on('data', (d) => { err += d.toString(); });
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    if (child.exitCode != null) throw new Error(`serveur http arrêté (code ${child.exitCode}) ${err}`);
    if (await portOpen(port)) {
      const base = `http://127.0.0.1:${port}/`;
      console.log(`serveur local        ${base}`);
      return {
        base,
        stop: () => new Promise((resolve) => {
          child.once('exit', () => resolve());
          child.kill('SIGTERM');
          setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(); }, 1500);
        }),
      };
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  try { child.kill('SIGTERM'); } catch {}
  throw new Error('serveur http : délai dépassé');
}

function qaSeeds() {
  const moyen = QA_FIXED.moyen.slice();
  const difficile = QA_FIXED.difficile.slice();
  if (moyen.length < 20 || difficile.length < 20) {
    throw new Error(`QA_FIXED incomplet : moyen ${moyen.length}, difficile ${difficile.length}`);
  }
  const used = new Set([...moyen, ...difficile]);
  const random = [];
  for (const tier of TIERS) {
    let n = 0, guard = 0;
    while (n < QA_RANDOM_PER_TIER && guard++ < 200000) {
      const s = Math.floor(Math.random() * 100000);
      if (used.has(s)) continue;
      if (makeRun(s).tier !== tier) continue;
      used.add(s);
      random.push(s);
      n++;
    }
  }
  console.log(`graines fixes         moyen ${moyen.length} [${moyen.join(', ')}]`);
  console.log(`graines fixes         difficile ${difficile.length} [${difficile.join(', ')}]`);
  console.log(`graines aléatoires    ${random.map((s) => `${s}(${makeRun(s).tier})`).join(', ') || '—'}`);
  return { seeds: [...moyen, ...difficile, ...random], random };
}

const neededVariants = () => {
  const need = new Set();
  for (const k of SLOTS) for (const v of new Set([...POOLS[k].moyen, ...POOLS[k].difficile])) need.add(`${k}:${v}`);
  return need;
};

// Ensemble minimal de graines qui couvre chaque variante et les deux paliers (glouton déterministe).
function plannedCoverage(seedList) {
  const by = new Map();
  for (const s of seedList) {
    const r = makeRun(s);
    for (const k of SLOTS) {
      const key = `${k}:${r.v[k]}`;
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(s);
    }
  }
  return by;
}

// Échec immédiat si la liste fixe --qa / CI ne garantit pas toutes les variantes (union).
function assertFixedListCovers() {
  const fixed = [...QA_FIXED.moyen, ...QA_FIXED.difficile];
  const need = neededVariants();
  const by = plannedCoverage(fixed);
  const missing = [...need].filter((k) => !by.has(k));
  console.log('=== couverture prévue (liste fixe, union sur tout le run) ===');
  for (const key of [...need].sort()) {
    const ss = by.get(key) || [];
    console.log(`  ${key.padEnd(20)}${ss.length ? 'graines ' + ss.join(', ') : 'MANQUE'}`);
  }
  if (missing.length) {
    console.error(`FULLRUN FAIL  QA_FIXED ne couvre pas ${need.size - missing.length}/${need.size} : ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`liste fixe          ${need.size}/${need.size} variantes garanties`);
}

function coveringSeeds() {
  const need = neededVariants();
  const seeds = [];
  const cover = new Set();
  const tiers = { moyen: 0, difficile: 0 };
  const used = new Set();
  while (cover.size < need.size || !tiers.moyen || !tiers.difficile) {
    let best = null, bestScore = -1;
    for (let s = 0; s < 20000; s++) {
      if (used.has(s)) continue;
      const r = makeRun(s);
      const add = SLOTS.map((k) => `${k}:${r.v[k]}`).filter((x) => !cover.has(x)).length;
      const tierBonus = ((tiers.moyen === 0 && r.tier === 'moyen') || (tiers.difficile === 0 && r.tier === 'difficile')) ? 10 : 0;
      const score = add + tierBonus;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (best == null || bestScore <= 0) break;
    used.add(best);
    seeds.push(best);
    const r = makeRun(best);
    for (const k of SLOTS) cover.add(`${k}:${r.v[k]}`);
    tiers[r.tier]++;
  }
  return seeds;
}

function pickSeeds(args) {
  if (args.explicitSeeds && args.seeds?.length) return args.seeds;
  if (args.qa) return qaSeeds().seeds;
  return coveringSeeds();
}

const W = (p, ms) => p.waitForTimeout(ms);
const D = (p, f, a) => p.evaluate(f, a);
const snap = (p) => D(p, () => {
  const g = __entiteDebug.state, end = document.querySelector('#end');
  return {
    phase: g.phase, step: g.step, running: g.running, code: g.code,
    label: document.querySelector('#objLabel')?.textContent,
    text: document.querySelector('#objText')?.textContent,
    endVisible: !!(end && !end.hidden),
    vis: document.visibilityState,
    endTitle: document.querySelector('#endTitle')?.textContent,
    errors: g.errors,
    hint: g.hint,
  };
});

async function waitAdvance(p, from, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await snap(p);
    if (s.phase === 'win' || s.endVisible) return s;
    if (from === 0 && s.phase === 'play' && s.step === 1) return s;
    if (s.step !== from && s.phase === 'play') return s;
    await W(p, 50);
  }
  return snap(p);
}


const SUCCESS_HEADS = new Set(['outcome_ok', 'cles_ensemble', 'clue_fragment', 'taunt_fini', 'taunt_couche2', 'outcome_victoire', 'depart']);

function stepHeads(run, step) {
  const ids = new Set();
  { const o = objectiveId(run, step) || OBJECTIVE[step]; if (o) ids.add(o); }
  for (const id of run.cues?.[step] || []) ids.add(id);
  for (let l = 1; l <= 3; l++) {
    try { for (const id of hintCues(run, step, l, { pos: [0, 0], sabotage: false }) || []) ids.add(id); } catch { /* ignore */ }
  }
  if (step === 0) ['obj_armer', 'arm_cache', 'intro', 'hint1_armer', 'hint2_armer'].forEach((id) => ids.add(id));
  return ids;
}

async function assertVoiceMoved(p, run, from, to, t0) {
  const prev = stepHeads(run, from);
  const next = new Set(stepHeads(run, to === 'fin' || to == null ? 12 : to));
  if (to === 'fin') next.add('outcome_victoire');
  const stamp = Date.now();
  const remain = () => 1500 - (Date.now() - stamp);
  let entries = [];
  while (remain() > 0) {
    entries = await D(p, (t) => __entiteDebug.voiceLog.filter((v) => v.t >= t).map((v) => ({ ids: v.ids, t: v.t, lie: !!v.lie })), t0);
    await W(p, 40);
  }
  const head = (v) => v.ids[0];
  const stale = entries.filter((v) => {
    const h = head(v);
    if (SUCCESS_HEADS.has(h) || next.has(h)) return false;
    return prev.has(h);
  });
  const moved = entries.some((v) => SUCCESS_HEADS.has(head(v)) || next.has(head(v)));
  if (!moved) return { ok: false, why: `pas de voix réussite/prochaine étape en 1,5 s : ${JSON.stringify(entries)}` };
  if (stale.length) return { ok: false, why: `voix de l'étape ${from} encore jouée après la réussite : ${JSON.stringify(stale)}` };
  return { ok: true, heads: entries.map((v) => v.ids[0]).join(',') };
}

async function rotateTo(p, letters) {
  for (let i = 0; i < NENC; i++) {
    for (let guard = 0; guard < 28; guard++) {
      const cur = await D(p, (k) => {
        const t = document.querySelectorAll('.enc .knob')[k]?.getAttribute('aria-valuetext') || '';
        return /lettre (\w)/.exec(t)?.[1] || '';
      }, i);
      if (cur === letters[i]) break;
      const d = (RING.indexOf(letters[i]) - RING.indexOf(cur) + DETENTS) % DETENTS;
      const box = await p.locator(`.enc[data-i="${i}"] .knob`).boundingBox();
      if (!box) throw new Error(`encodeur ${i} invisible`);
      const x = (d <= 10 ? box.x + box.width * 0.84 : box.x + box.width * 0.16);
      await p.touchscreen.tap(x, box.y + box.height / 2);
      await W(p, 28);
    }
  }
  const kb = await p.locator('.enc[data-i="0"] .knob').boundingBox();
  await p.touchscreen.tap(kb.x + kb.width / 2, kb.y + kb.height / 2);
}

async function keys(p, code) {
  for (const k of String(code)) {
    const loc = p.locator(`.kp-key[data-k="${k}"]`);
    await loc.waitFor({ state: 'visible', timeout: 4000 });
    await loc.tap({ timeout: 4000 });
    await W(p, 40);
  }
}

function wrongCode(want) {
  const w = String(want);
  let bad = w.replace(/\d/g, (d) => String((+d + 1) % 10));
  if (bad === w) bad = w === '0000' ? '1111' : '0000';
  return bad;
}

async function doPatch(p, req) {
  const entries = Object.entries(req).map(([c, s]) => [+c, s]);
  const unplugs = entries.filter(([, s]) => s == null);
  const plugs = entries.filter(([, s]) => s != null);
  const apply = async (c, s) => {
    const cur = await D(p, (i) => __entiteDebug.state.cables[i].socket, c);
    if (cur === s) return;
    await p.tap(`#ports .port-btn[data-c="${c}"]`);
    await W(p, 80);
    if (s == null) await p.tap(`#ports .port-btn[data-c="${c}"]`);
    else await p.tap(`#jacks .jack[data-s="${s}"]`);
    await W(p, 160);
  };
  for (const [c, s] of unplugs) await apply(c, s);
  for (const [c, s] of plugs) await apply(c, s);
}

function firstMove(walls, n, pos, goal) {
  const key = (q) => q.join(',');
  const prev = new Map([[key(pos), null]]);
  const Q = [pos];
  const DIRS = { up: [0, -1, 1], right: [1, 0, 2], down: [0, 1, 4], left: [-1, 0, 8] };
  while (Q.length) {
    const u = Q.shift();
    if (u[0] === goal[0] && u[1] === goal[1]) {
      let kk = key(u), d = null;
      while (prev.get(kk)) { [kk, d] = prev.get(kk); }
      return d;
    }
    for (const [d, [dx, dy, bit]] of Object.entries(DIRS)) {
      const v = [u[0] + dx, u[1] + dy];
      if (v[0] < 0 || v[1] < 0 || v[0] >= n || v[1] >= n) continue;
      if (walls[u[1]][u[0]] & bit) continue;
      if (prev.has(key(v))) continue;
      prev.set(key(v), [key(u), d]);
      Q.push(v);
    }
  }
  return null;
}

async function doMaze(p, { waitSab = false } = {}) {
  const inv = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const startStep = (await snap(p)).step;
  if (waitSab && startStep === 9) {
    const t0 = Date.now();
    while (Date.now() - t0 < 6500) {
      if (await D(p, () => __entiteDebug.state.sabotage || __entiteDebug.state.step !== 9)) break;
      await W(p, 80);
    }
  }
  for (let k = 0; k < 160; k++) {
    const info = await D(p, () => {
      const g = __entiteDebug.state;
      if (g.phase === 'win' || (g.step !== 5 && g.step !== 9)) return { done: true, step: g.step, phase: g.phase };
      const maze = g.step === 5 ? __entiteDebug.run.maze1 : __entiteDebug.run.maze2;
      return { done: false, pos: g.pos.slice(), goal: maze.goal, walls: maze.walls, n: maze.n, sab: !!g.sabotage, step: g.step };
    });
    if (info.done || info.step !== startStep) return true;
    if (info.pos[0] === info.goal[0] && info.pos[1] === info.goal[1]) return true;
    const dir = firstMove(info.walls, info.n, info.pos, info.goal);
    if (!dir) return false;
    const tap = info.sab ? inv[dir] : dir;
    await p.tap(`.joy-dir.${tap}`);
    await W(p, 70);
  }
  return false;
}

// ---- Simon (v0.3) : lecture des barrettes côté page (journal rAF __stickLog), touchers par vrais taps
const simonInfo = (p) => D(p, () => {
  const S = __entiteDebug.simon; if (!S) return null;
  return { phase: S.phase, round: S.round, len: S.len, plays: S.plays, errors: S.errors, timeouts: S.timeouts, ignored: S.ignored, t0: S.t0, input: S.input.length, wd: S.wd || 0, played: (S.played || []).slice(), rounds: S.rounds.map((r) => ({ ...r })), speed: __entiteDebug.simonSpeed };
});
async function waitSimon(p, pred, ms = 30000) {
  const t0 = Date.now(); let s = null;
  while (Date.now() - t0 < ms) {
    s = await simonInfo(p);
    const st = await D(p, () => __entiteDebug.state.step);
    if (st !== 3) return { gone: true, s };
    if (s && pred(s)) return { s };
    await W(p, 25);
  }
  return { timeout: true, s };
}
// impulsions jouées depuis t0 (une impulsion = un segment allumé d'une seule barrette, entre deux noirs)
async function pulsesSince(p, t0, t1) {
  return D(p, ({ t0, t1 }) => {
    const log = (window.__stickLog || []).filter((e) => e.t >= t0 - 1 && (t1 == null || e.t <= t1));
    const out = []; let prevOff = true;
    for (const e of log) {
      if (e.lit.length === 0) { prevOff = true; continue; }
      if (e.lit.length === 1 && prevOff) out.push({ s: e.lit[0], maxOn: e.maxOn, t: Math.round(e.t - t0) });
      else if (out.length && e.lit.length === 1 && out[out.length - 1].s === e.lit[0]) out[out.length - 1].maxOn = Math.max(out[out.length - 1].maxOn, e.maxOn);
      else if (e.lit.length > 1) out.push({ s: -1, lit: e.lit, t: Math.round(e.t - t0) });
      prevOff = false;
    }
    return out;
  }, { t0, t1 });
}
async function touchJack(p, s) { await p.tap(`#jacks .jack[data-s="${s}"] .plug`); }
// toucher Simon par glisser-déposer : une fiche (câble c) posée sur la prise s puis relâchée ; elle doit revenir dans sa prise
async function dragToJack(p, s) {
  const c = await D(p, () => __entiteDebug.state.cables.findIndex((k) => k.socket != null));
  const from = await p.locator(`#ports .port-btn[data-c="${c}"]`).boundingBox();
  const to = await p.locator(`#jacks .jack[data-s="${s}"] .plug`).boundingBox();
  const before = await D(p, () => __entiteDebug.state.cables.map((k) => k.socket));
  await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await p.mouse.down();
  const fx = from.x + from.width / 2, fy = from.y + from.height / 2, tx = to.x + to.width / 2, ty = to.y + to.height / 2;
  for (let k = 1; k <= 8; k++) await p.mouse.move(fx + (tx - fx) * k / 8, fy + (ty - fy) * k / 8);
  await p.mouse.up();
  await W(p, 40);
  const after = await D(p, () => __entiteDebug.state.cables.map((k) => k.socket));
  return { c, same: before.join() === after.join() };
}

async function readCyd2Hud(p) {
  return D(p, () => {
    const plate = document.querySelector('#serialPlate');
    const serialEl = document.querySelector('#serial');
    const readout = document.querySelector('#serialReadout');
    const btn = document.querySelector('#btnReplay');
    const cyd = document.querySelector('.cyd2');
    const screen = cyd?.querySelector('.screen');
    const batt = document.querySelector('#batt');
    const want = window.__entiteDebug?.run?.serial;
    const r = (el) => el ? el.getBoundingClientRect() : null;
    const overlap = (a, b) => !!(a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom));
    const visibleIn = (el, box) => {
      const q = r(el);
      if (!q || q.width < 1 || q.height < 1) return false;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) return false;
      if (!box) return true;
      const interW = Math.max(0, Math.min(q.right, box.right) - Math.max(q.left, box.left));
      const interH = Math.max(0, Math.min(q.bottom, box.bottom) - Math.max(q.top, box.top));
      return interW * interH > 0.6 * q.width * q.height;
    };
    const br = r(btn), sr = r(serialEl), scr = r(screen), btr = r(batt), rr = r(readout);
    const zoom = parseFloat(document.getElementById('face-mallette')?.style.zoom || '1') || 1;
    const grid = window.__entiteDebug?.mazeGrid?.() || null;
    const inter = (a, b) => {
      if (!a || !b) return 0;
      const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return w * h;
    };
    const se = document.scrollingElement || document.documentElement;
    const fontCss = serialEl ? parseFloat(getComputedStyle(serialEl).fontSize) || 0 : 0;
    return {
      plate: !!plate,
      lidReplay: !!document.querySelector('.lid #btnReplay, .lid-ctrls #btnReplay'),
      serialText: (serialEl?.textContent || '').trim(),
      want,
      inCyd: !!(cyd && serialEl && btn && cyd.contains(serialEl) && cyd.contains(btn)),
      mazeClass: !!cyd?.classList.contains('maze'),
      view: `${window.innerWidth}×${window.innerHeight}`,
      zoom: Math.round(zoom * 1000) / 1000,
      btnW: br ? Math.round(br.width * 100) / 100 : 0,
      btnH: br ? Math.round(br.height * 100) / 100 : 0,
      btnLabel: (btn?.textContent || '').replace(/\s+/g, ' ').trim(),
      serialVisible: visibleIn(serialEl, scr),
      btnVisible: visibleIn(btn, scr),
      battVisible: visibleIn(batt, scr),
      serialFontCss: Math.round(fontCss * 100) / 100,
      serialVisual: Math.round(fontCss * zoom * 100) / 100,
      serialH: sr ? Math.round(sr.height * 100) / 100 : 0,
      battPct: (document.querySelector('#battPct')?.textContent || '').trim(),
      overlapBattSerial: overlap(btr, sr),
      overlapBattBtn: overlap(btr, br),
      overlapMazeSerial: !!(grid && inter(grid, sr) > 0.25),
      overlapMazeBtn: !!(grid && inter(grid, br) > 0.25),
      mazeGrid: grid ? { w: Math.round(grid.right - grid.left), h: Math.round(grid.bottom - grid.top), n: grid.n } : null,
      mazeVisible: !!(grid && scr && grid.left >= scr.left - 1 && grid.right <= scr.right + 1 && grid.top >= scr.top - 1 && grid.bottom <= scr.bottom + 1 && (grid.right - grid.left) > 8 && (grid.bottom - grid.top) > 8),
      overflowY: Math.max(0, se.scrollHeight - se.clientHeight),
      overflowX: Math.max(0, se.scrollWidth - se.clientWidth),
    };
  });
}


// Cibles de toucher v0.3.1 : boîte réelle (elementFromPoint), en CSS px à zoom 1.
// Quand deux pièces sont plus proches que 44 px, la zone va jusqu'au milieu de l'écart (pas de chevauchement).
function hitProbeFn() {
  const zoom = parseFloat(document.getElementById('face-mallette')?.style.zoom || '1') || 1;
  const matches = (t, el, sel) => !!(t && (t === el || el.contains(t) || t.closest?.(sel) === el));
  const extents = (el, sel) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = (x, y) => {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
      return matches(document.elementFromPoint(x, y), el, sel);
    };
    const walk = (dx, dy) => {
      if (!hit(cx, cy)) return 0;
      let lo = 0, hi = 48 * zoom;
      while (lo + 0.25 < hi) { const m = (lo + hi) / 2; if (hit(cx + dx * m, cy + dy * m)) lo = m; else hi = m; }
      return lo;
    };
    const L = walk(-1, 0), R = walk(1, 0), U = walk(0, -1), D = walk(0, 1);
    return {
      w: Math.round(((L + R) / zoom) * 100) / 100,
      h: Math.round(((U + D) / zoom) * 100) / 100,
      x: Math.round(((cx - L) / zoom) * 100) / 100,
      y: Math.round(((cy - U) / zoom) * 100) / 100,
    };
  };
  const boxes = (sel) => [...document.querySelectorAll(sel)].map((el, i) => ({ sel, i, ...extents(el, sel) }));
  const all = [
    ...boxes('#coverArm, #coverTx'),
    ...boxes('#leverArm, #leverTx'),
    ...boxes('.enc .knob'),
    ...boxes('.trap'),
    ...boxes('.kp-key'),
    ...boxes('.lock-btn'),
    ...boxes('#btnReplay'),
    ...boxes('#jacks .plug'),
    ...boxes('.joy-dir'),
    ...boxes('#joyCap'),
  ];
  const skipOv = (a, b) => {
    const s = a.sel + ' ' + b.sel;
    // capot fermé recouvre son levier ; directions du joystick autour du capuchon
    if (/coverArm/.test(s) && /leverArm/.test(s)) return true;
    if (/coverTx/.test(s) && /leverTx/.test(s)) return true;
    if (a.sel.includes('joy-dir') && b.sel.includes('joyCap') || b.sel.includes('joy-dir') && a.sel.includes('joyCap')) return true;
    if (a.sel === b.sel && a.sel.includes('joy-dir')) return true;
    return false;
  };
  const overlap = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (skipOv(a, b)) continue;
    const ax2 = a.x + a.w, ay2 = a.y + a.h, bx2 = b.x + b.w, by2 = b.y + b.h;
    const iw = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
    const ih = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
    if (iw > 1.5 && ih > 1.5) overlap.push({ a: `${a.sel}#${a.i}`, b: `${b.sel}#${b.i}`, iw: +iw.toFixed(2), ih: +ih.toFixed(2) });
  }
  const view = `${innerWidth}×${innerHeight}`;
  const silk = (() => { const el = document.querySelector('.mod-enc > .silk'); if (!el) return null; const cs = getComputedStyle(el); return { text: (el.textContent || '').trim(), font: parseFloat(cs.fontSize) || 0, overflow: el.scrollWidth - el.clientWidth, clip: cs.overflow }; })();
  return { view, zoom, all, overlap, silk };
}

async function checkHits(p, rec, step, { coversClosed = false, leversOpen = false } = {}) {
  const r = await D(p, hitProbeFn);
  const note = [];
  const pick = (pred) => r.all.filter(pred);
  const fail = [];
  const report = (name, items, { minW = 44, minH = 44 } = {}) => {
    if (!items.length) { fail.push(`${name} : aucun`); return; }
    const bad = items.filter((x) => x.w + 0.25 < minW || x.h + 0.25 < minH);
    if (bad.length) fail.push(`${name} ${bad.map((x) => `${x.w}×${x.h}`).join(', ')} < ${minW}×${minH}`);
    else note.push(`${name} ${items.map((x) => `${x.w}×${x.h}`).join(', ')}`);
  };
  if (coversClosed) report('capots', pick((x) => /coverArm|coverTx/.test(x.sel)));
  if (leversOpen) report('leviers', pick((x) => /leverArm|leverTx/.test(x.sel) && x.h >= 20));
  report('molettes', pick((x) => x.sel.includes('.enc .knob')));
  report('trappes', pick((x) => x.sel === '.trap'));
  // clavier / serrures : pièces plus proches que 44 px, zone = milieu de l'écart
  const keys = pick((x) => x.sel === '.kp-key');
  const locks = pick((x) => x.sel === '.lock-btn');
  const packedOk = (items, minPitchW, minPitchH, label) => {
    const bad = items.filter((x) => x.w + 0.25 < minPitchW || x.h + 0.25 < minPitchH);
    if (!items.length) fail.push(`${label} : aucun`);
    else if (bad.length) fail.push(`${label} ${bad.map((x) => `${x.w}×${x.h}`).join(', ')} (min. écart ${minPitchW}×${minPitchH})`);
    else note.push(`${label} ${items[0].w}×${items[0].h} (×${items.length}, max. sans chevauchement)`);
  };
  const landV = /915×412|800×/.test(r.view) || r.view.startsWith('915');
  packedOk(keys, landV ? 40 : 36, landV ? 35 : 44, 'clavier');
  packedOk(locks, landV ? 39 : 35, 44, 'serrures');
  report('Réécouter', pick((x) => x.sel.includes('btnReplay')));
  if (r.overlap.length) fail.push(`chevauchement ${JSON.stringify(r.overlap.slice(0, 4))}`);
  if (r.silk && (r.silk.overflow > 1 || r.silk.font < 10)) fail.push(`sérigraphie molettes ${JSON.stringify(r.silk)}`);
  else if (r.silk) note.push(`sérigraphie « ${r.silk.text} » ${r.silk.font} px, débord ${r.silk.overflow}`);
  const ok = fail.length === 0;
  rec(ok, step, step, ok ? `cibles ${r.view} zoom ${r.zoom}  ${note.join(' · ')}` : `cibles ${r.view} ${fail.join(' | ')}`);
  return ok;
}

async function playOne(b, seed, opts) {
  const runInfo = makeRun(seed);
  const log = [];
  const rec = (ok, from, to, extra) => {
    const line = `${ok ? 'PASS' : 'FAIL'}  graine ${seed} (${runInfo.tier})  étape ${from} → ${to}${extra ? '  ' + extra : ''}`;
    log.push({ ok, from, to, extra, line });
    console.log('  ' + line);
    return ok;
  };

  const ctx = await b.newContext({
    viewport: VIEW, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block',
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('entite-tuto-vu', '1'); } catch {} });
  // Diagnostic machine lente (v0.5.0) : retard des minuteries de la page (setInterval 100 ms) et longues tâches.
  // Un retard > 3 s pendant Simon = minuteries gelées par le box (pas la logique du jeu). Rien n'est rejoué ni masqué.
  await ctx.addInitScript(() => {
    const lag = window.__timerLag = { max: 0, maxAt: 0, over3s: [], long: 0, longMax: 0 };
    let last = performance.now();
    setInterval(() => { const now = performance.now(), d = now - last - 100; last = now; if (d > lag.max) { lag.max = Math.round(d); lag.maxAt = Math.round(now); } if (d > 3000) lag.over3s.push([Math.round(now - d), Math.round(d)]); }, 100);
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { lag.long++; lag.longMax = Math.max(lag.longMax, Math.round(e.duration)); } }).observe({ type: 'longtask', buffered: true }); } catch { /* pas de longtask */ }
  });
  // Journal des barrettes côté page (v0.3) : quelle(s) barrette(s) allumée(s), et combien de LED au plus (K2000 ≤ 4).
  await ctx.addInitScript(() => {
    window.__stickLog = [];
    let prev = '';
    const tick = () => {
      try {
        const sticks = document.querySelectorAll('#jacks .stick');
        if (sticks.length && window.__entiteDebug?.state?.step === 3) {
          const lit = [], on = [];
          sticks.forEach((st, i) => { if (st.dataset.lit === '1') { lit.push(i); on.push(st.querySelectorAll('i.on').length); } });
          const key = lit.join(',');
          const maxOn = on.length ? Math.max(...on) : 0;
          const log = window.__stickLog;
          if (key !== prev) { prev = key; log.push({ t: performance.now(), lit, maxOn, phase: window.__entiteDebug.simon?.phase || '' }); }
          else if (log.length) log[log.length - 1].maxOn = Math.max(log[log.length - 1].maxOn, maxOn);
        }
      } catch { /* debug pas encore prêt */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // CI / --qa : pas de périphérique audio. On décode chaque mp3 en tampon silencieux très court
  // pour que playBuffer se termine tout de suite. voiceLog reste complet (mode mp3).
  if (ARGS.stubAudio) {
    await ctx.addInitScript(() => {
      const Orig = window.AudioContext || window.webkitAudioContext;
      if (!Orig) return;
      const Wrapped = function (...args) {
        const ac = new Orig(...args);
        ac.decodeAudioData = (data, success, error) => {
          try {
            const n = Math.max(8, Math.floor(ac.sampleRate * 0.04));
            const buf = ac.createBuffer(1, n, ac.sampleRate);
            if (typeof success === 'function') success(buf);
            return Promise.resolve(buf);
          } catch (e) {
            if (typeof error === 'function') error(e);
            return Promise.reject(e);
          }
        };
        return ac;
      };
      Wrapped.prototype = Orig.prototype;
      window.AudioContext = Wrapped;
      window.webkitAudioContext = Wrapped;
    });
  }
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  p.on('pageerror', (e) => errs.push('page:' + e.message));

  const url = `${base}?debug=1&seed=${seed}&voix=rapide&notuto=1${opts.realSimon ? '' : '&simon=rapide'}`;
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#btnStart:not([disabled])', { timeout: 45000 });
  await p.waitForSelector('#boot', { state: 'hidden' });

  const ver = await D(p, () => document.querySelector('#ver')?.textContent);
  const liveRun = await D(p, () => ({ seed: __entiteDebug.run.seed, tier: __entiteDebug.run.tier, sig: __entiteDebug.run.sig, v: { ...__entiteDebug.run.v } }));
  console.log(`  version ${ver}  sig ${liveRun.sig}`);
  if (liveRun.seed !== seed || liveRun.tier !== runInfo.tier) {
    rec(false, '—', '—', `graine/palier mismatch local=${seed}/${runInfo.tier} live=${liveRun.seed}/${liveRun.tier}`);
    await ctx.close();
    return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs };
  }

  const extras = { replay: null, hintSeq: null, hintOther: null, wrong: [], voice: 0, hud: 0, simon: null };

  const LANDSCAPE = { width: 915, height: 412 };
  const setView = async (size) => {
    await p.setViewportSize(size);
    await D(p, () => { window.dispatchEvent(new Event('resize')); });
    await W(p, 220);
  };

  const checkHudOnce = async (step, maze, label) => {
    const info = await readCyd2Hud(p);
    const land = (info.view || '').startsWith('915');
    let ok = !info.plate && !info.lidReplay && info.inCyd
      && info.serialText === info.want && /^[0-9]{2}-[0-9]{2}$/.test(info.serialText) && new Set(info.serialText.replace('-', '')).size === 4
      && info.serialVisible && info.btnVisible && info.battVisible
      && info.btnW >= 44 && info.btnH >= 44
      && /RÉÉCOUTER|RÉECOUTER/i.test(info.btnLabel)
      && info.mazeClass === maze
      && !info.overlapBattSerial && !info.overlapBattBtn
      && /%/.test(info.battPct)
      && info.overflowY === 0 && info.overflowX === 0;
    if (maze) {
      ok = ok && !!info.mazeGrid && info.mazeVisible && !info.overlapMazeSerial && !info.overlapMazeBtn;
      if (land) ok = ok && info.serialVisual >= 11 && info.serialH >= 11;
    }
    rec(ok, step, step, ok
      ? `CYD 2 ${label} n° ${info.serialText} + RÉÉCOUTER ${info.btnW}×${info.btnH} px réel${maze ? `, grille ${info.mazeGrid?.w}×${info.mazeGrid?.h}, n° ${info.serialVisual} px` : ''}, batterie ${info.battPct}`
      : `CYD 2 HUD ${label} ${JSON.stringify(info)}`);
    if (ok) extras.hud = (extras.hud || 0) + 1;
    return ok;
  };

  const hud = async (step, maze = false) => {
    if (!(await checkHudOnce(step, maze, '412×915'))) return false;
    if (maze || step === 3) {
      await setView(LANDSCAPE);
      const okL = await checkHudOnce(step, maze, '915×412');
      await setView(VIEW);
      if (!okL) return false;
      if (!(await checkHudOnce(step, maze, '412×915-retour'))) return false;
    }
    return true;
  };

  const fail = async (from, to, why) => {
    const now = await snap(p);
    rec(false, from, to, `${why}  état=${JSON.stringify(now)}`);
    return false;
  };

  const tNow = () => D(p, () => Math.round(performance.now()));
  const expectAdvance = async (from, to, why, t0) => {
    const s = await waitAdvance(p, from);
    const ok = (to === 'fin') ? (s.phase === 'win' || s.endVisible) : (s.step === to || (to === 1 && s.phase === 'play' && s.step === 1));
    if (!ok) { await fail(from, to, why); return null; }
    const tGood = await D(p, () => Math.round(__entiteDebug.state.lastGoodAt || 0));
    const tSuccess = tGood || t0 || await tNow();
    const v = await assertVoiceMoved(p, runInfo, from, to, tSuccess);
    if (!v.ok) { rec(false, from, to, `${why || s.label}  ${v.why}`); return null; }
    rec(true, from, to, `${why || s.label}  voix ${v.heads}`);
    extras.voice = (extras.voice || 0) + 1;
    return s;
  };

  // ---- étape 0 : armement
  await p.tap('#btnStart'); await W(p, 300);
  let s = await snap(p);
  if (s.phase !== 'arm-toggle') {
    rec(false, 0, 1, `attendu arm-toggle, obtenu ${JSON.stringify(s)}`);
    await ctx.close();
    return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, s };
  }
  if (!(await hud(0, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await checkHits(p, rec, 0, { coversClosed: true }))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  await p.tap('#coverArm'); await W(p, 120);
  const tArm = await tNow();
  await p.tap('#leverArm');
  if (!(await expectAdvance(0, 1, 'armement', tArm))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs }; }
  if (!(await hud(1, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // v0.3 : le CYD 2 montre les 5 lettres COURANTES des molettes (pas la réponse)
  const cydLetters = async (step) => {
    const r = await D(p, () => ({ knobs: [...document.querySelectorAll('.enc .knob')].map((k) => /lettre (\w)/.exec(k.getAttribute('aria-valuetext') || '')?.[1] || '').join(''),
      shown: (document.querySelector('#cyd2Big')?.textContent || '').trim(), mode: document.querySelector('.cyd2')?.dataset.big, n: document.querySelectorAll('.enc .knob').length }));
    const ok = r.n === NENC && r.mode === 'letters' && r.shown === r.knobs && r.shown.length === NENC;
    rec(ok, step, step, ok ? `CYD 2 lettres courantes ${r.shown} (5 molettes)` : `CYD 2 lettres ${JSON.stringify(r)}`);
    return ok;
  };
  if (!(await cydLetters(1))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  // levier ARM ouvert (capot relevé) ; TRANSMIT encore fermé : on ouvre son capot le temps de mesurer, puis on referme
  await p.tap('#coverTx'); await W(p, 80);
  if (!(await checkHits(p, rec, 1, { leversOpen: true }))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const view0 = p.viewportSize();
  await p.setViewportSize({ width: 915, height: 412 }); await W(p, 250);
  if (!(await checkHits(p, rec, 1, { leversOpen: true }))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  await p.setViewportSize(view0); await W(p, 250);
  await p.tap('#coverTx'); await W(p, 80);
  await p.waitForFunction(() => (document.querySelector('#cyd2Big')?.textContent || '').trim().length === 5, { timeout: 4000 }).catch(() => {});

  const answers = await D(p, () => {
    const r = __entiteDebug.run, RING = __entiteDebug.RING;
    return {
      enc1: r.enc1.map((i) => RING[i]),
      word1: r.word1, scramble: r.scramble, theme: r.theme, word: r.word,
      enc2: r.enc2.map((i) => RING[i]),
      trap: r.trap,
      simon: { ...r.simon, seq: r.simon.seq.slice() },
      bar: r.bar.slice(), counts: r.counts.slice(),
      code1: r.code1,
      code2: r.code2,
      patch1: r.patch1.req,
      patch2: r.patch2.req,
      keyOrder: r.keyOrder,
      v: { ...r.v },
    };
  });

  // v0.4 (plan v0.8) : exactement 2 trappes A B et 2 serrures I II, rien d'autre sur la base
  {
    const pc = await D(p, () => ({
      traps: [...document.querySelectorAll('#traps .trap')].map((t) => t.querySelector('.trap-n')?.textContent.trim()),
      trapAria: [...document.querySelectorAll('#traps .trap-door')].map((b) => b.getAttribute('aria-label').split(',')[0]),
      locks: [...document.querySelectorAll('#keyRow .lock.key')].map((l) => l.querySelector('.silk')?.textContent.trim()),
      lockAria: [...document.querySelectorAll('#keyRow .lock-btn')].map((b) => b.getAttribute('aria-label')),
      encs: document.querySelectorAll('#encRow .enc').length,
      stepKeys: __entiteDebug.STEPS ? __entiteDebug.STEPS[7]?.title : null,
    }));
    const pok = pc.traps.join() === 'A,B' && pc.trapAria.join() === 'Trappe A,Trappe B' && pc.locks.join() === 'I,II' && pc.lockAria.join() === 'Serrure I,Serrure II'
      && pc.encs === 5 && (answers.trap === 0 || answers.trap === 1) && answers.keyOrder.length === 2 && [...answers.keyOrder].sort().join() === '0,1'
      && (pc.stepKeys === null || pc.stepKeys === 'Clés I · II');
    rec(pok, 0, 0, pok ? 'pièces v0.4 : trappes A B, serrures I II, 5 molettes' : `pièces v0.4 ${JSON.stringify({ pc, trap: answers.trap, keyOrder: answers.keyOrder })}`);
    if (!pok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }

  // ---- 1 encodeurs (+ indice sur une partie sur deux)
  if (opts.hintOther) {
    await p.tap('#btnHint'); await W(p, 200);
    s = await snap(p);
    const hok = s.step === 1 && s.hint >= 1;
    rec(hok, 1, 1, hok ? 'indice 1 (encodeurs)' : `indice 1 n'a pas pris ${JSON.stringify(s)}`);
    extras.hintOther = { step: 1, ok: hok };
    if (!hok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }
  // v0.5.0 « mot mêlé » : le CYD 2 montre les 5 lettres MÉLANGÉES (anagramme du mot, jamais le mot), le mot n'est écrit
  // nulle part (CYD 2, bandeau, aria), molettes = lettres A–V, mot 1 ≠ mot 8 ; un essai presque juste : moyen = score 4/5
  // et −5 s ; difficile = pas de score et −8 s.
  {
    const srt = (w) => [...w].sort().join('');
    // HUD lu élément par élément : « MÊLÉ LFUSI » + molettes « LRCHL » collés formeraient FUSIL, pas à l'écran
    const mel = await D(p, () => ({ sub: (document.querySelector('#cyd2Sub .mel')?.textContent || '').trim(),
      hud: [...(document.querySelector('#cyd2Hud')?.querySelectorAll('*') || [])].filter((e) => !e.children.length).map((e) => e.textContent.trim()).join(' | '), strip: (document.querySelector('#objText')?.textContent || '') + ' ' + (document.querySelector('.strip')?.textContent || ''),
      aria: [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join(' | ') }));
    const w = answers.word1;
    const okMel = mel.sub.length === 5 && mel.sub !== w && srt(mel.sub) === srt(w) && mel.sub === answers.scramble
      && !mel.hud.includes(w) && !mel.strip.includes(w) && !mel.aria.includes(w)
      && /^[A-V]{5}$/.test(w) && answers.word !== w && answers.enc1.join('') === w;
    rec(okMel, 1, 1, okMel ? `mot mêlé : ${mel.sub} affiché (thème ${answers.theme}), mot jamais écrit, mot 8 différent` : `mot mêlé ${JSON.stringify({ mel: mel.sub, w, word8: answers.word, thud: mel.hud.slice(0, 80) })}`);
    if (!okMel) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    const near = answers.enc1.slice(); near[4] = RING[(RING.indexOf(near[4]) + 1) % DETENTS];
    const e0 = await D(p, () => ({ e: __entiteDebug.state.errors, r: __entiteDebug.state.remaining }));
    await rotateTo(p, near); await W(p, 250);
    const e1 = await D(p, () => ({ e: __entiteDebug.state.errors, r: __entiteDebug.state.remaining, step: __entiteDebug.state.step,
      strip: (document.querySelector('#objText')?.textContent || '').trim(),
      score: (document.querySelector('#cyd2Sub .score')?.textContent || '').trim() }));
    const moy = answers.v.enc1 === 'theme', pen = moy ? 5 : 8;
    const okN = e1.step === 1 && e1.e === e0.e + 1 && e1.strip === `−${pen} s` && e0.r - e1.r >= pen - 0.5 && (moy ? e1.score === '4/5' : e1.score === '');
    rec(okN, 1, 1, okN ? `mot mêlé presque juste : faux, −${pen} s${moy ? ', score 4/5' : ', sans score'}` : `mot mêlé essai raté ${JSON.stringify({ e0, e1, moy })}`);
    if (!okN) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }
  const t1 = await tNow();
  await rotateTo(p, answers.enc1);
  if (!(await expectAdvance(1, 2, `lettres ${answers.enc1.join('')}`, t1))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(2, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 2 trappe
  // Journal rAF dans la page : on ne lit la 1re séquence qu'après l'assertion de voix,
  // pour ne pas concurrencer les evaluate (sinon la 1re DEL peut être lue à 0).
  {
    // l'œil rouge (mensonge) fait grésiller les LED : on lit les barrettes hors mensonge (plusieurs essais)
    let hv = [];
    // v0.5.2 difficile : les barrettes s'éteignent 5 s après la consigne ; on les garde allumées le temps de la lecture
    // (le noir et Réécouter −5 s sont vérifiés juste après)
    if (runInfo.tier === 'difficile') { await p.waitForFunction(() => __entiteDebug.barsStarted(), null, { timeout: 30000 }).catch(() => {}); await D(p, () => __entiteDebug.ageBars(-600000)); }
    for (let k = 0; k < 24; k++) {
      await p.waitForFunction(() => performance.now() > (__entiteDebug.state.lieUntil || 0) + 150, null, { timeout: 8000 }).catch(() => {});
      const snap = await D(p, () => { const g = __entiteDebug.state; const clean = performance.now() > (g.lieUntil || 0) + 150; const v = [...document.querySelectorAll('#jacks .stick')].flatMap((st) => { const L = [...st.querySelectorAll('i')]; return [L.slice(0, 4), L.slice(4)].map((h) => { const c = h.map((e) => (e.classList.contains('on') ? e.style.getPropertyValue('--c').trim() : '')); return c.every((x) => x && x === c[0]) ? c[0] : '?'; }); }); return { clean, v }; });
      hv = snap.v;
      if (snap.clean && !hv.includes('?')) break;
      await p.waitForTimeout(250);
    }
    const want = await D(p, () => { const LEDc = { rouge: '#ff3b30', vert: '#36f08a', bleu: '#3d8bff' }; return __entiteDebug.run.bar.map((c) => LEDc[c]); });
    const counts = Object.values(hv.reduce((m, c) => ((m[c] = (m[c] || 0) + 1), m), {})).sort((a, b) => b - a);
    const ok = hv.length === 10 && hv.join() === want.join() && counts.length === 3 && new Set(counts).size === 3 && counts.join() === answers.counts.join();
    rec(ok, 2, 2, ok ? `5 barrettes, 10 moitiés, comptes ${counts.join('/')}` : `barrettes étape 2 ${JSON.stringify({ hv, want, counts })}`);
    if (!ok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }
  {
    // v0.5.2 : difficile = noir après 5 s, Réécouter rallume (−5 s) ; moyen = toujours allumées
    await D(p, () => __entiteDebug.ageBars(600000 + 6000));
    await W(p, 200);
    const lit = () => D(p, () => (__entiteDebug.stickColors() || []).filter(Boolean).length);
    const n0 = await lit();
    let okB = runInfo.tier === 'difficile' ? n0 === 0 : n0 === 5, why = { n0 };
    if (okB && runInfo.tier === 'difficile') {
      const e0 = await D(p, () => __entiteDebug.state.errors), r0 = await D(p, () => __entiteDebug.state.remaining);
      await p.locator('#btnReplay').click({ force: true });
      await W(p, 250);
      const n1 = await lit(), e1 = await D(p, () => __entiteDebug.state.errors), r1 = await D(p, () => __entiteDebug.state.remaining);
      const ob = await D(p, () => document.querySelector('#objText')?.textContent || '');
      Object.assign(why, { n1, e0, e1, cost: r0 - r1, ob });
      okB = n1 === 5 && e1 === e0 && r0 - r1 >= 4.9 && r0 - r1 < 7 && /−5 s/.test(ob);
    }
    rec(okB, 2, 2, okB ? (runInfo.tier === 'difficile' ? 'barrettes noires après 5 s, Réécouter les rallume (−5 s, sans erreur)' : 'moyen : barrettes allumées en continu') : `barrettes trappe noir/Réécouter ${JSON.stringify(why)}`);
    if (!okB) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    // mauvaise trappe au joystick : SG90 secoue la porte dans les limites d'Électronique, puis l'erreur
    const wrong = 1 - answers.trap;
    await p.tap(`#joy .joy-dir.${wrong === 0 ? 'left' : 'right'}`);
    await W(p, 120);
    const sel = await D(p, () => [...document.querySelectorAll('#traps .trap')].map((t) => t.classList.contains('sel')));
    const e0 = await D(p, () => __entiteDebug.state.errors);
    await p.tap('#joy .joy-well');
    await W(p, 60);
    const mid = await D(p, () => ({ shaking: __entiteDebug.shaking, e: __entiteDebug.state.errors }));
    await p.waitForFunction(() => __entiteDebug.shakeLog().length >= 1, null, { timeout: 5000 }).catch(() => {});
    await W(p, 150);
    const sh = await D(p, () => __entiteDebug.shakeLog()), e1 = await D(p, () => __entiteDebug.state.errors);
    const open = await D(p, () => [...document.querySelectorAll('#traps .trap')].map((t) => t.classList.contains('open')));
    const S = sh[0] || {};
    const okS = sel[wrong] && !sel[1 - wrong] && mid.shaking && mid.e === e0 && sh.length === 1 && S.i === wrong && S.deg >= 5 && S.deg <= 8 && S.cycles <= 3 && S.stepMs >= 80 && S.stepMs <= 120
      && S.ledMax <= 0.3 && !S.speaking && !S.open && S.ms >= 650 && e1 === e0 + 1 && !open[0] && !open[1];
    rec(okS, 2, 2, okS ? `joystick ${'AB'[wrong]} + appui : mauvaise trappe tremble (±${S.deg}°, ${S.cycles} cycles, ${S.stepMs} ms, DEL ≤ ${S.ledMax}, sans voix), puis −5 s` : `tremblement trappe ${JSON.stringify({ sel, mid, sh, e0, e1, open })}`);
    if (!okS) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    await W(p, 700);
    await p.tap(`#joy .joy-dir.${answers.trap === 0 ? 'left' : 'right'}`);
    await W(p, 80);
  }
  const t2 = await tNow();
  await p.tap('#joy .joy-well');   // v0.5.2 : bonne trappe choisie au joystick (gauche = A, droite = B), appui = ouvrir
  if (!(await expectAdvance(2, 3, `trappe ${"AB"[answers.trap]} au joystick`, t2))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(3, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 3 Simon : chaque tour, vérifier la série jouée (K2000), puis la reproduire aux prises
  const SM = answers.simon, rounds = SM.target - SM.start + 1;
  const sOk = SM.start === (runInfo.tier === 'moyen' ? 2 : 3) && SM.target === (runInfo.tier === 'moyen' ? 5 : 6) && SM.seq.length === SM.target && SM.seq.every((k) => k >= 0 && k < 5);
  rec(sOk, 3, 3, sOk ? `Simon ${runInfo.tier} : tours ${SM.start}→${SM.target}, série ${SM.seq.map((k) => k + 1).join('-')}` : `Simon mal tiré ${JSON.stringify(SM)}`);
  if (!sOk) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const kbd = await D(p, () => { const before = __entiteDebug.state.errors; return { before }; });
  const simonFail = async (why) => { const lg = await D(p, () => window.__timerLag).catch(() => null); await fail(3, 3, `${why}  minuteries=${JSON.stringify(lg)}`); await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; };
  const sx = { rounds: 0, replay: false, hint: false, wrong: false, ignored: false, timeout: false, drag: false, repeat: false, timing: [] };
  // attendre une lecture complète du tour r (n-ième lecture) et vérifier les impulsions
  const checkPlay = async (r, minPlays, label) => {
    const w = await waitSimon(p, (s) => s.round === r && s.phase === 'input' && s.plays >= minPlays, 40000);
    if (w.s && w.s.wd) return { ok: false, why: `${label} : filet de lecture déclenché (${w.s.wd}×) trace=` + JSON.stringify(await D(p, () => (window.__simonTrace || []).slice(-30))) };
    if (!w.s || w.timeout || w.gone) return { ok: false, why: `${label} : pas de saisie au tour ${r + 1} ${JSON.stringify(w)}` };
    const want = SM.seq.slice(0, SM.start + r);
    const pulses = await pulsesSince(p, w.s.t0);
    const got = pulses.map((e) => e.s);
    const k2000 = pulses.every((e) => e.s >= 0 && e.maxOn >= 1 && e.maxOn <= SIMON.TAIL + 1);
    // série jouée par l'app (journal des temps) = exacte ; ce qu'on voit sur les barrettes (journal rAF) = la même série,
    // une impulsion peut manquer si le navigateur saute des images (machine chargée), jamais une barrette en trop
    const played = w.s.played || [];
    const subseq = got.length > 0 && (() => { let q = 0; for (const k of got) { while (q < want.length && want[q] !== k) q++; if (q === want.length) return false; q++; } return true; })();
    const seen = got.length >= Math.max(1, want.length - 1);
    if (got.join() !== want.join()) sx.missedPulses = (sx.missedPulses || 0) + (want.length - got.length);
    const ok = played.join() === want.join() && subseq && seen && k2000;
    return { ok, s: w.s, why: ok ? '' : `${label} : app ${played.map((k) => k + 1).join('-') || '∅'}, vu ${got.map((k) => k + 1).join('-') || '∅'} ≠ ${want.map((k) => k + 1).join('-')}  ${JSON.stringify(pulses)}` };
  };
  const errorsNow = () => D(p, () => __entiteDebug.state.errors);
  const remainingNow = () => D(p, () => __entiteDebug.state.remaining);
  for (let r = 0; r < rounds; r++) {
    let cp = await checkPlay(r, 1, `tour ${r + 1}`);
    if (!cp.ok) { const tr = await D(p, () => (window.__simonTrace || []).slice(-25)); return simonFail(cp.why + ' trace=' + JSON.stringify(tr)); }
    const len = SM.start + r;
    // texte du CYD 2
    const cyd = await D(p, () => (document.querySelector('#cyd2Big')?.textContent || '').trim());
    const revR = runInfo.tier === 'difficile' && r === rounds - 1;   // v0.5.1 : dernier tour à l'envers en difficile
    const cydWant = `SIMON ${r + 1}/${rounds}${revR ? ' ↺' : ''}`;
    if (cyd !== cydWant) return simonFail(`CYD 2 « ${cyd} » ≠ ${cydWant}`);
    sx.timing.push(cp.s.rounds[r]);
    if (r === 0) {
      // Réécouter pendant la saisie : même série, sans pénalité
      const e0 = await errorsNow(), plays0 = cp.s.plays;
      await p.locator('#btnReplay').click({ force: true });
      const cr = await checkPlay(0, plays0 + 1, 'Réécouter');
      const e1 = await errorsNow();
      sx.replay = cr.ok && e1 === e0;
      rec(sx.replay, 3, 3, sx.replay ? `Réécouter : même série ${SM.seq.slice(0, len).map((k) => k + 1).join('-')}, sans pénalité` : `${cr.why} erreurs ${e0}→${e1}`);
      extras.replay = { ok: sx.replay };
      if (!sx.replay) return simonFail('Réécouter Simon');
      cp = cr;
      if (opts.hintSeq) {
        const e2 = await errorsNow(), pl = cr.s.plays;
        await p.tap('#btnHint');
        const ch = await checkPlay(0, pl + 1, 'indice 1');
        const hs = await snap(p);
        sx.hint = ch.ok && hs.hint >= 1 && hs.errors === e2;
        rec(sx.hint, 3, 3, sx.hint ? 'indice 1 : le tour se rejoue, sans pénalité' : `${ch.why} ${JSON.stringify(hs)}`);
        extras.hintSeq = { ok: sx.hint };
        if (!sx.hint) return simonFail('indice Simon');
        cp = ch;
      }
      if (opts.simonTimeout) {
        // trop lent pour le 1er toucher : faux, −8 s, le tour se rejoue
        const e3 = await errorsNow(), pl = cp.s.plays;
        const wt = await waitSimon(p, (s) => s.timeouts >= 1, SM.first + 4000);
        const ct = await checkPlay(0, pl + 1, 'après délai');
        const e4 = await errorsNow();
        sx.timeout = !!wt.s && !wt.timeout && ct.ok && e4 === e3 + 1;
        rec(sx.timeout, 3, 3, sx.timeout ? `trop lent (${SM.first / 1000} s) : faux, le tour 1 se rejoue` : `délai Simon ${JSON.stringify({ wt, why: ct.why, e3, e4 })}`);
        if (!sx.timeout) return simonFail('délai Simon');
        cp = ct;
      }
    }
    if (r === 1) {
      // mauvaise prise : −8 s, on rejoue le tour (pas de retour à 2), puis toucher pendant la lecture = ignoré
      const e0 = await errorsNow(), rem0 = await remainingNow(), pl = cp.s.plays;
      await touchJack(p, (SM.seq[0] + 1) % 5);
      await W(p, 80);
      const st = await snap(p), si = await simonInfo(p), rem1 = await remainingNow();
      const okW = st.step === 3 && st.errors === e0 + 1 && si.round === 1 && si.len === len && rem0 - rem1 >= SIMON.PENALTY_S - 0.5;
      // pendant la relecture, toucher la bonne prise ne compte pas
      const wp = await waitSimon(p, (s) => s.phase === 'play' && s.plays > pl, 6000);
      const ig0 = wp.s?.ignored ?? 0;
      if (wp.s) await touchJack(p, SM.seq[0]);
      const si2 = await simonInfo(p);
      const okI = !!wp.s && si2.ignored === ig0 + 1 && si2.input === 0 && (await errorsNow()) === e0 + 1;
      const cw = await checkPlay(1, pl + 1, 'après erreur');
      sx.wrong = okW && cw.ok; sx.ignored = okI;
      if (!(okW && cw.ok)) cw.why = (cw.why || '') + ' trace=' + JSON.stringify(await D(p, () => (window.__simonTrace || []).slice(-30)).catch(() => null));
      rec(okW && cw.ok, 3, 3, okW && cw.ok ? `mauvaise prise ${(SM.seq[0] + 1) % 5 + 1} : −${SIMON.PENALTY_S} s, le tour ${len} se rejoue` : `mauvaise prise ${JSON.stringify({ st, si, rem0, rem1, why: cw.why })}`);
      rec(okI, 3, 3, okI ? 'toucher pendant la lecture : ignoré' : `toucher pendant la lecture compté ${JSON.stringify({ wp, si2 })}`);
      extras.wrong.push({ step: 3, ok: okW && cw.ok && okI });
      if (!(okW && cw.ok && okI)) return simonFail('erreur Simon');
      cp = cw;
    }
    // reproduire la série : vraies touches (et un glisser au dernier tour, une partie sur trois)
    const want = revR ? SM.seq.slice(0, len).reverse() : SM.seq.slice(0, len);
    if (revR) {
      const vr = await D(p, () => (__entiteDebug.voiceLog || []).some((v) => (v.ids || []).includes('simon_envers')));
      rec(vr, 3, 3, vr ? `dernier tour à l’envers annoncé (simon_envers), réponse ${want.map((k) => k + 1).join('-')}` : 'simon_envers jamais dit');
      if (!vr) return simonFail('envers non annoncé');
      sx.reversed = true;
    }
    const tRight = await tNow();
    const touchT = [];   // horodatage page de chaque toucher (diagnostic machine lente)
    for (let i = 0; i < want.length; i++) {
      touchT.push(Math.round(await tNow()));
      if (r === rounds - 1 && i === 0 && opts.simonDrag) {
        const d = await dragToJack(p, want[i]);
        sx.drag = d.same;
        if (!d.same) return simonFail(`glisser : la fiche n'est pas revenue ${JSON.stringify(d)}`);
      } else await touchJack(p, want[i]);
      if (i > 0 && want[i] === want[i - 1]) sx.repeat = true;
      await W(p, 60);
    }
    if (r < rounds - 1) {
      const nx = await waitSimon(p, (s) => s.round === r + 1, 6000);
      if (!nx.s || nx.timeout) return simonFail(`tour ${r + 1} réussi mais pas de tour ${r + 2} ${JSON.stringify(nx)} touches=${JSON.stringify(touchT)} trace=${JSON.stringify(await D(p, () => (window.__simonTrace || []).slice(-12)))}`);
      sx.rounds++;
    } else {
      sx.rounds++;
      extras.simon = sx;
      if (!(await expectAdvance(3, 4, `Simon ${rounds} tours (${SM.seq.map((k) => k + 1).join('-')})`, tRight))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    }
  }
  {
    // durées : moyen constantes (36 / 200 ms), difficile ×0,88 par tour, planchers 20 / 120 ms
    const tm = sx.timing.map((x) => `${x.step}/${x.gap}`);
    const okT = sx.timing.every((x, i) => {
      if (runInfo.tier === 'moyen') return x.step === SIMON.STEP_MS && x.gap === SIMON.GAP_MS;
      const f = Math.pow(SIMON.SPEEDUP, i);
      return x.step === Math.max(SIMON.STEP_MIN, Math.round(SIMON.STEP_MS * f)) && x.gap === Math.max(SIMON.GAP_MIN, Math.round(SIMON.GAP_MS * f)) && (i === 0 || x.step <= sx.timing[i - 1].step);
    });
    rec(okT, 3, 3, okT ? `durées K2000 par tour ${tm.join(' ')} ms${opts.realSimon ? ' (vitesse réelle)' : ''}${sx.repeat ? ', barrette répétée acceptée' : ''}${sx.drag ? ', glisser compté (fiche revenue)' : ''}` : `durées ${tm.join(' ')}`);
    if (!okT) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }
  if (!(await hud(4, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  {
    const vn = await D(p, () => (__entiteDebug.voiceLog || []).some((v) => (v.ids || []).includes('simon_notes')));
    const rv = runInfo.tier !== 'difficile' || !!extras.simon?.reversed;
    rec(vn && rv, 3, 4, vn && rv ? `Simon : « Écoute les notes » dit${runInfo.tier === 'difficile' ? ', dernier tour joué à l’envers' : ''}` : `Simon v0.5.1 ${JSON.stringify({ vn, rv })}`);
    if (!(vn && rv)) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }
  // ---- 4 baie : v0.5.1 chaque barrette au-dessus d'une prise branchée a la couleur du câble (noir → violet)
  {
    await W(p, 200);
    const st = await D(p, () => ({ cols: __entiteDebug.stickColors(), cables: __entiteDebug.state.cables.map((k) => ({ color: k.color, socket: k.socket })), SC: __entiteDebug.STICK_COLORS }));
    const map = { noir: st.SC[0], bleu: st.SC[1], vert: st.SC[2], rouge: st.SC[3], jaune: st.SC[4] };
    const okC = !!st.cols && [0, 1, 2, 3, 4].every((s) => { const c = st.cables.find((k) => k.socket === s); const x = st.cols[s]; return c ? (x && x.n === 8 && x.col === map[c.color]) : !x; });
    rec(okC, 4, 4, okC ? `barrettes = couleur du câble branché (${st.cables.map((k) => k.color).join(',')})` : `barrettes câbles ${JSON.stringify(st)}`);
    if (!okC) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    // fiche fautive (le leurre de l'Entité) : éclair rouge sur la barrette de la prise, une erreur, les câbles reviennent
    const w = answers.decoys?.wire1 || await D(p, () => __entiteDebug.run.decoys.wire1);
    const before = await D(p, () => __entiteDebug.state.cables.map((k) => k.socket)), e0 = await D(p, () => __entiteDebug.state.errors);
    const already = before[w.cable] === w.socket;   // le câble y est déjà : toucher = débrancher, pas une faute
    let fl = null, after = before;
    if (!already) {
      await p.tap(`#ports .port-btn[data-c="${w.cable}"]`); await W(p, 60);
      await p.tap(`#jacks .jack[data-s="${w.socket}"] .plug`); await W(p, 30);
      for (let k = 0; k < 24; k++) {   // les barrettes se redessinent ~12 fois/s : attendre l'éclair (≤ 600 ms)
        fl = await D(p, (s) => ({ col: __entiteDebug.stickColors()?.[s], err: __entiteDebug.state.errors }), w.socket);
        if (fl.col?.col === '#ff3b30') break;
        await W(p, 25);
      }
      await W(p, 1200);
      after = await D(p, () => __entiteDebug.state.cables.map((k) => k.socket));
    }
    const okF = already || (fl.col?.col === '#ff3b30' && fl.err === e0 + 1 && after.join() === before.join());
    rec(okF, 4, 4, okF ? (already ? 'fiche fautive : leurre déjà en place, non testé' : `fiche fautive ${w.cable + 1}→prise ${w.socket + 1} : éclair rouge, −8 s, câbles remis`) : `fiche fautive ${JSON.stringify({ w, fl, e0, before, after })}`);
    if (!okF) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }
  const t4 = await tNow();
  await doPatch(p, answers.patch1);
  if (!(await expectAdvance(4, 5, `patch ${JSON.stringify(answers.patch1)}`, t4))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 5 labyrinthe : n° + RÉÉCOUTER restent dans le coin, bouton utilisable
  if (!(await hud(5, true))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  await p.waitForFunction(() => !document.querySelector('#btnReplay')?.disabled, { timeout: 8000 }).catch(() => {});
  const nVoix5 = await D(p, () => (__entiteDebug.voiceLog || []).length);
  await p.locator('#btnReplay').click({ force: true });
  await W(p, 250);
  const mazeReplay5 = await D(p, (n) => {
    const log = (__entiteDebug.voiceLog || []).slice(n);
    return log.some((v) => (v.ids || []).some((id) => /verrou|clue_|obj_/.test(id)));
  }, nVoix5);
  rec(!!mazeReplay5, 5, 5, mazeReplay5 ? 'Réécouter pendant le labyrinthe' : `Réécouter labyrinthe muet  log=${JSON.stringify(await D(p, (n) => (__entiteDebug.voiceLog || []).slice(n).map((v) => v.ids), nVoix5))}`);
  if (!mazeReplay5) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(5, true))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t5 = await tNow();
  if (!(await doMaze(p))) { await fail(5, 6, 'labyrinthe bloqué'); await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await expectAdvance(5, 6, 'labyrinthe', t5))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(6, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 6 code 1
  const w6 = await wrongThenRight(p, answers.code1, 6);
  extras.wrong.push({ step: 6, ...w6 });
  rec(w6.ok, 6, 6, w6.ok ? `faux ${w6.bad} puis bon ${w6.want}` : w6.why);
  if (!w6.ok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t6 = w6.tRight ?? await tNow();
  if (!(await expectAdvance(6, 7, `code ${answers.code1}`, t6))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(7, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 7 clés (v0.5.2 « deux clés, deux mains ») : clé I derrière la trappe A, clé II derrière la B, debout à gauche
  {
    const bail = async (ok, msg, okMsg) => { rec(ok, 7, 7, ok ? okMsg : msg); return ok; };
    const geo = await D(p, () => [0, 1].map((k) => { const b = document.querySelector(`.cle-chant[data-k="${k}"]`); if (!b) return null; const t = b.closest('.trap'), r = b.querySelector('.cle-fente').getBoundingClientRect(), R = t.getBoundingClientRect(), B = b.getBoundingClientRect();
      return { trap: +t.dataset.i, aria: b.getAttribute('aria-label'), left: r.left + r.width / 2 < R.left + R.width / 3, tall: r.height > r.width * 2, w: Math.round(B.width), h: Math.round(B.height) }; }));
    const okG = geo.every((x, k) => x && x.trap === k && x.aria === `Prendre la clé ${['I', 'II'][k]}` && x.left && x.tall && x.w >= 44 && x.h >= 40);
    if (!(await bail(okG, `clés dans les trappes ${JSON.stringify(geo)}`, 'clé I dans A, clé II dans B, debout sur la tranche à gauche'))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    // serrure sans clé : rien (pas d'erreur), le bandeau dit où est la clé
    const e0 = await D(p, () => __entiteDebug.state.errors);
    await p.tap('.lock.key[data-key="0"] .lock-btn'); await W(p, 120);
    const nk = { e: await D(p, () => __entiteDebug.state.errors), ob: await D(p, () => document.querySelector('#objText')?.textContent || '') };
    if (!(await bail(nk.e === e0 && /trappe A/.test(nk.ob), `serrure sans clé ${JSON.stringify(nk)}`, 'serrure sans clé : « Prends la clé I dans la trappe A », sans erreur'))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    for (const k of [0, 1]) { await p.tap(`.cle-chant[data-k="${k}"]`); await W(p, 80); }
    const ins = await D(p, () => ({ keyIn: __entiteDebug.keyIn(), ins: [...document.querySelectorAll('.lock.key')].map((l) => l.classList.contains('inserted')), left: document.querySelectorAll('.cle-chant').length }));
    if (!(await bail(ins.keyIn.join() === 'true,true' && ins.ins.join() === 'true,true' && ins.left === 0, `clés prises ${JSON.stringify(ins)}`, 'clés prises, dans les serrures I et II'))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    // trop tôt : tourner avant le vert = −5 s, les clés reviennent
    const k0 = await D(p, () => __entiteDebug.k7());
    if (k0?.phase === 'wait') {
      const e1 = await D(p, () => __entiteDebug.state.errors);
      await p.tap(`.lock.key[data-key="${answers.keyOrder[0]}"] .lock-btn`); await W(p, 400);
      const tt = { k: await D(p, () => __entiteDebug.k7()), e: await D(p, () => __entiteDebug.state.errors), on: await D(p, () => document.querySelectorAll('.lock.key.on').length), ob: await D(p, () => document.querySelector('#objText')?.textContent || '') };
      if (!(await bail(tt.e === e1 + 1 && tt.k.fails.join() === 'tot' && tt.on === 0 && /Trop tôt|−5 s/.test(tt.ob), `trop tôt ${JSON.stringify(tt)}`, 'tourner avant le vert : « Trop tôt », −5 s, clés revenues'))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    } else rec(true, 7, 7, `trop tôt non testé (signal déjà donné : ${k0?.phase})`);
    const waitGo = () => p.waitForFunction(() => __entiteDebug.k7()?.phase === 'go', null, { timeout: 40000 }).catch(() => {});
    await waitGo();
    await p.waitForFunction(() => (__entiteDebug.stickColors() || []).every((c) => c && c.col === '#36f08a'), null, { timeout: 1500 }).catch(() => {});   // barrettes redessinées ~ toutes les 80 ms
    const g1 = await D(p, () => ({ k: __entiteDebug.k7(), cols: __entiteDebug.stickColors(), maint: __entiteDebug.voiceLog.filter((v) => v.ids?.[0] === 'cles_maintenant').map((v) => !!v.lie) }));
    const allGreen = (g1.cols || []).length === 5 && g1.cols.every((c) => c && c.col === '#36f08a' && c.n === 8);
    const wantAlerts = runInfo.tier === 'difficile' ? 2 : 0;
    const okGo = g1.k?.phase === 'go' && allGreen && g1.k.alerts === wantAlerts && g1.maint.length === wantAlerts && g1.maint.every(Boolean);
    if (!(await bail(okGo, `signal vert ${JSON.stringify(g1)}`, `signal : 5 barrettes vertes + bip${wantAlerts ? ', après 2 faux « Maintenant ! » (œil rouge)' : ''}`))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    if (runInfo.tier === 'moyen') {
      // une seule clé, puis plus d'1 s : « Pas ensemble », −5 s, on attend un nouveau vert
      const e2 = await D(p, () => __entiteDebug.state.errors);
      await p.tap('.lock.key[data-key="1"] .lock-btn'); await W(p, 1500);
      const pe = { k: await D(p, () => __entiteDebug.k7()), e: await D(p, () => __entiteDebug.state.errors) };
      if (!(await bail(pe.e === e2 + 1 && pe.k.fails.at(-1) === 'ensemble' && pe.k.phase !== 'go', `pas ensemble ${JSON.stringify(pe)}`, 'une clé seule plus d’1 s : « Pas ensemble », −5 s'))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
      await W(p, 300); await waitGo();
    }
  }
  const t7 = await tNow();
  for (const k of answers.keyOrder) {
    await p.tap(`.lock.key[data-key="${k}"] .lock-btn`);
    await W(p, 70);
  }
  if (!(await expectAdvance(7, 8, `${runInfo.tier === 'moyen' ? 'ensemble' : 'ordre'} ${answers.keyOrder.join(',')} (écart ${await D(p, () => __entiteDebug.k7()?.dt)} ms)`, t7))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(8, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 8 encodeurs (mot)
  if (!(await cydLetters(8))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  {
    // v0.5.1 : moyen = la barrette n s'allume à chaque lettre épelée (à l'envers : 5→1) ; difficile = rien, et Réécouter −5 s
    await p.waitForFunction(() => (__entiteDebug.voiceLog || []).some((v) => (v.ids || []).some((id) => /^clue_mot_/.test(id))), { timeout: 30000 }).catch(() => {});
    const expAcc = runInfo.tier === 'moyen' ? (runInfo.v.word === 'envers' ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4]) : [];
    // attente par événement (QA v0.5.1, vraie voix : 1re lettre à 12,3 s) : toutes les lettres comptées et la voix finie
    await W(p, 300);
    await p.waitForFunction((n) => __entiteDebug.accLog().length >= n && !__entiteDebug.audio().speaking, expAcc.length, { timeout: 60000 }).catch(() => {});
    const a0 = await D(p, () => __entiteDebug.accLog());
    const okA = a0.join() === expAcc.join();
    rec(okA, 8, 8, okA ? (expAcc.length ? `barrettes du cryptex ${expAcc.map((k) => k + 1).join('-')} (${runInfo.v.word})` : 'difficile : pas de barrettes au cryptex') : `barrettes cryptex ${JSON.stringify({ a0, expAcc })}`);
    if (!okA) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
    const e0 = await D(p, () => __entiteDebug.state.errors), r0 = await D(p, () => __entiteDebug.state.remaining);
    await p.waitForFunction(() => !document.querySelector('#btnReplay')?.disabled, { timeout: 8000 }).catch(() => {});
    await p.locator('#btnReplay').click({ force: true });
    await W(p, 900);
    const e1 = await D(p, () => __entiteDebug.state.errors), r1 = await D(p, () => __entiteDebug.state.remaining);
    await W(p, 300);
    await p.waitForFunction((n) => __entiteDebug.accLog().length >= n && !__entiteDebug.audio().speaking, expAcc.length * 2, { timeout: 60000 }).catch(() => {});
    const a1 = await D(p, () => __entiteDebug.accLog());
    const cost = r0 - r1;
    const okR = e1 === e0 && (runInfo.tier === 'difficile' ? cost >= 4.9 && cost < 7 : cost < 2) && (runInfo.tier === 'moyen' ? a1.length === 10 && a1.slice(5).join() === expAcc.join() : a1.length === 0);
    rec(okR, 8, 8, okR ? `Réécouter cryptex : ${runInfo.tier === 'difficile' ? '−5 s' : 'gratuit, barrettes rejouées'}` : `Réécouter cryptex ${JSON.stringify({ e0, e1, cost, a1 })}`);
    if (!okR) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }
  const t8 = await tNow();
  await rotateTo(p, answers.enc2);
  if (!(await expectAdvance(8, 9, `lettres ${answers.enc2.join('')}`, t8))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 9 labyrinthe (éventuellement attendre le sabotage)
  if (!(await hud(9, true))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t9 = await tNow();
  if (!(await doMaze(p, { waitSab: opts.waitSab }))) { await fail(9, 10, 'labyrinthe 2 bloqué'); await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await expectAdvance(9, 10, 'labyrinthe 2', t9))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(10, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 10 baie 2 : v0.5.1 la barrette 1 est un chrono (moyen 30 s, difficile 20 s) ; vide → −8 s, une erreur, recharge
  {
    await p.waitForFunction(() => __entiteDebug.patchClock()?.started, { timeout: 60000 })   // départ à la fin de l'indice (vraie voix seed 3 : 16,8 s).catch(() => {});
    const c0 = await D(p, () => __entiteDebug.patchClock());
    const tot = runInfo.tier === 'moyen' ? 30000 : 20000;
    const e0 = await D(p, () => __entiteDebug.state.errors), r0 = await D(p, () => __entiteDebug.state.remaining);
    await D(p, () => { const c = __entiteDebug.patchClock(); __entiteDebug.agePatchClock(c.left - 450); });   // il reste 0,45 s
    await W(p, 120);
    const mid = await D(p, () => ({ c: __entiteDebug.patchClock(), cols: __entiteDebug.stickColors() }));
    await W(p, 700);
    const c1 = await D(p, () => __entiteDebug.patchClock()), e1 = await D(p, () => __entiteDebug.state.errors), r1 = await D(p, () => __entiteDebug.state.remaining);
    const ob = await D(p, () => document.querySelector('#objText')?.textContent || '');
    const okK = !!c0 && c0.started && c0.total === tot && mid.cols?.[0]?.n === 1 && c1.expired === 1 && e1 === e0 + 1 && r0 - r1 >= 7.5 && c1.left > tot - 3000 && /−8 s/.test(ob);
    rec(okK, 10, 10, okK ? `chrono barrette 1 : ${tot / 1000} s, vide → −8 s, recharge (${Math.round(c1.left / 1000)} s)` : `chrono ét. 10 ${JSON.stringify({ c0, mid, c1, e0, e1, r0, r1, ob })}`);
    if (!okK) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }
  const t10 = await tNow();
  await doPatch(p, answers.patch2);
  if (!(await expectAdvance(10, 11, `patch ${JSON.stringify(answers.patch2)}`, t10))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(11, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 11 code 2
  const w11 = await wrongThenRight(p, answers.code2, 11);
  extras.wrong.push({ step: 11, ...w11 });
  rec(w11.ok, 11, 11, w11.ok ? `faux ${w11.bad} puis bon ${w11.want}` : w11.why);
  if (!w11.ok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t11 = w11.tRight ?? await tNow();
  if (!(await expectAdvance(11, 12, `code ${answers.code2}`, t11))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(12, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 12 levier rouge (le capot a pu rester ouvert après la mesure des cibles à l'étape 1)
  const txOpen = await D(p, () => !!__entiteDebug.state.coverTx);
  if (txOpen) { await p.tap('#coverTx'); await W(p, 200); }
  await p.tap('#coverTx'); await W(p, 150);
  const t12 = await tNow();
  await p.tap('#leverTx');
  const tWin = Date.now();
  let end = await snap(p);
  while (Date.now() - tWin < 12000 && !(end.phase === 'win' && end.endVisible)) {
    await W(p, 80);
    end = await snap(p);
  }
  const win = end.phase === 'win' && end.endVisible && /désamorcée/i.test(end.endTitle || '');
  if (!win) rec(false, 12, 'fin', JSON.stringify(end) + ' trace=' + JSON.stringify(await D(p, () => (window.__simonTrace || []).slice(-12)).catch(() => null)));
  else {
    const tGood = await D(p, () => Math.round(__entiteDebug.state.lastGoodAt || 0));
    const v = await assertVoiceMoved(p, runInfo, 12, 'fin', tGood || t12);
    rec(v.ok, 12, 'fin', v.ok ? `${end.endTitle}  voix ${v.heads}` : v.why);
    if (v.ok) extras.voice = (extras.voice || 0) + 1;
    // jingle de victoire : lancé une fois, pas en boucle, sans erreur de chargement
    let jg = null; const tj = Date.now();
    while (Date.now() - tj < 8000) { jg = await D(p, () => __entiteDebug.jingle()); if (jg.lances >= 1 || jg.erreur) break; await W(p, 100); }
    await W(p, 1500); jg = await D(p, () => __entiteDebug.jingle());
    const jok = jg.demandes === 1 && jg.lances === 1 && jg.charge && !jg.erreur;
    rec(jok, 12, 'fin', jok ? 'jingle de victoire joué une fois (audio/victoire.mp3)' : `jingle ${JSON.stringify(jg)}`);
    extras.jingle = jok;
  }

  const consoleOk = errs.length === 0;
  if (!consoleOk) { rec(false, '—', '—', 'erreurs console ' + JSON.stringify(errs)); console.log('  FAIL  erreurs console', errs); }
  await ctx.close();
  const ok = win && consoleOk && log.every((x) => x.ok);
  return { seed, tier: runInfo.tier, v: answers.v, ver, ok, log, errs, extras, end };
}

async function wrongThenRight(p, want, step) {
  const bad = wrongCode(want);
  const before = await snap(p);
  await keys(p, bad);
  await W(p, 350);
  const mid = await snap(p);
  if (mid.step !== step || mid.phase !== 'play') return { ok: false, why: `le faux code ${bad} a fait quitter l'étape ${step} : ${JSON.stringify(mid)}`, bad, want };
  if (!(mid.errors > before.errors) && !/Faux|−/.test(mid.label + mid.text)) {
    return { ok: false, why: `le faux code ${bad} n'a pas été refusé : ${JSON.stringify(mid)}`, bad, want };
  }
  await W(p, 80);
  const tRight = await D(p, () => Math.round(performance.now()));
  await keys(p, want);
  return { ok: true, bad, want, tRight };
}

const seeds = pickSeeds(ARGS);
const need = neededVariants();
let base = ARGS.base;
let stopServer = async () => {};
if (ARGS.autoServe) {
  const srv = await startStaticServer();
  base = srv.base;
  stopServer = srv.stop;
}
console.log(`fullrun  base=${base}  qa=${ARGS.qa ? 'oui' : 'non'}  audio=${ARGS.stubAudio ? 'court-circuité (voiceLog)' : 'réel'}  graines=${ARGS.explicitSeeds ? 'explicites' : (ARGS.qa ? 'qa 20+20+aléatoires' : 'couverture minimale')}`);
console.log(`graines (${seeds.length}) : ${seeds.map((s) => `${s}(${makeRun(s).tier})`).join(', ')}`);
const seedTiers = { moyen: seeds.filter((s) => makeRun(s).tier === 'moyen').length, difficile: seeds.filter((s) => makeRun(s).tier === 'difficile').length };
console.log(`par palier           moyen ${seedTiers.moyen}  difficile ${seedTiers.difficile}`);
if (ARGS.qa && !ARGS.explicitSeeds) assertFixedListCovers();
if (ARGS.qa && !ARGS.explicitSeeds && (seedTiers.moyen < 20 || seedTiers.difficile < 20)) {
  console.error(`FULLRUN FAIL  --qa exige ≥ 20 graines par palier (moyen ${seedTiers.moyen}, difficile ${seedTiers.difficile})`);
  await stopServer();
  process.exit(1);
}
console.log(`variantes à couvrir : ${need.size}  paliers : ${TIERS.join(', ')}`);

const b = await chromium.launch(launchOptions());
const results = [];
const cover = new Map(); // variant -> [seeds]
const tierHits = { moyen: 0, difficile: 0 };
let allOk = true;
const firstOfTier = new Set();
try {
  for (const [i, seed] of seeds.entries()) {
    const info = makeRun(seed);
    const first = !firstOfTier.has(info.tier); firstOfTier.add(info.tier);
    const hintSeq = first || i % 5 === 0;
    const hintOther = i % 2 === 0;
    const realSimon = first;                 // 1re graine de chaque palier : Simon à vitesse réelle
    const simonTimeout = first;              // … et un toucher trop lent
    const simonDrag = i % 3 === 0;
    const waitSab = info.tier === 'difficile' && !results.some((r) => r.extras && r.tier === 'difficile');
    console.log(`\n=== graine ${seed} (${info.tier})  sig=${info.sig}  Réécouter=oui  indice-Simon=${hintSeq ? 'oui' : 'non'}  indice-autre=${hintOther ? 'oui' : 'non'}  Simon=${realSimon ? 'vitesse réelle + délai' : 'rapide'}${simonDrag ? ' + glisser' : ''}  sab=${waitSab ? 'attendre' : 'si arrive'} ===`);
    const r = await playOne(b, seed, { hintSeq, hintOther, waitSab, realSimon, simonTimeout, simonDrag });
    results.push(r);
    if (r.ok) {
      for (const k of SLOTS) {
        const key = `${k}:${r.v[k]}`;
        if (!cover.has(key)) cover.set(key, []);
        cover.get(key).push(seed);
      }
      tierHits[r.tier]++;
    } else allOk = false;
  }
} finally {
  await b.close();
  await stopServer();
}

const missing = [...need].filter((k) => !cover.has(k));
const tiersOk = tierHits.moyen > 0 && tierHits.difficile > 0;
const coverOk = missing.length === 0 && tiersOk;

console.log('\n=== couverture des variantes ===');
console.log('slot           variante      paliers              graines              statut');
for (const key of [...need].sort()) {
  const [slot, variant] = key.split(':');
  const ss = cover.get(key) || [];
  const tiersFor = [...new Set(ss.map((s) => makeRun(s).tier))].join('+') || '—';
  const st = ss.length ? 'OK' : 'MANQUE';
  console.log(`${slot.padEnd(15)}${variant.padEnd(14)}${tiersFor.padEnd(21)}${String(ss.join(',') || '—').padEnd(21)}${st}`);
}
console.log(`paliers        moyen ${tierHits.moyen} partie(s), difficile ${tierHits.difficile} partie(s)   ${tiersOk ? 'OK' : 'MANQUE'}`);
console.log(`variantes      ${cover.size}/${need.size} couvertes${missing.length ? '  manquent : ' + missing.join(', ') : ''}`);

const nPass = results.filter((r) => r.ok).length;
const nReplay = results.filter((r) => r.extras?.replay?.ok).length;
const nHintSeq = results.filter((r) => r.extras?.hintSeq?.ok).length;
const nHintOther = results.filter((r) => r.extras?.hintOther?.ok).length;
const nWrong = results.reduce((n, r) => n + (r.extras?.wrong?.filter((w) => w.ok).length || 0), 0);
const nWrongWant = results.length * 3; // Simon (mauvaise prise + toucher ignoré) + codes 6 et 11
const nAdv = results.reduce((n, r) => n + (r.log?.filter((x) => x.ok && String(x.from) !== String(x.to) || (x.ok && x.to === 'fin')).length || 0), 0);

console.log('\n=== résumé ===');
for (const r of results) {
  const n = r.log?.filter((x) => x.ok).length ?? 0;
  const tot = r.log?.length ?? 0;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  graine ${r.seed} (${r.tier})  ${n}/${tot} vérifs  version ${r.ver}  console ${r.errs.length}`);
}
console.log(`parties              ${nPass}/${results.length} réussies`);
console.log(`Réécouter (Simon)    ${nReplay}/${results.length}`);
const nSimon = results.filter((r) => r.extras?.simon?.rounds).length;
console.log(`jingle victoire      ${results.filter((r) => r.extras?.jingle).length}/${results.length} (une fois par victoire)`);
console.log(`Simon complet        ${nSimon}/${results.length}  (délai ${results.filter((r) => r.extras?.simon?.timeout).length}, glisser ${results.filter((r) => r.extras?.simon?.drag).length}, barrette répétée ${results.filter((r) => r.extras?.simon?.repeat).length}, toucher ignoré ${results.filter((r) => r.extras?.simon?.ignored).length})`);
const nHud = results.reduce((n, r) => n + (r.extras?.hud || 0), 0);
console.log(`CYD 2 n° + RÉÉCOUTER ${nHud} vérifs (plaque absente, ≥ 44 px, visible y compris labyrinthe)`);
console.log(`indices étape 3      ${nHintSeq} (Simon rejoué, sans pénalité)`);
console.log(`indices autre étape  ${nHintOther}`);
console.log(`faux puis bon        ${nWrong}/${nWrongWant} (Simon étape 3, codes 6 et 11)`);
console.log(`voix après réussite  ${results.reduce((n, r) => n + (r.extras?.voice || 0), 0)} (étape + id de voix en ≤ 1,5 s, sans voix de l'étape d'avant)`);
console.log(`couverture           ${coverOk ? 'COMPLETE' : 'INCOMPLETE'}  (${cover.size}/${need.size} variantes, paliers moyen=${tierHits.moyen} difficile=${tierHits.difficile})`);

// Couverture = union de toutes les parties du run, pas de chaque graine isolée.
// --qa / jeu couvrant par défaut / --require-coverage : couverture complète exigée (FAIL sinon).
// Run ad hoc (--seeds …) : WARN seulement, sauf si --require-coverage.
const requireCover = ARGS.requireCoverage || !ARGS.explicitSeeds;
if (!allOk || (requireCover && !coverOk)) {
  if (!allOk) console.log('FULLRUN FAIL  au moins une partie a échoué');
  if (requireCover && !coverOk) console.log('FULLRUN FAIL  couverture incomplète (union du run)');
  process.exit(1);
}
if (!requireCover && !coverOk) {
  console.log(`WARN  couverture ${cover.size}/${need.size} (union du run) — incomplet, pas un échec. Exiger la couverture complète avec --require-coverage.`);
  if (missing.length) console.log(`WARN  manquent : ${missing.join(', ')}`);
}
console.log('FULLRUN PASS');
