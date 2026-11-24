// audio.js : bus WebAudio, musique de tension, voix de l'Entité (manifeste voix/manifest.json : mp3 si prêt, sinon synthèse française),
// routée dans un AnalyserNode pour animer l'œil.
import { loadManifest, sentence, allReady, fileOf } from './voice-manifest.js';
import { takePreloaded, MUSIC_URL } from './preload.js';

let ac = null, master, sfxBus, voiceBus, analyser, data, muted = false;
let musicBus, musicDuck, musicLP, music = null, musicBuf = null, musicLoad = null;
let bed = null, speaking = false, onCaption = () => {};
const buffers = new Map();
export const voiceStats = { fichier: 0, synthese: 0 };

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp).connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.connect(master);
  voiceBus = ac.createGain(); voiceBus.gain.value = 1;
  analyser = ac.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.6;
  data = new Uint8Array(analyser.fftSize);
  voiceBus.connect(analyser); voiceBus.connect(master);
  // musique : boucle → filtre → atténuation sous la voix → bus musique → master (donc coupée par le bouton son)
  musicBus = ac.createGain(); musicBus.gain.value = 0.0001; musicBus.connect(master);
  musicDuck = ac.createGain(); musicDuck.connect(musicBus);
  musicLP = ac.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 1400; musicLP.Q.value = 0.8; musicLP.connect(musicDuck);
  loadManifest();
  return ac;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.03);
  if (m && 'speechSynthesis' in window) speechSynthesis.cancel();
  if (m) stopBed();
}
export const isMuted = () => muted;
export function setCaptionHandler(fn) { onCaption = fn; }

// niveau de la voix 0..1 (RMS de l'analyseur)
export function voiceLevel() {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(data);
  let s = 0;
  for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; }
  return Math.min(1, Math.sqrt(s / data.length) * 4.5);
}

// Les effets (clics d'encodeur, servos, fiches banane…) sont dans sfx.js, branchés sur ce bus.
export function bus() { return ac ? { ac, out: sfxBus } : null; }

// ---------- voix (manifeste voix/manifest.json) ----------
// Règle : chaque id avec mp3Ready = true → voix/<id>.mp3 (repli synthèse française si échec).
// Un id pas prêt dans la suite → synthèse française de la phrase entière (aucun fichier demandé : 0 erreur 404).
// Pas de synthèse possible (ou son coupé) → sous-titre de secours via le gestionnaire de sous-titres.
export const ttsAvailable = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';

// Lit de voix : grondement grave filtré, modulé syllabe par syllabe, envoyé dans l'analyseur (anime l'œil).
function startBed() {
  if (!ac || bed) return;
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
  o1.type = 'sawtooth'; o1.frequency.value = 55; o2.type = 'sawtooth'; o2.frequency.value = 82.4; o2.detune.value = 7;
  f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 1.4;
  g.gain.value = 0.0001;
  o1.connect(f); o2.connect(f); f.connect(g).connect(voiceBus);
  o1.start(); o2.start();
  bed = { o1, o2, f, g, timer: 0 };
  const syll = () => {
    if (!bed) return;
    const t = ac.currentTime, peak = 0.05 + Math.random() * 0.07;
    bed.g.gain.cancelScheduledValues(t);
    bed.g.gain.setTargetAtTime(peak, t, 0.02);
    bed.g.gain.setTargetAtTime(0.01, t + 0.09 + Math.random() * 0.06, 0.05);
    bed.f.frequency.setTargetAtTime(260 + Math.random() * 380, t, 0.04);
    bed.timer = setTimeout(syll, 130 + Math.random() * 110);
  };
  syll();
}
function stopBed() {
  if (!bed) return;
  clearTimeout(bed.timer);
  const b = bed; bed = null;
  const t = ac.currentTime;
  b.g.gain.cancelScheduledValues(t);
  b.g.gain.setTargetAtTime(0.0001, t, 0.08);
  b.o1.stop(t + 0.5); b.o2.stop(t + 0.5);
}

let frVoice = null;
function pickVoice() {
  if (!ttsAvailable()) return null;
  const vs = speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang));
  // voix grave de préférence (noms masculins courants), sinon fr-CA, sinon fr-FR
  frVoice = vs.find((v) => /CA/i.test(v.lang) && /(thomas|nicolas|jean|henri|paul|male|homme)/i.test(v.name))
    || vs.find((v) => /(thomas|nicolas|jean|henri|paul|male|homme)/i.test(v.name))
    || vs.find((v) => /CA/i.test(v.lang)) || vs.find((v) => /FR/i.test(v.lang)) || vs[0] || null;
  return frVoice;
}
if (ttsAvailable()) speechSynthesis.addEventListener?.('voiceschanged', pickVoice);

let speakToken = 0;
const voiceFailed = new Set();
export const voiceLog = []; // [{ ids, mode, lie, t }] pour ?debug=1 et les tests

// speak(['clue_fragment', 'chiffre_4'], { lie }) → Promise résolue à la fin (ou à l'interruption)
export function speak(ids, { lie = false } = {}) {
  if (typeof ids === 'string') ids = [ids];
  const token = ++speakToken;
  if (ttsAvailable()) speechSynthesis.cancel();
  stopBed();
  speaking = true; duck(true);
  return new Promise((resolve) => {
    const done = () => {
      if (token !== speakToken) { resolve(false); return; }
      speaking = false; stopBed(); duck(false);
      setTimeout(() => token === speakToken && onCaption('', false), 1400);
      resolve(true);
    };
    loadManifest().then(() => {
      if (token !== speakToken) { resolve(false); return; }
      const mp3 = !!ac && allReady(ids) && !ids.some((id) => voiceFailed.has(id));
      voiceLog.push({ ids: ids.slice(), mode: mp3 ? 'mp3' : ttsAvailable() && !muted ? 'tts' : 'texte', lie, t: Math.round(performance.now()) });
      if (mp3) playSeq(ids, 0, token, done);
      else speakTTS(sentence(ids), token, done, lie);
    });
  });
}
async function playSeq(ids, i, token, done) {
  if (token !== speakToken) return;
  if (i >= ids.length) { done(); return; }
  try {
    const buf = await loadVoice(ids[i]);
    if (token !== speakToken) return;
    voiceStats.fichier++;
    await playBuffer(buf, token);
    playSeq(ids, i + 1, token, done);
  } catch {
    voiceFailed.add(ids[i]);
    if (token === speakToken) speakTTS(sentence(ids.slice(i)), token, done, false);
  }
}
function speakTTS(text, token, done, lie) {
  voiceStats.synthese++;
  const est = 1200 + text.length * 75;
  let fallback = setTimeout(done, est);
  // secours silencieux : pas de synthèse sur l'appareil, ou son coupé → sous-titre court
  if (!ttsAvailable() || muted) { onCaption(text, lie); return; }
  startBed();
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-CA'; u.voice = frVoice || pickVoice();
    u.pitch = lie ? 0.35 : 0.2; u.rate = lie ? 1.02 : 0.86; u.volume = 1; // grave et calme ; plus pressée quand elle ment
    u.onend = () => { clearTimeout(fallback); done(); };
    u.onerror = () => { clearTimeout(fallback); fallback = setTimeout(done, 300); };
    speechSynthesis.speak(u);
  } catch { onCaption(text, lie); }
}

function loadVoice(id) {
  if (buffers.has(id)) return Promise.resolve(buffers.get(id));
  return (async () => {
    const url = fileOf(id);
    let ab = await takePreloaded(url);
    if (!ab) { const res = await fetch(url); if (!res.ok) throw new Error('voix absente'); ab = await res.arrayBuffer(); }
    const buf = await ac.decodeAudioData(ab);
    buffers.set(id, buf);
    return buf;
  })();
}
let curSrc = null;
function playBuffer(buf, token) {
  return new Promise((resolve) => {
    const s = ac.createBufferSource(); s.buffer = buf; s.connect(voiceBus); curSrc = s;
    s.onended = () => { if (curSrc === s) curSrc = null; resolve(); }; s.start();
  });
}

export const isSpeaking = () => speaking;
export function stopVoice() {
  speakToken++; speaking = false; stopBed(); duck(false);
  try { curSrc?.stop(); } catch { /* déjà fini */ }
  if (ttsAvailable()) speechSynthesis.cancel();
  onCaption('', false);
}

// ---------- musique de tension ----------
// Boucle MusicGen (audio/tension.mp3) + une couche synthétisée (basse pulsée) qui monte avec l'intensité.
const MUSIC_VOL = 0.42;
const MUSIC_LOOP_S = 16;
export const musicStats = { etat: 'arret', fichier: false, intensite: 0, vitesse: 1, sousVoix: false };
function loadMusic() {
  if (!musicLoad) {
    musicLoad = Promise.resolve(takePreloaded(MUSIC_URL)).then((ab) => ab || fetch(MUSIC_URL).then((r) => { if (!r.ok) throw new Error('musique absente'); return r.arrayBuffer(); }))
      .then((ab) => ac.decodeAudioData(ab)).then((b) => { musicBuf = b; return b; })
      .catch(() => { musicLoad = null; return null; });
  }
  return musicLoad;
}
function duck(on) {
  if (!musicDuck) return;
  musicDuck.gain.setTargetAtTime(on ? 0.32 : 1, ac.currentTime, on ? 0.08 : 0.45);
  musicStats.sousVoix = on;
}
export function startMusic() {
  if (!ac) return;
  stopMusic('cut', true);
  const t = ac.currentTime;
  const m = music = { src: null, pulse: null, intensity: -1 };
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(0.0001, t);
  musicBus.gain.exponentialRampToValueAtTime(MUSIC_VOL, t + 2.5);
  musicLP.frequency.setValueAtTime(1400, t);
  // couche synthétisée : basse en dents de scie, filtrée, hachée par un LFO (pulsation) dont le tempo monte
  const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(), trem = ac.createGain();
  const lfo = ac.createOscillator(), lfoAmt = ac.createGain();
  o.type = 'sawtooth'; o.frequency.value = 41.2; o2.type = 'square'; o2.frequency.value = 82.4; o2.detune.value = -8;
  f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 6;
  lfo.type = 'square'; lfo.frequency.value = 2; lfoAmt.gain.value = 0.5; trem.gain.value = 0.5;
  lfo.connect(lfoAmt).connect(trem.gain);
  g.gain.value = 0.0001;
  o.connect(f); o2.connect(f); f.connect(trem).connect(g).connect(musicLP);
  o.start(t); o2.start(t); lfo.start(t);
  m.pulse = { o, o2, f, g, lfo };
  musicStats.etat = 'joue'; musicStats.fichier = false;
  loadMusic().then((buf) => {
    if (!buf || music !== m) return;
    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    // boucle de 16,000 s : si le décodeur garde le délai de l'encodeur MP3 (1105 échantillons), on le saute
    if (buf.duration > MUSIC_LOOP_S + 0.01) { src.loopStart = 1105 / 44100; src.loopEnd = src.loopStart + MUSIC_LOOP_S; }
    src.connect(musicLP); src.start(0, src.loopStart || 0);
    m.src = src; musicStats.fichier = true;
    setMusicIntensity(Math.max(0, m.intensity), true);
  });
  setMusicIntensity(0, true);
}
// x = 0 (calme) .. 1 (dernières secondes)
export function setMusicIntensity(x, force = false) {
  const m = music;
  if (!m || !ac) return;
  const q = Math.round(x * 50) / 50;
  if (!force && q === m.intensity) return;
  m.intensity = q;
  const t = ac.currentTime, k = 0.6;
  const rate = 1 + 0.14 * q; // tempo de la boucle : +14 % au maximum
  if (m.src) m.src.playbackRate.setTargetAtTime(rate, t, k);
  musicLP.frequency.setTargetAtTime(1400 + 9000 * q * q, t, k); // le filtre s'ouvre
  const p = m.pulse;
  p.g.gain.setTargetAtTime(0.02 + 0.2 * q, t, k);
  p.lfo.frequency.setTargetAtTime(2 + 6 * q, t, k); // pulsation 2 → 8 Hz
  p.f.frequency.setTargetAtTime(220 + 900 * q, t, k);
  musicStats.intensite = q; musicStats.vitesse = rate;
}
// 'fade' = fondu lent (victoire), 'cut' = coupure rapide (explosion)
export function stopMusic(kind = 'fade', silent = false) {
  const m = music;
  if (!m || !ac) return;
  music = null;
  const t = ac.currentTime, dur = kind === 'fade' ? 3 : 0.12;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), t);
  musicBus.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const end = t + dur + 0.05;
  try { m.src?.stop(end); m.pulse.o.stop(end); m.pulse.o2.stop(end); m.pulse.lfo.stop(end); } catch { /* déjà arrêté */ }
  if (!silent) musicStats.etat = kind === 'fade' ? 'fondu' : 'coupee';
}
