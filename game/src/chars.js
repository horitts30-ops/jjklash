import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { damp, lerp, clamp, rand } from './fx.js';

export const SKINS = ['#f6d3b6', '#e8b894', '#c68b62', '#a0693f', '#6e4328', '#f2e0d0', '#fbe6d8', '#8a5a3c'];
export const HAIR_COLORS = [['#1b1b22', 0], ['#4a2c1a', 0], ['#a8742f', 0], ['#e8d9a0', 0], ['#f0f0f5', 100], ['#d94f7a', 100], ['#3b6fe0', 100], ['#43c38b', 150], ['#8a4fff', 150],
  ['#c0392b', 100], ['#ff8a2b', 100], ['#2fd0c8', 120], ['#7fb2ff', 100], ['#a9b1c0', 80], ['#ffd23f', 100], ['#ff6fd8', 150], ['#1a2a6c', 100], ['#e8e4ff', 150], ['#3a0d4a', 120], ['#0f6b3a', 120], ['#8a1c1c', 100], ['#6b3b1d', 0], ['#00e5ff', 200], ['#ff2f4f', 200]];
export const FACES = ['Neutral', 'Smiling', 'Confident', 'Serious', 'Angry', 'Sleepy', 'Mischievous'];
export const HAIRS = [['Spiky', 0], ['Short Crop', 0], ['Long', 0], ['Bob', 0], ['Twin Tails', 200], ['Mohawk', 200],
  ['Ponytail', 80], ['Double Buns', 120], ['Slick Back', 80], ['Undercut Quiff', 100], ['Side Swoop', 80], ['Messy Layers', 100], ['Long Braid', 150], ['Topknot', 120],
  ['Wild Spikes', 150], ['Curtains', 60], ['Afro Puff', 140], ['Pigtail Braids', 150], ['Dreadlocks', 200], ['Hime Cut', 150], ['Shaggy Mullet', 120], ['Buzz Cut', 40]];
// [name, color, price, style]  style: 0 uniform, 1 hoodie, 2 long coat, 3 cloak, 4 robe
export const OUTFITS = [['Academy Navy', '#1d2b4f', 0, 0], ['Crimson Guard', '#7a1f2b', 150, 0], ['Forest Warden', '#1f5a3a', 150, 0], ['Void Black', '#15151b', 200, 0], ['Ivory Monk', '#d9d4c3', 200, 4], ['Royal Violet', '#4b2a86', 250, 0],
  ['Shadow Hoodie', '#2a2a3c', 150, 1], ['Storm Coat', '#35495e', 200, 2], ['Crimson Cloak', '#8a1a2a', 250, 3], ['Temple Robe', '#e8e0d0', 200, 4], ['Golden Hakama', '#c8a24a', 300, 4], ['Neon Techwear', '#1c1c26', 250, 1], ['Ash Longcoat', '#5a5560', 220, 2], ['Teal Traveler', '#1f6b6b', 180, 3]];
export const ACCS = [['None', 0], ['Headband', 100], ['Mask', 120], ['Halo', 250], ['Visor', 150], ['Eye Patch', 90], ['Scarf', 110], ['Oni Horns', 200], ['Cat Ears', 150], ['Pauldron', 180], ['Round Glasses', 90]];
export const AURAS = [['None', 0, '#ffffff'], ['Azure Aura', 300, '#4fa8ff'], ['Crimson Aura', 300, '#ff3b4f'], ['Gold Aura', 400, '#ffd24f'], ['Violet Aura', 400, '#b366ff'], ['Jade Aura', 400, '#43e39b']];
export const POSES = [['Fist Raise', 0], ['Arms Crossed', 100], ['Bow', 100], ['Peace Sign', 150]];
export const DEFAULT_APP = { gender: 'm', skin: 0, face: 0, hair: 0, hairColor: 0, outfit: 0, acc: 0, aura: 0, pose: 0 };

function std(color, rough = 0.75, metal = 0, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }); }

function faceTexture(skin, idx) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = skin; x.fillRect(0, 0, 256, 256);
  const ink = '#1a1626';
  const eye = (cx, cy, rx, ry, lid = 0, tilt = 0) => {
    x.save(); x.translate(cx, cy); x.rotate(tilt);
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, rx + 3, ry + 3, 0, 0, 7); x.fill();
    x.fillStyle = ink; x.beginPath(); x.ellipse(0, 2, rx, ry, 0, 0, 7); x.fill();
    x.fillStyle = '#6a7cff'; x.beginPath(); x.ellipse(0, ry * 0.35, rx * 0.7, ry * 0.45, 0, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(-rx * 0.35, -ry * 0.35, rx * 0.3, 0, 7); x.fill(); x.beginPath(); x.arc(rx * 0.3, ry * 0.3, rx * 0.15, 0, 7); x.fill();
    if (lid > 0) { x.fillStyle = skin; x.fillRect(-rx - 6, -ry - 6, rx * 2 + 12, (ry * 2 + 10) * lid); x.fillStyle = ink; x.fillRect(-rx - 6, -ry - 6 + (ry * 2 + 10) * lid, rx * 2 + 12, 4); }
    x.restore();
  };
  const brow = (x1, y1, x2, y2) => { x.strokeStyle = ink; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); };
  const mouth = (kind) => {
    x.strokeStyle = ink; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath();
    if (kind === 'flat') { x.moveTo(108, 196); x.lineTo(148, 196); }
    else if (kind === 'smile') { x.arc(128, 178, 28, 0.25, Math.PI - 0.25); }
    else if (kind === 'smirk') { x.moveTo(104, 196); x.quadraticCurveTo(138, 204, 158, 182); }
    else if (kind === 'frown') { x.arc(128, 216, 24, Math.PI + 0.35, -0.35); }
    else if (kind === 'small') { x.arc(128, 192, 12, 0, 7); x.fillStyle = '#7a2a3a'; x.fill(); }
    x.stroke();
  };
  const L = 78, R = 178, ey = 118;
  switch (idx) {
    case 1: eye(L, ey, 18, 26); eye(R, ey, 18, 26); brow(54, 76, 100, 70); brow(156, 70, 202, 76); mouth('smile'); break;
    case 2: eye(L, ey, 19, 26, 0.18); eye(R, ey, 19, 26, 0.18); brow(54, 78, 102, 68); brow(154, 68, 202, 78); mouth('smirk'); break;
    case 3: eye(L, ey, 17, 25, 0.1); eye(R, ey, 17, 25, 0.1); brow(54, 74, 102, 74); brow(154, 74, 202, 74); mouth('flat'); break;
    case 4: eye(L, ey, 17, 25, 0.28, 0.12); eye(R, ey, 17, 25, 0.28, -0.12); brow(52, 62, 104, 84); brow(152, 84, 204, 62); mouth('frown'); break;
    case 5: eye(L, ey + 8, 18, 24, 0.55); eye(R, ey + 8, 18, 24, 0.55); brow(56, 84, 100, 80); brow(156, 80, 200, 84); mouth('small'); break;
    case 6: eye(L, ey, 18, 26, 0.12, 0.1); eye(R, ey, 18, 26); brow(54, 80, 100, 66); brow(156, 72, 202, 74); mouth('smirk'); break;
    default: eye(L, ey, 18, 26); eye(R, ey, 18, 26); brow(56, 76, 100, 74); brow(156, 74, 200, 76); mouth('flat');
  }
  x.fillStyle = 'rgba(255,120,120,0.18)'; x.beginPath(); x.ellipse(50, 160, 18, 10, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(206, 160, 18, 10, 0, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

const rb = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 3, r);
const OUTLINE = new THREE.MeshBasicMaterial({ color: '#0c0a16', side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2, fog: false });
const _bb = new THREE.Box3(), _ct = new THREE.Vector3(), _sz = new THREE.Vector3();
// outline hull: constant thickness on every axis, scaled about the geometry's own centre (a uniform 1.07 scale shifted/thickened off-centre parts and z-fought differently per GPU)
function fitOutline(o, geo, w = 0.028) { if (!geo.boundingBox) geo.computeBoundingBox(); _bb.copy(geo.boundingBox); _bb.getCenter(_ct); _bb.getSize(_sz); const sx = 1 + 2 * w / Math.max(_sz.x, 0.06), sy = 1 + 2 * w / Math.max(_sz.y, 0.06), sz = 1 + 2 * w / Math.max(_sz.z, 0.06); o.scale.set(sx, sy, sz); o.position.set(_ct.x * (1 - sx), _ct.y * (1 - sy), _ct.z * (1 - sz)); }

export function makeChar(app = DEFAULT_APP) {
  const root = new THREE.Group();
  const own = [], sway = [];
  const M = (c, r, m, e) => { const m2 = std(c, r, m, e); own.push(m2); return m2; };
  const skin = SKINS[app.skin] || SKINS[0], oc = OUTFITS[app.outfit] || OUTFITS[0], outfit = oc[1], style = oc[3] || 0;
  const dark = new THREE.Color(outfit).multiplyScalar(0.55).getStyle(), light = new THREE.Color(outfit).multiplyScalar(1.5).getStyle();
  const matSkin = M(skin, 0.6), matOut = M(outfit, 0.7), matDark = M(dark, 0.75), matLight = M(light, 0.6), matShoe = M('#15151a', 0.5, 0.1), matGold = M('#e8c25a', 0.3, 0.9);
  const matHair = M(HAIR_COLORS[app.hairColor]?.[0] || '#1b1b22', 0.5);
  const hairLight = M(new THREE.Color(HAIR_COLORS[app.hairColor]?.[0] || '#1b1b22').multiplyScalar(1.35).getStyle(), 0.4);
  const mk = (geo, mat, x = 0, y = 0, z = 0, parent = root, outline = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); if (outline) { const o = new THREE.Mesh(geo, OUTLINE); fitOutline(o, geo); o.castShadow = false; o.receiveShadow = false; o.renderOrder = -1; o.userData.outline = true; m.add(o); } return m; };
  const pivot = (x, y, z, parent = root) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const female = app.gender === 'f';

  // ---- legs (thigh -> knee -> shin) ----
  const L = {};
  for (const s of [-1, 1]) {
    const th = pivot(s * 0.2, 0.84, 0), kn = pivot(0, -0.42, 0, th), ft = pivot(0, -0.4, 0, kn);
    mk(rb(0.36, 0.46, 0.4, 0.07), female ? matSkin : matDark, 0, -0.2, 0, th);
    mk(rb(0.34, 0.44, 0.38, 0.06), female ? matSkin : matDark, 0, -0.2, 0, kn);
    if (female) mk(rb(0.355, 0.26, 0.395, 0.05), M('#24242c', 0.8), 0, -0.26, 0, kn);
    mk(rb(0.4, 0.17, 0.52, 0.06), matShoe, 0, -0.04, 0.05, ft); mk(rb(0.41, 0.05, 0.53, 0.02), matLight, 0, -0.1, 0.05, ft, false);
    L[s] = { th, kn, ft };
  }
  // ---- torso ----
  const torso = pivot(0, 0.84, 0);
  mk(rb(0.96, 0.92, 0.52, 0.09), matOut, 0, 0.46, 0, torso);
  mk(rb(0.5, 0.14, 0.56, 0.04), style === 1 ? matDark : matLight, 0, 0.94, 0, torso);
  if (style === 0) for (let i = 0; i < 3; i++) mk(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), matGold, 0, 0.18 + i * 0.22, 0.27, torso, false).rotation.x = Math.PI / 2;
  mk(rb(1.0, 0.1, 0.56, 0.03), style === 4 ? matGold : matDark, 0, 0.05, 0, torso);
  if (style === 1) { mk(rb(0.7, 0.28, 0.1, 0.04), matDark, 0, 0.2, 0.28, torso); const hood = mk(rb(0.8, 0.34, 0.32, 0.1), matOut, 0, 1.0, -0.26, torso); hood.rotation.x = 0.3; }
  if (style === 2) { for (const s of [-1, 1]) { const tail = pivot(s * 0.3, 0.08, 0, torso); mk(rb(0.42, 0.95, 0.5, 0.05), matOut, 0, -0.45, 0, tail); sway.push({ g: tail, ax: 0, amp: 0.4, spd: 1.2, sx: true }); } mk(rb(1.0, 0.1, 0.56, 0.02), matLight, 0, 0.64, 0.01, torso, false); }
  if (style === 3) { const cape = pivot(0, 0.94, -0.3, torso); mk(rb(1.15, 1.35, 0.12, 0.05), matOut, 0, -0.62, -0.05, cape); mk(rb(1.2, 0.2, 0.2, 0.06), matLight, 0, 0.05, 0.0, cape); sway.push({ g: cape, ax: 0, amp: 0.55, spd: 1.0, sx: true, base: 0.08 }); }
  if (style === 4) { mk(rb(0.46, 0.7, 0.06, 0.02), matLight, 0, 0.5, 0.27, torso, false).rotation.z = 0.5; mk(rb(0.46, 0.7, 0.06, 0.02), matDark, 0, 0.5, 0.28, torso, false).rotation.z = -0.5; for (const s of [-1, 1]) { const f = pivot(s * 0.28, 0.02, 0.0, torso); mk(rb(0.34, 0.8, 0.48, 0.05), matOut, 0, -0.4, 0, f); sway.push({ g: f, ax: 0, amp: 0.3, spd: 1.4 }); } }
  if (female && style !== 2 && style !== 4) mk(new THREE.CylinderGeometry(0.5, 0.62, 0.3, 4, 1), matDark, 0, -0.04, 0, torso).rotation.y = Math.PI / 4;
  // ---- arms (shoulder -> elbow -> hand) ----
  const Ar = {};
  for (const s of [-1, 1]) {
    const sh = pivot(s * 0.66, 0.86, 0, torso), el = pivot(0, -0.36, 0, sh), hand = pivot(0, -0.34, 0, el);
    mk(rb(0.32, 0.4, 0.33, 0.07), matOut, 0, -0.17, 0, sh); mk(rb(0.3, 0.38, 0.31, 0.06), style === 4 ? matLight : matOut, 0, -0.15, 0, el);
    mk(rb(0.28, 0.26, 0.28, 0.07), matSkin, 0, -0.1, 0, hand);
    if (style === 4 || style === 3) mk(rb(0.4, 0.34, 0.4, 0.06), matLight, 0, -0.13, 0, el, false);
    Ar[s] = { sh, el, hand };
  }
  // ---- head ----
  const head = pivot(0, 0.96, 0, torso);
  const ft = faceTexture(skin, app.face);
  const faceMat = new THREE.MeshStandardMaterial({ map: ft, roughness: 0.6 }); own.push(faceMat);
  const hm = new THREE.Mesh(rb(0.7, 0.68, 0.7, 0.11), [matSkin, matSkin, matSkin, matSkin, faceMat, matSkin]);
  hm.position.y = 0.36; hm.castShadow = hm.receiveShadow = true; head.add(hm);
  const hog = rb(0.7, 0.68, 0.7, 0.11), ho = new THREE.Mesh(hog, OUTLINE); fitOutline(ho, hog, 0.032); ho.renderOrder = -1; hm.add(ho);
  mk(rb(0.1, 0.2, 0.08, 0.03), matSkin, -0.37, 0.34, 0.02, head, false); mk(rb(0.1, 0.2, 0.08, 0.03), matSkin, 0.37, 0.34, 0.02, head, false); // ears
  // ---- hair ----
  const hairG = new THREE.Group(); hairG.position.y = 0.36; head.add(hairG);
  const H = (geo, mat, x, y, z) => mk(geo, mat || matHair, x, y, z, hairG);
  const cone = (r, h, seg = 5) => new THREE.ConeGeometry(r, h, seg);
  const cyl = (r1, r2, h, seg = 8) => new THREE.CylinderGeometry(r1, r2, h, seg);
  const sph = (r) => new THREE.SphereGeometry(r, 14, 10);
  const swing = (x, y, z, amp = 0.5, spd = 1.6) => { const g = pivot(x, y, z, hairG); sway.push({ g, ax: 0, amp, spd, hair: true }); return g; };
  const fringe = (h = 0.2) => H(rb(0.78, h, 0.16, 0.05), 0, 0, 0.2 + (0.2 - h) * 0.2, 0.38);
  const cap = (h = 0.24) => H(rb(0.76, h, 0.76, 0.08), 0, 0, 0.3, -0.01);
  const hs = app.hair;
  switch (hs) {
    case 0: cap(); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; const sp = H(cone(0.14, 0.4), 0, Math.cos(a) * 0.26, 0.5, Math.sin(a) * 0.26); sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); } H(cone(0.16, 0.45), 0, 0, 0.56, 0); fringe(0.16); break;
    case 1: cap(); fringe(); H(rb(0.12, 0.4, 0.7, 0.04), 0, -0.38, 0.05, 0); H(rb(0.12, 0.4, 0.7, 0.04), 0, 0.38, 0.05, 0); H(rb(0.78, 0.5, 0.14, 0.05), 0, 0, 0.05, -0.38); break;
    case 2: cap(); fringe(); H(rb(0.13, 1.0, 0.7, 0.04), 0, -0.39, -0.2, -0.02); H(rb(0.13, 1.0, 0.7, 0.04), 0, 0.39, -0.2, -0.02); { const b = swing(0, 0.1, -0.4, 0.35, 1.4); mk(rb(0.8, 1.3, 0.16, 0.05), matHair, 0, -0.55, 0, b); } break;
    case 3: cap(); fringe(0.22); H(rb(0.14, 0.62, 0.74, 0.05), 0, -0.4, -0.02, -0.02); H(rb(0.14, 0.62, 0.74, 0.05), 0, 0.4, -0.02, -0.02); H(rb(0.8, 0.62, 0.16, 0.05), 0, 0, -0.02, -0.4); break;
    case 4: cap(); fringe(); for (const s of [-1, 1]) { H(rb(0.22, 0.2, 0.22, 0.05), 0, s * 0.5, 0.15, -0.1); const t = swing(s * 0.54, 0.05, -0.1, 0.5, 1.8 + s * 0.2); mk(rb(0.2, 0.9, 0.2, 0.06), matHair, 0, -0.45, 0, t); } break;
    case 5: H(rb(0.18, 0.34, 0.8, 0.05), 0, 0, 0.55, 0); H(rb(0.78, 0.14, 0.16, 0.05), 0, 0, 0.22, 0.38); H(rb(0.76, 0.1, 0.76, 0.04), 0, 0, 0.27, 0); break;
    case 6: cap(); fringe(0.18); { H(rb(0.24, 0.2, 0.24, 0.06), 0, 0, 0.18, -0.42); const t = swing(0, 0.18, -0.45, 0.6, 2.2); mk(rb(0.22, 0.95, 0.22, 0.08), matHair, 0, -0.45, -0.04, t); mk(rb(0.18, 0.2, 0.18, 0.06), matHair, 0, -0.98, -0.04, t); } break;
    case 7: cap(0.2); fringe(0.18); for (const s of [-1, 1]) { H(sph(0.22), 0, s * 0.3, 0.62, -0.05); H(rb(0.14, 0.1, 0.14, 0.04), matGold, s * 0.3, 0.45, -0.05); } break;
    case 8: cap(0.3); H(rb(0.8, 0.22, 0.5, 0.08), 0, 0, 0.45, -0.12).rotation.x = -0.2; H(rb(0.76, 0.5, 0.14, 0.05), 0, 0, 0.05, -0.38); H(rb(0.1, 0.3, 0.6, 0.04), 0, -0.38, 0.1, -0.05); H(rb(0.1, 0.3, 0.6, 0.04), 0, 0.38, 0.1, -0.05); break;
    case 9: cap(0.14); H(rb(0.72, 0.28, 0.6, 0.08), 0, 0, 0.5, 0.0); { const q = H(rb(0.6, 0.22, 0.3, 0.07), hairLight, 0, 0.55, 0.3); q.rotation.x = 0.5; } H(rb(0.76, 0.46, 0.14, 0.05), 0, 0, 0.02, -0.38); break;
    case 10: cap(); H(rb(0.8, 0.2, 0.18, 0.05), 0, 0, 0.28, 0.36); { const sw2 = H(rb(0.56, 0.2, 0.14, 0.05), 0, 0.14, 0.12, 0.42); sw2.rotation.z = -0.55; const sw3 = H(rb(0.3, 0.2, 0.14, 0.05), hairLight, 0.34, -0.06, 0.4); sw3.rotation.z = -0.9; } H(rb(0.12, 0.4, 0.7, 0.04), 0, -0.38, 0.05, 0); H(rb(0.12, 0.4, 0.7, 0.04), 0, 0.38, 0.05, 0); H(rb(0.78, 0.4, 0.14, 0.05), 0, 0, 0.05, -0.38); break;
    case 11: cap(); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + rand(-0.2, 0.2); const c = H(rb(rand(0.2, 0.34), rand(0.26, 0.5), rand(0.2, 0.34), 0.06), i % 3 ? matHair : hairLight, Math.cos(a) * rand(0.18, 0.36), rand(0.32, 0.55), Math.sin(a) * rand(0.18, 0.36)); c.rotation.set(rand(-0.6, 0.6), rand(0, 3), rand(-0.6, 0.6)); } fringe(0.18); break;
    case 12: cap(); fringe(); H(rb(0.12, 0.4, 0.7, 0.04), 0, -0.38, 0.05, 0); H(rb(0.12, 0.4, 0.7, 0.04), 0, 0.38, 0.05, 0); { const b = swing(0, 0.12, -0.4, 0.5, 1.7); for (let i = 0; i < 6; i++) mk(rb(0.26 - i * 0.015, 0.3, 0.2, 0.07), i % 2 ? matHair : hairLight, (i % 2 ? 0.05 : -0.05), -0.12 - i * 0.26, 0, b); H(rb(0.1, 0.1, 0.1, 0.03), matGold, 0, -0.15, -0.38); } break;
    case 13: cap(0.2); fringe(0.16); H(rb(0.12, 0.3, 0.7, 0.04), 0, -0.38, 0.1, 0); H(rb(0.12, 0.3, 0.7, 0.04), 0, 0.38, 0.1, 0); H(sph(0.24), 0, 0, 0.64, -0.12); H(rb(0.3, 0.08, 0.3, 0.03), matGold, 0, 0.45, -0.1); H(rb(0.76, 0.3, 0.14, 0.05), 0, 0, 0.12, -0.38); break;
    case 14: cap(); for (let i = 0; i < 11; i++) { const a = i / 11 * 6.283; const sp = H(cone(0.15, 0.62, 5), i % 2 ? matHair : hairLight, Math.cos(a) * 0.27, 0.55, Math.sin(a) * 0.27); sp.rotation.set(Math.sin(a) * 0.85 - 0.25, 0, -Math.cos(a) * 0.85); } H(cone(0.18, 0.75), 0, 0, 0.7, -0.05); for (let i = 0; i < 3; i++) { const s = H(cone(0.12, 0.4, 4), 0, -0.2 + i * 0.2, 0.26, 0.4); s.rotation.x = Math.PI + 0.5; } break;
    case 15: cap(0.2); for (const s of [-1, 1]) { const c = H(rb(0.44, 0.4, 0.14, 0.06), 0, s * 0.22, 0.12, 0.4); c.rotation.z = s * 0.28; } H(rb(0.12, 0.4, 0.7, 0.04), 0, -0.38, 0.0, 0); H(rb(0.12, 0.4, 0.7, 0.04), 0, 0.38, 0.0, 0); H(rb(0.78, 0.5, 0.14, 0.05), 0, 0, 0.0, -0.38); break;
    case 16: H(sph(0.62), 0, 0, 0.35, -0.12).scale.set(1.05, 0.85, 1.0); H(rb(0.6, 0.12, 0.12, 0.04), matHair, 0, 0.26, 0.36); break;
    case 17: cap(); fringe(); for (const s of [-1, 1]) { H(rb(0.1, 0.1, 0.1, 0.03), matGold, s * 0.46, 0.0, 0.0); const t = swing(s * 0.5, -0.02, 0.0, 0.6, 1.9 + s * 0.15); for (let i = 0; i < 5; i++) mk(rb(0.22 - i * 0.012, 0.28, 0.2, 0.07), i % 2 ? matHair : hairLight, i % 2 ? 0.03 : -0.03, -0.14 - i * 0.24, 0, t); } break;
    case 18: cap(); fringe(0.16); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; const t = swing(Math.cos(a) * 0.36, 0.2, Math.sin(a) * 0.36, 0.5, 1.5 + (i % 3) * 0.3); mk(cyl(0.07, 0.05, 0.85, 6), i % 2 ? matHair : hairLight, 0, -0.42, 0, t); } break;
    case 19: cap(); H(rb(0.8, 0.26, 0.14, 0.03), 0, 0, 0.12, 0.4); H(rb(0.14, 1.0, 0.16, 0.04), 0, -0.36, -0.3, 0.2); H(rb(0.14, 1.0, 0.16, 0.04), 0, 0.36, -0.3, 0.2); H(rb(0.14, 1.1, 0.7, 0.04), 0, -0.39, -0.25, -0.02); H(rb(0.14, 1.1, 0.7, 0.04), 0, 0.39, -0.25, -0.02); { const b = swing(0, 0.1, -0.4, 0.3, 1.3); mk(rb(0.82, 1.3, 0.14, 0.05), matHair, 0, -0.55, 0, b); } break;
    case 20: cap(0.22); fringe(0.16); for (let i = 0; i < 6; i++) { const c = H(rb(0.2, 0.3, 0.2, 0.06), i % 2 ? matHair : hairLight, rand(-0.25, 0.25), 0.45, rand(-0.25, 0.25)); c.rotation.set(rand(-0.5, 0.5), 0, rand(-0.5, 0.5)); } { const b = swing(0, 0.1, -0.4, 0.45, 1.6); mk(rb(0.6, 0.7, 0.16, 0.06), matHair, 0, -0.3, 0, b); mk(rb(0.4, 0.4, 0.14, 0.06), hairLight, 0, -0.8, 0, b); } H(rb(0.1, 0.34, 0.5, 0.04), 0, -0.38, 0.0, -0.1); H(rb(0.1, 0.34, 0.5, 0.04), 0, 0.38, 0.0, -0.1); break;
    case 21: H(rb(0.74, 0.1, 0.74, 0.04), 0, 0, 0.34, -0.01); break;
    default: cap();
  }
  // ---- accessories ----
  const ac = app.acc;
  if (ac === 1) { mk(rb(0.74, 0.1, 0.74, 0.03), M('#e8e8f0', 0.5), 0, 0.2, 0, hairG); mk(rb(0.16, 0.12, 0.1, 0.03), M('#e8e8f0', 0.5), 0.0, 0.2, -0.4, hairG); }
  if (ac === 2) mk(rb(0.6, 0.28, 0.1, 0.04), M('#f0f0f4', 0.5), 0, -0.2, 0.37, hairG);
  if (ac === 3) { const h = mk(new THREE.TorusGeometry(0.34, 0.035, 8, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe9a0').multiplyScalar(2.5), toneMapped: false }), 0, 0.85, 0, hairG, false); h.rotation.x = Math.PI / 2; h.castShadow = false; }
  if (ac === 4) mk(rb(0.74, 0.22, 0.1, 0.04), M('#0a0a14', 0.2, 0.6, { emissive: new THREE.Color('#2a6cff'), emissiveIntensity: 0.6 }), 0, 0.05, 0.37, hairG);
  if (ac === 5) { mk(rb(0.2, 0.2, 0.06, 0.03), M('#14121a', 0.5), 0.17, 0.02, 0.37, hairG); mk(rb(0.78, 0.04, 0.74, 0.01), M('#14121a', 0.5), 0, 0.1, 0, hairG, false).rotation.z = 0.12; }
  if (ac === 6) { mk(rb(0.78, 0.24, 0.68, 0.08), M('#c8483a', 0.8), 0, 0.88, 0, torso); const t = pivot(0.3, 0.9, -0.34, torso); mk(rb(0.2, 0.8, 0.08, 0.03), M('#c8483a', 0.8), 0, -0.4, 0, t); sway.push({ g: t, ax: 0, amp: 0.7, spd: 2.2 }); }
  if (ac === 7) for (const s of [-1, 1]) { const h = mk(cone(0.1, 0.34, 6), M('#e8e0c8', 0.4), s * 0.24, 0.58, 0.1, hairG); h.rotation.z = -s * 0.35; }
  if (ac === 8) for (const s of [-1, 1]) { const h = mk(cone(0.17, 0.32, 4), matHair, s * 0.24, 0.56, 0, hairG); h.rotation.z = -s * 0.2; }
  if (ac === 9) { mk(rb(0.5, 0.2, 0.5, 0.08), matGold, 0.68, 1.78, 0, torso); mk(rb(0.1, 0.34, 0.1, 0.03), matGold, 0.76, 1.95, 0, torso); }
  if (ac === 10) for (const s of [-1, 1]) { const g = mk(new THREE.TorusGeometry(0.11, 0.02, 6, 16), M('#222', 0.3, 0.8), s * 0.18, 0.06, 0.37, hairG, false); }

  const getHand = (side, out) => Ar[side].hand.getWorldPosition(out);
  const ch = {
    group: root, parts: { torso, head }, mats: own, getHand, Ar, L,
    s: { run: 0, air: false, vy: 0, atk: null, block: false, stun: false, launched: 0, ko: false, cast: 0, pose: 0, tilt: 0, spin: 0, dash: 0, sprint: 0, hit: 0 },
    phase: Math.random() * 6, t: Math.random() * 10, flashV: 0, prevAir: false, land: 0, atkPrev: null, hitK: 0,
    flash(v) { ch.flashV = v; ch.s.hit = 1; },
    update(dt) {
      const s = ch.s; ch.t += dt; ch.phase += dt * (5 + s.run * 10 + s.sprint * 3) * (s.run > 0.05 ? 1 : 0.2);
      const k = 20; const sw = Math.sin(ch.phase), sw2 = Math.cos(ch.phase);
      const run = s.run;
      // targets
      let sL = sw * run * 1.05, sR = -sw * run * 1.05, eL = -0.15 - Math.max(0, -sw) * run * 1.0, eR = -0.15 - Math.max(0, sw) * run * 1.0, aLz = -0.08, aRz = 0.08;
      let hL = -sw * run * 1.0, hR = sw * run * 1.0, kL = Math.max(0, sw) * run * 1.3, kR = Math.max(0, -sw) * run * 1.3, tY = 0, tX = 0.0 + run * 0.12 + s.sprint * 0.08, tZ = 0, hX = 0, bodyY = 0, rootY = 0, hY = 0;
      const breathe = Math.sin(ch.t * 2.2) * 0.022; const idle = 1 - clamp(run * 3, 0, 1);
      sL += Math.sin(ch.t * 1.6) * 0.05 * idle; sR -= Math.sin(ch.t * 1.6) * 0.05 * idle; aLz -= breathe * 2; aRz += breathe * 2;
      if (idle > 0.5 && !s.air) { hL = -0.12; hR = 0.12; kL = 0.3; kR = 0.08; tY = Math.sin(ch.t * 0.9) * 0.05; hY = Math.sin(ch.t * 0.7) * 0.12; bodyY = -0.05; } // relaxed fighting stance
      if (s.air && !s.ko) { sL = -1.2; sR = -0.5; eL = -0.5; eR = -0.9; aLz = -0.7; aRz = 0.7; hL = 0.7; hR = -0.5; kL = 0.9; kR = 0.5; tX = 0.05; }
      if (s.dash) { sL = 0.9; sR = 0.7; eL = -0.3; eR = -0.3; aLz = -0.25; aRz = 0.25; hL = -0.9; hR = 0.9; kL = 0.2; kR = 1.3; tX = 0.8; hX = -0.3; }
      if (s.cast === 1) { sL = -1.55; sR = -1.55; eL = -0.1; eR = -0.1; aLz = -0.12; aRz = 0.12; tX = 0.05; hL = -0.2; hR = 0.2; }
      if (s.cast === 2) { sL = -2.4; sR = -1.4; eL = -0.9; eR = -1.9; aLz = -0.2; aRz = 0.25; tX = -0.15; hX = -0.2; }
      if (s.block) { sL = -1.6; sR = -1.65; eL = -1.4; eR = -1.4; aLz = 0.5; aRz = -0.5; hX = 0.25; tX = 0.15; hL = 0.3; hR = -0.3; kL = 0.5; kR = 0.5; bodyY = -0.1; }
      if (s.pose > 0) { if (s.pose === 1) { sL = sR = -0.2; eL = eR = -1.9; aLz = 0.9; aRz = -0.9; } if (s.pose === 2) { sL = -0.5; sR = -0.5; eL = eR = -1.0; aLz = 0.4; aRz = -0.4; tX = 0.7; hX = 0.3; } if (s.pose === 3) { sR = -2.9; aRz = 0.3; eR = -0.3; sL = 0; aLz = -0.3; tY = 0.2; } if (s.pose === 4) { sR = -2.6; aRz = 0.3; sL = -0.3; } }
      const a = s.atk;
      if (a) {
        const p = clamp(a.p, 0, 1); const wind = p < 0.3 ? p / 0.3 : 1; const strike = p < 0.3 ? 0 : Math.min(1, (p - 0.3) / 0.3); const rec = p < 0.6 ? 0 : (p - 0.6) / 0.4; const w = Math.sin(Math.min(1, p) * Math.PI);
        const st = strike * (1 - rec);
        if (a.kind === 'light') {
          const i = a.idx % 4;
          if (i === 0) { sR = lerp(0.9, -1.55, strike) * (1 - rec) + rec * 0; eR = lerp(-2.0, -0.05, strike) ; tY = lerp(0.5, -0.6, strike) * (1 - rec); sL = -0.6; eL = -1.6; kL = 0.5; kR = 0.2; hL = -0.4; bodyY = -0.06; tX = 0.1; }
          if (i === 1) { sL = lerp(0.9, -1.55, strike) * (1 - rec); eL = lerp(-2.0, -0.05, strike); tY = lerp(-0.5, 0.6, strike) * (1 - rec); sR = -0.6; eR = -1.6; kL = 0.2; kR = 0.5; tX = 0.1; }
          if (i === 2) { // roundhouse kick
            hR = lerp(0.9, -1.6, strike) * (1 - rec * 0.7); kR = lerp(1.6, 0.1, strike); hL = 0.1; kL = 0.5; tY = lerp(0.4, -0.5, strike); tZ = lerp(0, -0.25, strike); sL = -0.9; sR = 0.9; eL = -1.0; eR = -1.0; tX = -0.1 * w; }
          if (i === 3) { // rising uppercut
            sR = lerp(0.5, -3.1, strike) * (1 - rec * 0.6); eR = lerp(-1.5, -0.1, strike); tX = lerp(0.45, -0.3, strike); tY = -0.35 * strike; bodyY = lerp(-0.3, 0.22, strike); kL = lerp(1.0, 0.1, strike); kR = lerp(0.3, 0.9, strike); hL = lerp(-0.7, 0.3, strike); sL = 0.5; eL = -1.4; rootY = 0.0; }
        } else if (a.kind === 'heavy') { const q = p < 0.45 ? p / 0.45 : 1; const sl = p < 0.45 ? 0 : Math.min(1, (p - 0.45) / 0.2); sL = sR = lerp(lerp(0.2, -3.1, q), -0.4, sl); eL = eR = lerp(lerp(-0.2, -0.4, q), -0.1, sl); aLz = -0.1; aRz = 0.1; tX = lerp(-0.3, 0.65, sl); bodyY = lerp(0.05, -0.3, sl); kL = lerp(0.2, 0.9, sl); kR = lerp(0.2, 0.5, sl); hL = lerp(0, -0.9, sl); hR = lerp(0, 0.4, sl); hX = lerp(0, 0.2, sl); }
      }
      if (s.stun) { tX = -0.35; hX = -0.35; sL = 0.4; sR = 0.4; eL = -0.4; eR = -0.4; aLz = -0.6; aRz = 0.6; kL = 0.5; kR = 0.3; hL = -0.3; hR = 0.3; }
      if (s.hit > 0) { tX -= s.hit * 0.35; hX -= s.hit * 0.3; tZ += s.hit * 0.15 * (ch.hitK ? 1 : -1); s.hit = Math.max(0, s.hit - dt * 7); }
      // landing squash
      if (ch.prevAir && !s.air) ch.land = 1; ch.prevAir = s.air; ch.land = Math.max(0, ch.land - dt * 5);
      bodyY -= ch.land * 0.28; kL += ch.land * 0.7; kR += ch.land * 0.7; hL -= ch.land * 0.5; hR -= ch.land * 0.5; tX += ch.land * 0.2;
      const P = ch.parts;
      Ar[-1].sh.rotation.x = damp(Ar[-1].sh.rotation.x, sL, k, dt); Ar[1].sh.rotation.x = damp(Ar[1].sh.rotation.x, sR, k, dt);
      Ar[-1].sh.rotation.z = damp(Ar[-1].sh.rotation.z, aLz, k, dt); Ar[1].sh.rotation.z = damp(Ar[1].sh.rotation.z, aRz, k, dt);
      Ar[-1].el.rotation.x = damp(Ar[-1].el.rotation.x, eL, k, dt); Ar[1].el.rotation.x = damp(Ar[1].el.rotation.x, eR, k, dt);
      L[-1].th.rotation.x = damp(L[-1].th.rotation.x, hL, k, dt); L[1].th.rotation.x = damp(L[1].th.rotation.x, hR, k, dt);
      L[-1].kn.rotation.x = damp(L[-1].kn.rotation.x, kL, k, dt); L[1].kn.rotation.x = damp(L[1].kn.rotation.x, kR, k, dt);
      L[-1].ft.rotation.x = -L[-1].kn.rotation.x * 0.4 - L[-1].th.rotation.x * 0.3; L[1].ft.rotation.x = -L[1].kn.rotation.x * 0.4 - L[1].th.rotation.x * 0.3;
      P.torso.rotation.y = damp(P.torso.rotation.y, tY, 24, dt); P.torso.rotation.x = damp(P.torso.rotation.x, tX, 16, dt); P.torso.rotation.z = damp(P.torso.rotation.z, tZ, 14, dt);
      P.head.rotation.x = damp(P.head.rotation.x, hX, 12, dt); P.head.rotation.y = damp(P.head.rotation.y, hY - tY * 0.6, 10, dt);
      P.torso.position.y = 0.84 + breathe + Math.abs(sw) * run * 0.07 + bodyY;
      L[-1].th.position.y = L[1].th.position.y = 0.84 + Math.min(0, bodyY) * 0.2;
      // cloth / hair secondary motion
      const air = s.air ? 1 : 0;
      for (const w of sway) { const base = w.base || 0; const tx = base + run * w.amp * 0.8 + air * w.amp * 0.5 + Math.sin(ch.t * w.spd * 2 + w.amp * 7) * 0.06 * (1 + run); w.g.rotation.x = damp(w.g.rotation.x, tx, 8, dt); if (w.sx) w.g.rotation.z = Math.sin(ch.t * w.spd * 1.7) * 0.05 + (s.stun ? 0.2 : 0); }
      // tumble / ko
      const targetRX = s.ko ? -Math.PI / 2 : s.launched > 0 ? s.tilt : 0;
      root.rotation.x = damp(root.rotation.x, targetRX, s.ko ? 10 : 14, dt);
      root.userData.koY = damp(root.userData.koY || 0, s.ko ? 0.3 : 0, 10, dt);
      // hit flash
      ch.flashV = Math.max(0, ch.flashV - dt * 6);
      for (const m of ch.mats) if (m.emissive && !m.userData.keepEmit) m.emissive.setScalar(ch.flashV);
    },
    dispose() { ch.mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); root.traverse(o => { if (o.geometry && !o.userData.outline) o.geometry.dispose(); }); },
  };
  return ch;
}

export function labelSprite(text, color = '#ffffff', size = 1) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.font = '800 54px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 10; x.strokeStyle = 'rgba(10,8,20,0.9)'; x.strokeText(text, 256, 50); x.fillStyle = color; x.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, toneMapped: false }));
  sp.scale.set(7 * size, 7 * size * 96 / 512, 1); sp.renderOrder = 20; return sp;
}
