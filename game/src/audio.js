// Audio: layered, noise/transient-based SFX through a compressor + reverb. Music is percussion + drone driven (no arpeggio melodies).
let ctx = null, master = null, bus = null, revSend = null, noiseBuf = null, pinkBuf = null;
export let muted = false;
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; }
function makeImpulse(sec, decay) {
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1); }
  return b;
}
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    bus = ctx.createGain(); bus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse(1.2, 3.6); revSend = ctx.createGain(); revSend.gain.value = 0.1;
    const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 3000; revSend.connect(conv); conv.connect(rl); rl.connect(bus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    pinkBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const p = pinkBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < p.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; p[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25; }
  } catch (e) { ctx = null; }
}
const rnd = (a, b) => a + Math.random() * (b - a);
/* ---------- primitives (all take an absolute start time t) ---------- */
function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, dur)); }
function out(node, wet = 0.15, dest) { node.connect(dest || bus); if (wet > 0 && !dest) { const s = ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(revSend); } }
// thump: pitch-dropping sine/triangle body
function thump(t, f0, f1, dur, vol, wet = 0.1, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * 0.85);
  env(g, t, 0.003, vol, dur); o.connect(g); out(g, wet); o.start(t); o.stop(t + dur + 0.05);
}
// shaped noise burst: filter sweep f0->f1, attack a, total dur
function nz(t, dur, vol, f0, f1, type = 'bandpass', q = 0.9, a = 0.004, wet = 0.1, pink = false) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = pink ? pinkBuf : noiseBuf; s.loop = true; fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  env(g, t, a, vol, dur); s.connect(fl); fl.connect(g); out(g, wet); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
// metallic / glassy: inharmonic partials with individual decays
const MET = [1, 2.76, 5.4, 8.93, 13.34];
function metal(t, f, dur, vol, ratios = MET, wet = 0.3) {
  ratios.forEach((r, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * r * rnd(0.995, 1.005); env(g, t, 0.001, vol / (1 + i * 0.7), dur / (1 + i * 0.5)); o.connect(g); out(g, wet); o.start(t); o.stop(t + dur + 0.05); });
}
// dark filtered buzz (saw through lowpass) for energy/magic textures, with optional vibrato-free pitch glide
function buzz(t, f0, f1, dur, vol, cut = 900, wet = 0.2, type = 'sawtooth') {
  const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(Math.max(60, cut * 0.25), t + dur); env(g, t, Math.min(0.05, dur * 0.2), vol, dur); o.connect(fl); fl.connect(g); out(g, wet); o.start(t); o.stop(t + dur + 0.05);
}
// gain-flutter noise (crackle / sizzle)
function crackle(t, dur, vol, f, rate = 40) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 0.7;
  lfo.type = 'square'; lfo.frequency.value = rate * rnd(0.8, 1.3); lg.gain.value = vol * 0.6; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lfo.connect(lg); lg.connect(g.gain); s.connect(fl); fl.connect(g); out(g, 0.15); s.start(t, Math.random()); lfo.start(t); s.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
const now = () => ctx.currentTime + 0.005;
/* ---------- sound effects ---------- */
const S = {
  hit() { const t = now(), v = rnd(0.9, 1.15); thump(t, 170 * v, 55, 0.13, 0.55, 0.06); nz(t, 0.07, 0.5, 2600 * v, 500, 'bandpass', 0.8, 0.001, 0.05); nz(t, 0.025, 0.4, 5000, 3000, 'highpass', 0.7, 0.001, 0); nz(t + 0.01, 0.11, 0.18, 300, 120, 'lowpass', 0.7, 0.004, 0.08, true); },
  heavy() { const t = now(), v = rnd(0.92, 1.08); thump(t, 120 * v, 32, 0.32, 0.9, 0.15); nz(t, 0.14, 0.7, 2200, 250, 'bandpass', 0.7, 0.001, 0.1); nz(t, 0.03, 0.5, 4500, 2500, 'highpass', 0.7, 0.001, 0); nz(t + 0.02, 0.35, 0.3, 500, 90, 'lowpass', 0.6, 0.01, 0.25, true); metal(t, 130 * v, 0.25, 0.05, [1, 2.4, 3.9], 0.2); },
  swing() { const t = now(), v = rnd(0.85, 1.2); nz(t, 0.16, 0.16, 700 * v, 2600 * v, 'bandpass', 1.4, 0.06, 0.05, true); },
  whoosh() { const t = now(), v = rnd(0.85, 1.15); nz(t, 0.3, 0.26, 300 * v, 2200 * v, 'bandpass', 1.1, 0.12, 0.2, true); nz(t + 0.05, 0.2, 0.1, 3000, 1200, 'highpass', 0.6, 0.08, 0.1); },
  jump() { const t = now(); nz(t, 0.12, 0.1, 500, 1400, 'bandpass', 1.2, 0.03, 0.05, true); thump(t, 140, 90, 0.07, 0.12, 0, 'triangle'); },
  block() { const t = now(), v = rnd(0.9, 1.1); metal(t, 620 * v, 0.22, 0.28, [1, 2.76, 5.4], 0.12); nz(t, 0.03, 0.5, 4500, 2500, 'highpass', 0.7, 0.001, 0); thump(t, 200, 90, 0.08, 0.3, 0); },
  perfect() { const t = now(); metal(t, 1250, 0.9, 0.3, MET, 0.45); metal(t + 0.02, 1900, 0.6, 0.15, [1, 2.76, 5.4], 0.4); nz(t, 0.18, 0.4, 9000, 3500, 'highpass', 0.7, 0.001, 0.3); thump(t, 220, 80, 0.12, 0.35, 0.05); },
  break() { const t = now(); nz(t, 0.35, 0.6, 3000, 200, 'bandpass', 0.7, 0.001, 0.2); thump(t, 180, 40, 0.3, 0.6, 0.15); metal(t, 480, 0.5, 0.2, [1, 1.9, 3.3, 4.7], 0.3); [0.04, 0.09, 0.15].forEach(d => nz(t + d, 0.05, 0.25, rnd(3500, 7000), 2500, 'highpass', 0.8, 0.001, 0.1)); },
  barrier() { const t = now(); buzz(t, 300, 180, 0.3, 0.2, 1400, 0.3, 'triangle'); metal(t, 900, 0.5, 0.12, [1, 2.2, 3.7], 0.4); nz(t, 0.25, 0.1, 1200, 3500, 'bandpass', 1.5, 0.05, 0.2); },
  cast() { const t = now(); nz(t, 0.3, 0.2, 400, 3200, 'bandpass', 1.3, 0.1, 0.3, true); buzz(t, 110, 200, 0.3, 0.1, 700, 0.3); metal(t + 0.15, 1100, 0.3, 0.06, [1, 2.4], 0.3); },
  power() { const t = now(); nz(t, 0.6, 0.3, 250, 4000, 'bandpass', 1.0, 0.35, 0.35, true); buzz(t, 60, 150, 0.6, 0.3, 500, 0.3); thump(t + 0.5, 90, 30, 0.35, 0.5, 0.2); metal(t + 0.5, 200, 1.0, 0.1, [1, 2.76, 5.4], 0.5); },
  boom() { const t = now(); thump(t, 85, 24, 0.7, 1.0, 0.3); nz(t, 0.7, 0.55, 1200, 70, 'lowpass', 0.7, 0.002, 0.35, true); nz(t, 0.05, 0.5, 3500, 1500, 'bandpass', 0.7, 0.001, 0.1); nz(t + 0.1, 0.9, 0.2, 200, 60, 'lowpass', 0.5, 0.1, 0.5, true); },
  crit() { const t = now(); thump(t, 130, 28, 0.45, 1.0, 0.25); nz(t, 0.18, 0.8, 5000, 400, 'bandpass', 0.7, 0.001, 0.2); nz(t, 0.03, 0.7, 6000, 3500, 'highpass', 0.7, 0.001, 0); metal(t, 760, 0.7, 0.25, [1, 2.76, 5.4, 8.9], 0.4); nz(t + 0.03, 0.5, 0.35, 700, 80, 'lowpass', 0.6, 0.01, 0.35, true); },
  echo() { const t = now(); metal(t, 520, 0.35, 0.18, [1, 2.4, 4.1], 0.5); nz(t, 0.15, 0.12, 2500, 900, 'bandpass', 1.0, 0.01, 0.4); },
  zap() { const t = now(); nz(t, 0.14, 0.5, 8000, 1500, 'highpass', 0.7, 0.001, 0.15); crackle(t, 0.2, 0.5, 4500, 60); buzz(t, 1100, 160, 0.13, 0.14, 2600, 0.1, 'square'); thump(t, 120, 50, 0.1, 0.25, 0); },
  slash() { const t = now(), v = rnd(0.9, 1.15); nz(t, 0.13, 0.4, 7000 * v, 1500, 'highpass', 0.8, 0.002, 0.12); nz(t, 0.1, 0.25, 3000, 900, 'bandpass', 1.2, 0.005, 0.1); metal(t, 2100 * v, 0.12, 0.05, [1, 2.76], 0.2); },
  laser() { const t = now(); buzz(t, 900, 120, 0.5, 0.2, 3500, 0.3); nz(t, 0.5, 0.4, 6000, 400, 'bandpass', 1.0, 0.02, 0.3); crackle(t, 0.4, 0.3, 3000, 50); thump(t, 100, 40, 0.3, 0.4, 0.2); },
  fire() { const t = now(); nz(t, 0.5, 0.4, 900, 350, 'bandpass', 0.8, 0.03, 0.25, true); crackle(t, 0.5, 0.45, 2800, 35); thump(t, 90, 45, 0.25, 0.3, 0.1); nz(t, 0.3, 0.2, 200, 100, 'lowpass', 0.6, 0.05, 0.2, true); },
  ice() { const t = now(); metal(t, 2600, 0.5, 0.14, [1, 1.47, 2.09, 2.56, 3.4], 0.5); nz(t, 0.2, 0.3, 9500, 4500, 'highpass', 0.7, 0.001, 0.3); crackle(t + 0.02, 0.3, 0.3, 6000, 45); thump(t, 150, 70, 0.1, 0.2, 0); },
  thorn() { const t = now(); nz(t, 0.2, 0.35, 900, 220, 'bandpass', 1.0, 0.01, 0.1, true); nz(t, 0.05, 0.3, 4000, 1800, 'highpass', 0.8, 0.001, 0.05); thump(t, 110, 50, 0.1, 0.3, 0); },
  summon() { const t = now(); thump(t, 70, 40, 0.5, 0.5, 0.35); nz(t, 0.5, 0.2, 200, 1500, 'bandpass', 1.0, 0.15, 0.45, true); buzz(t, 80, 130, 0.55, 0.12, 500, 0.5); metal(t + 0.1, 330, 0.8, 0.07, [1, 2.76, 5.4], 0.55); },
  word() { const t = now(); thump(t, 70, 40, 0.5, 0.7, 0.3); buzz(t, 90, 75, 0.7, 0.18, 380, 0.3); buzz(t, 135, 112, 0.7, 0.1, 500, 0.3, 'square'); nz(t, 0.5, 0.25, 600, 150, 'bandpass', 1.0, 0.02, 0.4, true); },
  holy() { const t = now(); metal(t, 880, 1.6, 0.22, [1, 1.5, 2, 3, 4.2], 0.7); nz(t, 0.8, 0.15, 3000, 8000, 'bandpass', 1.0, 0.25, 0.5, true); thump(t, 110, 55, 0.3, 0.25, 0.4); },
  domain() { const t = now(); thump(t, 55, 28, 1.2, 0.9, 0.4); metal(t, 82, 2.4, 0.12, [1, 2.0, 2.76, 4.1], 0.7); nz(t, 1.2, 0.35, 150, 1800, 'bandpass', 0.8, 0.5, 0.5, true); buzz(t, 55, 70, 1.4, 0.15, 300, 0.4); },
  domainwarn() { const t = now(); buzz(t, 48, 62, 1.3, 0.35, 220, 0.3); buzz(t, 72, 90, 1.3, 0.12, 350, 0.3, 'square'); nz(t, 1.2, 0.3, 120, 2400, 'bandpass', 0.9, 0.7, 0.5, true); [0, 0.4, 0.8, 1.2].forEach(d => thump(t + d, 60, 36, 0.3, 0.45, 0.3)); },
  domainfx() { const t = now(); thump(t, 50, 24, 2.2, 1.0, 0.5); metal(t, 70, 3.2, 0.16, [1, 2.0, 2.76, 4.1, 5.4], 0.8); nz(t, 1.8, 0.45, 100, 5000, 'bandpass', 0.8, 0.9, 0.5, true); nz(t + 1.4, 1.6, 0.3, 4000, 300, 'lowpass', 0.6, 0.05, 0.6, true); buzz(t, 45, 80, 2.0, 0.2, 250, 0.4); },
  thud() { const t = now(); thump(t, 100, 38, 0.2, 0.55, 0.05); nz(t, 0.08, 0.3, 500, 150, 'lowpass', 0.7, 0.002, 0.05, true); },
  ko() { const t = now(); thump(t, 110, 26, 0.7, 1.0, 0.3); nz(t, 0.45, 0.6, 2500, 120, 'bandpass', 0.7, 0.001, 0.25); metal(t, 300, 1.4, 0.15, [1, 2.76, 5.4], 0.6); nz(t + 0.05, 0.7, 0.3, 500, 70, 'lowpass', 0.6, 0.02, 0.5, true); },
  go() { const t = now(); thump(t, 90, 40, 0.4, 0.8, 0.3); metal(t, 190, 1.4, 0.22, [1, 2.76, 5.4, 8.93], 0.6); nz(t, 0.2, 0.3, 3000, 800, 'bandpass', 0.8, 0.003, 0.3); },
  tick() { const t = now(); nz(t, 0.04, 0.35, 2400, 1800, 'bandpass', 3, 0.001, 0.05); thump(t, 700, 500, 0.03, 0.1, 0, 'triangle'); },
  click() { const t = now(); nz(t, 0.025, 0.25, 3200, 2200, 'bandpass', 2, 0.001, 0.03); thump(t, 400, 250, 0.03, 0.08, 0, 'triangle'); },
  open() { const t = now(); nz(t, 0.14, 0.14, 800, 2400, 'bandpass', 1.2, 0.04, 0.12, true); nz(t + 0.06, 0.03, 0.2, 3200, 2200, 'bandpass', 2, 0.001, 0.05); },
  reveal() { const t = now(); nz(t, 0.35, 0.18, 500, 5000, 'bandpass', 1.0, 0.2, 0.4, true); metal(t + 0.25, 1400, 0.5, 0.09, [1, 2.4, 3.6], 0.5); thump(t + 0.28, 100, 50, 0.2, 0.25, 0.2); },
  legend() { const t = now(); thump(t, 80, 30, 0.8, 0.8, 0.4); metal(t, 220, 2.5, 0.2, [1, 2.76, 5.4, 8.93], 0.7); nz(t, 0.9, 0.3, 500, 6000, 'bandpass', 0.9, 0.5, 0.5, true); metal(t + 0.5, 660, 1.8, 0.08, [1, 2.76, 5.4], 0.7); },
  win() { const t = now(); [0, 0.22, 0.44].forEach((d, i) => { thump(t + d, 80, 38, 0.35, 0.8, 0.3); nz(t + d, 0.1, 0.3, 2200, 500, 'bandpass', 0.8, 0.002, 0.2); }); metal(t + 0.66, 200, 2.6, 0.22, [1, 2.76, 5.4, 8.93], 0.7); thump(t + 0.66, 60, 28, 0.9, 0.9, 0.4); nz(t + 0.66, 1.4, 0.3, 4000, 600, 'bandpass', 0.7, 0.02, 0.5, true); },
  lose() { const t = now(); thump(t, 70, 26, 1.0, 0.8, 0.5); buzz(t, 70, 45, 1.6, 0.2, 260, 0.5); nz(t, 1.6, 0.2, 700, 90, 'lowpass', 0.6, 0.2, 0.6, true); metal(t, 110, 2.2, 0.1, [1, 2.0, 2.76], 0.8); },
};
/* ---------- procedural music: taiko / drone driven (no melodic arpeggios) ---------- */
let mus = { mode: null, timer: null, step: 0, next: 0, gain: null };
export let musicVol = 0.6, sfxVol = 1;
export function setVolumes(m, mu, sf) { musicVol = mu; sfxVol = sf; if (master) master.gain.value = muted ? 0 : 0.7 * m; if (mus.gain) mus.gain.gain.value = mu * 0.5; }
function mdrone(t, f, dur, vol, cut) { const D = mus.gain; [1, 1.004].forEach(d => { const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f * d; fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut * 0.5, t); fl.frequency.linearRampToValueAtTime(cut, t + dur * 0.6); fl.frequency.linearRampToValueAtTime(cut * 0.5, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(fl); fl.connect(g); g.connect(D); o.start(t); o.stop(t + dur + 0.05); }); }
function mdrum(t, f, vol, dur = 0.3) { const D = mus.gain, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dur); env(g, t, 0.002, vol, dur); o.connect(g); g.connect(D); o.start(t); o.stop(t + dur + 0.05); mnz(t, 0.05, vol * 0.5, 900, D, 'bandpass'); }
function mnz(t, dur, vol, f, dest, type = 'highpass', q = 0.8) { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02); }
function mclang(t, f, vol) { const D = mus.gain; MET.forEach((r, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * r; env(g, t, 0.002, vol / (1 + i), 1.4 / (1 + i * 0.6)); o.connect(g); g.connect(D); g.connect(revSend); o.start(t); o.stop(t + 1.5); }); }
function mstep() {
  if (!ctx || !mus.mode || muted) { mus.next = ctx ? ctx.currentTime : 0; return; }
  const battle = mus.mode === 'battle', bpm = battle ? 118 : 146, sp = 60 / bpm / 4, D = mus.gain;
  while (mus.next < ctx.currentTime + 0.25) {
    const t = mus.next, i = mus.step, bar = Math.floor(i / 16), s16 = i % 16, root = [36.7, 36.7, 32.7, 34.6][bar % 4];
    if (battle) {
      if (s16 === 0) { mdrum(t, 55, 0.85, 0.5); mdrone(t, root, sp * 16, 0.07, 500); }
      if (s16 === 6 || s16 === 10) mdrum(t, 70, 0.45, 0.25);
      if (s16 === 8) mdrum(t, 62, 0.6, 0.35);
      if (s16 === 14 && bar % 2 === 1) { mdrum(t, 80, 0.4, 0.2); mdrum(t + sp * 0.5, 80, 0.3, 0.2); }
      if (s16 % 4 === 2) mnz(t, 0.03, 0.02, 7000, D);
      if (s16 === 4 || s16 === 12) mnz(t, 0.1, 0.07, 1700, D, 'bandpass', 1.5);
      if (s16 === 0 && bar % 4 === 0) mclang(t, root * 4, 0.03);
      if (s16 === 0 && bar % 4 === 3) mnz(t, 0.9, 0.12, 2500, D, 'bandpass', 0.8);
    } else {
      if (s16 === 0) { mdrone(t, root * 2, sp * 16, 0.1, 900); mdrone(t, root * 3, sp * 16, 0.05, 700); mclang(t, root * 6, 0.05); }
      if (s16 % 4 === 0) mdrum(t, 50, 0.95, 0.35);
      if (s16 === 2 || s16 === 7 || s16 === 11) mdrum(t, 78, 0.5, 0.2);
      if (s16 % 8 === 4) { mnz(t, 0.2, 0.3, 1500, D, 'bandpass', 1.2); mdrum(t, 110, 0.4, 0.12); }
      if (s16 % 4 === 3) mnz(t, 0.025, 0.025, 8000, D);
      if (bar % 4 === 3 && s16 >= 8) mdrum(t, 90 + (s16 - 8) * 6, 0.35, 0.12);
      if (bar % 4 === 3 && s16 === 15) mnz(t, 0.6, 0.2, 3000, D, 'bandpass', 0.7);
    }
    mus.next += sp; mus.step++;
  }
}
export function music(mode) {
  if (!ctx) return; if (mus.mode === mode) return; mus.mode = mode; if (!mus.gain) { mus.gain = ctx.createGain(); mus.gain.gain.value = musicVol * 0.5; mus.gain.connect(bus); }
  if (mode === 'clash') mode = mus.mode = 'domain'; mus.step = 0; mus.next = ctx.currentTime + 0.05;
  if (mode && !mus.timer) mus.timer = setInterval(mstep, 60); if (!mode && mus.timer) { clearInterval(mus.timer); mus.timer = null; }
}
let _voice = null, _vq = 0;
function pickVoice() {
  try { const vs = speechSynthesis.getVoices(); if (!vs.length) return null; const en = vs.filter(v => /^en/i.test(v.lang)); const pref = en.find(v => /(google uk english male|microsoft (guy|ryan|davis|andrew|brian|christopher|eric)|natural.*(guy|ryan|davis|andrew|brian))/i.test(v.name)) || en.find(v => /(daniel|alex|fred|david|mark|james|oliver|male)/i.test(v.name) && !/female/i.test(v.name)) || en.find(v => /google|microsoft|natural/i.test(v.name)) || en[0] || vs[0]; return pref; } catch (e) { return null; }
}
try { if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { _voice = pickVoice(); }; } catch (e) { }
// speak(text, {pitch, rate, vol, urgent}) - browser text-to-speech announcer lines (domain names, awakenings, clashes, results)
export function speak(text, o = {}) {
  try {
    if (muted || !window.speechSynthesis || !window.__voices || sfxVol <= 0) return; if (!_voice) _voice = pickVoice();
    const now = performance.now(); if (!o.urgent && now - _vq < 900) return; _vq = now;
    const u = new SpeechSynthesisUtterance(text); if (_voice) u.voice = _voice; u.lang = (_voice && _voice.lang) || 'en-US'; u.pitch = o.pitch ?? 0.8; u.rate = o.rate ?? 1.08; u.volume = Math.min(1, (o.vol ?? 1) * 0.9 * (sfxVol || 1));
    if (o.urgent) speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { }
}
// synthesized fighter vocals: grunts / shouts / pain (formant-filtered buzz)
function vocal(kind) {
  const t = now(), base = kind === 'shout' ? rnd(115, 140) : kind === 'pain' ? rnd(170, 230) : rnd(100, 135), dur = kind === 'shout' ? 0.45 : kind === 'pain' ? 0.32 : 0.2, vol = kind === 'shout' ? 0.5 : 0.4;
  const o = ctx.createOscillator(), g = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), mix = ctx.createGain(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(base * (kind === 'pain' ? 1.5 : 1.2), t); o.frequency.exponentialRampToValueAtTime(base * (kind === 'pain' ? 0.8 : 0.7), t + dur);
  f1.type = f2.type = 'bandpass'; f1.Q.value = f2.Q.value = 5; const [a1, a2, b1, b2] = kind === 'pain' ? [900, 1700, 500, 1100] : kind === 'shout' ? [800, 1200, 450, 900] : [600, 1000, 400, 800];
  f1.frequency.setValueAtTime(a1, t); f1.frequency.linearRampToValueAtTime(b1, t + dur); f2.frequency.setValueAtTime(a2, t); f2.frequency.linearRampToValueAtTime(b2, t + dur);
  env(g, t, 0.015, vol, dur); o.connect(f1); o.connect(f2); f1.connect(mix); f2.connect(mix); mix.connect(g); out(g, 0.12); o.start(t); o.stop(t + dur + 0.05);
  nz(t, dur * 0.8, vol * 0.25, 1500, 900, 'bandpass', 1.5, 0.01, 0.05);
}
// battle cry: a long, rough, rising-then-falling male shout (vibrato + distortion + formant sweep) for big moments
function battlecry() {
  const t = now(), dur = 0.95, base = rnd(105, 125);
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), ws = ctx.createWaveShaper(), g = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), f3 = ctx.createBiquadFilter(), mix = ctx.createGain();
  o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(base * 0.9, t); o.frequency.linearRampToValueAtTime(base * 1.7, t + dur * 0.35); o.frequency.exponentialRampToValueAtTime(base * 1.1, t + dur);
  o2.frequency.setValueAtTime(base * 0.45, t); o2.frequency.linearRampToValueAtTime(base * 0.85, t + dur * 0.35); o2.frequency.exponentialRampToValueAtTime(base * 0.55, t + dur);
  lfo.frequency.value = 6.5; lg.gain.value = base * 0.035; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 3.2); } ws.curve = c;
  f1.type = f2.type = f3.type = 'bandpass'; f1.Q.value = 6; f2.Q.value = 7; f3.Q.value = 8;
  f1.frequency.setValueAtTime(500, t); f1.frequency.linearRampToValueAtTime(850, t + dur * 0.3); f1.frequency.linearRampToValueAtTime(600, t + dur);
  f2.frequency.setValueAtTime(1000, t); f2.frequency.linearRampToValueAtTime(1250, t + dur * 0.3); f2.frequency.linearRampToValueAtTime(900, t + dur);
  f3.frequency.value = 2600;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.6, t + 0.08); g.gain.setValueAtTime(0.6, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(ws); o2.connect(ws); ws.connect(f1); ws.connect(f2); ws.connect(f3); f1.connect(mix); f2.connect(mix); f3.connect(mix); mix.connect(g); out(g, 0.18);
  o.start(t); o2.start(t); lfo.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  nz(t, dur * 0.9, 0.12, 2200, 1400, 'bandpass', 1.2, 0.05, 0.1);
}
let lastSfx = {};
export function sfx(n) { if (!ctx || muted || sfxVol <= 0) return; const f = S[n]; if (!f) return; const t = ctx.currentTime; if (lastSfx[n] && t - lastSfx[n] < 0.035) return; lastSfx[n] = t; try { f(); } catch (e) { } }
