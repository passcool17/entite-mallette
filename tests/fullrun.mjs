// tests/fullrun.mjs
// Contrôle qualité avant chaque push (et avant d'assembler la valise).
// Joue des parties complètes (étapes 0 à 12, dans l'ordre) jusqu'à ce que
// TOUTES les variantes de chaque étape et les DEUX paliers (moyen + difficile)
// soient couverts. ?debug=1 sert UNIQUEMENT à lire les réponses générées :
// la saisie se fait par de vrais taps/clics, comme un joueur.
//
// Chaque partie vérifie aussi :
//   - Réécouter à l'étape 3 : même séquence de DEL que la première fois
//   - un indice (étape 3, niveaux 1–2) rejoue aussi les DEL (une fois par variante de séquence)
//   - un indice sur une autre étape n'empêche pas d'avancer
//   - à chaque étape code (3, 6, 11) : un faux code puis le bon, et l'étape n'avance qu'après le bon
//
// Usage :
//   node tests/fullrun.mjs
//   node tests/fullrun.mjs http://127.0.0.1:8794/
//   node tests/fullrun.mjs https://passcool17.github.io/entite-mallette/
//   FULLRUN_BASE=... node tests/fullrun.mjs
// Graines optionnelles (débogage seulement ; le push exige la couverture complète) :
//   node tests/fullrun.mjs http://127.0.0.1:8794/ 0 26 28 142 9
// Viewport : 412×915 (Galaxy S20 FE, portrait).

import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { makeRun, RING, DETENTS, POOLS, SLOTS, TIERS } from '../js/game.js?v=0.2.5i';
import { OBJECTIVE, hintCues } from '../js/guide.js?v=0.2.5i';

const base = (process.env.FULLRUN_BASE || process.argv[2] || 'http://127.0.0.1:8794/').replace(/\/?$/, '/');
const CHROME = process.env.CHROME || '/opt/google/chrome/chrome';
const VIEW = { width: 412, height: 915 };

const neededVariants = () => {
  const need = new Set();
  for (const k of SLOTS) for (const v of new Set([...POOLS[k].moyen, ...POOLS[k].difficile])) need.add(`${k}:${v}`);
  return need;
};

// Ensemble minimal de graines qui couvre chaque variante et les deux paliers (glouton déterministe).
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

function pickSeeds() {
  const extra = process.argv.slice(3).filter((x) => /^\d+$/.test(x)).map(Number);
  if (extra.length) return extra;
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


const SUCCESS_HEADS = new Set(['outcome_ok', 'clue_fragment', 'taunt_fini', 'taunt_couche2', 'outcome_victoire', 'depart']);

function stepHeads(run, step) {
  const ids = new Set();
  if (OBJECTIVE[step]) ids.add(OBJECTIVE[step]);
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
  for (let i = 0; i < 4; i++) {
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

async function recordCyanSeq(p, ms = 22000) {
  const tWait = Date.now();
  while (Date.now() - tWait < ms) {
    const s = await D(p, () => __entiteDebug.seqShow);
    if (s && !s.fake) break;
    await W(p, 50);
  }
  const ev = [];
  const t0 = Date.now();
  let last = -1;
  while (Date.now() - t0 < Math.max(4000, ms - (Date.now() - tWait)) && ev.length < 4) {
    const on = await D(p, () => [...document.querySelectorAll('#bar i')].findIndex((e) => e.classList.contains('on') && e.style.getPropertyValue('--c').trim() === '#62d6ff'));
    if (on >= 0 && on !== last) ev.push({ t: Date.now() - t0, led: on + 1 });
    last = on;
    await W(p, 40);
  }
  return ev;
}

async function waitSeqIdle(p, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const show = await D(p, () => __entiteDebug.seqShow);
    if (!show) return true;
    await W(p, 60);
  }
  return false;
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
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  p.on('pageerror', (e) => errs.push('page:' + e.message));

  const url = `${base}?debug=1&seed=${seed}&voix=rapide&notuto=1`;
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

  const extras = { replay: null, hintSeq: null, hintOther: null, wrong: [], voice: 0 };

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
  await p.tap('#coverArm'); await W(p, 120);
  const tArm = await tNow();
  await p.tap('#leverArm');
  if (!(await expectAdvance(0, 1, 'armement', tArm))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs }; }

  const answers = await D(p, () => {
    const r = __entiteDebug.run, RING = __entiteDebug.RING;
    return {
      enc1: r.enc1.map((i) => RING[i]),
      enc2: r.enc2.map((i) => RING[i]),
      trap: r.trap,
      seq: r.seq.slice(),
      seqCode: r.seqCode,
      code1: r.code1,
      code2: r.code2,
      patch1: r.patch1.req,
      patch2: r.patch2.req,
      keyOrder: r.keyOrder,
      v: { ...r.v },
    };
  });


  // ---- 1 encodeurs (+ indice sur une partie sur deux)
  if (opts.hintOther) {
    await p.tap('#btnHint'); await W(p, 200);
    s = await snap(p);
    const hok = s.step === 1 && s.hint >= 1;
    rec(hok, 1, 1, hok ? 'indice 1 (encodeurs)' : `indice 1 n'a pas pris ${JSON.stringify(s)}`);
    extras.hintOther = { step: 1, ok: hok };
    if (!hok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }
  const t1 = await tNow();
  await rotateTo(p, answers.enc1);
  if (!(await expectAdvance(1, 2, `lettres ${answers.enc1.join('')}`, t1))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 2 trappe
  const t2 = await tNow();
  await p.tap(`.trap[data-i="${answers.trap}"] .trap-door`);
  if (!(await expectAdvance(2, 3, `trappe ${answers.trap + 1}`, t2))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 3 barre + clavier : 1re séquence, Réécouter, éventuellement indice, faux code puis bon
  const wantSeq = answers.seq;
  const first = await recordCyanSeq(p, 22000);
  const firstLeds = first.map((e) => e.led);
  const firstOk = firstLeds.join() === wantSeq.join();
  rec(firstOk, 3, 3, firstOk ? `1re séquence ${firstLeds.join('-')}` : `1re séquence ${firstLeds.join('-') || '∅'} ≠ ${wantSeq.join('-')}`);
  if (!firstOk) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  await waitSeqIdle(p, 4000);

  await p.locator('#btnReplay').click({ force: true });
  const replay = await recordCyanSeq(p, 22000);
  const replayLeds = replay.map((e) => e.led);
  const replayOk = replayLeds.join() === wantSeq.join();
  const replayInfo = replayOk ? `Réécouter ${replayLeds.join('-')}` : `Réécouter ${replayLeds.join('-') || '∅'} ≠ ${wantSeq.join('-')}  ${JSON.stringify(await D(p, () => ({ lastClue: __entiteDebug.state.lastClue, seqShow: __entiteDebug.seqShow, log: __entiteDebug.voiceLog.slice(-5).map((v) => v.ids[0]), replayDis: document.querySelector('#btnReplay')?.disabled })))}`;
  rec(replayOk, 3, 3, replayInfo);
  extras.replay = { ok: replayOk, first: firstLeds, replay: replayLeds, want: wantSeq };
  if (!replayOk) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  await waitSeqIdle(p, 4000);

  if (opts.hintSeq) {
    await p.tap('#btnHint');
    await W(p, 300);
    const still = await snap(p);
    const hOk = still.step === 3 && still.hint >= 1;
    rec(hOk, 3, 3, hOk ? 'indice en cours, réussite pendant la voix' : `indice pas pris ${JSON.stringify(still)}`);
    extras.hintSeq = { ok: hOk, midPlay: true };
    if (!hOk) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }

  const w3 = await wrongThenRight(p, answers.seqCode, 3);
  extras.wrong.push({ step: 3, ...w3 });
  rec(w3.ok, 3, 3, w3.ok ? `faux ${w3.bad} puis bon ${w3.want}` : w3.why);
  if (!w3.ok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t3 = w3.tRight ?? await tNow();
  if (!(await expectAdvance(3, 4, `code ${answers.seqCode}`, t3))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 4 baie
  const t4 = await tNow();
  await doPatch(p, answers.patch1);
  if (!(await expectAdvance(4, 5, `patch ${JSON.stringify(answers.patch1)}`, t4))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 5 labyrinthe
  const t5 = await tNow();
  if (!(await doMaze(p))) { await fail(5, 6, 'labyrinthe bloqué'); await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await expectAdvance(5, 6, 'labyrinthe', t5))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 6 code 1
  const w6 = await wrongThenRight(p, answers.code1, 6);
  extras.wrong.push({ step: 6, ...w6 });
  rec(w6.ok, 6, 6, w6.ok ? `faux ${w6.bad} puis bon ${w6.want}` : w6.why);
  if (!w6.ok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t6 = w6.tRight ?? await tNow();
  if (!(await expectAdvance(6, 7, `code ${answers.code1}`, t6))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 7 clés
  const t7 = await tNow();
  for (const k of answers.keyOrder) {
    await p.tap(`.lock.key[data-key="${k}"] .lock-btn`);
    await W(p, 70);
  }
  if (!(await expectAdvance(7, 8, `ordre ${answers.keyOrder.join(',')}`, t7))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 8 encodeurs (mot)
  const t8 = await tNow();
  await rotateTo(p, answers.enc2);
  if (!(await expectAdvance(8, 9, `lettres ${answers.enc2.join('')}`, t8))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 9 labyrinthe (éventuellement attendre le sabotage)
  const t9 = await tNow();
  if (!(await doMaze(p, { waitSab: opts.waitSab }))) { await fail(9, 10, 'labyrinthe 2 bloqué'); await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await expectAdvance(9, 10, 'labyrinthe 2', t9))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 10 baie 2
  const t10 = await tNow();
  await doPatch(p, answers.patch2);
  if (!(await expectAdvance(10, 11, `patch ${JSON.stringify(answers.patch2)}`, t10))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 11 code 2
  const w11 = await wrongThenRight(p, answers.code2, 11);
  extras.wrong.push({ step: 11, ...w11 });
  rec(w11.ok, 11, 11, w11.ok ? `faux ${w11.bad} puis bon ${w11.want}` : w11.why);
  if (!w11.ok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t11 = w11.tRight ?? await tNow();
  if (!(await expectAdvance(11, 12, `code ${answers.code2}`, t11))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 12 levier rouge
  await p.tap('#coverTx'); await W(p, 120);
  const t12 = await tNow();
  await p.tap('#leverTx');
  const tWin = Date.now();
  let end = await snap(p);
  while (Date.now() - tWin < 6000 && !(end.phase === 'win' && end.endVisible)) {
    await W(p, 80);
    end = await snap(p);
  }
  const win = end.phase === 'win' && end.endVisible && /désamorcée/i.test(end.endTitle || '');
  if (!win) rec(false, 12, 'fin', JSON.stringify(end));
  else {
    const tGood = await D(p, () => Math.round(__entiteDebug.state.lastGoodAt || 0));
    const v = await assertVoiceMoved(p, runInfo, 12, 'fin', tGood || t12);
    rec(v.ok, 12, 'fin', v.ok ? `${end.endTitle}  voix ${v.heads}` : v.why);
    if (v.ok) extras.voice = (extras.voice || 0) + 1;
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

const seeds = pickSeeds();
const need = neededVariants();
console.log(`fullrun  base=${base}`);
console.log(`graines (${seeds.length}) : ${seeds.map((s) => `${s}(${makeRun(s).tier})`).join(', ')}`);
console.log(`variantes à couvrir : ${need.size}  paliers : ${TIERS.join(', ')}`);

const b = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
const cover = new Map(); // variant -> [seeds]
const tierHits = { moyen: 0, difficile: 0 };
const seqHinted = new Set();
let allOk = true;
try {
  for (const [i, seed] of seeds.entries()) {
    const info = makeRun(seed);
    const hintSeq = !seqHinted.has(info.v.seq);
    const hintOther = i % 2 === 0;
    const waitSab = info.tier === 'difficile' && !results.some((r) => r.extras && r.tier === 'difficile');
    console.log(`\n=== graine ${seed} (${info.tier})  sig=${info.sig}  Réécouter=oui  indice-séq=${hintSeq ? 'oui' : 'non'}  indice-autre=${hintOther ? 'oui' : 'non'}  sab=${waitSab ? 'attendre' : 'si arrive'} ===`);
    const r = await playOne(b, seed, { hintSeq, hintOther, waitSab });
    results.push(r);
    if (r.ok) {
      for (const k of SLOTS) {
        const key = `${k}:${r.v[k]}`;
        if (!cover.has(key)) cover.set(key, []);
        cover.get(key).push(seed);
      }
      tierHits[r.tier]++;
      if (r.extras?.hintSeq?.ok) seqHinted.add(r.v.seq);
    } else allOk = false;
  }
} finally {
  await b.close();
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
const nWrongWant = results.length * 3;
const nAdv = results.reduce((n, r) => n + (r.log?.filter((x) => x.ok && String(x.from) !== String(x.to) || (x.ok && x.to === 'fin')).length || 0), 0);

console.log('\n=== résumé ===');
for (const r of results) {
  const n = r.log?.filter((x) => x.ok).length ?? 0;
  const tot = r.log?.length ?? 0;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  graine ${r.seed} (${r.tier})  ${n}/${tot} vérifs  version ${r.ver}  console ${r.errs.length}`);
}
console.log(`parties              ${nPass}/${results.length} réussies`);
console.log(`Réécouter (DEL)      ${nReplay}/${results.length}`);
console.log(`indices étape 3      ${nHintSeq} (cible : une fois par variante de séquence)`);
console.log(`indices autre étape  ${nHintOther}`);
console.log(`faux puis bon code   ${nWrong}/${nWrongWant} (étapes 3, 6, 11)`);
console.log(`voix après réussite  ${results.reduce((n, r) => n + (r.extras?.voice || 0), 0)} (étape + id de voix en ≤ 1,5 s, sans voix de l'étape d'avant)`);
console.log(`couverture           ${coverOk ? 'COMPLETE' : 'INCOMPLETE'}  (${cover.size}/${need.size} variantes, paliers moyen=${tierHits.moyen} difficile=${tierHits.difficile})`);

if (!allOk || !coverOk) {
  console.log('FULLRUN FAIL');
  process.exit(1);
}
console.log('FULLRUN PASS');
