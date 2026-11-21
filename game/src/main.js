import { Net } from './net.js';
import * as THREE from 'three';
import { createEngine } from './engine.js';
import { FX, rand, pick, clamp, angDiff, damp } from './fx.js';
import { makeChar, labelSprite, DEFAULT_APP } from './chars.js';
import { buildHub, buildCreateScene, MAPS } from './world.js';
import { Game, randomApp } from './game.js';
import { initAudio, sfx, setMuted, music, speak } from './audio.js';
import * as UI from './ui.js';
import { Save, addProgress, rankInfo } from './ui.js';
import { A } from './abilities.js';

UI.injectCSS(); UI.mountDOM(); Save.load(); setMuted(Save.d.settings.muted); UI.applyVolumes();
const canvas = document.createElement('canvas'); canvas.id = 'c'; canvas.tabIndex = 0; document.body.prepend(canvas);
const eng = createEngine(canvas); eng.setQuality(Save.d.settings.quality);
const $ = (s) => document.querySelector(s);

/* ---------------- input ---------------- */
const input = { keys: {}, edge: {}, mouse: [false, false, false], dx: 0, dy: 0, locked: false, fallback: false, drag: false };
const inGame = () => mode === 'hub' || mode === 'match';
window.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; if (['Space', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); if (!e.repeat) { input.edge[e.code] = true; } input.keys[e.code] = true; if (e.code === 'Escape' && !input.locked) onEscape(); });
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
window.addEventListener('blur', () => { input.keys = {}; input.mouse = [false, false, false]; });
canvas.addEventListener('mousedown', (e) => { initAudio(); if (input.padOn) { input.padOn = false; input.fallback = false; } if ((mode === 'hub' || mode === 'match') && !input.locked && !input.fallback && !panelOpen() && !paused) { lockPointer(); return; } input.mouse[e.button] = true; input.drag = true; });
window.addEventListener('mouseup', (e) => { input.mouse[e.button] = false; input.drag = false; });
window.addEventListener('mousemove', (e) => { if (input.locked || input.drag) { input.dx += e.movementX || 0; input.dy += e.movementY || 0; } });
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; if (!input.locked && mode === 'match' && game && !game.over && !paused && !panelOpen()) pause(true); });
document.addEventListener('pointerlockerror', () => { input.fallback = true; });
function lockPointer() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { input.fallback = true; }); } catch (e) { input.fallback = true; } }
function unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
const panelOpen = () => !!document.querySelector('#layer .panel') || !!document.querySelector('.cpan');
function endFrame() { input.edge = {}; input.dx = 0; input.dy = 0; }

/* ---------------- state ---------------- */
let mode = 'title', game = null, paused = false, hub = null, hubScene = null, hubFX = null, hubCam = null, hp = null, npcs = [], createScene = null, createCam = null, cChar = null, cRot = 0.5;
const ui = { dmg() { }, cine: UI.cine, score() { }, float(p, t, c) { UI.floatText(p, game.cam, eng.size, t, c); }, big: UI.bigText, feed: UI.feed, hud: UI.hudUpdate, count(c) { if (c < 0) { $('#count').textContent = 'FIGHT!'; setTimeout(() => { const e = $('#count'); if (e) e.textContent = ''; }, 800); } else UI.countText(c); }, end: onMatchEnd };
ui.big = UI.bigText;

/* ---------------- title ---------------- */
function showTitle() {
  mode = 'title'; const bt = document.getElementById('boot'); if (bt) { bt.style.opacity = '0'; setTimeout(() => bt.remove(), 400); } const t = document.createElement('div'); t.id = 'title';
  t.innerHTML = `<h1>JJKLASH</h1><p>A 3D arena fighter. Build your own sorcerer, collect techniques from mystery boxes, mix any Passive + Active + Shikigami + Domain you like, and clash with fighters in fast, skill-based combat.</p>
  <div class="keys"><span><b>WASD</b> move</span><span><b>LMB</b> attack (hold = combo)</span><span><b>R</b> heavy</span><span><b>RMB / F</b> block</span><span><b>Shift</b> dash</span><span><b>Space</b> jump</span><span><b>1 2 3 4</b> techniques</span><span><b>V / MMB</b> lock-on</span><span><b>E</b> switch target</span></div>
  <button class="btn" id="play" style="font-size:22px;padding:14px 44px">▶ PLAY</button><div class="dim" style="font-size:12px">Original characters & techniques · saves automatically in this browser</div>
  <div class="dim" style="font-size:12px"><a href="#" id="rs" style="color:#9a96c4">reset save</a></div>`;
  document.body.appendChild(t); mode = 'title';
  // background: render hub behind
  setupHub(); t.querySelector('#play').onclick = () => { initAudio(); sfx('click'); t.remove(); if (!Save.d.created) enterCreator(true); else enterHub(); };
  t.querySelector('#rs').onclick = (e) => { e.preventDefault(); if (confirm('Erase your save and start over?')) { Save.reset(); location.reload(); } };
}

/* ---------------- hub ---------------- */
function setupHub() {
  if (hub) return;
  hubScene = new THREE.Scene(); hubScene.userData.env = eng.envTex; hubFX = new FX(hubScene); hub = buildHub(hubScene, hubFX); hubCam = new THREE.PerspectiveCamera(62, 1, 0.1, 900); hubFX.cam = hubCam;
  hp = { ch: null, pos: hub.spawn.clone(), vel: new THREE.Vector3(), yaw: hub.spawnYaw, camYaw: hub.spawnYaw, camPitch: 0.28, dist: 9, ground: true };
  buildHubPlayer(); hubScene.add(hp.ch.group);
  for (let i = 0; i < 7; i++) { const app = randomApp(); const ch = makeChar(app); const a = rand(0, 6.28), r = rand(6, 22); const n = { ch, pos: new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), tgt: null, wait: rand(0, 3), yaw: 0 }; ch.group.position.copy(n.pos); hubScene.add(ch.group); npcs.push(n); }
  const sensei = makeChar({ gender: 'm', skin: 5, face: 2, hair: 0, hairColor: 4, outfit: 3, acc: 4, aura: 0, pose: 0 }); sensei.group.position.set(-17.5, 0, 14); sensei.group.rotation.y = 1.2; hubScene.add(sensei.group); sensei.s.pose = 1; npcs.push({ ch: sensei, pos: sensei.group.position, still: true }); const l = labelSprite('Sensei', '#ffd98a', 0.7); l.position.set(-17.5, 3.6, 14); hubScene.add(l);
  hubCam.position.set(0, 6, 16); hubCam.lookAt(0, 4, -10);
}
function buildHubPlayer() { if (hp.ch) { hubScene.remove(hp.ch.group); hp.ch.dispose(); } hp.ch = makeChar(Save.d.app); hubScene.add(hp.ch.group); }
function drawLeaderboard() {
  if (!hub.lbBoard) return; const c = document.createElement('canvas'); c.width = 512; c.height = 480; const x = c.getContext('2d'); const s = Save.d.stats, r = rankInfo();
  x.fillStyle = '#1a1530'; x.fillRect(0, 0, 512, 480); x.fillStyle = '#ffd98a'; x.font = '800 44px system-ui'; x.textAlign = 'center'; x.fillText('ARCHIVE', 256, 60); x.fillStyle = '#fff'; x.font = '700 34px system-ui'; x.textAlign = 'left';
  [['Rank', r.grade], ['Wins', s.wins], ['KOs', s.kos], ['Matches', s.matches]].forEach(([k, v], i) => { x.fillStyle = '#b8b0ff'; x.fillText(k, 50, 140 + i * 70); x.fillStyle = '#fff'; x.textAlign = 'right'; x.fillText(String(v), 462, 140 + i * 70); x.textAlign = 'left'; });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; hub.lbBoard.material.map = t; hub.lbBoard.material.needsUpdate = true;
}
function enterHub() {
  setupHub(); buildHubPlayer(); drawLeaderboard(); UI.closePanels(); UI.hudShow(false); $('#hub-hint').classList.remove('hidden'); $('#hudxp').classList.remove('hidden'); UI.setXP();
  { let ob = $('#onlinebtn'); if (!ob) { ob = document.createElement('button'); ob.id = 'onlinebtn'; ob.className = 'btn'; ob.style.cssText = 'position:fixed;top:14px;right:14px;z-index:50'; ob.textContent = '🌐 Online (O)'; ob.onclick = () => { if (mode === 'hub') { unlockPointer(); UI.openOnline(closedPanel); } }; document.body.appendChild(ob); } ob.style.display = ''; }
  mode = 'hub'; hp.pos.copy(hub.spawn); hp.yaw = hp.camYaw = hub.spawnYaw; hp.vel.set(0, 0, 0); Save.save();
}
const STATION = {
  technique: () => UI.openTechnique(closedPanel), mystery: () => UI.openMystery(closedPanel), missions: () => UI.openMissions(closedPanel), archivist: () => UI.openArchive(closedPanel),
  match: () => UI.openMatch((cfg) => startMatch(cfg), closedPanel), wardrobe: () => { enterCreator(false); }, training: () => startMatch({ mode: 'training', map: 'dojo', skill: 0.5 }),
};
function closedPanel() { UI.setXP(); }
let nearSt = null;
function hubFrame(dt) {
  const pan = panelOpen(); const I = input;
  if (!pan) {
    if (input.locked || input.drag || input.padOn) { hp.camYaw -= I.dx * 0.0026; hp.camPitch = clamp(hp.camPitch + I.dy * 0.0022, -0.1, 1.1); }
    if (I.keys['ArrowLeft']) hp.camYaw += dt * 2; if (I.keys['ArrowRight']) hp.camYaw -= dt * 2;
    const y = hp.camYaw, f = new THREE.Vector3(Math.sin(y), 0, Math.cos(y)), r = new THREE.Vector3(-Math.cos(y), 0, Math.sin(y)); const m = new THREE.Vector3();
    if (I.keys['KeyW']) m.add(f); if (I.keys['KeyS']) m.sub(f); if (I.keys['KeyD']) m.add(r); if (I.keys['KeyA']) m.sub(r);
    const sp = (I.keys['ShiftLeft'] || I.keys['ShiftRight']) ? 15 : 9; if (m.lengthSq() > 0) { m.normalize().multiplyScalar(sp); hp.yaw += angDiff(hp.yaw, Math.atan2(m.x, m.z)) * (1 - Math.exp(-14 * dt)); }
    hp.vel.x = damp(hp.vel.x, m.x, 12, dt); hp.vel.z = damp(hp.vel.z, m.z, 12, dt);
    if (I.edge['Space'] && hp.pos.y <= 0.01) hp.vel.y = 11;
    if (I.edge['KeyE'] && nearSt) { unlockPointer(); sfx('open'); STATION[nearSt.name](); }
  } else { hp.vel.x = damp(hp.vel.x, 0, 12, dt); hp.vel.z = damp(hp.vel.z, 0, 12, dt); }
  hp.vel.y -= 30 * dt; hp.pos.addScaledVector(hp.vel, dt); if (hp.pos.y < 0) { hp.pos.y = 0; hp.vel.y = 0; }
  for (const c of hub.circles) { const dx = hp.pos.x - c.x, dz = hp.pos.z - c.z, d = Math.hypot(dx, dz), mm = c.r + 0.55; if (d < mm && d > 0.001) { hp.pos.x = c.x + dx / d * mm; hp.pos.z = c.z + dz / d * mm; } }
  const dd = Math.hypot(hp.pos.x, hp.pos.z); if (dd > hub.bounds) { hp.pos.x *= hub.bounds / dd; hp.pos.z *= hub.bounds / dd; }
  const s = hp.ch.s; s.run = clamp(Math.hypot(hp.vel.x, hp.vel.z) / 9.5, 0, 1.3); s.air = hp.pos.y > 0.1; hp.ch.group.position.copy(hp.pos); hp.ch.group.rotation.y = hp.yaw; hp.ch.update(dt);
  for (const n of npcs) { if (n.still) { n.ch.update(dt); continue; } if (!n.tgt) { n.wait -= dt; n.ch.s.run = 0; if (n.wait <= 0) { const a = rand(0, 6.28), r = rand(5, 23); n.tgt = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r); } } else { const v = n.tgt.clone().sub(n.pos); const d = v.length(); if (d < 0.6) { n.tgt = null; n.wait = rand(2, 7); } else { v.normalize(); n.pos.addScaledVector(v, 3.2 * dt); n.yaw += angDiff(n.yaw, Math.atan2(v.x, v.z)) * (1 - Math.exp(-8 * dt)); n.ch.s.run = 0.35; } } n.ch.group.position.copy(n.pos); n.ch.group.rotation.y = n.yaw; n.ch.update(dt); }
  // camera
  const cp = Math.cos(hp.camPitch), tgt = hp.pos.clone().add(new THREE.Vector3(0, 2.2, 0)); const want = tgt.clone().add(new THREE.Vector3(-Math.sin(hp.camYaw) * cp * hp.dist, Math.sin(hp.camPitch) * hp.dist + 0.4, -Math.cos(hp.camYaw) * cp * hp.dist));
  hubCam.position.lerp(want, 1 - Math.exp(-14 * dt)); if (hubCam.position.y < 0.5) hubCam.position.y = 0.5; hubCam.lookAt(tgt.x + Math.sin(hp.camYaw) * 4, tgt.y - 0.3, tgt.z + Math.cos(hp.camYaw) * 4); hubCam.aspect = eng.size.w / eng.size.h; hubCam.updateProjectionMatrix();
  hubFX.setScale(eng.size.h); hubFX.update(dt); hub.update(eng.time, dt, hp.pos);
  nearSt = null; let bd = 99; for (const st of hub.stations) { const d = Math.hypot(st.pos.x - hp.pos.x, st.pos.z - hp.pos.z); st.ring.material.color.set(st.color).multiplyScalar(d < st.r ? 3 : 1.6); if (d < st.r && d < bd) { bd = d; nearSt = st; } }
  const pr = $('#prompt'); if (nearSt && !pan) { pr.classList.remove('hidden'); pr.innerHTML = `<b>E</b>${nearSt.label}`; } else if (!pan && !input.locked && !input.fallback && mode === 'hub') { pr.classList.remove('hidden'); pr.innerHTML = 'Click the world to capture the mouse'; } else pr.classList.add('hidden');
  eng.fin.uniforms.uAb.value = 0; eng.fin.uniforms.uVig.value = 0.3; eng.fin.uniforms.uWarp.value = 0; eng.fin.uniforms.uTint.value.set(0, 0, 0);
  eng.render(hubScene, hubCam);
}

/* ---------------- creator ---------------- */
const POSEMAP = [4, 1, 2, 3];
function enterCreator(first) {
  setupHub(); mode = 'create'; UI.closePanels(); UI.hudShow(false); $('#hub-hint').classList.add('hidden'); $('#prompt').classList.add('hidden'); unlockPointer();
  if (!createScene) { createScene = new THREE.Scene(); createScene.userData.env = eng.envTex; buildCreateScene(createScene); createCam = new THREE.PerspectiveCamera(36, 1, 0.1, 100); createCam.position.set(1.5, 2.0, 7.2); createCam.lookAt(1.2, 1.35, 0); }
  const rebuild = () => { if (cChar) { createScene.remove(cChar.group); cChar.dispose(); } cChar = makeChar(Save.d.app); createScene.add(cChar.group); cChar.s.pose = Save.d.app.pose > 0 || true ? 0 : 0; };
  rebuild(); UI.setXP();
  UI.openCreator({ first, onChange: () => { rebuild(); const a = Save.d.app; if (a.pose >= 0 && document.querySelector('[data-k="pose"].on')) cChar.s.pose = POSEMAP[a.pose]; }, onDone: () => { enterHub(); }, onBack: () => { enterHub(); } });
}
function createFrame(dt) {
  if (input.drag) cRot += input.dx * 0.01; else cRot += dt * 0.25; cChar.group.rotation.y = cRot; const a = Save.d.app; if (!document.querySelector('[data-k="pose"].on')) cChar.s.pose = 0; else cChar.s.pose = POSEMAP[a.pose];
  cChar.update(dt); const ph = Save.d.app.pose; createCam.aspect = eng.size.w / eng.size.h; if (createCam.aspect < 1.2) createCam.position.x = 0; else createCam.position.x = 1.5; createCam.updateProjectionMatrix();
  eng.fin.uniforms.uAb.value = 0; eng.fin.uniforms.uVig.value = 0.4; eng.fin.uniforms.uWarp.value = 0; eng.fin.uniforms.uTint.value.set(0, 0, 0); eng.render(createScene, createCam);
}

/* ---------------- match ---------------- */
async function startMatch(cfg) {
  { const ob = $('#onlinebtn'); if (ob) ob.style.display = 'none'; }
  UI.closePanels(); unlockPointer(); await UI.fade(true); $('#hub-hint').classList.add('hidden'); $('#hudxp').classList.add('hidden'); $('#prompt').classList.add('hidden');
  const d = Save.d; cfg = { ...cfg }; if (!cfg.net && cfg.mode !== 'training' && d.stats.matches < 8) cfg.skill = Math.min(cfg.skill || 0.6, 0.2 + d.stats.matches * 0.05);
  cfg.mods = UI.upgMods(!!cfg.ranked); cfg.keys = UI.keymap(); cfg.mast = {}; for (const k of Object.keys(d.mast || {})) cfg.mast[k] = UI.masteryLv(k);
  const ldg = UI.showLoading(cfg);
  game = new Game(eng, ui, { ...cfg, save: { name: d.name, app: d.app, equipped: d.equipped } }); window.__hc.game = game; paused = false; mode = 'match'; UI.buildHUD(); UI.hudShow(true); $('#result') && $('#result').remove(); $('#pause') && $('#pause').remove();
  game.cfgOrig = cfg; music(null); await ldg.done(); await UI.fade(false); if (!input.padOn) lockPointer();
}
function pause(on) {
  if (!game || game.over) return; paused = on; $('#pause') && $('#pause').remove(); if (!on) return;
  const p = document.createElement('div'); p.id = 'pause'; p.innerHTML = `<h1 style="font-size:60px;font-style:italic">PAUSED</h1>${UI.settingsHtml()}<div class="row"><button class="btn" id="rs">▶ Resume</button>${game.cfg.mode === 'training' ? '<button class="btn sec" id="rt">Reset dummies</button>' : ''}<button class="btn sec" id="qt">Leave match</button></div><div class="dim" style="max-width:520px;text-align:center;font-size:13px">WASD move · LMB light · RMB heavy · F block · Q / Shift dash · Space jump · mash any move key to break chains &amp; long stuns, Q in the air = tech recover (12 CE) · 1 Active · 2 Passive · 3 Shikigami · 4 Domain · V lock-on · E switch target · B emote · hold Tab scoreboard</div>`;
  document.body.appendChild(p); UI.bindSettings(p, eng);
  p.querySelector('#rs').onclick = () => { p.remove(); paused = false; lockPointer(); };
  const rt = p.querySelector('#rt'); if (rt) rt.onclick = () => { game.resetTraining(); p.remove(); paused = false; lockPointer(); };
  p.querySelector('#qt').onclick = () => { p.remove(); leaveMatch(); };
}
function onEscape() { if (mode === 'match' && game && !game.over) pause(!paused); else if (UI.topPanelClose()) { closedPanel(); } }
async function leaveMatch() {
  if (game && game.net && !game.over && Net.room) Net.send({ t: 'leave' }); music(null); await UI.fade(true); if (game) { game.dispose(); game = null; } UI.hudClear(); $('#result') && $('#result').remove(); $('#pause') && $('#pause').remove(); paused = false; window.__hc.game = null; enterHub(); await UI.fade(false); }
function onMatchEnd(r) {
  const g = game; if (r.mode === 'training') return; const d = Save.d, s = d.stats; s.matches++; if (r.won) s.wins++; else if (!r.draw) s.losses++; s.kos += r.kos; s.dmg += r.dmg; s.crits += r.crits; s.perfects += r.perfects; s.assists = (s.assists || 0) + r.assists; s.curses = (s.curses || 0) + r.curses;
  const xp = (r.won ? 150 : r.draw ? 90 : 60) + r.kos * 20 + r.assists * 10 + r.curses * 6 + Math.floor(r.dmg / 25); d.xp += xp;
  const oppAvg = 900 + (g.cfg.skill || 0.6) * 300; const rk0 = rankInfo(); const delta = (g.cfg.net || !g.cfg.ranked) ? 0 : UI.eloUpdate(r.won, r.draw, oppAvg); { const rk1 = rankInfo(); if (rk1.tier > rk0.tier) UI.kogane('New rank achieved: ' + rk1.full + '!'); } if (g.cfg.net && g.net.host) Net.send({ t: 'match-over' });
  addProgress('kos', r.kos); addProgress('wins', r.won ? 1 : 0); addProgress('crits', r.crits); addProgress('perfects', r.perfects); addProgress('dmg', r.dmg); addProgress('matches', 1); if (r.usedShikigami) addProgress('shikiMatches', 1);
  for (const k of Object.values(d.equipped).flat()) d.uses[k] = (d.uses[k] || 0) + 1; d.history.push({ won: r.won, draw: r.draw, mode: r.mode, map: r.map, kos: r.kos, xp }); if (d.history.length > 30) d.history.shift(); Save.save();
  { const mastRes = []; const p0 = 5 + r.kos * 4 + (r.won ? 3 : 0) + Math.floor(r.dmg / 150); for (const s of ['p', 'a', 's', 'u', 'd']) { const id = d.equipped[s]; if (!id || !A[id]) continue; const casts = (r.casts && r.casts[id]) || 0; const gain = p0 + casts * (s === 'd' ? 25 : 1); const rr = UI.masteryGain(id, gain); mastRes.push({ icon: A[id].icon, name: A[id].name, gain, before: rr.before, after: rr.after }); if (rr.after > rr.before) UI.kogane(A[id].name + ' reached Mastery Lv ' + rr.after + '!'); } r.mast = mastRes; Save.save(); UI.kogane('Match results: +' + xp + ' XP' + (r.won ? ' — victory!' : '')); }
  music(null);
  setTimeout(() => { if (game !== g) return; sfx(r.won ? 'win' : 'lose'), speak(r.won ? 'Victory!' : 'Defeat...', { urgent: true }); unlockPointer(); UI.cine('bars', false); const e = document.createElement('div'); e.id = 'result';
    e.innerHTML = UI.resultHtml(r, xp, delta, rankInfo());
    document.body.appendChild(e); e.querySelector('#hb').onclick = () => leaveMatch(); e.querySelector('#rm').onclick = async () => { if (g.cfg.net) { leaveMatch(); return; } e.remove(); const cfg = g.cfgOrig; if (g) { g.dispose(); } game = null; UI.hudClear(); startMatch(cfg); }; }, 2600);
}

/* ---------------- loop ---------------- */
let last = performance.now();

/* ---------------- gamepad (DualSense / standard mapping) ---------------- */
const padPrev = {}; input.padOn = false;
function pollPad(dt) {
  let gp = null; if (!window.__noPad && navigator.getGamepads) { try { gp = Array.from(navigator.getGamepads()).find(g => g && g.connected) || null; } catch (e) { window.__noPad = true; } } if (!gp) { if (input.padOn) { input.padOn = false; } return; }
  const K = UI.keymap(), b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = (i) => { const v = gp.axes[i] || 0; return Math.abs(v) > 0.18 ? v : 0; };
  const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3); let active = lx || ly || rx || ry || gp.buttons.some(x => x && x.pressed);
  if (active && !input.padOn) { input.padOn = true; input.fallback = true; }
  if (!input.padOn) return;
  const key = (code, down) => { if (down && !padPrev[code]) input.edge[code] = true; if (down) input.keys[code] = true; else if (padPrev[code]) input.keys[code] = false; padPrev[code] = down; };
  key(K.move[0], ly < -0.3); key(K.move[1], ly > 0.3); key(K.move[2], lx < -0.3); key(K.move[3], lx > 0.3);
  key(K.jump, b(0)); key(K.dash, b(1)); key(K.slots[1], b(2)); key(K.slots[0], b(3)); key(K.block, b(4)); key(K.sprint, b(10));
  key(K.slots[2], b(12)); key(K.slots[3], b(13)); key(K.slots[4], b(15)); key(K.switch, b(14)); key(K.lock, b(11)); key(K.simple, b(6));
  { const L = b(7), H = b(5); if (L && !padPrev.L) input.mouse[0] = true; if (!L && padPrev.L) input.mouse[0] = false; padPrev.L = L; if (H && !padPrev.H) { input.edge[K.heavy] = true; } padPrev.H = H; }
  if (b(9) && !padPrev.opt) onEscape(); padPrev.opt = b(9);
  const sens = 520 * (Save.d.settings.sens || 1); input.dx += rx * Math.abs(rx) * dt * sens * 2.2; input.dy += ry * Math.abs(ry) * dt * sens * 1.6;
}
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t; eng.time += dt; pollPad(dt);
  try {
    if (mode === 'title' || mode === 'hub') { if (hub) { if (mode === 'title') { hp.camYaw += dt * 0.12; hp.camPitch = 0.22; hp.dist = 11; input.keys = {}; } hubFrameWrap(dt); } }
    else if (mode === 'create') createFrame(dt);
    else if (mode === 'match' && game) { game.fx.setScale(eng.size.h); if (!paused || game.net) game.update(dt, input); UI.scoreboard(game, !!input.keys[UI.keymap().score] && !game.over); game.render(); const pr = $('#prompt'); if (!input.locked && !input.fallback && !paused && !game.over && mode === 'match') { pr.classList.remove('hidden'); pr.textContent = 'Click to capture the mouse'; } else pr.classList.add('hidden'); }
  } catch (e) { console.error(e); window.__hc.err = (window.__hc.err || '') + e.stack + '\n'; }
  endFrame(); requestAnimationFrame(frame);
}
function hubFrameWrap(dt) { if (mode === 'title') { const sv = panelOpen; hubFrame(dt); } else hubFrame(dt); }
window.__hc = { panel(n) { UI.closePanels(); ({ tech: () => UI.openTechnique(), myst: () => UI.openMystery(), miss: () => UI.openMissions(), arch: () => UI.openArchive(), match: () => UI.openMatch(() => {}) })[n]?.(); }, eng, input, Save, UI, startMatch, enterHub, enterCreator, get mode() { return mode; }, A };
showTitle(); requestAnimationFrame(frame);

document.addEventListener('keydown', (e) => { if (e.code === 'KeyO' && mode === 'hub' && !panelOpen() && !(e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) { unlockPointer(); UI.openOnline(closedPanel); } });
Net.on((m) => {
  if (m.t === 'start') { UI.closePanels(); const c = m.cfg; const go = () => startMatch({ mode: c.mode, map: c.map, skill: 0.5, net: { pid: Net.me.pid, host: c.host === Net.me.pid, players: c.players, seed: c.seed, send: (d) => Net.rt(d) } }); go(); }
  else if (m.t === 'rt') { if (game && game.net) game.netRecv(m.from, m.d); }
  else if (m.t === 'peer-left') { if (game && game.net) game.netPeerLeft(m.pid); }
  else if (m.t === 'room-closed') { UI.toast('The room was closed by the host'); if (game && game.net && mode === 'match') leaveMatch(); }
  else if (m.t === 'invite') { UI.toast(m.from + ' invited you to “' + m.roomName + '”', { label: 'Join', fn: () => { if (mode === 'hub') { Net.send({ t: 'join', code: m.room, profile: { app: Save.d.app, equipped: Save.d.equipped } }); UI.openOnline(closedPanel); } else UI.toast('Finish your current match first'); } }); }
  else if (m.t === 'toast') { if (!document.querySelector('#layer .panel')) UI.toast(m.msg); }
});
window.__hc.Net = Net;
