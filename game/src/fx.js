import * as THREE from 'three';

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const VERT = `
attribute float size; attribute float alpha; attribute vec3 aColor;
varying vec3 vC; varying float vA; uniform float uScale;
void main(){ vC=aColor; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
 gl_PointSize=size*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const FRAG = `
varying vec3 vC; varying float vA;
void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); a=a*a*(1.0+2.0*smoothstep(0.18,0.0,d));
 if(a<0.01) discard; gl_FragColor=vec4(vC*(1.0+smoothstep(0.2,0.0,d)*1.4), a*vA); }`;

export class FX {
  constructor(scene) {
    this.scene = scene;
    const N = (this.N = 9000);
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3);
    this.size = new Float32Array(N); this.alpha = new Float32Array(N);
    this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N);
    this.drag = new Float32Array(N); this.grav = new Float32Array(N); this.s0 = new Float32Array(N); this.s1 = new Float32Array(N);
    this.pos.fill(0); this.i = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 600 } };
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 10;
    scene.add(this.points);
    this.fx = [];
    this._c = new THREE.Color();
  }
  setScale(h) { this.uniforms.uScale.value = h * 0.9; }
  emit(p, v, color, size, life, o = {}) {
    const i = this.i; this.i = (this.i + 1) % this.N;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this._c.set(color); const b = o.bright ?? 1.6;
    this.col[i * 3] = this._c.r * b; this.col[i * 3 + 1] = this._c.g * b; this.col[i * 3 + 2] = this._c.b * b;
    this.life[i] = this.max[i] = life; this.drag[i] = o.drag ?? 1.5; this.grav[i] = o.grav ?? 0;
    this.s0[i] = size; this.s1[i] = o.end ?? 0; this.alpha[i] = 1;
  }
  burst(p, color, n = 12, speed = 6, size = 0.4, life = 0.5, o = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(rand(-1, 1)), s = speed * rand(0.3, 1);
      this.emit(p, { x: Math.sin(b) * Math.cos(a) * s, y: Math.abs(Math.cos(b)) * s * (o.up ?? 1) + (o.lift ?? 0), z: Math.sin(b) * Math.sin(a) * s }, color, size * rand(0.6, 1.2), life * rand(0.6, 1.1), o);
    }
  }
  add(obj, life, fn) { this.scene.add(obj); this.fx.push({ obj, life, age: 0, fn }); return obj; }
  mat(color, op = 1) { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }); m.color.multiplyScalar(1.8); return m; }
  ring(p, color, r0, r1, life = 0.4, flat = true) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), this.mat(color));
    m.position.copy(p); if (flat) m.rotation.x = -Math.PI / 2; else m.lookAt(this.cam ? this.cam.position : new THREE.Vector3(0, 0, 10));
    this.add(m, life, (t, o) => { const r = lerp(r0, r1, 1 - (1 - t) * (1 - t)); o.scale.setScalar(r); o.material.opacity = 1 - t; });
    if (flat && r1 > r0 && r1 >= 4) { this.spikes(p, color, Math.min(18, Math.round(r1 * 1.6)), r1 * 0.22, life * 0.9); for (let i = 0; i < Math.min(18, r1 * 2); i++) { const a = i / Math.min(18, r1 * 2) * 6.283; this.emit(p.clone().setY(p.y + 0.15), { x: Math.cos(a) * r1 * 1.5, y: rand(0.5, 2.5), z: Math.sin(a) * r1 * 1.5 }, color, rand(0.15, 0.3), life * 1.2, { drag: 2, bright: 2 }); } }
    return m;
  }
  orb(p, color, r0, r1, life = 0.35) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.mat(color, 0.8)); m.position.copy(p);
    this.add(m, life, (t, o) => { o.scale.setScalar(lerp(r0, r1, Math.sqrt(t))); o.material.opacity = 0.8 * (1 - t); });
    return m;
  }
  beam(a, b, color, w = 0.3, life = 0.25) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), this.mat(color, 0.9));
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    this.add(m, life, (t, o) => { const s = w * (1 - t * 0.8); o.scale.set(s, L, s); o.material.opacity = 0.9 * (1 - t); });
    return m;
  }
  bolt(a, b, color, life = 0.2, w = 0.08) { // jagged lightning
    const pts = [a.clone()]; const d = new THREE.Vector3().subVectors(b, a), n = 8;
    for (let i = 1; i < n; i++) pts.push(a.clone().addScaledVector(d, i / n).add(new THREE.Vector3(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5))));
    pts.push(b.clone());
    for (let i = 0; i < pts.length - 1; i++) { this.beam(pts[i], pts[i + 1], color, w * 2.6, life); this.beam(pts[i], pts[i + 1], '#ffffff', w, life); if (Math.random() < 0.25) { const e = pts[i].clone().add(new THREE.Vector3(rand(-1.2, 1.2), rand(-1.2, 0.4), rand(-1.2, 1.2))); this.beam(pts[i], e, color, w * 1.2, life * 0.8); } }
    this.sparks(b, color, 6, 8, 0.25);
  }

  /* ===== v2 effects ===== */
  slash(p, dirYaw, color = '#ffffff', size = 2.4, roll = 0, life = 0.22, arc = 2.2) { // crescent sweep
    if (!FX._slashGeo) {
      const seg = 28, pos = [], idx = []; const L = 1;
      for (let i = 0; i <= seg; i++) { const a = -0.5 + i / seg; const th = a * 2.2; const tap = Math.pow(Math.sin(Math.PI * i / seg), 0.8); const ro = 1, ri = 1 - 0.34 * tap; pos.push(Math.sin(th) * ro, Math.cos(th) * ro - 1, 0, Math.sin(th) * ri, Math.cos(th) * ri - 1, 0); if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); FX._slashGeo = g;
    }
    const m = new THREE.Mesh(FX._slashGeo, this.mat(color, 1)); m.position.copy(p); m.rotation.order = 'YXZ'; m.rotation.y = dirYaw; m.rotation.z = roll;
    const core = new THREE.Mesh(FX._slashGeo, this.mat('#ffffff', 1)); core.scale.set(0.92, 0.92, 1); m.add(core);
    for (let i = 0; i < Math.round(size * 4); i++) { const a = rand(-1.1, 1.1); const q = new THREE.Vector3(Math.sin(a) * size, Math.cos(a) * size - size, 0).applyEuler(new THREE.Euler(0, dirYaw, roll, 'YXZ')); this.emit(p.clone().add(q), { x: rand(-2, 2), y: rand(-1, 3), z: rand(-2, 2) }, color, rand(0.1, 0.25), life * 2, { drag: 3, bright: 2.2 }); }
    const m2 = new THREE.Mesh(FX._slashGeo, this.mat(color, 0.5)); m2.userData.keepGeo = true; m2.position.copy(p); m2.rotation.order = 'YXZ'; m2.rotation.y = dirYaw; m2.rotation.z = roll + 0.12; this.add(m2, life * 1.6, (t, o) => { o.scale.setScalar(size * (0.9 + 0.7 * t)); o.rotation.x = -0.6 + t * 1.2; o.material.opacity = 0.5 * (1 - t); });
    this.add(m, life, (t, o) => { const e = 1 - (1 - t) * (1 - t); o.scale.setScalar(size * (0.7 + 0.5 * e)); o.rotation.x = -0.9 + e * 1.4; o.material.opacity = 1 - t * t; core.material.opacity = 1 - t; });
    return m;
  }
  shock(p, color = '#ffffff', r1 = 8, life = 0.5, thick = 0.18) { // fast expanding ground shockwave with dust
    const m = new THREE.Mesh(new THREE.RingGeometry(1 - thick, 1, 56), this.mat(color, 1)); m.rotation.x = -Math.PI / 2; m.position.copy(p).setY(p.y + 0.12);
    this.add(m, life, (t, o) => { const e = 1 - Math.pow(1 - t, 3); o.scale.setScalar(Math.max(0.1, r1 * e)); o.material.opacity = (1 - t) * 0.95; });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(color, 0.25)); dome.position.copy(p);
    this.add(dome, life * 0.7, (t, o) => { o.scale.setScalar(Math.max(0.1, r1 * 0.9 * (1 - Math.pow(1 - t, 3)))); o.material.opacity = 0.35 * (1 - t); });
    if (r1 >= 4) { this.spikes(p.clone().setY(p.y + 0.15), color, Math.min(22, Math.round(r1 * 2)), r1 * 0.3, life * 0.9); for (let i = 0; i < 10; i++) this.emit(p.clone().setY(p.y + 0.3), { x: rand(-1.5, 1.5), y: rand(3, 9), z: rand(-1.5, 1.5) }, color, rand(0.3, 0.7), 0.7, { drag: 1, bright: 1.6, end: 0.1 }); }
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; this.emit(p.clone().setY(p.y + 0.2), { x: Math.cos(a) * r1 * 1.4, y: rand(0.2, 1.2), z: Math.sin(a) * r1 * 1.4 }, '#b9a98f', rand(0.8, 1.6), 0.7, { drag: 3, bright: 0.5, end: 2 }); }
  }
  flash(p, color = '#ffffff', size = 3, life = 0.12) { // bright hit flash star
    const g = new THREE.Group(); g.position.copy(p); if (this.cam) g.quaternion.copy(this.cam.quaternion);
    const mm = this.mat(color, 1); mm.color.multiplyScalar(1.6);
    for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 1), mm); sp.rotation.z = k * Math.PI / 4 + rand(-0.1, 0.1); sp.scale.y = rand(0.7, 1.2); g.add(sp); }
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), mm); g.add(c);
    this.add(g, life, (t, o) => { o.scale.setScalar(size * (0.4 + t * 0.9)); mm.opacity = 1 - t; });
  }
  sparks(p, color = '#ffd9a0', n = 14, speed = 12, life = 0.35) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, b = rand(-0.6, 1); const s = speed * rand(0.4, 1); this.emit(p, { x: Math.cos(a) * s, y: b * s * 0.7, z: Math.sin(a) * s }, color, rand(0.12, 0.22), life * rand(0.6, 1.2), { drag: 4.5, grav: 14, bright: 2.2, end: 0 }); } }
  debris(p, color = '#7a6a58', n = 8, speed = 8) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(rand(0.12, 0.4), rand(0.12, 0.4), rand(0.12, 0.4)), new THREE.MeshStandardMaterial({ color, roughness: 0.9 })); m.castShadow = true; m.position.copy(p); const v = new THREE.Vector3(rand(-1, 1), rand(0.6, 1.6), rand(-1, 1)).multiplyScalar(speed * rand(0.4, 1)); const w = new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)); this.add(m, rand(0.9, 1.5), (t, o, dt) => { v.y -= 26 * dt; o.position.addScaledVector(v, dt); if (o.position.y < 0.1) { o.position.y = 0.1; v.multiplyScalar(0.4); v.y = Math.abs(v.y) * 0.3; w.multiplyScalar(0.5); } o.rotation.x += w.x * dt; o.rotation.y += w.y * dt; o.scale.setScalar(1 - Math.max(0, t - 0.7) / 0.3); }); } }
  crack(p, r = 3, color = '#ff8a3a', life = 6) { // ground crack decal with glowing core
    if (!FX._crackTex) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.translate(128, 128); x.lineCap = 'round';
      const branch = (len, w, depth, ang) => { x.save(); x.rotate(ang); x.beginPath(); x.lineWidth = w; x.moveTo(0, 0); let cx = 0, cy = 0; const n = 5; for (let i = 0; i < n; i++) { cx += (Math.random() - 0.5) * len * 0.25; cy += len / n; x.lineTo(cx, cy); } x.stroke(); if (depth > 0) { x.translate(cx * 0.6, cy * 0.6); branch(len * 0.5, w * 0.6, depth - 1, (Math.random() - 0.5) * 1.6); } x.restore(); };
      x.strokeStyle = '#fff'; for (let i = 0; i < 9; i++) branch(rand(60, 120), rand(3, 7), 2, i / 9 * 6.283 + rand(-0.2, 0.2)); FX._crackTex = new THREE.CanvasTexture(c); }
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: FX._crackTex, color: '#0a0806', transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 })); dark.rotation.x = -Math.PI / 2; dark.position.copy(p).setY(0.04); dark.scale.setScalar(r); dark.rotation.z = rand(0, 6);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat(color, 1)); glow.material.map = FX._crackTex; glow.rotation.copy(dark.rotation); glow.position.copy(p).setY(0.05); glow.scale.setScalar(r * 0.98);
    dark.add(new THREE.Object3D()); const grp = new THREE.Group(); grp.add(dark, glow); grp.position.set(0, 0, 0);
    this.add(grp, life, (t, o) => { glow.material.opacity = Math.max(0, 1 - t * 6); dark.material.opacity = 0.85 * (1 - Math.max(0, (t - 0.8) / 0.2)); });
  }
  trail(getPos, color, life = 0.35, w = 0.35, n = 10) { // ribbon trail following a position function; returns stop()
    const pts = []; const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 2 * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const idx = []; for (let i = 0; i < n - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } geo.setIndex(idx);
    const m = new THREE.Mesh(geo, this.mat(color, 0.9)); m.frustumCulled = false; m.userData.keepGeo = false;
    const o = { alive: true, stop() { o.alive = false; } };
    this.add(m, 999, (t, ob, dt) => { if (o.alive) { pts.unshift({ p: getPos().clone(), t: 0 }); if (pts.length > n) pts.pop(); } for (const q of pts) q.t += dt; while (pts.length && pts[pts.length - 1].t > life) pts.pop(); if (!o.alive && pts.length < 2) { this._kill(ob); return; }
      for (let i = 0; i < n; i++) { const q = pts[Math.min(i, pts.length - 1)]; if (!q) { for (let k = 0; k < 6; k++) pos[i * 6 + k] = 0; continue; } const f = 1 - q.t / life; const ww = w * f * 0.5; pos[i * 6] = q.p.x; pos[i * 6 + 1] = q.p.y + ww; pos[i * 6 + 2] = q.p.z; pos[i * 6 + 3] = q.p.x; pos[i * 6 + 4] = q.p.y - ww; pos[i * 6 + 5] = q.p.z; }
      geo.attributes.position.needsUpdate = true; });
    return o;
  }
  _kill(obj) { const i = this.fx.findIndex(e => e.obj === obj); if (i >= 0) { this.fx[i].age = this.fx[i].life; } }
  speedlines(color = '#ffffff') { /* screen-space handled by UI */ }

  /* ===== v3 effects: richer composites ===== */
  spikes(p, color, n = 12, len = 2.5, life = 0.4, full = false) { // radiating thorns / light rays
    const g = new THREE.Group(); g.position.copy(p); const m = this.mat(color, 0.95), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + rand(-0.2, 0.2), el = full ? rand(-0.5, 1.0) : rand(0.0, 0.5), L = len * rand(0.5, 1.2); const d = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.09 + L * 0.03, L, 5), m); c.quaternion.setFromUnitVectors(up, d); c.position.copy(d).multiplyScalar(L * 0.5 + 0.2); c.userData.own = false; g.add(c); }
    this.add(g, life, (t, o) => { const e = 1 - Math.pow(1 - t, 3); o.scale.set(0.35 + e * 1.1, 0.35 + e * 1.1, 0.35 + e * 1.1); m.opacity = 0.95 * (1 - t * t); });
    return g;
  }
  pillar(p, color, h = 30, w = 2, life = 0.8) { // beam of light from the sky / ground
    const m = this.mat(color, 0.5), m2 = this.mat('#ffffff', 0.5); const g = new THREE.Group(); g.position.copy(p);
    const a = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.7, w, h, 24, 1, true), m); a.position.y = h / 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.25, w * 0.4, h, 16, 1, true), m2); b.position.y = h / 2; g.add(a, b);
    this.add(g, life, (t, o) => { const s = t < 0.15 ? 0.3 + t / 0.15 * 0.9 : 1.2 - (t - 0.15) * 1.0; o.scale.set(Math.max(0.05, s), 1, Math.max(0.05, s)); m.opacity = 0.5 * (1 - t) ** 1.5; m2.opacity = 0.5 * (1 - t) ** 2; });
    this.flash(p.clone().setY(p.y + 1), color, w * 4, 0.25); this.ring(p.clone().setY(p.y + 0.1), color, w, w * 7, life * 0.8);
    for (let i = 0; i < 26; i++) this.emit(p.clone().add(new THREE.Vector3(rand(-w, w), 0.2, rand(-w, w))), { x: rand(-1, 1), y: rand(6, 22), z: rand(-1, 1) }, color, rand(0.25, 0.6), rand(0.5, 1.1), { drag: 0.6, bright: 1.8 });
  }
  vortex(getPos, color, r = 2.5, h = 5, life = 1, rate = 60) { // spiralling column of energy that follows a position
    const o3 = new THREE.Object3D(); let acc = 0, ang = 0;
    this.add(o3, life, (t, o, dt) => { acc += rate * dt; ang += dt * 9; const c = getPos(); if (!c) return; while (acc >= 1) { acc--; const a = ang + rand(0, 6.283), rr = r * rand(0.6, 1.1); this.emit(new THREE.Vector3(c.x + Math.cos(a) * rr, c.y + rand(0, h * 0.2), c.z + Math.sin(a) * rr), { x: -Math.sin(a) * r * 4, y: h * rand(1.0, 2.2), z: Math.cos(a) * r * 4 }, color, rand(0.25, 0.55), rand(0.5, 0.9), { drag: 1.2, bright: 1.7, end: 0.05 }); } });
  }
  converge(p, color, n = 40, r = 5, life = 0.5) { // charge-up: motes streaming inward
    for (let i = 0; i < n; i++) { const a = rand(0, 6.283), b = Math.acos(rand(-1, 1)); const d = { x: Math.sin(b) * Math.cos(a), y: Math.cos(b), z: Math.sin(b) * Math.sin(a) }; const rr = r * rand(0.6, 1.1);
      this.emit(new THREE.Vector3(p.x + d.x * rr, p.y + d.y * rr, p.z + d.z * rr), { x: -d.x * rr / life, y: -d.y * rr / life, z: -d.z * rr / life }, color, rand(0.2, 0.45), life * rand(0.8, 1), { drag: 0, bright: 2, end: 0.05 }); }
    this.orb(p, color, 0.1, 1.2, life);
  }
  fork(a, b, color, life = 0.25, w = 0.09, branches = 4) { // lightning with side forks
    this.bolt(a, b, color, life, w); const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    for (let i = 0; i < branches; i++) { const m = a.clone().addScaledVector(d, rand(0.2, 0.85)); const e = m.clone().add(new THREE.Vector3(rand(-1, 1), rand(-0.6, 0.4), rand(-1, 1)).multiplyScalar(L * 0.3)); this.bolt(m, e, color, life * 0.85, w * 0.6); }
  }
  impact(p, dir, color = '#ffffff', size = 1) { // layered hit: flash, thorns, embers, smoke puff, shell
    this.flash(p, color, 1.0 * size, 0.12); this.spikes(p, color, 7, 0.6 * size, 0.16, true); this.orb(p, color, 0.08, 0.4 * size, 0.12);
    this.sparks(p, '#ffe6b0', Math.round(8 * size), 6 * size, 0.28);
    for (let i = 0; i < 3; i++) this.emit(p, { x: rand(-1, 1), y: rand(0.3, 1.5), z: rand(-1, 1) }, '#60606a', rand(0.15, 0.3) * size, 0.4, { drag: 2, bright: 0.45, end: 2 });
    if (dir) for (let i = 0; i < 5; i++) this.emit(p, { x: dir.x * rand(3, 8) + rand(-1, 1), y: rand(-0.5, 1.5), z: dir.z * rand(3, 8) + rand(-1, 1) }, color, rand(0.05, 0.1), 0.22, { drag: 2.5, bright: 2.2 });
  }
  eruption(p, color, r = 3, h = 9) { // ground-burst column: fire/energy fountain with embers & cracks
    this.crack(p, r * 1.2, color, 4); this.shock(p, color, r * 2.2, 0.5);
    for (let i = 0; i < 46; i++) { const a = rand(0, 6.283), rr = rand(0, r * 0.5); this.emit(new THREE.Vector3(p.x + Math.cos(a) * rr, p.y + 0.1, p.z + Math.sin(a) * rr), { x: Math.cos(a) * rand(0, 3), y: rand(h * 0.8, h * 2.2), z: Math.sin(a) * rand(0, 3) }, i % 3 ? color : '#ffffff', rand(0.35, 0.9), rand(0.5, 1.1), { drag: 0.5, grav: 6, bright: 1.9, end: 0.1 }); }
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.8, h, 16, 1, true), this.mat(color, 0.7)); col.position.set(p.x, p.y + h / 2, p.z); this.add(col, 0.45, (t, o) => { o.scale.set(1 - t * 0.5, 0.4 + Math.min(1, t * 4) * 0.8, 1 - t * 0.5); o.material.opacity = 0.7 * (1 - t); });
    this.flash(p.clone().setY(p.y + 1.2), color, r * 2.4, 0.2);
  }
  update(dt) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      this.life[i] -= dt; const t = 1 - this.life[i] / this.max[i], k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = lerp(this.s0[i], this.s1[i], t); this.alpha[i] = 1 - t * t;
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.aColor.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = true;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const e = this.fx[i]; e.age += dt; const t = Math.min(1, e.age / e.life);
      e.fn(t, e.obj, dt);
      if (t >= 1) { this.scene.remove(e.obj); e.obj.traverse(o => { if (o.material && o.material.dispose && o.userData.own !== false) o.material.dispose(); if (o.geometry && o.userData.keepGeo !== true) o.geometry.dispose(); }); this.fx.splice(i, 1); }
    }
  }
}
