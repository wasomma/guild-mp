import { rand } from "@shared/sim.js";

/* ===== chiptune audio engine (Web Audio, no dependencies) ===== */
const AUDIO = { ctx: null, master: null, muted: false, musicT: 0 };
export function audioInit() {
  if (AUDIO.ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    AUDIO.ctx = new AC();
    AUDIO.master = AUDIO.ctx.createGain();
    AUDIO.master.gain.value = AUDIO.muted ? 0 : 0.5;
    const comp = AUDIO.ctx.createDynamicsCompressor();
    AUDIO.master.connect(comp); comp.connect(AUDIO.ctx.destination);
    return true;
  } catch { return false; }
}
export function audioResume() { if (AUDIO.ctx && AUDIO.ctx.state === "suspended") AUDIO.ctx.resume(); }
export function setAudioMuted(m) { AUDIO.muted = m; if (AUDIO.master) AUDIO.master.gain.value = m ? 0 : 0.5; }
function tone(freq, dur, type, vol, slide, delay) {
  if (!AUDIO.ctx || AUDIO.muted) return;
  const t0 = AUDIO.ctx.currentTime + (delay || 0);
  const o = AUDIO.ctx.createOscillator();
  const gn = AUDIO.ctx.createGain();
  o.type = type || "square";
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
  gn.gain.setValueAtTime(0, t0);
  gn.gain.linearRampToValueAtTime(vol || 0.15, t0 + 0.005);
  gn.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(gn); gn.connect(AUDIO.master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noiseHit(dur, vol, delay, hp) {
  if (!AUDIO.ctx || AUDIO.muted) return;
  const t0 = AUDIO.ctx.currentTime + (delay || 0);
  const len = Math.max(1, Math.floor(AUDIO.ctx.sampleRate * dur));
  const buf = AUDIO.ctx.createBuffer(1, len, AUDIO.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = AUDIO.ctx.createBufferSource(); src.buffer = buf;
  const f = AUDIO.ctx.createBiquadFilter(); f.type = hp ? "highpass" : "lowpass"; f.frequency.value = hp ? 2000 : 900;
  const gn = AUDIO.ctx.createGain();
  gn.gain.setValueAtTime(vol || 0.1, t0);
  gn.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  src.connect(f); f.connect(gn); gn.connect(AUDIO.master);
  src.start(t0);
}
export const sfx = {
  hit() { tone(rand(190, 230), 0.07, "square", 0.10, 120); noiseHit(0.04, 0.05, 0, true); },
  crit() { tone(340, 0.09, "square", 0.13, 180); tone(510, 0.12, "square", 0.11, 260, 0.05); },
  hurt() { tone(140, 0.09, "sawtooth", 0.06, 90); },
  kill() { tone(300, 0.16, "triangle", 0.12, 60); },
  coin() { tone(988, 0.07, "square", 0.06); tone(1319, 0.16, "square", 0.06, undefined, 0.07); },
  loot() { tone(660, 0.08, "triangle", 0.1); tone(880, 0.1, "triangle", 0.1, undefined, 0.08); tone(1100, 0.14, "triangle", 0.1, undefined, 0.16); },
  level() { [523, 659, 784, 1047].forEach((f2, i) => tone(f2, 0.12, "square", 0.1, undefined, i * 0.08)); },
  heal() { tone(700, 0.16, "sine", 0.07, 1050); },
  shoot() { noiseHit(0.08, 0.06, 0, true); tone(900, 0.05, "sine", 0.03, 500); },
  fall() { [392, 311, 233, 155].forEach((f2, i) => tone(f2, 0.15, "triangle", 0.11, undefined, i * 0.1)); },
  res() { [261, 392, 523, 784].forEach((f2, i) => tone(f2, 0.14, "triangle", 0.1, undefined, i * 0.07)); },
  boss() { tone(65, 0.9, "sawtooth", 0.15, 55); tone(98, 0.7, "sawtooth", 0.09, 82, 0.1); noiseHit(0.5, 0.05); },
  elite() { tone(110, 0.4, "sawtooth", 0.11, 90); },
  potion() { tone(500, 0.05, "sine", 0.07, 700); tone(760, 0.07, "sine", 0.06, 900, 0.06); },
  stun() { tone(600, 0.18, "square", 0.06, 300); },
  enrage() { tone(180, 0.3, "sawtooth", 0.11, 320); noiseHit(0.2, 0.05); },
  rise() { tone(220, 0.35, "sawtooth", 0.08, 110); },
  split() { tone(420, 0.1, "sine", 0.08, 240); tone(360, 0.1, "sine", 0.08, 200, 0.07); },
  prestige() { [523, 659, 784, 659, 784, 1047].forEach((f2, i) => tone(f2, 0.16, "square", 0.1, undefined, i * 0.11)); },
  wipe() { tone(200, 0.6, "sawtooth", 0.09, 60); },
  clink() { tone(1250, 0.09, "triangle", 0.07); tone(1180, 0.12, "triangle", 0.06, undefined, 0.015); noiseHit(0.03, 0.03, 0, true); },
  cheer() { [262, 330, 392, 523].forEach((f2) => tone(f2, 0.22, "square", 0.045)); noiseHit(0.18, 0.05, 0, true); tone(392, 0.3, "triangle", 0.05, 300, 0.05); },
  warn() { tone(440, 0.09, "square", 0.08, 660); tone(660, 0.12, "square", 0.08, 990, 0.1); },
  slam() { tone(70, 0.35, "sawtooth", 0.16, 40); noiseHit(0.3, 0.12); },
  screech() { tone(1600, 0.45, "sawtooth", 0.07, 500); tone(1900, 0.3, "square", 0.04, 700, 0.05); },
  meteor() { noiseHit(0.4, 0.09); tone(900, 0.35, "sine", 0.06, 120); tone(700, 0.3, "sine", 0.05, 90, 0.12); },
  ult() { tone(392, 0.1, "square", 0.1, 784); tone(784, 0.2, "square", 0.09, undefined, 0.09); noiseHit(0.08, 0.04, 0, true); },
  unique() { [784, 988, 1319, 1568].forEach((f2, i) => tone(f2, 0.12, "triangle", 0.09, undefined, i * 0.06)); tone(392, 0.5, "sine", 0.05, undefined, 0.12); },
  chorus() { tone(523, 0.28, "triangle", 0.06); tone(659, 0.28, "triangle", 0.06, undefined, 0.03); tone(784, 0.34, "triangle", 0.05, undefined, 0.07); },
  quest() { tone(659, 0.12, "square", 0.07); tone(784, 0.12, "square", 0.07, undefined, 0.1); tone(1047, 0.28, "square", 0.08, undefined, 0.2); },
};
/* a sparse generative music box, tuned per zone, silent when the world sleeps */
const ZONE_SCALES = [
  [392, 440, 494, 587, 659, 784],
  [330, 392, 440, 494, 587, 659],
  [294, 349, 392, 440, 523, 587],
  [262, 311, 349, 392, 466, 523],
];
export function musicTick(g, dt) {
  if (!AUDIO.ctx || AUDIO.muted) return;
  if (!g.members || !g.members.length) return;
  AUDIO.musicT -= dt;
  if (AUDIO.musicT > 0) return;
  if (g.phase === "feast") {
    /* a bouncy mead-hall jig */
    AUDIO.musicT = 0.21;
    AUDIO.step = (AUDIO.step || 0) + 1;
    const TUNE = [392, 494, 587, 494, 659, 587, 494, 440, 392, 494, 587, 659, 784, 659, 587, 494];
    const n = TUNE[AUDIO.step % TUNE.length];
    tone(n, 0.18, "square", 0.05);
    if (AUDIO.step % 4 === 0) tone(n / 2, 0.34, "triangle", 0.05);
    if (AUDIO.step % 8 === 6) tone(n * 1.5, 0.12, "square", 0.03);
    return;
  }
  AUDIO.musicT = 0.42;
  if (Math.random() < 0.45) return;
  const scale = ZONE_SCALES[Math.floor((g.stage - 1) / 5) % ZONE_SCALES.length];
  const n = scale[Math.floor(Math.random() * scale.length)];
  tone(n * (Math.random() < 0.25 ? 2 : 1), 0.5, "triangle", 0.026);
  if (Math.random() < 0.18) tone(n / 2, 0.9, "sine", 0.018);
}
