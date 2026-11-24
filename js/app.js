// app.js : La mallette de l'Entité v0.2.0 : mallette d'espion multi-faces (Dessus, Mallette ouverte, Flanc).
// Règle de Pascal : AUCUN code ni consigne écrit à l'écran. L'Entité dicte (voix), puis presse et ment (œil rouge)
// pendant que tu choisis. Paliers cachés ~50/50, ?seed=N reproductible, ?debug=1 expose window.__entiteDebug.
import { createEye } from './eye.js';
import { EYE, deepMerge } from './eye-config.js';
import { makeRun, TIME_S, NSTEPS, STEPS, canMove, DIRS } from './game.js';
import { initAudio, speak, stopVoice, voiceLevel, setMuted, isMuted, setCaptionHandler, startMusic, setMusicIntensity, stopMusic, voiceLog, voiceStats, musicStats, ttsAvailable } from './audio.js';
import { sfx } from './sfx.js';
import { preloadAll } from './preload.js';

const VERSION = '0.2.0';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SEED_Q = q.has('seed') && /^\d+$/.test(q.get('seed')) ? Number(q.get('seed')) >>> 0 : null;
const DEBUG = q.get('debug') === '1';
const newSeed = () => (SEED_Q ?? (crypto.getRandomValues?.(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 2 ** 32))) >>> 0;
const canVibrate = typeof navigator.vibrate === 'function';
const buzz = (p) => { if (canVibrate) { try { navigator.vibrate(p); } catch { /* rien */ } } };
const fmtPct = (v) => v.toFixed(1).replace('.', ',') + ' %';
const LED = { rouge: '#ff3b30', vert: '#36f08a', bleu: '#3d8bff', ambre: '#ffb020', cyan: '#62d6ff', off: null };
const WIRE = { rouge: '#d8262b', noir: '#17181b', bleu: '#2b7cff', jaune: '#f2c230', vert: '#1f9d4f' };
const ORD = ['1er', '2e', '3e', '4e', '5e'];

// ================= état =================
let run = null;
const g = {};
function resetState() {
  run = makeRun(newSeed());
  Object.assign(g, {
    phase: 'idle',               // idle → arm-latch → arm-toggle → play → win | boom
    step: 0, running: false, ended: false, result: null,
    endAt: 0, remaining: TIME_S, rate: 1, lastTick: 0, lastSec: null,
    prob: 99.7, errors: 0, lieUntil: 0, lies: 0,
    latches: [false, false], cover: false, armed: false,
    enc: [0, 0, 0, 0], trapOpen: [false, false, false], seqShow: null,
    pulled: [false, false, false, false, false], wires: run.wires1.colors.slice(),
    pos: null, code: '', keysTurned: [], hesitating: false, lastInput: 0,
    sabotage: false, sabT: 0, txDown: 0, said30: false, said10: false,
    lastClue: null, pressure: [], decoy: null, startT: 0,
  });
}

// ================= voix : file d'attente, mensonges (œil rouge) =================
let vq = Promise.resolve(), vqGen = 0;
// ids : un id ou une suite d'ids du manifeste. lie : œil rouge pendant la réplique.
function voice(ids, { lie = false, now = false, clue = false } = {}) {
  ids = Array.isArray(ids) ? ids : [ids];
  if (clue) { g.lastClue = ids; $('#btnReplay').disabled = false; }
  const gen = now ? ++vqGen : vqGen;
  const play = () => {
    if (gen !== vqGen && !now) return Promise.resolve();
    if (lie) flagLie(true);
    return speak(ids, { lie }).then(() => { if (lie) flagLie(false); });
  };
  if (now) { stopVoice(); vq = play(); } else vq = vq.then(play);
  return vq;
}
function flagLie(on) {
  if (on) { g.lies++; g.lieUntil = performance.now() + 2600; }
  const apply = () => {
    const live = performance.now() < g.lieUntil || on;
    $('#cyd1').classList.toggle('liar', live);
    document.body.classList.toggle('lying', live);
    eye?.setMood(live ? 'angry' : g.running ? 'watching' : 'idle');
  };
  apply();
  if (!on) setTimeout(() => { if (performance.now() >= g.lieUntil) { g.lieUntil = 0; apply(); } }, Math.max(0, g.lieUntil - performance.now()) + 20);
}
const digit = (d) => `chiffre_${d}`;
const color = (c) => `couleur_${c}`;

// ================= faces =================
let face = 'mallette';
function showFace(f, focus = false) {
  face = f;
  $$('.face-tab').forEach((t) => { const on = t.dataset.face === f; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  $$('.face').forEach((s) => { s.hidden = s.id !== `face-${f}`; });
  $('#faceTitle').textContent = { dessus: 'Dessus', mallette: 'Mallette ouverte', flancs: 'Flanc' }[f];
  if (focus) $(`#tab-${f}`).focus();
  if (f === 'mallette') requestAnimationFrame(() => { eye?.resize?.(); drawCyd2(); });
  pingFaces();
}
function wantedFace() {
  if (g.phase === 'arm-latch') return 'dessus';
  if (g.phase === 'arm-toggle') return 'flancs';
  if (g.phase !== 'play') return null;
  const st = STEPS[g.step]; return st ? (st.face === 'base' ? 'mallette' : st.face) : null;
}
function pingFaces() {
  const w = wantedFace();
  $$('.face-tab').forEach((t) => t.classList.toggle('want', !!w && t.dataset.face === w && face !== w));
}

// ================= construction des pièces =================
function buildParts() {
  // encodeurs KY-040
  const er = $('#encRow'); er.textContent = '';
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div'); el.className = 'enc'; el.dataset.i = i;
    el.innerHTML = `<button class="enc-step minus" type="button" aria-label="E${i + 1} : un cran à gauche">−</button>
      <button class="knob" type="button" aria-label="Encodeur E${i + 1} : tourner (glisser) ou cliquer pour valider"><span class="knob-cap"><span class="knob-mark"></span></span></button>
      <button class="enc-step plus" type="button" aria-label="E${i + 1} : un cran à droite">+</button><span class="silk">E${i + 1}</span>`;
    er.append(el);
  }
  // clavier 4x4
  const kp = $('#keypad');
  $$('.kp-key', kp).forEach((k) => k.remove());
  for (const k of ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D']) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'kp-key' + (/[A-D*#]/.test(k) ? ' fn' : ''); b.dataset.k = k; b.textContent = k;
    b.setAttribute('aria-label', `Touche ${k}`); kp.append(b);
  }
  // trappes SG90
  const tr = $('#traps'); tr.textContent = '';
  run.trapColors.forEach((c, i) => {
    const t = document.createElement('div'); t.className = 'trap'; t.dataset.i = i; t.style.setProperty('--rim', WIRE[c] === WIRE.noir ? '#555' : LED[c]);
    t.innerHTML = `<div class="trap-well"></div><button class="trap-door" type="button" aria-label="Trappe T${i + 1}, liseré ${c}"><span class="trap-screw"></span><span class="trap-screw"></span><span class="trap-n">T${i + 1}</span></button>`;
    tr.append(t);
  });
  // fiches banane
  buildJacks();
  $('#serial').textContent = run.serial;
  $('#lot').textContent = `LOT ${run.lot}`;
}
function buildJacks() {
  const j = $('#jacks'); j.textContent = '';
  g.wires.forEach((c, i) => {
    const el = document.createElement('div'); el.className = 'jack'; el.dataset.i = i; el.dataset.c = c; el.style.setProperty('--w', WIRE[c]);
    el.innerHTML = `<span class="jack-socket"></span><button class="plug" type="button" aria-label="Fiche ${ORD[i]}, fil ${c} : débrancher"><span class="plug-body"></span><span class="plug-wire"></span></button><span class="silk">${i + 1}</span>`;
    j.append(el);
  });
}

// ================= affichages =================
function setBar(cols) {
  const b = $('#bar');
  if (b.children.length !== 8) { b.textContent = ''; for (let i = 0; i < 8; i++) b.append(document.createElement('i')); }
  [...b.children].forEach((el, i) => { const c = cols[i]; el.style.setProperty('--c', c || 'transparent'); el.classList.toggle('on', !!c); });
}
function showTime(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  const txt = `${m}:${String(sec).padStart(2, '0')}`;
  $('#timer').textContent = txt; $('#tm2').textContent = txt;
  $('.tm[role="timer"]').setAttribute('aria-label', `Temps restant ${m} min ${sec} s`);
}
function showProb() { $('#prob').textContent = fmtPct(g.prob); }
function showStep() { $('#stepNo').textContent = g.phase === 'play' ? `${String(g.step).padStart(2, '0')}/${NSTEPS}` : g.phase.startsWith('arm') ? 'ARM' : '—'; pingFaces(); }

// OLED 0,96 po : positions des encodeurs (ce que montrent les boutons, pas la réponse), ou saisie du code masquée
const oledCtx = () => $('#oledCanvas').getContext('2d');
function drawOled() {
  const c = oledCtx(), W = 128, H = 64; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#9fe8ff'; c.font = '500 9px "JetBrains Mono", monospace'; c.textBaseline = 'top';
  const codeStep = g.step === 3 || g.step === 6 || g.step === 11;
  if (g.phase !== 'play') { c.fillText('PC17  ENTITE', 4, 4); c.fillRect(4, 18, 120 * Math.min(1, (performance.now() % 2000) / 2000), 1); $('#oledText').textContent = ''; return; }
  if (codeStep) {
    c.fillText('SAISIE', 4, 4);
    for (let i = 0; i < 4; i++) { const x = 14 + i * 26; c.fillRect(x, 46, 16, 2); if (i < g.code.length) { c.beginPath(); c.arc(x + 8, 34, 5, 0, 7); c.fill(); } }
    $('#oledText').textContent = `${g.code.length} sur 4`;
    return;
  }
  const lie = performance.now() < g.lieUntil && (g.step === 1 || g.step === 8);
  c.fillText('E1  E2  E3  E4', 10, 4);
  c.font = '500 22px "JetBrains Mono", monospace';
  for (let i = 0; i < 4; i++) {
    const v = lie && g.decoy?.enc ? g.decoy.enc[i] : g.enc[i];
    c.fillText(String(v), 12 + i * 30, 22);
  }
  if (lie) { for (let k = 0; k < 6; k++) { c.fillStyle = 'rgba(255,60,60,.7)'; c.fillRect(Math.random() * W, Math.random() * H, 20 + Math.random() * 40, 2); } }
  $('#oledText').textContent = `Encodeurs ${g.enc.join(' ')}`;
}
function setEncVisual() {
  $$('.enc').forEach((el, i) => { $('.knob-cap', el).style.transform = `rotate(${g.enc[i] * 36}deg)`; $('.knob', el).setAttribute('aria-valuenow', g.enc[i]); });
}

// CYD 2 : verrou de signal (labyrinthe visible), sinon oscilloscope en veille
function drawCyd2() {
  const cv = $('#cyd2'); if (!cv) return;
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, now = performance.now();
  c.fillStyle = '#020a10'; c.fillRect(0, 0, W, H);
  const maze = g.phase === 'play' && (g.step === 5 ? run.maze1 : g.step === 9 ? run.maze2 : null);
  const sab = g.sabotage;
  if (!maze) {
    c.strokeStyle = 'rgba(98,214,255,.18)'; c.lineWidth = 1;
    for (let x = 0; x <= W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y <= H; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.strokeStyle = g.phase === 'play' ? '#62d6ff' : '#2a6f8a'; c.lineWidth = 2; c.beginPath();
    for (let x = 0; x <= W; x += 3) { const y = H / 2 + Math.sin(x / 14 + now / 300) * 18 * Math.sin(now / 1700) + Math.sin(x / 5 + now / 90) * 3; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
    return;
  }
  const n = maze.n, cs = Math.floor(Math.min((W - 20) / n, (H - 20) / n)), ox = Math.floor((W - cs * n) / 2), oy = Math.floor((H - cs * n) / 2);
  const ink = sab ? '#ff4b3e' : '#62d6ff';
  c.strokeStyle = sab ? 'rgba(255,75,62,.16)' : 'rgba(98,214,255,.14)'; c.lineWidth = 1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) c.strokeRect(ox + x * cs + 0.5, oy + y * cs + 0.5, cs, cs);
  c.strokeStyle = ink; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const w = maze.walls[y][x], X = ox + x * cs, Y = oy + y * cs;
    if (w & 1) { c.moveTo(X, Y); c.lineTo(X + cs, Y); }
    if (w & 8) { c.moveTo(X, Y); c.lineTo(X, Y + cs); }
    if (y === n - 1 && (w & 4)) { c.moveTo(X, Y + cs); c.lineTo(X + cs, Y + cs); }
    if (x === n - 1 && (w & 2)) { c.moveTo(X + cs, Y); c.lineTo(X + cs, Y + cs); }
  }
  c.stroke();
  // cible : anneau pulsé
  const [gx, gy] = maze.goal, pr = cs * 0.28 + Math.sin(now / 200) * 2;
  c.strokeStyle = '#36f08a'; c.lineWidth = 2; c.beginPath(); c.arc(ox + gx * cs + cs / 2, oy + gy * cs + cs / 2, pr, 0, 7); c.stroke();
  c.beginPath(); c.arc(ox + gx * cs + cs / 2, oy + gy * cs + cs / 2, 3, 0, 7); c.fillStyle = '#36f08a'; c.fill();
  // curseur
  const [px, py] = g.pos || maze.start;
  c.fillStyle = sab ? '#ff4b3e' : '#e9f8ff'; c.shadowColor = ink; c.shadowBlur = 10;
  c.fillRect(ox + px * cs + cs * 0.3, oy + py * cs + cs * 0.3, cs * 0.4, cs * 0.4); c.shadowBlur = 0;
  if (sab) { for (let k = 0; k < 8; k++) { c.fillStyle = `rgba(255,${40 + Math.random() * 80},60,${0.2 + Math.random() * 0.4})`; c.fillRect(0, Math.random() * H, W, 1 + Math.random() * 3); } }
}

// ================= déroulé =================
function nextStep(n) {
  g.step = n; g.pressure.forEach(clearTimeout); g.pressure = []; g.decoy = null; clearDecoys();
  showStep();
  const hard = run.tier === 'difficile';
  switch (n) {
    case 1: g.enc = [0, 0, 0, 0].map(() => Math.floor(Math.random() * 10)); setEncVisual();
      voice(hard ? 'clue_enc1_envers' : 'clue_enc1_ordre', { clue: true }); pressureEnc(); break;
    case 2: voice(hard ? 'clue_trappe_rare' : 'clue_trappe_frequente', { clue: true });
      pressure(5500, () => { const w = (run.trap + 1) % 3; decoy('trap', w); voice(['taunt_trappe', color(run.trapColors[w])], { lie: true, now: true }); }); break;
    case 3: g.code = ''; voice(hard ? 'clue_sequence_envers' : 'clue_sequence_ordre', { clue: true }).then(() => g.step === 3 && flashSeq(run.seq));
      pressure(9000, () => { voice('taunt_regarde', { lie: true, now: true }); flashSeq(run.seq.map((d) => (d % 8) + 1), true); }); break;
    case 4: voice(hard ? 'clue_fils1_dur' : 'clue_fils1_moyen', { clue: true });
      pressure(6000, () => { const w = run.decoys.wire1; decoy('wire', w); voice(['taunt_debranche', color(g.wires[w]), 'taunt_saute'], { lie: true, now: true }); }); break;
    case 5: g.pos = run.maze1.start.slice(); voice('clue_verrou', { clue: true });
      pressure(9000, () => voice('taunt_lent', { now: true })); break;
    case 6: g.code = ''; voice('clue_code1', { clue: true });
      pressure(6000, () => { const i = Math.floor(Math.random() * 4); voice(['taunt_cetait', digit(run.decoys.frags[i]), 'taunt_depeche'], { lie: true, now: true }); }); break;
    case 7: $$('.lock.key .lock-btn').forEach((b) => { b.disabled = false; b.closest('.lock').classList.add('ready'); });
      voice(hard ? 'clue_cles_lourde' : 'clue_cles_legere', { clue: true });
      pressure(5000, () => voice(['taunt_cles', ...run.decoys.keys.map((k) => digit(k + 1))], { lie: true, now: true }));
      if (run.lies.keysTwice) pressure(14000, () => voice(['taunt_cles', ...run.decoys.keys.map((k) => digit(k + 1))], { lie: true, now: true })); break;
    case 8: g.enc = [0, 0, 0, 0].map(() => Math.floor(Math.random() * 10)); setEncVisual();
      voice(hard ? 'clue_enc2_decroissant' : 'clue_enc2_croissant', { clue: true }); pressureEnc(); break;
    case 9: g.pos = run.maze2.start.slice(); voice('clue_verrou', { clue: true }); g.sabT = performance.now() + 5000; break;
    case 10: g.wires = run.wires2.colors.slice(); g.pulled = [false, false, false, false, false]; buildJacks();
      sfx.servo(); voice(hard ? 'clue_fils2_dur' : 'clue_fils2_moyen', { clue: true });
      if (run.lies.wire2False) pressure(6000, () => { const w = run.decoys.wire2; decoy('wire', w); voice(['taunt_debranche', color(g.wires[w]), 'taunt_saute'], { lie: true, now: true }); }); break;
    case 11: g.code = ''; voice('clue_code2', { clue: true });
      pressure(7000, () => { decoy('transmit'); voice('taunt_rouge', { lie: true, now: true }); }); break;
    case 12: $('#transmit').classList.add('armed'); voice('clue_transmit', { clue: true }); voice('taunt_sceller', { lie: true }); break;
  }
  drawOled(); drawCyd2();
}
// pression pendant le choix : une réplique trompeuse après la consigne (si l'étape n'est pas finie)
function pressure(ms, fn) { const s = g.step; g.pressure.push(setTimeout(() => { if (g.running && g.step === s) fn(); }, ms)); }
function pressureEnc() {
  g._encTaunted = false;
  if (run.lies.encFalse && g.step === 1) pressure(4000, () => { const tgt = curEncTarget(); g.decoy = { enc: tgt.map((d) => (d + 3) % 10) }; voice(['taunt_cetait', digit(g.decoy.enc[0]), 'taunt_depeche'], { lie: true, now: true }); });
}
const curEncTarget = () => (g.step === 1 ? run.enc1 : run.enc2);
function decoy(kind, i) {
  clearDecoys();
  if (kind === 'trap') $(`.trap[data-i="${i}"]`)?.classList.add('decoy');
  if (kind === 'wire') $(`.jack[data-i="${i}"]`)?.classList.add('decoy');
  if (kind === 'transmit') $('#transmit').classList.add('decoy');
  setTimeout(clearDecoys, 3200);
}
function clearDecoys() { $$('.decoy').forEach((e) => e.classList.remove('decoy')); }

function good(nextN, fragIdx) {
  sfx.confirm(); buzz(30);
  g.prob = Math.max(0.3, g.prob - 7.9); showProb();
  if (fragIdx != null) {
    if (run.lies.fragLies.includes(fragIdx)) voice(['clue_fragment', digit(run.decoys.frags[fragIdx])], { lie: true, now: true });
    voice(['clue_fragment', digit(run.frags[fragIdx])], { clue: true, now: !run.lies.fragLies.includes(fragIdx) });
  } else voice('outcome_ok', { now: true });
  if (nextN) setTimeout(() => g.running && nextStep(nextN), 350);
}
function bad(sec = 5, line = 'outcome_faux') {
  sfx.strike(); buzz(70);
  g.errors++; g.remaining -= sec; g.prob = Math.min(99.9, g.prob + 3.2); showProb();
  document.body.classList.remove('hit'); void document.body.offsetWidth; document.body.classList.add('hit');
  eye?.setMood('angry'); setTimeout(() => !g.lieUntil && g.running && eye?.setMood('watching'), 900);
  if (line) voice(line, { now: true });
}
function input() {
  g.lastInput = performance.now();
  if (g.hesitating) { g.hesitating = false; g.rate = 1; document.body.classList.remove('hesitate'); }
}

// ---------- armement ----------
function startGame() {
  resetState(); buildParts(); setEncVisual();
  $('#intro').hidden = true; $('#app').hidden = false; $('#end').hidden = true;
  initAudio();
  g.phase = 'arm-latch'; showStep(); showFace('dessus');
  voice('intro'); voice('arm_loquets', { clue: true });
  showTime(TIME_S); showProb();
  if (DEBUG) $('#seedTag').textContent = ` · graine ${run.seed} · ${run.tier}`;
}
function latch(i, btn) {
  if (g.phase !== 'arm-latch' || g.latches[i]) return;
  g.latches[i] = true; sfx.keyTurn(); btn.setAttribute('aria-pressed', 'true'); btn.closest('.lock').classList.add('on');
  if (g.latches.every(Boolean)) {
    g.phase = 'arm-toggle'; showStep(); voice('arm_cache', { clue: true, now: true });
    setTimeout(() => showFace('flancs'), 650);
  }
}
function armToggle() {
  if (g.phase !== 'arm-toggle' || !g.cover) return;
  g.armed = true; $('#lever').setAttribute('aria-checked', 'true'); $('#guard').classList.add('armed');
  sfx.toggleSnap(); sfx.arm(); buzz([40, 60, 40]);
  g.phase = 'play'; g.running = true; g.startT = performance.now(); g.lastTick = performance.now(); g.lastInput = performance.now();
  voice('depart', { now: true });
  startMusic();
  setTimeout(() => { showFace('mallette'); $('#face-mallette').classList.add('opening'); sfx.lidOpen(); }, 700);
  nextStep(1);
}

// ---------- fin ----------
function endGame(win) {
  if (g.ended) return;
  g.ended = true; g.running = false; g.result = win ? 'win' : 'boom'; g.phase = win ? 'win' : 'boom'; g.endT = performance.now();
  g.pressure.forEach(clearTimeout); clearDecoys(); g.sabotage = false;
  document.body.classList.remove('hesitate', 'lying');
  $('#cyd1').classList.remove('liar');
  if (win) { stopMusic('fade'); sfx.win(); eye?.setMood('defused'); buzz([90, 90, 90]); voice('outcome_victoire', { now: true }); }
  else { stopMusic('cut'); sfx.boom(); eye?.setMood('boom'); buzz([500, 120, 300, 120, 700]); voice('outcome_boom', { now: true }); document.body.classList.add('boom'); }
  const used = TIME_S - Math.max(0, g.remaining), mm = Math.floor(used / 60), ss = Math.floor(used % 60);
  setTimeout(() => {
    $('#endKicker').textContent = win ? 'Entité confinée' : 'Détonation';
    $('#endTitle').textContent = win ? 'Mallette désamorcée' : 'Prévisible.';
    $('#endSub').textContent = `${mm} min ${String(ss).padStart(2, '0')} s · ${g.errors} erreur${g.errors > 1 ? 's' : ''} · graine ${run.seed}`;
    $('#end').hidden = false; $('#btnAgain').focus();
  }, win ? 2200 : 1600);
}

// ================= gestes =================
function wire() {
  $('#btnStart').addEventListener('click', startGame);
  $('#btnAgain').addEventListener('click', () => { document.body.classList.remove('boom'); stopVoice(); startGame(); });
  $$('.face-tab').forEach((t) => t.addEventListener('click', () => { showFace(t.dataset.face); sfx.push(); }));
  $('.faces').addEventListener('keydown', (e) => {
    const order = ['dessus', 'mallette', 'flancs'], i = order.indexOf(face);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); showFace(order[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3], true); }
  });
  $('#btnReplay').addEventListener('click', () => { if (!g.lastClue) return; voice(g.lastClue, { now: true }).then(() => { if (g.running && g.step === 3 && g.code === '') flashSeq(run.seq); }); });
  $('#btnPocket').addEventListener('click', () => { sfx.push(); $('#pocketDlg').showModal(); });
  $('#btnSon').addEventListener('click', () => { const m = !isMuted(); setMuted(m); $('#btnSon').setAttribute('aria-pressed', String(m)); $('#btnSon').setAttribute('aria-label', m ? 'Rétablir le son' : 'Couper le son'); });

  // dessus : loquets + clés
  $$('.lock.latch').forEach((l) => $('.lock-btn', l).addEventListener('click', (e) => { input(); latch(+l.dataset.latch, e.currentTarget); }));
  $$('.lock.key').forEach((l) => $('.lock-btn', l).addEventListener('click', (e) => {
    input(); if (g.step !== 7) return;
    const k = +l.dataset.key; if (g.keysTurned.includes(k)) return;
    sfx.keyTurn();
    const expect = run.keyOrder[g.keysTurned.length];
    if (k !== expect) {
      bad(5); g.keysTurned = []; $$('.lock.key').forEach((x) => { x.classList.remove('on'); $('.lock-btn', x).setAttribute('aria-pressed', 'false'); }); return;
    }
    g.keysTurned.push(k); l.classList.add('on'); e.currentTarget.setAttribute('aria-pressed', 'true');
    if (g.keysTurned.length === 3) good(8);
  }));

  // flanc : cache + interrupteur, fiches banane
  $('#cover').addEventListener('click', () => {
    input(); g.cover = !g.cover; $('#guard').classList.toggle('open', g.cover);
    $('#cover').setAttribute('aria-expanded', String(g.cover)); $('#lever').disabled = !g.cover || g.armed;
    g.cover ? sfx.coverUp() : sfx.coverDown();
  });
  $('#lever').addEventListener('click', () => { input(); armToggle(); });
  $('#jacks').addEventListener('click', (e) => {
    const b = e.target.closest('.plug'); if (!b) return;
    input(); const i = +b.closest('.jack').dataset.i;
    if (g.pulled[i]) return;
    sfx.plugPull();
    const step = g.step, set = step === 4 ? run.wires1 : step === 10 ? run.wires2 : null;
    const jack = b.closest('.jack');
    if (!set) { jack.classList.add('wiggle'); setTimeout(() => jack.classList.remove('wiggle'), 400); if (g.phase === 'play') bad(5); return; }
    if (i === set.cut) { g.pulled[i] = true; jack.classList.add('pulled'); b.setAttribute('aria-label', `Fiche ${ORD[i]} débranchée`); good(step === 4 ? 5 : 11, step === 4 ? 2 : null); }
    else { jack.classList.add('pulled'); setTimeout(() => jack.classList.remove('pulled'), 650); bad(8); }
  });

  // encodeurs : − / + (crans), glisser sur le bouton, molette ; clic = valider
  $('#encRow').addEventListener('click', (e) => {
    const st = e.target.closest('.enc-step'); if (!st) return;
    const i = +st.closest('.enc').dataset.i; turn(i, st.classList.contains('plus') ? 1 : -1);
  });
  // délégation sur #encRow : les boutons sont reconstruits à chaque partie (buildParts)
  const er = $('#encRow');
  let kn = null, ki = 0, sx = 0, sy = 0, acc = 0, moved = false;
  er.addEventListener('pointerdown', (e) => {
    kn = e.target.closest('.knob'); if (!kn) return;
    ki = +kn.closest('.enc').dataset.i; sx = e.clientX; sy = e.clientY; acc = 0; moved = false;
    kn.setPointerCapture(e.pointerId);
  });
  er.addEventListener('pointermove', (e) => {
    if (!kn || !kn.hasPointerCapture(e.pointerId)) return;
    const d = (e.clientX - sx) - (e.clientY - sy); // droite ou haut = sens horaire
    if (Math.abs(d - acc) >= 16) { const s = Math.sign(d - acc); acc += s * 16; moved = true; turn(ki, s); }
  });
  // clic du KY-040 : relâché sans avoir tourné, ou Entrée/Espace au clavier (click sans pointeur)
  er.addEventListener('pointerup', (e) => {
    if (!kn) return;
    if (kn.hasPointerCapture(e.pointerId)) kn.releasePointerCapture(e.pointerId);
    if (!moved) pushEnc(); kn = null;
  });
  er.addEventListener('pointercancel', () => { kn = null; });
  er.addEventListener('click', (e) => { if (e.detail === 0 && e.target.closest('.knob')) pushEnc(); });
  er.addEventListener('wheel', (e) => { const k = e.target.closest('.knob'); if (!k) return; e.preventDefault(); turn(+k.closest('.enc').dataset.i, e.deltaY < 0 ? 1 : -1); }, { passive: false });
  er.addEventListener('keydown', (e) => {
    const k = e.target.closest('.knob'); if (!k) return; const i = +k.closest('.enc').dataset.i;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); turn(i, 1); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); turn(i, -1); }
  });

  // trappes SG90
  $('#traps').addEventListener('click', (e) => {
    const door = e.target.closest('.trap-door'); if (!door) return;
    input();
    const t = door.closest('.trap'), i = +t.dataset.i;
    const shake = () => { t.classList.add('wiggle'); setTimeout(() => t.classList.remove('wiggle'), 400); };
    if (g.step !== 2 || g.trapOpen[i]) { sfx.wall(); shake(); return; }
    if (i === run.trap) { openTrap(i, 'ok'); good(3); }
    else { shake(); sfx.servo(); bad(5); }
  });

  // clavier 4x4 (clavier pur)
  $('#keypad').addEventListener('pointerdown', (e) => { const k = e.target.closest('.kp-key'); if (!k) return; input(); press(k.dataset.k); });
  $('#keypad').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.kp-key')) { e.preventDefault(); input(); press(e.target.dataset.k); } });

  // joystick : glisser le chapeau, ou toucher une direction
  const joy = $('#joy'), cap = $('#joyCap');
  let jx = 0, jy = 0, jfired = false;
  $('.joy-well', joy).addEventListener('pointerdown', (e) => { jx = e.clientX; jy = e.clientY; jfired = false; e.currentTarget.setPointerCapture(e.pointerId); });
  $('.joy-well', joy).addEventListener('pointermove', (e) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - jx, dy = e.clientY - jy, r = Math.min(18, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    cap.style.transform = `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)`;
    if (!jfired && Math.hypot(dx, dy) > 22) { jfired = true; stick(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }
  });
  const release = () => { cap.style.transform = ''; };
  $('.joy-well', joy).addEventListener('pointerup', release); $('.joy-well', joy).addEventListener('pointercancel', release);
  $$('.joy-dir', joy).forEach((b) => b.addEventListener('click', () => {
    const d = b.dataset.dir, v = DIRS[d]; cap.style.transform = `translate(${v[0] * 14}px, ${v[1] * 14}px)`; setTimeout(release, 140); stick(d);
  }));

  // TRANSMIT : maintenir 2 s à l'étape 12 ; avant, c'est le raccourci que pousse l'Entité
  const tx = $('#transmit');
  tx.addEventListener('pointerdown', (e) => { e.preventDefault(); txDown(); });
  tx.addEventListener('pointerup', txUp); tx.addEventListener('pointerleave', txUp); tx.addEventListener('pointercancel', txUp);
  tx.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); txDown(); } });
  tx.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') txUp(); });

  // clavier physique : flèches/WASD = joystick (face mallette), chiffres = clavier 4x4
  addEventListener('keydown', (e) => {
    if (!g.running || e.target.closest?.('.knob, .faces, dialog')) return;
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    if (map[e.key] && face === 'mallette' && (g.step === 5 || g.step === 9)) { e.preventDefault(); input(); stick(map[e.key]); }
    else if (/^[0-9]$/.test(e.key) && face === 'mallette') { input(); press(e.key); }
  });
}

function turn(i, s) {
  input(); if (g.phase !== 'play') return;
  g.enc[i] = (g.enc[i] + s + 10) % 10; sfx.detent(); setEncVisual(); drawOled();
  // pression : quand un encodeur tombe juste, l'Entité affirme le contraire (une fois par étape)
  if ((g.step === 1 || g.step === 8) && !g._encTaunted && g.enc[i] === curEncTarget()[i] && g.enc.filter((v, k) => v === curEncTarget()[k]).length >= 2) {
    g._encTaunted = true;
    const right = curEncTarget()[i], wrong = (right + 3 + Math.floor(Math.random() * 5)) % 10;
    setTimeout(() => g.running && voice(['taunt_cetait', digit(wrong), 'taunt_depeche'], { lie: true, now: true }), 300);
  }
}
function pushEnc() {
  input(); sfx.push();
  if (g.step !== 1 && g.step !== 8) return;
  const ok = g.enc.every((v, k) => v === curEncTarget()[k]);
  if (ok) { $$('.enc').forEach((e) => e.classList.add('locked')); setTimeout(() => $$('.enc').forEach((e) => e.classList.remove('locked')), 900); good(g.step === 1 ? 2 : 9, g.step === 1 ? 0 : null); }
  else bad(5);
}
function openTrap(i, what) {
  g.trapOpen[i] = true; sfx.servo();
  const t = $(`.trap[data-i="${i}"]`); t.classList.add('open');
  const well = $('.trap-well', t);
  well.innerHTML = what === 'keys' ? '<span class="keyset" role="img" aria-label="Clés I, II, III"><i></i><i></i><i></i></span>' : '<span class="trap-led" role="img" aria-label="Trappe ouverte"></span>';
}
// séquence lumineuse sur la barre WS2812B (étape 3) ; fake = fausse séquence de l'Entité (œil rouge)
function flashSeq(seq, fake = false) {
  const t0 = performance.now(), on = 520, gap = 260;
  g.seqShow = { seq, t0, on, gap, fake };
  seq.forEach((d, k) => setTimeout(() => g.seqShow?.t0 === t0 && sfx.simon(fake ? 'rouge' : ['bleu', 'vert', 'ambre', 'rouge'][k % 4]), k * (on + gap)));
  setTimeout(() => { if (g.seqShow?.t0 === t0) g.seqShow = null; }, seq.length * (on + gap) + 50);
}
function press(k) {
  sfx.keypad();
  const kp = $(`.kp-key[data-k="${k}"]`); kp?.classList.add('down'); setTimeout(() => kp?.classList.remove('down'), 110);
  if (g.step !== 3 && g.step !== 6 && g.step !== 11) return;
  if (!/^[0-9]$/.test(k)) { if (k === '*') { g.code = ''; drawOled(); } return; }
  g.code += k; drawOled();
  if (g.code.length < 4) return;
  const want = g.step === 3 ? run.seqCode : g.step === 6 ? run.code1 : run.code2, step = g.step;
  if (g.code === want) {
    g.code = ''; drawOled();
    if (step === 3) good(4, 1);
    else if (step === 6) {
      sfx.confirm(); g.prob = Math.max(0.3, g.prob - 7.9); showProb();
      voice('taunt_fini', { lie: true, now: true }); voice('taunt_couche2');
      openTrap((run.trap + 1) % 3, 'keys');
      setTimeout(() => g.running && nextStep(7), 400);
    } else good(12);
  } else { g.code = ''; setTimeout(drawOled, 250); bad(8); }
}
function stick(dir) {
  input(); sfx.joy();
  if (g.step !== 5 && g.step !== 9) return;
  const inv = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const d = g.sabotage ? inv[dir] : dir;
  const maze = g.step === 5 ? run.maze1 : run.maze2;
  if (!canMove(maze, g.pos, d)) { sfx.wall(); $('.cyd2').classList.remove('bump'); void $('.cyd2').offsetWidth; $('.cyd2').classList.add('bump'); drawCyd2(); return; }
  g.pos = [g.pos[0] + DIRS[d][0], g.pos[1] + DIRS[d][1]];
  drawCyd2();
  if (g.pos[0] === maze.goal[0] && g.pos[1] === maze.goal[1]) {
    if (g.sabotage) endSabotage();
    good(g.step === 5 ? 6 : 10, g.step === 5 ? 3 : null);
  }
}
function startSabotage() { g.sabotage = true; g.sabEnd = performance.now() + 5500; $('.cyd2').classList.add('sab'); voice('sabotage_joystick', { lie: true, now: true }); sfx.glitch(); }
function endSabotage() { g.sabotage = false; $('.cyd2').classList.remove('sab'); g.sabT = performance.now() + 7000; if (g.running && g.step === 9) voice('sabotage_fin', { now: true }); }
function txDown() {
  input(); const tx = $('#transmit'); tx.classList.add('down');
  if (g.phase !== 'play') return;
  if (g.step !== 12) { bad(8); return; } // raccourci poussé par l'Entité : erreur
  g.txDown = performance.now(); sfx.hold(); tx.classList.add('holding');
}
function txUp() {
  const tx = $('#transmit'); tx.classList.remove('down', 'holding');
  if (!g.txDown) return;
  const held = performance.now() - g.txDown; g.txDown = 0;
  if (g.step === 12 && g.running && held < 2000) bad(5);
}

// ================= boucle =================
let eye = null;
function loop(now) {
  requestAnimationFrame(loop);
  if (eye) { eye.setVoice(voiceLevel()); eye.lookAt(Math.sin(now / 2300) * 0.5, Math.sin(now / 3100) * 0.35); }
  if (g.running) {
    const dt = (now - g.lastTick) / 1000; g.lastTick = now;
    g.remaining -= dt * g.rate;
    showTime(g.remaining);
    const sec = Math.ceil(g.remaining);
    if (sec !== g.lastSec) {
      g.lastSec = sec;
      if (sec > 0) sfx.tick(sec <= 10 || g.hesitating);
      if (g.hesitating) sfx.joy();
      if (sec <= 30 && !g.said30) { g.said30 = true; sfx.alarm(); voice('outcome_trente', { now: true }); }
      if (sec <= 10 && !g.said10) { g.said10 = true; voice('outcome_dix', { now: true }); }
    }
    if (g.remaining <= 0) { showTime(0); endGame(false); return; }
    // hésitation : 15 s sans geste → le temps accélère jusqu'au prochain geste
    if (!g.hesitating && now - g.lastInput > 15000) { g.hesitating = true; g.rate = 1.6; document.body.classList.add('hesitate'); voice('taunt_hesite', { now: true }); }
    // TRANSMIT à l'étape 12 : maintenu 2 s
    if (g.txDown && g.step === 12 && now - g.txDown >= 2000) { g.txDown = 0; $('#transmit').classList.remove('holding'); endGame(true); return; }
    // sabotage du joystick (étape 9) : fenêtres de 5,5 s, axes inversés, œil rouge
    if (g.step === 9) {
      if (!g.sabotage && now > g.sabT) startSabotage();
      else if (g.sabotage && now > g.sabEnd) endSabotage();
    }
    if (!g.lieUntil && eye && !g.ended) eye.setMood(g.remaining <= 30 ? 'angry' : 'watching');
    setMusicIntensity(Math.pow(Math.min(1, Math.max(0, 1 - g.remaining / TIME_S)), 1.8));
  }
  // barre WS2812B : avant l'étape 2 progression ; à partir de l'étape 2 la barre montre ses 8 couleurs (indice de la trappe)
  if (now - (loop.t || 0) > 80) {
    loop.t = now;
    let cols;
    if (g.phase === 'play' && g.step === 2) cols = run.bar.map((c) => LED[c]);
    else if (g.phase === 'play' && g.step === 3) {
      cols = Array(8).fill(null);
      const sh = g.seqShow;
      if (sh) { const t = now - sh.t0, k = Math.floor(t / (sh.on + sh.gap)); if (k < sh.seq.length && t % (sh.on + sh.gap) < sh.on) cols[sh.seq[k] - 1] = sh.fake ? LED.rouge : LED.cyan; }
    }
    else if (g.phase === 'play') { const done = Math.round((g.step - 1) / NSTEPS * 8); cols = Array.from({ length: 8 }, (_, i) => (i < done ? LED.cyan : i === done && Math.floor(now / 300) % 2 ? LED.ambre : null)); }
    else if (g.phase === 'win') { const a = Math.floor(((Math.sin(now / 500) + 1) / 2) * 8); cols = Array.from({ length: 8 }, (_, i) => (i <= a ? LED.cyan : null)); }
    else if (g.phase === 'boom') cols = Array.from({ length: 8 }, () => (Math.floor(now / 90) % 2 ? LED.rouge : null));
    else { const p = Math.floor(now / 110) % 14, pos = p < 8 ? p : 14 - p; cols = Array.from({ length: 8 }, (_, i) => (i === pos ? '#3d8bff' : null)); }
    if (performance.now() < g.lieUntil) cols = cols.map((c, i) => (Math.random() < 0.35 ? LED.rouge : c));
    setBar(cols);
    if (face === 'mallette') { drawCyd2(); drawOled(); }
  }
}

// ================= démarrage =================
function bootDone() {
  const el = document.getElementById('boot'), b = window.__boot;
  if (b) { b.ready = true; b.code = 1; b.asset = 1; b.paint(); }
  if (!el || el.hidden) return;
  el.classList.add('gone'); setTimeout(() => { el.hidden = true; }, 380);
}
function runBoot(onReady) {
  const b = window.__boot || { paint() {}, problem() {} };
  b.ready = true; b.code = 1; b.paint();
  const $id = (id) => document.getElementById(id);
  let finished = false;
  const finish = () => { if (finished) return; finished = true; clearTimeout(slow); bootDone(); onReady(); };
  const start = () => {
    $id('bootErr').hidden = true; $id('bootActions').hidden = true; $id('bootSub').textContent = 'musique et voix';
    preloadAll((f, done, n) => { b.asset = f; b.paint(); $id('bootSub').textContent = `musique, voix et polices · ${done}/${n}`; })
      .then(({ failed }) => {
        if (finished) return;
        if (!failed.length) { finish(); return; }
        b.problem(`${failed.length} fichier(s) n’ont pas pu être chargés. Tu peux réessayer, ou jouer sans.`, true);
      });
  };
  $id('bootRetry').onclick = () => { b.asset = 0; start(); };
  $id('bootSkip').onclick = finish;
  const slow = setTimeout(() => { if (!finished && $id('bootActions').hidden) { $id('bootSkip').textContent = 'Ouvrir sans attendre'; b.problem('Réseau lent : le chargement continue.', true); $id('bootRetry').hidden = true; } }, 8000);
  start();
}
// indicateur « ↓ COMMANDES » : seulement si la page déborde (écrans très courts) et tant qu'on n'est pas en bas
function initScrollPill() {
  const pill = $('#scrollPill'), se = document.scrollingElement || document.documentElement;
  const check = () => {
    const over = se.scrollHeight > se.clientHeight + 8;
    const atEnd = se.scrollTop + se.clientHeight >= se.scrollHeight - 24;
    const hide = $('#app').hidden || !over || atEnd;
    if (pill.hidden !== hide) pill.hidden = hide; // n'écrire que si ça change (sinon boucle avec le MutationObserver)
  };
  pill.addEventListener('click', () => scrollBy({ top: se.clientHeight * 0.7, behavior: 'smooth' }));
  addEventListener('scroll', check, { passive: true }); addEventListener('resize', check);
  new ResizeObserver(check).observe(document.body);
  new MutationObserver(check).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  check();
}
function initFullscreen() {
  const ok = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled), btn = $('#btnFs');
  if (!ok) return;
  btn.hidden = false;
  const active = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  btn.addEventListener('click', async () => {
    try { if (active()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document); else await (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement); } catch { /* refusé */ }
  });
  document.addEventListener('fullscreenchange', () => btn.setAttribute('aria-pressed', String(active())));
}
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  const go = async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage('SKIP_WAITING'); }); });
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || reloaded || g.running) return; reloaded = true; location.reload(); });
    } catch { /* hors ligne non disponible */ }
  };
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
}

function init() {
  $('#ver').textContent = VERSION;
  if (DEBUG && SEED_Q != null) { $('#seedTag').hidden = false; $('#seedTag').textContent = ` · graine ${SEED_Q}`; }
  resetState();
  // secours silencieux : sous-titre seulement si la synthèse vocale manque (ou son coupé)
  setCaptionHandler((text, lie) => { const c = $('#caption'); c.textContent = text; c.classList.toggle('show', !!text); c.classList.toggle('lie', !!lie); });
  eye = createEye($('#eye'), { config: deepMerge(EYE, { radiusOfMin: 0.3, center: { x: 0.5, y: 0.5 } }), reducedMotion: reduced });
  eye.start();
  wire(); initFullscreen(); initScrollPill();
  showTime(TIME_S); showProb();
  requestAnimationFrame(loop);
  runBoot(() => { $('#btnStart').disabled = false; $('#btnStart').focus({ preventScroll: true }); registerSW(); });
  if (DEBUG) {
    window.__entiteDebug = {
      version: VERSION,
      get run() { return run; }, get state() { return g; }, get face() { return face; },
      voiceLog, voiceStats, musicStats, ttsAvailable,
      forceSabotage(on) { if (on) startSabotage(); else endSabotage(); },
      idle(ms) { g.lastInput = performance.now() - ms; },
    };
  }
}
init();
