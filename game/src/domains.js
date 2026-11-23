import * as THREE from 'three';
import { rand, pick, clamp, lerp } from './fx.js';
import { makeSky } from './engine.js';

/* ============================================================
   DOMAINS (9) + ULTIMATES (4) — original techniques following the design doc's
   rules: shared yellow gauge, wind-up + warning, cinematic, clash, per-domain rules.
   ============================================================ */
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const fwdOf = (f) => V(Math.sin(f.yaw), 0, Math.cos(f.yaw));
const chestOf = (f, h = 1.3) => V(f.pos.x, f.pos.y + h, f.pos.z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const EM = (c, i = 2, o = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), toneMapped: false, transparent: o < 1, opacity: o, side: THREE.DoubleSide });
const ST = (c, r = 0.8, m = 0, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...e });
function box(g, w, h, d, mat, x, y, z, cast = true) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; }
function cyl(g, r1, r2, h, mat, x, y, z, seg = 12) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; }
function ctex(w, h, draw, rep = 1) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

function floorMesh(R, mat) {
  const g = new THREE.Group(); const f = new THREE.Mesh(new THREE.CylinderGeometry(R + 2, R + 2.5, 1, 72), mat); f.position.y = -0.5; f.receiveShadow = true; g.add(f);
  const o = new THREE.Mesh(new THREE.CircleGeometry(300, 40), new THREE.MeshStandardMaterial({ color: mat.color.clone().multiplyScalar(0.35), roughness: 1 })); o.rotation.x = -Math.PI / 2; o.position.y = -0.7; o.receiveShadow = true; g.add(o); return g;
}
function ringEdge(R, color) { const r = new THREE.Mesh(new THREE.RingGeometry(R + 0.4, R + 1.6, 96), EM(color, 1.8)); r.rotation.x = -Math.PI / 2; r.position.y = 0.05; return r; }

/* ---------- environment builders: return { group, sky, fog:[color,density], sun:[color,int], hemi:[sky,ground,int], upd(t,dt) } ---------- */
const ENV = {
  shrine(G, f, R) {
    const g = new THREE.Group(); const F = fwdOf(f);
    const t = ctex(512, 512, (x, w, h) => { x.fillStyle = '#17090d'; x.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(${150 + rand(0, 90)},10,20,${rand(0.2, 0.7)})`; x.lineWidth = rand(1, 4); x.beginPath(); let px = rand(0, w), py = rand(0, h); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += rand(-60, 60); py += rand(-60, 60); x.lineTo(px, py); } x.stroke(); } }, 8);
    const fm = ST('#fff', 0.6, 0.2); fm.map = t; fm.bumpMap = t; fm.bumpScale = 1.5; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#ff1f3a'));
    // colossal shrine
    const sh = new THREE.Group(); sh.position.copy(f.pos).addScaledVector(F, 42).setY(0); sh.rotation.y = Math.atan2(-F.x, -F.z); sh.scale.setScalar(2.4); g.add(sh);
    const dk = ST('#0b0709', 0.5, 0.3), rd = ST('#7a0f1c', 0.5, 0.2, { emissive: new THREE.Color('#380008'), emissiveIntensity: 0.6 }), bone = ST('#d7c9b0', 0.6);
    box(sh, 22, 1.2, 16, dk, 0, 0.6, 0); box(sh, 18, 1.2, 12, dk, 0, 1.8, 0); box(sh, 14, 0.8, 9, dk, 0, 2.8, 0);
    for (const x of [-5.5, -1.8, 1.8, 5.5]) for (const z of [-3, 3]) cyl(sh, 0.55, 0.65, 8, rd, x, 7, z);
    box(sh, 15, 1, 10.5, dk, 0, 11.4, 0); const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), dk); roof.position.y = 14.4; roof.rotation.y = Math.PI / 4; roof.scale.set(11.5, 6, 8); sh.add(roof);
    box(sh, 17, 0.5, 11.5, rd, 0, 11, 0); const roof2 = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), dk); roof2.position.y = 19.5; roof2.rotation.y = Math.PI / 4; roof2.scale.set(7.5, 4.6, 5.3); sh.add(roof2); box(sh, 11, 0.4, 7.4, rd, 0, 17, 0);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3 + rand(0, 3), 5), bone); sp.position.set(Math.cos(a) * 12.5, 2.5, Math.sin(a) * 9); sp.rotation.z = Math.cos(a) * 0.3; sh.add(sp); }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), EM('#ff1030', 2.2)); eye.position.set(0, 13.2, 5.6); sh.add(eye);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, r = R + rand(3, 9); const pl = cyl(g, 0.9, 1.1, rand(7, 15), dk, Math.cos(a) * r, 5, Math.sin(a) * r, 6); pl.rotation.z = rand(-0.1, 0.1); }
    const c0 = f.pos.clone();
    return { group: g, sky: ['#08010a', '#5a0610', V(0.2, 0.18, -0.9), '#ff2a3a', false], fog: ['#1c0408', 0.011], sun: ['#ff5a4a', 1.4], hemi: ['#a02a3a', '#10040a', 0.55], eye,
      upd(t, dt, G2) { eye.scale.setScalar(1 + Math.sin(t * 3) * 0.12); if (Math.random() < dt * 40) G2.fx.emit(V(c0.x + rand(-30, 30), rand(0, 2), c0.z + rand(-30, 30)), V(rand(-1, 1), rand(2, 5), rand(-1, 1)), Math.random() < 0.5 ? '#ff2a3a' : '#2a0010', 0.5, 2.5, { drag: 0.3, grav: -1 }); } };
  },
  cosmos(G, f, R) {
    const g = new THREE.Group(); const t = ctex(256, 256, (x, w, h) => { x.fillStyle = '#05030f'; x.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(${150 + rand(0, 105)},${150 + rand(0, 105)},255,${rand(0.3, 1)})`; x.fillRect(rand(0, w), rand(0, h), rand(1, 2.5), rand(1, 2.5)); } }, 10);
    const fm = ST('#ffffff', 0.15, 0.8, { emissive: new THREE.Color('#1a1050'), emissiveIntensity: 0.6 }); fm.map = t; fm.emissiveMap = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#9a7aff'));
    const planets = []; const pc = ['#ff8a5a', '#5ab0ff', '#c07aff', '#ffd27a', '#6affc0'];
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + rand(-0.2, 0.2), r = rand(40, 95); const p = new THREE.Mesh(new THREE.SphereGeometry(rand(3, 10), 24, 18), ST(pick(pc), 0.6, 0.1, { emissive: new THREE.Color(pick(pc)), emissiveIntensity: 0.25 })); p.position.set(f.pos.x + Math.cos(a) * r, rand(6, 40), f.pos.z + Math.sin(a) * r); g.add(p); planets.push(p); if (i % 3 === 0) { const rg = new THREE.Mesh(new THREE.RingGeometry(p.geometry.parameters.radius * 1.4, p.geometry.parameters.radius * 2, 48), EM('#c8b0ff', 0.8, 0.7)); rg.rotation.x = 1.2; p.add(rg); } }
    const gal = new THREE.Mesh(new THREE.TorusGeometry(70, 9, 6, 80), EM('#7a4aff', 0.5, 0.35)); gal.rotation.x = Math.PI / 2 - 0.3; gal.position.set(f.pos.x, 55, f.pos.z); g.add(gal);
    for (let i = 0; i < 28; i++) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.5, 1.4)), EM(pick(pc), 1.2)); o.position.set(f.pos.x + rand(-R, R), rand(2, 16), f.pos.z + rand(-R, R)); o.userData.sp = rand(0.5, 2); g.add(o); planets.push(o); }
    return { group: g, sky: ['#000003', '#1a0a46', V(0, 1, 0), '#9a8aff', true], fog: ['#080418', 0.004], sun: ['#9a8aff', 1.1], hemi: ['#6a5ac0', '#0a0620', 0.9], upd(t, dt, G2) { planets.forEach((p, i) => { p.rotation.y += dt * 0.2 * (1 + i % 3); if (p.userData.sp) p.rotation.x += dt * p.userData.sp; }); gal.rotation.z += dt * 0.05; if (Math.random() < dt * 25) G2.fx.emit(V(f.pos.x + rand(-30, 30), rand(0, 20), f.pos.z + rand(-30, 30)), V(0, 0, 0), pick(['#ffffff', '#b0a0ff', '#80d0ff']), 0.4, 3, { drag: 0, end: 0.1 }); } };
  },
  garden(G, f, R) {
    const g = new THREE.Group(); const t = ctex(256, 256, (x, w, h) => { x.fillStyle = '#07050d'; x.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(90,40,160,${rand(0.05, 0.25)})`; x.beginPath(); x.ellipse(rand(0, w), rand(0, h), rand(6, 30), rand(3, 14), rand(0, 3), 0, 7); x.fill(); } }, 8);
    const fm = ST('#fff', 0.35, 0.4); fm.map = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#7a3aff'));
    const dk = ST('#05040a', 0.7);
    for (let i = 0; i < 26; i++) { const a = rand(0, 6.283), r = rand(8, R + 12); const tx = f.pos.x * 0 + Math.cos(a) * r, tz = Math.sin(a) * r; const tr = new THREE.Group(); tr.position.set(tx, 0, tz); g.add(tr); cyl(tr, 0.35, 0.7, 9, dk, 0, 4.5, 0, 6); for (let k = 0; k < 4; k++) { const br = cyl(tr, 0.12, 0.25, 4, dk, Math.cos(k * 1.7) * 1.2, 7 + k * 0.4, Math.sin(k * 1.7) * 1.2, 5); br.rotation.set(Math.sin(k) * 0.9, 0, Math.cos(k) * 0.9); } for (let k = 0; k < 3; k++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), EM('#c04aff', 3)); e.position.set(rand(-0.6, 0.6), rand(3, 7), 0.5); tr.add(e); } }
    const pools = []; for (let i = 0; i < 12; i++) { const p = new THREE.Mesh(new THREE.CircleGeometry(rand(2, 5), 24), new THREE.MeshBasicMaterial({ color: '#000000' })); p.rotation.x = -Math.PI / 2; p.position.set(rand(-R * 0.8, R * 0.8), 0.04, rand(-R * 0.8, R * 0.8)); g.add(p); const rg = new THREE.Mesh(new THREE.RingGeometry(p.geometry.parameters.radius, p.geometry.parameters.radius + 0.25, 28), EM('#8a3aff', 1.4)); rg.rotation.x = -Math.PI / 2; rg.position.copy(p.position).setY(0.05); g.add(rg); pools.push(rg); }
    const moon = new THREE.Mesh(new THREE.CircleGeometry(14, 40), EM('#b090ff', 1.1)); moon.position.set(f.pos.x - 40, 45, f.pos.z - 70); moon.lookAt(f.pos.x, 10, f.pos.z); g.add(moon);
    return { group: g, sky: ['#02010a', '#1c0a3c', V(-0.4, 0.5, -0.7), '#a070ff', true], fog: ['#0a0614', 0.014], sun: ['#7a5aff', 0.9], hemi: ['#4a2a8a', '#06030c', 0.6], pools, upd(t, dt, G2) { pools.forEach((p, i) => p.material.color.set('#8a3aff').multiplyScalar(1 + Math.sin(t * 3 + i) * 0.5)); if (Math.random() < dt * 20) G2.fx.emit(V(rand(-R, R), 0.2, rand(-R, R)), V(0, rand(1, 3), 0), '#a060ff', 0.5, 1.8, { drag: 0.4 }); } };
  },
  gamble(G, f, R) {
    const g = new THREE.Group(); const t = ctex(256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#3a0a50' : '#1a0626'; x.fillRect(i * 32, j * 32, 32, 32); } x.strokeStyle = '#ff40c0'; x.lineWidth = 2; x.strokeRect(1, 1, 254, 254); }, 9);
    const fm = ST('#fff', 0.3, 0.5, { emissive: new THREE.Color('#240430'), emissiveIntensity: 0.5 }); fm.map = t; fm.emissiveMap = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#ff40c0'));
    const wall = new THREE.Group(); wall.position.copy(f.pos); g.add(wall); const lights = []; const cols = ['#ff40c0', '#40e0ff', '#ffe040', '#60ff80'];
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; const m = new THREE.Group(); m.position.set(Math.cos(a) * (R + 8), 0, Math.sin(a) * (R + 8)); m.rotation.y = -a + Math.PI / 2; wall.add(m); box(m, 7, 14, 1.4, ST('#2a0838', 0.4, 0.5), 0, 7, 0); box(m, 5, 8, 0.2, EM('#12031c', 1), 0, 8, 0.8, false); for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), EM(cols[(i + k) % 4], 2.5)); l.position.set(-2.4 + k * 1.2, 12.8, 0.9); m.add(l); lights.push(l); } for (let k = 0; k < 3; k++) { const rl = box(m, 1.4, 4.5, 0.15, EM(cols[(i + k) % 4], 1.6), -1.6 + k * 1.6, 8, 0.85, false); lights.push(rl); } }
    const pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), ST('#d8d8f0', 0.2, 0.9), 120); const m4 = new THREE.Matrix4(); for (let i = 0; i < 120; i++) { m4.setPosition(rand(-R, R), 2, rand(-R, R)); pins.setMatrixAt(i, m4); } g.add(pins);
    const balls = []; for (let i = 0; i < 34; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.5, 1.2), 14, 10), ST(pick(['#e8e8f8', '#ffd040', '#ff60c0']), 0.1, 1)); b.position.set(rand(-R, R), rand(10, 40), rand(-R, R)); b.userData.v = rand(8, 16); g.add(b); balls.push(b); }
    return { group: g, sky: ['#14041c', '#7a1a8a', V(0, 0.6, -1), '#ff80e0', false], fog: ['#200630', 0.008], sun: ['#ff80e0', 2.0], hemi: ['#ff60d0', '#2a0a40', 0.9], upd(t, dt, G2) { lights.forEach((l, i) => l.material.color.set(cols[(i + Math.floor(t * 4)) % 4]).multiplyScalar(2.5)); balls.forEach(b => { b.position.y -= b.userData.v * dt; if (b.position.y < 0.8) { b.position.y = rand(25, 45); b.position.x = rand(-R, R); b.position.z = rand(-R, R); } }); } };
  },
  court(G, f, R) {
    const g = new THREE.Group(); const t = ctex(256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#4a2c18' : '#573420'; x.fillRect(0, i * 32, w, 32); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, i * 32, w, 2); } }, 9);
    const fm = ST('#fff', 0.45, 0.1); fm.map = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#ffd070'));
    const wood = ST('#3a2212', 0.6), gold = ST('#e8b84a', 0.3, 0.9), wall = ST('#cfc4aa', 0.9);
    const F = fwdOf(f); const bench = new THREE.Group(); bench.position.copy(f.pos).addScaledVector(F, 28).setY(0); bench.rotation.y = Math.atan2(-F.x, -F.z); g.add(bench);
    box(bench, 16, 4.5, 5, wood, 0, 2.25, 0); box(bench, 18, 0.6, 6, gold, 0, 4.8, 0); box(bench, 6, 7, 1.2, wood, 0, 9, -1.8); box(bench, 7, 0.5, 1.5, gold, 0, 12.8, -1.8); const sc = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 28), gold); sc.position.set(0, 10, -1.1); bench.add(sc); const gv = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.5), ST('#222', 0.5)); gv.position.set(3, 5.4, 1); bench.add(gv);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; const r = R + 3; cyl(g, 1.3, 1.5, 22, wall, Math.cos(a) * r, 11, Math.sin(a) * r, 14); box(g, 3.4, 1, 3.4, gold, Math.cos(a) * r, 22.5, Math.sin(a) * r); }
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const bx = new THREE.Group(); bx.position.copy(f.pos).addScaledVector(F, -8 - i * 4.4).add(V(-F.z * s * 9, 0, F.x * s * 9)); bx.rotation.y = Math.atan2(F.x, F.z); g.add(bx); box(bx, 8, 1, 2.2, wood, 0, 0.9, 0); box(bx, 8, 2.2, 0.5, wood, 0, 2, -0.9); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(7, 1.2, 40, 24, 1, true), EM('#ffe0a0', 0.5, 0.2)); beam.position.copy(f.pos).setY(20); g.add(beam);
    const trial = { cone: beam };
    return { group: g, sky: ['#120a06', '#3a2410', V(0, 1, 0), '#ffd890', false], fog: ['#1a0f08', 0.01], sun: ['#ffd8a0', 1.5], hemi: ['#d8b070', '#2a1608', 0.7], trial, upd(t, dt) { beam.material.opacity = 0.18 + Math.sin(t * 2) * 0.04; } };
  },
  soulhall(G, f, R) {
    const g = new THREE.Group(); const fm = ST('#e6e0f4', 0.08, 0.7, { emissive: new THREE.Color('#403060'), emissiveIntensity: 0.35 }); g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#d8b8ff'));
    const mir = []; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 18), new THREE.MeshStandardMaterial({ color: '#f0eaff', metalness: 1, roughness: 0.02, emissive: new THREE.Color('#8a6ac0'), emissiveIntensity: 0.4, side: THREE.DoubleSide })); p.position.set(Math.cos(a) * (R + 5), 9, Math.sin(a) * (R + 5)); p.lookAt(0, 9, 0); g.add(p); const fr = new THREE.Mesh(new THREE.BoxGeometry(9.6, 18.6, 0.4), ST('#2a1a4a', 0.4, 0.6)); fr.position.copy(p.position); fr.quaternion.copy(p.quaternion); fr.translateZ(-0.3); g.add(fr); mir.push(p); }
    const orbs = []; for (let i = 0; i < 24; i++) { const o = new THREE.Mesh(new THREE.SphereGeometry(rand(0.3, 0.7), 12, 10), EM(pick(['#d0b0ff', '#a0e0ff', '#ffc0f0']), 2, 0.8)); o.position.set(rand(-R, R), rand(1, 12), rand(-R, R)); o.userData.ph = rand(0, 6); g.add(o); orbs.push(o); }
    return { group: g, sky: ['#2a2048', '#8a70c0', V(0, 1, 0), '#ffffff', false], fog: ['#4a3a78', 0.012], sun: ['#e8d8ff', 1.8], hemi: ['#c8b0ff', '#40306a', 1.0], upd(t, dt, G2) { orbs.forEach(o => { o.position.y += Math.sin(t * 1.5 + o.userData.ph) * dt * 2; }); if (Math.random() < dt * 20) G2.fx.emit(V(rand(-R, R), rand(0, 10), rand(-R, R)), V(0, 1, 0), '#e0d0ff', 0.5, 2, { drag: 0.3 }); } };
  },
  volcano(G, f, R) {
    const g = new THREE.Group(); const t = ctex(512, 512, (x, w, h) => { x.fillStyle = '#120a08'; x.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(255,${80 + rand(0, 100)},20,${rand(0.4, 1)})`; x.lineWidth = rand(1.5, 5); x.beginPath(); let px = rand(0, w), py = rand(0, h); x.moveTo(px, py); for (let k = 0; k < 7; k++) { px += rand(-50, 50); py += rand(-50, 50); x.lineTo(px, py); } x.stroke(); } }, 6);
    const fm = ST('#fff', 0.85, 0, { emissive: new THREE.Color('#ff4a10'), emissiveIntensity: 0.9 }); fm.map = t; fm.emissiveMap = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#ff6a1a'));
    const rk = ST('#1c1412', 0.95); for (let i = 0; i < 30; i++) { const a = rand(0, 6.283), r = rand(R * 0.3, R + 25); const s = rand(1.5, 5); const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rk); m.position.set(Math.cos(a) * r, s * 0.5, Math.sin(a) * r); m.rotation.set(rand(0, 3), rand(0, 3), 0); m.castShadow = true; g.add(m); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.3, r = R + rand(40, 90); const v = new THREE.Mesh(new THREE.ConeGeometry(rand(20, 36), rand(40, 70), 12, 1, true), rk); v.position.set(Math.cos(a) * r, 18, Math.sin(a) * r); g.add(v); const top = new THREE.Mesh(new THREE.CircleGeometry(8, 14), EM('#ff5a10', 2)); top.rotation.x = -Math.PI / 2; top.position.copy(v.position).setY(v.position.y + 30); g.add(top); }
    const lava = new THREE.Mesh(new THREE.RingGeometry(R + 2, R + 40, 64), EM('#ff5a10', 1.5)); lava.rotation.x = -Math.PI / 2; lava.position.y = -0.4; g.add(lava);
    return { group: g, sky: ['#140404', '#d04a10', V(0.3, 0.2, -0.8), '#ff8a2a', false], fog: ['#4a1408', 0.012], sun: ['#ff7a30', 2.0], hemi: ['#ff6a2a', '#200804', 0.7], upd(t, dt, G2) { lava.material.color.set('#ff5a10').multiplyScalar(1.4 + Math.sin(t * 2) * 0.3); if (Math.random() < dt * 40) G2.fx.emit(V(rand(-R, R), 0.3, rand(-R, R)), V(rand(-1, 1), rand(3, 8), rand(-1, 1)), pick(['#ff7a2a', '#ffb040', '#ff3a10']), 0.5, 2.2, { drag: 0.3, grav: -1 }); } };
  },
  beach(G, f, R) {
    const g = new THREE.Group(); const t = ctex(256, 256, (x, w, h) => { x.fillStyle = '#e8d098'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${150 + rand(0, 60)},${120 + rand(0, 60)},70,0.35)`; x.fillRect(rand(0, w), rand(0, h), 2, 2); } }, 12);
    const fm = ST('#fff', 0.95); fm.map = t; g.add(floorMesh(R, fm));
    const sea = new THREE.Mesh(new THREE.RingGeometry(R + 2, 320, 64, 1), new THREE.MeshStandardMaterial({ color: '#1a90d0', roughness: 0.15, metalness: 0.3, emissive: new THREE.Color('#0a4a80'), emissiveIntensity: 0.5 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.3; g.add(sea);
    const foam = new THREE.Mesh(new THREE.RingGeometry(R + 1.6, R + 3.2, 80), EM('#ffffff', 1.2, 0.8)); foam.rotation.x = -Math.PI / 2; foam.position.y = -0.2; g.add(foam);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + rand(-0.1, 0.1), r = R + rand(0, 6); const pm = new THREE.Group(); pm.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.add(pm); const tr = cyl(pm, 0.35, 0.55, 9, ST('#6a4a2a', 0.9), 0, 4.5, 0, 6); tr.rotation.z = rand(-0.2, 0.2); for (let k = 0; k < 7; k++) { const lf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 5), ST('#2a8a3a', 0.8)); lf.position.set(Math.sin(k) * 1.8, 9.2, Math.cos(k) * 1.8); lf.rotation.set(0.5, k, 0); pm.add(lf); } }
    const sun = new THREE.Mesh(new THREE.CircleGeometry(16, 32), EM('#ffc070', 1.6)); sun.position.set(f.pos.x + 20, 20, f.pos.z - 150); sun.lookAt(f.pos.x, 14, f.pos.z); g.add(sun);
    return { group: g, sky: ['#2a5aa8', '#ff9a58', V(0.1, 0.12, -1), '#ffb060', false], fog: ['#f0a070', 0.005], sun: ['#ffb870', 3.0], hemi: ['#ffd0a0', '#4a90b0', 0.9], upd(t, dt, G2) { foam.scale.setScalar(1 + Math.sin(t * 1.5) * 0.012); sea.material.emissiveIntensity = 0.5 + Math.sin(t) * 0.1; if (Math.random() < dt * 12) G2.fx.emit(V(rand(-R, R), 3, rand(-R, R)), V(rand(-2, 2), 0.2, rand(-2, 2)), '#ffffff', 0.3, 3, { drag: 0.2, end: 0.2 }); } };
  },
  palace(G, f, R) {
    const g = new THREE.Group(); const t = ctex(512, 512, (x, w, h) => { x.fillStyle = '#e8e0f4'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b8902a'; x.lineWidth = 3; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); const cx = i * 64 + 32, cy = j * 64 + 32; for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; x.lineTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); } x.closePath(); x.stroke(); } }, 5);
    const fm = ST('#fff', 0.15, 0.4, { emissive: new THREE.Color('#2a1a50'), emissiveIntensity: 0.3 }); fm.map = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#ffd060'));
    const rings = []; const gold = ST('#e8b840', 0.25, 0.95, { emissive: new THREE.Color('#704a00'), emissiveIntensity: 0.4 }), glass = new THREE.MeshStandardMaterial({ color: '#b8a0ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55, emissive: new THREE.Color('#5a3aff'), emissiveIntensity: 0.5 });
    for (let i = 0; i < 6; i++) { const rg = new THREE.Mesh(new THREE.TorusGeometry(8 + i * 5, 0.35, 8, 64), gold); rg.position.copy(f.pos).setY(14 + i * 3); rg.rotation.set(rand(0, 3), rand(0, 3), 0); g.add(rg); rings.push([rg, rand(0.2, 0.7) * (i % 2 ? 1 : -1)]); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; const r = R + 4; const pm = new THREE.Mesh(new THREE.OctahedronGeometry(3.2), glass); pm.scale.y = 3.6; pm.position.set(Math.cos(a) * r, 11, Math.sin(a) * r); g.add(pm); rings.push([pm, 0.4]); box(g, 3, 1, 3, gold, Math.cos(a) * r, 0.5, Math.sin(a) * r); }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), EM('#d8c0ff', 1.6, 0.9)); core.position.copy(f.pos).setY(46); g.add(core);
    return { group: g, sky: ['#2a1a6a', '#e8a8ff', V(0, 0.7, -1), '#fff0c0', true], fog: ['#7a5ac0', 0.006], sun: ['#fff0c8', 2.4], hemi: ['#d0b8ff', '#4a3a80', 1.0], upd(t, dt, G2) { rings.forEach(([m, s]) => { m.rotation.y += dt * s; m.rotation.x += dt * s * 0.5; }); core.rotation.y += dt; core.scale.setScalar(1 + Math.sin(t * 2) * 0.08); } };
  },
};


/* ---------- five additional domain environments ---------- */
const mkTex = (a, b, n = 8) => ctex(512, 512, (x, w, h) => { const sz = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * sz, j * sz, sz, sz); } for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${rand(0, 0.12)})`; x.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(1, 4)); } });
ENV.eclipse = function (G, f, R) {
  const g = new THREE.Group(); const t = mkTex('#0c0a10', '#6a645c', 10); const fm = ST('#fff', 0.3, 0.2); fm.map = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#ffb050'));
  const stone = ST('#2a2630', 0.7, 0.2), gold = ST('#d8a040', 0.3, 0.9, { emissive: new THREE.Color('#5a3200'), emissiveIntensity: 0.4 }); const glass = [];
  for (let i = 0; i < 14; i++) for (const side of [-1, 1]) { const z = -R + 6 + i * ((2 * R - 12) / 13), x = side * (R * 0.55); cyl(g, 1.1, 1.4, 26, stone, x, 13, z, 10); cyl(g, 1.7, 1.7, 1, stone, x, 0.5, z, 10); box(g, 4, 1, 4, stone, x, 26.2, z);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.7, 6, 24, Math.PI), stone); arch.rotation.set(0, Math.PI / 2, 0); arch.position.set(0, 26.5, z); if (side > 0) g.add(arch);
    const gc = new THREE.Color().setHSL((i * 0.11 + (side > 0 ? 0.5 : 0)) % 1, 0.9, 0.5); const gl = new THREE.Mesh(new THREE.PlaneGeometry(6, 18), EM(gc, 0.9, 0.75)); gl.position.set(side * (R * 0.55 + 4), 14, z); gl.rotation.y = -side * Math.PI / 2; g.add(gl); glass.push(gl); }
  const sun = new THREE.Mesh(new THREE.CircleGeometry(20, 48), new THREE.MeshBasicMaterial({ color: '#000000' })); sun.position.set(0, 62, -R - 60); g.add(sun); const cor = new THREE.Mesh(new THREE.RingGeometry(20, 34, 64), EM('#ffb050', 2.2, 0.8)); cor.position.copy(sun.position).z += 0.5; g.add(cor);
  const shaftM = new THREE.MeshBasicMaterial({ color: '#ffcf90', transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); for (let i = 0; i < 10; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 5, 40, 10, 1, true), shaftM); c.position.set(rand(-20, 20), 20, rand(-30, 30)); c.rotation.z = rand(-0.25, 0.25); g.add(c); }
  const alt = new THREE.Group(); alt.position.set(0, 0, -R + 4); g.add(alt); for (let i = 0; i < 4; i++) box(alt, 14 - i * 2.5, 0.8, 8 - i, stone, 0, 0.4 + i * 0.8, 0); box(alt, 3, 6, 1.2, gold, 0, 5.5, -1);
  return { group: g, sky: ['#020004', '#3a1a08', V(0, 0.8, -1), '#ffb050', true], fog: ['#0a0608', 0.012], sun: ['#ffc080', 0.5], hemi: ['#a06a40', '#0a0608', 0.22], upd(tt, dt, G2) { cor.scale.setScalar(1 + Math.sin(tt * 1.3) * 0.04); glass.forEach((m, i) => m.material.color.multiplyScalar(1)); shaftM.opacity = 0.045 + Math.sin(tt) * 0.015; if (Math.random() < dt * 20) G2.fx.emit(V(rand(-30, 30), rand(0, 24), rand(-30, 30)), V(0, rand(0.2, 1), 0), '#ffcf90', 0.2, 4, { drag: 0.2, bright: 1.4 }); } };
};
ENV.abattoir = function (G, f, R) {
  const g = new THREE.Group(); const t = ctex(512, 512, (x, w, h) => { x.fillStyle = '#1a0c0e'; x.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { x.fillStyle = '#2a1618'; x.fillRect(i * 32 + 2, 0, 28, h); } for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${90 + rand(0, 80)},0,10,${rand(0.2, 0.6)})`; x.beginPath(); x.arc(rand(0, w), rand(0, h), rand(6, 34), 0, 6.3); x.fill(); } }); const fm = ST('#fff', 0.35, 0.5); fm.map = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#ff2040'));
  const iron = ST('#1c1a1e', 0.5, 0.8), rust = ST('#5a2a20', 0.8, 0.5); const moon = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 24), EM('#ff3a4a', 1.6)); moon.position.set(30, 60, -R - 90); g.add(moon);
  for (let i = 0; i < 6; i++) box(g, 2.4, 40, 2.4, iron, -R + 4 + i * (R * 2 / 5), 20, -R + 2); for (let i = 0; i < 5; i++) box(g, R * 2, 1.2, 1.2, iron, 0, 36 - i * 0.2, -R + 2 + i * (R / 2));
  const hooks = []; for (let i = 0; i < 46; i++) { const hg = new THREE.Group(); hg.position.set(rand(-R, R), 36, rand(-R, R * 0.8)); const L = rand(8, 28); cyl(hg, 0.08, 0.08, L, iron, 0, -L / 2, 0, 5); const hk = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 6, 14, Math.PI * 1.4), iron); hk.position.y = -L - 0.3; hg.add(hk); const meat = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.6, 4, 8), ST('#7a1a22', 0.6, 0.1, { emissive: new THREE.Color('#300008'), emissiveIntensity: 0.5 })); meat.position.y = -L - 1.4; if (Math.random() < 0.7) hg.add(meat); g.add(hg); hooks.push(hg); }
  for (let i = 0; i < 18; i++) { const bp = new THREE.Mesh(new THREE.CircleGeometry(rand(2, 6), 18), new THREE.MeshStandardMaterial({ color: '#4a0008', roughness: 0.1, metalness: 0.4, emissive: new THREE.Color('#200004'), emissiveIntensity: 0.5 })); bp.rotation.x = -Math.PI / 2; bp.position.set(rand(-R, R), 0.04, rand(-R, R)); g.add(bp); }
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283, r = R + rand(2, 8); box(g, 3, rand(12, 30), 3, rust, Math.cos(a) * r, 8, Math.sin(a) * r); }
  return { group: g, sky: ['#0a0004', '#5a0a18', V(0.3, 0.3, -1), '#ff3050', false], fog: ['#1a0508', 0.014], sun: ['#ff4050', 1.2], hemi: ['#a02030', '#100408', 0.5], upd(tt, dt, G2) { hooks.forEach((h, i) => { h.rotation.z = Math.sin(tt * 0.6 + i) * 0.06; }); moon.scale.setScalar(1 + Math.sin(tt * 0.8) * 0.015); if (Math.random() < dt * 30) G2.fx.emit(V(rand(-30, 30), 34, rand(-30, 30)), V(0, -rand(4, 9), 0), '#a0101e', 0.25, 3, { drag: 0.1, bright: 0.9 }); } };
};
ENV.observatory = function (G, f, R) {
  const g = new THREE.Group(); const t = ctex(512, 512, (x, w, h) => { x.fillStyle = '#080c1c'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,180,255,.5)'; x.lineWidth = 2; for (let i = 1; i < 8; i++) { x.beginPath(); x.arc(w / 2, h / 2, i * 32, 0, 6.3); x.stroke(); } for (let i = 0; i < 24; i++) { x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 + Math.cos(i / 24 * 6.28) * 256, h / 2 + Math.sin(i / 24 * 6.28) * 256); x.stroke(); } for (let i = 0; i < 90; i++) { x.fillStyle = '#9fd0ff'; x.fillRect(rand(0, w), rand(0, h), 2, 2); } }); const fm = ST('#fff', 0.08, 0.7, { emissive: new THREE.Color('#0a1a40'), emissiveIntensity: 0.6 }); fm.map = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#7ab8ff'));
  const brass = ST('#c8a860', 0.3, 0.9), dk = ST('#10142a', 0.6, 0.4); const rings = []; for (let i = 0; i < 5; i++) { const rg = new THREE.Mesh(new THREE.TorusGeometry(10 + i * 7, 0.3, 8, 80), brass); rg.position.y = 20 + i * 2; rg.rotation.set(rand(0.8, 1.4), rand(0, 3), 0); g.add(rg); rings.push([rg, rand(0.15, 0.4) * (i % 2 ? 1 : -1)]); const pl = new THREE.Mesh(new THREE.SphereGeometry(rand(1, 2.2), 16, 12), EM(['#7ab8ff', '#ffb870', '#c890ff', '#80ffc8', '#ff80a0'][i], 1.3)); pl.position.set(rand(-1, 1) * 10, 20 + i * 2, rand(-1, 1) * 10); g.add(pl); rings.push([pl, 0.3]); }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(4, 2), EM('#bfe0ff', 1.8, 0.9)); core.position.set(0, 24, 0); g.add(core);
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; cyl(g, 0.7, 0.9, 30, dk, Math.cos(a) * (R + 2), 15, Math.sin(a) * (R + 2), 8); box(g, 2.4, 0.5, 2.4, brass, Math.cos(a) * (R + 2), 30, Math.sin(a) * (R + 2)); }
  const tel = new THREE.Group(); tel.position.set(-R + 6, 0, -R + 6); g.add(tel); cyl(tel, 1.4, 1.8, 6, dk, 0, 3, 0, 10); const tube = cyl(tel, 1.2, 1.6, 16, brass, 0, 11, 6, 12); tube.rotation.x = -0.9;
  return { group: g, sky: ['#000008', '#0a1450', V(0.2, 0.6, -1), '#8ab8ff', true], fog: ['#04061a', 0.008], sun: ['#9fc8ff', 1.2], hemi: ['#5a7ac0', '#04061a', 0.6], upd(tt, dt, G2) { rings.forEach(([m, sp]) => { m.rotation.y += dt * sp; }); core.rotation.y += dt; core.scale.setScalar(1 + Math.sin(tt * 2) * 0.08); if (Math.random() < dt * 16) G2.fx.emit(V(rand(-40, 40), rand(2, 40), rand(-40, 40)), V(rand(-1, 1), rand(-0.5, 1), rand(-1, 1)), '#bfe0ff', 0.2, 3, { drag: 0.1, bright: 1.6 }); } };
};
ENV.glacier = function (G, f, R) {
  const g = new THREE.Group(); const t = ctex(512, 512, (x, w, h) => { const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#8ad8f0'); gr.addColorStop(1, '#3a7ab0'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 60; i++) { x.lineWidth = rand(1, 3); x.beginPath(); x.moveTo(rand(0, w), rand(0, h)); x.lineTo(rand(0, w), rand(0, h)); x.stroke(); } }); const fm = ST('#fff', 0.06, 0.2, { emissive: new THREE.Color('#1a4a70'), emissiveIntensity: 0.4 }); fm.map = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#bff4ff'));
  const ice = new THREE.MeshPhysicalMaterial({ color: '#b8ecff', roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.8, emissive: new THREE.Color('#2a6a9a'), emissiveIntensity: 0.5, clearcoat: 1 });
  for (let i = 0; i < 60; i++) { const a = rand(0, 6.283), r = rand(R * 0.3, R + 14); const h = rand(4, 22); const c = new THREE.Mesh(new THREE.ConeGeometry(rand(0.8, 2.6), h, 6), ice); c.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); c.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15)); g.add(c); }
  for (let i = 0; i < 70; i++) { const h = rand(6, 26); const c = new THREE.Mesh(new THREE.ConeGeometry(rand(0.8, 2.4), h, 6), ice); c.rotation.x = Math.PI; c.position.set(rand(-R - 10, R + 10), 44 - h / 2, rand(-R - 10, R + 10)); g.add(c); }
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 16, R + 20, 60, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#5a9ac0', roughness: 0.3, side: THREE.BackSide, emissive: new THREE.Color('#10304a'), emissiveIntensity: 0.6 })); wall.position.y = 28; g.add(wall);
  const crys = []; for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(2.2), EM('#8ae8ff', 1.6, 0.9)); c.scale.y = 2.6; c.position.set(rand(-1, 1) * 18, 3.5, rand(-1, 1) * 18); g.add(c); crys.push(c); }
  return { group: g, sky: ['#04101c', '#2a6a90', V(0, 0.9, 0.1), '#bff4ff', false], fog: ['#1a4a70', 0.016], sun: ['#bfe8ff', 1.8], hemi: ['#8ad0f0', '#1a3a58', 0.8], upd(tt, dt, G2) { crys.forEach((c, i) => { c.rotation.y += dt * 0.6; c.position.y = 3.5 + Math.sin(tt * 1.3 + i) * 0.4; }); if (Math.random() < dt * 40) G2.fx.emit(V(rand(-35, 35), rand(10, 40), rand(-35, 35)), V(rand(-0.5, 0.5), -rand(0.5, 2), rand(-0.5, 0.5)), '#e8fbff', 0.18, 6, { drag: 0.2, bright: 1.3 }); } };
};
ENV.colosseum = function (G, f, R) {
  const g = new THREE.Group(); const t = ctex(512, 512, (x, w, h) => { x.fillStyle = '#b89c70'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${rand(60, 130)},${rand(40, 90)},20,${rand(0.05, 0.25)})`; x.fillRect(rand(0, w), rand(0, h), rand(1, 5), rand(1, 3)); } x.strokeStyle = 'rgba(40,20,0,.5)'; x.lineWidth = 3; x.beginPath(); x.arc(w / 2, h / 2, 200, 0, 6.3); x.stroke(); }); const fm = ST('#fff', 0.95); fm.map = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#ffe060'));
  const stone = ST('#8a7c68', 0.85), dark = ST('#4a4034', 0.9); for (let tier = 0; tier < 7; tier++) { const r0 = R + 4 + tier * 5, hh = 3 + tier * 3; const w = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 5, r0 + 5, hh, 56, 1, true), tier % 2 ? stone : dark); w.material.side = THREE.DoubleSide; w.position.y = hh / 2; g.add(w); const top = new THREE.Mesh(new THREE.RingGeometry(r0, r0 + 5, 56), stone); top.rotation.x = -Math.PI / 2; top.position.y = hh; g.add(top); }
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283, r = R + 4; cyl(g, 1.1, 1.3, 14, stone, Math.cos(a) * r, 7, Math.sin(a) * r, 10); const ar = new THREE.Mesh(new THREE.TorusGeometry(r * Math.PI / 40 * 0.9, 0.5, 6, 12, Math.PI), stone); ar.position.set(Math.cos(a + 0.0785) * r, 14, Math.sin(a + 0.0785) * r); ar.rotation.y = -a - 0.0785 + Math.PI / 2; g.add(ar); }
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 12, 0, 6.283, 0, 0.7), new THREE.MeshBasicMaterial({ color: '#1a1c28', side: THREE.BackSide, fog: false })); cloud.position.y = 20; g.add(cloud);
  const flashL = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); flashL.position.y = 95; flashL.rotation.x = Math.PI / 2; g.add(flashL);
  const statue = new THREE.Group(); statue.position.set(0, 0, -R * 0.1); g.add(statue); box(statue, 8, 2, 8, stone, 0, 1, 0); cyl(statue, 1.8, 2.4, 14, dark, 0, 9, 0, 8); const orb = new THREE.Mesh(new THREE.SphereGeometry(2, 20, 14), EM('#ffe060', 1.8)); orb.position.y = 18; statue.add(orb);
  return { group: g, sky: ['#05060e', '#3a3f58', V(0.2, 0.5, -0.8), '#ffe9a0', false], fog: ['#1c2030', 0.012], sun: ['#ffe9b0', 1.6], hemi: ['#7a88b0', '#2a2418', 0.7], upd(tt, dt, G2) { flashL.material.opacity = Math.max(0, flashL.material.opacity - dt * 5); if (Math.random() < dt * 0.9) { flashL.material.opacity = 0.35; } orb.scale.setScalar(1 + Math.sin(tt * 5) * 0.12); if (Math.random() < dt * 24) G2.fx.emit(V(rand(-40, 40), rand(0, 3), rand(-40, 40)), V(rand(-3, 3), rand(0, 2), rand(-3, 3)), '#c8a878', 0.5, 3, { drag: 0.4, bright: 0.5 }); } };
};

/* ---------- helpers for effects used by several domains ---------- */
function telegraphLine(G, a, b, color, t, w = 0.7) { // flat telegraph strip on the ground
  const d = b.clone().sub(a), L = d.length(); const geo = new THREE.PlaneGeometry(w, L); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, G.fx.mat(color, 0.4)); m.position.copy(a).addScaledVector(d, 0.5).setY(0.11); m.rotation.y = Math.atan2(d.x, d.z);
  G.fx.add(m, t, (u, o) => { o.material.opacity = 0.2 + 0.6 * u; }); return m;
}
function segHit(p, a, b) { const ab = b.clone().sub(a).setY(0), ap = p.clone().sub(a).setY(0); const t = clamp(ap.dot(ab) / ab.lengthSq(), 0, 1); return a.clone().addScaledVector(ab, t).setY(0).distanceTo(p.clone().setY(0)); }

ENV.mirage = function (G, f, R) {
  const g = new THREE.Group(); const t = ctex(512, 512, (x, w, h) => { x.fillStyle = '#d8b070'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2200; i++) { x.fillStyle = `rgba(${rand(150, 230)},${rand(110, 180)},${rand(50, 110)},${rand(0.15, 0.5)})`; x.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(1, 3)); } for (let i = 0; i < 26; i++) { x.strokeStyle = 'rgba(120,80,30,.25)'; x.lineWidth = rand(1, 3); x.beginPath(); const y = rand(0, h); x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + rand(-14, 14), w * 0.6, y + rand(-14, 14), w, y + rand(-8, 8)); x.stroke(); } }, 5);
  const fm = ST('#fff', 0.95, 0); fm.map = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#ffcf70')); const sand = ST('#c9995a', 1);
  for (let i = 0; i < 26; i++) { const a = rand(0, 6.283), r = rand(R + 6, R + 70), s = rand(10, 28); const dn = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 10), sand); dn.scale.set(1.8, 0.45, 1.2); dn.position.set(Math.cos(a) * r, -s * 0.15, Math.sin(a) * r); dn.rotation.y = rand(0, 3); g.add(dn); }
  const stone = ST('#b99a68', 0.9); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, r = R + 3; cyl(g, 1.2, 1.5, rand(6, 14), stone, Math.cos(a) * r, 5, Math.sin(a) * r, 8); }
  const rings = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(R * 0.5 + i * 8, R * 0.5 + i * 8 + 0.6, 64), EM('#ffe9b0', 1.2, 0.5)); m.rotation.x = -Math.PI / 2; m.position.y = 0.08; g.add(m); rings.push(m); }
  return { group: g, sky: ['#3a78c8', '#ffd890', V(0, 0.4, -1), '#fff0c0', false], fog: ['#e8c490', 0.008], sun: ['#ffe2a0', 2.4], hemi: ['#ffe8b8', '#a07038', 0.9], upd(tt, dt, G2) { rings.forEach((m, i) => { m.scale.setScalar(1 + Math.sin(tt * 1.2 + i * 2) * 0.08); m.material.opacity = 0.25 + 0.25 * Math.sin(tt * 2 + i); }); if (Math.random() < dt * 60) G2.fx.emit(V(rand(-R, R), rand(0.2, 2), rand(-R, R)), V(rand(4, 9), rand(0, 1), rand(-1, 1)), '#f0d098', 0.3, 2.4, { drag: 0.1 }); } };
};
ENV.bloom = function (G, f, R) {
  const g = new THREE.Group(); const t = ctex(512, 512, (x, w, h) => { x.fillStyle = '#16301a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${rand(30, 110)},${rand(90, 200)},${rand(40, 90)},${rand(0.1, 0.45)})`; x.beginPath(); x.arc(rand(0, w), rand(0, h), rand(1, 7), 0, 6.283); x.fill(); } }, 5);
  const fm = ST('#fff', 0.9, 0, { emissive: new THREE.Color('#0a3a14'), emissiveIntensity: 0.4 }); fm.map = t; g.add(floorMesh(R, fm)); g.add(ringEdge(R, '#8aff6a'));
  const stem = ST('#2a7a30', 0.7), pc = ['#ff6ad0', '#ffd24f', '#b36bff']; const bulbs = [];
  for (let i = 0; i < 26; i++) { const a = rand(0, 6.283), r = rand(R * 0.55, R + 30), h = rand(8, 26); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, h, 6), stem); s.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); s.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15)); s.castShadow = true; g.add(s); const b = new THREE.Mesh(new THREE.SphereGeometry(rand(1.6, 3.6), 12, 8), EM(pick(pc), 1.3, 0.9)); b.position.set(s.position.x, h, s.position.z); g.add(b); bulbs.push(b); }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 28, 24, 14, 0, 6.283, 0, 1.45), new THREE.MeshBasicMaterial({ color: '#7aff9a', transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false, fog: false })); g.add(dome);
  return { group: g, sky: ['#04140a', '#1e6a3a', V(0, 1, 0), '#d8ffb0', false], fog: ['#0c3018', 0.014], sun: ['#c8ffb0', 1.3], hemi: ['#7aff9a', '#0a2410', 0.8], upd(tt, dt, G2) { bulbs.forEach((b, i) => { b.scale.setScalar(1 + Math.sin(tt * 1.6 + i) * 0.1); }); if (Math.random() < dt * 50) G2.fx.emit(V(rand(-R, R), rand(0.3, 6), rand(-R, R)), V(rand(-0.6, 0.6), rand(0.4, 1.6), rand(-0.6, 0.6)), pick(['#b8ff6a', '#ff9ae8']), 0.2, 3.2, { drag: 0.2, bright: 1.4 }); } };
};

/* ============================================================ */
export function registerDomains(K) {
  const { def, aimPoint, pulseWarn } = K;
  const dom = (id, o) => { const spec = { ...o, id }; return def({ spec, slot: 'd', domain: true, id, ultCost: o.ultCost || 100, cd: 0, icon: o.icon, color: o.color, name: o.name, r: o.r, desc: o.desc, req: o.req,
    cast(f, G) { return G.domain(f, spec); } }); };

  // ---- 1. Crimson Ruin Shrine (Legendary, OPEN domain: no barrier; slashes only in a radius around the caster) ----
  dom('shrine', { name: 'Crimson Ruin Shrine', sub: 'Open Domain · Sure-slash storm', icon: '⛩', color: '#ff2a3a', r: 'L', dur: 13, open: true, env: ENV.shrine, radius: 15,
    desc: 'Open domain: a colossal shrine rises and relentless slashes carve everything within a set radius around you. Jump, dash and fly to dodge. Scenery is shredded (cosmetic only).',
    intro(G, f, u) { if (Math.random() < 0.5) { const p = f.pos.clone().add(V(rand(-14, 14), 0, rand(-14, 14))); G.fx.bolt(p.clone().setY(18), p, '#ff2a3a', 0.2, 0.1); } },
    start(G, f, E) { E.acc = 0; E.volley = 0; },
    tick(G, f, dt, E, age) { const c = f.pos; E.acc += dt; E.volley -= dt;
      if (E.acc > 0.32 - 0.017 * (f.dmL || 0)) { E.acc = 0; const es = G.enemiesOf(f).filter(e => flat(e.pos, c) < 15); const cleave = Math.random() < 0.25;
        for (const e of es) { if (Math.random() < 0.7) { const ang = rand(0, 3.14), dir = V(Math.cos(ang), 0, Math.sin(ang)); const mid = e.pos.clone().add(V(rand(-1.2, 1.2), 0, rand(-1.2, 1.2))); const a = mid.clone().addScaledVector(dir, -9), b = mid.clone().addScaledVector(dir, 9); const reach = cleave ? 2.4 : 1.7;
            telegraphLine(G, a, b, '#ff2a3a', 0.4, cleave ? 2 : 0.8); if (cleave) { const d2 = V(-dir.z, 0, dir.x); telegraphLine(G, mid.clone().addScaledVector(d2, -9), mid.clone().addScaledVector(d2, 9), '#ff2a3a', 0.4, 2); }
            G.later(0.42, () => { G.sfx('slash'); G.fx.slash(mid.clone().setY(1.4), Math.atan2(dir.x, dir.z) + 1.57, '#ff2a3a', 7, rand(-0.6, 0.6), 0.22); G.fx.sparks(mid.clone().setY(1), '#ff6a5a', 12, 12, 0.3); G.fx.crack(mid, rand(2, 4), '#ff2a3a', 7);
              for (const t of G.enemiesOf(f)) { if (flat(t.pos, c) > 16 || t.pos.y > 1.6) continue; const dd = Math.min(segHit(t.pos, a, b), cleave ? segHit(t.pos, mid.clone().addScaledVector(V(-dir.z, 0, dir.x), -9), mid.clone().addScaledVector(V(-dir.z, 0, dir.x), 9)) : 99); if (dd < reach) G.damage(f, t, cleave ? 10 : 6, { kind: 'status', kb: 2, stun: 0.12, ignoreBarrier: true, noPassive: true, unblockable: true }); } G.breakScenery(mid, 4); }); } } } },
    end(G, f, E) { } });

  // ---- 2. Endless Cosmos (Legendary): information overload ----
  dom('cosmos', { name: 'Endless Cosmos', sub: 'Information overload', icon: '∞', color: '#9a7aff', r: 'L', dur: 10, env: ENV.cosmos, radius: 20,
    desc: 'The arena becomes infinite space. Enemies inside overload: they cannot see, move or attack for ~1.5s, then take chip damage while inside. You move and attack freely.',
    intro(G, f, u) { if (u > 0.5 && Math.random() < 0.7) G.fx.burst(f.pos.clone().add(V(rand(-6, 6), rand(0, 5), rand(-6, 6))), pick(['#ffffff', '#b0a0ff']), 6, 10, 0.4, 0.6); },
    start(G, f, E) { for (const e of G.enemiesOf(f)) if (flat(e.pos, f.pos) < 20) { { const oz = 1.5 + 0.12 * (f.dmL || 0); e.freeze = Math.max(e.freeze, oz); e.overload = oz; if (e.isPlayer) G.ui.cine('overload', oz); } G.fx.ring(chestOf(e), '#ffffff', 0.5, 4, 0.5, false); } E.acc = 0; },
    tick(G, f, dt, E) { E.acc += dt; if (E.acc > 0.5) { E.acc = 0; for (const e of G.enemiesOf(f)) if (flat(e.pos, f.pos) < 20) G.damage(f, e, 1.3 * (1 + 0.09 * (f.dmL || 0)), { kind: 'status', noKb: true, ignoreBarrier: true, noPassive: true, noHit: false }); } } });

  // ---- 3. Umbral Menagerie Garden (Rare): shadow dive + clones + shikigami boost ----
  dom('garden', { name: 'Umbral Menagerie Garden', sub: 'Dive. Emerge. Strike.', icon: '🌑', color: '#8a3aff', r: 'R', dur: 12, env: ENV.garden,
    desc: 'A landscape of shadow. Your dashes dive into shadow and emerge behind the target, shadow clones strike from odd angles, and Shikigami recharge faster. Strong mobility, modest damage.',
    intro(G, f, u) { if (Math.random() < 0.6) G.fx.burst(f.pos.clone().add(V(rand(-8, 8), 0.3, rand(-8, 8))), '#8a3aff', 5, 6, 0.6, 0.8, { up: 0.4 }); },
    start(G, f, E) { f.shadowStep = true; f.speedMul *= 1.15; f.cd.s = Math.min(f.cd.s, 1); E.acc = 0; E.base = f.speedMul; E.dcm = f.dashCdMul; f.dashCdMul *= 1 - 0.04 * (f.dmL || 0); },
    tick(G, f, dt, E, age) { f.cd.s = Math.max(0, f.cd.s - dt * 1.2); E.acc += dt; if (E.acc > 1.6 - 0.09 * (f.dmL || 0)) { E.acc = 0; const t = G.nearestEnemy(f); if (t) for (let i = 0; i < 2; i++) { const ang = rand(0, 6.283), p = t.pos.clone().add(V(Math.cos(ang) * 3.2, 0, Math.sin(ang) * 3.2)); const cl = G.makeFighterModel(f.app); const m = cl.group; m.position.copy(p); m.rotation.y = Math.atan2(t.pos.x - p.x, t.pos.z - p.z); cl.mats.forEach(mt => { mt.color.set('#10081c'); mt.emissive = new THREE.Color('#6a2aff'); mt.emissiveIntensity = 0.6; mt.transparent = true; mt.opacity = 0.8; mt.userData.keepEmit = true; }); G.scene.add(m); G.fx.burst(p.clone().setY(1), '#8a3aff', 16, 7, 0.6, 0.5); cl.s.atk = { kind: 'light', idx: 0, p: 0 }; let q = 0; G.every(0.016, 0.6, (d) => { q += d / 0.4; cl.s.atk = q < 1 ? { kind: 'light', idx: 0, p: q } : null; cl.update(d); }); G.later(0.28, () => { if (t.dead) return; G.fx.slash(chestOf(t, 1.2), m.rotation.y + 1.57, '#b080ff', 3, rand(-1, 1)); G.damage(f, t, 6 + 0.7 * (f.dmL || 0), { kind: 'status', kb: 3, stun: 0.2, noPassive: true }); }); G.later(0.6, () => { G.scene.remove(m); G.fx.burst(p.clone().setY(1), '#8a3aff', 10, 5, 0.5, 0.4); }); } } },
    end(G, f, E) { f.shadowStep = false; f.speedMul /= 1.15; if (E.dcm) f.dashCdMul = E.dcm; } });

  function spin(G, f, E, first) { E.win = Math.random() < 0.2 + 0.03 * (f.dmL || 0); if (G.ui.cine) G.ui.cine('reels', { win: E.win, who: f.name }); if (E.win) { f.jackpot = true; f.ceFree = true; f.speedMul *= 1.3; f.dmgMul *= 1.45; G.fx.ring(f.pos.clone().setY(0.2), '#ffe040', 1, 12, 0.7); G.callout(f, 'JACKPOT!!', '#ffe040', 2, true); G.shake(0.8); E.dur = 12; } else { G.callout(f, 'NO JACKPOT', '#ff90d0', 1.4, true); E.dur = 10; } }
  // ---- 4. Lucky Reel Parlor (Epic): one 1-in-5 jackpot roll; cheaper gauge ----
  dom('gamble', { name: 'Lucky Reel Parlor', sub: 'One spin. One in five.', icon: '🎰', color: '#ff40c0', r: 'E', dur: 12, env: ENV.gamble, ultCost: 70, reels: true,
    desc: 'A pachinko parlor with a jackpot spin (1 in 5). Miss? Land 5 hits inside the domain, then press the Domain key to REROLL (repeatable). Jackpot: unlimited energy, rapid recovery, faster, stronger. Miss: the arena changes but you get nothing. Needs only 70% gauge.',
    intro(G, f, u) { if (Math.random() < 0.5) G.fx.burst(f.pos.clone().add(V(rand(-5, 5), rand(1, 6), rand(-5, 5))), pick(['#ff40c0', '#40e0ff', '#ffe040']), 6, 8, 0.5, 0.6); },
    start(G, f, E) { E.t = 0; E.rh = 0; E.base = f.speedMul; E.dur = 10; spin(G, f, E, true); },
    reroll(G, f, E) { if (E.win) return; if ((E.rh || 0) < 5) { if (f.isPlayer) G.callout(f, 'LAND 5 HITS TO REROLL (' + (E.rh || 0) + '/5)', '#ffb0e0', 1.0); return; } E.rh = 0; G.dom.age = 0; G.sfx('zap'); G.callout(f, 'REROLL!', '#ffe040', 1.4, true); spin(G, f, E, false); },
    tick(G, f, dt, E, age) { if (E.win) { f.ce = f.maxCe; f.hp = Math.min(f.maxHp, f.hp + 13 * dt); if (Math.random() < dt * 40) G.fx.emit(chestOf(f, rand(0, 2.4)), V(rand(-1, 1), 3, rand(-1, 1)), pick(['#ffe040', '#ff40c0', '#40e0ff']), 0.45, 0.6); } if (age > E.dur) E.stopNow = true; },
    end(G, f, E) { if (E.win) { f.jackpot = false; f.ceFree = false; f.speedMul /= 1.3; f.dmgMul /= 1.45; } } });

  // ---- 5. Verdict Hall (Legendary): shared trial, 8s defense window, executioner blade ----
  dom('court', { name: 'Verdict Hall', sub: 'The court is in session', icon: '⚖', color: '#ffd070', r: 'L', dur: 18, env: ENV.court, trial: true,
    desc: 'A courtroom. Everyone inside stands trial: mash ATTACK for 8s to build a shared defense (more defendants = higher target). Not guilty: it ends. Guilty: you gain the Executioner\'s Sword — one hit is a KO.',
    intro(G, f, u) { },
    start(G, f, E) { const es = G.enemiesOf(f); E.es = es; E.phase = 'trial'; E.score = 0; E.target = 34 * Math.max(1, es.length); E.t = 8; es.forEach(e => { e.root = 8.4; e.trialMash = true; }); G.trialPress = 0; G.ui.cine('trial', { show: true, p: 0, t: 8, text: 'MASH ATTACK TO DEFEND!' }); G.callout(f, 'ALL RISE', '#ffd070', 1.6, true); },
    tick(G, f, dt, E, age) { if (E.phase === 'trial') { E.t -= dt; E.score += G.trialPress; G.trialPress = 0; for (const e of E.es) if (!e.isPlayer && !e.dead) E.score += dt * (2 + e.skill * 4.5) * rand(0.6, 1.2); G.ui.cine('trial', { show: true, p: Math.min(1, E.score / E.target), t: E.t });
        if (E.score >= E.target) { E.phase = 'free'; G.ui.cine('trial', { show: false }); G.callout(f, 'NOT GUILTY', '#9bffb0', 2, true); G.sfx('perfect'); es0(E); E.stopNow = true; }
        else if (E.t <= 0) { E.phase = 'guilty'; G.ui.cine('trial', { show: false }); es0(E); G.callout(f, 'GUILTY!', '#ff4a4a', 2, true); G.sfx('boom'); G.shake(0.8); G.aberr(1); f.executioner = 7 + 0.6 * (f.dmL || 0); f.speedMul *= 1.2; E.sword = true; E.gt = 7 + 0.6 * (f.dmL || 0); G.fx.ring(f.pos.clone().setY(0.2), '#ff4a4a', 1, 10, 0.6); } }
      else if (E.phase === 'guilty') { E.gt -= dt; if (Math.random() < dt * 30) G.fx.emit(chestOf(f, rand(0.5, 2.4)), V(rand(-1, 1), 2, rand(-1, 1)), '#ff4a4a', 0.5, 0.5); if (E.gt <= 0 || f.executioner <= 0) E.stopNow = true; } },
    end(G, f, E) { if (E.sword) { f.speedMul /= 1.2; } f.executioner = 0; G.ui.cine('trial', { show: false }); for (const e of E.es || []) { e.trialMash = false; if (e.root > 0 && E.phase === 'trial') e.root = 0; } } });
  function es0(E) { for (const e of E.es) { e.root = 0; e.trialMash = false; } }

  // ---- 6. Mirror Soul Hall (Rare): brief immobilize then soul strike ----
  dom('soulhall', { name: 'Mirror Soul Hall', sub: 'Know thyself — briefly', icon: '🪞', color: '#d8b8ff', r: 'R', dur: 6, env: ENV.soulhall,
    desc: 'A hall of mirrors that briefly locks everyone in place, opening a window for a powerful soul-strike. Exact balance still being tuned.',
    intro(G, f, u) { if (Math.random() < 0.4) G.fx.burst(f.pos.clone().add(V(rand(-6, 6), rand(0, 5), rand(-6, 6))), '#e0d0ff', 5, 6, 0.5, 0.6); },
    start(G, f, E) { E.es = G.enemiesOf(f); E.es.forEach(e => { e.freeze = Math.max(e.freeze, 2.0 + 0.15 * (f.dmL || 0)); e.breakTechs(); G.fx.ring(chestOf(e), '#d8b8ff', 0.5, 4, 0.5, false); }); E.fired = false; E.t = 0; },
    tick(G, f, dt, E) { E.t += dt; if (!E.fired && E.t > 0.9) { E.fired = true; const t = G.nearestEnemy(f); if (t) { const p = chestOf(t); G.callout(f, 'SOUL STRIKE', '#d8b8ff', 1.2); f.pos.copy(t.pos.clone().addScaledVector(V(Math.sin(f.yaw), 0, Math.cos(f.yaw)), -2.4)); G.fx.flash(p, '#d8b8ff', 6, 0.3); G.later(0.25, () => { for (const e of E.es) if (!e.dead) { G.fx.beam(chestOf(f, 1.6), chestOf(e), '#e8d0ff', 0.4, 0.4); G.fx.slash(chestOf(e), f.yaw + 1.57, '#e8d0ff', 5, 0.4, 0.3); G.fx.burst(chestOf(e), '#e8d0ff', 30, 14, 0.7, 0.7); G.shake(0.8); G.aberr(1); G.sfx('crit'); G.damage(f, e, 38 * (1 + 0.06 * (f.dmL || 0)), { kind: 'status', kb: 8, launch: 6, stun: 1.0, unblockable: true, ignoreBarrier: true, noPassive: true }); } }); } } if (E.t > 4) E.stopNow = true; } });

  // ---- 7. Iron Cinder Crypt (Epic): continuous heat, lava eruptions ----
  dom('volcano', { name: 'Iron Cinder Crypt', sub: 'The mountain remembers', icon: '🌋', color: '#ff6a1a', r: 'E', dur: 12, env: ENV.volcano,
    desc: 'A volcanic landscape. Everyone else takes continuous heat damage (stronger than Cosmos chip, but no incapacitation) and lava erupts around the arena. You move and attack normally.',
    intro(G, f, u) { if (Math.random() < 0.5) { const p = V(rand(-25, 25), 0, rand(-25, 25)); G.fx.burst(p, '#ff7a2a', 14, 14, 0.8, 0.9, { lift: 10, grav: 8 }); } },
    start(G, f, E) { E.acc = 0; E.er = 0.6; },
    tick(G, f, dt, E, age) { E.acc += dt; if (E.acc > 0.5) { E.acc = 0; for (const e of G.enemiesOf(f)) { G.damage(f, e, 2.6 * (1 + 0.07 * (f.dmL || 0)), { kind: 'status', noKb: true, ignoreBarrier: true, noPassive: true }); G.fx.emit(chestOf(e, rand(0.2, 2)), V(0, 3, 0), '#ff7a2a', 0.5, 0.5); } }
      E.er -= dt; if (E.er <= 0) { E.er = rand(0.7, 1.3) * (1 - 0.04 * (f.dmL || 0)); const es = G.enemiesOf(f); const tgt = es.length && Math.random() < 0.6 ? es[Math.floor(rand(0, es.length))].pos.clone().add(V(rand(-2, 2), 0, rand(-2, 2))) : V(rand(-26, 26), 0, rand(-26, 26)); pulseWarn(G, tgt, 3.6, '#ff6a1a', 0.9); G.later(0.9, () => { G.sfx('boom'); G.shake(0.35); G.fx.shock(tgt.clone(), '#ff7a2a', 7, 0.5); G.fx.burst(tgt.clone().setY(0.5), '#ffb040', 40, 16, 0.9, 0.9, { lift: 14, grav: 10 }); G.fx.crack(tgt, 5, '#ff6a1a', 9); const col = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 14, 16, 1, true), G.fx.mat('#ff8a3a', 0.8)); col.position.copy(tgt).setY(7); G.fx.add(col, 0.5, (u, o) => { o.scale.set(1 - u * 0.3, 1 + u, 1 - u * 0.3); o.material.opacity = 0.8 * (1 - u); });
          for (const e of G.enemiesOf(f)) if (flat(e.pos, tgt) < 3.6 && e.pos.y < 2.5) G.damage(f, e, 16, { kind: 'aoe', launch: 9, kb: 3, stun: 0.5, ignoreBarrier: true, noPassive: true, dir: V(0, 0, 1) }); G.breakScenery(tgt, 5); }); } } });

  // ---- 8. Tidewalker Horizon (Rare): waves of aquatic shikigami ----
  dom('beach', { name: 'Tidewalker Horizon', sub: 'The tide answers', icon: '🌊', color: '#2fb4ff', r: 'R', dur: 12, env: ENV.beach,
    desc: 'The arena becomes a sunset beach. Waves of aquatic shikigami sweep across the sand along telegraphed lanes — cross them and you are carried away.',
    intro(G, f, u) { if (Math.random() < 0.5) G.fx.burst(f.pos.clone().add(V(rand(-10, 10), 0.4, rand(-10, 10))), '#bfe8ff', 8, 8, 0.6, 0.7); },
    start(G, f, E) { E.w = 0.4; },
    tick(G, f, dt, E) { E.w -= dt; if (E.w <= 0) { E.w = rand(1.1, 1.7) * (1 - 0.04 * (f.dmL || 0)); const es = G.enemiesOf(f); const base = es.length ? es[Math.floor(rand(0, es.length))].pos.clone() : f.pos.clone(); const ang = rand(0, 6.283), d = V(Math.cos(ang), 0, Math.sin(ang)), side = V(-d.z, 0, d.x); const a = base.clone().addScaledVector(d, -30), b = base.clone().addScaledVector(d, 30); telegraphLine(G, a, b, '#bfe8ff', 0.9, 7);
        G.later(0.9, () => { G.sfx('summon'); const fishes = []; const ws = new THREE.Group(); const wm = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 1.4), G.fx.mat('#3ab8ff', 0.55)); wm.position.y = 1.7; ws.add(wm); for (let i = 0; i < 9; i++) { const fs = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 6), ST('#cfeaff', 0.3, 0.2, { emissive: new THREE.Color('#2a8ae0'), emissiveIntensity: 0.6 })); fs.rotation.x = Math.PI / 2; fs.position.set(-3 + (i % 3) * 3, 0.8 + Math.floor(i / 3) * 0.9, 0.2); ws.add(fs); fishes.push(fs); } ws.position.copy(a); ws.rotation.y = Math.atan2(d.x, d.z); G.scene.add(ws); const hit = new Set(); let tt = 0;
          G.every(0.016, 1.8, (dt2) => { tt += dt2; ws.position.copy(a).addScaledVector(d, tt * 36); fishes.forEach((fs, i) => { fs.position.y = 1 + Math.sin(tt * 10 + i) * 0.4; }); if (Math.random() < 0.8) G.fx.emit(ws.position.clone().add(V(rand(-3, 3), rand(0.5, 3), 0)), d.clone().multiplyScalar(6), '#ffffff', 0.5, 0.5, { drag: 2 });
            for (const e of G.enemiesOf(f)) { if (hit.has(e)) continue; const dd = Math.abs((e.pos.x - ws.position.x) * d.x + (e.pos.z - ws.position.z) * d.z), pp = Math.abs((e.pos.x - base.x) * side.x + (e.pos.z - base.z) * side.z); if (dd < 2.2 && pp < 3.8 && e.pos.y < 2.5) { hit.add(e); G.damage(f, e, 12 * (1 + 0.06 * (f.dmL || 0)), { kind: 'aoe', kb: 16, launch: 5, stun: 0.5, dir: d.clone(), ignoreBarrier: true, noPassive: true }); G.fx.burst(chestOf(e), '#bfe8ff', 20, 10, 0.6, 0.5); } } if (tt >= 1.75) { G.scene.remove(ws); } }); }); } } });

  // ---- 9. Clockwork Prism Court (Legendary): enemies slowed, you speed up ----
  dom('palace', { name: 'Clockwork Prism Court', sub: 'Time bends to the crown', icon: '⏳', color: '#ffd060', r: 'L', dur: 12, env: ENV.palace,
    desc: 'A geometric palace. Everyone else moves noticeably slower; you gain much greater movement and attack speed.',
    intro(G, f, u) { if (Math.random() < 0.5) G.fx.ring(f.pos.clone().setY(1 + rand(0, 3)), '#ffd060', 1, 9, 0.8, false); },
    start(G, f, E) { f.fast = true; f.speedMul *= 1.45; G.callout(f, 'TIME DILATION', '#ffd060', 1.4); },
    tick(G, f, dt, E) { for (const e of G.enemiesOf(f)) { e.slowT = 0.25 - 0.014 * (f.dmL || 0); e.slowAct = true; } if (Math.random() < dt * 20) G.fx.emit(chestOf(f, rand(0, 2.2)), V(0, 0, 0), '#ffd060', 0.6, 0.4, { drag: 3 }); },
    end(G, f, E) { f.fast = false; f.speedMul /= 1.45; for (const e of G.fighters) e.slowAct = false; } });


  // ---- 10. Hollow Eclipse Cathedral (Legendary) ----
  dom('eclipse', { name: 'Hollow Eclipse Cathedral', sub: 'The black sun judges', icon: '🌑', color: '#ffb050', r: 'L', dur: 14, env: ENV.eclipse,
    desc: 'A cathedral under a black sun. Everyone else is blinded and slowed while prismatic stained-glass beams sweep the nave for heavy sure damage. You move far faster.',
    intro(G, f, u) { if (Math.random() < 0.6) G.fx.ring(f.pos.clone().setY(0.2 + rand(0, 5)), '#ffb050', 1, 14, 0.8, false); },
    start(G, f, E) { f.speedMul *= 1.35; E.b = 0.5; G.callout(f, 'THE SUN GOES DARK', '#ffb050', 1.4); },
    tick(G, f, dt, E) { for (const e of G.enemiesOf(f)) { e.slowT = 0.25; e.slowAct = true; } E.b -= dt; if (E.b <= 0) { E.b = rand(0.8, 1.25) * (1 - 0.04 * (f.dmL || 0)); const es = G.enemiesOf(f); const ang = rand(0, 6.283); const base = es.length ? es[Math.floor(rand(0, es.length))].pos.clone() : f.pos.clone(); const d = V(Math.cos(ang), 0, Math.sin(ang)); const a = base.clone().addScaledVector(d, -30), b = base.clone().addScaledVector(d, 30); telegraphLine(G, a, b, '#ffc070', 0.8, 4.2);
        G.later(0.8, () => { G.sfx('laser'); G.shake(0.5); const col = pick(['#ff7050', '#ffd050', '#70d0ff', '#c070ff']); G.fx.beam(a.clone().setY(1.5), b.clone().setY(1.5), col, 1.6, 0.35); G.fx.beam(a.clone().setY(1.5), b.clone().setY(1.5), '#ffffff', 0.6, 0.3); for (let i = 0; i < 10; i++) { const p = a.clone().lerp(b, i / 9); G.fx.burst(p.setY(0.5), col, 5, 9, 0.5, 0.5); G.fx.crack(p, 2.4, col, 4); }
          for (const e of G.enemiesOf(f)) if (segHit(e.pos, a, b) < 2.4 && e.pos.y < 3) G.damage(f, e, 26 * (1 + 0.06 * (f.dmL || 0)), { kind: 'status', kb: 10, launch: 6, stun: 0.7, unblockable: true, ignoreBarrier: true, noPassive: true, dir: d.clone() }); }); } },
    end(G, f, E) { f.speedMul /= 1.35; for (const e of G.fighters) e.slowAct = false; } });

  // ---- 11. Crimson Moon Abattoir (Legendary) ----
  dom('abattoir', { name: 'Crimson Moon Abattoir', sub: 'Hung beneath the red moon', icon: '🩸', color: '#ff3050', r: 'L', dur: 14, env: ENV.abattoir,
    desc: 'An iron slaughterhouse beneath a blood moon. Chains erupt from the floor to bind everyone else in place, then drag them to you for a brutal finishing strike.',
    intro(G, f, u) { if (Math.random() < 0.6) G.fx.burst(f.pos.clone().add(V(rand(-14, 14), 0.4, rand(-14, 14))), '#ff3050', 8, 12, 0.7, 0.7, { lift: 8 }); },
    start(G, f, E) { E.c = 0.8; },
    tick(G, f, dt, E) { E.c -= dt; if (E.c <= 0) { E.c = 2.0 - 0.1 * (f.dmL || 0); for (const e of G.enemiesOf(f)) { const p = e.pos.clone(); pulseWarn(G, p, 3.2, '#ff3050', 0.8); G.later(0.8, () => { if (e.dead) return; G.sfx('thud'); G.shake(0.5); e.root = Math.max(e.root, 1.6); e.freeze = Math.max(e.freeze, 1.0); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 5), ST('#222', 0.4, 0.9)); ch.position.copy(p).add(V(Math.cos(a) * 1.1, 2.2, Math.sin(a) * 1.1)); ch.rotation.z = Math.cos(a) * 0.35; ch.rotation.x = -Math.sin(a) * 0.35; G.scene.add(ch); G.fx.add(ch, 1.6, (u, o) => { if (u > 0.97) G.scene.remove(o); }); } G.fx.burst(p.clone().setY(0.5), '#ff3050', 22, 12, 0.7, 0.6); G.fx.shock(p, '#ff3050', 4, 0.4);
          G.damage(f, e, 14, { kind: 'status', noKb: true, unblockable: true, ignoreBarrier: true, noPassive: true });
          G.later(0.9, () => { if (e.dead || f.dead) return; const d = f.pos.clone().sub(e.pos).setY(0); const L = d.length(); d.normalize(); G.fx.beam(chestOf(e), chestOf(f), '#ff3050', 0.5, 0.3); e.pos.copy(f.pos.clone().addScaledVector(d, -2.8).setY(e.pos.y)); e.root = 0; G.later(0.2, () => { if (e.dead) return; G.sfx('hit'); G.shake(0.7); G.fx.slash(chestOf(e), f.yaw, '#ff3050', 8, 0.5, 0.35); G.damage(f, e, 38 * (1 + 0.06 * (f.dmL || 0)), { kind: 'status', kb: 14, launch: 7, stun: 0.9, unblockable: true, ignoreBarrier: true, noPassive: true, dir: d.clone().negate() }); }); }); }); } } } });

  // ---- 12. Starfall Observatory (Legendary) ----
  dom('observatory', { name: 'Starfall Observatory', sub: 'Every star has a name — and an address', icon: '☄', color: '#7ab8ff', r: 'L', dur: 14, env: ENV.observatory,
    desc: 'An orrery under a glass dome. Meteors rain on telegraphed circles, each hit launching its victims. You are untouched by the falling stars.',
    intro(G, f, u) { if (Math.random() < 0.7) { const p = f.pos.clone().add(V(rand(-14, 14), 0, rand(-14, 14))); G.fx.bolt(p.clone().setY(30), p, '#7ab8ff', 0.2, 0.1); } },
    start(G, f, E) { E.m = 0.3; },
    tick(G, f, dt, E) { E.m -= dt; if (E.m <= 0) { E.m = rand(0.22, 0.45) * (1 - 0.04 * (f.dmL || 0)); const es = G.enemiesOf(f); const tgt = es.length && Math.random() < 0.7 ? es[Math.floor(rand(0, es.length))].pos.clone().add(V(rand(-2, 2), 0, rand(-2, 2))) : V(rand(-28, 28), 0, rand(-28, 28)); pulseWarn(G, tgt, 4, '#7ab8ff', 0.75);
        const mt = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), EM('#bfe0ff', 2)); mt.position.copy(tgt).add(V(rand(-8, 8), 40, rand(-8, 8))); G.scene.add(mt); const from = mt.position.clone(); G.fx.add(mt, 0.75, (u, o) => { o.position.copy(from).lerp(tgt, u * u); G.fx.emit(o.position.clone(), V(0, 0, 0), '#7ab8ff', 0.7, 0.4, { drag: 3 }); if (u > 0.97) G.scene.remove(o); });
        G.later(0.75, () => { G.sfx('boom'); G.shake(0.5); G.fx.shock(tgt, '#7ab8ff', 6, 0.45); G.fx.flash(tgt.clone().setY(1), '#ffffff', 7, 0.2); G.fx.crack(tgt, 4.2, '#7ab8ff', 6); G.fx.debris(tgt.clone().setY(0.4), '#445', 10, 12); G.fx.burst(tgt.clone().setY(0.6), '#bfe0ff', 20, 16, 0.7, 0.6); for (const e of G.enemiesOf(f)) if (flat(e.pos, tgt) < 4 && e.pos.y < 3) G.damage(f, e, 24 * (1 + 0.06 * (f.dmL || 0)), { kind: 'aoe', launch: 9, kb: 6, stun: 0.6, ignoreBarrier: true, noPassive: true, dir: V(0, 0, 1) }); }); } } });

  // ---- 13. Frozen Sepulcher (Epic) ----
  dom('glacier', { name: 'Frozen Sepulcher', sub: 'Winter keeps what it takes', icon: '🧊', color: '#9fe8ff', r: 'E', dur: 13, env: ENV.glacier,
    desc: 'A glacial cavern. Cold stacks on everyone else — slowing them, then freezing them solid for a free window of heavy damage.',
    intro(G, f, u) { if (Math.random() < 0.6) G.fx.burst(f.pos.clone().add(V(rand(-12, 12), 0.4, rand(-12, 12))), '#d8f6ff', 8, 8, 0.6, 0.8); },
    start(G, f, E) { E.s = new Map(); E.a = 0; },
    tick(G, f, dt, E) { E.a += dt; if (E.a > 1) { E.a = 0; for (const e of G.enemiesOf(f)) { const n = (E.s.get(e) || 0) + 1; E.s.set(e, n); G.fx.ring(chestOf(e), '#9fe8ff', 0.3, 2.4, 0.4, false); if (n >= ((f.dmL || 0) >= 5 ? 2 : 3)) { E.s.set(e, 0); e.freeze = Math.max(e.freeze, 1.8 + 0.1 * (f.dmL || 0)); e.root = Math.max(e.root, 1.8 + 0.1 * (f.dmL || 0)); G.sfx('ice'); G.fx.burst(chestOf(e), '#d8f6ff', 40, 14, 0.8, 0.9); for (let k = 0; k < 7; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.5, rand(2, 3.5), 5), new THREE.MeshStandardMaterial({ color: '#bff4ff', emissive: new THREE.Color('#3aa8d8'), emissiveIntensity: 0.6, roughness: 0.1 })); sp.position.copy(e.pos).add(V(rand(-1.2, 1.2), 1, rand(-1.2, 1.2))); sp.rotation.set(rand(-0.4, 0.4), 0, rand(-0.4, 0.4)); G.scene.add(sp); G.fx.add(sp, 1.9, (u, o) => { if (u > 0.97) G.scene.remove(o); }); } G.later(1.7, () => { if (e.dead || f.dead) return; G.damage(f, e, 34, { kind: 'status', kb: 10, launch: 7, stun: 0.8, unblockable: true, ignoreBarrier: true, noPassive: true, dir: V(0, 0, 1) }); G.fx.shock(e.pos.clone(), '#9fe8ff', 6, 0.5); }); } else { e.slowT = 1.0; e.slowAct = true; } } }
      E.er = (E.er ?? 1) - dt; if (E.er <= 0) { E.er = 1.1; const es = G.enemiesOf(f); const tgt = es.length ? es[Math.floor(rand(0, es.length))].pos.clone() : V(rand(-20, 20), 0, rand(-20, 20)); pulseWarn(G, tgt, 3, '#9fe8ff', 0.7); G.later(0.7, () => { G.sfx('ice'); G.fx.burst(tgt.clone().setY(0.6), '#d8f6ff', 20, 14, 0.7, 0.6, { lift: 10 }); G.fx.crack(tgt, 3, '#9fe8ff', 5); for (const e of G.enemiesOf(f)) if (flat(e.pos, tgt) < 3 && e.pos.y < 3) G.damage(f, e, 18, { kind: 'aoe', launch: 8, stun: 0.5, ignoreBarrier: true, noPassive: true, dir: V(0, 0, 1) }); }); } },
    end(G, f, E) { for (const e of G.fighters) e.slowAct = false; } });

  // ---- 14. Thunderhead Colosseum (Epic) ----
  dom('colosseum', { name: 'Thunderhead Colosseum', sub: 'The crowd is the storm', icon: '🏟', color: '#ffe060', r: 'E', dur: 13, env: ENV.colosseum,
    desc: 'A storm-wrapped colosseum. Continuous lightning hunts everyone else; you are charged with haste and strike harder.',
    intro(G, f, u) { if (Math.random() < 0.7) { const p = f.pos.clone().add(V(rand(-16, 16), 0, rand(-16, 16))); G.fx.bolt(p.clone().setY(40), p, '#ffe060', 0.25, 0.12); } },
    start(G, f, E) { f.speedMul *= 1.3; E.l = 0.3; G.callout(f, 'CROWD ROARS', '#ffe060', 1.2); },
    tick(G, f, dt, E) { E.l -= dt; if (E.l <= 0) { E.l = rand(0.3, 0.55) * (1 - 0.04 * (f.dmL || 0)); const es = G.enemiesOf(f); const tgt = es.length ? es[Math.floor(rand(0, es.length))].pos.clone().add(V(rand(-1.5, 1.5), 0, rand(-1.5, 1.5))) : V(rand(-26, 26), 0, rand(-26, 26)); pulseWarn(G, tgt, 2.6, '#ffe060', 0.45);
        G.later(0.45, () => { G.sfx('zap'); G.shake(0.35); G.fx.bolt(tgt.clone().setY(45), tgt, '#ffe060', 0.3, 0.2); G.fx.bolt(tgt.clone().setY(45).add(V(2, 0, 0)), tgt, '#ffffff', 0.2, 0.15); G.fx.flash(tgt.clone().setY(1), '#ffffff', 6, 0.15); G.fx.shock(tgt, '#ffe060', 3.6, 0.3); G.fx.crack(tgt, 2.6, '#ffe060', 5); G.fx.sparks(tgt.clone().setY(0.5), '#fff2b0', 20, 16, 0.4); for (const e of G.enemiesOf(f)) if (flat(e.pos, tgt) < 2.6 && e.pos.y < 3) G.damage(f, e, 21 * (1 + 0.06 * (f.dmL || 0)), { kind: 'aoe', launch: 5, stun: 0.55, ignoreBarrier: true, noPassive: true, dir: V(0, 0, 1) }); }); } },
    end(G, f, E) { f.speedMul /= 1.3; } });

  /* ===================== ULTIMATES (Legendary) ===================== */
  // Violet Convergence — wind-up, fuse two orbs, piercing beam that wrecks scenery
  def({ id: 'purple', slot: 'um', ultimate: true, name: 'Violet Convergence', r: 'L', icon: '🟣', color: '#b060ff', ultCost: 100, desc: 'Fuse two opposing energies into a violet sphere, charge, and fire a devastating long straight beam. The wind-up is long and obvious — dodge it. Needs no other technique.',
    cast(f, G) { f.lock = 2.0; f.castWarn = 2.0; f.slowT = 2.0; f.castAnim = 2.0; const F = fwdOf(f); G.callout(f, 'VIOLET CONVERGENCE', '#b060ff', 2, true); G.sfx('power'); G.slowmo(0.45, 0.35);
      const org = () => chestOf(f, 1.7).addScaledVector(F, 1.9); const cs = [new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), EM('#3a8aff', 2.6)), new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), EM('#ff3a5a', 2.6))]; cs.forEach(c => G.scene.add(c)); const core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), EM('#c070ff', 3)); core.visible = false; G.scene.add(core); let t = 0;
      const a = f.pos.clone(); const b = a.clone().addScaledVector(F, 70); telegraphLine(G, a, b, '#b060ff', 1.9, 4.5);
      const iv = G.every(0.016, 2.0, (dt) => { t += dt; const p = org(); if (f.stun > 0 || f.dead) { iv.stop(); cs.forEach(c => G.scene.remove(c)); G.scene.remove(core); return; } if (t < 1.0) { const ang = t * 7, r = lerp(2.2, 0.15, t); cs[0].position.copy(p).add(V(Math.cos(ang) * r * -F.z - 0, Math.sin(ang) * r, Math.cos(ang) * r * F.x)); cs[1].position.copy(p).add(V(-Math.cos(ang) * r * -F.z, -Math.sin(ang) * r, -Math.cos(ang) * r * F.x)); G.fx.emit(cs[0].position, V(0, 0, 0), '#3a8aff', 0.5, 0.3, { drag: 3 }); G.fx.emit(cs[1].position, V(0, 0, 0), '#ff3a5a', 0.5, 0.3, { drag: 3 }); } else { cs.forEach(c => c.visible = false); core.visible = true; core.position.copy(p); const s = lerp(0.4, 1.6, (t - 1) / 1.0); core.scale.setScalar(s); for (let i = 0; i < 3; i++) G.fx.emit(p.clone().add(V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(s * 2)), V(0, 0, 0), '#c070ff', 0.7, 0.3, { drag: 4, end: 0 }); G.shake(0.05 + t * 0.06); } });
      G.later(2.0, () => { cs.forEach(c => G.scene.remove(c)); G.scene.remove(core); if (f.dead || f.stun > 0) return; G.sfx('laser'); G.sfx('boom'); G.shake(1.2); G.aberr(1.2); G.slowmo(0.35, 0.3); const d = fwdOf(f), o = chestOf(f, 1.7).addScaledVector(d, 1.9);
        const L = 70; const bm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), G.fx.mat('#b060ff', 0.9)); const bc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), G.fx.mat('#ffffff', 1)); bm.position.copy(o).addScaledVector(d, L / 2); bm.quaternion.setFromUnitVectors(V(0, 1, 0), d); bc.position.copy(bm.position); bc.quaternion.copy(bm.quaternion); G.fx.add(bm, 0.8, (u, ob) => { const w = 2.8 * (1 - u * u); ob.scale.set(w, L, w); ob.material.opacity = 0.85 * (1 - u); }); G.fx.add(bc, 0.8, (u, ob) => { const w = 1.2 * (1 - u * u); ob.scale.set(w, L, w); ob.material.opacity = 1 - u; });
        G.fx.flash(o, '#e0b0ff', 9, 0.3); G.fx.shock(f.pos.clone(), '#b060ff', 10, 0.5); for (let i = 0; i < 16; i++) { const p = f.pos.clone().addScaledVector(d, 3 + i * 4.2); G.later(i * 0.025, () => { G.fx.crack(p, 3.5, '#b060ff', 8); G.fx.debris(p.clone().setY(0.5), '#7a6a58', 4, 12); G.fx.burst(p.clone().setY(0.6), '#c070ff', 6, 8, 0.6, 0.6); G.breakScenery(p, 4.2); }); }
        for (const e of G.enemiesOf(f)) { const v = e.pos.clone().sub(f.pos); const along = v.x * d.x + v.z * d.z; const perp = Math.abs(v.x * d.z - v.z * d.x); if (along > 0 && along < L && perp < 3.2) G.damage(f, e, 55, { kind: 'status', kb: 22, launch: 8, stun: 1.2, unblockable: true, ignoreBarrier: true, noPassive: true, dir: d.clone() }); } }); return true; } });

  // Bound Spirit Beam — requires Phantom Guardian equipped (Shikigami slot)
  def({ id: 'rika', slot: 'um', ultimate: true, name: 'Bound Spirit Beam', r: 'L', icon: '👻', color: '#e8f0ff', ultCost: 100, desc: 'Requires Phantom Guardian equipped. The guardian fully manifests, pins an opponent in place, and you charge a massive cursed-energy beam together.',
    cast(f, G) { const t = G.nearestEnemy(f); if (!t) return false; f.lock = 2.6; f.castWarn = 2.6; f.castAnim = 2.6; G.callout(f, 'BOUND SPIRIT BEAM', '#e8f0ff', 2, true); G.sfx('summon'); G.slowmo(0.45, 0.35);
      const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: '#dfe8ff', roughness: 0.3, emissive: new THREE.Color('#9ab8ff'), emissiveIntensity: 0.7, transparent: true, opacity: 0.8 }); const bx = (w, h, d, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me; }; bx(3, 4, 1.8, 0, 6, 0); bx(2, 2, 2, 0, 9, 0); bx(1, 4.4, 1, -2.4, 6.4, 0.5).rotation.x = -1.2; bx(1, 4.4, 1, 2.4, 6.4, 0.5).rotation.x = -1.2; bx(1.2, 4, 1.2, -0.9, 2, 0); bx(1.2, 4, 1.2, 0.9, 2, 0);
      g.position.copy(f.pos).addScaledVector(V(Math.sin(f.yaw), 0, Math.cos(f.yaw)), -3); g.rotation.y = f.yaw; G.scene.add(g); G.fx.ring(g.position.clone().setY(0.2), '#e8f0ff', 0.5, 9, 0.6); t.root = 2.7; t.freeze = Math.max(t.freeze, 2.6); let tt = 0;
      const iv = G.every(0.016, 2.6, (dt) => { tt += dt; const v = t.pos.clone().sub(g.position); v.y = 0; if (tt < 0.5) g.position.addScaledVector(v.normalize(), 22 * dt); g.rotation.y = Math.atan2(t.pos.x - g.position.x, t.pos.z - g.position.z); if (tt > 0.4) { t.vel.set(0, 0, 0); G.fx.beam(g.position.clone().add(V(0, 6.4, 0)), chestOf(t), '#e8f0ff', 0.1, 0.05); } G.fx.orb(chestOf(f, 1.8).addScaledVector(V(Math.sin(f.yaw), 0, Math.cos(f.yaw)), 1.6), '#e8f0ff', 0.1 + tt * 0.5, 0.2 + tt * 0.6, 0.05); G.shake(0.04 + tt * 0.05); if (f.stun > 0 || f.dead) { iv.stop(); G.scene.remove(g); t.root = 0; } });
      G.later(2.6, () => { G.scene.remove(g); if (f.dead || f.stun > 0 || t.dead) return; G.sfx('laser'); G.sfx('boom'); G.shake(1.2); G.aberr(1.2); const d = t.pos.clone().sub(f.pos).setY(0).normalize(); f.yaw = Math.atan2(d.x, d.z); const o = chestOf(f, 1.7).addScaledVector(d, 1.5), e2 = t.pos.clone().addScaledVector(d, 30).setY(o.y);
        const L = o.distanceTo(e2); const bm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), G.fx.mat('#cfe0ff', 0.9)); bm.position.copy(o).lerp(e2, 0.5); bm.quaternion.setFromUnitVectors(V(0, 1, 0), e2.clone().sub(o).normalize()); G.fx.add(bm, 0.8, (u, ob) => { const w = 3.2 * (1 - u * u); ob.scale.set(w, L, w); ob.material.opacity = 0.9 * (1 - u); }); G.fx.flash(o, '#ffffff', 9, 0.3); G.fx.shock(t.pos.clone(), '#cfe0ff', 9, 0.5);
        for (const e of G.enemiesOf(f)) { const v = e.pos.clone().sub(f.pos); const along = v.x * d.x + v.z * d.z, perp = Math.abs(v.x * d.z - v.z * d.x); if (along > 0 && perp < 3.4) G.damage(f, e, e === t ? 70 : 40, { kind: 'status', kb: 20, launch: 8, stun: 1.2, unblockable: true, ignoreBarrier: true, noPassive: true, dir: d.clone() }); } for (let i = 0; i < 12; i++) G.breakScenery(f.pos.clone().addScaledVector(d, 4 + i * 4), 4); }); return true; } });

  // Storm Discharge — requires Thunder Form equipped (Active slot)
  def({ id: 'storm', slot: 'um', ultimate: true, name: 'Storm Discharge', r: 'L', icon: '🌩', color: '#9bd0ff', ultCost: 100, desc: 'Requires Thunder Form equipped. The battlefield fills with lightning in a rapid barrage, ending in a massive discharge around you.',
    cast(f, G) { f.lock = 1.2; f.castAnim = 3.6; f.invuln = Math.max(f.invuln, 1.0); G.callout(f, 'STORM DISCHARGE', '#9bd0ff', 2, true); G.sfx('zap'); G.slowmo(0.45, 0.3); const c = f.pos.clone();
      let n = 0; const iv = G.every(0.09, 3.4, () => { n++; const es = G.enemiesOf(f); const p = (es.length && Math.random() < 0.55) ? es[Math.floor(rand(0, es.length))].pos.clone().add(V(rand(-2, 2), 0, rand(-2, 2))) : c.clone().add(V(rand(-24, 24), 0, rand(-24, 24))); pulseWarn(G, p, 2.2, '#9bd0ff', 0.35);
        G.later(0.35, () => { G.sfx('zap'); G.fx.bolt(p.clone().setY(40), p, '#9bd0ff', 0.25, 0.22); G.fx.flash(p.clone().setY(1), '#ffffff', 4, 0.15); G.fx.shock(p, '#9bd0ff', 3.5, 0.3); G.fx.crack(p, 2.4, '#9bd0ff', 5); G.fx.sparks(p.clone().setY(0.5), '#cfe8ff', 16, 14, 0.35); G.shake(0.2); for (const e of G.enemiesOf(f)) if (flat(e.pos, p) < 2.4 && e.pos.y < 3) G.damage(f, e, 9, { kind: 'status', stun: 0.35, kb: 4, unblockable: true, ignoreBarrier: true, noPassive: true }); G.breakScenery(p, 2.4); }); });
      G.later(3.6, () => { if (f.dead) return; G.sfx('boom'); G.sfx('zap'); G.shake(1.4); G.aberr(1.4); G.fx.shock(f.pos.clone(), '#ffffff', 18, 0.7); G.fx.orb(chestOf(f, 1.2), '#cfe8ff', 1, 14, 0.5); for (let i = 0; i < 14; i++) G.fx.bolt(chestOf(f, 1.2), chestOf(f, 1.2).add(V(rand(-16, 16), rand(-1, 8), rand(-16, 16))), '#9bd0ff', 0.3, 0.16); G.aoe(f, f.pos, 16, 38, { kb: 24, launch: 12, kind: 'aoe', stun: 1.2, ignoreBarrier: true, unblockable: true }); G.breakScenery(f.pos, 16); }); return true; } });

  // Gravity Singularity — requires Shove Nova (Active slot). Big drawback: exhaustion + vulnerability
  def({ id: 'blackhole', slot: 'um', ultimate: true, name: 'Gravity Singularity', r: 'L', icon: '⚫', color: '#a070ff', ultCost: 100, desc: 'Requires Shove Nova equipped. Gather mass into a visible black hole that drags enemies in and crushes them — but afterward you are drained, locked and take extra damage.',
    cast(f, G) { f.lock = 1.5; f.castAnim = 1.5; G.callout(f, 'GRAVITY SINGULARITY', '#a070ff', 2, true); G.sfx('power'); G.slowmo(0.5, 0.3);
      const c = f.pos.clone().addScaledVector(fwdOf(f), 9).setY(3.4); pulseWarn(G, c.clone().setY(0), 18, '#a070ff', 1.5); const core = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshBasicMaterial({ color: '#000000' })); core.position.copy(c); G.scene.add(core); const disk = new THREE.Mesh(new THREE.RingGeometry(1.4, 4.5, 56), G.fx.mat('#c090ff', 0.9)); disk.position.copy(c); disk.rotation.x = 1.2; G.scene.add(disk); let tt = 0;
      const iv = G.every(0.016, 5.0, (dt) => { tt += dt; const grow = clamp(tt / 1.5, 0, 1); const R = 1.6 + grow * 2.2; core.scale.setScalar(R); disk.scale.setScalar(grow * 1.4 + 0.2); disk.rotation.z += dt * 5; for (let i = 0; i < 4; i++) { const a = rand(0, 6.283), r = rand(7, 16) * grow + 1; G.fx.emit(c.clone().add(V(Math.cos(a) * r, rand(-3, 3), Math.sin(a) * r)), V(-Math.cos(a) * 14, 0, -Math.sin(a) * 14), pick(['#a070ff', '#ffffff', '#6a3aff']), 0.5, 0.7, { drag: 0.5 }); } if (tt < 1.5) { G.shake(0.05 + tt * 0.1); return; } if (tt > 1.5 && tt - dt <= 1.5) { G.sfx('boom'); G.shake(0.8); }
        for (const e of G.enemiesOf(f)) { const v = c.clone().setY(e.pos.y).sub(e.pos); const dist = v.length(); if (dist < 18) { v.normalize(); e.pos.addScaledVector(v, (16 - dist * 0.5) * dt); e.vel.set(0, e.vel.y, 0); if (dist < 4.5) { e.acc2 = (e.acc2 || 0) + dt; if (e.acc2 > 0.2) { e.acc2 = 0; G.damage(f, e, 5, { kind: 'status', noKb: true, ignoreBarrier: true, noPassive: true, unblockable: true }); } } } } });
      G.later(6.6, () => { iv.stop(); G.scene.remove(core); G.scene.remove(disk); G.sfx('boom'); G.shake(1.2); G.aberr(1.2); G.fx.shock(c.clone().setY(0), '#a070ff', 16, 0.6); G.fx.orb(c, '#a070ff', 3, 12, 0.5); G.aoe(f, c, 10, 30, { kb: 22, launch: 10, kind: 'aoe', stun: 0.9, ignoreBarrier: true, unblockable: true }); G.breakScenery(c, 14);
        f.ce = 0; f.lock = Math.max(f.lock, 2.2); f.stun = Math.max(f.stun, 1.0); f.vuln = 8; G.callout(f, 'EXHAUSTED', '#a070ff', 1.4); }); return true; } });

  // Cursed Cyclone Cannon — standalone, strongest against grouped opponents
  def({ id: 'spiral', slot: 'um', ultimate: true, name: 'Cursed Cyclone Cannon', r: 'L', icon: '🌀', color: '#7affc0', ultCost: 100, desc: 'Standalone. Gather cursed spirits into a swirling mass, condense it into a gigantic beam and fire. Enormous damage — especially to grouped opponents.',
    cast(f, G) { f.lock = 2.2; f.castAnim = 2.2; f.castWarn = 2.2; f.slowT = 2.2; G.callout(f, 'CURSED CYCLONE CANNON', '#7affc0', 2, true); G.sfx('power'); G.slowmo(0.45, 0.3); const F = fwdOf(f); const org = () => chestOf(f, 1.5).addScaledVector(F, 2.2); let t = 0; const a = f.pos.clone(), b = a.clone().addScaledVector(F, 60); telegraphLine(G, a, b, '#7affc0', 2.0, 7);
      const iv = G.every(0.016, 2.2, (dt) => { t += dt; if (f.stun > 0 || f.dead) { iv.stop(); return; } const c = org(); for (let i = 0; i < 9; i++) { const ang = rand(0, 6.283), r = rand(3, 11) * (1 - t / 2.4) + 0.6; const p = c.clone().add(V(Math.cos(ang) * r, rand(-2, 2), Math.sin(ang) * r)); G.fx.emit(p, V(-Math.cos(ang + 1.2) * 10 + (c.x - p.x) * 2, (c.y - p.y) * 2, -Math.sin(ang + 1.2) * 10 + (c.z - p.z) * 2), pick(['#7affc0', '#1a1a22', '#ffffff']), 0.55, 0.5, { drag: 1 }); } G.fx.orb(c, '#7affc0', 0.3 + t * 0.4, 0.5 + t * 0.7, 0.04); G.shake(0.04 + t * 0.07); });
      G.later(2.2, () => { if (f.dead || f.stun > 0) return; G.sfx('laser'); G.sfx('boom'); G.shake(1.3); G.aberr(1.3); const d = fwdOf(f), o = org(); const L = 64; const bm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 22, 1, true), G.fx.mat('#7affc0', 0.9)); const bc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), G.fx.mat('#ffffff', 1)); bm.position.copy(o).addScaledVector(d, L / 2); bm.quaternion.setFromUnitVectors(V(0, 1, 0), d); bc.position.copy(bm.position); bc.quaternion.copy(bm.quaternion); G.fx.add(bm, 0.9, (u, ob) => { const w = 4.6 * (1 - u * u); ob.scale.set(w, L, w); ob.material.opacity = 0.85 * (1 - u); }); G.fx.add(bc, 0.9, (u, ob) => { const w = 2.0 * (1 - u * u); ob.scale.set(w, L, w); ob.material.opacity = 1 - u; });
        G.fx.flash(o, '#ffffff', 10, 0.3); G.fx.shock(f.pos.clone(), '#7affc0', 12, 0.5); for (let i = 0; i < 14; i++) { const p = f.pos.clone().addScaledVector(d, 3 + i * 4.4); G.later(i * 0.03, () => { G.fx.crack(p, 4, '#7affc0', 8); G.fx.burst(p.clone().setY(0.6), '#7affc0', 6, 10, 0.7, 0.6); G.breakScenery(p, 5); }); }
        const hit = []; for (const e of G.enemiesOf(f)) { const v = e.pos.clone().sub(f.pos); const along = v.x * d.x + v.z * d.z, perp = Math.abs(v.x * d.z - v.z * d.x); if (along > 0 && along < L && perp < 4.2) hit.push(e); } const bonus = Math.max(0, hit.length - 1) * 14; for (const e of hit) G.damage(f, e, 50 + bonus, { kind: 'status', kb: 22, launch: 9, stun: 1.3, unblockable: true, ignoreBarrier: true, noPassive: true, dir: d.clone() }); }); return true; } });
  // ---- Gilded Mirage Dunes (Rare): sand chips enemies, mirages scramble their aim, you gain speed ----
  dom('mirage', { name: 'Gilded Mirage Dunes', sub: 'The sand remembers every step', icon: '🏜', color: '#ffcf70', r: 'R', dur: 12, env: ENV.mirage,
    desc: 'A shimmering desert. Everyone else is scoured by sand and repeatedly thrown into a mirage that scrambles their aim, while you move much faster.',
    intro(G, f, u) { if (Math.random() < 0.5) G.fx.burst(f.pos.clone().add(V(rand(-10, 10), rand(0.3, 3), rand(-10, 10))), '#f0d098', 8, 8, 0.6, 0.7); },
    start(G, f, E) { E.acc = 0; E.mc = 0.6; f.speedMul *= 1.2; },
    tick(G, f, dt, E) { E.acc += dt; if (E.acc > 0.5) { E.acc = 0; for (const e of G.enemiesOf(f)) { G.damage(f, e, 1.8 * (1 + 0.07 * (f.dmL || 0)), { kind: 'status', noKb: true, ignoreBarrier: true, noPassive: true }); G.fx.emit(chestOf(e, rand(0.2, 2)), V(rand(2, 5), 1, 0), '#f0d098', 0.3, 0.5); } }
      E.mc -= dt; if (E.mc <= 0) { E.mc = (2.4 - 0.1 * (f.dmL || 0)); for (const e of G.enemiesOf(f)) { e.confuse = Math.max(e.confuse || 0, 1.6); G.fx.ring(e.pos.clone().setY(1), '#ffe9b0', 0.5, 4, 0.5, false); } if (G.player && f !== G.player && !G.player.dead) G.callout(G.player, 'MIRAGE!', '#ffcf70', 0.8); } },
    end(G, f, E) { f.speedMul /= 1.2; } });

  // ---- Venom Bloom Greenhouse (Epic): poison that heals you, with rooting vines ----
  dom('bloom', { name: 'Venom Bloom Greenhouse', sub: 'Everything here is hungry', icon: '🌺', color: '#8aff6a', r: 'E', dur: 12, env: ENV.bloom,
    desc: 'A toxic greenhouse. Spores poison everyone else and heal you for part of the damage, while vines erupt under enemies to root them.',
    intro(G, f, u) { if (Math.random() < 0.5) G.fx.burst(f.pos.clone().add(V(rand(-8, 8), rand(0.3, 4), rand(-8, 8))), pick(['#b8ff6a', '#ff9ae8']), 8, 7, 0.6, 0.7); },
    start(G, f, E) { E.acc = 0; E.vn = 0.8; },
    tick(G, f, dt, E) { E.acc += dt; if (E.acc > 0.45) { E.acc = 0; let n = 0; for (const e of G.enemiesOf(f)) { const dm = 2.4 * (1 + 0.07 * (f.dmL || 0)); G.damage(f, e, dm, { kind: 'status', noKb: true, ignoreBarrier: true, noPassive: true }); n += dm; G.fx.emit(chestOf(e, rand(0.2, 2)), V(0, 2, 0), '#8aff6a', 0.35, 0.5); } if (n > 0) f.hp = Math.min(f.maxHp, f.hp + n * 0.5); }
      E.vn -= dt; if (E.vn <= 0) { E.vn = rand(1.8, 2.6) * (1 - 0.04 * (f.dmL || 0)); const es = G.enemiesOf(f); if (es.length) { const t = es[Math.floor(rand(0, es.length))], p = t.pos.clone(); pulseWarn(G, p, 2.8, '#8aff6a', 0.6); G.later(0.6, () => { G.sfx('thorn'); G.fx.burst(p.clone().setY(0.5), '#8aff6a', 18, 9, 0.5, 0.6); G.aoe(f, p, 2.8, 8, { root: 1.4, stun: 0.2, kind: 'aoe', ignoreBarrier: true, noPassive: true }); }); } } } });

}

/* ---------- shared detail pass: barrier shell, ground sigil, sky rings, light shafts, motes ---------- */
let _sig = null;
function sigilTex() {
  if (_sig) return _sig;
  _sig = ctex(512, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.translate(w / 2, h / 2); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 4;
    for (const r of [240, 226, 170, 120]) { x.beginPath(); x.arc(0, 0, r, 0, 6.283); x.lineWidth = r > 200 ? 5 : 2.5; x.stroke(); }
    for (let i = 0; i < 72; i++) { const a = i / 72 * 6.283, r0 = 226, r1 = i % 6 ? 234 : 244; x.beginPath(); x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); x.lineWidth = i % 6 ? 2 : 4; x.stroke(); }
    const gl = ['呪', '領', '域', '展', '開', '術', '式', '滅', '縛', '結', '界', '無']; x.font = '900 34px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    gl.forEach((c, i) => { const a = i / gl.length * 6.283; x.save(); x.rotate(a + Math.PI / 2); x.fillText(c, 0, -198); x.restore(); });
    for (const n of [5, 7]) { x.beginPath(); for (let i = 0; i <= n; i++) { const a = (i * 2 / n) * 3.1416 * (n === 5 ? 1 : 1) * 1 - 1.5708 + (n === 7 ? 0.2 : 0); const aa = i * (n === 5 ? 4 : 6) * Math.PI / n - Math.PI / 2; const r = n === 5 ? 166 : 118; x.lineTo(Math.cos(aa) * r, Math.sin(aa) * r); } x.lineWidth = 2.5; x.stroke(); }
    x.beginPath(); x.arc(0, 0, 18, 0, 6.283); x.fill();
  }, 1);
  return _sig;
}
export function detailPass(G, f, E, spec, R) {
  const g = E.group, col = spec.color, c0 = f.pos.clone(); R = R || 30; const upds = [];
  const add = (m) => { g.add(m); return m; };
  // barrier shell seen from inside
  const sh = add(new THREE.Mesh(new THREE.SphereGeometry(R + 14, 48, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6), wireframe: true, transparent: true, opacity: 0.1, side: THREE.BackSide, toneMapped: false, depthWrite: false })));
  const sh2 = add(new THREE.Mesh(new THREE.SphereGeometry(R + 13.5, 40, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.05, side: THREE.BackSide, toneMapped: false, depthWrite: false })));
  sh.position.copy(c0); sh2.position.copy(c0); upds.push((t, dt) => { sh.rotation.y += dt * 0.03; sh.material.opacity = 0.09 + Math.sin(t * 1.3) * 0.03; });
  // ground sigil
  const tex = sigilTex(); const sg = add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(col).multiplyScalar(2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  sg.rotation.x = -Math.PI / 2; sg.position.set(c0.x, 0.09, c0.z); sg.scale.setScalar(Math.min(R * 1.5, 46)); upds.push((t, dt) => { sg.rotation.z += dt * 0.12; sg.material.opacity = 0.62 + Math.sin(t * 2) * 0.14; });
  // sky rings
  const rings = []; for (let k = 0; k < 3; k++) { const r2 = add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(k ? '#ffffff' : col).multiplyScalar(1.6), transparent: true, opacity: 0.35 - k * 0.07, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))); r2.position.set(c0.x, 34 + k * 7, c0.z); r2.rotation.set(-Math.PI / 2 + (k - 1) * 0.35, 0, k * 1.1); r2.scale.setScalar(52 - k * 11); rings.push(r2); }
  upds.push((t, dt) => rings.forEach((r2, i) => { r2.rotation.z += dt * (0.1 + i * 0.06) * (i % 2 ? -1 : 1); }));
  // light shafts
  const shafts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + rand(-0.2, 0.2), r = rand(R * 0.35, R * 1.05); const h = rand(40, 70); const m = add(new THREE.Mesh(new THREE.CylinderGeometry(rand(0.5, 1.2), rand(1.6, 3), h, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.4), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }))); m.position.set(c0.x + Math.cos(a) * r, h / 2, c0.z + Math.sin(a) * r); m.userData.ph = rand(0, 6); shafts.push(m); }
  upds.push((t) => shafts.forEach(m => { m.material.opacity = 0.07 + (Math.sin(t * 1.4 + m.userData.ph) * 0.5 + 0.5) * 0.09; }));
  // drifting motes
  const N = 520, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * (R + 6); pos[i * 3] = c0.x + Math.cos(a) * r; pos[i * 3 + 1] = rand(0.3, 34); pos[i * 3 + 2] = c0.z + Math.sin(a) * r; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = add(new THREE.Points(pg, new THREE.PointsMaterial({ color: new THREE.Color(col).multiplyScalar(2), size: 0.28, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  upds.push((t, dt) => { const p = pg.attributes.position; for (let i = 0; i < N; i++) { let y = p.array[i * 3 + 1] + dt * (0.5 + (i % 7) * 0.15); if (y > 34) y = 0.3; p.array[i * 3 + 1] = y; p.array[i * 3] += Math.sin(t + i) * dt * 0.3; } p.needsUpdate = true; });
  const old = E.upd; E.upd = (t, dt, G2) => { for (const u of upds) u(t, dt); if (old) old(t, dt, G2); };
}

/* mastery perk table: one special aspect per domain, scaling with that domain's mastery level (0-10) */
export const DPERK = {
  shrine: ['Relentless Slashes', 'Sure-slash storm tempo: slashes land up to 50% faster'],
  cosmos: ['Deeper Overload', 'Enemies stay overloaded up to 1.2s longer and chip damage rises up to 90%'],
  garden: ['Shadow Pack', 'Shadow clones strike more often and harder; dash cooldown drops up to 40%'],
  gamble: ['Loaded Dice', 'Jackpot odds climb from 20% to 50%'],
  court: ['Heavy Sentence', 'Executioner\'s Sword lasts up to 6s longer'],
  soulhall: ['Resonant Soul', 'Longer lock-in (+1.5s) and soul strike hits up to 60% harder'],
  volcano: ['Magma Heart', 'Eruptions come up to 40% faster and heat burns up to 70% hotter'],
  beach: ['Rising Tide', 'Waves arrive up to 40% faster and hit up to 60% harder'],
  palace: ['Frozen Hour', 'Enemies are slowed even further (up to 56% slower again)'],
  eclipse: ['Total Eclipse', 'Prismatic beams sweep up to 40% faster and hit 60% harder'],
  abattoir: ['Tighter Chains', 'Chains bind up to 1s sooner and the finisher hits up to 60% harder'],
  observatory: ['Meteor Shower', 'Meteors fall up to 40% faster and hit up to 60% harder'],
  glacier: ['Permafrost', 'Level 5+: freezes after only 2 stacks; freeze lasts up to 1s longer'],
  colosseum: ['Roaring Crowd', 'Lightning strikes up to 40% faster and hits up to 60% harder'],
  mirage: ['Endless Dunes', 'Sand hits up to 70% harder, mirages come up to 40% faster and you run up to 20% faster'],
  bloom: ['Hungry Garden', 'Spores hit up to 70% harder and vines erupt up to 40% faster'],
};
