// Test v0.2.0 : partie complète avec graine (?seed=42&debug=1), portrait 412x915 + paysage 915x412.
// Vérifie : 0 erreur console/page/réseau, pas de débordement horizontal, aucune réponse écrite à l'écran,
// aucun RFID/badge, ElevenLabs intro/depart + tension servis aux bonnes tailles, manifeste des voix,
// mensonges (œil rouge), sabotage du joystick (axes inversés), hésitation (le temps accélère), TRANSMIT.
// Usage : node tests/v020.mjs [base] [graine]   (serveur local : python3 -m http.server 8794)
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:8794/';
const SEED = +(process.argv[3] || 42);
const shots = '/workspace/qa/entite-mallette/v0.2.0-dev/';
mkdirSync(shots, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const R = { checks: {}, errors: [] };
const ok = (k, v, extra) => { R.checks[k] = v ? 'PASS' : `FAIL${extra ? ' ' + JSON.stringify(extra) : ''}`; };

async function page(vp) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = [], reqs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('page: ' + e.message));
  p.on('requestfailed', (r) => errs.push('failed: ' + r.url()));
  p.on('response', (r) => { reqs.push(r.url()); if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
  await p.goto(`${base}?seed=${SEED}&debug=1`);
  await p.waitForSelector('#btnStart:not([disabled])', { timeout: 20000 });
  await p.waitForSelector('#boot', { state: 'hidden' });
  return { ctx, p, errs, reqs };
}
const W = (p, ms) => p.waitForTimeout(ms);
const D = (p, f, a) => p.evaluate(f, a);
const overflow = (p) => D(p, () => document.documentElement.scrollWidth - innerWidth);

// ================= portrait : partie complète =================
try {
  const { ctx, p, errs, reqs } = await page({ width: 412, height: 915 });
  ok('aucun RFID ni badge (DOM)', await D(p, () => !document.querySelector('.badge, .rf-ring, [class*="rfid" i], [id*="rfid" i]') && !/RFID|badge|RC522/i.test(document.body.innerText + document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, ''))));
  ok('pas de manuel.html', await D(p, () => !document.querySelector('a[href*="manuel"]')));
  await p.screenshot({ path: shots + '01-accueil-412.png' });
  await p.tap('#btnStart'); await W(p, 400);
  ok('armement : face Dessus', (await D(p, () => __entiteDebug.face)) === 'dessus');
  ok('dessus sans débordement', (await overflow(p)) <= 0);
  await p.tap('.latch[data-latch="0"] .lock-btn'); await p.tap('.latch[data-latch="1"] .lock-btn'); await W(p, 900);
  ok('armement : face Flanc', (await D(p, () => __entiteDebug.face)) === 'flancs');
  ok('flanc sans débordement', (await overflow(p)) <= 0);
  ok('flanc : cache + fiches + plaque, rien d’autre', await D(p, () => !!document.querySelector('#guard') && document.querySelectorAll('.jack').length === 5 && !!document.querySelector('#serialPlate')));
  await p.tap('#cover'); await W(p, 300); await p.tap('#lever'); await W(p, 1200);
  const run = await D(p, () => JSON.parse(JSON.stringify(__entiteDebug.run)));
  R.seed = run.seed; R.tier = run.tier; R.serial = run.serial;
  ok('partie lancée, étape 1, face Mallette', await D(p, () => __entiteDebug.state.phase === 'play' && __entiteDebug.state.step === 1 && __entiteDebug.face === 'mallette'));
  const step = () => D(p, () => __entiteDebug.state.step);
  const st = () => D(p, () => ({ step: __entiteDebug.state.step, errors: __entiteDebug.state.errors, rem: __entiteDebug.state.remaining }));
  const setEnc = async (target) => {
    for (let i = 0; i < 4; i++) {
      const cur = await D(p, (k) => __entiteDebug.state.enc[k], i);
      const d = (target[i] - cur + 10) % 10, up = d <= 5, n = up ? d : 10 - d;
      for (let k = 0; k < n; k++) await p.tap(`.enc[data-i="${i}"] .enc-step.${up ? 'plus' : 'minus'}`);
    }
  };
  const keys = async (s) => { for (const c of s) { await p.tap(`.kp-key[data-k="${c}"]`); } };
  const inv = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const walk = async (path) => {
    for (const d of path) { const sab = await D(p, () => __entiteDebug.state.sabotage); await p.tap(`.joy-dir.${sab ? inv[d] : d}`); }
  };

  // 1. encodeurs (et mensonge quand deux encodeurs sont justes)
  await setEnc(run.enc1); await W(p, 450);
  const liarSeen = await D(p, () => document.querySelector('#cyd1').classList.contains('liar'));
  await p.tap('.enc[data-i="0"] .knob'); await W(p, 500);
  ok('1 encodeurs → 2', (await step()) === 2);
  ok('mensonge : œil rouge pendant la réplique', liarSeen || (await D(p, () => __entiteDebug.voiceLog.some((v) => v.lie))));
  // raccourci TRANSMIT trop tôt = erreur (-8 s)
  const before = await st(); await p.dispatchEvent('#transmit', 'pointerdown'); await p.dispatchEvent('#transmit', 'pointerup'); const after = await st();
  ok('TRANSMIT trop tôt = erreur', after.errors === before.errors + 1 && before.rem - after.rem >= 7.9, { before, after });
  // 2. trappe
  await p.tap(`.trap[data-i="${run.trap}"] .trap-door`); await W(p, 500);
  ok('2 trappe → 3', (await step()) === 3);
  // 3. séquence lumineuse sur le clavier
  await keys(run.seqCode); await W(p, 500);
  ok('3 séquence → 4', (await step()) === 4);
  // 4. fils (flanc)
  await p.tap('#tab-flancs'); await p.tap(`.jack[data-i="${run.wires1.cut}"] .plug`); await W(p, 500);
  ok('4 fils → 5', (await step()) === 5);
  await p.tap('#tab-mallette'); await W(p, 200);
  // 5. verrou de signal
  await walk(run.maze1.path); await W(p, 500);
  ok('5 verrou → 6', (await step()) === 6);
  // aucune réponse écrite à l'écran (code, séquence, fragments)
  const txt = await D(p, () => document.body.innerText.replace(/\s+/g, ''));
  ok('aucun code ni consigne écrit', !txt.includes(run.code1) && !txt.includes(run.seqCode) && !/Fragment|Règle|débranche/i.test(txt), { code: run.code1 });
  // 6. code 1
  await keys(run.code1); await W(p, 600);
  ok('6 code 1 → 7', (await step()) === 7);
  // 7. clés (dessus)
  await p.tap('#tab-dessus');
  for (const k of run.keyOrder) await p.tap(`.lock.key[data-key="${k}"] .lock-btn`, { timeout: 4000 });
  await W(p, 500);
  ok('7 clés → 8', (await step()) === 8);
  await p.tap('#tab-mallette'); await W(p, 200);
  // hésitation : 15 s sans geste → le temps accélère
  await D(p, () => __entiteDebug.idle(16000)); await W(p, 200);
  const hes = await D(p, () => ({ h: __entiteDebug.state.hesitating, r: __entiteDebug.state.rate, cls: document.body.classList.contains('hesitate') }));
  ok('hésitation : chrono x1,6', hes.h && hes.r === 1.6 && hes.cls, hes);
  // 8. encodeurs 2
  await setEnc(run.enc2); await p.tap('.enc[data-i="1"] .knob'); await W(p, 500);
  ok('hésitation levée au geste', await D(p, () => !__entiteDebug.state.hesitating && __entiteDebug.state.rate === 1));
  ok('8 encodeurs 2 → 9', (await step()) === 9);
  // 9. verrou saboté : axes inversés quand l'œil est rouge
  await D(p, () => __entiteDebug.forceSabotage(true)); await W(p, 150);
  const d0 = run.maze2.path[0], p0 = await D(p, () => __entiteDebug.state.pos.slice());
  await p.tap(`.joy-dir.${inv[d0]}`); await W(p, 100);
  const p1 = await D(p, () => __entiteDebug.state.pos.slice());
  const dv = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d0];
  ok('sabotage : axes inversés', p1[0] === p0[0] + dv[0] && p1[1] === p0[1] + dv[1], { p0, p1, d0 });
  ok('sabotage : œil rouge + CYD 2 rouge', await D(p, () => document.querySelector('.cyd2').classList.contains('sab')));
  await p.screenshot({ path: shots + '02-mallette-412-sabotage.png' });
  await D(p, () => __entiteDebug.forceSabotage(false));
  await walk(run.maze2.path.slice(1)); await W(p, 500);
  ok('9 verrou saboté → 10', (await step()) === 10);
  // 10. fils 2
  await p.tap('#tab-flancs'); await p.tap(`.jack[data-i="${run.wires2.cut}"] .plug`); await W(p, 500);
  ok('10 fils 2 → 11', (await step()) === 11);
  await p.tap('#tab-mallette');
  // 11. code 2
  await keys(run.code2); await W(p, 500);
  ok('11 code 2 → 12', (await step()) === 12);
  // 12. TRANSMIT maintenu 2 s
  await p.dispatchEvent('#transmit', 'pointerdown'); await W(p, 2300); await p.dispatchEvent('#transmit', 'pointerup');
  await W(p, 2600);
  ok('12 TRANSMIT → victoire', await D(p, () => __entiteDebug.state.result === 'win' && !document.querySelector('#end').hidden));
  ok('mallette sans débordement', (await overflow(p)) <= 0);
  const vl = await D(p, () => __entiteDebug.voiceLog);
  R.voix = { repliques: vl.length, mensonges: vl.filter((v) => v.lie).length, modes: [...new Set(vl.map((v) => v.mode))], intro: vl.find((v) => v.ids[0] === 'intro')?.mode, depart: vl.find((v) => v.ids[0] === 'depart')?.mode };
  ok('voix ElevenLabs intro + depart jouées en mp3', R.voix.intro === 'mp3' && R.voix.depart === 'mp3', R.voix);
  ok('aucune requête vers un mp3 non prêt', !reqs.some((u) => /voix\/(?!intro|depart)[^/]+\.mp3/.test(u)));
  R.errors.push(...errs.map((e) => 'portrait ' + e));
  R.result = await D(p, () => ({ errors: __entiteDebug.state.errors, remaining: Math.round(__entiteDebug.state.remaining) }));
  await ctx.close();
} catch (e) { R.checks['portrait : exception'] = 'FAIL ' + e.message.split('\n')[0]; }

// ================= paysage 915x412 =================
{
  const { ctx, p, errs } = await page({ width: 915, height: 412 });
  ok('paysage accueil sans débordement', (await overflow(p)) <= 0);
  await p.tap('#btnStart'); await W(p, 300);
  await p.tap('.latch[data-latch="0"] .lock-btn'); await p.tap('.latch[data-latch="1"] .lock-btn'); await W(p, 800);
  ok('paysage flanc sans débordement', (await overflow(p)) <= 0);
  await p.tap('#cover'); await W(p, 300); await p.tap('#lever'); await W(p, 1300);
  ok('paysage mallette sans débordement', (await overflow(p)) <= 0);
  const vis = await D(p, () => ['#eye', '#btnReplay', '.knob', '#cyd2', '#joy', '#keypad', '#transmit', '.face-tab'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [s, r.width > 0 && r.left >= 0 && r.right <= innerWidth + 0.5]; }));
  ok('paysage : commandes clés visibles en largeur', vis.every((v) => v[1]), vis);
  const small = await D(p, () => [...document.querySelectorAll('#face-mallette button, .face-tab, .icon-btn')].filter((e) => e.offsetParent && !e.hidden).map((e) => { const r = e.getBoundingClientRect(); return [e.className, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 32 || h < 32));
  ok('cibles tactiles ≥ 32 px (44 px visé)', small.length === 0, small);
  await p.screenshot({ path: shots + '03-mallette-915x412.png' });
  R.errors.push(...errs.map((e) => 'paysage ' + e));
  await ctx.close();
}

// ================= fichiers servis =================
{
  const ctx = await b.newContext();
  const size = async (u) => { const r = await ctx.request.get(base + u); return [r.status(), (await r.body()).length]; };
  R.fichiers = { 'voix/intro.mp3': await size('voix/intro.mp3'), 'voix/depart.mp3': await size('voix/depart.mp3'), 'audio/tension.mp3': await size('audio/tension.mp3'), 'manuel.html': (await size('manuel.html'))[0] };
  ok('intro 41318 B', R.fichiers['voix/intro.mp3'][0] === 200 && R.fichiers['voix/intro.mp3'][1] === 41318);
  ok('depart 63783 B', R.fichiers['voix/depart.mp3'][0] === 200 && R.fichiers['voix/depart.mp3'][1] === 63783);
  ok('tension 192827 B', R.fichiers['audio/tension.mp3'][0] === 200 && R.fichiers['audio/tension.mp3'][1] === 192827);
  ok('manuel.html absent', R.fichiers['manuel.html'] === 404);
  const man = await (await ctx.request.get(base + 'voix/manifest.json')).json();
  const ready = man.cues.filter((c) => c.mp3Ready).map((c) => c.id);
  ok('manifeste : seuls intro + depart prêts (ElevenLabs)', ready.join() === 'intro,depart' && man.cues.filter((c) => c.mp3Ready).every((c) => c.source === 'elevenlabs'));
  ok('manifeste : aucun badge/RFID', !man.cues.some((c) => /badge|rfid/i.test(c.id + c.text)));
  ok('manifeste : schéma complet', man.cues.every((c) => c.id && c.file === `voix/${c.id}.mp3` && /^\d{4}$/.test(c.dfplayerTrack) && ['intro', 'clue', 'digit', 'color', 'taunt', 'sabotage', 'outcome'].includes(c.category) && c.text));
  R.manifeste = { repliques: man.cues.length };
  const sw = await (await ctx.request.get(base + 'sw.js')).text();
  ok('sw : cache entite-mallette-v0.2.0 (manifeste, sans manuel)', sw.includes("`entite-mallette-v${VERSION}`") && sw.includes("const VERSION = '0.2.0'") && sw.includes('voix/manifest.json') && !sw.includes('manuel'));
  await ctx.close();
}
ok('0 erreur console / page / réseau', R.errors.length === 0, R.errors);
await b.close();
const fails = Object.entries(R.checks).filter(([, v]) => v !== 'PASS');
console.log(JSON.stringify(R, null, 1));
console.log(fails.length ? `ÉCHEC : ${fails.length} vérification(s)` : `PASS : ${Object.keys(R.checks).length} vérifications`);
process.exit(fails.length ? 1 : 0);
