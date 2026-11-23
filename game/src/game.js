import * as THREE from 'three';
import { FX, rand, pick, clamp, lerp, angDiff, damp } from './fx.js';
import { makeChar, SKINS, FACES, HAIRS, OUTFITS, ACCS, HAIR_COLORS } from './chars.js';
import { buildArena, MAPS } from './world.js';
import { A, ALL, RARITY } from './abilities.js';
import { sfx, music, speak } from './audio.js';
import { makeSky } from './engine.js';
import { detailPass } from './domains.js';
import { UMOVES } from './ustate.js';
const DDUR = { R: 30, E: 45, L: 60 }, DPOW = { R: 1.8, E: 2.6, L: 3.6 };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const ROSTER = [
  { name: 'Kurogane', app: { gender: 'm', skin: 1, face: 3, hair: 4, hairColor: 0, outfit: 3, acc: 2, aura: 2, pose: 0 }, lo: { p: 'overdrive', a: 'lance', s: 'sentinel', u: 'violet', d: 'shrine' } },
  { name: 'Shirane', app: { gender: 'm', skin: 0, face: 1, hair: 9, hairColor: 4, outfit: 4, acc: 3, aura: 1, pose: 0 }, lo: { p: 'sight', a: 'rift', s: 'phantom', u: 'tempest', d: 'observatory' } },
  { name: 'Hakuren', app: { gender: 'f', skin: 0, face: 2, hair: 14, hairColor: 5, outfit: 1, acc: 0, aura: 2, pose: 0 }, lo: { p: 'lucky', a: 'nova', s: 'hares', u: 'surge', d: 'gamble' } },
  { name: 'Tsukimi', app: { gender: 'f', skin: 1, face: 4, hair: 7, hairColor: 8, outfit: 3, acc: 1, aura: 3, pose: 0 }, lo: { p: 'link', a: 'frost', s: 'serpent', u: 'spirit', d: 'court' } },
  { name: 'Oboro', app: { gender: 'm', skin: 2, face: 5, hair: 12, hairColor: 6, outfit: 0, acc: 5, aura: 1, pose: 0 }, lo: { p: 'swap', a: 'halo', s: 'flood', u: 'abyss', d: 'soulhall' } },
  { name: 'Magatsu', app: { gender: 'm', skin: 3, face: 6, hair: 2, hairColor: 7, outfit: 2, acc: 4, aura: 2, pose: 0 }, lo: { p: 'iron', a: 'magma', s: 'toad', u: 'cyclone', d: 'volcano' } },
  { name: 'Reika', app: { gender: 'f', skin: 0, face: 0, hair: 18, hairColor: 3, outfit: 1, acc: 6, aura: 3, pose: 0 }, lo: { p: 'flicker', a: 'thunder', s: 'stormwing', u: 'tempest', d: 'palace' } },
  { name: 'Nagisa', app: { gender: 'f', skin: 1, face: 2, hair: 5, hairColor: 6, outfit: 4, acc: 0, aura: 1, pose: 0 }, lo: { p: 'mend', a: 'well', s: 'jelly', u: 'surge', d: 'glacier' } },
  { name: 'Yami', app: { gender: 'm', skin: 0, face: 3, hair: 20, hairColor: 0, outfit: 3, acc: 7, aura: 2, pose: 0 }, lo: { p: 'hush', a: 'ember', s: 'hounds', u: 'violet', d: 'eclipse' } },
  { name: 'Ryuga', app: { gender: 'm', skin: 2, face: 1, hair: 15, hairColor: 5, outfit: 1, acc: 8, aura: 2, pose: 0 }, lo: { p: 'weak', a: 'mass', s: 'sentinel', u: 'cyclone', d: 'colosseum' } },
];
const NAMES = ['Kaito', 'Mira', 'Ren', 'Sora', 'Hana', 'Jun', 'Akira', 'Nami', 'Taro', 'Emi', 'Daichi', 'Rika', 'Haru', 'Mei'];
const SLOTK = ['p', 'a', 's', 'u', 'd'];
const SLOTA = [...SLOTK, 'p2']; // p2 = optional second passive (unlocked by account level + mastery)

export function randomApp() { return { gender: pick(['m', 'f']), skin: Math.floor(rand(0, SKINS.length)), face: Math.floor(rand(0, FACES.length)), hair: Math.floor(rand(0, HAIRS.length)), hairColor: Math.floor(rand(0, HAIR_COLORS.length)), outfit: Math.floor(rand(0, OUTFITS.length)), acc: pick([0, 0, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10]), aura: 0, pose: 0 }; }
export function randomLoadout(skill = 0.5) {
  const lo = {};
  for (const s of SLOTK) {
    const pool = ALL.filter(a => a.slot === s); const rw = { C: 40, R: 35, E: 18 + skill * 6, L: 5 + skill * 6 };
    const ws = pool.map(a => rw[a.r] * (a.w ?? 1)); let t = ws.reduce((a, b) => a + b, 0), r = Math.random() * t, ch = pool[0];
    for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) { ch = pool[i]; break; } }
    lo[s] = ch.id;
  }
  { const pool = ALL.filter(a => a.slot === 'f'), rw = { C: 40, R: 35, E: 18 + skill * 6, L: 5 + skill * 6 }, ws = pool.map(a => rw[a.r]); let r = Math.random() * ws.reduce((x, y) => x + y, 0), ch = pool[0]; for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) { ch = pool[i]; break; } } lo.f = ch.id; }
  return lo;
}

const CLASH_CE = 40, WINDUP = 1.8, MASH_KEYS = ['KeyJ', 'KeyK', 'KeyL', 'Space', 'Enter', 'Digit5'];
class Fighter {
  constructor(G, o) {
    this.G = G; this.name = o.name; this.pid = o.pid || null; this.remote = !!o.remote; this.netQ = []; this.netS = null; this.team = o.team; this.isPlayer = !!o.isPlayer; this.dummy = o.dummy || null; this.skill = o.skill ?? 0.6;
    this.app = o.app; this.ch = makeChar(o.app); G.scene.add(this.ch.group);
    this.pos = o.pos.clone(); this.vel = V(); this.yaw = o.yaw || 0; this.maxHp = o.dummy ? 800 : o.isCurse ? 45 : 220; this.hp = this.maxHp; this.maxCe = 100; this.ce = 100; this.ult = 0; this.burnT = 0;
    this.loadout = o.loadout; this.sty = (A[o.loadout.f] && A[o.loadout.f].style) || null; this.ab = {}; for (const s of SLOTA) this.ab[s] = A[o.loadout[s]]; if (this.ab.p2 && (this.ab.p2.slot !== 'p' || this.ab.p2 === this.ab.p)) this.ab.p2 = null; this.cd = { p: 0, a: 0, s: 0, u: 0, d: 0, p2: 0 }; this.ucd = [0, 0, 0, 0]; this.ustate = null; this.simple = 0; this.sdCd = 0; this.boostT = 0; this.umEquip = ((o.loadout.um || []).map(id => UMOVES[id]).filter(Boolean)); if (this.umEquip.length !== 4) this.umEquip = null;
    this.dead = false; this.act = null; this.combo = 0; this.comboT = 0; this.comboGap = 0; this.blocking = false; this.blockT = 99; this.dashCd = 0; this.lightHeld = false;
    for (const k of ['stun', 'freeze', 'root', 'slowT', 'confuse', 'invuln', 'noHeal', 'castWarn', 'lock', 'counterT', 'castAnim', 'launchT', 'shieldT', 'burnT', 'poisonT', 'hasteT', 'jackT', 'mass', 'thunder', 'vuln', 'executioner']) this[k] = 0;
    this.hitBy = new Map(); this.deaths = 0; this.assists = 0; this.fast = false; this.slowAct = false; this.gaugeMul = o.gaugeMul || 1; this.sprint = false; this.isCurse = !!o.isCurse; this.shadowStep = false;
    this.shield = 0; this.haste = 0; this.jack = 0; this.speedMul = 1; this.dmgMul = 1; this.dmgMulT = 1; this.speedT = 1; this.ceMul = 1; this.dashCdMul = 1; this.ceFree = false; this.armor = false; this.seesCE = false;
    this.resist = {}; this.target = null; this.lockOn = true; this.kos = 0; this.dmgDealt = 0; this.intent = { mx: 0, mz: 0, light: false, heavy: false, block: false, dash: false, jump: false, ab: {} };
    for (const s of SLOTA) if (this.ab[s] && this.ab[s].apply) this.ab[s].apply(this);
    this.ai = this.isPlayer ? null : { t: rand(0, 1), mode: 'approach', strafe: Math.random() < 0.5 ? 1 : -1, st: rand(1, 3), blockT: 0, atkT: rand(0.2, 1) };
    this.auraT = 0;
  }
  get air() { return this.pos.y > 0.08; }
  blockFacing(src) { if (!this.blocking) return false; const v = src.pos.clone().sub(this.pos); return Math.abs(angDiff(this.yaw, Math.atan2(v.x, v.z))) < 1.75; }
  breakTechs() { this.barrier = false; this.barrierOn = false; this.mend = false; this.thunder = 0; this.mass = 0; this.jackT = 0; this.G.fx.burst(this.pos.clone().setY(1.3), '#ffffff', 16, 7, 0.5, 0.5); }
  cdOf(s) { return this.cd[s]; }
  passiveSurge() {
    const G = this.G; if (this.dead || this.cd.p > 0 || this.ce < 20 || this.boostT > 0) { return false; } this.ce -= 20; this.cd.p = 12; this.boostT = 5; this.dmgMul *= 1.3; this.speedMul *= 1.1; const col = this.ab.p.color || '#ffffff';
    G.callout(this, 'PASSIVE SURGE', col, 1.1); G.sfx('power'); this.castAnim = 0.3; this.boostCol = col; G.fx.converge(chest(this, 1.2), col, 36, 4, 0.35); G.fx.shock(this.pos.clone(), col, 7, 0.45); G.fx.spikes(this.pos.clone().setY(0.2), col, 14, 2.5, 0.5, true); G.fx.vortex(() => this.boostT > 0 ? this.pos : null, col, 1.4, 3.5, 5, 45); return true;
  }
  useSimple() {
    const G = this.G; if (this.dead || this.simple > 0 || this.sdCd > 0 || this.ce < 30) return false;
    this.ce -= 30; this.simple = 8; this.sdCd = 16; G.callout(this, 'SIMPLE DOMAIN', '#ffffff', 1.2); G.sfx('barrier'); G.fx.ring(this.pos.clone().setY(0.2), '#ffffff', 1, 7, 0.5); G.fx.shock(this.pos.clone(), '#ffffff', 5, 0.4);
    const m = new THREE.Mesh(new THREE.SphereGeometry(2.6, 28, 18), G.fx.mat('#ffffff', 0.16)); m.material.side = THREE.DoubleSide; G.scene.add(m); this.simpleMesh = m; return true;
  }
  tickSimple(dt) {
    const G = this.G; if (this.sdCd > 0) this.sdCd = Math.max(0, this.sdCd - dt);
    if (this.boostT > 0) { this.boostT -= dt; if (this.boostT <= 0) { this.dmgMul /= 1.3; this.speedMul /= 1.1; } }
    if (this.simple > 0) { this.simple -= dt; this.ce = Math.max(0, this.ce - 3 * dt); if (this.ce <= 0 || this.dead) this.simple = 0; this.stun = Math.min(this.stun, 0.15); this.freeze = 0; this.root = 0; if (this.simpleMesh) { this.simpleMesh.position.set(this.pos.x, this.pos.y + 1.3, this.pos.z); this.simpleMesh.rotation.y += dt * 2; this.simpleMesh.material.opacity = 0.12 + Math.sin(G.time * 12) * 0.04; } if (Math.random() < dt * 20) G.fx.emit(chest(this, rand(-1, 1.6)).add(V(rand(-2, 2), 0, rand(-2, 2))), V(0, rand(1, 3), 0), '#ffffff', 0.35, 0.5, { drag: 0.5, bright: 1.6 }); }
    if (this.simple <= 0 && this.simpleMesh) { G.scene.remove(this.simpleMesh); this.simpleMesh = null; }
  }
  useMove(slot) {
    const G = this.G, i = { a: 0, p: 1, s: 2, u: 3 }[slot], m = this.ustate.moves[i]; if (this.dead || this.ucd[i] > 0 || this.stun > 0 || this.freeze > 0 || this.lock > 0 || this.launchT > 0 || G.cine) return false;
    if (this.target) { const v = this.target.pos.clone().sub(this.pos); if (Math.abs(angDiff(this.yaw, Math.atan2(v.x, v.z))) < 1.8) this.yaw = Math.atan2(v.x, v.z); }
    const ok = m.cast(this, G); if (ok === false) return false; this.ucd[i] = m.cd; G.stats.casts++; G.sfx('power'); return true;
  }
  use(slot) {
    if (this.ustate && (slot === 'a' || slot === 'p' || slot === 's' || slot === 'u')) return this.useMove(slot);
    const a = this.ab[slot], G = this.G; if (slot === 'd' && G.dom && G.dom.f === this && G.dom.spec.reroll) { G.dom.spec.reroll(G, this, G.dom.E); return false; } if (!a || this.dead || this.cd[slot] > 0 || ((this.stun > 0 || this.freeze > 0 || this.lock > 0 || this.launchT > 0) && slot !== 'd')) return false;
    if (slot === 'p' && !a.cast && !a.press) return this.passiveSurge();
    if (!a.cast && !a.press) return false;
    const cost = (a.cost || 0) * this.ceMul * (this.ceFree ? 0 : 1);
    if (slot === 'u') { if (this.ustate || this.ult < (a.ultCost || 100) - 0.01 || G.cine || G.dom || G.windup) return false; } else if (slot === 'd') { if (G.cine || G.dom) return false; const cl = G.windup && G.windup.f.team !== this.team; if (cl) { if (this.ce < CLASH_CE) { if (this.isPlayer) G.callout(this, 'NEED ' + CLASH_CE + ' CE TO CLASH', '#ff8a8a', 1.3); return false; } } else if (!this.ustate) { if (this.isPlayer) G.callout(this, 'ACTIVATE ULTIMATE STATE FIRST (4)', '#ffd070', 1.3); return false; } else if (this.ult < 99.5) { if (this.isPlayer) G.callout(this, 'CURSED ENERGY ' + Math.floor(this.ult) + '% — NEED 100%', '#ffd070', 1.3); return false; } else if (this.burnT > 0) { if (this.isPlayer) G.callout(this, 'BURNOUT', '#ff8a8a', 1.1); return false; } } else if (this.ce < cost) return false;
    if (this.target && slot !== 'p') { const v = this.target.pos.clone().sub(this.pos); if (Math.abs(angDiff(this.yaw, Math.atan2(v.x, v.z))) < 1.8) this.yaw = Math.atan2(v.x, v.z); }
    this.act = this.act && this.act.type === 'dash' ? this.act : null;
    const ok = (a.cast || a.press).call(a, this, G); if (ok === false) return false;
    if (this.isPlayer) { const sm = G.stats.castMap || (G.stats.castMap = {}); sm[a.id] = (sm[a.id] || 0) + 1; } if (!this.isCurse && !this.dummy) G.masteryFx(this, a);
    if (slot === 'u') { this.ult = 0; this.cd.u = (a.dur || 60) + 25; } else if (slot === 'd') { if (G.windup === null && G.cine && G.cine.type === 'clash') this.ce = Math.max(0, this.ce - CLASH_CE); this.cd.d = 60; this.ult = 0; if (this.ustate) { this.ustate.hits = 0; } } else { this.ce -= cost; this.cd[slot] = Math.max(this.cd[slot], (a.cd || 0)); }
    if (slot !== 'p') this.castAnim = 0.38; G.stats.casts++; G.sfx(slot === 'u' ? 'power' : 'cast'); return true;
  }
  startLight() {
    const G = this.G; this.comboT = 0.7; const idx = this.combo % 4; const up = idx === 3;
    this.act = { type: 'light', t: 0, dur: up ? 0.55 : 0.38, hitAt: up ? 0.2 : 0.13, cancel: up ? 0.5 : 0.25, idx, hit: false };
    this.autoFace(8); const d = V(Math.sin(this.yaw), 0, Math.cos(this.yaw)); this.vel.x += d.x * (this.air ? 3 : 6.5); this.vel.z += d.z * (this.air ? 3 : 6.5); G.sfx('swing');
    { const S = this.sty && this.sty.l; if (S) { const k = S.dur || 1; this.act.dur *= k; this.act.hitAt *= k; this.act.cancel *= k; if (S.lunge && !this.air) { this.vel.x += d.x * S.lunge; this.vel.z += d.z * S.lunge; } if (S.evade) this.invuln = Math.max(this.invuln, S.evade); } }
    if (this.air && !this._airLift) { this._airLift = true; this.vel.y = Math.max(this.vel.y, 2.5); }
    this.combo++; if (up) { this.combo = 0; this.comboGap = 0.3; }
  }
  startHeavy() { this.act = { type: 'heavy', t: 0, dur: 0.8, hitAt: 0.46, cancel: 0.8, hit: false, idx: 0 }; this.autoFace(8); this.G.sfx('swing'); { const S = this.sty && this.sty.h; if (S) { const k = S.dur || 1; this.act.dur *= k; this.act.hitAt *= k; this.act.cancel *= k; if (S.lunge && !this.air) { this.vel.x += Math.sin(this.yaw) * S.lunge; this.vel.z += Math.cos(this.yaw) * S.lunge; } if (S.evade) this.invuln = Math.max(this.invuln, S.evade); } } this.comboT = 0; this.combo = 0; if (this.air && !this._airLift) { this._airLift = true; this.vel.y = Math.max(this.vel.y, 1.5); } }
  startDash() {
    const I = this.intent, G = this.G; if (this.shadowStep) { const st = G.nearestEnemy(this, 40); if (st) { G.fx.burst(this.pos.clone().setY(1), '#8a3aff', 22, 8, 0.7, 0.6); G.fx.ring(this.pos.clone().setY(0.2), '#8a3aff', 0.5, 3, 0.3); const bh = st.pos.clone().sub(V(Math.sin(st.yaw), 0, Math.cos(st.yaw)).multiplyScalar(2.2)); this.pos.set(bh.x, st.pos.y, bh.z); this.yaw = Math.atan2(st.pos.x - this.pos.x, st.pos.z - this.pos.z); this.vel.set(0, 0, 0); this.invuln = Math.max(this.invuln, 0.35); this.dashCd = 0.9; G.fx.burst(this.pos.clone().setY(1), '#8a3aff', 22, 8, 0.7, 0.6); G.fx.ring(this.pos.clone().setY(0.2), '#8a3aff', 0.5, 3, 0.3); G.sfx('whoosh'); return; } }
    let d = V(I.mx, 0, I.mz); if (d.lengthSq() < 0.01) d.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); d.normalize();
    const T = this.thunder > 0; const sp = T ? 46 : 28; this.act = { type: 'dash', t: 0, dur: T ? 0.22 : 0.2, dir: d, start: this.pos.clone() }; this.vel.set(d.x * sp, 0, d.z * sp); this.invuln = Math.max(this.invuln, 0.16); this.dashCd = 1.1 * this.dashCdMul;
    G.fx.burst(this.pos.clone().setY(0.4), '#cfe4ff', 10, 4, 0.5, 0.3); G.sfx('whoosh'); if (T) G.fx.bolt(chest(this), chest(this).addScaledVector(d, 6), '#8fb8ff', 0.2, 0.08);
  }
  autoFace(range) {
    const t = this.target && !this.target.dead ? this.target : this.G.nearestEnemy(this, range); if (!t) return;
    const v = t.pos.clone().sub(this.pos); const dist = Math.hypot(v.x, v.z); const a = Math.atan2(v.x, v.z);
    if (this.isPlayer ? (dist < range && Math.abs(angDiff(this.yaw, a)) < 1.5) : true) this.yaw = a;
    if (this.confuse > 0) this.yaw += rand(-0.9, 0.9);
  }
  melee() {
    const G = this.G, a = this.act, heavy = a.type === 'heavy', up = a.type === 'light' && a.idx === 3; let hitAny = false;
    const SM = (this.sty && (heavy ? this.sty.h : this.sty.l)) || {}; const range = (heavy ? 3.4 : 2.9) * (SM.range || 1), base = (heavy ? 15 : up ? 7 : [5, 5, 6][a.idx] || 5) * (SM.dmg || 1);
    const dir = V(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    { const hp0 = this.pos.clone().addScaledVector(dir, 1.5).setY(a.idx === 2 && !heavy ? 0.9 : 1.5); const col = heavy ? '#ffb070' : a.idx === 3 ? '#9fe8ff' : '#ffffff'; const rolls = [0.55, -0.55, 1.57, 1.2]; G.fx.slash(hp0, this.yaw, col, heavy ? 1.7 : up ? 1.3 : 1.0, heavy ? 0.0 : rolls[a.idx % 4], heavy ? 0.3 : 0.2); if (heavy) { G.fx.shock(this.pos.clone().addScaledVector(dir, 2.4), '#ffd0a0', 2.5, 0.3); G.fx.debris(this.pos.clone().addScaledVector(dir, 2.4).setY(0.3), '#7a6a58', 3, 4); }
      if (this.isPlayer) { const hl = V(); this.ch.getHand(a.idx % 2 ? -1 : 1, hl); G.fx.sparks(hl, col, 4, 5, 0.2); } }
    for (const e of G.enemiesOf(this)) {
      const v = e.pos.clone().sub(this.pos); const dist = Math.hypot(v.x, v.z); const dy = Math.abs(e.pos.y - this.pos.y);
      if (dist > range + 0.5 || dy > 3 || Math.abs(angDiff(this.yaw, Math.atan2(v.x, v.z))) > (SM.arc || 1.15)) continue;
      let dmg = base * this.dmgMul * this.dmgMulT; if (this.counterT > 0) { dmg *= 1.5; this.counterT = 0; } let exec = false; if (this.executioner > 0 && !e.isCurse) { dmg = 99999; exec = true; this.executioner = 0; G.callout(this, 'EXECUTION', '#ff4a4a', 1.2, true); G.fx.slash(chest(e), this.yaw, '#ff2a2a', 8, 0.6, 0.35); G.fx.flash(chest(e), '#ff4a4a', 8, 0.3); G.shake(1); G.aberr(1.2); }
      let pim = false; if (!exec) { if (SM.stack && !heavy) dmg *= 1 + Math.min(SM.stack.max, a.idx * SM.stack.per); if (SM.lowHp) dmg *= 1 + SM.lowHp * (1 - this.hp / this.maxHp); if (SM.crit && Math.random() < SM.crit + (heavy ? 0 : a.idx * 0.025)) { dmg *= 2.4; pim = true; } }
      const info = G.damage(this, e, dmg, { melee: true, exec, unblockable: exec || !!SM.unblock, ignoreBarrier: exec, heavy, kb: SM.kb || (heavy ? 9 : up ? 2 : 3.5), launch: up ? 12 : heavy && this.air ? -10 : heavy ? 4 : 0, stun: (heavy ? 0.55 : 0.28) + (SM.stun || 0), idx: a.idx });
      if (info) { hitAny = true; if (pim) { G.fx.flash(chest(e), '#ff3050', 6, 0.25); G.fx.slash(chest(e), this.yaw, '#ff2a40', 4, 0.6, 0.3); G.shake(0.9); G.hitstop = Math.max(G.hitstop, 0.12); G.sfx('crit'); if (this.isPlayer) G.callout(this, 'PERFECT IMPACT', '#ff4060', 1.0, true); } if (SM.ceGain) this.ce = Math.min(this.maxCe, this.ce + SM.ceGain); if (this.air && e.air && !heavy) { e.vel.y = Math.max(e.vel.y, 5); if ((this._airHits = (this._airHits || 0) + 1) <= 2) this.vel.y = Math.max(this.vel.y, 4); } if (this.mass > 0) { G.fx.ring(e.pos.clone().setY(0.2), '#c9a0ff', 0.5, 4, 0.3); G.shake(0.25); for (const o of G.enemiesOf(this)) if (o !== e && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 4) G.damage(this, o, 5, { kind: 'aoe', kb: 6, noPassive: true }); } }
    }
    if (heavy && SM.wave) { for (let k = 1; k <= 5; k++) G.fx.ring(this.pos.clone().addScaledVector(dir, 2 + k * 2).setY(0.3), '#7ad0ff', 0.4, 2.4, 0.3); G.sfx('boom'); for (const e of G.enemiesOf(this)) { const v = e.pos.clone().sub(this.pos); const dist = Math.hypot(v.x, v.z); if (dist < range + 0.6 || dist > 13 || Math.abs(angDiff(this.yaw, Math.atan2(v.x, v.z))) > 0.3) continue; G.damage(this, e, base * SM.wave * this.dmgMul * this.dmgMulT, { kind: 'aoe', kb: 7, noPassive: true, stun: 0.4 }); } }
    if (hitAny && this.target && this.isPlayer) this.G.stats.melee++;
    return hitAny;
  }
  update(dt) {
    const G = this.G, I = this.intent, ch = this.ch;
    if (!this.dead) {
      for (const k of ['stun', 'freeze', 'root', 'slowT', 'confuse', 'invuln', 'noHeal', 'castWarn', 'lock', 'counterT', 'castAnim', 'shieldT', 'comboT', 'comboGap', 'vuln', 'executioner']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
      this.dashCd = Math.max(0, this.dashCd - dt * (this.fast ? 1.6 : 1)); if (this.shieldT <= 0) this.shield = 0; if (this.comboT <= 0) this.combo = 0;
      this.dmgMulT = 1; this.speedT = 1; this.armor = this.armor && this.jackT > 0;
      for (const s of SLOTA) { if (this.cd[s] > 0) this.cd[s] = Math.max(0, this.cd[s] - dt); const a = this.ab[s]; if (a && a.tick) a.tick(this, G, dt); }
      this.tickSimple(dt);
      if (this.ustate) { const us = this.ustate; this.cd.u = Math.max(this.cd.u, 25); if (!((G.cine && (G.cine.f === this || (G.cine.a && (G.cine.a.f === this || G.cine.b.f === this)))) || (G.dom && G.dom.f === this) || (G.windup && G.windup.f === this))) us.t -= dt; for (let i = 0; i < 4; i++) this.ucd[i] = Math.max(0, this.ucd[i] - dt); this.hp = Math.min(this.maxHp, this.hp + 3.5 * dt); this.ce = Math.min(this.maxCe, this.ce + 25 * dt); const col = us.def.color; G.fx.emit(chest(this, rand(0, 2.3)), V(rand(-1, 1), rand(2, 6), rand(-1, 1)), col, 0.55, 0.7, { drag: 0.6, bright: 1.4 }); if (Math.random() < dt * 5) G.fx.bolt(chest(this, 0.2), chest(this, 0.2).add(V(rand(-2, 2), rand(1, 3.5), rand(-2, 2))), col, 0.1, 0.12); if (us.t <= 0 || this.dead) G.endState(this); }
      if (this.burnT > 0) this.burnT -= dt; this.ce = Math.min(this.maxCe, this.ce + (this.jackT > 0 || this.burnT > 0 ? 0 : 8 * (this.cerMul || 1)) * dt + (this.maxCe < 100 ? 0 : 0)); if (this.maxCe < 100) this.ce = Math.min(this.ce + 3 * dt, this.maxCe);
      if (this.ustate && this.ult >= 99.5 && !this._dr) { this._dr = true; if (this.isPlayer) G.callout(this, 'DOMAIN READY — PRESS 5', '#ffd070', 1.6); } else if (!this.ustate || this.ult < 99.5) this._dr = false;
      if (G.state === 'fight' && !this.isCurse && G.nearestEnemy(this, 16)) if (this.cd.u <= 0 && !this.ustate) this.ult = Math.min(100, this.ult + 0.11 * dt * this.gaugeMul);
      if (this.burnT > 0) { this.burnT -= dt; this.burnAcc = (this.burnAcc || 0) + dt; if (this.burnAcc > 0.5) { this.burnAcc = 0; G.damage(this.burnBy, this, 1.8, { kind: 'status', noKb: true, noHit: true, noPassive: true }); G.fx.burst(chest(this), '#ff7a2a', 4, 3, 0.4, 0.4); } }
      if (this.poisonT > 0) { this.poisonT -= dt; this.poisonAcc = (this.poisonAcc || 0) + dt; if (this.poisonAcc > 0.5) { this.poisonAcc = 0; G.damage(this.poisonBy, this, 1.2, { kind: 'status', noKb: true, noHit: true, noPassive: true }); G.fx.burst(chest(this), '#7aff8a', 3, 2, 0.4, 0.4); } }
      if (this.mark && (this.mark.t -= dt) <= 0) this.mark = null;
      if (this.app.aura && G.auraColor(this.app.aura) && Math.random() < dt * 25) G.fx.emit(this.pos.clone().add(V(rand(-0.5, 0.5), rand(0, 2.2), rand(-0.5, 0.5))), V(0, rand(1, 2.5), 0), G.auraColor(this.app.aura), 0.45, 0.7);
      if (this.cd.p > 0 && this.ab.p && !this.ab.p.press) this.cd.p = 0;
    }
    // ---------- escape: struggle out of chains / long hit-stun, tech out of ragdoll (earned, not free) ----------
    if (!this.dead && !this.remote && !this.dummy && !this.isCurse && (G.state === 'fight' || G.state === 'training')) {
      if (this.stun > (this._ps || 0) + 0.001) { this.stunTot = this.stun; this.stunAge = 0; } this._ps = this.stun; if (this.stun > 0) this.stunAge = (this.stunAge || 0) + dt;
      if (this.launchT > 0) this.launchAge = (this.launchAge || 0) + dt; else this.launchAge = 0;
      if (this.stCd > 0) this.stCd -= dt; if (this.techCd > 0) this.techCd -= dt;
      const held = this.stun > 0 || this.freeze > 0 || this.root > 0 || this.launchT > 0; let press = false, dashP = false;
      if (this.isPlayer) { const lv = !!(I.light || I.heavy || I.block); press = !!(I.jump || I.dash) || (lv && !this._pm); this._pm = lv; dashP = !!I.dash; if (held) { I.jump = false; I.dash = false; } }
      else if (this.ai && held && Math.random() < dt * (1.2 + (this.skill || 0.5) * 4)) { press = true; dashP = (this.skill || 0.5) > 0.45; }
      if (held && press && !(this.stCd > 0) && !this.trialMash) {
        this.stCd = 0.08; const inDom = G.dom && G.dom.f !== this; const wasF = this.freeze > 0 || this.root > 0;
        if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - (inDom ? 0.07 : 0.17));
        if (this.root > 0) this.root = Math.max(0, this.root - (inDom ? 0.07 : 0.17));
        if (this.stun > 0 && this.stunAge > 0.3 && this.stunTot > 0.45) this.stun = Math.max(0.1, this.stun - 0.06);
        if (wasF) { G.fx.burst(chest(this), '#ffffff', 3, 4, 0.2, 0.25); if (this.freeze <= 0 && this.root <= 0) { G.float(this, 'BREAK FREE', '#ffffff'); G.sfx('break'); G.fx.ring(this.pos.clone().setY(0.2), '#ffffff', 0.3, 2.2, 0.25); } }
        if (dashP && this.launchT > 0 && this.launchAge > 0.35 && !(this.techCd > 0) && this.ce >= 12) { this.launchT = 0; this.stun = 0; this.ce -= 12; this.techCd = 4; this.vel.x *= 0.3; this.vel.z *= 0.3; if (this.vel.y < 0) this.vel.y *= 0.4; G.float(this, 'TECH RECOVER', '#7ad7ff'); G.sfx('perfect'); G.fx.ring(this.pos.clone().setY(0.4), '#7ad7ff', 0.3, 2.4, 0.3); }
      }
    }
    // ---------- control ----------
    const active = !this.dead && G.state === 'fight' || (G.state === 'training');
    const canMove = !this.dead && active && this.stun <= 0 && this.freeze <= 0 && this.launchT <= 0;
    let want = V(0, 0, 0);
    if (!canMove && I.ab.d && !this.dead && active && !this.act?.noDomain) this.use('d'); // a domain is a sure thing: it goes off even mid-combo
    if (canMove) {
      this.blocking = I.block && !this.act && this.lock <= 0; this.blockT = this.blocking ? this.blockT + dt : 0;
      if (I.dash && this.dashCd <= 0 && (!this.act || this.act.type !== 'dash') && this.lock <= 0) { this.startDash(); }
      const a = this.act;
      if (I.jump && !this.air && !a && this.root <= 0) { this.vel.y = 12.5 * (this.jumpMul || 1); G.sfx('jump'); }
      const free = !a || (a.type !== 'dash' && a.t >= a.cancel * 0.9) || a.type === 'dash' && a.t > 0.12;
      if (!this.blocking && this.lock <= 0 && this.comboGap <= 0 && I.light && (!a || (a.type === 'light' && a.t >= a.cancel))) { this.startLight(); }
      else if (!this.blocking && this.lock <= 0 && I.heavy && (!a || (a.type === 'light' && a.t >= a.cancel * 0.7))) { this.startHeavy(); }
      for (const s of SLOTA) if (I.ab[s]) { this.use(s); } if (I.sd) this.useSimple();
      want.set(I.mx, 0, I.mz); if (want.lengthSq() > 1) want.normalize();
      let sp = 9.2 * this.speedMul * this.speedT * (1 + this.haste * 0.07) * (I.sprint && !this.blocking ? 1.3 : 1); if (this.slowT > 0) sp *= 0.5; if (this.root > 0) sp = 0; if (this.lock > 0) sp *= 0.15; if (this.blocking) sp *= 0.5; if (this.act && this.act.type !== 'dash') sp *= 0.3;
      want.multiplyScalar(sp);
      if (this.act && this.act.type === 'dash') want.copy(this.vel);
    }
    I.ab = {}; I.sd = false; I.dash = false; I.jump = false;
    // act progress
    if (this.act) { const a = this.act; a.t += dt * (this.fast ? 1.45 : this.slowAct ? 0.65 : 1); if (this.stun > 0 || this.dead) this.act = null; else { if ((a.type === 'light' || a.type === 'heavy') && !a.hit && a.t >= a.hitAt) { a.hit = true; this.melee(); } if (a.t >= a.dur) this.act = null; } }
    // facing
    if (!this.dead && canMove) {
      if (this.act && (this.act.type === 'light' || this.act.type === 'heavy')) { /* keep */ }
      else if (G.shiftLock && this.isPlayer && !this.lockOn && !G.cine) { this.yaw += angDiff(this.yaw, G.camYaw) * (1 - Math.exp(-22 * dt)); }
      else if (this.lockOn && this.target && !this.target.dead) { const v = this.target.pos.clone().sub(this.pos); this.yaw += angDiff(this.yaw, Math.atan2(v.x, v.z)) * (1 - Math.exp(-16 * dt)); }
      else if (want.lengthSq() > 0.5) this.yaw += angDiff(this.yaw, Math.atan2(want.x, want.z)) * (1 - Math.exp(-14 * dt));
    }
    // ---------- physics ----------
    const ground = !this.air;
    if (this.act && this.act.type === 'dash') { /* keep vel */ }
    else { const k = (this.stun > 0 || this.freeze > 0 || this.launchT > 0) ? (ground ? 5 : 1) : ground ? 13 : 3.5; if (this.freeze > 0) { this.vel.x = damp(this.vel.x, 0, 20, dt); this.vel.z = damp(this.vel.z, 0, 20, dt); } else { this.vel.x = damp(this.vel.x, want.x, k, dt); this.vel.z = damp(this.vel.z, want.z, k, dt); } }
    if (this._hb === undefined || !this.air) this._hb = 0.5; let hover = this.act && this.act.type === 'dash'; if (!hover && this.act && this.air && !this.dead && this._hb > 0) { hover = true; this._hb -= dt; } // air-attack hang time is limited per jump (no spam-flying)
    if (this.freeze > 0 && this.air) this.vel.y -= 14 * dt; else this.vel.y -= (hover ? 6 : 32) * dt;
    if (this.act && this.act.type === 'dash' && this.air) this.vel.y = 0;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y <= 0) { this._airLift = false; this._airHits = 0; if (this.vel.y < -6 && this.air !== false) { G.fx.ring(this.pos.clone().setY(0.1), '#ffffff', 0.2, 1.0, 0.18); G.fx.burst(this.pos.clone().setY(0.2), '#cccccc', 6, 4, 0.4, 0.3); if (this.launchT > 0) { G.shake(0.2); G.sfx('thud'); } } this.pos.y = 0; if (this.vel.y < 0) this.vel.y = 0; if (this.launchT > 0) { this.launchT = 0; this.stun = Math.max(this.stun, 0.4); this.act = null; } }
    G.collide(this);
    // ---------- visuals ----------
    const s = ch.s, spd = Math.hypot(this.vel.x, this.vel.z);
    s.run = this.dead ? 0 : clamp(spd / 9.5, 0, 1.15); s.air = this.air; s.block = this.blocking; s.stun = (this.stun > 0 || this.freeze > 0) && !this.dead; s.launched = this.launchT > 0 ? 1 : 0; s.tilt = this.vel.y > 0 ? -0.8 : 0.5; s.ko = this.dead; s.cast = this.castAnim > 0 ? 1 : 0;
    s.atk = this.act && (this.act.type === 'light' || this.act.type === 'heavy') ? { kind: this.act.type, idx: this.act.idx, p: this.act.t / this.act.dur } : null;
    ch.group.position.set(this.pos.x, this.pos.y + (ch.group.userData.koY || 0), this.pos.z); ch.group.rotation.y = this.yaw; ch.update(dt);
    if (this.freeze > 0 && !this.dead) { ch.mats.forEach(m => { if (m.emissive && !m.userData.keepEmit) m.emissive.lerp(new THREE.Color('#5aa0ff'), 0.4); }); if (Math.random() < dt * 20) G.fx.emit(chest(this, rand(0, 2.2)), V(0, 1, 0), '#aee0ff', 0.4, 0.5); }
  }
}
const chest = (f, h = 1.3) => V(f.pos.x, f.pos.y + h, f.pos.z);
const I_SPR = (f) => f.intent && f.intent.sprint && Math.hypot(f.vel.x, f.vel.z) > 6;

export class Game {
  constructor(eng, ui, cfg) {
    this.eng = eng; this.ui = ui; this.cfg = cfg; this.net = cfg.net || null; this.netClient = !!(cfg.net && !cfg.net.host); this._nt = 0; this._ns = 0; this._acc = {}; this.scene = new THREE.Scene(); this.scene.userData.env = eng.envTex;
    this.fx = new FX(this.scene); this.fx.setScale(eng.size.h);
    this.cam = new THREE.PerspectiveCamera(66, eng.size.w / eng.size.h, 0.25, 800); this.fx.cam = this.cam;
    this.world = buildArena(this.scene, cfg.map, this.fx); this.fx.setScale(eng.size.h);
    this.time = 0; this.fighters = []; this.projs = []; this.summons = []; this.timers = []; this.stats = { crits: 0, casts: 0, melee: 0, dmg: 0, kos: 0, usedShikigami: false };
    this.state = cfg.mode === 'training' ? 'training' : 'count'; this.count = 3.4; this.matchT = 0; this.timeLeft = 99999; this.over = false; this.goal = { '1v1': 3, '2v2': 5, ffa: 5 }[cfg.mode] || 0; this.score = {}; this.cine = null; this.dom = null; this.windup = null; this.trialPress = 0; this.spawnPts = []; this.curses = 0; this.cineEnv = null;
    try { this.shiftLock = localStorage.getItem('hexclash_sl') === '1'; } catch (e) { this.shiftLock = false; }
    this.hitstop = 0; this.timeScale = 1; this.slowT = 0; this.shakeV = 0; this.ab = 0;
    this.camYaw = 0; this.camPitch = 0.36; this.camDist = 8.8; this.fovAdd = 0; this.camPos = V(0, 4, -10); this.endCam = 0;
    this.spawn(cfg); this.spawnCurses();
    this.player = this.fighters.find(f => f.isPlayer);
    this.camYaw = this.player.yaw; this.camPos.copy(this.player.pos).add(V(-Math.sin(this.camYaw) * 8, 5, -Math.cos(this.camYaw) * 8));
    this.makeFighterModel = makeChar;
  }
  auraColor(i) { return ['', '#4fa8ff', '#ff3b4f', '#ffd24f'][i] || null; }
  spawn(cfg) {
    const R = this.world.bounds, S = cfg.save, P = this.cfg.player; const specs = [];
    specs.push({ name: S.name || 'You', team: 0, isPlayer: true, app: S.app, loadout: S.equipped });
    const pool = [...ROSTER].sort(() => Math.random() - 0.5); const rv = (team) => { const r = pool.pop(); return { name: r.name, app: r.app, loadout: r.lo, team, skill: cfg.skill }; };
    if (cfg.mode === '1v1') specs.push(rv(1));
    if (cfg.mode === '2v2') specs.push(rv(0), rv(1), rv(1));
    if (cfg.mode === 'ffa') for (let i = 0; i < 4; i++) specs.push(rv(i + 1));
    if (cfg.mode === 'training') { specs.push({ name: 'Static Dummy', team: 1, dummy: 'static' }, { name: 'Dodging Dummy', team: 1, dummy: 'dodge' }); }
    if (cfg.net) { specs.length = 0; cfg.net.players.forEach(pl => specs.push({ name: pl.name, team: pl.team, isPlayer: pl.pid === cfg.net.pid, remote: pl.pid !== cfg.net.pid, pid: pl.pid, app: pl.profile && pl.profile.app, loadout: pl.profile && pl.profile.equipped })); }
    const n = specs.length;
    specs.forEach((sp, i) => {
      let ang; if (cfg.mode === '2v2') ang = (sp.team === 0 ? -Math.PI / 2 : Math.PI / 2) + (sp.isPlayer ? 0 : 0.5 * (i % 2 ? 1 : -1)) + (sp.team === 1 ? (i === 2 ? -0.4 : 0.4) : 0); else if (cfg.mode === 'ffa') ang = -Math.PI / 2 + i / n * Math.PI * 2; else ang = i === 0 ? -Math.PI / 2 : Math.PI / 2 + (cfg.mode === 'training' ? (i === 1 ? -0.5 : 0.5) : 0);
      const r = cfg.mode === 'training' ? 10 : R * 0.45; const pos = V(Math.cos(ang) * r, 0, Math.sin(ang) * r); const yaw = Math.atan2(-pos.x, -pos.z);
      const app = sp.app || (sp.dummy ? { gender: 'm', skin: 0, face: 1, hair: 5, hairColor: 8, outfit: 4, acc: 2, aura: 0, pose: 0 } : randomApp());
      const f = new Fighter(this, { ...sp, app, pos, yaw, loadout: sp.loadout || (sp.dummy ? { p: 'echo', a: 'thorns', s: 'hares', u: 'surge' } : randomLoadout(cfg.skill)) });
      if (sp.dummy) { f.ai = null; f.dummy = sp.dummy; f.ce = 0; }
      this.fighters.push(f);
    });
    { const pf0 = this.fighters.find(x => x.isPlayer); if (pf0) { pf0.lockOn = false; const m = cfg.mods; if (m && !cfg.ranked) { pf0.maxHp = Math.round(pf0.maxHp * m.hp); pf0.hp = pf0.maxHp; pf0.maxCe += m.ce; pf0.ce = pf0.maxCe; pf0.speedMul *= m.spd; pf0.dashCdMul *= m.dash; pf0.jumpMul = m.jump; pf0.blockLv = m.block; pf0.gaugeMul *= m.gauge; pf0.cerMul = m.cer; } } }
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + 0.3; this.spawnPts.push(V(Math.cos(a) * R * 0.5, 0, Math.sin(a) * R * 0.5)); }
  }
  spawnCurses() {
    if (this.cfg.mode === 'training' || this.cfg.net) return; const spots = this.world.curseSpots || []; const n = Math.min(spots.length, this.cfg.mode === 'ffa' ? 6 : 5);
    for (let i = 0; i < n; i++) this.makeCurse(spots[i % spots.length].clone());
  }
  makeCurse(pos) {
    const app = { gender: 'm', skin: 7, face: 4, hair: 14, hairColor: 18, outfit: 3, acc: 7, aura: 0, pose: 0 }; const c = new Fighter(this, { name: 'Curse', team: -1, app, pos, yaw: rand(0, 6.28), loadout: { p: 'echo', a: 'thorns', s: 'hares', u: 'surge' }, isCurse: true, skill: 0.3 });
    c.ch.group.scale.setScalar(0.85); c.ch.mats.forEach(m => { if (m.color) m.color.multiplyScalar(0.5); m.emissive && m.emissive.set('#2a0a3a'); m.userData.keepEmit = false; }); c.home = pos.clone(); this.fighters.push(c); return c;
  }
  /* ---- helpers for abilities ---- */
  sfx(n) { sfx(n); }
  shake(a) { this.shakeV = Math.max(this.shakeV, a); }
  aberr(a) { this.ab = Math.max(this.ab, a); }
  slowmo(sc, dur) { this.timeScale = sc; this.slowT = dur; }
  later(delay, fn) { this.timers.push({ t: delay, fn }); }
  every(iv, dur, fn) { const o = { iv, dur, acc: 0, el: 0, fn, dead: false, stop() { o.dead = true; }, every: true }; this.timers.push(o); return o; }
  enemiesOf(f) { return this.fighters.filter(e => !e.dead && e.team !== f.team); }
  nearestEnemy(f, max = 999) { let b = null, bd = 1e9, bd0 = max; for (const e of this.fighters) { if (e.dead || e.team === f.team) continue; const d0 = Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z); if (d0 >= max) continue; const d = d0 + (e.isCurse && !f.isCurse ? 11 : 0); if (d < bd) { bd = d; b = e; } } return b; }
  callout(f, text, color = '#fff', dur = 1, big = false) { if (big || (f.isPlayer && dur > 1)) this.ui.big && this.ui.big(text, color, f.isPlayer ? 'You' : f.name); else this.ui.float && this.ui.float(chest(f, 3.1), text, color); }
  summon(o) { o.dead = false; this.summons.push(o); if (o.owner === this.player) this.stats.usedShikigami = true; return o; }
  collide(f) {
    for (const c of this.world.circles) { const dx = f.pos.x - c.x, dz = f.pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + 0.55; if (d < m && d > 0.001) { f.pos.x = c.x + dx / d * m; f.pos.z = c.z + dz / d * m; } }
    for (const o of this.fighters) { if (o === f || o.dead) continue; const dx = f.pos.x - o.pos.x, dz = f.pos.z - o.pos.z, d = Math.hypot(dx, dz); if (d < 1.1 && d > 0.001 && Math.abs(f.pos.y - o.pos.y) < 2) { const push = (1.1 - d) * 0.5; f.pos.x += dx / d * push; f.pos.z += dz / d * push; } }
    const d = Math.hypot(f.pos.x, f.pos.z), B = this.world.bounds; if (d > B) { f.pos.x *= B / d; f.pos.z *= B / d; }
  }
  projectile(o) {
    const p = Object.assign({ kind: 'proj', r: 0.5, dmg: 5, life: 1, grav: 0, hit: new Set(), alive: true, size: 0.5, trail: true }, o);
    const g = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), this.fx.mat(p.color, 1)); core.scale.setScalar(p.size * 0.8); g.add(core); g.position.copy(p.pos); this.scene.add(g); p.mesh = g;
    p.kill = () => { p.alive = false; this.scene.remove(g); core.material.dispose(); core.geometry.dispose(); }; this.projs.push(p); return p;
  }
  aoe(src, c, R, dmg, o = {}) {
    const hits = []; for (const e of this.enemiesOf(src)) { if (Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < R + 0.5 && Math.abs(e.pos.y - (c.y || 0)) < 5) { const d = e.pos.clone().sub(c).setY(0); if (d.lengthSq() < 0.01) d.set(rand(-1, 1), 0, rand(-1, 1)); d.normalize(); const i = this.damage(src, e, dmg, { ...o, dir: d, kind: o.kind || 'aoe' }); if (i) { hits.push(e); if (o.root) e.root = Math.max(e.root, o.root); if (o.burn) { e.burnT = o.burn; e.burnBy = src; } } } }
    return hits;
  }
  damage(src, t, amt, o = {}) {
    if (this.dom && this.dom.spec.trial && this.dom.E && this.dom.E.phase === 'trial') { if (src && src.isPlayer && (!this._nvT || this.time - this._nvT > 1.2)) { this._nvT = this.time; this.callout(src, 'NO VIOLENCE UNTIL SENTENCED', '#ffd070', 1.2, true); } return null; }
    if (t.dead || (t.invuln > 0 && !o.pierceInvuln)) return null; if (o.noHit === undefined) o.noHit = false; const kind = o.kind || (o.melee ? 'melee' : 'status');
    if (this.dom && src && src === this.dom.f && t.team !== src.team && amt > 0 && amt < 9000 && kind !== 'melee') { // no domain deletes a full-HP fighter on its own: capped share of max HP per domain
      const dl = this.dom.dealt || (this.dom.dealt = new Map()), cap = t.maxHp * (0.5 + 0.015 * (src.dmL || 0)), used = dl.get(t) || 0; if (used >= cap) return null; amt = Math.min(amt, cap - used); dl.set(t, used + amt); }
    const dirv = o.dir ? o.dir.clone() : src ? t.pos.clone().sub(src.pos).setY(0).normalize() : V(0, 0, 1); if (dirv.lengthSq() < 0.01) dirv.set(0, 0, 1);
    const pos = chest(t);
    if (t.barrier && !o.ignoreBarrier && kind === 'melee') { this.fx.ring(pos, '#4fa8ff', 0.5, 2.6, 0.25, false); this.fx.burst(pos.clone().addScaledVector(dirv, -1), '#4fa8ff', 8, 4, 0.4, 0.3); this.sfx('barrier'); if (src) { src.vel.x -= dirv.x * 6; src.vel.z -= dirv.z * 6; } return null; }
    if (t.barrier && !o.ignoreBarrier && kind === 'proj') amt *= 0.25;
    if (t.blocking && !o.unblockable && kind !== 'status' && src && t.blockFacing(src)) {
      if (o.heavy && t.blockT < 0.22 + 0.012 * (t.blockLv || 0)) { this.fx.ring(pos, '#ffffff', 0.4, 3, 0.3, false); this.fx.burst(pos, '#ffffff', 20, 10, 0.5, 0.4); this.sfx('perfect'); this.hitstop = 0.12; this.shake(0.3); src.stun = Math.max(src.stun, 0.8); src.act = null; t.counterT = 1.2; this.float(t, 'PERFECT BLOCK', '#ffffff'); if (t.isPlayer) this.stats.perfects = (this.stats.perfects || 0) + 1; return null; }
      if (o.heavy) { amt *= 0.5; t.stun = Math.max(t.stun, 0.9); t.act = null; this.float(t, 'GUARD BREAK', '#ffb040'); this.sfx('break'); } else { this.fx.burst(pos.clone().addScaledVector(dirv, -0.8), '#ffe0a0', 6, 5, 0.3, 0.25); this.sfx('block'); t.vel.x += dirv.x * 2.5; t.vel.z += dirv.z * 2.5; amt *= Math.max(0.08, 0.2 - 0.012 * (t.blockLv || 0)); if (amt > 0.05) { t.hp -= amt; this.ui.dmg && this.ui.dmg(pos, amt, '#aab', false); t.ult = Math.min(100, t.ult + amt * 0.5); if (t.hp <= 0) { if (this.netClient) t.hp = 1; else this.kill(t, src); } } return null; }
    }
    if (t.vuln > 0) amt *= 1.25; if (src && src !== t && src.ustate && !t.isCurse && this.time - src.ustate.lastHit > 0.18) { src.ustate.lastHit = this.time; ++src.ustate.hits; } if (this.dom && src === this.dom.f && src !== t) { amt *= t.simple > 0 ? 0.55 : (DPOW[this.dom.spec.r] || 1.8); } if (t.resist[kind]) amt *= (1 - t.resist[kind]); if (t.adapt) { const v = t.adapt[kind] || 0; amt *= (1 - v); t.adapt[kind] = Math.min(0.6, v + 0.12); }
    if (t.shield > 0) { const ab = Math.min(t.shield, amt); t.shield -= ab; amt -= ab; this.fx.burst(pos, '#7affc8', 6, 4, 0.4, 0.3); }
    if (src && src !== t) t.hitBy.set(src, this.time); const info = { melee: !!o.melee, dmg: amt, echo: !!o.echo, bonus: 0, kind };
    t.hp -= amt; t.noHeal = 1.6; if (src && this.dom && this.dom.f === src && this.dom.spec.reels && !this.dom.E.win && kind !== 'status' && (!src._rh || this.time - src._rh > 0.15)) { src._rh = this.time; this.dom.E.rh = (this.dom.E.rh || 0) + 1; if (this.dom.E.rh === 5 && src.isPlayer) { this.callout(src, 'REROLL READY', '#ffe040', 1.2); this.sfx('perfect'); } } if (src) { if (src.ustate || src.cd.u <= 0) src.ult = Math.min(100, src.ult + Math.min(amt, 20) * 0.26 * src.gaugeMul * (src.ustate ? 0.8 : 1)); src.dmgDealt += amt; if (src.isPlayer) this.stats.dmg += amt; } if (t.cd.u <= 0 || t.ustate) t.ult = Math.min(100, t.ult + amt * 0.16 * (t.ustate ? 0.6 : 1)); if (t.jackT <= 0) t.jack = Math.min(100, t.jack + 4 * (((t.ab.p && t.ab.p.id === 'lucky') || (t.ab.p2 && t.ab.p2.id === 'lucky')) ? 1 : 0));
    const big = amt > 14 || o.crit;
    if (!o.noHit) { t.ch.flash(0.7); t.ch.hitK = Math.random() < 0.5; const hc = o.heavy || big ? '#ffb070' : '#ffffff'; this.fx.impact(pos, dirv, hc, big ? 1.5 : 0.8); if ((o.launch && Math.abs(o.launch) > 5) || o.heavy) { this.fx.shock(t.pos.clone(), '#d8c8b0', big ? 3 : 1.8, 0.3); this.fx.crack(t.pos, 1.2, '#ffb070', 3); this.fx.debris(t.pos.clone().setY(0.3), '#7a6a58', 3, 4); this.breakScenery(t.pos, 2.5, 1); } if (o.melee && src && big) { this.fx.slash(pos, Math.atan2(dirv.x, dirv.z), hc, big ? 1.5 : 1.0, rand(-1.2, 1.2), big ? 0.2 : 0.14); } if (o.crit || amt > 22) { this.impactFrame(pos, !!o.crit, t, src); } if (src && src.isPlayer) this.fovKick = Math.max(this.fovKick || 0, big ? 6 : 2.5); this.sfx(o.heavy ? 'heavy' : 'hit'); if (src && (src.isPlayer || t.isPlayer)) { this.hitstop = Math.max(this.hitstop, big ? 0.07 : 0.035); this.shake(big ? 0.28 : 0.1); } }
    if (!o.noKb && !o.noHit) {
      const kb = o.kb || 0; const weak = t.armor && !o.heavy && !o.launch && kind !== 'aoe';
      if (!weak) { t.vel.x = dirv.x * kb; t.vel.z = dirv.z * kb; if (o.launch) { t.vel.y = o.launch; t.launchT = 0.1 + Math.abs(o.launch) * 0.04; t.pos.y = Math.max(t.pos.y, 0.05); t.act = null; } if (o.stun) { t.stun = Math.max(t.stun, o.stun); t.act = null; } }
    } else if (o.stun && !o.noHit) { t.stun = Math.max(t.stun, o.stun); }
    if (this.ui.dmg) this.ui.dmg(pos, amt, big ? '#ffb070' : '#ffffff', big);
    if (src && !o.noPassive) { for (const s of ['p', 'p2', 'a']) { const a = src.ab[s]; if (a && a.onHit) a.onHit(src, t, this, info); } }
    if (info.bonus > 0) { t.hp -= info.bonus; this.ui.dmg && this.ui.dmg(pos.clone().add(V(0, 0.6, 0)), info.bonus, '#6be8ff', true); if (src) src.dmgDealt += info.bonus; }
    if (o.poison && !o.noPoison) { t.poisonT = o.poison; t.poisonBy = src; } if (o.burn) { t.burnT = o.burn; t.burnBy = src; }
    if (t.hp <= 0) { if (this.netClient) t.hp = 1; else this.kill(t, src); }
    return info;
  }
  float(f, text, color) { this.ui.float && this.ui.float(chest(f, 2.9), text, color); }
  kill(t, src) {
    t.lastKiller = src && src.pid || null;
    if (t.ustate) this.endState(t);
    if (t.dead) return; t.dead = true; t.hp = 0; t.act = null; t.blocking = false; t.deaths++; this.fx.burst(chest(t), '#ffffff', 40, 14, 0.8, 0.8); this.fx.shock(t.pos.clone(), '#ffffff', 6, 0.5); this.fx.flash(chest(t), '#ffffff', 6, 0.2); this.sfx('ko'); this.shake(0.5);
    if (t._orb) t._orb.visible = false;
    if (t.isCurse) { if (src && src.isPlayer) { this.stats.curses = (this.stats.curses || 0) + 1; src.ult = Math.min(100, src.ult + 2.5 * src.gaugeMul); } this.later(2.2, () => { this.scene.remove(t.ch.group); const i = this.fighters.indexOf(t); if (i >= 0) this.fighters.splice(i, 1); t.ch.dispose(); }); this.later(14, () => { if (!this.over) this.makeCurse(t.home.clone()); }); return; }
    if (src && src !== t) { src.kos++; if (src.isPlayer) this.stats.kos++; }
    const assist = []; for (const [f2, tm] of t.hitBy) { if (f2 !== src && this.time - tm < 6 && !f2.dead && !f2.isCurse) { f2.assists++; assist.push(f2.name); if (f2.isPlayer) this.stats.assists = (this.stats.assists || 0) + 1; } } t.hitBy.clear();
    if (this.cfg.mode !== 'training') this.slowmo(0.3, 0.9); this.ui.feed && this.ui.feed(src ? src.name : '—', t.name, src && src.isPlayer, assist);
    if (this.cfg.mode === 'training') { this.later(2, () => this.resetFighter(t)); return; }
    if (src && src !== t) { this.score[src.team] = (this.score[src.team] || 0) + 1; } this.ui.score && this.ui.score(this);
    if (this.goal && src && src !== t && this.score[src.team] >= this.goal && !this.over && !this.netClient) { this.finish(src.team); return; }
    if (t.isPlayer && this.ui.cine) this.ui.cine('respawn', 3);
    if (!this.netClient) this.later(3, () => { if (!this.over) this.respawn(t); });
  }
  respawn(f) {
    if (f.gone) return;
    let best = this.spawnPts[0], bd = -1; for (const p of this.spawnPts) { let m = 1e9; for (const e of this.fighters) { if (e.dead || e === f || e.isCurse) continue; m = Math.min(m, Math.hypot(e.pos.x - p.x, e.pos.z - p.z)); } if (m > bd) { bd = m; best = p; } }
    if (f.team >= 0 && this.cfg.mode === '2v2') { const mate = this.fighters.find(o => o !== f && o.team === f.team && !o.dead); if (mate) best = mate.pos.clone().add(V(rand(-3, 3), 0, rand(-3, 3))); }
    f.dead = false; f.hp = f.maxHp; f.ce = f.maxCe; f.stun = f.freeze = f.root = f.launchT = 0; f.vel.set(0, 0, 0); f.ch.s.ko = false; f.pos.copy(best); f.ch.group.rotation.x = 0; f.invuln = 2.5; f.act = null; f.hitBy.clear(); this.fx.ring(best.clone().setY(0.2), '#9be8ff', 0.5, 4, 0.5); this.fx.burst(best.clone().setY(1), '#9be8ff', 20, 7, 0.6, 0.6); if (f.isPlayer && this.ui.cine) this.ui.cine('respawn', 0);
  }
  resetFighter(f) { f.dead = false; f.hp = f.maxHp; f.ce = f.maxCe; f.ult = 0; f.stun = f.freeze = f.root = f.launchT = 0; f.vel.set(0, 0, 0); f.ch.s.ko = false; f.pos.set(rand(-4, 4), 0, rand(-4, 4) - 12); f.ch.group.rotation.x = 0; }
  resetTraining() { for (const f of this.fighters) { this.resetFighter(f); if (f.isPlayer) f.pos.set(0, 0, 10); else f.pos.set(f.dummy === 'static' ? -6 : 6, 0, -8); f.cd = { p: 0, a: 0, s: 0, u: 0 }; f.ult = 100; } this.projs.forEach(p => p.kill()); this.projs = []; }
  finish(winTeam) {
    if (this.over) return; this.over = true; this.state = 'end'; this.endT = 0; if (this.net && this.net.host) this.net.send({ k: 'end', win: winTeam }); this.slowmo(0.35, 1.2);
    const pt = this.player.team; const won = winTeam === pt; const draw = winTeam === undefined;
    if (this.dom) this.endDomain(); const rows = this.fighters.filter(f => !f.isCurse).map(f => ({ name: f.name, team: f.team, kos: f.kos, deaths: f.deaths, assists: f.assists, dmg: Math.round(f.dmgDealt), me: f.isPlayer, sc: f.kos * 3 + f.assists * 1.5 + f.dmgDealt / 90 + 1 })); rows.sort((a, b) => b.sc - a.sc); if (rows[0]) rows[0].mvp = true;
    this.result = { won, draw, kos: this.stats.kos, assists: this.stats.assists || 0, curses: this.stats.curses || 0, dmg: Math.round(this.stats.dmg), crits: this.stats.crits, casts: this.stats.castMap || {}, perfects: this.stats.perfects || 0, usedShikigami: this.stats.usedShikigami, mode: this.cfg.mode, map: this.cfg.map, rows, score: { ...this.score }, myTeam: pt };
    this.ui.end && this.ui.end(this.result);
  }
  timeout() {
    const hpf = {}; for (const f of this.fighters) hpf[f.team] = (hpf[f.team] || 0) + (f.dead ? 0 : f.hp / f.maxHp); let best = null, bv = -1, tie = false; for (const k in hpf) { if (hpf[k] > bv + 0.001) { bv = hpf[k]; best = +k; tie = false; } else if (Math.abs(hpf[k] - bv) <= 0.001) tie = true; } this.finish(tie ? undefined : best);
  }

  /* ---- online play: every peer simulates; the host's snapshots keep everyone honest ---- */
  netCollect(I) { const a = this._acc; a.c = { mx: +I.mx.toFixed(2), mz: +I.mz.toFixed(2), l: I.light ? 1 : 0, h: I.heavy ? 1 : 0, b: I.block ? 1 : 0, sp: I.sprint ? 1 : 0 }; for (const k in I.ab) { (a.ab = a.ab || {})[k] = 1; } if (I.dash) a.d = 1; if (I.jump) a.j = 1; if (I.sd) a.sd = 1; }
  netTick(rdt) {
    const N = this.net;
    if (this.netClient) { // smooth remote fighters toward the latest host snapshot (extrapolated by its age) instead of stepping at every update
      const now = performance.now(), k = 1 - Math.exp(-11 * rdt); for (const f of this.fighters) { const T = f._nTgt; if (!T || f.isPlayer || f.dead || f.gone) continue; const age = Math.min(0.18, (now - T.t) / 1000), tx = T.x + T.vx * age, tz = T.z + T.vz * age; const ex = tx - f.pos.x, ez = tz - f.pos.z; if (Math.hypot(ex, ez) > 4.5) { f.pos.x = tx; f.pos.z = tz; } else { f.pos.x += ex * k; f.pos.z += ez * k; } f.pos.y += (T.y - f.pos.y) * k; f.yaw += angDiff(f.yaw, T.yaw) * k; } } this._nt += rdt; if (this._nt >= 1 / 45) { this._nt = 0; const a = this._acc; this._acc = {}; N.send({ k: 'in', s: a.c || (this._lastC = this._lastC || {}), e: { ab: a.ab, d: a.d, j: a.j, sd: a.sd } }); if (a.c) this._lastC = a.c; }
    if (N.host) { this._ns += rdt; if (this._ns >= 0.05) { this._ns = 0; N.send({ k: 'snap', f: this.fighters.filter(f => f.pid).map(f => [f.pid, +f.pos.x.toFixed(2), +f.pos.y.toFixed(2), +f.pos.z.toFixed(2), +f.yaw.toFixed(2), Math.round(f.hp), Math.round(f.ce), Math.round(f.ult), f.dead ? 1 : 0, f.lastKiller || 0]), sc: this.score, cl: this.cine && this.cine.type === 'clash' ? [Math.round(this.cine.pa), Math.round(this.cine.pb)] : undefined }); }
    }
  }
  netIntent(f) {
    const I = f.intent, s = f.netS || {}; I.mx = s.mx || 0; I.mz = s.mz || 0; I.light = !!s.l; I.heavy = !!s.h; I.block = !!s.b; I.sprint = !!s.sp;
    for (const e of f.netQ) { if (e.ab) for (const k in e.ab) I.ab[k] = true; if (e.d) I.dash = true; if (e.j) I.jump = true; if (e.sd) I.sd = true; } f.netQ.length = 0; f.target = this.nearestEnemy(f, 60);
  }
  netRecv(from, d) {
    if (!d) return; if (d.k === 'in') { const f = this.fighters.find(x => x.pid === from); if (f && f.remote) { if (d.s) f.netS = d.s; if (d.e && d.e.m) f.netM = (f.netM || 0) + d.e.m; if (f.netQ.length < 30) f.netQ.push(d.e || {}); } return; }
    if (d.k === 'clash' && this.netClient) { const fa = this.fighters.find(o => o.pid === d.a), fb = this.fighters.find(o => o.pid === d.b), sa = A[d.sa], sb = A[d.sb]; if (fa && fb && sa && sb) this.startClash({ f: fa, spec: sa.spec }, { f: fb, spec: sb.spec }, d.key); return; }
    if (d.k === 'clashEnd' && this.netClient) { if (this.cine && this.cine.type === 'clash') this.cine.forceWin = d.win; return; }
    if (d.k === 'snap' && this.netClient) {
      for (const [pid, x, y, z, yaw, hp, ce, ult, dead, kb] of d.f) { const f = this.fighters.find(o => o.pid === pid); if (!f || f.gone) continue;
        const dx = x - f.pos.x, dz = z - f.pos.z, err = Math.hypot(dx, dz) + Math.abs(y - f.pos.y);
        if (f.isPlayer) { if (err > 4) { f.pos.set(x, y, z); } } else { if (err > 5) { f.pos.set(x, y, z); f._nTgt = null; } else { const now = performance.now(), pv = f._nTgt; let vx = 0, vz = 0; if (pv) { const sdt = (now - pv.t) / 1000; if (sdt > 0.02 && sdt < 0.4) { vx = (x - pv.x) / sdt; vz = (z - pv.z) / sdt; vx = pv.vx * 0.4 + vx * 0.6; vz = pv.vz * 0.4 + vz * 0.6; } } f._nTgt = { x, y, z, yaw, t: now, vx, vz }; } }
        f.ce = ce; f.ult = ult; if (dead) { if (!f.dead) { f.hp = 0; this.kill(f, this.fighters.find(o => o.pid === kb) || null); } } else { if (f.dead) { this.respawn(f); f.pos.set(x, y, z); } f.hp = hp; }
      }
      if (d.cl && this.cine && this.cine.type === 'clash') { this.cine.pa = Math.max(this.cine.pa, d.cl[0]); this.cine.pb = Math.max(this.cine.pb, d.cl[1]); }
      if (d.sc) { this.score = d.sc; this.ui.score && this.ui.score(this); } return;
    }
    if (d.k === 'end' && this.netClient && !this.over) { this.finish(d.win); return; }
  }
  netPeerLeft(pid) {
    const f = this.fighters.find(o => o.pid === pid); if (!f || f.gone) return; f.gone = true; this.anyLeft = true; f.hp = 0; if (!f.dead) { const prev = this.netClient; this.netClient = false; this.kill(f, null); this.netClient = prev; } f.ch.group.visible = false; this.callout(f, f.name + ' LEFT', '#ff8a8a', 1.4, true);
    if (this.net && this.net.host && !this.over) { const alive = new Set(this.fighters.filter(o => !o.gone && !o.isCurse).map(o => o.team)); if (alive.size <= 1) this.finish([...alive][0]); }
  }
  /* ---- player intent + AI ---- */
  playerIntent(input) {
    const p = this.player, I = p.intent; const y = this.camYaw; const f = V(Math.sin(y), 0, Math.cos(y)), r = V(-Math.cos(y), 0, Math.sin(y)); let mx = 0, mz = 0;
    const k = input.keys, K = this.keys || (this.keys = Object.assign({ move: ['KeyW', 'KeyS', 'KeyA', 'KeyD'], jump: 'Space', dash: 'KeyQ', sprint: 'ShiftLeft', block: 'KeyF', heavy: 'KeyR', simple: 'KeyC', shiftlock: 'KeyZ', slots: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'], emote: 'KeyB', lock: 'KeyV', switch: 'KeyE' }, this.cfg.keys || {}));
    if (k[K.move[0]]) { mx += f.x; mz += f.z; } if (k[K.move[1]]) { mx -= f.x; mz -= f.z; } if (k[K.move[3]]) { mx += r.x; mz += r.z; } if (k[K.move[2]]) { mx -= r.x; mz -= r.z; }
    I.mx = mx; I.mz = mz; const lightNow = input.mouse[0] || false; if (lightNow && !this._lp) this.trialPressPending = true; this._lp = lightNow; I.light = lightNow; I.heavy = !!(input.mouse[2] || input.edge[K.heavy]); I.block = !!k[K.block]; I.sprint = false;
    if (input.edge[K.dash] || input.edge[K.sprint] || input.edge['ShiftRight']) { I.dash = true; if (!I.mx && !I.mz) { const sh = input.edge[K.sprint] || input.edge['ShiftRight'], en = sh ? this.nearestEnemy(p, 60) : null; if (en) { const ax = p.pos.x - en.pos.x, az = p.pos.z - en.pos.z, an = Math.atan2(ax, az) + (Math.random() * 2 - 1) * 1.15; I.mx = Math.sin(an); I.mz = Math.cos(an); } else { I.mx = f.x; I.mz = f.z; } } } if (input.edge[K.jump]) I.jump = true;
    const SK = ['a', 'p', 's', 'u', 'd']; K.slots.forEach((c, i) => { if (input.edge[c]) I.ab[SK[i]] = true; }); if (input.edge[K.p2 || 'KeyG']) I.ab.p2 = true; if (input.edge['Digit6'] || input.edge[K.simple]) I.sd = true; if (this.net) this.netCollect(I);
    { const mm = !!input.mouse[1], mmE = mm && !this._mmP; this._mmP = mm; if (input.edge[K.lock] || mmE) this.toggleLock(); } if (input.edge[K.shiftlock]) { this.shiftLock = !this.shiftLock; try { localStorage.setItem('hexclash_sl', this.shiftLock ? '1' : '0'); } catch (e) { } this.ui.float && this.ui.float(chest(p, 3.1), this.shiftLock ? 'SHIFT LOCK ON' : 'SHIFT LOCK OFF', '#ffffff'); }
    if (input.edge[K.switch] && p.lockOn) this.switchLock(1);
    if (input.edge[K.emote]) { this.emoteT = 1.6; this.sfx('click'); }
  }
  botIntent(f, dt) {
    const I = f.intent, ai = f.ai; if (f.dummy) { this.dummyIntent(f, dt); return; } if (this.state !== 'fight' || f.dead || this.cine) { I.mx = I.mz = 0; I.light = I.heavy = I.block = false; return; }
    if (f.isCurse) { const t = this.fighters.filter(e => !e.dead && !e.isCurse && Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z) < 13).sort((a, b) => a.pos.distanceTo(f.pos) - b.pos.distanceTo(f.pos))[0]; f.target = t || null; I.light = I.heavy = I.block = false; if (!t) { ai.t -= dt; if (ai.t <= 0) { ai.t = rand(1.5, 4); const a = rand(0, 6.28); ai.wx = f.home.x + Math.cos(a) * rand(2, 8); ai.wz = f.home.z + Math.sin(a) * rand(2, 8); } const dx = (ai.wx ?? f.pos.x) - f.pos.x, dz = (ai.wz ?? f.pos.z) - f.pos.z, d = Math.hypot(dx, dz); I.mx = d > 1 ? dx / d * 0.35 : 0; I.mz = d > 1 ? dz / d * 0.35 : 0; return; } const v = t.pos.clone().sub(f.pos); v.y = 0; const dist = v.length(); v.normalize(); I.mx = dist > 2.2 ? v.x * 0.55 : 0; I.mz = dist > 2.2 ? v.z * 0.55 : 0; ai.atkT -= dt; if (dist < 2.8 && ai.atkT <= 0) { I.light = true; ai.atkT = rand(1.0, 1.9); } return; }
    const t = this.nearestEnemy(f); f.target = t; if (!t) return; const v = t.pos.clone().sub(f.pos); v.y = 0; const dist = v.length(); const dir = v.clone().normalize(); const sk = f.skill;
    ai.t -= dt; ai.st -= dt; ai.atkT -= dt; ai.blockT -= dt; if (ai.st <= 0) { ai.st = rand(1, 2.5); ai.strafe = Math.random() < 0.5 ? 1 : -1; }
    const side = V(dir.z, 0, -dir.x); I.light = I.heavy = false; I.block = ai.blockT > 0;
    const threat = t.act && (t.act.type === 'heavy' || (t.act.type === 'light' && t.act.idx === 3)) && dist < 4.5; if (threat && ai.blockT <= 0 && Math.random() < dt * (3 + sk * 6)) { ai.blockT = rand(0.35, 0.7); if (Math.random() < 0.35 && f.dashCd <= 0) { I.dash = true; I.mx = -dir.x + side.x * ai.strafe; I.mz = -dir.z + side.z * ai.strafe; return; } }
    let mv = V();
    if (dist > 3.0) { mv.addScaledVector(dir, 1).addScaledVector(side, ai.strafe * 0.35); if (dist > 9 && f.dashCd <= 0 && Math.random() < dt * 0.7) { I.dash = true; I.mx = dir.x; I.mz = dir.z; } }
    else { mv.addScaledVector(side, ai.strafe * 0.5).addScaledVector(dir, dist < 2 ? -0.3 : 0.2); }
    if (ai.blockT > 0) mv.multiplyScalar(0.3); I.mx = mv.x; I.mz = mv.z;
    if (dist < 3.4 && ai.atkT <= 0 && ai.blockT <= 0) { if (Math.random() < 0.18) I.heavy = true; else { I.light = true; } ai.atkT = rand(0.08, 0.45) / (0.6 + sk); }
    if (f.comboT > 0 && dist < 3.8 && Math.random() < 0.7 && ai.blockT <= 0) I.light = true;
    if (t.air && !f.air && dist < 3 && Math.random() < dt * 1.5) I.jump = true;
    if (Math.random() < dt * 0.5 && !f.air && dist > 5) I.jump = true;
    // abilities
    if (this.windup && this.windup.f.team !== f.team && f.ab.d && f.ce >= CLASH_CE && f.cd.d <= 0 && Math.random() < dt * (0.2 + sk * 1.0)) { I.ab.d = true; return; }
    if (this.dom && this.dom.f.team !== f.team && !f.simple && f.sdCd <= 0 && f.ce >= 30 && Math.random() < dt * (0.35 + sk * 1.8)) { I.sd = true; }
    if (f.ustate) { const st = f.ustate; ai.mt = (ai.mt || 0) - dt; if (f.ab.d && f.cd.d <= 0 && f.ult >= 99.5 && !(f.burnT > 0) && Math.random() < dt * (0.7 + sk) && !this.dom) { I.ab.d = true; return; }
      if (ai.mt <= 0) { ai.mt = rand(0.3, 0.7); for (const i of [3, 2, 0, 1]) { if (f.ucd[i] <= 0 && dist < (i === 1 ? 20 : 15) && Math.random() < 0.55) { I.ab['apsu'[i]] = true; break; } } } }
    if (!f.ustate && ai.t <= 0) { ai.t = rand(0.35, 0.9); for (const s of ['a', 's', 'p', 'u']) { const a = f.ab[s]; if (!a || f.cd[s] > 0) continue; const hp = f.hp / f.maxHp; let go = false;
      if (s === 'u') go = f.ult >= (a.ultCost || 100) && (a.domain ? true : dist < 14) && Math.random() < 0.5 * (0.4 + sk); else if (s === 'p') { if (a.id === 'mend') { if ((hp < 0.65) !== !!f.mend) go = true; } else if (a.id === 'still') { go = (dist < 7 && !f.barrierOn && f.ce > 50 && Math.random() < 0.3) || (f.barrierOn && dist > 14 && Math.random() < 0.5); } else if (a.id === 'hush') go = dist < 7 && Math.random() < 0.5; else if (a.id === 'lucky') go = f.jack >= 100; else if (a.id === 'swap') go = false; else if (a.id === 'overdrive') go = !!f.crit && Math.random() < 0.5 * sk; }
      else go = Math.random() < 0.55 * (0.5 + sk) && (dist < 24 && (s === 's' || a.id === 'mass' || a.id === 'thunder' || a.id === 'nova' ? dist < 12 : true));
      if (go && f.ce >= (a.cost || 0) * f.ceMul) { I.ab[s] = true; break; } } }
  }
  dummyIntent(f, dt) {
    const I = f.intent; I.mx = I.mz = 0; I.light = I.heavy = I.block = false; f.ce = Math.min(100, f.ce); if (f.dummy === 'dodge' && !f.dead) { const t = this.player; f.target = t; f.ai = f.ai || { t: 0 }; f.ai.t = (f.ai.t || 0) - dt; const v = t.pos.clone().sub(f.pos); v.y = 0; const d = v.length(); v.normalize(); if (d < 9) { I.mx = -v.z * 0.6; I.mz = v.x * 0.6; } if (f.ai.t <= 0) { f.ai.t = rand(1, 2.2); if (Math.random() < 0.5 && f.dashCd <= 0) { I.dash = true; I.mx = rand(-1, 1); I.mz = rand(-1, 1); } else f.yaw = Math.atan2(v.x, v.z); } if (t.act && d < 4 && Math.random() < dt * 2) I.block = true; }
  }
  /* ---- main update ---- */
  update(rdt, input) {
    if (this.net) this.netTick(rdt);
    { const xh = typeof document !== 'undefined' && document.getElementById('xh'); if (xh) xh.style.display = this.shiftLock && !this.player.lockOn && !this.cine ? 'block' : 'none'; }
    const eng = this.eng; this.hitstop = Math.max(0, this.hitstop - rdt); if (this.slowT > 0) { this.slowT -= rdt; if (this.slowT <= 0) this.timeScale = 1; }
    let dt = this.hitstop > 0 ? 0.0001 : rdt * this.timeScale; dt = Math.min(dt, 0.05);
    const pf = this.player;
    // ---------- cinematic freeze ----------
    if (!this.cine && this._cineHid) { this._cineHid = false; for (const o of this.fighters) if (o.ch && !o.isCurse) o.ch.group.visible = true; else if (o.ch && o.isCurse && !o.dead) o.ch.group.visible = true; }
    if (this.cine) { this.updateCine(rdt, input); this.fx.update(rdt); this.world.update(this.time, 0, pf.pos); if (this.dom && this.dom.E.upd) this.dom.E.upd(this.time, rdt, this); this.updateCamera(rdt, input); this.endFrameFx(rdt); if (this.ui.hud) this.ui.hud(this); return; }
    this.time += dt;
    if (this.state === 'count') { this.count -= rdt; this.ui.count && this.ui.count(this.count); if (this.count <= 0) { this.state = 'fight'; this.ui.count && this.ui.count(-1); this.sfx('go'); music('battle'); } for (const f of this.fighters) f.ch.group.visible = f.team === pf.team || this.count <= 0; }
    if (this.state === 'fight') { this.matchT += dt; }
    const act = this.state === 'fight' || this.state === 'training';
    if (act && !pf.dead && input) this.playerIntent(input); else if (!pf.ai) { pf.intent.mx = pf.intent.mz = 0; pf.intent.light = pf.intent.heavy = pf.intent.block = false; }
    if (this.trialPressPending) { if (pf.trialMash) this.trialPress++; this.trialPressPending = false; }
    if (this.emoteT > 0) { this.emoteT -= rdt; pf.ch.s.pose = this.emoteT > 0 && !pf.act && Math.hypot(pf.vel.x, pf.vel.z) < 1 ? 4 : 0; }
    if (input && this.state === 'training' && input.edge['KeyT']) this.resetTraining();
    // targets
    if (!pf.dead) { if (pf.lockOn) { let lp = this.lockPick; if (!lp || lp.dead || lp.pos.distanceTo(pf.pos) > 48) { const n = this.nearestEnemy(pf, 32); if (n) { this.lockPick = n; if (lp && lp.dead) this.sfx('click'); } else { pf.lockOn = false; this.lockPick = null; this.ui.float && this.ui.float(chest(pf, 3.1), 'LOCK LOST', '#ff8a8a'); } } }
      let tg = pf.lockOn ? this.lockPick : null; if (!tg) { let bd = 40, cf = V(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)); for (const e of this.enemiesOf(pf)) { const v = e.pos.clone().sub(pf.pos); v.y = 0; const d = v.length(); if (d < bd && v.normalize().dot(cf) > 0.5) { bd = d; tg = e; } } } pf.target = tg; this.updateLockMarker(pf); }
    // domain wind-up
    if (this.windup) { const w = this.windup; w.t -= dt; const c = w.f.pos; if (Math.random() < 0.9) this.fx.emit(c.clone().add(V(rand(-5, 5), rand(0, 0.5), rand(-5, 5))), V(0, rand(3, 7), 0), w.spec.color, 0.6, 0.7, { drag: 0.4 }); if (w.f.stun > 0) w.f.stun = 0; w.f.invuln = Math.max(w.f.invuln, 0.2); { const pl = this.player; if (pl && !pl.dead && w.f.team !== pl.team) { const can = !!pl.ab.d && pl.ce >= CLASH_CE && pl.cd.d <= 0; this.ui.cine('counter', { show: true, can, ce: Math.floor(pl.ce), need: CLASH_CE, hasD: !!pl.ab.d, t: Math.max(0, w.t) / (w.dur || WINDUP), color: w.spec.color }); } } if (w.f.dead) { this.windup = null; this.ui.cine('warning', null); this.ui.cine('counter', { show: false }); music('battle'); this.callout(w.f, 'DOMAIN INTERRUPTED', '#ffffff', 1.4, true); this.sfx('break'); w.f.ult = Math.max(w.f.ult, 40); } else if (w.t <= 0) { this.windup = null; this.ui.cine('warning', null); this.ui.cine('counter', { show: false }); this.beginCine(w.f, w.spec); } }
    for (const f of this.fighters) { if (f.remote) this.netIntent(f); else if (!f.isPlayer) this.botIntent(f, dt); f.update(dt); if (f.pos.y > 30) f.pos.y = 30; }
    if (this.dom) this.tickDomain(dt);
    // projectiles
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i]; if (!p.alive) { this.projs.splice(i, 1); continue; }
      p.life -= dt; p.vel.y -= p.grav * dt;
      for (const e of this.fighters) if (e.barrier && e.team !== p.owner.team && !p.strong && e.pos.distanceTo(p.pos) < 3.4) p.vel.multiplyScalar(Math.exp(-9 * dt));
      p.pos.addScaledVector(p.vel, dt); if (p.settle && p.pos.y < 0.35) { p.pos.y = 0.35; p.vel.set(0, 0, 0); p.grav = 0; }
      p.mesh.position.copy(p.pos); if (p.trail !== false && Math.random() < 0.9) this.fx.emit(p.pos, V(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4)), p.color, p.size * 0.9, 0.3, { drag: 3 });
      if (!p.nohit && p.dmg >= 0) for (const e of this.enemiesOf(p.owner)) { if (p.hit.has(e)) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; if (Math.hypot(dx, dz) < p.r + 0.6 && p.pos.y > e.pos.y - 0.4 && p.pos.y < e.pos.y + 2.6) { p.hit.add(e); const d = p.vel.clone().setY(0).normalize(); if (p.dmg > 0 || p.onHit) { if (p.dmg > 0) this.damage(p.owner, e, p.dmg, { kind: p.kind, kb: p.kb || 2, stun: p.stun || 0.15, dir: d, poison: p.poison, noPassive: true }); p.onHit && p.onHit(p, e); } if (!p.pierce) { p.kill(); break; } } }
      if (p.alive && (p.life <= 0 || Math.hypot(p.pos.x, p.pos.z) > this.world.bounds + 6)) { p.alive = false; p.kill(); p.onEnd && p.onEnd(p); }
      else if (p.alive && p.pos.y < 0 && !p.settle) { p.kill(); p.onEnd && p.onEnd(p); }
    }
    for (let i = this.summons.length - 1; i >= 0; i--) { const s = this.summons[i]; s.life -= dt; if (s.owner.dead) s.life = 0; s.update(dt, s); if (s.life <= 0.05) this.summons.splice(i, 1); }
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; if (t.every) { if (t.dead) { this.timers.splice(i, 1); continue; } t.acc += dt; t.el += dt; if (t.acc >= t.iv) { const d = t.acc; t.acc = 0; t.fn(d); } if (t.el >= t.dur) { t.dead = true; this.timers.splice(i, 1); } } else { t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } } }
    this.fx.update(rdt); this.world.update(this.time, dt, pf.pos);
    this.updateCamera(rdt, input);
    if (this.state === 'end') { this.endT += rdt; }
    this.endFrameFx(rdt);
    if (this.ui.hud) this.ui.hud(this);
  }
  endFrameFx(rdt) {
    const eng = this.eng, pf = this.player; this.shakeV = Math.max(0, this.shakeV - rdt * 2.2); this.ab = Math.max(0, this.ab - rdt * 2.2); this.fovKick = Math.max(0, (this.fovKick || 0) - rdt * 22);
    const dm = this.cine || this.dom; const col = this.cine && this.cine.spec ? this.cine.spec.color : this.dom ? this.dom.spec.color : '#000000'; const tc = new THREE.Color(col);
    eng.fin.uniforms.uAb.value = this.ab * 0.012 + (this.cine ? 0.0015 : 0); eng.fin.uniforms.uVig.value = (this.cine ? 0.85 : 0.5) + (pf.hp / pf.maxHp < 0.3 ? 0.35 : 0); eng.fin.uniforms.uWarp.value = this.timeScale < 1 ? 0.6 : (this.cine ? 0.25 : 0);
    if (this.cine && this.cine.type === 'domain') eng.fin.uniforms.uTint.value.set(tc.r * 0.12, tc.g * 0.12, tc.b * 0.12); else if (this.dom) eng.fin.uniforms.uTint.value.set(tc.r * 0.035, tc.g * 0.035, tc.b * 0.035); else eng.fin.uniforms.uTint.value.set(0, 0, 0);
    this.fx.setScale(eng.size.h); eng.fin.uniforms.uRes.value.set(eng.size.w, eng.size.h);
  }
  /* ---- domain orchestration ---- */
  enterState(f, def) {
    f.ustate = { def, t: def.dur, hits: 0, lastHit: 0, moves: f.umEquip || def.moves }; f.ucd = [0, 0, 0, 0]; f.dmgMul *= 1.35; f.speedMul *= 1.2; f.invuln = Math.max(f.invuln, 0.8);
    if (!this.net && !this.cine && !this.dom && this.cfg.mode !== 'none') { f.invuln = Math.max(f.invuln, 3); f.lock = Math.max(f.lock, 0.2); this.cine = { type: 'awaken', t: 0, dur: 2.7, f, def, burst: false }; this.ui.cine('bars', true); this.sfx('domainwarn'); this.later(0.5, () => speak('Awakening!', { urgent: true })); this.shake(0.3); f.ch.s.cast = 2; return; }
    this.awakenFx(f, def);
  }
  awakenFx(f, def) {
    const c = chest(f, 1.2), col = def.color;
    this.callout(f, def.name.toUpperCase(), col, 1.8, true); this.sfx('power'); this.sfx('boom'); this.shake(1); this.aberr(1.2); this.ui.cine && this.ui.cine('flash', col);
    this.fx.flash(c, col, 12, 0.4); this.fx.shock(f.pos.clone(), col, 14, 0.7); this.fx.shock(f.pos.clone(), '#ffffff', 8, 0.4, 0.1); this.fx.ring(f.pos.clone().setY(0.2), col, 1, 16, 0.8); this.fx.orb(c, col, 1, 16, 0.6); this.fx.burst(c, col, 60, 22, 0.9, 1); this.fx.pillar(f.pos.clone(), col, 40, 2.4, 1.2); this.fx.vortex(() => f.ustate ? f.pos : null, col, 2.2, 6, 2.2, 90); this.fx.eruption(f.pos.clone(), col, 3, 10); for (let k = 0; k < 6; k++) this.fx.fork(c.clone().add(V(rand(-1, 1), 12, rand(-1, 1))), f.pos.clone().add(V(rand(-4, 4), 0, rand(-4, 4))), col, 0.3);
    for (let i = 0; i < 8; i++) this.fx.bolt(c.clone().add(V(rand(-3, 3), rand(6, 11), rand(-3, 3))), c.clone().add(V(rand(-1, 1), 0, rand(-1, 1))), col, 0.18, 0.2);
  }
  endState(f) { if (!f.ustate) return; f.dmgMul /= 1.35; f.speedMul /= 1.2; f.ustate = null; this.fx.ring(f.pos.clone().setY(0.2), '#ffffff', 6, 1, 0.5); this.sfx('whoosh'); }
  domain(f, spec) {
    if (this.cine || this.dom) return false;
    if (this.netClient && this.windup && this.windup.f !== f) return false;
    if (this.windup && this.windup.f !== f) { return this.startClash(this.windup, { f, spec }); }
    if (this.windup) return false;
    f.stun = 0; f.freeze = 0; f.root = 0; f.launchT = 0; f.act = null; f.invuln = Math.max(f.invuln, 1.3); f.vel.x *= 0.2; f.vel.z *= 0.2; for (const e of this.enemiesOf(f)) { if (e.act) e.act = null; e.comboGap = Math.max(e.comboGap || 0, 1.3); e.lock = Math.max(e.lock, 0.3); } this.callout(f, 'DOMAIN EXPANSION', '#ffffff', 1.0, true); this.later(0.45, () => speak('Domain expansion!', { urgent: true, pitch: 0.7, rate: 1.0 }));
    f.lock = Math.max(f.lock, WINDUP); f.castAnim = WINDUP; f.castWarn = WINDUP; this.windup = { f, spec, t: WINDUP, dur: WINDUP }; if (this.player && f.team !== this.player.team && !this.player.dead) music('clash'); this.sfx('domainwarn'); this.ui.cine('warning', { name: spec.name, color: spec.color, who: f.name });
    this.fx.ring(f.pos.clone().setY(0.2), spec.color, 1, 14, 1.0); this.fx.ring(f.pos.clone().setY(0.2), '#ffffff', 14, 1, 1.0); this.shake(0.3); f.ch.s.cast = 2; return true;
  }
  startClash(a, b, keyArg) {
    if (this.cine && this.cine.type === 'clash') return true; speak('Domain clash!', { urgent: true }); this.windup = null; this.ui.cine('warning', null); this.ui.cine('counter', { show: false }); const key = keyArg || pick(['KeyJ', 'KeyK', 'KeyL']); a.f.netM = 0; b.f.netM = 0; if (this.net && this.net.host) this.net.send({ k: 'clash', a: a.f.pid, b: b.f.pid, key, sa: a.spec.id, sb: b.spec.id }); this.cine = { type: 'clash', t: 0, dur: 3.6, a, b, key, pa: 0, pb: 0 }; this.sfx('domainwarn'); this.sfx('boom'); this.ui.cine('bars', true); this.ui.cine('clash', { show: true, a: a.f.name, b: b.f.name, key: key.replace('Key', ''), pa: 0, pb: 0, t: 0, me: a.f.isPlayer ? 'a' : b.f.isPlayer ? 'b' : null }); this.shake(1); this.aberr(1);
    for (const x of [a, b]) { x.f.ch.s.cast = 2; this.fx.ring(x.f.pos.clone().setY(0.2), x.spec.color, 1, 16, 1.2); } return true;
  }
  beginCine(f, spec) {
    f.dmL = this.masteryOf(f, spec.id); this.later(2.4, () => speak(spec.name + '!', { urgent: true, pitch: 0.7, rate: 1.0 })); if (f.dmL >= 1 && f.isPlayer) this.callout(f, 'DOMAIN MASTERY ' + f.dmL, '#ffd76a', 1.0);
    this.cine = { type: 'domain', t: 0, dur: 5.8, f, spec, swapped: false, titled: false, E: null }; this.ui.cine('bars', true); this.ui.cine('hands', spec.color); music('domain'); this.sfx('domainfx'); f.ch.s.cast = 2; f.invuln = Math.max(f.invuln, 6.2); this.speechLine && this.speechLine(spec.name);
    this.camSave = { pos: this.camPos.clone() }; this.shake(0.3);
  }
  masteryOf(f, id) { if (this.cfg.ranked) return 10; if (f.isPlayer) return (this.cfg.mast || {})[id] || 0; if (f.remote || f.dummy || f.isCurse) return 0; return Math.round((f.skill || 0.5) * 8); }
  masteryFx(f, a) {
    const L = this.masteryOf(f, a.id); if (L < 2 || f.dead) return; const col = a.color || '#ffffff', c = chest(f, 1.2), P = f.pos.clone();
    this.fx.sparks(c, col, 4 + L, 5 + L * 0.4, 0.4);
    if (L >= 4) this.fx.ring(P.clone().setY(0.15), col, 0.4, 1.6 + L * 0.12, 0.45);
    if (L >= 6) for (let i = 0; i < 8; i++) this.fx.emit(P.clone().add(V(rand(-0.9, 0.9), 0.1, rand(-0.9, 0.9))), V(0, rand(2, 5), 0), col, 0.18, 0.9, { drag: 0.6, bright: 1.8 });
    if (L >= 8) this.fx.flash(c, '#ffe9a8', 2.2, 0.22);
    if (L >= 10) { this.fx.ring(P.clone().setY(0.2), '#ffd76a', 0.5, 3.4, 0.6); this.fx.pillar(P.clone(), '#ffd76a', 9, 0.5, 0.5); for (let i = 0; i < 10; i++) { const an = i / 10 * 6.283; this.fx.emit(P.clone().add(V(Math.cos(an) * 1.2, 0.2, Math.sin(an) * 1.2)), V(0, rand(3, 6), 0), '#ffd76a', 0.2, 1, { drag: 0.5, bright: 2 }); } }
  }
  toggleLock() {
    const p = this.player; if (!p || p.dead) return;
    if (p.lockOn) { p.lockOn = false; this.lockPick = null; this.ui.float && this.ui.float(chest(p, 3.1), 'LOCK OFF', '#ffffff'); this.sfx('click'); return; }
    const cf = V(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)); let best = null, bs = 1e9;
    for (const e of this.enemiesOf(p)) { if (e.dead) continue; const v = e.pos.clone().sub(p.pos); v.y = 0; const d = v.length(); if (d > 45) continue; const s = d - 14 * v.normalize().dot(cf); if (s < bs) { bs = s; best = e; } }
    if (best) { p.lockOn = true; this.lockPick = best; this.ui.float && this.ui.float(chest(p, 3.1), 'LOCKED ON', '#ff6a7a'); this.sfx('tick'); } else { this.ui.float && this.ui.float(chest(p, 3.1), 'NO TARGET', '#aaaaaa'); }
  }
  switchLock(dir) {
    const p = this.player; const es = this.enemiesOf(p).filter(e => !e.dead && e.pos.distanceTo(p.pos) < 48); if (es.length < 2) return;
    const ang = (e) => angDiff(this.camYaw, Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z)); es.sort((a, b) => ang(b) - ang(a));
    let i = es.indexOf(this.lockPick); if (i < 0) i = 0; this.lockPick = es[(i + dir + es.length) % es.length]; this.sfx('tick');
  }
  updateLockMarker(pf) {
    if (!this.lockMarker) {
      const mk = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: '#ff3a4a', transparent: true, opacity: 0.95, depthTest: false, toneMapped: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 40), mat); mk.add(ring);
      for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.34), mat); const a = i * Math.PI / 2 + Math.PI / 4; t.position.set(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0); t.rotation.z = a + Math.PI / 2; mk.add(t); }
      mk.traverse(o => { o.renderOrder = 999; }); mk.visible = false; this.scene.add(mk); this.lockMarker = mk;
    }
    const mk = this.lockMarker, t = pf.target; const on = pf.lockOn && t && !t.dead && !this.cine && !this.dom; mk.visible = !!on; if (!on) return;
    mk.position.copy(t.pos).add(V(0, 1.3, 0)); const s = 1.2 + Math.sin(this.time * 6) * 0.06; mk.scale.setScalar(s); mk.quaternion.copy(this.cam.quaternion);
  }
  updateCine(rdt, input) {
    const c = this.cine; c.t += rdt;
    if (c.type === 'domain' || c.type === 'awaken') { for (const o of this.fighters) if (o.ch && o !== c.f && o.ch.group.visible) o.ch.group.visible = false; this._cineHid = true; }
    if (c.type === 'clash') {
      const pl = this.player; for (const x of [c.a, c.b]) { x.f.ch.s.cast = 2; x.f.ch.update(rdt); if (x.f.isPlayer) { } }
      const side = (c.a.f === pl) ? 'a' : (c.b.f === pl) ? 'b' : null; if (side && input) { let n = 0; for (const kk of MASH_KEYS) if (input.edge[kk]) n++; if (input.mouse[0] && !this._mcP) n++; this._mcP = !!input.mouse[0]; if (n) { c[side === 'a' ? 'pa' : 'pb'] += n; this.sfx('click'); if (this.net) this._acc.m = (this._acc.m || 0) + n; } }
      for (const [x, k] of [[c.a, 'pa'], [c.b, 'pb']]) if (!x.f.isPlayer) { if (this.net) { if (this.net.host) c[k] = Math.max(c[k], x.f.netM || 0); } else c[k] += rdt * (3.2 + x.f.skill * 3.4) * rand(0.5, 1.3); }
      if (Math.random() < 0.5) { const m = c.a.f.pos.clone().lerp(c.b.f.pos, 0.5); this.fx.burst(m.setY(rand(0, 4)), pick([c.a.spec.color, c.b.spec.color]), 5, 12, 0.6, 0.5); } if (Math.random() < 0.25) this.fx.bolt(c.a.f.pos.clone().setY(2), c.b.f.pos.clone().setY(2), pick([c.a.spec.color, c.b.spec.color]), 0.15, 0.12); this.shake(0.25);
      this.ui.cine('clash', { show: true, a: c.a.f.name, b: c.b.f.name, key: c.key.replace('Key', ''), pa: c.pa, pb: c.pb, t: c.t / c.dur, me: side });
      if (this.netClient && c.t >= c.dur && !c.forceWin && c.t < c.dur + 5) { c.t = c.dur; return; }
      if (c.t >= c.dur) { const win = c.forceWin ? (c.a.f.pid === c.forceWin ? c.a : c.b) : c.pa === c.pb ? (Math.random() < 0.5 ? c.a : c.b) : (c.pa > c.pb ? c.a : c.b), lose = win === c.a ? c.b : c.a; this.ui.cine('clash', { show: false }); lose.f.stun = 1.4; lose.f.ch.s.cast = 0; lose.f.ult = 0; this.endState(lose.f); this.callout(lose.f, 'DOMAIN OVERPOWERED', '#ff6b6b', 1.5, true); this.fx.shock(lose.f.pos.clone(), '#ffffff', 10, 0.5); this.cine = null; if (this.net && this.net.host) this.net.send({ k: 'clashEnd', win: win.f.pid }); this.beginCine(win.f, win.spec); }
      return;
    }
    if (c.type === 'awaken') {
      const { f, def } = c, col = def.color, P = f.pos, ch2 = chest(f, 1.2); f.ch.s.cast = 2; f.ch.update(rdt);
      if (c.t < 0.9) { if (Math.random() < 0.9) this.fx.converge(ch2, col, 4, 2 + c.t * 3, 0.35); if (Math.random() < 0.5) this.fx.emit(P.clone().add(V(rand(-0.8, 0.8), 0.1, rand(-0.8, 0.8))), V(0, rand(2, 6), 0), col, 0.4, 0.8, { drag: 0.6, bright: 1.8 }); if (!c.cr && c.t > 0.3) { c.cr = true; this.fx.crack(P, 4.5, col, 4); this.fx.ring(P.clone().setY(0.2), col, 4, 0.5, 0.5); } this.shake(0.12 + c.t * 0.4); }
      if (c.t >= 0.9 && !c.burst) { c.burst = true; this.awakenFx(f, def); this.slowmo(0.35, 0.5); this.ui.cine('title', { name: def.name.replace(' Awakening', '').toUpperCase(), sub: def.name, color: col, kind: 'AWAKENING' }); this.fx.pillar(P.clone(), '#ffffff', 40, 0.8, 0.8); }
      if (c.t > 0.9 && c.t < 1.9) { if (Math.random() < 0.7) { const a2 = rand(0, 6.28), r = rand(3, 12), p0 = P.clone().add(V(Math.cos(a2) * r, 0, Math.sin(a2) * r)); this.fx.fork(p0.clone().setY(rand(10, 20)), p0, col, 0.18); this.fx.burst(p0.clone().setY(0.4), col, 5, 10, 0.5, 0.5, { lift: 7 }); } this.fx.emit(P.clone().add(V(rand(-1, 1), 0.1, rand(-1, 1))), V(0, rand(8, 18), 0), col, 0.7, 0.9, { drag: 0.2, bright: 1.7 }); this.shake(0.5); }
      if (c.t >= c.dur) { this.ui.cine('title', null); this.ui.cine('bars', false); this.ui.cine('flash', null); this.cine = null; f.ch.s.cast = 0; }
      return;
    }
    const { f, spec } = c; const u = c.t / c.dur; f.ch.s.cast = 2; f.ch.update(rdt); const head = f.pos.clone().add(V(0, 2.2, 0)); const col = spec.color;
    if (spec.intro) spec.intro(this, f, u);
    // A (0-1.3): hand-sign close-up — cursed energy gathers in the fingers
    if (c.t < 1.3) { const hl = V(); f.ch.getHand(1, hl); const hr = V(); f.ch.getHand(-1, hr); const mid = hl.lerp(hr, 0.5); if (Math.random() < 0.5) this.fx.converge(mid, col, 2, 1.2, 0.3); if (Math.random() < 0.5) this.fx.emit(mid.clone().add(V(rand(-0.15, 0.15), 0, rand(-0.15, 0.15))), V(rand(-0.4, 0.4), rand(0.6, 2), rand(-0.4, 0.4)), col, 0.12, 0.6, { drag: 0.6, bright: 2.2 }); if (!c.sg) { c.sg = true; this.fx.ring(mid, col, 0.1, 0.9, 0.6, false); this.sfx('whoosh'); } this.shake(0.05 + c.t * 0.1); if (!c.sg2 && c.t > 0.7) { c.sg2 = true; this.fx.ring(mid, '#ffffff', 0.1, 1.3, 0.4, false); this.fx.crack(f.pos, 6, col, 4); this.sfx('click'); } }
    // B (1.3): the declaration — kanji slam, hard flash cut
    if (!c.kj && c.t > 1.3) { c.kj = true; this.ui.cine('hands', null); this.ui.cine('kanji', { color: col, text: spec.open ? '開放領域' : '領域展開' }); this.ui.cine('flash', '#fff'); this.shake(1.0); this.aberr(1.2); this.sfx('boom'); this.fx.flash(head, col, 9, 0.35); this.fx.shock(f.pos.clone(), col, 10, 0.6); this.fx.pillar(f.pos.clone(), col, 26, 1.4, 0.9); }
    if (c.t > 1.3 && c.t < 2.5 && Math.random() < 0.5) this.fx.emit(f.pos.clone().add(V(rand(-1.4, 1.4), 0.1, rand(-1.4, 1.4))), V(0, rand(6, 14), 0), col, 0.5, 0.8, { drag: 0.2, bright: 1.6 });
    // title card with the technique name
    if (!c.titled && c.t > 2.3) { c.titled = true; this.ui.cine('title', { name: spec.name, sub: spec.sub, color: col, kind: spec.open ? 'OPEN DOMAIN' : 'DOMAIN EXPANSION' }); this.shake(0.6); this.fx.shock(f.pos.clone(), '#ffffff', 7, 0.5); }
    // C (2.5-3.1): the barrier ball closes around the whole arena
    if (c.t > 2.5 && !c.shell) { c.shell = true; const Rb = 24, gg = new THREE.Group(); gg.position.copy(f.pos).setY(2); this.scene.add(gg);
      const dark = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: '#030106', transparent: true, opacity: 0.4, side: THREE.DoubleSide, toneMapped: false })); gg.add(dark);
      const wire = new THREE.Mesh(new THREE.SphereGeometry(1.002, 28, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.2), wireframe: true, transparent: true, opacity: 0.55, toneMapped: false })); gg.add(wire);
      const rims = []; for (let k = 0; k < 3; k++) { const rm = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.01, 6, 90), new THREE.MeshBasicMaterial({ color: new THREE.Color(k ? '#ffffff' : col).multiplyScalar(2.5), toneMapped: false })); rm.rotation.set(k * 1.05, k * 0.6, 0); gg.add(rm); rims.push(rm); }
      c.ball = gg; c.ballT = 0; c.ballUpd = (dt2) => { c.ballT += dt2; const e = Math.min(1, c.ballT / 0.9); const ee = 1 - Math.pow(1 - e, 3); gg.scale.setScalar(Math.max(0.1, Rb * ee)); wire.rotation.y += dt2 * 0.8; rims.forEach((r2, i) => { r2.rotation.z += dt2 * (1.2 + i); r2.rotation.x += dt2 * 0.5; }); dark.material.opacity = c.swapped ? Math.max(0, 0.4 - (c.t - 3.1) * 1.2) : 0.4; wire.material.opacity = c.swapped ? Math.max(0, 0.55 - (c.t - 3.1) * 1.4) : 0.55; if (c.swapped && c.t > 3.9) { this.scene.remove(gg); c.ball = null; } };
      this.sfx('domainfx'); this.fx.crack(f.pos, 18, col, 5); this.fx.shock(f.pos.clone(), col, 24, 0.9); this.shake(0.7); }
    if (c.ball && c.ballUpd) { c.ballUpd(rdt); if (c.t < 3.1 && Math.random() < 0.8) { const a2 = rand(0, 6.28), p0 = f.pos.clone().add(V(Math.cos(a2) * 24, 0, Math.sin(a2) * 24)); this.fx.bolt(p0.clone().setY(rand(6, 22)), p0, col, 0.14, 0.14); } }
    // D (3.1): the world is replaced — interior reveal
    if (!c.swapped && c.t > 3.1) { c.swapped = true; const R = this.world.bounds; const ctr = { pos: V(0, 0, 0), yaw: f.yaw }; c.E = spec.env(this, ctr, R); try { detailPass(this, ctr, c.E, spec, R); } catch (er) { console.warn(er); } this.swapEnv(c.E); this.ui.cine('flash', '#fff'); this.ui.cine('kanji', null); this.fx.shock(f.pos.clone(), '#ffffff', 40, 1.1, 0.12); this.fx.shock(f.pos.clone(), col, 30, 0.9, 0.2); this.fx.orb(f.pos.clone().setY(1), col, 1, 30, 0.6); this.shake(1.4); this.aberr(1.5); this.sfx('domainfx'); this.sfx('boom'); c.E.group.scale.set(1, 0.001, 1); c.E.group.userData.rise = 0; }
    if (c.swapped) { const r = Math.min(1, (c.t - 3.1) / 1.0); c.E.group.scale.y = Math.max(0.001, 1 - Math.pow(1 - r, 3)); if (c.E.upd) c.E.upd(this.time += rdt * 0.5, rdt, this); this.fx.emit(f.pos.clone().add(V(rand(-30, 30), rand(0, 8), rand(-30, 30))), V(0, rand(2, 8), 0), col, 0.8, 1, { drag: 0.5 }); }
    if (c.t >= c.dur) { this.ui.cine('title', null); this.ui.cine('bars', false); this.ui.cine('flash', null); this.ui.cine('kanji', null); this.ui.cine('hands', null); if (c.ball) { this.scene.remove(c.ball); c.ball = null; } const E = c.E; this.cine = null; f.ch.s.cast = 0; this.dom = { f, spec, E, age: 0, dur: DDUR[spec.r] || spec.dur }; E.group.scale.set(1, 1, 1); for (const e of this.enemiesOf(f)) { if (!e.isCurse && !(e.simple > 0)) { e.stun = Math.max(e.stun, 0.9); this.fx.ring(e.pos.clone().setY(0.2), col, 0.5, 2.6, 0.4); } } this.callout(f, 'SURE-HIT', col, 1.2); this.time += 0.0; if (spec.start) spec.start(this, f, E); }
  }
  impactFrame(pos, crit, t, src) {
    if (this.ui.cine) this.ui.cine('impact', { crit }); this.shake(crit ? 0.9 : 0.45); this.aberr(crit ? 1.2 : 0.6);
    if (crit) { for (let i = 0; i < 4; i++) this.fx.bolt(pos.clone().add(V(rand(-2.5, 2.5), rand(-1, 2), rand(-2.5, 2.5))), pos.clone().add(V(rand(-0.5, 0.5), rand(-0.3, 0.8), rand(-0.5, 0.5))), i % 2 ? '#ff1a3a' : '#1a0008', 0.12, 0.18); this.fx.shock(t.pos.clone(), '#ff1a3a', 6, 0.5); this.fx.flash(pos, '#ff2a4a', 6, 0.2); }
  }
  swapEnv(E) {
    const sc = this.scene, W = this.world, L = W.lights; this._env = { bg: sc.background, fog: sc.fog, root: W.root.visible, sky: sc.userData.sky ? sc.userData.sky.visible : true, circles: W.circles, sunC: L.sun.color.clone(), sunI: L.sun.intensity, hemiC: L.hemi.color.clone(), hemiG: L.hemi.groundColor.clone(), hemiI: L.hemi.intensity, envI: sc.environmentIntensity };
    W.root.visible = false; if (sc.userData.sky) sc.userData.sky.visible = false; W.circles = []; const sk = E.sky; E.skyMesh = makeSky(sk[0], sk[1], sk[2], sk[3], sk[4]); sc.add(E.skyMesh);
    sc.background = new THREE.Color(E.fog[0]); sc.fog = new THREE.FogExp2(E.fog[0], E.fog[1]); L.sun.color.set(E.sun[0]); L.sun.intensity = E.sun[1]; L.hemi.color.set(E.hemi[0]); L.hemi.groundColor.set(E.hemi[1]); L.hemi.intensity = E.hemi[2]; sc.environmentIntensity = 0.15; sc.add(E.group);
  }
  restoreEnv(E) {
    const sc = this.scene, W = this.world, L = W.lights, S = this._env; if (!S) return; sc.remove(E.group); sc.remove(E.skyMesh); E.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); if (E.skyMesh.geometry) E.skyMesh.geometry.dispose();
    W.root.visible = S.root; if (sc.userData.sky) sc.userData.sky.visible = S.sky; W.circles = S.circles; sc.background = S.bg; sc.fog = S.fog; L.sun.color.copy(S.sunC); L.sun.intensity = S.sunI; L.hemi.color.copy(S.hemiC); L.hemi.groundColor.copy(S.hemiG); L.hemi.intensity = S.hemiI; sc.environmentIntensity = S.envI; this._env = null;
  }
  tickDomain(dt) {
    const d = this.dom; d.age += dt; const f = d.f; for (const e of this.enemiesOf(f)) if (!e.isCurse && !(e.simple > 0)) e.vuln = Math.max(e.vuln, 0.3); const pw = DPOW[d.spec.r] || 1.8; f.hp = Math.min(f.maxHp, f.hp + 3 * pw * dt); f.ce = Math.min(f.maxCe, f.ce + 35 * dt); f.invuln = Math.max(f.invuln, 0.05); if (d.spec.tick) d.spec.tick(this, f, dt, d.E, d.age); if (d.E.upd) d.E.upd(this.time, dt, this); if (d.age > d.dur || f.dead || d.E.stopNow) this.endDomain();
  }
  endDomain() {
    const d = this.dom; if (!d) return; this.dom = null; if (d.spec.end) d.spec.end(this, d.f, d.E); d.f.burnT = 7; d.f.ce = Math.min(d.f.ce, 12); if (d.f.isPlayer) this.callout(d.f, 'BURNOUT', '#ff8a8a', 1.4); this.restoreEnv(d.E); music('battle'); this.fx.shock(d.f.pos.clone(), '#ffffff', 20, 0.6); this.ui.cine('trial', { show: false }); this.ui.cine('reels', null); this.shake(0.5); this.sfx('whoosh');
  }
  /* ---- scenery destruction (cosmetic + opens space; never creates cover) ---- */
  breakScenery(pos, r, power = 2) {
    const W = this.world; if (!W.breakables || this.dom) return; for (let i = W.breakables.length - 1; i >= 0; i--) { const b = W.breakables[i]; if (Math.hypot(b.x - pos.x, b.z - pos.z) < r + b.r) { b.hp -= power; if (b.hp > 0) { this.fx.debris(V(b.x, 1, b.z), b.color || '#7a6a58', 3, 6); continue; } W.breakables.splice(i, 1); const ci = W.circles.indexOf(b.circle); if (ci >= 0) W.circles.splice(ci, 1); const dir = V(b.x - pos.x, 0, b.z - pos.z).normalize(); this.fx.debris(V(b.x, 1.5, b.z), b.color || '#7a6a58', 12, 10); this.fx.shock(V(b.x, 0, b.z), '#b9a98f', 4, 0.4); this.shake(0.25); this.sfx('thud'); let t = 0; const o = b.obj; const q = o.quaternion.clone(); const ax = V(-dir.z, 0, dir.x); this.every(0.016, 0.9, (dt) => { t += dt; o.quaternion.copy(q).premultiply(new THREE.Quaternion().setFromAxisAngle(ax, Math.min(1.5, t * t * 5) * 1)); o.position.y -= Math.max(0, t - 0.5) * 6 * dt; if (t > 0.8) o.visible = false; }); } }
  }
  updateCamera(dt, input) {
    const pf = this.player, cam = this.cam;
    if (!this.cine) {
      if (input && !pf.lockOn) { this.camYaw -= input.dx * 0.0026; this.camPitch = clamp(this.camPitch + input.dy * 0.0022, -0.15, 1.1); }
      else if (pf.lockOn && pf.target && !pf.dead) { const v = pf.target.pos.clone().sub(pf.pos); const a = Math.atan2(v.x, v.z); this.camYaw += angDiff(this.camYaw, a) * (1 - Math.exp(-5 * dt)); this.camPitch = damp(this.camPitch, 0.36, 3, dt); if (input) this.camYaw -= input.dx * 0.0008; }
      else if (input) { this.camYaw -= input.dx * 0.0026; }
      if (input && input.keys['ArrowLeft']) this.camYaw += dt * 2; if (input && input.keys['ArrowRight']) this.camYaw -= dt * 2;
    }
    let tgt = pf.pos.clone().add(V(0, 2.0, 0)), dist = this.camDist, yaw = this.camYaw, pitch = this.camPitch;
    if (pf.lockOn && pf.target && !pf.target.dead && this.state !== 'end') { const k = clamp(0.38 - pf.target.pos.distanceTo(pf.pos) * 0.008, 0.18, 0.38); tgt.lerp(pf.target.pos.clone().add(V(0, 2.0, 0)), k); dist += clamp(pf.target.pos.distanceTo(pf.pos) * 0.25, 0, 3); }
    if (pf.dead && this.state !== 'end') { const k2 = this.fighters.find(f => !f.dead && !f.isCurse && f !== pf); if (k2) { tgt.lerp(k2.pos.clone().add(V(0, 2, 0)), 0.5); dist += 3; } }
    if (this.state === 'end') { const w = this.fighters.find(f => !f.dead && !f.isCurse) || pf; tgt = w.pos.clone().add(V(0, 1.6, 0)); yaw = this.time * 0.5; dist = 7; pitch = 0.15; }
    if (this.state === 'count') { const k = clamp(this.count / 3.4, 0, 1); dist = lerp(8.2, 13, k * k); yaw += k * 1.2; }
    const cp = Math.cos(pitch), want = tgt.clone().add(V(-Math.sin(yaw) * cp * dist, Math.sin(pitch) * dist + 0.5, -Math.cos(yaw) * cp * dist)).add(V(-Math.cos(yaw) * (this.shiftLock && !pf.lockOn ? 2.3 : 1.7), 0, Math.sin(yaw) * (this.shiftLock && !pf.lockOn ? 2.3 : 1.7)));
    this.camPos.lerp(want, 1 - Math.exp(-14 * dt)); const sh = this.shakeV; let pos = this.camPos.clone().add(V(rand(-sh, sh) * 0.5, rand(-sh, sh) * 0.5, rand(-sh, sh) * 0.5)); if (pos.y < 0.6) pos.y = 0.6;
    let look = tgt.clone().add(V(Math.sin(yaw) * 5, -0.4, Math.cos(yaw) * 5));
    let fovT = 66 + (pf.act && pf.act.type === 'dash' ? 10 : 0) + (pf.thunder > 0 ? 5 : 0) + (this.state === 'end' ? -6 : 0) + (this.fovKick || 0) + (I_SPR(pf) ? 3 : 0), fovRate = 8;
    if (this.cine) { const c = this.cine; let cp2, cl, fv, w = 1;
      if (c.type === 'clash') { const m = c.a.f.pos.clone().lerp(c.b.f.pos, 0.5); const ang = c.t * 0.9 + 1; cp2 = m.clone().add(V(Math.cos(ang) * 15, 5 + Math.sin(c.t * 2) * 1.5, Math.sin(ang) * 15)); cl = m.clone().setY(2.2); fv = 52; }
      else if (c.type === 'awaken') { const f = c.f, P = f.pos, F = V(Math.sin(f.yaw), 0, Math.cos(f.yaw)), Rr = V(F.z, 0, -F.x), t = c.t; const ease = (x) => x * x * (3 - 2 * x);
        if (t < 0.9) { const u = t / 0.9; cp2 = P.clone().addScaledVector(F, 3.0 - 0.9 * u).addScaledVector(Rr, 0.4).add(V(0, 1.95, 0)); cl = P.clone().add(V(0, 1.8, 0)); fv = 36 - u * 6; }
        else if (t < 1.9) { const u = ease((t - 0.9) / 1.0), dir = F.clone().applyAxisAngle(V(0, 1, 0), u * 2.2); cp2 = P.clone().addScaledVector(dir, 4.6).add(V(0, 0.4 + u * 1.3, 0)); cl = P.clone().add(V(0, 2.3, 0)); fv = 62 - u * 8; cp2.add(V(rand(-0.15, 0.15), rand(-0.15, 0.15), rand(-0.15, 0.15))); }
        else { const u = (t - 1.9) / (c.dur - 1.9); w = 1 - ease(clamp(u, 0, 1)); const dir = F.clone().applyAxisAngle(V(0, 1, 0), 2.2); cp2 = P.clone().addScaledVector(dir, 4.6).add(V(0, 1.7, 0)); cl = P.clone().add(V(0, 2.3, 0)); fv = 54; } }
      else { const f = c.f, P = f.pos, F = V(Math.sin(f.yaw), 0, Math.cos(f.yaw)), Rr = V(F.z, 0, -F.x), t = c.t; const ease = (x) => x * x * (3 - 2 * x); const rot = (a) => F.clone().applyAxisAngle(V(0, 1, 0), a);
        if (t < 0.75) { const hl = V(); f.ch.getHand(1, hl); const hr = V(); f.ch.getHand(-1, hr); const mid = hl.lerp(hr, 0.5); const u = t / 0.75; cp2 = mid.clone().addScaledVector(F, 1.7 - u * 0.4).addScaledVector(Rr, 0.8 - u * 0.3).add(V(0, 0.15, 0)); cl = mid; fv = 32; }
        else if (t < 1.3) { const u = ease((t - 0.75) / 0.55); cp2 = P.clone().addScaledVector(F, 1.5 - u * 0.4).addScaledVector(Rr, 0.15).add(V(0, 1.6 + u * 0.4, 0)); cl = P.clone().add(V(0, 1.75 + u * 0.1, 0)); fv = 26 + u * 4; }
        else if (t < 2.5) { const u = ease((t - 1.3) / 1.2); cp2 = P.clone().addScaledVector(rot(0.3 + u * 1.7), 4.4 - u * 0.6).add(V(0, 0.25 + u * 0.5, 0)); cl = P.clone().add(V(0, 2.4 + u * 0.3, 0)); fv = 62 - u * 10; cp2.add(V(rand(-0.08, 0.08), rand(-0.08, 0.08), rand(-0.08, 0.08))); }
        else if (t < 3.1) { const u = ease((t - 2.5) / 0.6); const from = P.clone().addScaledVector(rot(2.0), 3.8).add(V(0, 0.75, 0)), to = P.clone().addScaledVector(rot(2.6), 80).add(V(0, 30, 0)); cp2 = from.lerp(to, u); cl = P.clone().add(V(0, 4 + u * 2, 0)); fv = 55 + u * 6; }
        else if (t < 4.7) { const u = ease((t - 3.1) / 1.6); const from = P.clone().addScaledVector(rot(2.6), 12).add(V(0, 1.4, 0)), to = P.clone().addScaledVector(rot(3.4), 26).add(V(0, 13, 0)); cp2 = from.lerp(to, u); cl = P.clone().add(V(0, 4 + u * 4, 0)); fv = 66 + u * 8; }
        else { const u = (t - 4.7) / (c.dur - 4.7); w = 1 - ease(clamp(u, 0, 1)); cp2 = P.clone().addScaledVector(rot(3.4), 26).add(V(0, 13, 0)); cl = P.clone().add(V(0, 8, 0)); fv = 74; }
        if (t > 1.3 && t < 3.1) { const sk2 = this.shakeV * 0.5; cp2.add(V(rand(-sk2, sk2), rand(-sk2, sk2), rand(-sk2, sk2))); } }
      pos.lerp(cp2, w); look.lerp(cl, w); fovT = lerp(fovT, fv, w); fovRate = 30; }
    cam.position.copy(pos); cam.lookAt(look);
    this.fovAdd = damp(this.fovAdd, fovT, fovRate, dt); cam.fov = this.fovAdd; cam.aspect = this.eng.size.w / this.eng.size.h; cam.updateProjectionMatrix();
  }
  render() { this.eng.render(this.scene, this.cam); }
  dispose() { this.fighters.forEach(f => f.ch.dispose()); this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
}
