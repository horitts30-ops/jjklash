import * as THREE from 'three';
import { makeSky, makeLights } from './engine.js';
import { rand, pick } from './fx.js';
import { labelSprite } from './chars.js';

function tex(w, h, draw, rep = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const speck = (x, w, h, n, a) => { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } };
export function stoneTex(base = [150, 140, 128], rep = [8, 8], n = 4) {
  return tex(512, 512, (x, w, h) => {
    const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = rand(-18, 18); x.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; x.fillRect(i * s, j * s, s, s); }
    speck(x, w, h, 6000, 0.12); x.strokeStyle = 'rgba(20,16,12,0.7)'; x.lineWidth = 4;
    for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, h); x.stroke(); x.beginPath(); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke(); }
  }, rep);
}
export function grassTex(rep = [30, 30], a = [60, 110, 50]) {
  return tex(512, 512, (x, w, h) => { x.fillStyle = `rgb(${a})`; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = rand(-25, 25); x.fillStyle = `rgba(${a[0] + v},${a[1] + v * 1.5},${a[2] + v},0.35)`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, rand(4, 18), 0, 7); x.fill(); } speck(x, w, h, 8000, 0.2); }, rep);
}
export function woodTex(base = [110, 72, 42], rep = [1, 1]) {
  return tex(256, 256, (x, w, h) => { x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const v = rand(-25, 20); x.fillStyle = `rgba(${base[0] + v},${base[1] + v},${base[2] + v},0.5)`; x.fillRect(Math.random() * w, 0, rand(1, 4), h); } }, rep);
}
export function roofTex(base = [52, 62, 84], rep = [6, 4]) {
  return tex(256, 256, (x, w, h) => { x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, w, h); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const v = rand(-10, 10); x.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v + 6})`; x.beginPath(); x.arc(i * 32 + (j % 2) * 16, j * 32, 17, 0, Math.PI); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2; x.stroke(); } }, rep);
}
const S = (c, r = 0.85, m = 0, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...e });
const EM = (c, i = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), toneMapped: false });
function add(parent, geo, mat, x = 0, y = 0, z = 0, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; }

function setupScene(scene, cfg) {
  scene.background = new THREE.Color(cfg.fog);
  scene.fog = new THREE.FogExp2(cfg.fog, cfg.fogD);
  const sky = makeSky(cfg.top, cfg.hor, cfg.sunDir, cfg.sunColor, cfg.stars); scene.add(sky);
  const lights = makeLights(scene, cfg);
  scene.userData.sky = sky;
  return lights;
}

// ---------- props ----------
function lantern(parent, x, z, color = '#ffb866', circles) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const st = S('#6d6a66', 0.9);
  add(g, new THREE.BoxGeometry(0.9, 0.25, 0.9), st, 0, 0.12); add(g, new THREE.CylinderGeometry(0.18, 0.24, 1.3, 8), st, 0, 0.9);
  add(g, new THREE.BoxGeometry(0.75, 0.7, 0.75), EM(color, 1.3), 0, 1.85, 0, false);
  add(g, new THREE.ConeGeometry(0.75, 0.45, 4), st, 0, 2.45).rotation.y = Math.PI / 4;
  if (circles) circles.push({ x, z, r: 0.6 });
  return g;
}
function pagoda(parent, x, z, w, d, h, rot = 0, circles) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  const wood = S('#fff', 0.8); wood.map = woodTex([96, 62, 36], [w / 3, 1]);
  const plaster = S('#e9e2d2', 0.95); const dk = S('#3a2a1e', 0.8);
  add(g, new THREE.BoxGeometry(w + 1.2, 0.6, d + 1.2), S('#8a857c', 0.9), 0, 0.3);
  add(g, new THREE.BoxGeometry(w, h, d), plaster, 0, 0.6 + h / 2);
  for (let i = 0; i <= Math.round(w / 3); i++) { const px = -w / 2 + (w / Math.round(w / 3)) * i; for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.4, h, 0.4), wood, px, 0.6 + h / 2, s * d / 2); }
  add(g, new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), wood, 0, 0.6 + h * 0.62); add(g, new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), wood, 0, 0.8 + h);
  const rt = S('#fff', 0.55, 0.15); rt.map = roofTex([48, 58, 80], [w / 4, 3]);
  const roof = add(g, new THREE.ConeGeometry(1, 1, 4), rt, 0, 0.8 + h + 1.9); roof.rotation.y = Math.PI / 4; roof.scale.set((w + 5) * 0.72, 3.8, (d + 5) * 0.72);
  for (let i = 0; i < Math.max(2, Math.round(w / 6)); i++) { const wx = -w / 2 + (i + 0.5) * w / Math.max(2, Math.round(w / 6)); add(g, new THREE.BoxGeometry(2.2, h * 0.5, 0.1), S('#2d3f6a', 0.4), wx, 0.6 + h * 0.4, d / 2 + 0.06, false); }
  add(g, new THREE.BoxGeometry(2.6, h * 0.7, 0.14), dk, 0, 0.6 + h * 0.35, d / 2 + 0.08);
  if (circles) circles.push({ x, z, r: Math.max(w, d) * 0.52 });
  return g;
}
function blossomTree(parent, x, z, scale = 1, circles, instanced = true) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); parent.add(g);
  const bark = S('#4a3328', 0.95);
  const trunk = add(g, new THREE.CylinderGeometry(0.9, 1.5, 5.5, 10), bark, 0, 2.75); trunk.rotation.z = 0.04;
  const branches = [];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + rand(-0.3, 0.3), len = rand(4.5, 6.5), up = rand(0.7, 1.0);
    const b = add(g, new THREE.CylinderGeometry(0.25, 0.5, len, 7), bark, Math.cos(a) * len * 0.25, 5 + up, Math.sin(a) * len * 0.25);
    b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); branches.push({ x: Math.cos(a) * len * 0.5, y: 5.6 + up + len * 0.25, z: Math.sin(a) * len * 0.5 });
  }
  const N = 650, geo = new THREE.IcosahedronGeometry(0.75, 1), mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, emissive: new THREE.Color('#ff9ac0'), emissiveIntensity: 0.15 });
  const im = new THREE.InstancedMesh(geo, mat, N); im.castShadow = im.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), pal = ['#ffc2d6', '#ffa8c5', '#ffd9e6', '#f7b0cc', '#ff8fb5'];
  for (let i = 0; i < N; i++) {
    const b = branches[i % branches.length] || { x: 0, y: 9, z: 0 };
    const p = new THREE.Vector3(b.x + rand(-3.4, 3.4), b.y + rand(-1.4, 3.2), b.z + rand(-3.4, 3.4));
    const s = rand(0.7, 1.6); m4.compose(p, q.setFromEuler(new THREE.Euler(rand(0, 6), rand(0, 6), 0)), new THREE.Vector3(s, s * rand(0.7, 1), s));
    im.setMatrixAt(i, m4); c.set(pick(pal)).multiplyScalar(rand(0.85, 1.1)); im.setColorAt(i, c);
  }
  g.add(im);
  if (circles) circles.push({ x, z, r: 1.7 * scale });
  return g;
}
function pillar(parent, x, z, h = 6, color = '#c9b79a', circles, broken = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const m = S(color, 0.9); const hh = broken ? h * rand(0.45, 0.75) : h;
  add(g, new THREE.CylinderGeometry(1.35, 1.5, 0.5, 14), m, 0, 0.25); const sh = add(g, new THREE.CylinderGeometry(0.95, 1.05, hh, 14), m, 0, 0.5 + hh / 2);
  if (!broken) add(g, new THREE.BoxGeometry(2.6, 0.55, 2.6), m, 0, 0.5 + hh + 0.27); else { const sl = add(g, new THREE.BoxGeometry(1.5, 1.1, 1.4), m, 2.2, 0.55, 1.0); sl.rotation.set(0.2, 0.6, 0.3); }
  if (circles) circles.push({ x, z, r: 1.4 });
  return g;
}
function torii(parent, x, z, rot, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; g.scale.setScalar(scale); parent.add(g);
  const r = S('#c23a2b', 0.6), b = S('#16161a', 0.6);
  for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.42, 0.5, 8, 10), r, s * 3.4, 4);
  add(g, new THREE.BoxGeometry(10.5, 0.7, 0.8), b, 0, 8.4).scale.y = 1; add(g, new THREE.BoxGeometry(8.2, 0.5, 0.55), r, 0, 6.6);
  add(g, new THREE.BoxGeometry(11.5, 0.35, 1.1), r, 0, 8.9);
  return g;
}
function rockField(parent, n, R0, R1, circles, colors = ['#6f6a64'], sMin = 0.8, sMax = 3) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), r = rand(R0, R1), s = rand(sMin, sMax);
    const m = add(parent, new THREE.DodecahedronGeometry(1, 0), S(pick(colors), 0.95), Math.cos(a) * r, s * 0.5, Math.sin(a) * r); m.scale.set(s, s * rand(0.6, 1.1), s * rand(0.8, 1.2)); m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    if (circles) circles.push({ x: m.position.x, z: m.position.z, r: s * 0.8 });
  }
}


// ---------- school campus architecture (tiered tiled roofs, plaster walls, timber) ----------
const TILE = () => S('#2a2c36', 0.55, 0.2), PLAS = () => S('#b9b4a6', 0.9), TIMB = () => S('#3a2a20', 0.8);
function hipRoof(g, w, d, y, hgt = 3, over = 1.6, col) {
  const m = col || TILE(); const r = add(g, new THREE.ConeGeometry(1, 1, 4), m, 0, y + hgt / 2); r.rotation.y = Math.PI / 4; r.scale.set((w + over * 2) * 0.7071, hgt, (d + over * 2) * 0.7071);
  add(g, new THREE.BoxGeometry(w + over * 2 + 0.2, 0.22, d + over * 2 + 0.2), m, 0, y + 0.05, 0, false);
  return r;
}
function campusHall(parent, x, z, w, d, rot = 0, circles, floors = 1, lit = true) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  add(g, new THREE.BoxGeometry(w + 1.2, 0.9, d + 1.2), S('#5a5a5c', 0.95), 0, 0.45);
  let y = 0.9; const fh = 3.6;
  for (let f = 0; f < floors; f++) {
    const ww = w * (1 - f * 0.18), dd = d * (1 - f * 0.18);
    add(g, new THREE.BoxGeometry(ww, fh, dd), PLAS(), 0, y + fh / 2);
    const nP = Math.max(3, Math.round(ww / 3)); for (let i = 0; i <= nP; i++) { const px = -ww / 2 + i * ww / nP; for (const sz of [-1, 1]) add(g, new THREE.BoxGeometry(0.35, fh, 0.35), TIMB(), px, y + fh / 2, sz * dd / 2, false); }
    for (let i = 0; i < nP; i++) { const px = -ww / 2 + (i + 0.5) * ww / nP; for (const sz of [-1, 1]) add(g, new THREE.BoxGeometry(ww / nP - 0.9, 1.5, 0.08), lit ? EM('#ffcf8a', 0.7) : S('#1a1c24', 0.3), px, y + fh * 0.55, sz * (dd / 2 + 0.03), false); }
    add(g, new THREE.BoxGeometry(ww + 0.4, 0.3, dd + 0.4), TIMB(), 0, y + fh, 0, false);
    hipRoof(g, ww, dd, y + fh + 0.1, 2.4 + (f === floors - 1 ? 1.2 : 0), 1.7); y += fh + 0.6;
  }
  if (circles) circles.push({ x, z, r: Math.max(w, d) * 0.55 });
  return g;
}
function schoolTower(parent, x, z, circles) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  add(g, new THREE.BoxGeometry(26, 2, 20), S('#4a4a4c', 0.95), 0, 1);
  const wood = S('#4a2c22', 0.75); let y = 2;
  for (let f = 0; f < 6; f++) { const w = 20 - f * 1.4, d = 15 - f * 1.1, h = 4.4;
    add(g, new THREE.BoxGeometry(w, h, d), wood, 0, y + h / 2);
    for (let i = 0; i < 9 - f; i++) { const px = -w / 2 + (i + 0.5) * w / (9 - f); add(g, new THREE.BoxGeometry(w / (9 - f) - 0.7, 1.8, 0.1), EM('#ffc880', 0.8), px, y + h * 0.55, d / 2 + 0.05, false); add(g, new THREE.BoxGeometry(0.3, h, 0.3), S('#2a1a14', 0.8), px - w / (9 - f) / 2, y + h / 2, d / 2 + 0.1, false); }
    add(g, new THREE.BoxGeometry(w + 3, 0.4, d + 3), S('#2a2c36', 0.55, 0.2), 0, y + h + 0.2, 0, f < 5);
    y += h + 0.8; }
  const r = add(g, new THREE.ConeGeometry(1, 1, 4), TILE(), 0, y + 3.5); r.rotation.y = Math.PI / 4; r.scale.set(13, 7, 10); add(g, new THREE.BoxGeometry(14, 0.5, 11), TILE(), 0, y + 0.1);
  circles && circles.push({ x, z, r: 11 }); return g;
}
function fivePagoda(parent, x, z, circles) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g); let y = 0;
  for (let f = 0; f < 5; f++) { const w = 7 - f * 0.9; add(g, new THREE.BoxGeometry(w, 2.6, w), PLAS(), 0, y + 1.3); add(g, new THREE.BoxGeometry(w + 0.3, 2.6, 0.5), TIMB(), 0, y + 1.3, 0, false); const r = add(g, new THREE.ConeGeometry(1, 1, 4), TILE(), 0, y + 3.2); r.rotation.y = Math.PI / 4; r.scale.set((w + 3.6) * 0.7071, 1.8, (w + 3.6) * 0.7071); y += 2.9; }
  add(g, new THREE.CylinderGeometry(0.1, 0.1, 5, 6), S('#c8a24a', 0.3, 0.9), 0, y + 2.2); circles && circles.push({ x, z, r: 3.5 }); return g;
}
function campusWall(parent, R, gaps = 3) {
  const n = 40; for (let i = 0; i < n; i++) { if (i % Math.floor(n / gaps) < 2) continue; const a = i / n * 6.283, a2 = (i + 1) / n * 6.283; const len = 2 * R * Math.sin(Math.PI / n); const g = new THREE.Group(); g.position.set(Math.cos(a + 0.0785) * R, 0, Math.sin(a + 0.0785) * R); g.rotation.y = -(a + 0.0785) + Math.PI / 2; parent.add(g); add(g, new THREE.BoxGeometry(len + 0.1, 2.6, 0.9), S('#6c6a64', 0.95), 0, 1.3); add(g, new THREE.BoxGeometry(len + 0.3, 0.5, 1.5), TILE(), 0, 2.85, 0, false); }
}
function crosswalk(parent, x, z, len, rot = 0, w = 8) { const g = new THREE.Group(); g.position.set(x, 0.04, z); g.rotation.y = rot; parent.add(g); const m = S('#cfd2d8', 0.8); for (let i = 0; i < len / 1.4; i++) { const b = add(g, new THREE.BoxGeometry(w, 0.04, 0.7), m, 0, 0, -len / 2 + i * 1.4, false); b.receiveShadow = true; } }

// ---------- HUB ----------
export function buildHub(scene, fx) {
  const cfg = { fog: '#b6cade', fogD: 0.0085, top: '#5a88cc', hor: '#ead9c0', sunDir: new THREE.Vector3(-0.55, 0.5, 0.5), sunColor: '#ffdcae', sunInt: 1.9, skyColor: '#a6c2e6', groundColor: '#4a6a42', hemiInt: 0.8, shadowSize: 42 };
  const lights = setupScene(scene, cfg); scene.environment = scene.userData.env; scene.environmentIntensity = 0.24;
  const root = new THREE.Group(); scene.add(root);
  const circles = [], stations = [], upd = [];
  // ground
  const gt = grassTex([40, 40], [62, 108, 52]); const grass = new THREE.Mesh(new THREE.CircleGeometry(220, 64), S('#fff', 1)); grass.material.map = gt; grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; root.add(grass);
  const st = stoneTex([168, 158, 146], [14, 14], 4); const stone = S('#fff', 0.88); stone.map = st; stone.bumpMap = st; stone.bumpScale = 1.2;
  const court = new THREE.Mesh(new THREE.CylinderGeometry(28, 28.4, 0.4, 64), stone); court.position.y = -0.19; court.receiveShadow = true; root.add(court);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(28.2, 0.35, 8, 80), S('#6d6860', 0.9)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; ring.receiveShadow = true; root.add(ring);
  // garden patches & walkway
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; const bush = add(root, new THREE.IcosahedronGeometry(1.4, 1), S(i % 3 ? '#3f7a3a' : '#4d8a42', 0.9), Math.cos(a) * 30.5, 0.7, Math.sin(a) * 30.5); bush.scale.set(1.5, 0.9, 1.2); }
  // main school + side halls
  const ringAt = (deg, r, fn) => { const a = deg * Math.PI / 180, x = Math.cos(a) * r, z = Math.sin(a) * r; fn(x, z, Math.atan2(-x, -z)); };
  ringAt(-90, 74, (x, z, ry) => { const t = schoolTower(root, x, z, circles); t.rotation.y = ry; });
  for (const [dg, r, w, d, fl] of [[-52, 64, 22, 10, 2], [-128, 64, 22, 10, 2], [0, 64, 20, 9, 1], [180, 64, 20, 9, 1], [36, 64, 16, 9, 1], [144, 64, 16, 9, 1]]) ringAt(dg, r, (x, z, ry) => campusHall(root, x, z, w, d, ry, circles, fl));
  ringAt(90, 62, (x, z) => fivePagoda(root, x, z, circles)); campusWall(root, 86, 4);
  for (let i = 0; i < 130; i++) { const a = rand(0, 6.283), r = rand(94, 140); tree(root, Math.cos(a) * r, Math.sin(a) * r, rand(1, 1.6), null, null, i % 4 ? 'pine' : 'oak'); }
  for (let i = 0; i < 20; i++) { const a = rand(0, 6.283), r = rand(33, 46); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x + 42, z - 12) < 11) continue; tree(root, x, z, rand(0.8, 1.2), circles, null, i % 3 ? 'pine' : 'oak'); }
  backdrop(root, 'hub', 70, upd, { m1: '6a84a8', m2: '56708e', trees: 1100, leaf: '#2c5c34', cloud: '#eef2f8' });
  groundDetail(root, 84, { rocks: 30, tufts: 520, tuftCol: '#3f7a3a', minR: 31, rockCol: '#7a766e' });
  // cherry tree center + extras
  blossomTree(root, 0, 0, 1.15, circles); blossomTree(root, -36, 24, 1.0, circles); blossomTree(root, 36, 24, 1.1, circles);
  // lanterns ring
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + 0.2; lantern(root, Math.cos(a) * 26.8, Math.sin(a) * 26.8, '#ffb866', circles); }
  // pond with koi bridge
  const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshStandardMaterial({ color: '#2a6a8a', roughness: 0.05, metalness: 0.6, envMapIntensity: 2 })); pond.rotation.x = -Math.PI / 2; pond.position.set(-42, 0.02, 12); pond.receiveShadow = true; root.add(pond);
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; add(root, new THREE.DodecahedronGeometry(0.9, 0), S('#7c776f', 0.95), -42 + Math.cos(a) * 7.2, 0.3, 12 + Math.sin(a) * 7.2); }
  circles.push({ x: -42, z: 12, r: 6.5 });

  // station factory
  const station = (name, x, z, color, label, prop) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); root.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.25, 40), S('#4b4741', 0.8)); base.position.y = 0.1; base.receiveShadow = base.castShadow = true; g.add(base);
    const rg = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.8, 48), EM(color, 1.8)); rg.rotation.x = -Math.PI / 2; rg.position.y = 0.26; g.add(rg);
    const lab = labelSprite(label, '#fff', 0.9); lab.position.set(0, 5.4, 0); g.add(lab);
    prop(g, upd);
    stations.push({ name, pos: new THREE.Vector3(x, 0, z), r: 4, label, ring: rg, color });
    circles.push({ x, z, r: 1.4 });
    return g;
  };
  const gem = (g, color, y = 3.4) => { const m = add(g, new THREE.OctahedronGeometry(0.55, 0), EM(color, 2.2), 0, y, 0, false); return m; };
  station('technique', -17, -8, '#7fc7ff', 'TECHNIQUES', (g, u) => {
    add(g, new THREE.BoxGeometry(1.6, 1.6, 1.2), S('#5b5148', 0.8), 0, 1.0); const sc = add(g, new THREE.BoxGeometry(1.8, 0.1, 1.1), S('#efe3c2', 0.9), 0, 1.9); sc.rotation.x = -0.35;
    const cubes = [0, 1, 2].map(i => add(g, new THREE.BoxGeometry(0.5, 0.5, 0.5), EM(['#ff7f7f', '#7fffa0', '#7fb6ff'][i], 1.8), 0, 3, 0, false)); u.push((t) => cubes.forEach((c, i) => { const a = t * 1.2 + i * 2.09; c.position.set(Math.cos(a) * 1.3, 3.2 + Math.sin(t * 2 + i) * 0.2, Math.sin(a) * 1.3); c.rotation.set(t, t * 1.3, 0); }));
  });
  station('mystery', 17, -8, '#ffd24f', 'MYSTERY BOXES', (g, u) => {
    const cols = ['#9ad0ff', '#ff9a7a', '#8aff9a', '#d79bff'];
    cols.forEach((c, i) => { const a = i / 4 * 6.28 + 0.78; const ch = new THREE.Group(); ch.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5); ch.rotation.y = -a; g.add(ch); add(ch, new THREE.BoxGeometry(1, 0.7, 0.7), S('#5a3a22', 0.7), 0, 0.6); add(ch, new THREE.BoxGeometry(1.04, 0.14, 0.74), S('#d5a542', 0.4, 0.8), 0, 0.98); add(ch, new THREE.BoxGeometry(0.2, 0.3, 0.76), EM(c, 1.4), 0, 0.75, 0, false); });
    const m = gem(g, '#ffd24f'); u.push(t => { m.rotation.y = t * 1.5; m.position.y = 3.4 + Math.sin(t * 2) * 0.2; });
  });
  station('training', -20, 12, '#ff8a5f', 'TRAINING YARD', (g, u) => {
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.28, 0.32, 5, 8), S('#2a1f1a', 0.7), s * 2, 2.5); add(g, new THREE.BoxGeometry(5.6, 0.45, 0.6), S('#2a1f1a', 0.7), 0, 5.1); add(g, new THREE.BoxGeometry(6.4, 0.25, 0.9), S('#a83a2a', 0.6), 0, 5.5);
    const dm = add(g, new THREE.CylinderGeometry(0.4, 0.5, 2, 8), S('#b99a6a', 0.9), 0, 1.3); add(g, new THREE.SphereGeometry(0.45, 12, 10), S('#d8bb86', 0.9), 0, 2.6);
  });
  station('missions', 21, 7, '#8affc1', 'MISSION BOARD', (g, u) => {
    add(g, new THREE.BoxGeometry(4, 2.6, 0.25), S('#6a4a30', 0.8), 0, 2.2, 0); for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.3, 3.6, 0.3), S('#3a2a1e', 0.8), s * 2.1, 1.8);
    for (let i = 0; i < 6; i++) add(g, new THREE.BoxGeometry(0.9, 1.1, 0.05), S(pick(['#f4ecd0', '#e8d9a0', '#f0e0e0']), 0.9), -1.3 + (i % 3) * 1.3, 2.6 - Math.floor(i / 3) * 1.2, 0.17).rotation.z = rand(-0.1, 0.1);
  });
  station('match', 0, -22, '#ff5f7a', 'MATCHMAKING', (g, u) => {
    const cr = add(g, new THREE.OctahedronGeometry(1.1, 0), EM('#ff5f7a', 1.8), 0, 2.6, 0, false); cr.scale.y = 1.5; const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.07, 8, 40), EM('#ff9fb0', 1.6)); r2.position.y = 2.6; g.add(r2);
    u.push(t => { cr.rotation.y = t; r2.rotation.set(t * 0.8, t * 0.5, 0); cr.position.y = 2.6 + Math.sin(t * 1.7) * 0.2; });
  });
  let lbBoard = null;
  station('archivist', 13, 18, '#c9a0ff', 'LEADERBOARDS', (g, u) => {
    add(g, new THREE.BoxGeometry(3.6, 3.4, 0.5), S('#6f6a62', 0.9), 0, 1.9); lbBoard = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3), new THREE.MeshBasicMaterial({ color: '#fff' })); lbBoard.position.set(0, 1.9, 0.27); g.add(lbBoard);
    const owl = new THREE.Group(); owl.position.set(1.6, 4.2, 0); g.add(owl); add(owl, new THREE.BoxGeometry(0.6, 0.7, 0.5), S('#8a6a4a', 0.8), 0, 0); add(owl, new THREE.BoxGeometry(0.62, 0.4, 0.5), S('#d6c4a0', 0.8), 0, 0.5); for (const s of [-1, 1]) { add(owl, new THREE.BoxGeometry(0.15, 0.5, 0.6), S('#6a4a2a', 0.8), s * 0.42, 0.05); add(owl, new THREE.SphereGeometry(0.1, 8, 6), EM('#ffe27a', 1.5), s * 0.15, 0.55, 0.26, false); }
    u.push(t => { owl.position.y = 4.2 + Math.sin(t * 2) * 0.15; owl.rotation.y = Math.sin(t) * 0.4; });
  });
  station('wardrobe', -13, 18, '#ff9fe0', 'WARDROBE', (g, u) => {
    const mir = add(g, new THREE.BoxGeometry(2.2, 3.4, 0.2), new THREE.MeshStandardMaterial({ color: '#aab8d0', metalness: 1, roughness: 0.06, envMapIntensity: 1.6 }), 0, 2.1); add(g, new THREE.BoxGeometry(2.6, 3.8, 0.15), S('#d5a542', 0.35, 0.9), 0, 2.1, -0.12);
    add(g, new THREE.BoxGeometry(3, 0.12, 0.12), S('#4a3a2a', 0.8), 2.8, 3); for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.7, 1.2, 0.2), S(['#7a1f2b', '#1f5a3a', '#4b2a86'][i], 0.8), 2.3 + i * 0.5, 2.3, 0);
  });
  // trainer NPC marker location for main
  const petals = { t: 0 };
  upd.push((t, dt) => { petals.t += dt; if (petals.t > 0.05) { petals.t = 0; fx.emit(new THREE.Vector3(rand(-14, 14), rand(9, 14), rand(-14, 14)), { x: rand(-0.5, 0.5), y: -rand(0.6, 1.4), z: rand(-0.5, 0.5) }, pick(['#ffb3cc', '#ffc9da', '#ff9ec0']), 0.5, 9, { drag: 0.2, grav: 0, bright: 0.9, end: 0.4 }); } });

  return {
    kind: 'hub', root, circles, stations, bounds: 29.5, lights, spawn: new THREE.Vector3(0, 0, 6), spawnYaw: Math.PI, lbBoard,
    update(t, dt, p) { upd.forEach(f => f(t, dt)); lights.follow(p); },
  };
}


// ---------- DOC MAPS: Forest / Station / Abandoned City ----------
function waterMat(c1 = '#2a7a8a') { return new THREE.MeshPhysicalMaterial({ color: c1, roughness: 0.08, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.82, envMapIntensity: 1.6, clearcoat: 1 }); }
function tree(parent, x, z, sc, circles, breakables, kind = 'pine', snow = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rand(0, 6.28); parent.add(g);
  const bark = S('#4a3626', 0.95), leaf = S(snow ? '#d8e6f0' : kind === 'pine' ? '#2c5a34' : '#3f7a3a', 0.9);
  const h = rand(9, 14) * sc; add(g, new THREE.CylinderGeometry(0.5 * sc, 0.85 * sc, h, 9), bark, 0, h / 2);
  if (kind === 'pine') for (let i = 0; i < 5; i++) add(g, new THREE.ConeGeometry((3.2 - i * 0.5) * sc, 4.2 * sc, 9), leaf, 0, h * 0.45 + i * 2.1 * sc);
  else for (let i = 0; i < 4; i++) { const b = add(g, new THREE.IcosahedronGeometry(rand(2.4, 3.6) * sc, 1), leaf, rand(-2, 2) * sc, h + rand(-0.5, 2) * sc, rand(-2, 2) * sc); }
  if (circles) { const c = { x, z, r: 0.95 * sc }; circles.push(c); if (breakables) breakables.push({ obj: g, x, z, r: c.r, hp: 4, circle: c, color: '#5a4430' }); }
  return g;
}
function car(parent, x, z, rot, color, circles, breakables) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  const body = S(color, 0.35, 0.6), glass = S('#1a2430', 0.1, 0.8), tire = S('#111', 0.9);
  add(g, new THREE.BoxGeometry(2, 0.8, 4.4), body, 0, 0.75); add(g, new THREE.BoxGeometry(1.8, 0.7, 2.2), glass, 0, 1.45, -0.2); add(g, new THREE.BoxGeometry(1.7, 0.08, 2.0), body, 0, 1.82, -0.2);
  for (const [dx, dz] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) { const w = add(g, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), tire, dx, 0.42, dz); w.rotation.z = Math.PI / 2; }
  add(g, new THREE.BoxGeometry(0.4, 0.2, 0.05), EM('#ffe6a0', 1.2), -0.6, 0.85, 2.22, false); add(g, new THREE.BoxGeometry(0.4, 0.2, 0.05), EM('#ffe6a0', 1.2), 0.6, 0.85, 2.22, false);
  const c = { x, z, r: 1.9 }; if (circles) circles.push(c); if (breakables) breakables.push({ obj: g, x, z, r: 1.9, hp: 3, circle: c, color: color });
  return g;
}
function building(parent, x, z, w, d, h, color, damaged, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  const m = S(color, 0.9); add(g, new THREE.BoxGeometry(w, h, d), m, 0, h / 2);
  const wm = EM('#8ab0c8', 0.3), dm = S('#0c0e12', 0.4);
  for (let i = 0; i < Math.floor(h / 4); i++) for (let j = 0; j < Math.floor(w / 3.4); j++) { const lit = Math.random() < 0.12; add(g, new THREE.BoxGeometry(1.8, 2.2, 0.15), lit ? EM('#ffcf7a', 0.9) : dm, -w / 2 + 2.2 + j * 3.4, 2.6 + i * 4, d / 2 + 0.05, false); }
  if (damaged) { for (let k = 0; k < 4; k++) { const sl = add(g, new THREE.BoxGeometry(rand(2, 5), rand(2, 4), d * 0.4), S('#2a2724', 1), rand(-w / 2, w / 2), h + 0.6, rand(-d / 3, d / 3)); sl.rotation.set(rand(-.5, .5), rand(0, 3), rand(-.5, .5)); } const hole = add(g, new THREE.BoxGeometry(w * 0.3, h * 0.18, 0.4), S('#050505', 1), w * 0.1, h * 0.65, d / 2 + 0.06, false); }
  return g;
}
function rubble(parent, x, z, n = 8, sc = 1, col = '#6a655e') { for (let i = 0; i < n; i++) { const r = add(parent, new THREE.DodecahedronGeometry(rand(0.25, 0.9) * sc, 0), S(col, 1), x + rand(-2, 2) * sc, rand(0.1, 0.4), z + rand(-2, 2) * sc); r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3)); } }

// ---------- backdrop: mountain ranges, far forests, clouds ----------
function backdrop(root, id, R, upd, o = {}) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
  const layers = o.mtn === false ? [] : [[230, 300, 26, '#' + (o.m1 || '2a3442')], [300, 380, 22, '#' + (o.m2 || '1e2632')]];
  layers.forEach(([r0, r1, n, col], li) => {
    const im = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), S(col, 1), n); for (let i = 0; i < n; i++) { const a = i / n * 6.283 + rand(-0.08, 0.08), r = rand(r0, r1), h = rand(60, 150) * (1 + li * 0.2), w = rand(50, 100); P.set(Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r); q.setFromEuler(new THREE.Euler(0, rand(0, 6), 0)); Sc.set(w, h, w); m4.compose(P, q, Sc); im.setMatrixAt(i, m4); } root.add(im);
    if (o.cap) { const ic = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), S('#dfeaf5', 0.9), n); for (let i = 0; i < n; i++) { im.getMatrixAt(i, m4); m4.decompose(P, q, Sc); P.y += Sc.y * 0.34; Sc.set(Sc.x * 0.36, Sc.y * 0.34, Sc.z * 0.36); m4.compose(P, q, Sc); ic.setMatrixAt(i, m4); } root.add(ic); }
  });
  const nT = o.trees ?? 380; if (nT) { const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.8, 1, 6), S('#2a2018', 1), nT), cone = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), S(o.leaf || '#173022', 1), nT), cone2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), S(o.leaf || '#173022', 1), nT);
    for (let i = 0; i < nT; i++) { const a = rand(0, 6.283), r = rand(R + 22, R + 150), h = rand(12, 34); P.set(Math.cos(a) * r, h * 0.2, Math.sin(a) * r); q.identity(); Sc.set(1.4, h * 0.45, 1.4); m4.compose(P, q, Sc); trunk.setMatrixAt(i, m4); P.y = h * 0.62; Sc.set(h * 0.32, h * 0.62, h * 0.32); m4.compose(P, q, Sc); cone.setMatrixAt(i, m4); P.y = h * 0.95; Sc.set(h * 0.22, h * 0.5, h * 0.22); m4.compose(P, q, Sc); cone2.setMatrixAt(i, m4); }
    for (const m of [trunk, cone, cone2]) { m.castShadow = false; root.add(m); } }
  const cl = []; for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: o.cloud || '#2a3040', transparent: true, opacity: 0.55, fog: false, depthWrite: false })); const a = rand(0, 6.283); c.position.set(Math.cos(a) * rand(150, 260), rand(70, 130), Math.sin(a) * rand(150, 260)); c.scale.set(rand(50, 110), rand(8, 16), rand(30, 60)); root.add(c); cl.push(c); }
  upd.push((t, dt) => cl.forEach((c, i) => { c.position.x += Math.sin(t * 0.02 + i) * dt * 1.2; }));
}
function groundDetail(root, R, o = {}) {
  const mn = o.minR || 0, rr = (Rm) => mn + Math.sqrt(Math.random()) * (Rm - mn);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
  const nR = o.rocks ?? 40; const rk = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), S(o.rockCol || '#55524e', 1), nR); for (let i = 0; i < nR; i++) { const a = rand(0, 6.283), r = rr(R - 1), s0 = rand(0.15, 0.7); P.set(Math.cos(a) * r, s0 * 0.3, Math.sin(a) * r); q.setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), rand(0, 3))); Sc.set(s0, s0 * 0.7, s0); m4.compose(P, q, Sc); rk.setMatrixAt(i, m4); } rk.castShadow = true; rk.receiveShadow = true; root.add(rk);
  if (o.tufts) { const n = o.tufts, tf = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 1, 4), S(o.tuftCol || '#3f7a3a', 1), n); for (let i = 0; i < n; i++) { const a = rand(0, 6.283), r = rr(R - 0.5), h = rand(0.5, 1.5); P.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); q.setFromEuler(new THREE.Euler(rand(-.3, .3), rand(0, 6), rand(-.3, .3))); Sc.set(1, h, 1); m4.compose(P, q, Sc); tf.setMatrixAt(i, m4); } root.add(tf); }
}
function glowShroom(parent, x, z, col = '#6affc8') { const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g); const st = add(g, new THREE.CylinderGeometry(0.06, 0.09, 0.4, 6), S('#d8d4c0', 0.8), 0, 0.2, 0, false); const cap = add(g, new THREE.SphereGeometry(0.22, 10, 6, 0, 6.283, 0, 1.4), EM(col, 1.6), 0, 0.42, 0, false); return g; }

function buildDocMap(scene, id, fx) {
  const circles = [], upd = [], breakables = [], curseSpots = [];
  const R = id === 'station' ? 34 : 36;
  const cfgs = {
    forest: { fog: '#14222a', fogD: 0.02, top: '#060a18', hor: '#2a3a58', sunDir: new THREE.Vector3(-0.35, 0.45, 0.3), sunColor: '#8fb0ff', sunInt: 1.6, skyColor: '#3a5a7a', groundColor: '#0e1810', hemiInt: 0.45, stars: true, shadowSize: 44 },
    station: { fog: '#070a10', fogD: 0.014, top: '#020306', hor: '#080e18', sunDir: new THREE.Vector3(0.1, 0.9, 0.2), sunColor: '#7aa0ff', sunInt: 1.6, skyColor: '#5a7a98', groundColor: '#20242c', hemiInt: 1.1, shadowSize: 44 },
    bamboo: { fog: '#0e1a18', fogD: 0.022, top: '#050a10', hor: '#244a48', sunDir: new THREE.Vector3(-0.3, 0.5, 0.4), sunColor: '#9fe8d0', sunInt: 1.5, skyColor: '#4a8a80', groundColor: '#0a1410', hemiInt: 0.55, stars: true, shadowSize: 44 },
    snow: { fog: '#10182a', fogD: 0.014, top: '#02040c', hor: '#2a3a68', sunDir: new THREE.Vector3(0.35, 0.4, -0.5), sunColor: '#a8c0ff', sunInt: 1.7, skyColor: '#6a80b8', groundColor: '#202840', hemiInt: 0.7, stars: true, shadowSize: 44 },
    city: { fog: '#1c1220', fogD: 0.015, top: '#0a0612', hor: '#5a2438', sunDir: new THREE.Vector3(-0.3, 0.25, 0.5), sunColor: '#ff7a6a', sunInt: 2.8, skyColor: '#8a6a98', groundColor: '#3a3040', hemiInt: 1.5, shadowSize: 44 },
  };
  const cfg = cfgs[id]; const lights = setupScene(scene, cfg); scene.environment = scene.userData.env; scene.environmentIntensity = 0.2;
  const root = new THREE.Group(); scene.add(root);
  const disc = (mat, h = 1) => { const fl = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.6, h, 72), mat); fl.position.y = -h / 2; fl.receiveShadow = true; root.add(fl); return fl; };
  const outerCol = { forest: '#1c2e1c', station: '#10141a', city: '#3a3a3c', bamboo: '#16241c', snow: '#c8d8e8' }[id]; const outer = new THREE.Mesh(new THREE.CircleGeometry(300, 48), S(outerCol, 1)); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.62; outer.receiveShadow = true; root.add(outer);
  const ring = (n, r0, r1) => Array.from({ length: n }, (_, i) => { const a = i / n * 6.28 + rand(-0.2, 0.2), r = rand(r0, r1); return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r); });
  if (id === 'forest') {
    const gt = grassTex([34, 34], [62, 108, 48]); const fm = S('#fff', 1); fm.map = gt; fm.bumpMap = gt; fm.bumpScale = 1.5; disc(fm);
    // dirt path + pond
    const path = new THREE.Mesh(new THREE.PlaneGeometry(7, 80), S('#6a5236', 1)); path.rotation.x = -Math.PI / 2; path.position.set(-4, 0.02, 0); path.rotation.z = 0.35; path.receiveShadow = true; root.add(path);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(8.5, 40), waterMat('#2a7a86')); pond.rotation.x = -Math.PI / 2; pond.position.set(16, 0.06, -14); root.add(pond);
    const rim = new THREE.Mesh(new THREE.RingGeometry(8.4, 9.8, 40), S('#4a4a40', 1)); rim.rotation.x = -Math.PI / 2; rim.position.set(16, 0.04, -14); root.add(rim);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28, rr = add(root, new THREE.DodecahedronGeometry(rand(0.6, 1.3), 0), S('#6a6a62', 1), 16 + Math.cos(a) * 9.2, 0.3, -14 + Math.sin(a) * 9.2); rr.rotation.set(rand(0, 3), rand(0, 3), 0); }
    circles.push({ x: 16, z: -14, r: 3 }); // central deep water rock
    add(root, new THREE.DodecahedronGeometry(2.6, 1), S('#5a5a54', 1), 16, 0.8, -14); const wob = (t) => { pond.position.y = 0.06 + Math.sin(t * 1.5) * 0.015; }; upd.push(wob);
    // cliff + waterfall
    const cliff = add(root, new THREE.BoxGeometry(46, 20, 8), S('#5a5650', 1), 12, 10, -R - 6); cliff.rotation.y = 0.15;
    const wfMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe8f0').multiplyScalar(1.1), transparent: true, opacity: 0.8, toneMapped: false }); const wf = new THREE.Mesh(new THREE.PlaneGeometry(6, 18), wfMat); wf.position.set(16, 10, -R - 1.8); wf.rotation.y = 0.15; root.add(wf);
    upd.push((t, dt) => { wfMat.opacity = 0.7 + Math.sin(t * 22) * 0.08; if (Math.random() < dt * 40) fx.emit(new THREE.Vector3(16 + rand(-2.5, 2.5), rand(3, 16), -R - 1.3), { x: rand(-0.3, 0.3), y: -rand(6, 10), z: rand(0.2, 1) }, '#dff6ff', 0.35, 1.2, { drag: 0.1, bright: 1 }); if (Math.random() < dt * 14) fx.emit(new THREE.Vector3(16 + rand(-3, 3), 0.4, -R - 0.5 + rand(0, 3)), { x: rand(-1, 1), y: rand(2, 4), z: rand(0.5, 2) }, '#e8fbff', 0.5, 0.9, { drag: 1.5, bright: 1 }); });
    // trees: inner collidable + dense ring
    const inner = ring(11, 10, R - 4).filter(v => v.distanceTo(new THREE.Vector3(16, 0, -14)) > 12 && v.length() > 9); inner.forEach((v, i) => tree(root, v.x, v.z, rand(0.9, 1.25), circles, breakables, i % 3 ? 'pine' : 'oak'));
    for (const v of ring(64, R + 3, R + 40)) tree(root, v.x, v.z, rand(1.1, 2), null, null, Math.random() < 0.6 ? 'pine' : 'oak');
    // ferns / flowers
    const fl = new THREE.InstancedMesh(new THREE.ConeGeometry(0.25, 0.8, 5), S('#3f8a3a', 1), 260), m4 = new THREE.Matrix4(); for (let i = 0; i < 260; i++) { const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * (R - 1); m4.compose(new THREE.Vector3(Math.cos(a) * r, 0.35, Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-.4, .4), rand(0, 6), rand(-.4, .4))), new THREE.Vector3(1, rand(0.7, 1.8), 1)); fl.setMatrixAt(i, m4); } root.add(fl);
    // light shafts
    const shaftMat = new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); const shafts = [];
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(rand(0.4, 1.2), rand(2, 4), 26, 10, 1, true), shaftMat); const x = rand(-28, 28), z = rand(-28, 28); c.position.set(x + 6, 12, z + 4); c.rotation.set(0.25, 0, 0.3); root.add(c); shafts.push(c); }
    upd.push((t) => { shaftMat.opacity = 0.07 + Math.sin(t * 0.7) * 0.025; });
    upd.push((t, dt) => { if (Math.random() < dt * 14) fx.emit(new THREE.Vector3(rand(-34, 34), rand(0.5, 7), rand(-34, 34)), { x: rand(-0.3, 0.3), y: rand(0.1, 0.5), z: rand(-0.3, 0.3) }, '#fff2a0', 0.16, 4, { drag: 0.3, bright: 1.6 }); });
    for (const v of ring(7, 14, 28)) curseSpots.push(v);
  }
  if (id === 'station') {
    const ct = stoneTex([108, 110, 118], [R / 2.4, R / 2.4], 8); const fm = S('#fff', 0.35, 0.1); fm.map = ct; fm.bumpMap = ct; fm.bumpScale = 0.5; fm.envMapIntensity = 0.6; disc(fm);
    // tactile strips & platform edge lines
    for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(2.4, R * 1.7), EM('#e8c020', 0.55)); st.rotation.x = -Math.PI / 2; st.position.set(sx * 17, 0.03, 0); root.add(st); }
    // stationary train on the +x side track pit
    const pit = add(root, new THREE.BoxGeometry(8, 1.6, R * 2.2), S('#0a0c10', 1), 22, -0.4, 0, false);
    for (let i = 0; i < 4; i++) { const t0 = add(root, new THREE.BoxGeometry(5.2, 5.6, 14), S(i % 2 ? '#c6ccd4' : '#bcc3cc', 0.35, 0.6), 22, 3.6, -24 + i * 16.4); circles.push({ x: 22, z: t0.position.z - 5, r: 3.2 }, { x: 22, z: t0.position.z + 5, r: 3.2 }, { x: 22, z: t0.position.z, r: 3.2 }); add(root, new THREE.BoxGeometry(5.3, 0.45, 14.1), EM(['#10b0a0', '#4a7aff'][i % 2], 0.9), 22, 2.2, t0.position.z, false); for (let k = 0; k < 4; k++) add(root, new THREE.BoxGeometry(0.1, 1.8, 2.2), EM('#cfe6ff', 0.9), 19.35, 4.2, t0.position.z - 5.4 + k * 3.6, false); }
    // pillars grid with signage + ceiling beams + strip lights
    const pm = S('#8a8e98', 0.5, 0.2); const pcs = [[-12, -12], [12, -12], [-12, 12], [12, 12], [0, -20], [0, 20], [-24, 0]];
    pcs.forEach(([x, z], i) => { add(root, new THREE.BoxGeometry(2.2, 14, 2.2), pm, x, 7, z); add(root, new THREE.BoxGeometry(2.4, 0.4, 2.4), EM('#58d0ff', 0.9), x, 3.2, z, false); circles.push({ x, z, r: 1.7 }); });
    const lm = EM('#dff0ff', 1.5); for (let i = -3; i <= 3; i++) { add(root, new THREE.BoxGeometry(0.5, 0.2, 52), pm, i * 9, 14, 0, false); add(root, new THREE.BoxGeometry(0.35, 0.12, 40), lm, i * 9, 13.75, 0, false); }
    add(root, new THREE.BoxGeometry(80, 0.6, 80), S('#1a1e26', 1), 0, 14.6, 0, false);
    // turnstile gates + info boards
    const tg = []; for (let i = 0; i < 5; i++) { const x = -7 + i * 3.5, z = 24; const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g); add(g, new THREE.BoxGeometry(0.8, 1.1, 1.6), S('#6a707c', 0.4, 0.6), 0, 0.55); add(g, new THREE.BoxGeometry(0.5, 0.08, 1.2), EM(i % 2 ? '#40ff90' : '#ff4040', 1.6), 0, 1.15, 0, false); const c = { x, z, r: 0.9 }; circles.push(c); breakables.push({ obj: g, x, z, r: 0.9, hp: 2, circle: c, color: '#8a909c' }); }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), (() => { const t = tex(512, 128, (x, w, h) => { x.fillStyle = '#0a1018'; x.fillRect(0, 0, w, h); x.fillStyle = '#58f0ff'; x.font = '800 54px system-ui'; x.fillText('渋谷  SHIBUYA', 20, 60); x.fillStyle = '#ffd060'; x.font = '700 32px system-ui'; x.fillText('Platform 3  →  Out of service', 20, 106); }); return new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); })()); board.position.set(-33, 8, 0); board.rotation.y = Math.PI / 2; root.add(board);
    // tunnel mouth arches at -z end + far walls
    for (const [x, z, ry] of [[0, -R - 2, 0], [-R - 2, 0, Math.PI / 2], [0, R + 2, 0]]) { const w = add(root, new THREE.BoxGeometry(R * 2.4, 16, 3), S('#3a3e48', 0.8), x, 8, z); w.rotation.y = ry; }
    const tun = add(root, new THREE.BoxGeometry(9, 8, 4), S('#000', 1), 0, 4, -R - 0.3, false); upd.push((t) => { lm.color.setScalar(1.35 + (Math.sin(t * 40) > 0.97 ? -0.7 : 0.15)); });
    upd.push((t, dt) => { if (Math.random() < dt * 8) fx.emit(new THREE.Vector3(rand(-30, 30), rand(10, 13), rand(-30, 30)), { x: 0, y: -rand(0.1, 0.4), z: 0 }, '#b0c8e0', 0.14, 6, { drag: 0.2, bright: 0.8 }); });
    for (const v of ring(7, 8, 26)) { if (v.x > 12) v.x -= 14; curseSpots.push(v); }
  }
  if (id === 'city') {
    const at = stoneTex([62, 62, 66], [R / 3, R / 3], 6); const fm = S('#fff', 0.92); fm.map = at; fm.bumpMap = at; fm.bumpScale = 1.2; disc(fm);
    // lane markings + cracks
    const lane = EM('#c8c0a0', 0.5); for (let i = -6; i <= 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3), lane); m.rotation.x = -Math.PI / 2; m.position.set(0.6, 0.03, i * 6); root.add(m); }
    for (let i = 0; i < 9; i++) { const cr = new THREE.Mesh(new THREE.PlaneGeometry(rand(5, 11), 0.18), new THREE.MeshBasicMaterial({ color: '#0a0a0a' })); cr.rotation.x = -Math.PI / 2; cr.rotation.z = rand(0, 3.14); cr.position.set(rand(-24, 24), 0.035, rand(-24, 24)); root.add(cr); }
    const crater = new THREE.Mesh(new THREE.CircleGeometry(5, 28), S('#262626', 1)); crater.rotation.x = -Math.PI / 2; crater.position.set(-8, 0.05, -4); root.add(crater); rubble(root, -8, -4, 14, 1.4);
    // cars (breakable)
    [[8, 9, 0.4, '#8a2a2a'], [-14, 14, -1.2, '#2a4a7a'], [18, -10, 1.9, '#c8c8c8'], [-20, -16, 0.2, '#3a3a3a'], [2, -20, 2.8, '#6a7a2a'], [-3, 18, 0.9, '#c0902a']].forEach(([x, z, r, c]) => car(root, x, z, r, c, circles, breakables));
    // fallen lamp posts & concrete barriers
    for (const [x, z, r] of [[14, 16, 0.5], [-24, 2, 2], [22, 2, 1.4]]) { const l = add(root, new THREE.CylinderGeometry(0.15, 0.2, 9, 8), S('#4a4e56', 0.5, 0.6), x, 0.3, z); l.rotation.z = Math.PI / 2; l.rotation.y = r; }
    for (let i = 0; i < 8; i++) { const a = rand(0, 6.28), r = rand(10, 26), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x + 8, z + 4) < 6) continue; const b = add(root, new THREE.BoxGeometry(3.2, 1.1, 0.9), S('#8a8a86', 1), x, 0.55, z); b.rotation.y = rand(0, 3); const c = { x, z, r: 1.45 }; circles.push(c); breakables.push({ obj: b, x, z, r: 1.45, hp: 3, circle: c, color: '#8a8a86' }); }
    // buildings ring
    const cols = ['#5a5a60', '#6a6660', '#4a4e58', '#74706a']; for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28, r = R + 14 + rand(0, 14); building(root, Math.cos(a) * r, Math.sin(a) * r, rand(14, 22), rand(14, 22), rand(24, 70), cols[i % 4], i % 2 === 0, -a + Math.PI / 2); }
    for (const v of ring(12, 12, 30)) rubble(root, v.x, v.z, 6, 0.8);
    // smoke
    upd.push((t, dt) => { if (Math.random() < dt * 9) fx.emit(new THREE.Vector3(-8 + rand(-2, 2), 0.5, -4 + rand(-2, 2)), { x: rand(-0.3, 0.3), y: rand(1.5, 2.6), z: rand(-0.3, 0.3) }, '#555a60', 2.4, 4, { drag: 0.4, bright: 0.5 }); if (Math.random() < dt * 5) fx.emit(new THREE.Vector3(rand(-34, 34), rand(0, 2), rand(-34, 34)), { x: rand(-0.2, 0.2), y: rand(0.3, 0.9), z: rand(-0.2, 0.2) }, '#caa070', 0.2, 3, { drag: 0.3, bright: 1.2 }); });
    for (const v of ring(7, 12, 28)) curseSpots.push(v);
  }

  if (id === 'forest') {
    for (let i = 0; i < 26; i++) { const a = rand(0, 6.283), r = rand(6, R - 3); const lg = add(root, new THREE.CylinderGeometry(0.5, 0.55, rand(3, 6), 8), S('#3a2a1c', 1), Math.cos(a) * r, 0.5, Math.sin(a) * r); lg.rotation.z = Math.PI / 2; lg.rotation.y = rand(0, 3); }
    for (let i = 0; i < 40; i++) { const a = rand(0, 6.283), r = rand(4, R - 2); glowShroom(root, Math.cos(a) * r, Math.sin(a) * r, pick(['#6affc8', '#9a8aff', '#ffb0e0'])); }
    const br = add(root, new THREE.BoxGeometry(2.2, 0.3, 9), S('#4a3622', 1), 16, 0.35, -5); br.rotation.y = 0.3; groundDetail(root, R, { rocks: 30, tufts: 500, tuftCol: '#2a5a30' });
    backdrop(root, id, R, upd, { m1: '1c2a30', m2: '121c24', trees: 520, leaf: '#10281c' });
  }
  if (id === 'station') {
    const bm = S('#3a3e48', 0.6, 0.5); for (let i = 0; i < 6; i++) { const x = -20 + i * 7, z = -24; const b = add(root, new THREE.BoxGeometry(3.2, 0.5, 1), bm, x, 0.55, z); add(root, new THREE.BoxGeometry(3.2, 0.9, 0.2), bm, x, 1.1, z - 0.5); add(root, new THREE.BoxGeometry(0.2, 0.6, 0.9), bm, x - 1.5, 0.25, z); add(root, new THREE.BoxGeometry(0.2, 0.6, 0.9), bm, x + 1.5, 0.25, z); const c = { x, z, r: 1.7 }; circles.push(c); breakables.push({ obj: b.parent === root ? b : b, x, z, r: 1.7, hp: 2, circle: c, color: '#8a909c' }); }
    for (let i = 0; i < 4; i++) { const x = -29 + i * 3.3, z = -4; const vm = new THREE.Group(); vm.position.set(x, 0, z); root.add(vm); add(vm, new THREE.BoxGeometry(2.4, 3.4, 1.4), S(['#2a6ad0', '#d03a3a', '#30b070', '#d09a30'][i], 0.4, 0.3), 0, 1.7); add(vm, new THREE.BoxGeometry(1.8, 2, 0.1), EM('#cfe8ff', 1.1), 0, 2.1, 0.72, false); const c = { x, z, r: 1.4 }; circles.push(c); breakables.push({ obj: vm, x, z, r: 1.4, hp: 3, circle: c, color: '#8a909c' }); }
    for (let i = 0; i < 40; i++) { const pm = add(root, new THREE.PlaneGeometry(rand(1.5, 2.6), rand(2, 3.4)), EM(new THREE.Color().setHSL(rand(0, 1), 0.7, 0.5), 0.6), rand(-30, 30), rand(2.5, 9), -R - 0.45, false); }
    for (let i = 0; i < 10; i++) { const pg = add(root, new THREE.CylinderGeometry(0.25, 0.25, 70, 8), S('#4a505c', 0.5, 0.7), rand(-30, 30), 11.6, rand(-30, 30), false); pg.rotation.x = Math.PI / 2; pg.rotation.z = rand(-0.3, 0.3); }
    for (let i = 0; i < 16; i++) { const t0 = add(root, new THREE.BoxGeometry(0.7, 0.9, 0.7), S('#2a3038', 0.6, 0.4), rand(-28, 14), 0.45, rand(-28, 28)); const c = { x: t0.position.x, z: t0.position.z, r: 0.6 }; circles.push(c); breakables.push({ obj: t0, x: c.x, z: c.z, r: 0.6, hp: 1, circle: c, color: '#555' }); }
    const railM = S('#5a5e66', 0.4, 0.8); for (const rx of [-3, -1.5, 1.5, 3]) add(root, new THREE.BoxGeometry(0.12, 0.18, R * 2), railM, rx, 0.09, 0, false); for (let i = 0; i < 34; i++) add(root, new THREE.BoxGeometry(8, 0.1, 0.5), S('#2a2420', 1), 0, 0.03, -R + i * 2, false);
    for (const sx of [-1, 1]) { add(root, new THREE.BoxGeometry(0.4, 0.06, R * 2), EM('#e8c030', 0.6), sx * 5.6, 0.45, 0, false); add(root, new THREE.BoxGeometry(14, 0.9, R * 2), S('#262a32', 0.8), sx * 12.8, 0.45, 0); }
    for (let i = 0; i < 12; i++) add(root, new THREE.BoxGeometry(5, 0.15, 0.6), EM('#d8f0ff', 1.2), 0, 11.8, -R + 3 + i * 6, false);
    rubble(root, -12, 8, 8, 0.8, '#55575c'); rubble(root, 6, -16, 6, 0.7, '#55575c'); groundDetail(root, R, { rocks: 10, rockCol: '#4a4c52' });
  }
  if (id === 'city') {
    for (const [x, z] of [[-18, 24], [20, 22], [-26, -10], [26, -18], [4, -28], [-4, 28]]) { const lp = new THREE.Group(); lp.position.set(x, 0, z); root.add(lp); add(lp, new THREE.CylinderGeometry(0.15, 0.2, 8, 8), S('#3a3e46', 0.5, 0.6), 0, 4); add(lp, new THREE.BoxGeometry(1.6, 0.2, 0.4), S('#3a3e46', 0.5, 0.6), 0.7, 8, 0); add(lp, new THREE.BoxGeometry(0.8, 0.15, 0.4), EM(Math.random() < 0.5 ? '#ffd890' : '#9a5a40', 1.3), 1.2, 7.9, 0, false); const c = { x, z, r: 0.5 }; circles.push(c); breakables.push({ obj: lp, x, z, r: 0.5, hp: 2, circle: c, color: '#555' }); }
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, r = R + 4; const sh = new THREE.Mesh(new THREE.PlaneGeometry(rand(4, 7), rand(1.2, 2)), EM(pick(['#ff3a6a', '#3ad0ff', '#ffd23a', '#7aff9a']), 1.0)); sh.position.set(Math.cos(a) * r, rand(5, 9), Math.sin(a) * r); sh.lookAt(0, sh.position.y, 0); root.add(sh); }
    const bus = new THREE.Group(); bus.position.set(-26, 0, 4); bus.rotation.y = 0.5; root.add(bus); add(bus, new THREE.BoxGeometry(3, 3.4, 10), S('#6a7a8a', 0.5, 0.4), 0, 2.1); for (let k = 0; k < 5; k++) add(bus, new THREE.BoxGeometry(0.1, 1, 1.3), S('#10161c', 0.2, 0.6), 1.55, 2.6, -4 + k * 2, false); const bc = { x: -26, z: 4, r: 3.4 }; circles.push(bc); breakables.push({ obj: bus, x: -26, z: 4, r: 3.4, hp: 5, circle: bc, color: '#6a7a8a' });
    for (const v of ring(14, 6, R - 2)) { const w = add(root, new THREE.ConeGeometry(0.4, rand(1, 2.4), 5), S('#3a5a2a', 1), v.x, 0.6, v.z, false); }
    crosswalk(root, 0, 12, 22, 0); crosswalk(root, 0, -12, 22, 0); crosswalk(root, 12, 0, 22, Math.PI / 2); crosswalk(root, -12, 0, 22, Math.PI / 2); crosswalk(root, 9, 9, 16, Math.PI / 4);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + 0.1, r = R + 14 + rand(0, 8), h = rand(40, 90), w = rand(14, 24); const bg = new THREE.Group(); bg.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); bg.rotation.y = -a + Math.PI / 2; root.add(bg); add(bg, new THREE.BoxGeometry(w, h, w * 0.8), S('#10121a', 0.5, 0.3), 0, h / 2); for (let k = 0; k < 9; k++) add(bg, new THREE.BoxGeometry(w * 0.9, 0.5, 0.1), EM(pick(['#ffd890', '#9ad0ff', '#fff4c0']), 0.5), 0, 4 + k * h / 9.5, -w * 0.4 - 0.06, false); const sc = EM(pick(['#ff3a6a', '#3ad0ff', '#7aff9a', '#ffd23a', '#ff8a3a']), 1.4); add(bg, new THREE.BoxGeometry(w * 0.8, h * rand(0.18, 0.35), 0.3), sc, 0, rand(14, h * 0.7), -w * 0.4 - 0.2, false); }
    for (let i = 0; i < 18; i++) { const a = rand(0, 6.283), r = rand(5, R - 3); add(root, new THREE.SphereGeometry(0.18, 8, 6), EM('#ff2a2a', 2.2), Math.cos(a) * r, 0.2, Math.sin(a) * r, false); }
    const ot = tree(root, 14, -24, 1.1, circles, breakables, 'oak'); groundDetail(root, R, { rocks: 28, tufts: 220, tuftCol: '#3a5a2a' });
    backdrop(root, id, R, upd, { m1: '2a2430', m2: '1a1620', trees: 120, leaf: '#1a2a1c', cloud: '#3a2a38' });
  }
  if (id === 'bamboo') {
    const gt = grassTex([30, 30], [34, 62, 40]); const fm = S('#fff', 1); fm.map = gt; fm.bumpMap = gt; fm.bumpScale = 1.2; disc(fm);
    const pathM = stoneTex([88, 84, 76], [4, 12], 3); const pm = S('#fff', 0.9); pm.map = pathM; const pth = new THREE.Mesh(new THREE.PlaneGeometry(6, 70), pm); pth.rotation.x = -Math.PI / 2; pth.position.set(0, 0.03, 0); pth.receiveShadow = true; root.add(pth);
    const stalk = S('#4a8a3a', 0.5), node = S('#2a5a26', 0.6);
    const mkBamboo = (x, z, col) => { const g = new THREE.Group(); g.position.set(x, 0, z); const h = rand(16, 30); const st = add(g, new THREE.CylinderGeometry(0.22, 0.26, h, 7), stalk, 0, h / 2); for (let k = 1; k < h / 2.2; k++) add(g, new THREE.CylinderGeometry(0.28, 0.28, 0.1, 7), node, 0, k * 2.2, 0, false); for (let k = 0; k < 4; k++) { const lf = add(g, new THREE.ConeGeometry(0.5, 2.6, 4), S('#5aa048', 0.8), rand(-0.6, 0.6), h * rand(0.6, 0.98), rand(-0.6, 0.6), false); lf.rotation.z = rand(-1.2, 1.2); lf.rotation.x = rand(-1, 1); } g.rotation.set(rand(-0.05, 0.05), 0, rand(-0.05, 0.05)); root.add(g); return g; };
    for (let i = 0; i < 34; i++) { const a = rand(0, 6.283), r = rand(8, R - 3); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 4.5) continue; const g = mkBamboo(x, z); const c = { x, z, r: 0.55 }; circles.push(c); breakables.push({ obj: g, x, z, r: 0.55, hp: 2, circle: c, color: '#4a8a3a' }); }
    for (let i = 0; i < 360; i++) { const a = rand(0, 6.283), r = rand(R + 2, R + 70); mkBamboo(Math.cos(a) * r, Math.sin(a) * r); }
    torii(root, 0, -R + 2, 0, 1.5); torii(root, 0, R - 6, 0, 1.2); for (let i = 0; i < 8; i++) { lantern(root, -3.8, -R + 8 + i * 8, '#ffb25a', circles); lantern(root, 3.8, -R + 8 + i * 8, '#ffb25a', circles); }
    pagoda(root, -R - 14, -10, 14, 10, 7, 0.4); for (let i = 0; i < 10; i++) { const a = rand(0, 6.283), r = rand(6, R - 4); const st = add(root, new THREE.CylinderGeometry(0.9, 1, 0.12, 9), S('#6a6a64', 1), Math.cos(a) * r, 0.05, Math.sin(a) * r); }
    for (let i = 0; i < 20; i++) glowShroom(root, rand(-R, R) * 0.8, rand(-R, R) * 0.8, '#9affd0');
    upd.push((t, dt) => { if (Math.random() < dt * 18) fx.emit(new THREE.Vector3(rand(-34, 34), rand(10, 26), rand(-34, 34)), { x: rand(-1, 0), y: -rand(0.5, 1.4), z: rand(-1, 1) }, '#7ac860', 0.3, 10, { drag: 0.2, bright: 0.8 }); if (Math.random() < dt * 10) fx.emit(new THREE.Vector3(rand(-34, 34), rand(0.5, 6), rand(-34, 34)), { x: rand(-0.3, 0.3), y: rand(0.1, 0.4), z: rand(-0.3, 0.3) }, '#c8ffe0', 0.14, 5, { drag: 0.3, bright: 1.7 }); });
    groundDetail(root, R, { rocks: 26, tufts: 420, tuftCol: '#2a5a34' }); backdrop(root, id, R, upd, { m1: '1c3a34', m2: '10241f', trees: 160, leaf: '#10301f' });
    for (const v of ring(7, 10, 28)) curseSpots.push(v);
  }
  if (id === 'snow') {
    const sn = tex(512, 512, (x, w, h) => { x.fillStyle = '#dce8f4'; x.fillRect(0, 0, w, h); speck(x, w, h, 9000, 0.12); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(150,180,220,${rand(0.05, 0.2)})`; x.beginPath(); x.arc(rand(0, w), rand(0, h), rand(10, 40), 0, 6.3); x.fill(); } }, [14, 14]); const fm = S('#fff', 0.55); fm.map = sn; fm.bumpMap = sn; fm.bumpScale = 1; fm.envMapIntensity = 0.5; disc(fm);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshPhysicalMaterial({ color: '#8ac8e8', roughness: 0.05, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 })); pond.rotation.x = -Math.PI / 2; pond.position.set(-14, 0.05, 12); root.add(pond);
    const ruinM = S('#6a6e78', 0.9), snowM = S('#e8f0f8', 0.8); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, rr = 16; const h = rand(5, 10); const pg = new THREE.Group(); pg.position.set(14 + Math.cos(a) * rr * 0.6, 0, -14 + Math.sin(a) * rr * 0.6); root.add(pg); add(pg, new THREE.CylinderGeometry(0.9, 1.1, h, 8), ruinM, 0, h / 2); add(pg, new THREE.CylinderGeometry(1.0, 0.9, 0.5, 8), snowM, 0, h + 0.1); const c = { x: pg.position.x, z: pg.position.z, r: 1.2 }; circles.push(c); if (i % 2) breakables.push({ obj: pg, x: c.x, z: c.z, r: 1.2, hp: 4, circle: c, color: '#8a8e98' }); }
    add(root, new THREE.BoxGeometry(16, 0.6, 16), ruinM, 14, 0.3, -14);
    const fire = new THREE.Group(); fire.position.set(0, 0, 0); root.add(fire); for (let i = 0; i < 6; i++) { const lg = add(fire, new THREE.CylinderGeometry(0.15, 0.15, 1.6, 6), S('#3a2418', 1), 0, 0.3, 0); lg.rotation.set(Math.PI / 2.4, i / 6 * 6.283, 0); } const fl = new THREE.PointLight('#ff8a3a', 40, 22, 1.6); fl.position.set(0, 1.4, 0); root.add(fl);
    upd.push((t, dt) => { fl.intensity = 36 + Math.sin(t * 17) * 6 + Math.sin(t * 9) * 4; if (Math.random() < dt * 40) fx.emit(new THREE.Vector3(rand(-0.5, 0.5), 0.6, rand(-0.5, 0.5)), { x: rand(-0.3, 0.3), y: rand(2, 4), z: rand(-0.3, 0.3) }, '#ff9a3a', 0.5, 0.8, { drag: 0.5, bright: 1.6 }); });
    for (const v of ring(16, 8, R - 3)) tree(root, v.x, v.z, rand(1, 1.5), circles, breakables, 'pine', true);
    upd.push((t, dt) => { for (let k = 0; k < 3; k++) if (Math.random() < dt * 60) fx.emit(new THREE.Vector3(rand(-40, 40), rand(12, 28), rand(-40, 40)), { x: rand(-0.6, 0.2), y: -rand(1.2, 2.4), z: rand(-0.4, 0.4) }, '#ffffff', 0.18, 12, { drag: 0.1, bright: 1.3 }); });
    const au = []; for (let i = 0; i < 3; i++) { const am = new THREE.MeshBasicMaterial({ color: ['#40ffa0', '#60a0ff', '#c060ff'][i], transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }); const ap = new THREE.Mesh(new THREE.PlaneGeometry(420, 70, 24, 1), am); ap.position.set(-40 + i * 40, 110 + i * 12, -200 + i * 30); ap.rotation.x = 0.2; root.add(ap); au.push(am); } upd.push((t) => au.forEach((m, i) => { m.opacity = 0.14 + Math.sin(t * 0.5 + i * 2) * 0.07; }));
    groundDetail(root, R, { rocks: 30, rockCol: '#7a8294' }); backdrop(root, id, R, upd, { m1: '3a4a6a', m2: '28365a', cap: true, trees: 380, leaf: '#d0e0ec', cloud: '#3a4668' });
    for (const v of ring(7, 12, 28)) curseSpots.push(v);
  }
  return { kind: 'arena', id, root, circles, breakables, curseSpots: curseSpots.map(v => v.clone ? v : new THREE.Vector3(v.x, 0, v.z)), bounds: R - 1.2, lights, update(t, dt, p) { upd.forEach(f => f(t, dt)); lights.follow(p); } };
}

// ---------- ARENAS ----------
export const MAPS = {
  shrine: { name: 'Golden Shrine', desc: 'Sunset courtyard of stone and lanterns' },
  neon: { name: 'Neon Rooftop', desc: 'Night city high above the streets' },
  ruins: { name: 'Sunken Ruins', desc: 'Crumbling temple under a red sky' },
  dojo: { name: 'Training Yard', desc: 'Practice ground' },
  bamboo: { name: 'Moonlit Bamboo Grove', desc: 'Stone path, lanterns and endless bamboo' },
  snow: { name: 'Frostfall Ruins', desc: 'Snowy pines, a campfire and aurora skies' },
  forest: { name: 'Whispering Forest', desc: 'Dense woods, a pond and a waterfall' },
  station: { name: 'Underground Station', desc: 'Concourse, platform and a stalled train' },
  city: { name: 'Abandoned City', desc: 'Cracked streets, wrecked cars, broken towers' },
};
export function buildArena(scene, id, fx) {
  if (id === 'forest' || id === 'station' || id === 'city' || id === 'bamboo' || id === 'snow') return buildDocMap(scene, id, fx);
  const circles = [], upd = []; const R = id === 'dojo' ? 26 : 34;
  let cfg, floorMat;
  if (id === 'shrine') cfg = { fog: '#3a1a22', fogD: 0.014, top: '#0c0820', hor: '#b0402a', sunDir: new THREE.Vector3(-0.7, 0.2, 0.45), sunColor: '#ff6a3a', sunInt: 2.6, skyColor: '#6a3a4a', groundColor: '#241014', hemiInt: 0.45, shadowSize: 42 };
  if (id === 'neon') cfg = { fog: '#150c2a', fogD: 0.0055, top: '#050414', hor: '#3a1760', sunDir: new THREE.Vector3(0.3, 0.6, -0.6), sunColor: '#a58bff', sunInt: 1.3, skyColor: '#7a6ac0', groundColor: '#2a1c48', hemiInt: 0.95, stars: true, shadowSize: 42 };
  if (id === 'ruins') cfg = { fog: '#3a1410', fogD: 0.014, top: '#18060e', hor: '#a83a22', sunDir: new THREE.Vector3(0.6, 0.3, -0.5), sunColor: '#ff7a3a', sunInt: 2.6, skyColor: '#8a4a3a', groundColor: '#200c08', hemiInt: 0.4, shadowSize: 42 };
  if (id === 'dojo') cfg = { fog: '#0e1620', fogD: 0.014, top: '#04060e', hor: '#26344e', sunDir: new THREE.Vector3(-0.4, 0.5, 0.5), sunColor: '#9ab4f0', sunInt: 1.2, skyColor: '#4a5c88', groundColor: '#1a2418', hemiInt: 0.7, stars: true, shadowSize: 36 };
  const lights = setupScene(scene, cfg); scene.environment = scene.userData.env; scene.environmentIntensity = 0.2;
  const root = new THREE.Group(); scene.add(root);
  const outer = new THREE.Mesh(new THREE.CircleGeometry(260, 48), S(id === 'neon' ? '#0a0818' : id === 'ruins' ? '#5a2e1c' : '#4d6a3d', 1)); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.6; outer.receiveShadow = true; root.add(outer);
  if (id === 'shrine' || id === 'dojo') {
    const t = id === 'dojo' ? woodTex([150, 108, 70], [10, 10]) : stoneTex([150, 138, 124], [R / 3.2, R / 3.2], 4); floorMat = S('#fff', 0.8); floorMat.map = t; floorMat.bumpMap = t; floorMat.bumpScale = 1;
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.5, 1, 72), floorMat); fl.position.y = -0.5; fl.receiveShadow = true; root.add(fl);
  }
  if (id === 'shrine') {
    scene.add(new THREE.Group());
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; lantern(root, Math.cos(a) * (R - 1.5), Math.sin(a) * (R - 1.5), '#ffb25a', circles); }
    torii(root, 0, -R - 3, 0, 1.6); torii(root, R + 3, 0, Math.PI / 2, 1.2);
    for (const [x, z] of [[-22, -16], [23, 12], [-12, 24]]) pillar(root, x, z, 5, '#bda88c', circles);
    blossomTree(root, -R - 10, 10, 1.4); blossomTree(root, R + 12, -14, 1.5); blossomTree(root, 10, R + 11, 1.3);
    pagoda(root, -R - 22, -20, 18, 12, 8, 0.6); pagoda(root, R + 24, 22, 18, 12, 8, -0.7);
    const petals = { t: 0 }; upd.push((t, dt) => { petals.t += dt; if (petals.t > 0.06) { petals.t = 0; fx.emit(new THREE.Vector3(rand(-30, 30), rand(10, 15), rand(-30, 30)), { x: rand(-1, 1), y: -rand(0.5, 1.5), z: rand(-1, 1) }, '#ffc0d0', 0.5, 10, { drag: 0.2, bright: 0.9, end: 0.3 }); } });
  }
  if (id === 'dojo') {
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; pillar(root, Math.cos(a) * (R + 1), Math.sin(a) * (R + 1), 7, '#8a5a3a'); }
    pagoda(root, 0, -R - 18, 30, 12, 9, 0, null);
  }
  if (id === 'neon') {
    const conc = stoneTex([70, 72, 86], [R / 4, R / 4], 4), fm = S('#fff', 0.6, 0.15); fm.map = conc; fm.bumpMap = conc; fm.envMapIntensity = 0.5;
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.5, 1, 72), fm); fl.position.y = -0.5; fl.receiveShadow = true; root.add(fl);
    const neons = ['#ff2fa8', '#2fe0ff', '#9a5fff']; const rings = [];
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(R - 1 - i * 5.5, R - 0.8 - i * 5.5, 96), EM(neons[i], 1.6)); r.rotation.x = -Math.PI / 2; r.position.y = 0.03; root.add(r); rings.push(r); }
    const cx = new THREE.Mesh(new THREE.RingGeometry(5, 5.3, 64), EM('#2fe0ff', 1.8)); cx.rotation.x = -Math.PI / 2; cx.position.y = 0.04; root.add(cx);
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.78, x = Math.cos(a) * 20, z = Math.sin(a) * 20; const ac = add(root, new THREE.BoxGeometry(4, 2.4, 3), S('#3a3d4a', 0.5, 0.5), x, 1.2, z); circles.push({ x, z, r: 2.2 }); add(root, new THREE.BoxGeometry(4.1, 0.1, 0.1), EM(neons[i % 3], 1.5), x, 2.2, z + 1.55, false); }
    // skyline
    const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#1b1236' }), 70); bm.castShadow = false; const m4 = new THREE.Matrix4();
    for (let i = 0; i < 70; i++) { const a = i / 70 * 6.28 + rand(-0.03, 0.03), r = rand(62, 115), w = rand(9, 22), h = rand(30, 105); m4.compose(new THREE.Vector3(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(w, h, w)); bm.setMatrixAt(i, m4); bm.setColorAt(i, new THREE.Color().setHSL(rand(0.68, 0.82), 0.5, rand(0.6, 1.1) * 0.5)); }
    root.add(bm);
    const wcols = ['#ffd27a', '#7ad2ff', '#ff7ac8', '#ffffff'], wl = wcols.map(() => []);
    for (let i = 0; i < 70; i++) { bm.getMatrixAt(i, m4); const p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion(); m4.decompose(p, q, s); const ang = Math.atan2(p.z, p.x); const f = new THREE.Vector3(-Math.cos(ang), 0, -Math.sin(ang)); for (let k = 0; k < 40; k++) { const mm = new THREE.Matrix4().compose(new THREE.Vector3(p.x + f.x * (s.x / 2 + 0.05) + rand(-s.x * 0.4, s.x * 0.4) * -f.z, p.y + rand(-s.y * 0.46, s.y * 0.46), p.z + f.z * (s.z / 2 + 0.05) + rand(-s.x * 0.4, s.x * 0.4) * f.x), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(f.x, f.z), 0)), new THREE.Vector3(1.1, 1.6, 1)); pick(wl).push(mm); } }
    wcols.forEach((c, i) => { const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.15), toneMapped: false }), wl[i].length); wl[i].forEach((mm, k) => im.setMatrixAt(k, mm)); root.add(im); });
    upd.push((t) => rings.forEach((r, i) => { r.material.color.set(neons[i]).multiplyScalar(1.4 + Math.sin(t * 2 + i) * 0.5); }));
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; const p = add(root, new THREE.BoxGeometry(0.5, 2.4, 0.5), S('#2a2c38', 0.5, 0.6), Math.cos(a) * (R + 0.2), 1.2, Math.sin(a) * (R + 0.2)); add(root, new THREE.BoxGeometry(0.2, 0.2, 0.2), EM(neons[i % 3], 2.2), p.position.x, 2.6, p.position.z, false); }
  }
  if (id === 'ruins') {
    const sand = stoneTex([172, 132, 96], [R / 3.4, R / 3.4], 3), fm = S('#fff', 0.95); fm.map = sand; fm.bumpMap = sand; fm.bumpScale = 2;
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 1.5, 1.2, 40, 1), fm); fl.position.y = -0.6; fl.receiveShadow = true; root.add(fl);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 + 0.2, r = rand(R - 6, R - 2); pillar(root, Math.cos(a) * r, Math.sin(a) * r, rand(8, 12), '#c8a37a', circles, i % 3 === 0); }
    rockField(root, 16, 14, 28, circles, ['#8a5a3c', '#6e4630'], 0.8, 2); rockField(root, 22, R + 6, R + 70, null, ['#7a4a30', '#5a3422'], 4, 14);
    const fl2 = []; for (let i = 0; i < 12; i++) { const a = rand(0, 6.28), r = rand(40, 80); const rk = add(root, new THREE.DodecahedronGeometry(1, 0), S('#8a5a3c', 0.95), Math.cos(a) * r, rand(8, 30), Math.sin(a) * r); rk.scale.setScalar(rand(2, 6)); fl2.push([rk, rand(0.2, 0.6)]); }
    upd.push((t) => fl2.forEach(([m, s], i) => { m.position.y += Math.sin(t * s + i) * 0.01; m.rotation.y += 0.002; }));
    const em = { t: 0 }; upd.push((t, dt) => { em.t += dt; if (em.t > 0.04) { em.t = 0; fx.emit(new THREE.Vector3(rand(-35, 35), rand(0, 3), rand(-35, 35)), { x: rand(-1, 1), y: rand(1, 3), z: rand(-1, 1) }, '#ffb070', 0.35, 4, { drag: 0.3, bright: 1.1 }); } });
  }
  if (id === 'shrine' || id === 'dojo') { campusHall(root, -R - 14, -8, 22, 10, 1.4, null, 2); campusHall(root, R + 14, 6, 22, 10, -1.5, null, 1); campusHall(root, 6, -R - 16, 26, 10, 0, null, 2); fivePagoda(root, -R - 10, 24, null); campusWall(root, R + 4, 5); }
  if (id === 'shrine') { backdrop(root, id, R, upd, { m1: '4a2a34', m2: '2a1a28', trees: 260, leaf: '#1a2a1c', cloud: '#5a3040' }); groundDetail(root, R, { rocks: 12, tufts: 160, tuftCol: '#3a5a30' }); }
  if (id === 'ruins') { backdrop(root, id, R, upd, { m1: '5a2a20', m2: '3a1a14', trees: 0, cloud: '#6a3020' }); }
  if (id === 'dojo') { backdrop(root, id, R, upd, { m1: '3a4a5a', m2: '2a3644', trees: 300, leaf: '#1c3a28' }); }
  return { kind: 'arena', id, root, circles, bounds: R - 1.2, lights, update(t, dt, p) { upd.forEach(f => f(t, dt)); lights.follow(p); } };
}

export function buildCreateScene(scene) {
  scene.background = new THREE.Color('#0f0d1c'); scene.fog = new THREE.Fog('#0f0d1c', 14, 40);
  scene.environment = scene.userData.env; scene.environmentIntensity = 0.25;
  const key = new THREE.SpotLight('#fff1dd', 70, 30, 0.6, 0.6, 1.6); key.position.set(3, 7, 6); key.target.position.set(0, 1.5, 0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03;
  const rim = new THREE.SpotLight('#6aa8ff', 90, 30, 0.7, 0.6, 1.6); rim.position.set(-5, 5, -5); rim.target.position.set(0, 1.5, 0);
  const rim2 = new THREE.SpotLight('#ff6ac8', 45, 30, 0.7, 0.6, 1.6); rim2.position.set(5, 3, -4); rim2.target.position.set(0, 1.5, 0);
  scene.add(key, key.target, rim, rim.target, rim2, rim2.target, new THREE.HemisphereLight('#8aa0ff', '#201830', 0.4));
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.3, 48), S('#2a2540', 0.35, 0.6)); ped.position.y = -0.15; ped.receiveShadow = true; scene.add(ped);
  const rg = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.04, 8, 64), EM('#7fc7ff', 2)); rg.rotation.x = Math.PI / 2; rg.position.y = 0.01; scene.add(rg);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), S('#14122a', 0.5, 0.5)); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.3; floor.receiveShadow = true; scene.add(floor);
  return { ped };
}
