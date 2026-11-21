import * as THREE from 'three';
import { rand, pick, clamp, lerp } from './fx.js';
import { A } from './abilities.js';

/* ============================================================
   ULTIMATE STATES — the gauge unlocks a timed state (~60s). Inside it, keys 1-3 become
   that state's three Ultimate Moves, and key 5 can cast an equipped Domain.
   ============================================================ */
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const fwdOf = (f) => V(Math.sin(f.yaw), 0, Math.cos(f.yaw));
const chestOf = (f, h = 1.3) => V(f.pos.x, f.pos.y + h, f.pos.z);

// Move 1: fan of seeking bolts
const volley = (name, color, n, dmg) => ({ name, icon: '✦', color, cd: 6, cast(f, G) {
  f.lock = 0.35; f.castAnim = 0.35; G.callout(f, name.toUpperCase(), color, 1.0); G.sfx('cast'); const base = fwdOf(f); const tg = f.target && !f.target.dead ? f.target : G.nearestEnemy(f);
  for (let i = 0; i < n; i++) G.later(0.06 * i, () => { if (f.dead) return; const a = (i - (n - 1) / 2) * 0.16; const d = base.clone().applyAxisAngle(V(0, 1, 0), a); const o = chestOf(f, 1.5).addScaledVector(d, 1.2);
    G.fx.flash(o, color, 3, 0.12); G.fx.sparks(o, color, 6, 9, 0.25); G.fx.spikes(o, color, 6, 1.4, 0.25, true);
    const p = G.projectile({ owner: f, pos: o, vel: d.clone().multiplyScalar(30), r: 0.7, dmg, color, life: 1.6, size: 0.8, kind: 'proj', kb: 6, stun: 0.3, pierce: false });
    if (p && tg) { const upd = G.every(0.016, 1.6, (dt) => { if (!p.alive || tg.dead) { upd.stop(); return; } const want = chestOf(tg, 1.2).sub(p.pos).normalize().multiplyScalar(30); p.vel.lerp(want, 1 - Math.exp(-5 * dt)); }); } });
  return true; } });
// Move 2: teleport-rush through the target with a flurry of cuts
const rush = (name, color, dmg) => ({ name, icon: '➤', color, cd: 8, cast(f, G) {
  const t = f.target && !f.target.dead ? f.target : G.nearestEnemy(f); if (!t) { const fw = fwdOf(f); G.fx.converge(chestOf(f, 1.2), color, 24, 3, 0.2); f.pos.addScaledVector(fw, 8); G.fx.shock(f.pos.clone(), color, 6, 0.4); G.fx.pillar(f.pos.clone(), color, 12, 1, 0.4); G.callout(f, name.toUpperCase(), color, 1.0); G.sfx('whoosh'); return true; } f.lock = 0.9; f.invuln = Math.max(f.invuln, 0.9); f.castAnim = 0.9; G.callout(f, name.toUpperCase(), color, 1.1); G.sfx('whoosh');
  const from = f.pos.clone(); const dir = t.pos.clone().sub(f.pos).setY(0).normalize(); G.fx.shock(from, color, 5, 0.3);
  for (let i = 0; i < 5; i++) G.later(0.12 * i, () => { if (f.dead || t.dead) return; const ang = rand(0, 6.28); f.pos.copy(t.pos).add(V(Math.cos(ang) * 2.2, 0, Math.sin(ang) * 2.2)); f.yaw = Math.atan2(t.pos.x - f.pos.x, t.pos.z - f.pos.z); const c = chestOf(t, 1.2);
    G.fx.slash(c, rand(0, 6.28), color, 5 + i, rand(-1.5, 1.5), 0.28); G.fx.fork(c.clone().add(V(rand(-3, 3), 4, rand(-3, 3))), c, color, 0.2); G.fx.impact(c, dir, color, 1.2); G.fx.slash(c, rand(0, 6.28), '#ffffff', 3.5, rand(-1.5, 1.5), 0.2); G.fx.sparks(c, color, 14, 16, 0.3); G.shake(0.3); G.sfx('hit');
    G.damage(f, t, i === 4 ? dmg * 1.6 : dmg, { kind: 'status', kb: i === 4 ? 16 : 1, launch: i === 4 ? 9 : 0, stun: 0.4, unblockable: true, ignoreBarrier: true, noPassive: true, dir }); });
  return true; } });
// Move 3: shockwave nova — launches everyone nearby
const nova = (name, color, dmg) => ({ name, icon: '✸', color, cd: 11, cast(f, G) {
  f.lock = 0.6; f.castAnim = 0.6; f.invuln = Math.max(f.invuln, 0.7); G.callout(f, name.toUpperCase(), color, 1.1); G.sfx('boom'); const c = chestOf(f, 1.1);
  G.fx.converge(c, color, 50, 6, 0.3); G.fx.eruption(f.pos.clone(), color, 4, 12); G.fx.pillar(f.pos.clone(), color, 30, 3, 0.7); G.fx.shock(f.pos.clone(), color, 15, 0.6); G.fx.shock(f.pos.clone(), '#ffffff', 9, 0.4, 0.1); G.fx.ring(f.pos.clone().setY(0.2), color, 1, 18, 0.6); G.fx.burst(c, color, 50, 22, 0.8, 1); G.shake(0.9);
  G.later(0.25, () => { if (f.dead) return; for (const e of G.enemiesOf(f)) { if (e.dead || e.pos.distanceTo(f.pos) > 12) continue; G.damage(f, e, dmg, { kind: 'status', kb: 18, launch: 11, stun: 0.9, unblockable: true, ignoreBarrier: true, noPassive: true, dir: e.pos.clone().sub(f.pos).setY(0).normalize() }); } });
  return true; } });
// Move 4: the state's signature ultimate (uses an 'um' ability)
const sig = (id, name, icon, color) => ({ name, icon, color, cd: 20, cast(f, G) { return A[id].cast(f, G); } });

export const UMOVES = {};
export function registerStates(K) {
  const { def } = K;
  const state = (id, o) => def({ slot: 'u', state: true, id, ultCost: 100, dur: 60, cd: 0, name: o.name, r: o.r, icon: o.icon, color: o.color, desc: o.desc, moves: o.moves.map((m, i) => (m.id = id + ':' + i, m.state = id, m.r = o.r, UMOVES[m.id] = m)),
    cast(f, G) { G.enterState(f, this); return true; } });
  state('surge', { name: 'Surge Awakening', r: 'C', icon: '✺', color: '#ff7aff', desc: 'Enter a 60s awakened state: +35% damage, +20% speed, regen. Keys 1-4 become your four equipped Ultimate Moves. Land 4 hits, then cast a Domain with key 5.',
    moves: [volley('Flare Volley', '#ff7aff', 6, 24), rush('Surge Dash', '#ffaaff', 28), nova('Flare Nova', '#ff7aff', 42), sig('surgeburst', 'Cursed Surge', '✺', '#ff7aff')] });
  state('cyclone', { name: 'Cyclone Awakening', r: 'E', icon: '🌀', color: '#7affc0', desc: 'A jade-green awakened state with a cyclone cannon finisher. Great against groups.',
    moves: [volley('Jade Needles', '#7affc0', 8, 20), rush('Gale Rush', '#7affc0', 30), nova('Jade Nova', '#7affc0', 45), sig('spiral', 'Cursed Cyclone Cannon', '🌀', '#7affc0')] });
  state('tempest', { name: 'Tempest Awakening', r: 'E', icon: '🌩', color: '#9bd0ff', desc: 'A storm-charged state. Lightning volleys, a thunder rush and a battlefield-wide discharge.',
    moves: [volley('Chain Sparks', '#9bd0ff', 7, 22), rush('Thunderstep', '#9bd0ff', 30), nova('Chain Nova', '#9bd0ff', 45), sig('storm', 'Storm Discharge', '🌩', '#9bd0ff')] });
  state('spirit', { name: 'Spirit Awakening', r: 'L', icon: '👻', color: '#e8f0ff', desc: 'A spectral state: your guardian pins a target while you channel a huge beam.',
    moves: [volley('Pale Lances', '#e8f0ff', 6, 28), rush('Phantom Cut', '#e8f0ff', 34), nova('Pale Nova', '#e8f0ff', 51), sig('rika', 'Bound Spirit Beam', '👻', '#e8f0ff')] });
  state('violet', { name: 'Violet Awakening', r: 'L', icon: '🟣', color: '#b060ff', desc: 'Dual-polarity state ending in the long-range Violet Convergence beam.',
    moves: [volley('Twin Orbs', '#b060ff', 6, 30), rush('Polarity Rush', '#ff3a5a', 34), nova('Twin Nova', '#b060ff', 51), sig('purple', 'Violet Convergence', '🟣', '#b060ff')] });
  state('abyss', { name: 'Abyss Awakening', r: 'L', icon: '⚫', color: '#a070ff', desc: 'A gravity state: drag, crush and a black-hole finisher.',
    moves: [volley('Dark Shards', '#a070ff', 8, 24), rush('Void Step', '#a070ff', 32), nova('Dark Nova', '#a070ff', 48), sig('blackhole', 'Gravity Singularity', '⚫', '#a070ff')] });
}
