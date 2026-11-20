// audio.js : sons synthétisés (WebAudio) + voix de l'Entité routée dans un AnalyserNode pour animer l'œil.
import { LINES, VOICE_LIST, voiceUrl } from './voix.js';

let ac = null, master, sfxBus, voiceBus, analyser, data, muted = false;
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
  loadVoiceList();
  return ac;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.03);
  if (m && 'speechSynthesis' in window) speechSynthesis.cancel();
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

// ---------- effets ----------
function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, attack = 0.004 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  env(g, t, attack, dur, vol);
  o.connect(g).connect(sfxBus); o.start(t); o.stop(t + attack + dur + 0.05);
}
function noise(dur, { vol = 0.3, at = 0, lp = 1200, hp = 0, q = 0.7 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at, len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = q;
  const g = ac.createGain(); env(g, t, 0.005, dur, vol);
  let node = src.connect(f);
  if (hp) { const h = ac.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; node = node.connect(h); }
  node.connect(g).connect(sfxBus); src.start(t); src.stop(t + dur + 0.05);
}

export const sfx = {
  tick(urgent) { tone(urgent ? 1900 : 1250, 0.03, { type: 'square', vol: urgent ? 0.08 : 0.045 }); },
  key() { tone(2400, 0.05, { type: 'square', vol: 0.06 }); },
  click() { noise(0.025, { vol: 0.35, lp: 5000, hp: 1500 }); tone(180, 0.04, { vol: 0.12 }); },
  cover() { noise(0.06, { vol: 0.2, lp: 2500, hp: 400 }); tone(420, 0.06, { type: 'triangle', vol: 0.08, slide: 0.6 }); },
  keyTurn() { noise(0.05, { vol: 0.3, lp: 3500, hp: 900 }); noise(0.04, { vol: 0.3, lp: 3500, hp: 900, at: 0.09 }); tone(90, 0.12, { vol: 0.15, at: 0.09 }); },
  rfid() { tone(1760, 0.07, { type: 'square', vol: 0.06 }); tone(2640, 0.12, { type: 'square', vol: 0.06, at: 0.09 }); },
  ok() { tone(880, 0.09, { type: 'triangle', vol: 0.14 }); tone(1320, 0.16, { type: 'triangle', vol: 0.12, at: 0.08 }); },
  error() { tone(160, 0.22, { type: 'sawtooth', vol: 0.16 }); tone(150, 0.22, { type: 'square', vol: 0.08, at: 0.02 }); },
  snip() { noise(0.05, { vol: 0.5, lp: 7000, hp: 2500 }); tone(3000, 0.03, { type: 'square', vol: 0.05, at: 0.01, slide: 0.4 }); },
  scan() { tone(600, 0.6, { type: 'sine', vol: 0.05, slide: 2.2, attack: 0.05 }); },
  alarm() { for (let i = 0; i < 3; i++) tone(980, 0.12, { type: 'square', vol: 0.09, at: i * 0.18 }); },
  servo() { tone(130, 0.55, { type: 'sawtooth', vol: 0.05, slide: 1.4, attack: 0.03 }); noise(0.55, { vol: 0.08, lp: 1800, hp: 600 }); noise(0.04, { vol: 0.35, lp: 4000, hp: 800, at: 0.58 }); },
  pickup() { tone(1480, 0.06, { type: 'triangle', vol: 0.1 }); tone(1975, 0.1, { type: 'triangle', vol: 0.09, at: 0.06 }); noise(0.05, { vol: 0.2, lp: 6000, hp: 3000 }); },
  hold() { tone(70, 1.5, { type: 'sawtooth', vol: 0.1, slide: 3, attack: 0.05 }); },
  boom() {
    noise(2.6, { vol: 1, lp: 900, q: 0.4 });
    noise(0.35, { vol: 0.8, lp: 6000 });
    tone(70, 2.2, { vol: 0.8, slide: 0.3, attack: 0.002 });
    tone(42, 2.8, { type: 'triangle', vol: 0.5, slide: 0.5 });
  },
  defused() {
    [523.25, 392, 311.13, 196].forEach((f, i) => tone(f, 1.4, { type: 'sine', vol: 0.12, at: i * 0.22, attack: 0.02 }));
    tone(98, 3, { type: 'triangle', vol: 0.12, attack: 0.3 });
  },
};

// ---------- voix ----------
// Lit de voix : grondement grave filtré, modulé syllabe par syllabe, envoyé dans l'analyseur.
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
    const t = ac.currentTime, peak = 0.12 + Math.random() * 0.16;
    bed.g.gain.cancelScheduledValues(t);
    bed.g.gain.setTargetAtTime(peak, t, 0.02);
    bed.g.gain.setTargetAtTime(0.02, t + 0.09 + Math.random() * 0.06, 0.05);
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
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang));
  frVoice = vs.find((v) => /CA/i.test(v.lang)) || vs.find((v) => /FR/i.test(v.lang)) || vs[0] || null;
  return frVoice;
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', pickVoice);

let speakToken = 0;
export function speak(id) {
  const text = LINES[id];
  if (!text) return;
  const token = ++speakToken;
  onCaption(text);
  const done = () => {
    if (token !== speakToken) return;
    speaking = false; stopBed();
    setTimeout(() => token === speakToken && onCaption(''), 1600);
  };
  speaking = true;
  if (ac && !listDone && listPromise) {
    // la liste des voix arrive : attendre au plus 500 ms avant de choisir fichier ou synthèse
    Promise.race([listPromise, new Promise((r) => setTimeout(r, 500))]).then(() => token === speakToken && route(id, text, token, done));
    return;
  }
  route(id, text, token, done);
}

function route(id, text, token, done) {
  if (ac && voiceAvail.has(id) && !voiceFailed.has(id)) {
    loadVoice(id).then((buf) => {
      if (token !== speakToken) return;
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      voiceStats.fichier++;
      playBuffer(buf).then(done, done);
    }, () => { voiceFailed.add(id); if (token === speakToken) speakTTS(text, token, done); });
    return;
  }
  speakTTS(text, token, done);
}

function speakTTS(text, token, done) {
  voiceStats.synthese++;
  if (!muted) startBed();
  const est = 900 + text.length * 70;
  let fallback = setTimeout(done, est);
  if ('speechSynthesis' in window && !muted) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-CA'; u.voice = frVoice || pickVoice(); u.pitch = 0.15; u.rate = 0.82; u.volume = 1;
      u.onend = () => { clearTimeout(fallback); done(); };
      u.onerror = () => { clearTimeout(fallback); fallback = setTimeout(done, est); };
      speechSynthesis.speak(u);
    } catch { /* la sous-ligne et le grondement suffisent */ }
  }
}

// ---------- voix enregistrées (bot Voix) ----------
const voiceAvail = new Set(), voiceFailed = new Set(), loading = new Map();
let listPromise = null, listDone = false;
function loadVoiceList() {
  if (!listPromise) listPromise = fetchVoiceList().finally(() => { listDone = true; });
  return listPromise;
}
async function fetchVoiceList() {
  try {
    const res = await fetch(VOICE_LIST, { cache: 'no-cache' });
    if (!res.ok) return;
    const data = await res.json();
    for (const id of data.files || []) if (LINES[id]) voiceAvail.add(id);
    // préchargement doux des premières répliques
    ['intro', 'depart'].forEach((id) => voiceAvail.has(id) && loadVoice(id).catch(() => voiceFailed.add(id)));
  } catch { /* pas de liste : synthèse vocale */ }
}
function loadVoice(id) {
  if (buffers.has(id)) return Promise.resolve(buffers.get(id));
  if (!loading.has(id)) {
    loading.set(id, (async () => {
      const res = await fetch(voiceUrl(id));
      if (!res.ok) throw new Error('voix absente');
      const ab = await res.arrayBuffer();
      const buf = await ac.decodeAudioData(ab);
      buffers.set(id, buf);
      return buf;
    })().catch((e) => { loading.delete(id); throw e; }));
  }
  return loading.get(id);
}
function playBuffer(buf) {
  return new Promise((resolve) => {
    const s = ac.createBufferSource(); s.buffer = buf; s.connect(voiceBus); s.onended = resolve; s.start();
  });
}

export const isSpeaking = () => speaking;
export function stopVoice() { speakToken++; speaking = false; stopBed(); if ('speechSynthesis' in window) speechSynthesis.cancel(); onCaption(''); }
