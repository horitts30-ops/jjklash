// JJKLASH online server: serves the game, accounts + friends, rooms (public / friends-only / code-only) and relays match traffic.
// Usage: npm install && node server.js   (PORT env var optional, default 8787). Put hexclash.html next to this file (or in ../).
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
const __dir = path.dirname(fileURLToPath(import.meta.url)); const PORT = +process.env.PORT || 8787; const DB = path.join(process.env.DATA_DIR || __dir, 'data.json');
let db = { users: {} }; try { db = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch (e) { }
let dirty = false; const save = () => { dirty = true; }; setInterval(() => { if (dirty) { dirty = false; try { fs.writeFileSync(DB, JSON.stringify(db)); } catch (e) { } } }, 4000);
const rid = (n, al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') => Array.from({ length: n }, () => al[crypto.randomInt(al.length)]).join('');
const byCode = (c) => Object.values(db.users).find(u => u.code === c);

// ---- static hosting: tiny HTML + hashed JS, precompressed (brotli/gzip) in memory, long-lived caching ----
import zlib from 'zlib';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
const cache = new Map();
function load(file) {
  let c = cache.get(file); const st = fs.statSync(file); if (c && c.mtime === st.mtimeMs) return c;
  const raw = fs.readFileSync(file), ext = path.extname(file), compress = /\.(html|js|css|svg|json|txt)$/.test(ext);
  c = { mtime: st.mtimeMs, raw, type: MIME[ext] || 'application/octet-stream', etag: '"' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"', br: compress ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }) : null, gz: compress ? zlib.gzipSync(raw, { level: 9 }) : null };
  cache.set(file, c); return c;
}
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
const server = http.createServer((req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('ok'); return; }
    let file = null, immutable = false;
    if (url === '/' || url === '/index.html') file = path.join(__dir, 'index.html');
    else if (/^\/assets\/[\w.-]+$/.test(url)) { file = path.join(__dir, 'assets', path.basename(url)); immutable = true; }
    else if (url === '/hexclash.html') file = path.join(__dir, 'hexclash.html');
    else if (url === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('User-agent: *\nAllow: /\n'); return; }
    if (!file || !fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    const c = load(file), ae = String(req.headers['accept-encoding'] || '');
    const h = { 'Content-Type': c.type, ETag: c.etag, Vary: 'Accept-Encoding', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', ...SEC };
    if (req.headers['if-none-match'] === c.etag) { res.writeHead(304, h); res.end(); return; }
    let body = c.raw; if (c.br && /\bbr\b/.test(ae)) { body = c.br; h['Content-Encoding'] = 'br'; } else if (c.gz && /\bgzip\b/.test(ae)) { body = c.gz; h['Content-Encoding'] = 'gzip'; }
    h['Content-Length'] = body.length; res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) { res.writeHead(500); res.end('Server error'); }
});
const wss = new WebSocketServer({ server });
const conns = new Map();   // pid -> ws
const rooms = new Map();   // code -> room
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
const toPid = (pid, o) => send(conns.get(pid), o);
const roomOf = (pid) => [...rooms.values()].find(r => r.members.some(m => m.pid === pid));
const areFriends = (a, b) => !!(db.users[a] && db.users[a].friends.includes(b));
const pub = (u) => ({ pid: u.pid, name: u.name, code: u.code });
const presence = (pid) => { const r = roomOf(pid); return { online: conns.has(pid), room: r ? { code: r.code, name: r.name, vis: r.vis, state: r.state, n: r.members.length, max: r.max, hostPid: r.host } : null }; };
const friendList = (u) => u.friends.map(p => db.users[p]).filter(Boolean).map(f => ({ ...pub(f), ...presence(f.pid) }));
const pushFriends = (pid) => { const u = db.users[pid]; if (!u) return; toPid(pid, { t: 'friends', friends: friendList(u), incoming: u.incoming.map(p => pub(db.users[p])).filter(Boolean), outgoing: u.outgoing.map(p => pub(db.users[p])).filter(Boolean) }); };
const notifyFriendsOf = (pid) => { const u = db.users[pid]; if (u) for (const f of u.friends) pushFriends(f); };
const roomView = (r) => ({ code: r.code, name: r.name, vis: r.vis, mode: r.mode, map: r.map, max: r.max, state: r.state, host: r.host, members: r.members.map(m => ({ pid: m.pid, name: m.name, ready: m.ready, profile: m.profile })) });
const pushRoom = (r) => { for (const m of r.members) toPid(m.pid, { t: 'room', room: roomView(r) }); for (const m of r.members) notifyFriendsOf(m.pid); };
const publicList = () => [...rooms.values()].filter(r => r.vis === 'public' && r.state === 'lobby' && r.members.length < r.max).map(r => ({ code: r.code, name: r.name, mode: r.mode, map: r.map, n: r.members.length, max: r.max, host: (db.users[r.host] || {}).name }));
const MAXP = { '1v1': 2, '2v2': 4, ffa: 5 };

function leave(pid) {
  const r = roomOf(pid); if (!r) return; r.members = r.members.filter(m => m.pid !== pid);
  for (const m of r.members) toPid(m.pid, { t: 'peer-left', pid });
  if (!r.members.length || r.host === pid) { for (const m of r.members) toPid(m.pid, { t: 'room-closed' }); rooms.delete(r.code); for (const m of r.members) notifyFriendsOf(m.pid); } else pushRoom(r);
  notifyFriendsOf(pid); toPid(pid, { t: 'room', room: null });
}
function join(pid, r, profile) {
  if (r.members.length >= r.max) return 'Room is full'; if (r.state !== 'lobby') return 'Match already started';
  if (r.vis === 'friends' && r.host !== pid && !areFriends(r.host, pid)) return 'Friends-only room';
  leave(pid); r.members.push({ pid, name: db.users[pid].name, ready: false, profile: profile || null }); pushRoom(r); return null;
}

wss.on('connection', (ws) => {
  let pid = null;
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'hello') {
      let u = m.pid && db.users[m.pid]; if (u && u.secret !== m.secret) { send(ws, { t: 'error', msg: 'Bad credentials' }); return; }
      if (!u) { const p = rid(12, 'abcdef0123456789'); u = db.users[p] = { pid: p, secret: crypto.randomBytes(12).toString('hex'), name: 'Sorcerer', code: rid(6), friends: [], incoming: [], outgoing: [] }; while (Object.values(db.users).filter(x => x.code === u.code).length > 1) u.code = rid(6); }
      pid = u.pid; u.name = String(m.name || u.name).slice(0, 16); save(); const old = conns.get(pid); if (old && old !== ws) { try { old.close(); } catch (e) { } } conns.set(pid, ws);
      send(ws, { t: 'welcome', me: { ...pub(u), secret: u.secret }, rooms: publicList() }); pushFriends(pid); notifyFriendsOf(pid); const r = roomOf(pid); if (r) toPid(pid, { t: 'room', room: roomView(r) }); return;
    }
    if (!pid) return; const u = db.users[pid];
    switch (m.t) {
      case 'name': u.name = String(m.name || '').slice(0, 16) || u.name; save(); notifyFriendsOf(pid); { const r = roomOf(pid); if (r) { const mm = r.members.find(x => x.pid === pid); mm.name = u.name; pushRoom(r); } } break;
      case 'friend-add': { const o = byCode(String(m.code || '').toUpperCase().trim()); if (!o || o.pid === pid) { send(ws, { t: 'toast', msg: 'No player with that friend code' }); break; } if (u.friends.includes(o.pid)) { send(ws, { t: 'toast', msg: 'Already friends' }); break; }
        if (u.incoming.includes(o.pid)) { u.incoming = u.incoming.filter(x => x !== o.pid); o.outgoing = o.outgoing.filter(x => x !== pid); u.friends.push(o.pid); o.friends.push(pid); send(ws, { t: 'toast', msg: 'You are now friends with ' + o.name }); }
        else { if (!u.outgoing.includes(o.pid)) u.outgoing.push(o.pid); if (!o.incoming.includes(pid)) o.incoming.push(pid); send(ws, { t: 'toast', msg: 'Friend request sent to ' + o.name }); toPid(o.pid, { t: 'toast', msg: u.name + ' sent you a friend request' }); }
        save(); pushFriends(pid); pushFriends(o.pid); break; }
      case 'friend-accept': { const o = db.users[m.pid]; if (!o || !u.incoming.includes(o.pid)) break; u.incoming = u.incoming.filter(x => x !== o.pid); o.outgoing = o.outgoing.filter(x => x !== pid); if (m.ok) { u.friends.push(o.pid); o.friends.push(pid); toPid(o.pid, { t: 'toast', msg: u.name + ' accepted your friend request' }); } save(); pushFriends(pid); pushFriends(o.pid); break; }
      case 'friend-remove': { const o = db.users[m.pid]; u.friends = u.friends.filter(x => x !== m.pid); u.outgoing = u.outgoing.filter(x => x !== m.pid); if (o) { o.friends = o.friends.filter(x => x !== pid); o.outgoing = o.outgoing.filter(x => x !== pid); pushFriends(o.pid); } save(); pushFriends(pid); break; }
      case 'rooms': send(ws, { t: 'rooms', rooms: publicList() }); break;
      case 'create': { let code; do code = rid(5); while (rooms.has(code)); const mode = MAXP[m.mode] ? m.mode : '1v1'; const r = { code, name: String(m.name || u.name + "'s room").slice(0, 24), vis: ['public', 'friends', 'code'].includes(m.vis) ? m.vis : 'code', mode, map: m.map || 'random', max: MAXP[mode], host: pid, state: 'lobby', members: [] }; rooms.set(code, r); const e = join(pid, r, m.profile); if (e) send(ws, { t: 'toast', msg: e }); break; }
      case 'join': { const r = rooms.get(String(m.code || '').toUpperCase().trim()); if (!r) { send(ws, { t: 'toast', msg: 'Room not found' }); break; } const e = join(pid, r, m.profile); if (e) send(ws, { t: 'toast', msg: e }); break; }
      case 'leave': leave(pid); break;
      case 'profile': { const r = roomOf(pid); if (r) { const mm = r.members.find(x => x.pid === pid); mm.profile = m.profile; } break; }
      case 'ready': { const r = roomOf(pid); if (r) { r.members.find(x => x.pid === pid).ready = !!m.ready; pushRoom(r); } break; }
      case 'settings': { const r = roomOf(pid); if (!r || r.host !== pid || r.state !== 'lobby') break; if (['public', 'friends', 'code'].includes(m.vis)) r.vis = m.vis; if (MAXP[m.mode]) { r.mode = m.mode; r.max = Math.max(MAXP[m.mode], r.members.length); } if (m.map) r.map = m.map; if (m.name) r.name = String(m.name).slice(0, 24); pushRoom(r); break; }
      case 'kick': { const r = roomOf(pid); if (!r || r.host !== pid || m.pid === pid) break; toPid(m.pid, { t: 'toast', msg: 'You were removed from the room' }); leave(m.pid); break; }
      case 'invite': { const r = roomOf(pid); if (!r || !areFriends(pid, m.pid)) break; toPid(m.pid, { t: 'invite', from: u.name, room: r.code, roomName: r.name }); send(ws, { t: 'toast', msg: 'Invite sent' }); break; }
      case 'start': { const r = roomOf(pid); if (!r || r.host !== pid || r.state !== 'lobby') break; if (r.members.length < 2) { send(ws, { t: 'toast', msg: 'Need at least 2 players' }); break; } r.state = 'playing'; const seed = crypto.randomInt(1e9);
        const players = r.members.map((mm, i) => ({ pid: mm.pid, name: mm.name, profile: mm.profile, team: r.mode === 'ffa' ? i : i % 2 })); const maps = ['forest', 'bamboo', 'snow', 'station', 'city', 'shrine']; const map = r.map === 'random' ? maps[seed % maps.length] : r.map;
        for (const mm of r.members) toPid(mm.pid, { t: 'start', cfg: { mode: r.mode, map, seed, players, host: r.host } }); pushRoom(r); break; }
      case 'match-over': { const r = roomOf(pid); if (r && r.host === pid) { r.state = 'lobby'; r.members.forEach(x => x.ready = false); pushRoom(r); } break; }
      case 'rt': { const r = roomOf(pid); if (!r) break; if (m.to) toPid(m.to, { t: 'rt', from: pid, d: m.d }); else for (const mm of r.members) if (mm.pid !== pid) toPid(mm.pid, { t: 'rt', from: pid, d: m.d }); break; }
      case 'ping': send(ws, { t: 'pong', ts: m.ts }); break;
    }
  });
  ws.on('close', () => { if (pid && conns.get(pid) === ws) { conns.delete(pid); leave(pid); notifyFriendsOf(pid); } });
});
server.listen(PORT, () => console.log('JJKLASH server on http://localhost:' + PORT));
