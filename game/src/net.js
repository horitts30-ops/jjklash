// Client-side networking: connection to the JJKLASH server (accounts, friends, rooms, match relay).
const LS = 'hexclash_net', LSU = 'hexclash_server';
const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
export const Acct = {
  d: (() => { try { return JSON.parse(localStorage.getItem('hexclash_acct')) || null; } catch (e) { return null; } })(),
  set(d) { this.d = d; try { d ? localStorage.setItem('hexclash_acct', JSON.stringify(d)) : localStorage.removeItem('hexclash_acct'); } catch (e) { } },
  setCreds(pid, secret) { try { localStorage.setItem(LS, JSON.stringify({ pid, secret })); } catch (e) { } },
  creds() { return load(); },
  base() { let u = ''; try { u = localStorage.getItem(LSU) || ''; } catch (e) { } if (!u) u = /^https?:/.test(location.protocol) ? location.origin : 'http://localhost:8787'; return u.replace(/^ws/, 'http').replace(/\/$/, ''); },
  async call(path, body) { let r; try { r = await fetch(this.base() + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) { throw new Error("Can't reach the game server. Open the game from your hosted site (or set the server address in Online)."); } let j = {}; try { j = await r.json(); } catch (e) { } if (!r.ok) throw new Error(j.error || 'Server error ' + r.status); return j; },
};
export const Net = {
  ws: null, ok: false, connecting: false, error: '', me: null, friends: [], incoming: [], outgoing: [], rooms: [], room: null, ping: 0, listeners: new Set(),
  defaultUrl() { try { const s = localStorage.getItem(LSU); if (s) return s; } catch (e) { } return /^https?:/.test(location.protocol) ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host : 'ws://localhost:8787'; },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(m) { for (const f of [...this.listeners]) { try { f(m); } catch (e) { console.error(e); } } },
  connect(url, name) {
    if (this.ok || this.connecting) return; this.connecting = true; this.error = ''; url = url || this.defaultUrl(); try { localStorage.setItem(LSU, url); } catch (e) { }
    let ws; try { ws = new WebSocket(url); } catch (e) { this.connecting = false; this.error = 'Bad server address'; this.emit({ t: 'status' }); return; }
    this.ws = ws; const creds = load();
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', pid: creds.pid, secret: creds.secret, name })); };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.handle(m); };
    ws.onerror = () => { this.error = 'Could not reach ' + url; };
    ws.onclose = () => { const was = this.ok; this.ok = false; this.connecting = false; this.room = null; this.friends = []; if (!was && !this.error) this.error = 'Connection closed'; clearInterval(this._pi); this.emit({ t: 'status' }); };
  },
  disconnect() { if (this.ws) { try { this.ws.close(); } catch (e) { } } this.ok = false; },
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  rt(d, to) { this.send({ t: 'rt', d, to }); },
  handle(m) {
    switch (m.t) {
      case 'welcome': this.ok = true; this.connecting = false; this.error = ''; this.me = m.me; this.rooms = m.rooms || []; try { localStorage.setItem(LS, JSON.stringify({ pid: m.me.pid, secret: m.me.secret })); } catch (e) { } clearInterval(this._pi); this._pi = setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 3000); break;
      case 'pong': this.ping = Math.round(performance.now() - m.ts); return;
      case 'friends': this.friends = m.friends; this.incoming = m.incoming; this.outgoing = m.outgoing; break;
      case 'rooms': this.rooms = m.rooms; break;
      case 'room': this.room = m.room; break;
      case 'room-closed': this.room = null; break;
      case 'error': this.error = m.msg; break;
    }
    this.emit(m);
  },
};
