import { A, ALL, BY_SLOT, RARITY, SLOTS, STARTERS, BOX_COST, DOMAIN_HIT } from './abilities.js';
import { DEFAULT_APP, SKINS, HAIR_COLORS, FACES, HAIRS, OUTFITS, ACCS, AURAS, POSES } from './chars.js';
import { MAPS } from './world.js';
import { UMOVES } from './ustate.js';
import { Net, Acct } from './net.js';
import { DPERK } from './domains.js';
const UM_DEF = ['surge:0', 'surge:1', 'surge:2', 'surge:3'];
const umOwned = (id) => !!UMOVES[id] && !!Save.d.owned[UMOVES[id].state];
import { sfx, setMuted, setVolumes } from './audio.js';

const KEY = 'hexclash_save_v2', KEY1 = 'hexclash_save_v1';
const $ = (s, r = document) => r.querySelector(s);
const SL = ['a', 'p', 's', 'u', 'd'];   // doc order: Active 1, Passive 2, Shikigami 3, Domain/Ultimate 4
export const UPG = [['hp', 'Max Health', '+6% per level'], ['ce', 'Cursed-Energy Capacity', '+5 per level'], ['cer', 'CE Recharge Speed', '+8% per level'], ['spd', 'Movement Speed', '+1.5% per level'], ['dash', 'Dash', '-4% cooldown per level'], ['jump', 'Jump', '+2% height per level'], ['block', 'Block', 'wider perfect-block window'], ['gauge', 'Domain Gauge Charge', '+10% per level (max +50%)']];
export const UCOST = [100, 150, 200, 275, 350, 450, 550, 700, 850];
const TIERS = ['Grade 4', 'Grade 3', 'Grade 2', 'Semi-Grade 1', 'Grade 1', 'Special Grade'], DIVS = ['III', 'II', 'I'];
const seasonKey = () => { const d = new Date(); return d.getFullYear() + '-' + Math.floor(d.getMonth() / 2); };

/* ---------------- SAVE ---------------- */
export const Save = {
  d: null,
  fresh() {
    return { name: 'Sorcerer', created: false, tutorial: false, app: { ...DEFAULT_APP }, xp: 400, owned: { echo: 1, thorns: 1, hares: 1, surge: 1 }, equipped: { ...STARTERS, um: UM_DEF.slice() }, freeBoxes: {},
      cos: { hair: [0, 1, 2, 3], hairColor: [0, 1, 2, 3], outfit: [0], acc: [0], aura: [0], pose: [0] }, stats: { wins: 0, losses: 0, kos: 0, matches: 0, dmg: 0, crits: 0, perfects: 0, boxes: 0, assists: 0, curses: 0 }, uses: {}, history: [],
      elo: 1000, best: 1000, season: seasonKey(), upg: { hp: 1, ce: 1, cer: 1, spd: 1, dash: 1, jump: 1, block: 1, gauge: 1 }, respecs: 0, mission: { day: '', week: '', prog: {}, claimed: {} },
      settings: { quality: 'high', muted: false, master: 1, music: 0.6, sfx: 1, voices: true, sens: 1, keys: {} }, mast: {}, title: null };
  },
  load() {
    let raw = null; try { raw = JSON.parse(localStorage.getItem(KEY)) || JSON.parse(localStorage.getItem(KEY1)); } catch (e) { }
    const f = this.fresh(); this.d = raw ? { ...f, ...raw, cos: { ...f.cos, ...(raw.cos || {}) }, stats: { ...f.stats, ...(raw.stats || {}) }, settings: { ...f.settings, ...(raw.settings || {}) }, upg: { ...f.upg, ...(raw.upg || {}) }, freeBoxes: raw.freeBoxes || {} } : f;
    const d = this.d; d.mast = d.mast || {}; if (!d.mastMig) { d.mastMig = 1; for (const k in (d.uses || {})) if (d.mast[k] == null) d.mast[k] = Math.round(d.uses[k] * 6); } for (const k of Object.keys(d.owned)) if (!A[k]) delete d.owned[k]; if (A[d.equipped.u] && A[d.equipped.u].slot === 'd' && d.owned[d.equipped.u]) d.equipped.d = d.equipped.u; d.owned.surge = 1; if (!Array.isArray(d.equipped.um) || d.equipped.um.length !== 4 || d.equipped.um.some(id => !umOwned(id))) d.equipped.um = UM_DEF.slice(); for (const s of SL) if (!A[d.equipped[s]] || A[d.equipped[s]].slot !== s || !d.owned[d.equipped[s]]) { if (STARTERS[s]) d.equipped[s] = STARTERS[s]; else delete d.equipped[s]; }
    if (d.season !== seasonKey()) { d.elo = Math.round(800 + Math.max(0, d.elo - 800) * 0.5); d.season = seasonKey(); }
    return d;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { } if (Acct.d) schedulePush(); },
  import(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { } this.load(); },
  reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY1); } catch (e) { } this.load(); },
};
const dayKey = () => new Date().toISOString().slice(0, 10);
const weekKey = () => { const d = new Date(); const j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + 'w' + Math.floor(((d - j) / 864e5 + j.getDay()) / 7); };
const POOL = [
  { id: 'kos10', text: 'Defeat 10 opponents', stat: 'kos', target: 10, xp: 120 }, { id: 'win2', text: 'Win 2 matches', stat: 'wins', target: 2, xp: 150 },
  { id: 'crit5', text: 'Land 5 Overdrive Strikes', stat: 'crits', target: 5, xp: 140 }, { id: 'shiki3', text: 'Play 3 matches with a Shikigami equipped', stat: 'shikiMatches', target: 3, xp: 130 },
  { id: 'dmg1000', text: 'Deal 1000 damage', stat: 'dmg', target: 1000, xp: 130 }, { id: 'perf3', text: 'Perfect-block 3 heavy attacks', stat: 'perfects', target: 3, xp: 140 }, { id: 'play4', text: 'Play 4 matches', stat: 'matches', target: 4, xp: 100 },
];
const WEEKLY = [{ id: 'w_win8', text: 'Win 8 matches this week', stat: 'wins', target: 8, xp: 450, weekly: true }, { id: 'w_box5', text: 'Open 5 mystery boxes', stat: 'boxes', target: 5, xp: 300, weekly: true }];
function missions() {
  const m = Save.d.mission, dk = dayKey(), wk = weekKey();
  if (m.day !== dk) { m.day = dk; m.prog = { ...(m.prog || {}), d: {} }; m.claimed = { ...(m.claimed || {}) }; for (const k of Object.keys(m.claimed)) if (!k.startsWith('w_')) delete m.claimed[k]; }
  if (m.week !== wk) { m.week = wk; m.wprog = {}; for (const k of Object.keys(m.claimed)) if (k.startsWith('w_')) delete m.claimed[k]; }
  m.prog = m.prog || { d: {} }; m.prog.d = m.prog.d || {}; m.wprog = m.wprog || {};
  const seed = parseInt(dk.replace(/-/g, '')) % POOL.length; const daily = [0, 2, 4].map(i => POOL[(seed + i) % POOL.length]);
  return { daily, weekly: WEEKLY };
}
export function addProgress(stat, n) { if (!n) return; missions(); const m = Save.d.mission; m.prog.d[stat] = (m.prog.d[stat] || 0) + n; m.wprog[stat] = (m.wprog[stat] || 0) + n; }
export function rankInfo() {
  const e = Save.d.elo, t = Math.max(0, Math.min(17, Math.floor((e - 800) / 120))); const full = TIERS[Math.floor(t / 3)] + ' ' + DIVS[t % 3]; const short = ['G4', 'G3', 'G2', 'SG1', 'G1', 'SP'][Math.floor(t / 3)] + '·' + DIVS[t % 3];
  return { pts: Math.round(e), grade: short, full, tier: t, next: t >= 17 ? 0 : 800 + (t + 1) * 120 };
}
export const skillFromElo = (e) => Math.max(0.15, Math.min(0.97, (e - 600) / 1300));
export const rankedOpp = () => { const e = Save.d.elo || 1000; return Math.max(500, Math.round(e + (Math.random() * 2 - 1) * 70)); };
export function eloUpdate(won, draw, opp) {
  const d = Save.d, K = d.stats.matches < 10 ? 40 : 28; const ex = 1 / (1 + Math.pow(10, (opp - d.elo) / 400)); let delta = K * ((won ? 1 : draw ? 0.5 : 0) - ex); if (d.stats.matches < 10 && delta < 0) delta *= 0.5; d.elo = Math.max(800, d.elo + delta); d.best = Math.max(d.best || 0, d.elo); return Math.round(delta);
}
const MTHR = (L) => Math.round(10 * Math.pow(L, 1.7));
export const masteryPts = (id) => (Save.d.mast && Save.d.mast[id]) || 0;
export const masteryLv = (id) => { const p = masteryPts(id); let L = 0; while (L < 10 && p >= MTHR(L + 1)) L++; return L; };
export function masteryInfo(id) { const p = masteryPts(id), L = masteryLv(id); const lo = L ? MTHR(L) : 0, hi = L >= 10 ? MTHR(10) : MTHR(L + 1); return { lv: L, pts: p, lo, hi, pct: L >= 10 ? 100 : Math.round((p - lo) / (hi - lo) * 100) }; }
export function masteryGain(id, pts) { const b = masteryLv(id); Save.d.mast[id] = masteryPts(id) + pts; return { before: b, after: masteryLv(id) }; }
export const MCOSM = [[2, 'Spark burst on cast'], [4, 'Aura ring on cast'], [6, 'Rising ember plume'], [8, 'Golden impact flash'], [10, 'Golden halo burst + Master title']];
export const MTITLES = [[3, 'Initiate'], [6, 'Adept'], [10, 'Master']];
export function titleText() { const t = Save.d.title; if (!t) return ''; const [id, lv] = t.split(':'); const a = A[id]; const nm = (MTITLES.find(x => x[0] === +lv) || [0, ''])[1]; return a && nm && masteryLv(id) >= +lv ? `${a.name} ${nm}` : ''; }
export function masteryHtml(a) {
  const m = masteryInfo(a.id); const perk = DPERK[a.id];
  const cos = MCOSM.map(([l, t]) => `<div style="opacity:${m.lv >= l ? 1 : 0.45}">${m.lv >= l ? '✔' : '🔒'} Lv ${l}: ${t}</div>`).join('');
  const titles = MTITLES.map(([l, t]) => m.lv >= l ? `<button class="btn sm ${Save.d.title === a.id + ':' + l ? 'on' : ''}" data-title="${a.id}:${l}" style="margin:2px 4px 0 0">${a.name} ${t}</button>` : `<span class="dim" style="margin-right:8px">🔒 ${t} (Lv ${l})</span>`).join('');
  return `<div style="margin-top:10px;padding:10px;border:1px solid #ffffff22;border-radius:10px"><b>Mastery Lv ${m.lv}/10</b> <span class="dim">· ${m.pts} pts${m.lv < 10 ? ' · next at ' + m.hi : ' · MAX'}</span><div style="height:6px;background:#ffffff18;border-radius:4px;margin:6px 0"><i style="display:block;height:100%;width:${m.pct}%;background:linear-gradient(90deg,#ffd76a,#ff8a3a);border-radius:4px"></i></div>${perk ? `<div style="color:#ffd76a;margin-bottom:6px">★ <b>${perk[0]}</b> — ${perk[1]} <span class="dim">(currently ${Math.round(m.lv * 10)}% of max)</span></div>` : ''}<div style="font-size:12.5px">${cos}</div><div style="margin-top:6px">${titles}</div><div class="dim" style="font-size:12px;margin-top:4px">${perk ? 'Domain perks grow with mastery. ' : 'Mastery unlocks cosmetics only. '}Ranked matches treat every equipped ability as Level 10.</div></div>`;
}
export function upgMods(ranked) { if (ranked) return null; const u = Save.d.upg, L = (k) => (u[k] || 1) - 1; return { hp: 1 + 0.06 * L('hp'), ce: 5 * L('ce'), cer: 1 + 0.08 * L('cer'), spd: 1 + 0.015 * L('spd'), dash: 1 - 0.04 * L('dash'), jump: 1 + 0.02 * L('jump'), block: L('block'), gauge: 1 + 0.1 * L('gauge') }; }

/* ---------------- DOM ---------------- */
const CSS = `
:root{--bg:#0d0b1c;--pn:rgba(18,15,40,.92);--ln:rgba(160,140,255,.35);--ac:#8a7aff;--tx:#eef;--dim:#9a96c4}
*{box-sizing:border-box;margin:0;padding:0;user-select:none;-webkit-user-select:none}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--tx)}
canvas#c{position:fixed;inset:0;width:100%;height:100%;display:block;outline:none}
.hidden{display:none!important}
#fade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .35s;z-index:90}
.btn{background:linear-gradient(180deg,#5b4bd6,#3a2f9a);border:1px solid #9a8cff;color:#fff;font-weight:700;font-size:15px;padding:10px 20px;border-radius:10px;cursor:pointer;transition:.12s;letter-spacing:.3px}
.btn:hover{filter:brightness(1.25);transform:translateY(-1px)}.btn:active{transform:translateY(1px)}
.btn.sec{background:rgba(255,255,255,.08);border-color:var(--ln)}.btn.sm{padding:6px 12px;font-size:13px}.btn.dis{opacity:.4;pointer-events:none}.btn.gold{background:linear-gradient(180deg,#f0b43c,#b8741a);border-color:#ffd98a;color:#2a1600}
#title{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:radial-gradient(ellipse at 50% 30%,rgba(90,60,200,.55),rgba(8,6,20,.96) 70%)}
#title h1{font-size:clamp(48px,9vw,110px);font-weight:900;letter-spacing:6px;background:linear-gradient(180deg,#fff,#a99bff 60%,#5b3fd6);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 30px rgba(130,100,255,.7))}
#title p{color:var(--dim);max-width:640px;text-align:center;line-height:1.5;font-size:14px}
.keys{display:grid;grid-template-columns:repeat(4,auto);gap:6px 18px;font-size:12.5px;color:#cfc9ff;background:rgba(255,255,255,.05);padding:14px 20px;border-radius:12px;border:1px solid var(--ln)}
.keys b{color:#fff;background:rgba(255,255,255,.12);padding:1px 6px;border-radius:5px;font-size:11.5px}
.panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1060px,94vw);max-height:90vh;background:var(--pn);border:1px solid var(--ln);border-radius:18px;box-shadow:0 20px 80px rgba(0,0,0,.7),0 0 60px rgba(100,80,255,.18);z-index:60;display:flex;flex-direction:column;backdrop-filter:blur(14px);overflow:hidden;animation:pop .18s ease-out}
@keyframes pop{from{opacity:0;transform:translate(-50%,-48%) scale(.97)}}
.ph{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--ln);font-weight:800;font-size:18px;letter-spacing:1px}
.ph .xp{color:#ffd98a;font-size:15px}.pb{padding:18px 20px;overflow:auto;display:flex;flex-direction:column;gap:14px}.pb>*{flex-shrink:0}
.tabs{display:flex;gap:8px;flex-wrap:wrap}.tab{padding:8px 14px;border-radius:9px;border:1px solid var(--ln);background:rgba(255,255,255,.05);cursor:pointer;font-weight:700;font-size:14px}.tab.on{background:var(--ac);border-color:#c8bfff;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.card{position:relative;border:2px solid var(--rc,#555);background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border-radius:12px;padding:10px;cursor:pointer;min-height:112px;transition:.12s;display:flex;flex-direction:column;gap:4px}
.card:hover{transform:translateY(-2px);box-shadow:0 0 18px var(--rc)}.card.on{outline:3px solid #fff;box-shadow:0 0 24px var(--rc)}.card.lock{background:#050507;border-color:#2c2c36;box-shadow:none}.card.lock .ic{font-size:34px;font-weight:900;color:#4a4a58;text-shadow:0 0 12px #000}.card.lock .nm{color:#666}.card.lock .rr{color:#555}.card.lock:hover{box-shadow:0 0 12px #333}
.card .ic{font-size:30px;line-height:1}.card .nm{font-weight:800;font-size:13.5px}.card .rr{font-size:11px;color:var(--rc);font-weight:800;letter-spacing:.6px;text-transform:uppercase}.card .eq{position:absolute;top:6px;right:8px;font-size:10px;background:#fff;color:#000;padding:1px 6px;border-radius:6px;font-weight:800}
.desc{background:rgba(255,255,255,.06);border:1px solid var(--ln);border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.5;min-height:70px}.desc h3{font-size:17px;margin-bottom:2px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sp{flex:1}.dim{color:var(--dim)}.gold{color:#ffd98a}
.boxes{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.box{border:2px solid var(--bc);border-radius:16px;padding:16px;text-align:center;cursor:pointer;background:radial-gradient(circle at 50% 30%,color-mix(in srgb,var(--bc) 30%,transparent),rgba(255,255,255,.02));transition:.15s}
.box:hover{transform:translateY(-4px) scale(1.02);box-shadow:0 0 30px var(--bc)}.box .bi{font-size:56px;display:block;margin:6px 0}.box b{display:block;font-size:15px}
.reveal{position:fixed;inset:0;z-index:80;background:radial-gradient(circle,rgba(22,12,52,.97),rgba(2,1,8,.99));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
.reveal .rc{width:260px;border:3px solid var(--rc);border-radius:18px;padding:24px;text-align:center;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.03));box-shadow:0 0 70px var(--rc);animation:rv .8s cubic-bezier(.2,1.4,.4,1)}
@keyframes rv{from{transform:scale(.2) rotate(-12deg);opacity:0}}.reveal .rc .ic{font-size:76px}.reveal .rc h2{font-size:26px;margin:6px 0}.shake{animation:shk .5s infinite}@keyframes shk{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg) scale(1.08)}}
.reveal .rtitle{font:900 22px system-ui;letter-spacing:8px;color:#ffe9b0;text-shadow:0 0 20px #ffb43c;margin-bottom:-6px}.reelbox{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none}.reelbox .rb{font-size:120px;filter:drop-shadow(0 0 30px var(--bc))}.reelbox.shake{animation:shk .12s infinite}.reelbox.pop{animation:bpop .7s forwards}@keyframes bpop{to{transform:translate(-50%,-50%) scale(2.4);opacity:0}}
.reel{position:relative;width:min(1180px,96vw);height:230px;overflow:hidden;border-top:2px solid rgba(255,255,255,.15);border-bottom:2px solid rgba(255,255,255,.15);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(0,0,0,.4));transition:opacity .4s,transform .5s;transform:scaleY(.2)}.reel.in{transform:none}.reveal.done .reel{height:150px}.reveal.done .rcard{transform:scale(.7)}.reveal.done .rcard.win{transform:scale(.95)}
.rcard.hid{background:#040406;border-color:#2c2c36}.rcard.hid i{font-size:64px;font-weight:900;color:#3c3c48;font-style:normal;text-shadow:0 0 16px #000}.rcard.hid b{color:#555}.rcard.hid span{color:#444}.rcard.flip{animation:rflip .5s ease-out}@keyframes rflip{0%{transform:rotateY(90deg) scale(.9)}100%{transform:none}}
.strip{position:absolute;left:0;top:0;height:100%;display:flex;align-items:center;will-change:transform}.rcard{flex:0 0 160px;margin:0 5px;height:190px;border:2px solid var(--rc);border-radius:14px;background:linear-gradient(180deg,color-mix(in srgb,var(--rc) 28%,#0b0916),#0b0916);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;transition:transform .25s,opacity .4s,filter .4s;box-shadow:inset 0 -30px 40px -20px color-mix(in srgb,var(--rc) 45%,transparent)}.rcard i{font-size:54px;font-style:normal}.rcard b{font-size:14px;padding:0 6px}.rcard span{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--rc);font-weight:800}.rcard.hot{transform:scale(1.07)}.rcard.dim{opacity:.28;filter:grayscale(.6)}.rcard.win{transform:scale(1.18);box-shadow:0 0 50px var(--rc),0 0 120px var(--rc);z-index:2;animation:wp 1s ease-in-out infinite alternate}@keyframes wp{to{box-shadow:0 0 80px var(--rc),0 0 170px var(--rc)}}
.mark{position:absolute;left:50%;top:0;bottom:0;width:4px;margin-left:-2px;background:var(--mc,#fff);box-shadow:0 0 18px var(--mc,#fff),0 0 40px var(--mc,#fff);z-index:3}.mark:before,.mark:after{content:'';position:absolute;left:-9px;border:9px solid transparent}.mark:before{top:0;border-top-color:var(--mc,#fff)}.mark:after{bottom:0;border-bottom-color:var(--mc,#fff)}.fadeL,.fadeR{position:absolute;top:0;bottom:0;width:18%;z-index:2;pointer-events:none}.fadeL{left:0;background:linear-gradient(90deg,#05030c,transparent)}.fadeR{right:0;background:linear-gradient(270deg,#05030c,transparent)}
.reveal .res{display:flex;flex-direction:column;align-items:center;gap:14px;min-height:20px}.reveal .skip{position:absolute;bottom:26px;right:30px;transition:opacity .3s}.reveal.done .skip{display:none}.reveal .res .rc{animation:rv .7s cubic-bezier(.2,1.4,.4,1)}
.flash{position:absolute;inset:0;background:radial-gradient(circle,#fff,var(--rc) 40%,transparent 75%);animation:fl .9s ease-out forwards;pointer-events:none;z-index:6}@keyframes fl{from{opacity:.95}to{opacity:0}}.quake{animation:qk .09s 8}@keyframes qk{0%,100%{transform:translate(0,0)}25%{transform:translate(-9px,5px)}50%{transform:translate(8px,-6px)}75%{transform:translate(-6px,-4px)}}
.pt{position:fixed;border-radius:50%;background:var(--rc);box-shadow:0 0 12px var(--rc);pointer-events:none;z-index:7;animation:pt 1s ease-out forwards}@keyframes pt{to{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}
.rays{position:absolute;left:50%;top:50%;width:1600px;height:1600px;margin:-800px 0 0 -800px;background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--rc) 45%,transparent) 0 6deg,transparent 6deg 18deg);-webkit-mask:radial-gradient(circle,#000 0,transparent 60%);mask:radial-gradient(circle,#000 0,transparent 60%);animation:rs 9s linear infinite,rin 1.2s ease-out;pointer-events:none;opacity:.7}@keyframes rs{to{transform:rotate(360deg)}}@keyframes rin{from{opacity:0}}
.mi{border:1px solid var(--ln);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.04)}.bar{height:10px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden;width:220px}.bar i{display:block;height:100%;background:linear-gradient(90deg,#6bff9a,#2ec4ff)}
.modes{display:flex;gap:10px}.modes .tab{flex:1;text-align:center;padding:12px}.maps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.map{border:2px solid var(--ln);border-radius:12px;padding:12px;cursor:pointer;background:rgba(255,255,255,.04);font-size:13px}.map.on{border-color:#fff;background:rgba(140,120,255,.3)}.map b{display:block;margin-bottom:3px}
#prompt{position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:30;background:rgba(10,8,26,.85);border:1px solid var(--ln);padding:10px 20px;border-radius:12px;font-weight:700;font-size:16px;pointer-events:none}#prompt b{background:#fff;color:#000;padding:1px 8px;border-radius:6px;margin-right:8px}
#hub-hint{position:fixed;left:16px;bottom:14px;z-index:20;font-size:12.5px;color:#fff;text-shadow:0 1px 3px #000;opacity:.85;line-height:1.5}
#hudxp{position:fixed;right:16px;top:14px;z-index:20;background:rgba(10,8,26,.7);border:1px solid var(--ln);padding:8px 14px;border-radius:12px;font-weight:800;color:#ffd98a}
#hud{position:fixed;inset:0;z-index:25;pointer-events:none}
#hud .tm{position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:30px;font-weight:900;text-shadow:0 2px 8px #000;letter-spacing:2px}
#hud .tm small{display:block;font-size:12px;text-align:center;opacity:.7;letter-spacing:2px}
#hud .pl{position:absolute;left:24px;bottom:22px;width:min(380px,36vw)}.pl .nm{font-weight:800;font-size:15px;margin-bottom:4px;text-shadow:0 1px 4px #000}
.hb{height:20px;border-radius:5px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);position:relative;overflow:hidden;margin-bottom:5px;transform:skewX(-14deg)}.hb i{position:absolute;inset:0;width:100%;background:linear-gradient(180deg,#7dffb0,#1fbf6a);transition:width .12s}.hb u{position:absolute;inset:0;background:rgba(255,255,255,.5);transition:width .5s;text-decoration:none}.hb span{position:absolute;right:10px;top:0;font-size:12px;font-weight:800;line-height:18px;transform:skewX(14deg);text-shadow:0 1px 2px #000}
.hb.ce{height:12px}.hb.ce i{background:linear-gradient(180deg,#6ad0ff,#2a6cff)}.hb.ul{height:10px}.hb.ul i{background:linear-gradient(180deg,#ffb4ff,#a43cff)}.hb.ul.rdy{box-shadow:0 0 14px #d86cff;animation:pl 0.6s infinite alternate}@keyframes pl{to{filter:brightness(1.6)}}
.slots{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;gap:12px}.slot{width:74px;height:74px;border-radius:14px;border:3px solid var(--rc);background:rgba(10,8,26,.78);position:relative;overflow:hidden;text-align:center;box-shadow:0 0 14px color-mix(in srgb,var(--rc) 50%,transparent)}
.slot .ic{font-size:30px;line-height:50px}.slot .kk{position:absolute;left:5px;top:3px;font-size:11px;font-weight:900;background:#fff;color:#000;border-radius:5px;padding:0 5px}.slot .sn{position:absolute;bottom:2px;left:0;right:0;font-size:9.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 3px}
.slot .cdv{position:absolute;inset:0;background:rgba(0,0,0,.7);transform-origin:bottom;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px}.slot.rdy{animation:none}.slot.no{opacity:.55}.slot.on{outline:3px solid #6bff9a}
.slot.u.rdy{box-shadow:0 0 28px #d86cff;animation:pl .5s infinite alternate}
.oh{position:absolute;transform:translate(-50%,-100%);text-align:center;font-size:12px;font-weight:800;text-shadow:0 1px 3px #000;white-space:nowrap}.oh .hb{width:90px;height:9px;margin:2px auto 0;transform:none}.oh .hb.ce{height:5px}
.dn{position:absolute;font-weight:900;font-size:22px;text-shadow:0 2px 0 #000,0 0 8px #000;transform:translate(-50%,-50%);animation:dn .9s ease-out forwards;white-space:nowrap}.dn.big{font-size:34px}@keyframes dn{0%{opacity:0;margin-top:0;scale:.5}15%{opacity:1;scale:1.2}100%{opacity:0;margin-top:-90px}}
#big{position:absolute;top:22%;left:0;right:0;text-align:center;font-weight:900;font-size:clamp(34px,6vw,72px);letter-spacing:6px;text-shadow:0 0 30px currentColor,0 4px 0 #000;animation:bg 2s ease-out forwards;font-style:italic}#big small{display:block;font-size:16px;letter-spacing:4px;opacity:.8;font-style:normal}@keyframes bg{0%{opacity:0;transform:scale(1.6)}12%{opacity:1;transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:scale(1.05)}}
#count{position:absolute;top:35%;left:0;right:0;text-align:center;font-weight:900;font-size:120px;text-shadow:0 0 40px #8a7aff,0 6px 0 #000;font-style:italic}
#feed{position:absolute;top:14px;right:14px;text-align:right;font-size:14px;font-weight:700;text-shadow:0 1px 3px #000;display:flex;flex-direction:column;gap:4px}#feed div{background:rgba(0,0,0,.5);padding:4px 10px;border-radius:8px;animation:fd 5s forwards}@keyframes fd{0%,85%{opacity:1}100%{opacity:0}}
#cmbhint{position:absolute;right:16px;bottom:14px;font-size:11.5px;opacity:.75;text-align:right;line-height:1.5;text-shadow:0 1px 3px #000}
#pause,#result{position:fixed;inset:0;z-index:70;background:rgba(5,3,15,.75);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;backdrop-filter:blur(6px)}
#result h1{font-size:clamp(52px,9vw,110px);font-style:italic;font-weight:900;letter-spacing:6px}.stat{display:flex;gap:30px;font-size:16px;font-weight:700}.stat div{text-align:center}.stat b{display:block;font-size:26px;color:#ffd98a}
.cr{display:grid;grid-template-columns:340px 1fr;gap:0;height:100%}.cpan{position:fixed;right:24px;top:50%;transform:translateY(-50%);width:min(420px,94vw);max-height:88vh}
.sw{display:flex;gap:8px;flex-wrap:wrap}.sw i{width:34px;height:34px;border-radius:9px;border:3px solid transparent;cursor:pointer;display:block;position:relative}.sw i.on{border-color:#fff;box-shadow:0 0 12px #fff}.sw i.lk::after{content:"🔒";position:absolute;inset:0;font-size:14px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);border-radius:6px}
.ch{padding:7px 12px;border-radius:9px;border:1px solid var(--ln);background:rgba(255,255,255,.05);cursor:pointer;font-weight:700;font-size:13px}.ch.on{background:var(--ac);border-color:#fff}.ch small{opacity:.8;margin-left:4px;color:#ffd98a}

.hb.ul i{background:linear-gradient(180deg,#fff08a,#ffb400)!important}.hb.ul.rdy{box-shadow:0 0 16px #ffd23c!important}.slot.u{border-color:#ffd23c!important}.slot.u .gf{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(0deg,rgba(255,200,40,.55),rgba(255,230,120,.15));height:0}
.slot.u.rdy{box-shadow:0 0 28px #ffd23c!important}
#hud.cin .pl,#hud.cin .slots,#hud.cin #cmbhint,#hud.cin #oh,#hud.cin #sc,#hud.cin #feed{opacity:0;transition:opacity .3s}
#cine{position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden}
#cine .lb{position:absolute;left:0;right:0;height:0;background:#000;transition:height .35s cubic-bezier(.2,.8,.2,1)}#cine .lb.t{top:0}#cine .lb.b{bottom:0}#cine.on .lb{height:13vh}
#cine .flash{position:absolute;inset:0;opacity:0}#cine .flash.go{animation:fl 1s ease-out forwards}@keyframes fl{0%{opacity:1}100%{opacity:0}}
#cine .hs{position:absolute;inset:0;display:none;background:radial-gradient(ellipse at 50% 50%,transparent 25%,rgba(0,0,0,.85) 90%),repeating-conic-gradient(from 0deg at 50% 50%,transparent 0 5deg,color-mix(in srgb,var(--c) 22%,transparent) 5deg 5.7deg);mix-blend-mode:normal;animation:hsp 1.3s ease-in both}#cine .hs.on{display:block}@keyframes hsp{from{opacity:0}to{opacity:1}}
#cine .kj{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;display:none;font-family:'Noto Serif JP','Yu Mincho',serif;font-size:clamp(90px,22vw,320px);font-weight:900;letter-spacing:.06em;color:#fff;text-shadow:0 0 40px var(--c),0 0 120px var(--c),10px 10px 0 #000;background:linear-gradient(90deg,rgba(0,0,0,.0),rgba(0,0,0,.78) 20%,rgba(0,0,0,.78) 80%,rgba(0,0,0,0));padding:.05em 0;white-space:nowrap}#cine .kj.on{display:block;animation:kjs 1.8s cubic-bezier(.1,1.4,.3,1) both}@keyframes kjs{0%{transform:translateY(-50%) scale(2.4);opacity:0;filter:blur(18px)}12%{transform:translateY(-50%) scale(1);opacity:1;filter:none}85%{opacity:1}100%{transform:translateY(-50%) scale(.94);opacity:0}}
#cine .ttl{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;display:none}
#cine .ttl.on{display:block}#cine .ttl .k{font-size:clamp(13px,1.8vw,22px);letter-spacing:12px;font-weight:800;opacity:.9;animation:tk 1.1s ease-out both}#cine .ttl .n{font-size:clamp(30px,5.4vw,88px);font-weight:900;font-style:italic;letter-spacing:4px;line-height:1;text-shadow:0 0 50px currentColor,0 6px 0 #000;animation:tn 1.2s cubic-bezier(.1,1.5,.3,1) both;white-space:nowrap}
#cine .ttl .s{font-size:clamp(14px,2vw,26px);font-weight:700;letter-spacing:6px;opacity:.85;margin-top:8px;animation:tk 1.3s .2s ease-out both}
#cine .ttl .sl{position:absolute;left:-10%;right:-10%;top:50%;height:34%;transform:translateY(-50%) skewY(-4deg);background:linear-gradient(90deg,transparent,var(--c),transparent);opacity:.35;animation:sl .9s ease-out both}
@keyframes tn{0%{transform:scale(3.2);opacity:0;filter:blur(18px)}40%{transform:scale(.96);opacity:1;filter:blur(0)}100%{transform:scale(1)}}@keyframes tk{0%{opacity:0;letter-spacing:40px}100%{opacity:.9}}@keyframes sl{0%{transform:translateY(-50%) skewY(-4deg) scaleX(0)}100%{transform:translateY(-50%) skewY(-4deg) scaleX(1)}}
#cine .warn{position:absolute;top:16%;left:0;right:0;text-align:center;font-weight:900;font-size:clamp(22px,3.6vw,48px);letter-spacing:6px;text-shadow:0 0 24px currentColor,0 3px 0 #000;display:none}#cine .warn small{display:block;font-size:15px;letter-spacing:5px;margin-top:4px;color:#fff}
#cine .warn.on{display:block;animation:wp .35s infinite alternate}@keyframes wp{to{transform:scale(1.06);filter:brightness(1.4)}}
#cine .vig{position:absolute;inset:0;box-shadow:inset 0 0 160px 40px var(--c);opacity:0;transition:opacity .2s}#cine .vig.on{opacity:.7;animation:wp .3s infinite alternate}
#cine .clash{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,92vw);text-align:center;display:none;z-index:2}#cine .clash.on{display:block}
#cine .clash h2{font-size:clamp(30px,5vw,64px);font-style:italic;font-weight:900;letter-spacing:6px;text-shadow:0 0 30px #fff,0 4px 0 #000}
#cine .keycap{display:inline-block;margin:10px;padding:12px 30px;font-size:46px;font-weight:900;background:#fff;color:#000;border-radius:14px;box-shadow:0 8px 0 #888,0 0 30px #fff;animation:kc .22s infinite alternate}@keyframes kc{to{transform:translateY(6px);box-shadow:0 2px 0 #888,0 0 30px #fff}}
#cine .cb{height:26px;border-radius:13px;background:rgba(0,0,0,.65);border:2px solid #fff;overflow:hidden;display:flex;margin-top:8px}#cine .cb i{display:block;height:100%;transition:width .08s}
#cine .clash .nn{display:flex;justify-content:space-between;font-weight:900;font-size:20px;text-shadow:0 2px 0 #000;margin-top:10px}
#cine .trial{position:absolute;left:50%;bottom:19%;transform:translateX(-50%);width:min(620px,90vw);text-align:center;display:none;font-weight:900;text-shadow:0 2px 0 #000}#cine .trial.on{display:block}#cine .trial .t1{font-size:28px;letter-spacing:4px;color:#ffd070}
#cine .reels{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);display:none;z-index:2;text-align:center}#cine .reels.on{display:block}#cine .reels .rw{display:flex;gap:14px;background:linear-gradient(180deg,#2a0838,#12031c);border:4px solid #ff40c0;border-radius:22px;padding:18px 24px;box-shadow:0 0 60px #ff40c0}#cine .reels .rl{width:110px;height:130px;background:#fff;border-radius:12px;font-size:84px;line-height:130px;color:#000}
#cine .reels h3{font-size:34px;letter-spacing:6px;margin-bottom:10px;text-shadow:0 0 24px #ff40c0,0 3px 0 #000;font-style:italic}
#cine .noise{position:absolute;inset:0;display:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 2px,rgba(0,0,0,.18) 2px 4px);animation:nz .12s steps(2) infinite;z-index:1}#cine .noise.on{display:block}@keyframes nz{50%{background-position:0 3px}}
#cine .noiset{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:clamp(26px,5vw,70px);font-weight:900;letter-spacing:8px;color:#fff;text-shadow:0 0 30px #000,0 0 6px #000;z-index:2}#cine .noiset.on{display:flex}
#cine .resp{position:absolute;bottom:26%;left:0;right:0;text-align:center;font-size:30px;font-weight:900;letter-spacing:6px;text-shadow:0 3px 0 #000;display:none}#cine .resp.on{display:block}
#sb{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);min-width:min(620px,92vw);background:rgba(8,6,22,.88);border:1px solid var(--ln);border-radius:14px;padding:14px 18px;display:none;pointer-events:none}#sb.on{display:block}#sb table{width:100%;border-collapse:collapse;font-size:15px;font-weight:700}#sb th{opacity:.6;font-size:12px;letter-spacing:2px;text-align:right}#sb th:first-child,#sb td:first-child{text-align:left}#sb td{text-align:right;padding:5px 4px}#sb tr.me td{color:#ffd98a}
.res{display:flex;flex-direction:column;gap:6px;width:min(720px,92vw);font-weight:700}.res .rr2{display:grid;grid-template-columns:30px 1fr 60px 60px 60px 80px;gap:6px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.06);align-items:center}.res .rr2.me{background:rgba(255,217,138,.18);outline:1px solid #ffd98a}.res .rr2.h{opacity:.6;font-size:12px;letter-spacing:2px;background:none}
.kb{display:grid;grid-template-columns:1fr 130px;gap:6px 14px;align-items:center;max-height:260px;overflow:auto;padding:4px}.kb .ch{text-align:center}.kb .ch.listen{background:#ffd23c;color:#000}
input[type=range]{accent-color:#8a7aff;width:140px}
.upg{display:grid;grid-template-columns:1fr auto;gap:2px 12px;align-items:center;border:1px solid var(--ln);border-radius:12px;padding:10px 14px;background:rgba(255,255,255,.04)}.upg .pips{display:flex;gap:3px;grid-column:1/3}.upg .pips i{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.12)}.upg .pips i.on{background:linear-gradient(90deg,#6bff9a,#2ec4ff)}
input.nm{background:rgba(255,255,255,.08);border:1px solid var(--ln);color:#fff;padding:9px 12px;border-radius:9px;font-size:16px;width:100%}

/* ===== JJK-ish skin: black / crimson / bone, angular cuts ===== */
:root{--bg:#07060a;--pn:rgba(10,8,14,.94);--ln:rgba(214,40,60,.55);--ac:#c8102e;--tx:#f3ece4;--dim:#a39aa0}
html,body{font-family:"Impact","Haettenschweiler","Arial Narrow Bold","Segoe UI",system-ui,sans-serif;letter-spacing:.4px}
.btn{background:linear-gradient(180deg,#d4142f,#7a0a1b);border:0;border-left:4px solid #fff;color:#fff;clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%);padding:10px 26px 10px 18px;text-transform:uppercase;letter-spacing:1.5px;font-weight:900;border-radius:0}
.btn.sec{background:rgba(255,255,255,.07);border-left-color:#c8102e}.btn.gold{background:linear-gradient(180deg,#e8e0d0,#a89c88);color:#120008;border-left-color:#c8102e}
.panel{border-radius:0;border:1px solid var(--ln);border-left:6px solid #c8102e;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px));box-shadow:0 0 80px rgba(200,16,46,.25)}
.ph{background:linear-gradient(90deg,rgba(200,16,46,.35),transparent 70%);text-transform:uppercase;letter-spacing:4px;font-style:italic}
.tab,.ch,.map,.mi,.desc,.card,.box{border-radius:0!important}.tab.on,.ch.on{background:#c8102e;border-color:#fff}
.card{clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)}
#title{background:radial-gradient(ellipse at 50% 35%,rgba(160,10,30,.55),rgba(4,2,6,.97) 70%)}
#title h1{font-style:italic;letter-spacing:10px;background:linear-gradient(180deg,#fff,#e8d8cc 45%,#c8102e);-webkit-background-clip:text;filter:drop-shadow(0 0 26px rgba(200,16,46,.85)) drop-shadow(5px 5px 0 #000);transform:skewX(-8deg)}
#hud .pl{width:min(430px,38vw)}.pl .nm{font-style:italic;text-transform:uppercase;letter-spacing:3px;font-size:17px;border-left:5px solid #c8102e;padding-left:8px}
.hb{height:22px;border-radius:0;transform:skewX(-22deg);border:2px solid #f3ece4;background:rgba(0,0,0,.75);box-shadow:0 0 12px rgba(0,0,0,.8)}
.hb i{background:linear-gradient(180deg,#f2eadf,#b8aa98)!important}.hb u{background:#c8102e!important}
.hb.ce i{background:linear-gradient(180deg,#9a6aff,#4a1fb8)!important}.hb.ul i{background:linear-gradient(180deg,#ff5a6a,#a00a22)!important}.hb.ul.rdy{box-shadow:0 0 18px #ff2a4a!important}
.slot{border-radius:0;border-width:2px;transform:skewX(-8deg);width:78px;height:78px;background:rgba(6,4,8,.88);clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}.slot .ic,.slot .sn,.slot .kk{transform:skewX(8deg)}
.slot .kk{background:#c8102e;color:#fff;border-radius:0}.slot.u{border-color:#c8102e!important}.slot.u .gf{background:linear-gradient(0deg,rgba(200,16,46,.75),rgba(255,90,100,.2))}.slot.u.rdy{box-shadow:0 0 30px #ff2a4a!important}
#sc{font-style:italic;text-shadow:0 0 14px #000,3px 3px 0 #000}
#big{font-style:italic;text-shadow:0 0 34px currentColor,5px 5px 0 #000}
#feed div{border-radius:0;border-right:4px solid #c8102e;background:linear-gradient(270deg,rgba(0,0,0,.8),transparent)}
#cine .imp{position:absolute;inset:0;opacity:0;background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.55) 0 1.2deg,transparent 1.2deg 5deg);mix-blend-mode:screen}
#cine .imp.go{animation:ip .16s steps(4) forwards}#cine .imp.crit{background:repeating-conic-gradient(from 0deg at 50% 50%,#ff1a3a 0 1.6deg,#000 1.6deg 5deg)}@keyframes ip{0%{opacity:.85}100%{opacity:0}}
.oh{text-transform:uppercase;letter-spacing:2px;font-style:italic}.oh .hb{transform:skewX(-22deg);height:7px;border-width:1px}
#cmbhint{font-family:system-ui,sans-serif;letter-spacing:0}
#result h1{transform:skewX(-8deg)}.res .rr2{border-radius:0;border-left:4px solid #c8102e}
`;
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-title]'); if (b) { Save.d.title = Save.d.title === b.dataset.title ? null : b.dataset.title; Save.save(); b.parentElement.querySelectorAll('[data-title]').forEach(x => x.classList.toggle('on', x.dataset.title === Save.d.title)); sfx('click'); } });
export function injectCSS() { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

export function mountDOM() {
  document.body.insertAdjacentHTML('beforeend', `
  <div id="fade"></div>
  <div id="hudxp" class="hidden"></div><div id="prompt" class="hidden"></div>
  <div id="hub-hint" class="hidden"><b>WASD</b> move · <b>Shift</b> sprint-dash · <b>Space</b> jump · <b>E</b> interact · <b>Mouse</b> look (click to capture)</div>
  <div id="hud" class="hidden"></div><div id="layer"></div>`);
}
export const layer = () => $('#layer');
export function fade(on) { $('#fade').style.opacity = on ? 1 : 0; return new Promise(r => setTimeout(r, 380)); }
export function closePanels() { $('#layer').innerHTML = ''; }
export function setXP() { const e = $('#hudxp'); e.innerHTML = `${Save.d.xp} XP · Rank ${rankInfo().grade}`; }
function panel(title, body, { onClose, wide, noClose } = {}) {
  closePanels(); const d = document.createElement('div'); d.className = 'panel'; if (wide) d.style.width = 'min(1180px,96vw)';
  d.innerHTML = `<div class="ph"><span>${title}</span><span class="row"><span class="xp">${Save.d.xp} XP</span>${noClose ? '' : '<button class="btn sec sm" id="pclose">✕ Close (Esc)</button>'}</span></div><div class="pb"></div>`;
  $('.pb', d).appendChild(body); $('#layer').appendChild(d); sfx('open');
  const close = () => { closePanels(); onClose && onClose(); }; const b = $('#pclose', d); if (b) b.onclick = close; d._close = close; return d;
}
export function topPanelClose() { const p = $('#layer .panel'); if (p && p._close) { p._close(); return true; } return false; }
const h = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const rc = (r) => RARITY[r].color;
const cardHtml = (a, owned, eq) => `<div class="card ${owned ? '' : 'lock'} ${eq ? 'on' : ''}" data-id="${a.id}" style="--rc:${owned ? rc(a.r) : '#3a3a44'}"><div class="ic">${owned ? a.icon : '?'}</div><div class="nm">${owned ? a.name : '???'}</div><div class="rr">${owned ? RARITY[a.r].name : 'Undiscovered'}</div>${eq ? '<span class="eq">EQUIPPED</span>' : ''}</div>`;

/* ---------------- TECHNIQUES ---------------- */
export function openTechnique(onClose) {
  let slot = 'p', sel = Save.d.equipped.p, mslot = 0; const root = h('');
  const draw = () => {
    if (slot === 'm') {
      const eq = Save.d.equipped.um, all = Object.values(UMOVES), own = all.filter(m => umOwned(m.id));
      root.innerHTML = `<div class="tabs">${[...SL, 'm'].map(s => `<div class="tab ${s === slot ? 'on' : ''}" data-s="${s}">${s === 'm' ? 'Ultimate Moves' : SLOTS[s]}</div>`).join('')}</div>
      <div class="dim">These four moves replace keys 1-4 while your Ultimate State is active. Pick a slot, then click a move to put in it. Unlock more by opening Ultimate Boxes (each state unlocks its four moves).</div>
      <div class="row" style="gap:10px;margin:10px 0">${eq.map((id, i) => { const m = UMOVES[id]; return `<div class="card ${i === mslot ? 'on' : ''}" data-slot="${i}" style="--rc:${m ? m.color : '#888'};min-width:120px"><div class="ic">${m ? m.icon : '—'}</div><div class="nm">${i + 1}. ${m ? m.name : '—'}</div></div>`; }).join('')}</div>
      <div class="grid">${own.map(m => `<div class="card ${eq.includes(m.id) ? 'on' : ''}" data-mv="${m.id}" style="--rc:${m.color}"><div class="ic">${m.icon}</div><div class="nm">${m.name}</div><div class="rr">${A[m.state].name.split(' ')[0]} · ${m.cd}s</div></div>`).join('')}</div>`;
      root.querySelectorAll('.tab').forEach(t => t.onclick = () => { slot = t.dataset.s; sel = Save.d.equipped[slot]; sfx('click'); draw(); });
      root.querySelectorAll('[data-slot]').forEach(c => c.onclick = () => { mslot = +c.dataset.slot; sfx('click'); draw(); });
      root.querySelectorAll('[data-mv]').forEach(c => c.onclick = () => { const id = c.dataset.mv, ex = eq.indexOf(id); if (ex >= 0) eq[ex] = eq[mslot]; eq[mslot] = id; Save.save(); sfx('open'); draw(); });
      return;
    }
    const list = BY_SLOT(slot).sort((a, b) => { const oa = !!Save.d.owned[a.id], ob = !!Save.d.owned[b.id]; return oa !== ob ? (oa ? -1 : 1) : oa ? 'CREL'.indexOf(a.r) - 'CREL'.indexOf(b.r) : 0; }); const a = A[sel] || list[0]; if (!a) { root.innerHTML = '<div class="dim">Nothing here yet.</div>'; return; } const owned = !!Save.d.owned[a.id]; const own = list.filter(x => Save.d.owned[x.id]).length;
    root.innerHTML = `<div class="tabs">${SL.map(s => `<div class="tab ${s === slot ? 'on' : ''}" data-s="${s}">${SLOTS[s]} <span class="dim">· equipped: ${A[Save.d.equipped[s]] ? A[Save.d.equipped[s]].name : 'none'}</span></div>`).join('')}<div class="tab" data-s="m">Ultimate Moves</div></div>
    <div class="dim">${own}/${list.length} collected in this slot. Click a technique to inspect it, then equip it.</div>
    <div class="grid">${list.map(x => cardHtml(x, !!Save.d.owned[x.id], Save.d.equipped[slot] === x.id)).join('')}</div>
    <div class="desc"><h3 style="color:${owned ? rc(a.r) : '#777'}">${owned ? a.icon + ' ' + a.name : '? ??? — Undiscovered'}</h3>${owned ? `${a.desc}<div class="dim" style="margin-top:6px">${a.cost ? 'Energy ' + a.cost + ' · ' : ''}${a.cd ? 'Cooldown ' + a.cd + 's · ' : ''}${slot === 'u' ? 'Needs full gauge · lasts ' + (a.dur || 22) + 's · ' : ''}${slot === 'd' ? 'Key 5 inside an Ultimate State once the Cursed Energy meter is full (it fills as you fight; burnout after) · lasts ' + ({ R: 30, E: 45, L: 60 }[a.r]) + 's · domain power x' + ({ R: 1.8, E: 2.6, L: 3.6 }[a.r]) + ' · 60s cooldown · ' : ''}${slot === 'u' ? 'Equip your four Ultimate Moves in the Ultimate Moves tab · ' : ''}${a.moves ? '<br>Moves: ' + a.moves.map((m, i) => (i + 1) + '. ' + m.name).join(' · ') + '<br>' : ''}</div>${masteryHtml(a)}` : `Open the ${SLOTS[slot]} Box at the Mystery Box Station to unlock.`}
    ${owned ? `<div style="margin-top:10px"><button class="btn ${Save.d.equipped[slot] === a.id ? 'dis' : ''}" id="eqb">${Save.d.equipped[slot] === a.id ? 'Equipped' : 'Equip'}</button></div>` : ''}</div>`;
    root.querySelectorAll('.tab').forEach(t => t.onclick = () => { slot = t.dataset.s; sel = Save.d.equipped[slot]; sfx('click'); draw(); });
    root.querySelectorAll('.card').forEach(c => c.onclick = () => { sel = c.dataset.id; sfx('click'); draw(); });
    const eb = root.querySelector('#eqb'); if (eb) eb.onclick = () => { Save.d.equipped[slot] = a.id; Save.save(); sfx('open'); draw(); };
  };
  draw(); panel('⛩ TECHNIQUE STATION', root, { onClose, wide: true });
}


/* ---------------- ONLINE: rooms + friends ---------------- */
export function toast(msg, action) {
  let c = document.getElementById('toasts'); if (!c) { c = document.createElement('div'); c.id = 'toasts'; c.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none'; document.body.appendChild(c); }
  const t = document.createElement('div'); t.style.cssText = 'background:rgba(12,10,22,.94);border:1px solid #6a5a9a;color:#fff;padding:10px 16px;border-radius:8px;font:700 14px system-ui;box-shadow:0 4px 20px #000a;pointer-events:auto;display:flex;gap:12px;align-items:center'; t.textContent = msg;
  if (action) { const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = action.label; b.onclick = () => { action.fn(); t.remove(); }; t.appendChild(b); }
  c.appendChild(t); setTimeout(() => t.remove(), action ? 12000 : 3500);
}
const VIS = { public: ['🌐 Public', 'Listed in Public Games — anyone can join'], friends: ['👥 Friends only', 'Only your friends can join'], code: ['🔑 Code only', 'Hidden — only people with the room code can join'] };
const MODES = { '1v1': '1v1 Duel (2 players)', '2v2': '2v2 Teams (4 players)', ffa: 'Free-for-all (up to 5)' };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function openOnline(onClose) {
  let tab = 'play'; const root = h(''); const profile = () => ({ app: Save.d.app, equipped: Save.d.equipped, elo: Save.d.elo });
  const mapOpts = (sel) => ['random', 'forest', 'bamboo', 'snow', 'station', 'city', 'shrine'].map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${k === 'random' ? 'Random map' : (MAPS[k] ? MAPS[k].name : k)}</option>`).join('');
  const modeOpts = (sel) => Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
  const visOpts = (sel) => Object.entries(VIS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v[0]} — ${v[1]}</option>`).join('');
  const inp = 'style="background:#0e0c18;border:1px solid #4a3f6a;color:#fff;padding:8px;border-radius:6px;font:600 14px system-ui"';
  const draw = () => {
    if (!document.body.contains(root) && root._mounted) { off(); return; }
    const keep = {}; root.querySelectorAll('input,select').forEach(e => { if (e.id) keep[e.id] = e.value; }); const focus = document.activeElement && document.activeElement.id;
    if (!Net.ok) {
      root.innerHTML = `<div style="max-width:560px"><h3>🌐 Online play</h3><p class="dim">Connect to a JJKLASH server to play with friends and other players. If you opened the game from a server link it is already filled in.</p>
      <div class="row" style="gap:8px;margin:10px 0"><input id="srv" ${inp} style="flex:1;background:#0e0c18;border:1px solid #4a3f6a;color:#fff;padding:8px;border-radius:6px" value="${esc(keep.srv || Net.defaultUrl())}"><button class="btn" id="conn">${Net.connecting ? 'Connecting…' : 'Connect'}</button></div>
      ${Net.error ? `<div style="color:#ff8a8a;font-weight:700">${esc(Net.error)}</div>` : ''}<p class="dim">Hosting your own: run <b>node server.js</b> from the server folder (see README), then open <b>http://YOUR-IP:8787</b>.</p></div>`;
      const b = root.querySelector('#conn'); b.onclick = () => { Net.connect(root.querySelector('#srv').value.trim(), Save.d.name); draw(); }; return;
    }
    const r = Net.room, me = Net.me; const host = r && r.host === me.pid;
    let body = '';
    if (r) {
      body = `<div class="row" style="gap:18px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:300px"><h3 style="margin:0">${esc(r.name)}</h3><div class="dim">Room code</div><div style="font:900 40px monospace;letter-spacing:6px;color:#ffd070">${r.code}</div>
        <button class="btn sec sm" id="cpc">Copy code</button>
        <h4 style="margin:14px 0 6px">Players (${r.members.length}/${r.max})</h4>
        ${r.members.map(m => `<div class="row" style="justify-content:space-between;padding:6px 10px;background:#15122a;border-radius:6px;margin-bottom:4px"><span>${m.pid === r.host ? '👑 ' : ''}<b>${esc(m.name)}</b>${m.pid === me.pid ? ' <span class="dim">(you)</span>' : ''}</span>${host && m.pid !== me.pid ? `<button class="btn sec sm" data-kick="${m.pid}">Kick</button>` : ''}</div>`).join('')}
        </div>
        <div style="flex:1;min-width:300px"><h4 style="margin:0 0 6px">Room settings ${host ? '' : '<span class="dim">(host only)</span>'}</h4>
        <div class="dim">Who can join</div><select id="rvis" ${inp} ${host ? '' : 'disabled'}>${visOpts(r.vis)}</select>
        <div class="dim" style="margin-top:8px">Mode</div><select id="rmode" ${inp} ${host ? '' : 'disabled'}>${modeOpts(r.mode)}</select>
        <div class="dim" style="margin-top:8px">Map</div><select id="rmap" ${inp} ${host ? '' : 'disabled'}>${mapOpts(r.map)}</select>
        ${host ? `<div style="margin-top:14px"><button class="btn" id="rstart" ${r.members.length < 2 ? 'style="opacity:.5"' : ''}>▶ Start match</button></div>` : '<div class="dim" style="margin-top:14px">Waiting for the host to start…</div>'}
        <div style="margin-top:8px"><button class="btn sec" id="rleave">Leave room</button></div>
        <h4 style="margin:14px 0 6px">Invite friends</h4>${Net.friends.filter(f => f.online && !(f.room && f.room.code === r.code)).map(f => `<div class="row" style="justify-content:space-between;margin-bottom:4px"><span>${esc(f.name)}</span><button class="btn sm" data-inv="${f.pid}">Invite</button></div>`).join('') || '<div class="dim">No friends online.</div>'}
        </div></div>`;
    } else if (tab === 'play') {
      body = `<div class="row" style="gap:22px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:300px"><h3 style="margin:0 0 8px">Create a room</h3>
        <div class="dim">Room name</div><input id="cname" ${inp} maxlength="24" placeholder="${esc(Save.d.name)}'s room" style="width:100%;box-sizing:border-box;background:#0e0c18;border:1px solid #4a3f6a;color:#fff;padding:8px;border-radius:6px">
        <div class="dim" style="margin-top:8px">Who can join</div><select id="cvis" ${inp}>${visOpts('public')}</select>
        <div class="dim" style="margin-top:8px">Mode</div><select id="cmode" ${inp}>${modeOpts('1v1')}</select>
        <div class="dim" style="margin-top:8px">Map</div><select id="cmap" ${inp}>${mapOpts('random')}</select>
        <div style="margin-top:14px"><button class="btn" id="ccreate">Create room</button></div>
        <h3 style="margin:22px 0 8px">Join with a code</h3><div class="row" style="gap:8px"><input id="jcode" ${inp} maxlength="5" placeholder="ABCDE" style="text-transform:uppercase;letter-spacing:4px;width:140px;background:#0e0c18;border:1px solid #4a3f6a;color:#fff;padding:8px;border-radius:6px"><button class="btn" id="jgo">Join</button></div></div>
        <div style="flex:1.2;min-width:320px"><div class="row" style="justify-content:space-between"><h3 style="margin:0 0 8px">🌐 Public games</h3><button class="btn sec sm" id="prefresh">Refresh</button></div>
        ${Net.rooms.map(g => `<div class="row" style="justify-content:space-between;padding:8px 10px;background:#15122a;border-radius:6px;margin-bottom:5px"><span><b>${esc(g.name)}</b><br><span class="dim">${MODES[g.mode] ? MODES[g.mode].split(' (')[0] : g.mode} · ${g.map === 'random' ? 'random map' : (MAPS[g.map] ? MAPS[g.map].name : g.map)} · host ${esc(g.host || '?')}</span></span><span><span class="dim">${g.n}/${g.max}</span> <button class="btn sm" data-join="${g.code}">Join</button></span></div>`).join('') || '<div class="dim">No public games right now — create one!</div>'}
        </div></div>`;
    } else {
      body = `<div class="row" style="gap:22px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:300px"><h3 style="margin:0 0 6px">Your friend code</h3><div style="font:900 36px monospace;letter-spacing:6px;color:#9ad0ff">${me.code}</div><button class="btn sec sm" id="cpf">Copy</button>
        <h3 style="margin:20px 0 8px">Add a friend</h3><div class="row" style="gap:8px"><input id="fcode" ${inp} maxlength="6" placeholder="FRIEND CODE" style="text-transform:uppercase;letter-spacing:3px;width:170px;background:#0e0c18;border:1px solid #4a3f6a;color:#fff;padding:8px;border-radius:6px"><button class="btn" id="fadd">Send request</button></div>
        ${Net.incoming.length ? `<h4 style="margin:18px 0 6px">Requests</h4>${Net.incoming.map(p => `<div class="row" style="justify-content:space-between;margin-bottom:4px"><b>${esc(p.name)}</b><span><button class="btn sm" data-acc="${p.pid}">Accept</button> <button class="btn sec sm" data-dec="${p.pid}">Decline</button></span></div>`).join('')}` : ''}
        ${Net.outgoing.length ? `<h4 style="margin:18px 0 6px">Pending</h4>${Net.outgoing.map(p => `<div class="dim">${esc(p.name)} — waiting for reply</div>`).join('')}` : ''}</div>
        <div style="flex:1.3;min-width:320px"><h3 style="margin:0 0 8px">Friends (${Net.friends.length})</h3>
        ${[...Net.friends].sort((a, b) => b.online - a.online).map(f => `<div class="row" style="justify-content:space-between;padding:8px 10px;background:#15122a;border-radius:6px;margin-bottom:5px"><span><span style="color:${f.online ? '#6bff9a' : '#777'}">●</span> <b>${esc(f.name)}</b><br><span class="dim">${!f.online ? 'Offline' : f.room ? (f.room.state === 'playing' ? 'In a match' : 'In room “' + esc(f.room.name) + '” ' + f.room.n + '/' + f.room.max) : 'Online'}</span></span>
        <span>${f.room && f.room.state === 'lobby' && f.room.n < f.room.max && !(Net.room && Net.room.code === f.room.code) ? `<button class="btn sm" data-join="${f.room.code}">Join</button> ` : ''}${Net.room && f.online && !(f.room && f.room.code === Net.room.code) ? `<button class="btn sm" data-inv="${f.pid}">Invite</button> ` : ''}<button class="btn sec sm" data-rm="${f.pid}">✕</button></span></div>`).join('') || '<div class="dim">No friends yet — share your code, or enter theirs.</div>'}</div></div>`;
    }
    const tabs = r ? '' : `<div class="tabs"><div class="tab ${tab === 'play' ? 'on' : ''}" data-tab="play">Rooms</div><div class="tab ${tab === 'friends' ? 'on' : ''}" data-tab="friends">Friends${Net.incoming.length ? ' <b style="color:#ffd070">(' + Net.incoming.length + ')</b>' : ''}</div></div>`;
    root.innerHTML = `<div class="dim" style="margin-bottom:6px">Signed in as <b>${esc(me.name)}</b> · ping ${Net.ping || '–'}ms</div>${tabs}${body}`;
    for (const k in keep) { const e = root.querySelector('#' + k); if (e) e.value = keep[k]; } if (focus) { const e = root.querySelector('#' + focus); if (e) { e.focus(); try { e.setSelectionRange(e.value.length, e.value.length); } catch (x) { } } }
    const q = (s) => root.querySelector(s), qa = (s) => root.querySelectorAll(s);
    qa('[data-tab]').forEach(t => t.onclick = () => { tab = t.dataset.tab; sfx('click'); draw(); });
    qa('[data-join]').forEach(b => b.onclick = () => Net.send({ t: 'join', code: b.dataset.join, profile: profile() }));
    qa('[data-inv]').forEach(b => b.onclick = () => Net.send({ t: 'invite', pid: b.dataset.inv }));
    qa('[data-kick]').forEach(b => b.onclick = () => Net.send({ t: 'kick', pid: b.dataset.kick }));
    qa('[data-acc]').forEach(b => b.onclick = () => Net.send({ t: 'friend-accept', pid: b.dataset.acc, ok: true }));
    qa('[data-dec]').forEach(b => b.onclick = () => Net.send({ t: 'friend-accept', pid: b.dataset.dec, ok: false }));
    qa('[data-rm]').forEach(b => b.onclick = () => { if (confirm('Remove this friend?')) Net.send({ t: 'friend-remove', pid: b.dataset.rm }); });
    const on = (s, fn) => { const e = q(s); if (e) e.onclick = fn; }; const cp = (txt) => { try { navigator.clipboard.writeText(txt); toast('Copied ' + txt); } catch (e) { toast(txt); } };
    on('#ccreate', () => Net.send({ t: 'create', name: q('#cname').value.trim(), vis: q('#cvis').value, mode: q('#cmode').value, map: q('#cmap').value, profile: profile() }));
    on('#jgo', () => Net.send({ t: 'join', code: q('#jcode').value.trim(), profile: profile() })); on('#prefresh', () => Net.send({ t: 'rooms' }));
    on('#fadd', () => { Net.send({ t: 'friend-add', code: q('#fcode').value.trim() }); q('#fcode').value = ''; }); on('#cpf', () => cp(me.code)); on('#cpc', () => cp(r.code));
    on('#rleave', () => Net.send({ t: 'leave' })); on('#rstart', () => { Net.send({ t: 'profile', profile: profile() }); Net.send({ t: 'start' }); });
    for (const id of ['rvis', 'rmode', 'rmap']) { const e = q('#' + id); if (e) e.onchange = () => Net.send({ t: 'settings', vis: q('#rvis').value, mode: q('#rmode').value, map: q('#rmap').value }); }
  };
  const off = Net.on((m) => { if (m.t === 'toast') toast(m.msg); if (m.t === 'status' || m.t === 'welcome' || m.t === 'error') draw(); else if (['friends', 'rooms', 'room', 'room-closed'].includes(m.t)) draw(); });
  const iv = setInterval(() => { if (!document.body.contains(root)) { clearInterval(iv); off(); return; } if (Net.ok && !Net.room && tab === 'play') Net.send({ t: 'rooms' }); }, 4000);
  root._mounted = false; draw(); panel('🌐 ONLINE — ROOMS & FRIENDS', root, { onClose, wide: true }); root._mounted = true;
  if (!Net.ok && !Net.connecting) { Net.connect(Net.defaultUrl(), Save.d.name); draw(); }
}

/* ---------------- MYSTERY BOXES ---------------- */
export const PITY = 20;
export function rollAbility(slot, noCommon) {
  const pool0 = BY_SLOT(slot); const tiers = ['C', 'R', 'E', 'L'].filter(t => (!noCommon || t !== 'C') && pool0.some(a => a.r === t)); const wt = (t) => slot === 'd' ? { R: 55, E: 30, L: 15 }[t] : RARITY[t].w; const tot = tiers.reduce((a, t) => a + wt(t), 0); let r = Math.random() * tot, tier = tiers[0]; for (const t of tiers) { r -= wt(t); if (r <= 0) { tier = t; break; } }
  const pool = pool0.filter(a => a.r === tier); return pool[Math.floor(Math.random() * pool.length)];
}
export function openMystery(onClose) {
  const root = h(''); const names = { p: ['Passive Box', '#9ad0ff', '📦'], a: ['Active Box', '#ff9a7a', '🎁'], s: ['Shikigami Box', '#8aff9a', '🧧'], u: ['Ultimate Box', '#ff6a8a', '🔥'], d: ['Domain Box', '#d79bff', '🔮'] };
  const draw = () => {
    root.innerHTML = `<div class="dim">Odds are brutal on purpose. Technique boxes — Common 74% · Rare 19% · Epic 5.5% · Legendary 1.5%. Ultimate States use the same odds. <b>Domain Boxes hold a domain only ${Math.round(DOMAIN_HIT * 100)}% of the time</b> (Rare 55% · Epic 30% · Legendary 15% of those) — otherwise you get a small XP refund. Pity: every ${PITY} rolls of a box without a Rare or better (a domain, for Domain Boxes) guarantees one on the ${PITY}th. Duplicates refund XP. No real money.</div>
    <div class="boxes" style="grid-template-columns:repeat(5,1fr)">${SL.map(s => `<div class="box" data-s="${s}" style="--bc:${names[s][1]}"><span class="bi">${names[s][2]}</span><b>${names[s][0]}</b><div class="dim">${BY_SLOT(s).filter(a => Save.d.owned[a.id]).length}/${BY_SLOT(s).length} found</div><div class="dim" style="font-size:11.5px">${s === 'd' ? 'Domain' : 'Rare+'} guaranteed in ${Math.max(1, PITY - ((Save.d.pity || {})[s] || 0))} ${Math.max(1, PITY - ((Save.d.pity || {})[s] || 0)) === 1 ? 'roll' : 'rolls'}</div><div class="gold" style="margin-top:6px;font-weight:800">${BOX_COST[s]} XP</div></div>`).join('')}</div>`;
    root.querySelectorAll('.box').forEach(b => b.onclick = () => buy(b.dataset.s));
  };
  const buy = (s) => {
    const cost = BOX_COST[s]; if (Save.d.xp < cost) { sfx('lose'); const b = root.querySelector(`[data-s="${s}"]`); b.style.borderColor = '#f55'; return; }
    if (document.querySelector('.reveal')) return; const known = Object.assign({}, Save.d.owned);
    Save.d.xp -= cost; Save.d.stats.boxes++; addProgress('boxes', 1); let a = (s === 'd' && Math.random() > DOMAIN_HIT) ? null : rollAbility(s); const pt = (Save.d.pity = Save.d.pity || {}); pt[s] = (pt[s] || 0) + 1; if (pt[s] >= PITY && (!a || a.r === 'C')) a = rollAbility(s, true); if (a && a.r !== 'C') pt[s] = 0;
    const dup = a ? !!Save.d.owned[a.id] : false; let refund = a ? 0 : Math.round(cost * 0.3);
    if (a) { if (dup) { refund = RARITY[a.r].refund; Save.d.xp += refund; } else Save.d.owned[a.id] = 1; } else Save.d.xp += refund; Save.save(); setXP();
    // ---- build the reel: weighted filler cards with the real result parked at a fixed slot ----
    const PITCH = 170, W = 52, N = 66, pool = BY_SLOT(s); const card = (x) => x ? (known[x.id] ? { n: x.name, i: x.icon, c: rc(x.r), r: x.r, t: RARITY[x.r].name } : { n: '???', i: '?', c: '#3a3a44', r: '?', t: 'Undiscovered', hid: true, real: { n: x.name, i: x.icon, c: rc(x.r), r: x.r, t: RARITY[x.r].name } }) : { n: 'Cursed Residue', i: '💨', c: '#667', r: 'X', t: 'Empty' };
    const filler = () => { if (s === 'd' && Math.random() < 0.55) return card(null); return card(rollAbility(s)); };
    const cards = Array.from({ length: N }, filler); cards[W] = card(a);
    // near-miss tease: a rarer card right beside the winner
    if (!a || a.r === 'C' || a.r === 'R') { const hi = pool.filter(x => x.r === 'L' || x.r === 'E'); if (hi.length && Math.random() < 0.7) cards[W + (Math.random() < 0.5 ? 1 : -1)] = card(hi[Math.floor(Math.random() * hi.length)]); }
    const ov = document.createElement('div'); ov.className = 'reveal';
    ov.innerHTML = `<div class="rtitle">${names[s][0].toUpperCase()}</div><div class="reelbox" style="--bc:${names[s][1]}"><div class="rb">${names[s][2]}</div></div>
      <div class="reel" style="opacity:0"><div class="strip">${cards.map((k, i) => `<div class="rcard ${k.hid ? 'hid' : ''}" data-i="${i}" style="--rc:${k.c}"><i>${k.i}</i><b>${k.n}</b><span>${k.t}</span></div>`).join('')}</div><div class="mark"></div><div class="fadeL"></div><div class="fadeR"></div></div>
      <div class="res"></div><button class="btn sec skip" style="opacity:0">Skip ▸▸</button>`;
    document.body.appendChild(ov); sfx('power');
    const reel = ov.querySelector('.reel'), strip = ov.querySelector('.strip'), mark = ov.querySelector('.mark'), box = ov.querySelector('.reelbox'), skip = ov.querySelector('.skip'), els = [...strip.children];
    let finished = false, skipNow = false; skip.onclick = () => { skipNow = true; };
    const cw = () => reel.clientWidth, jit = (Math.random() - 0.5) * PITCH * 0.7, target = W * PITCH + PITCH / 2 + jit;
    const place = (pos) => { strip.style.transform = `translate3d(${(cw() / 2 - pos).toFixed(1)}px,0,0)`; };
    place(0);
    const burst = (n, col, spread, el) => { const r = (el || ov.querySelector('.rcard.win')).getBoundingClientRect(); for (let i = 0; i < n; i++) { const p = document.createElement('span'); p.className = 'pt'; const an = Math.random() * 6.283, d = (0.35 + Math.random()) * spread; p.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--rc:${col};--dx:${Math.cos(an) * d}px;--dy:${Math.sin(an) * d - spread * 0.25}px;width:${4 + Math.random() * 8}px;height:${4 + Math.random() * 8}px;animation-duration:${0.8 + Math.random() * 0.9}s`; ov.appendChild(p); setTimeout(() => p.remove(), 1800); } };
    const finish = () => {
      if (finished) return; finished = true; skip.remove(); let k = cards[W]; const win = els[W]; if (k.hid) { k = k.real; cards[W] = k; win.classList.remove('hid'); win.classList.add('flip'); win.style.setProperty('--rc', k.c); win.innerHTML = `<i>${k.i}</i><b>${k.n}</b><span>${k.t}</span>`; } place(W * PITCH + PITCH / 2); win.classList.add('win'); els.forEach((e, i) => { if (i !== W) e.classList.add('dim'); }); mark.style.setProperty('--mc', k.c);
      const big = a && a.r === 'L', epic = a && a.r === 'E', rare = a && a.r === 'R';
      const fl = document.createElement('div'); fl.className = 'flash'; fl.style.setProperty('--rc', k.c); ov.appendChild(fl); setTimeout(() => fl.remove(), 900);
      if (big || epic) { ov.classList.add('quake'); setTimeout(() => ov.classList.remove('quake'), 700); const ry = document.createElement('div'); ry.className = 'rays'; ry.style.setProperty('--rc', k.c); ov.insertBefore(ry, ov.firstChild); }
      sfx(big ? 'legend' : epic ? 'crit' : rare ? 'reveal' : a ? 'open' : 'lose'); if (big) { setTimeout(() => sfx('boom'), 120); setTimeout(() => sfx('holy'), 350); } else if (epic) setTimeout(() => sfx('power'), 150);
      burst(big ? 90 : epic ? 56 : rare ? 28 : a ? 10 : 6, k.c, big ? 520 : epic ? 380 : 240, win);
      const show = () => { const res = ov.querySelector('.res'); res.innerHTML = a ? `<div class="rc" style="--rc:${k.c}"><div class="rr" style="color:${k.c};font-weight:900;letter-spacing:3px">${RARITY[a.r].name.toUpperCase()}</div><div class="ic">${a.icon}</div><h2>${a.name}</h2><div class="dim" style="font-size:13px">${a.desc}</div>${dup ? `<div class="gold" style="margin-top:10px;font-weight:800">Duplicate! +${refund} XP refunded</div>` : `<div style="margin-top:10px;font-weight:800;color:#6bff9a">NEW TECHNIQUE!</div>`}</div><button class="btn go">Continue</button>` : `<div class="rc" style="--rc:#667"><div class="rr" style="color:#99a;font-weight:900;letter-spacing:3px">EMPTY</div><div class="ic">💨</div><h2>Only cursed residue</h2><div class="dim" style="font-size:13px">The box held no domain this time.</div><div class="gold" style="margin-top:10px;font-weight:800">+${refund} XP refunded</div></div><button class="btn go">Continue</button>`; ov.classList.add('done'); ov.querySelector('.go').onclick = () => { ov.remove(); draw(); const x = $('#layer .ph .xp'); if (x) x.textContent = Save.d.xp + ' XP'; }; if (big) burst(60, '#fff2b0', 600, ov.querySelector('.rc')); };
      setTimeout(show, big ? 1500 : 1000);
    };
    // phase 1: the box rattles and cracks open
    box.classList.add('shake'); let t0 = 0, lastIdx = -1, lastTick = 0;
    setTimeout(() => { sfx('whoosh'); box.classList.remove('shake'); box.classList.add('pop'); reel.style.opacity = 1; reel.classList.add('in'); skip.style.opacity = 1; t0 = performance.now(); requestAnimationFrame(loop); }, 1000);
    const DUR = 6800, ease = (u) => 1 - Math.pow(1 - u, 4.2);
    const loop = (now) => {
      if (finished) return; let u = Math.min(1, (now - t0) / DUR); if (skipNow) u = 1; const pos = target * ease(u); place(pos);
      const idx = Math.max(0, Math.min(N - 1, Math.floor(pos / PITCH))); if (idx !== lastIdx) { if (els[lastIdx]) els[lastIdx].classList.remove('hot'); els[idx].classList.add('hot'); mark.style.setProperty('--mc', cards[idx].c); lastIdx = idx; if (now - lastTick > 28 && !skipNow) { lastTick = now; sfx('tick'); } }
      if (u >= 1) { finish(); return; } requestAnimationFrame(loop);
    };
  };
  draw(); panel('🎁 MYSTERY BOX STATION', root, { onClose });
}

/* ---------------- MISSIONS ---------------- */
export function openMissions(onClose) {
  const root = h(''); const draw = () => {
    const M = missions(), m = Save.d.mission; const rows = (list, prog, label) => list.map(q => { const v = Math.min(q.target, prog[q.stat] || 0), done = v >= q.target, cl = m.claimed[q.id]; return `<div class="mi"><div style="flex:1"><b>${q.text}</b><div class="dim" style="font-size:12px">${label}</div></div><div class="bar"><i style="width:${v / q.target * 100}%"></i></div><span>${v}/${q.target}</span><button class="btn sm ${done && !cl ? 'gold' : 'dis'}" data-q="${q.id}">${cl ? 'Claimed' : '+' + q.xp + ' XP'}</button></div>`; }).join('');
    root.innerHTML = `<h3>Daily Missions</h3>${rows(M.daily, m.prog.d, 'Resets daily')}<h3 style="margin-top:6px">Weekly Missions</h3>${rows(M.weekly, m.wprog, 'Resets weekly')}`;
    root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const q = [...M.daily, ...M.weekly].find(x => x.id === b.dataset.q); const prog = q.weekly ? m.wprog : m.prog.d; if ((prog[q.stat] || 0) >= q.target && !m.claimed[q.id]) { m.claimed[q.id] = 1; Save.d.xp += q.xp; Save.save(); setXP(); sfx('win'); draw(); const x = $('#layer .ph .xp'); if (x) x.textContent = Save.d.xp + ' XP'; } });
  }; draw(); panel('📜 MISSION BOARD', root, { onClose });
}

/* ---------------- ARCHIVIST ---------------- */
export function openArchive(onClose) {
  const s = Save.d.stats, r = rankInfo(); const root = h(`
  <div class="row" style="gap:30px"><div style="font-size:90px;font-weight:900;color:#ffd98a;line-height:1;text-shadow:0 0 30px #ffb43c">${r.grade}</div><div><b style="font-size:20px">${Save.d.name}</b><div class="dim">Ranked grade · ${r.pts} points${r.next ? ' · next grade at ' + r.next : ' · top grade!'}</div></div></div>
  <div class="stat"><div><b>${s.wins}</b>Wins</div><div><b>${s.losses}</b>Losses</div><div><b>${s.kos}</b>KOs</div><div><b>${s.matches}</b>Matches</div><div><b>${Math.round(s.dmg)}</b>Damage</div><div><b>${s.crits}</b>Overdrives</div></div>
  ${(() => { const bt = Math.max(0, Math.min(17, Math.floor(((Save.d.best || Save.d.elo) - 800) / 120))); const fav = Object.entries(Save.d.mast || {}).filter(([k]) => A[k]).sort((a, b) => b[1] - a[1]).slice(0, 3); const tt = titleText(); return `<div class="dim">Highest grade achieved: <b style="color:#ffd98a">${TIERS[Math.floor(bt / 3)]} ${DIVS[bt % 3]}</b>${tt ? ' · Title: <b>' + tt + '</b>' : ''}</div><div class="dim" style="margin-bottom:6px">Favorite abilities: ${fav.length ? fav.map(([k]) => A[k].icon + ' ' + A[k].name + ' (Lv ' + masteryLv(k) + ')').join(' · ') : 'none yet'}</div>`; })()}
  <h3>Recent matches</h3>${Save.d.history.length ? Save.d.history.slice(-8).reverse().map(x => `<div class="mi"><b style="color:${x.draw ? '#ccc' : x.won ? '#6bff9a' : '#ff6b6b'}">${x.draw ? 'DRAW' : x.won ? 'WIN' : 'LOSS'}</b><span class="sp">${x.mode.toUpperCase()} · ${MAPS[x.map] ? MAPS[x.map].name : x.map}</span><span>${x.kos} KOs</span><span class="gold">+${x.xp} XP</span></div>`).join('') : '<div class="dim">No matches yet.</div>'}
  <div class="dim" style="font-size:13px">These are your personal stats on this device. Online leaderboards will come when multiplayer is added.</div>`); panel('🦉 ARCHIVIST — STATS & RANK', root, { onClose });
}

/* ---------------- MATCHMAKING ---------------- */
export function openMatch(onStart, onClose, startTab) {
  let mode = '1v1', map = 'random', diff = 'normal', ranked = false, tab = startTab || 'ai', qmMode = '1v1', qmMap = 'random', qmBusy = false; const root = h('');
  const mapChips = (cur, attr) => ['random', 'forest', 'bamboo', 'snow', 'station', 'city', 'shrine'].map(k => `<div class="map ${cur === k ? 'on' : ''}" ${attr}="${k}"><b>${k === 'random' ? '🎲 Random' : MAPS[k].name}</b><span class="dim">${k === 'random' ? 'Surprise me' : MAPS[k].desc}</span></div>`).join('');
  const inp = 'style="background:#0e0c18;border:1px solid #4a3f6a;color:#fff;padding:8px;border-radius:6px;font:600 14px system-ui"';
  const profile = () => ({ app: Save.d.app, equipped: Save.d.equipped });
  const goRoom = () => { closePanels(); openOnline(onClose); };
  const need = { '1v1': 2, '2v2': 4, ffa: 3 };
  let qmRanked = false, qmTimer = null;
  const roomElo = (g) => { const m = /^RANKED (\d+)/.exec(g.name || ''); return m ? +m[1] : null; };
  const stopQ = () => { clearInterval(qmTimer); qmTimer = null; };
  const quick = () => {
    if (!Net.ok) return; Net.qmHost = false; qmBusy = true; const ranked = qmRanked && qmMode === '1v1', myElo = Save.d.elo || 1000, t0 = Date.now(); Net.qm = { mode: qmMode, ranked, t0 }; drawMP(); Net.send({ t: 'rooms' });
    const mine = () => ranked ? { t: 'create', name: 'RANKED ' + myElo, vis: 'public', mode: '1v1', map: qmMap, profile: profile() } : { t: 'create', name: 'Quick Match', vis: 'public', mode: qmMode, map: qmMap, profile: profile() };
    stopQ(); let tries = 0;
    qmTimer = setInterval(() => {
      if (Net.room || !qmBusy) { stopQ(); return; } tries++; const win = 150 + Math.floor((Date.now() - t0) / 6000) * 150; // rating window widens the longer you wait
      const list = (Net.rooms || []).filter(r => r.mode === qmMode && r.n < r.max); let g;
      if (ranked) g = list.map(r => ({ r, e: roomElo(r) })).filter(x => x.e != null && Math.abs(x.e - myElo) <= win).sort((a, b2) => Math.abs(a.e - myElo) - Math.abs(b2.e - myElo))[0]; else g = list.find(r => roomElo(r) == null && (qmMap === 'random' || r.map === qmMap)) || list.find(r => roomElo(r) == null);
      if (g) { stopQ(); Net.send({ t: 'join', code: (g.r || g).code, profile: profile() }); return; }
      if (tries === 3 && !Net.qmHost) { Net.qmHost = true; Net.send(mine()); } else Net.send({ t: 'rooms' });
    }, 1500);
  };
  const tabsHtml = () => `<div class="modes"><div class="tab ${tab === 'ai' ? 'on' : ''}" data-top="ai">🤖 VS AI</div><div class="tab ${tab === 'mp' ? 'on' : ''}" data-top="mp">🌐 MULTIPLAYER</div></div>`;
  const wireTabs = () => root.querySelectorAll('[data-top]').forEach(e => e.onclick = () => { tab = e.dataset.top; sfx('click'); if (tab === 'mp' && !Net.ok && !Net.connecting) Net.connect(Net.defaultUrl(), Save.d.name); draw(); });
  const drawMP = () => {
    if (Net.room && !Net.qmHost && !qmBusy) { }
    const keep = {}; root.querySelectorAll('input').forEach(e => { if (e.id) keep[e.id] = e.value; });
    if (!Net.ok) {
      root.innerHTML = tabsHtml() + `<div style="max-width:560px;margin-top:10px"><h3>🌐 Multiplayer</h3><p class="dim">${Net.connecting ? 'Connecting to the game server…' : 'Not connected to a JJKLASH server.'}</p>
      <div class="row" style="gap:8px;margin:10px 0"><input id="srv" ${inp} style="flex:1" value="${esc(keep.srv || Net.defaultUrl())}"><button class="btn" id="conn">${Net.connecting ? 'Connecting…' : 'Connect'}</button></div>${Net.error ? `<div style="color:#ff8a8a;font-weight:700">${esc(Net.error)}</div>` : ''}
      <p class="dim">If you opened the game from your hosted link (for example your Render page) this connects automatically.</p></div>`;
      wireTabs(); const c = root.querySelector('#conn'); c.onclick = () => { Net.connect(root.querySelector('#srv').value.trim(), Save.d.name); drawMP(); }; return;
    }
    const pubs = Net.rooms || [], me = Net.me;
    const html = tabsHtml() + `<div class="dim" style="margin:8px 0">Signed in as <b>${esc(me.name)}</b> · friend code <b style="color:#9ad0ff;letter-spacing:2px">${me.code}</b></div>
    <div class="row" style="gap:20px;align-items:flex-start;flex-wrap:wrap">
      <div style="flex:1;min-width:320px"><h3 style="margin:0 0 6px">⚡ Quick Match</h3><div class="dim" style="margin-bottom:6px">Jump into an open public game or start one that others can fill.</div>
        <div class="modes">${['1v1', '2v2', 'ffa'].map(k => `<div class="tab ${qmMode === k ? 'on' : ''}" data-qm="${k}">${k === 'ffa' ? 'FFA' : k.replace('v', ' v ')}</div>`).join('')}</div>
        ${qmMode === '1v1' ? `<div class="row" style="margin:6px 0"><div class="ch ${qmRanked ? '' : 'on'}" data-qr="0">Casual</div><div class="ch ${qmRanked ? 'on' : ''}" data-qr="1">Ranked</div><span class="dim" style="font-size:12.5px">${qmRanked ? 'Matched to players near your rating (' + (Save.d.elo || 1000) + '). Rating changes.' : 'Anyone, no rating change.'}</span></div>` : ''}<div class="maps" style="grid-template-columns:repeat(2,1fr)">${mapChips(qmMap, 'data-qk')}</div>
        <div style="margin-top:10px">${qmBusy ? `<button class="btn sec" id="qcancel">✕ Cancel search</button> <span class="dim">Searching for a player near your rating… the range widens the longer you wait. The match starts automatically.</span>` : '<button class="btn" id="qgo">⚡ FIND MATCH</button>'}</div>
        <h3 style="margin:20px 0 6px">🔑 Join with a code</h3><div class="row" style="gap:8px"><input id="jcode" ${inp} maxlength="5" placeholder="ABCDE" style="text-transform:uppercase;letter-spacing:4px;width:140px"><button class="btn" id="jgo">Join</button></div>
        <div class="row" style="gap:8px;margin-top:16px"><button class="btn sec" id="mkroom">🏠 Create custom room</button><button class="btn sec" id="friends">👥 Friends</button></div></div>
      <div style="flex:1.1;min-width:320px"><div class="row" style="justify-content:space-between"><h3 style="margin:0 0 8px">🌐 Public games (${pubs.length})</h3><button class="btn sec sm" id="prefresh">Refresh</button></div>
        ${pubs.map(g => `<div class="row" style="justify-content:space-between;padding:8px 10px;background:#15122a;border-radius:6px;margin-bottom:5px"><span><b>${esc(g.name)}</b><br><span class="dim">${g.mode === 'ffa' ? 'FFA' : g.mode} · ${g.map === 'random' ? 'random map' : (MAPS[g.map] ? MAPS[g.map].name : g.map)} · host ${esc(g.host || '?')}</span></span><span><span class="dim">${g.n}/${g.max}</span> <button class="btn sm" data-join="${g.code}">Join</button></span></div>`).join('') || '<div class="dim">No public games right now — hit Find Match to start one.</div>'}</div></div>`;
    if (root._last === html && !qmBusy !== undefined && root._lastQ === qmBusy + qmMode + qmMap) return; root._last = html; root._lastQ = qmBusy + qmMode + qmMap; root.innerHTML = html;
    for (const k in keep) { const e = root.querySelector('#' + k); if (e) e.value = keep[k]; }
    wireTabs(); const q = (x) => root.querySelector(x);
    root.querySelectorAll('[data-qm]').forEach(e => e.onclick = () => { qmMode = e.dataset.qm; sfx('click'); drawMP(); }); root.querySelectorAll('[data-qr]').forEach(e => e.onclick = () => { qmRanked = e.dataset.qr === '1'; sfx('click'); drawMP(); }); root.querySelectorAll('[data-qk]').forEach(e => e.onclick = () => { qmMap = e.dataset.qk; sfx('click'); drawMP(); });
    root.querySelectorAll('[data-join]').forEach(e => e.onclick = () => Net.send({ t: 'join', code: e.dataset.join, profile: profile() }));
    const on = (x, fn) => { const e = q(x); if (e) e.onclick = fn; };
    on('#qgo', () => { sfx('tick'); quick(); }); on('#qcancel', () => { stopQ(); qmBusy = false; Net.qm = null; Net.qmHost = false; if (Net.room) Net.send({ t: 'leave' }); drawMP(); });
    on('#jgo', () => Net.send({ t: 'join', code: q('#jcode').value.trim(), profile: profile() })); on('#prefresh', () => Net.send({ t: 'rooms' })); on('#mkroom', goRoom); on('#friends', () => { closePanels(); openOnline(onClose); });
  };
  const draw = () => {
    if (tab === 'mp') { drawMP(); return; }
    root.innerHTML = tabsHtml() + `<div class="modes" style="margin-top:8px">${[['1v1', '1 v 1'], ['2v2', '2 v 2'], ['ffa', 'Free For All']].map(([k, n]) => `<div class="tab ${mode === k ? 'on' : ''}" data-m="${k}">${n}</div>`).join('')}</div>
    <div class="dim">${{ '1v1': 'Duel a single opponent. 2:30 limit.', '2v2': 'You and an AI partner vs two opponents.', ffa: 'Five fighters, last sorcerer standing. 3:00 limit.' }[mode]}</div>
    <div class="maps">${mapChips(map, 'data-k')}</div>
    ${mode === '1v1' ? `<div class="row"><b>Match type</b><div class="ch ${ranked ? '' : 'on'}" data-rk="0">Casual</div><div class="ch ${ranked ? 'on' : ''}" data-rk="1">Ranked</div><span class="dim" style="font-size:12.5px">${ranked ? 'Ranked: stats normalized, every equipped ability counts as Mastery Lv 10, rating changes.' : 'Casual: your stat upgrades and mastery apply. No rating change.'}</span></div>` : ''}
    ${Save.d.stats.matches < 8 ? `<div class="dim" style="font-size:12.5px">🛡 Beginner protection: opponents are matched to your experience for your first ${8 - Save.d.stats.matches} matches.</div>` : ''}
    <div class="row">${ranked && mode === '1v1' ? `<b>Opponent</b><span class="dim">Matched to your rating (${Save.d.elo || 1000}) — an AI of similar strength. Win to climb, lose and you drop.</span>` : `<b>Opponent skill</b>${['easy', 'normal', 'hard'].map(k => `<div class="ch ${diff === k ? 'on' : ''}" data-d="${k}">${k[0].toUpperCase() + k.slice(1)}</div>`).join('')}`}<span class="sp"></span><button class="btn" id="go">⚔ ENTER MATCHMAKING</button></div>
    <div class="dim" style="font-size:12.5px">Fights AI sorcerers with random builds. Want real players? Open the Multiplayer tab.</div>`;
    wireTabs(); root.querySelectorAll('[data-rk]').forEach(e => e.onclick = () => { ranked = e.dataset.rk === '1'; sfx('click'); draw(); }); root.querySelectorAll('[data-m]').forEach(e => e.onclick = () => { mode = e.dataset.m; if (mode !== '1v1') ranked = false; sfx('click'); draw(); }); root.querySelectorAll('[data-k]').forEach(e => e.onclick = () => { map = e.dataset.k; sfx('click'); draw(); }); root.querySelectorAll('[data-d]').forEach(e => e.onclick = () => { diff = e.dataset.d; sfx('click'); draw(); });
    root.querySelector('#go').onclick = () => { root.innerHTML = '<div style="text-align:center;padding:60px;font-size:22px;font-weight:800">Searching for opponents<span id="dots">...</span></div>'; sfx('tick'); setTimeout(() => { closePanels(); { const rk = ranked && mode === '1v1', oe = rk ? rankedOpp() : 0; onStart({ mode, map: map === 'random' ? ['forest', 'bamboo', 'snow', 'station', 'city'][Math.floor(Math.random() * 5)] : map, skill: rk ? skillFromElo(oe) : { easy: 0.3, normal: 0.6, hard: 0.9 }[diff], ranked: rk, oppElo: oe }); } }, 1100); };
  };
  // react to server events while this panel is open
  let startTimer = null;
  const off = Net.on((m) => {
    if (!document.body.contains(root)) { if (root._mounted) { off(); } return; }
    if (m.t === 'toast') toast(m.msg);
    if (m.t === 'room' && m.room && qmBusy) {
      const r = m.room, host = Net.me && r.host === Net.me.pid, full = r.members.length >= r.max, enough = r.members.length >= need[r.mode];
      if (!host) { qmBusy = false; Net.qm = null; closePanels(); openOnline(onClose); return; }
      clearTimeout(startTimer); if (full || (r.mode === 'ffa' && enough)) { toast('Opponents found — starting…'); startTimer = setTimeout(() => { Net.send({ t: 'profile', profile: profile() }); Net.send({ t: 'start' }); }, full ? 2500 : 9000); }
    }
    if (m.t === 'room' && m.room && !qmBusy && tab === 'mp') { closePanels(); openOnline(onClose); return; }
    if (['status', 'welcome', 'error', 'rooms'].includes(m.t) && tab === 'mp' && !(Net.room)) drawMP();
  });
  const iv = setInterval(() => { if (!document.body.contains(root)) { if (root._mounted) { clearInterval(iv); off(); } return; } if (tab === 'mp' && Net.ok && !Net.room && !qmBusy) Net.send({ t: 'rooms' }); }, 4000);
  draw(); panel('⚔ MATCHMAKING', root, { onClose: () => { clearTimeout(startTimer); stopQ(); onClose && onClose(); } }); root._mounted = true;
  if (tab === 'mp' && !Net.ok && !Net.connecting) { Net.connect(Net.defaultUrl(), Save.d.name); drawMP(); }
}



/* ---------------- ACCOUNTS / CLOUD SAVE / LEADERBOARDS ---------------- */
const saveSummary = () => { const d = Save.d, s = d.stats; return { name: d.name, elo: d.elo, wins: s.wins, kos: s.kos, owned: Object.keys(d.owned || {}).length, mast: Object.values(d.mast || {}).reduce((a, b) => a + (+b || 0), 0) }; };
let _pt = null, _syncState = '';
export async function cloudPush() { if (!Acct.d) return false; try { await Acct.call('/api/save', { token: Acct.d.token, save: Save.d, summary: saveSummary() }); _syncState = 'Synced ' + new Date().toLocaleTimeString(); return true; } catch (e) { _syncState = 'Sync failed: ' + e.message; if (/expired/i.test(e.message)) Acct.set(null); return false; } }
function schedulePush() { clearTimeout(_pt); _pt = setTimeout(cloudPush, 4000); }
const progressOf = (sv) => { const s = (sv && sv.stats) || {}; return `${s.matches || 0} matches · ${s.wins || 0} wins · ${Object.keys((sv && sv.owned) || {}).length} techniques · rating ${(sv && sv.elo) || 1000}`; };
export function openAccount(onClose) {
  const root = h(''); let msg = '', busy = false, tab = 'login', choice = null;
  const inp = 'style="background:#0e0c18;border:1px solid #4a3f6a;color:#fff;padding:9px;border-radius:6px;font:600 14px system-ui;width:100%;box-sizing:border-box"';
  const draw = () => {
    if (choice) { root.innerHTML = `<div style="max-width:560px"><h3>Which save do you want to keep?</h3><p class="dim">This account already has a cloud save, and this device has progress too.</p>
      <div class="row" style="gap:12px;align-items:stretch;flex-wrap:wrap"><div style="flex:1;min-width:220px;background:#15122a;border-radius:10px;padding:12px"><b>☁ Cloud save</b><div class="dim" style="margin:6px 0 10px">${esc(progressOf(choice.cloud))}</div><button class="btn" id="usecloud">Use cloud save</button></div>
      <div style="flex:1;min-width:220px;background:#15122a;border-radius:10px;padding:12px"><b>💻 This device</b><div class="dim" style="margin:6px 0 10px">${esc(progressOf(Save.d))}</div><button class="btn sec" id="uselocal">Keep this device (overwrites cloud)</button></div></div></div>`;
      root.querySelector('#usecloud').onclick = () => { Save.import(choice.cloud); toast('Cloud save loaded'); setTimeout(() => location.reload(), 500); };
      root.querySelector('#uselocal').onclick = async () => { await cloudPush(); choice = null; toast('Cloud save updated'); draw(); }; return; }
    if (Acct.d) { root.innerHTML = `<div style="max-width:520px"><h3>👤 ${esc(Acct.d.username)}</h3><p class="dim">Your progress saves to the cloud automatically after matches and purchases, so you can play on any device. You are on the leaderboards as <b>${esc(Save.d.name)}</b>.</p>
      <div class="dim" id="ss">${esc(_syncState || 'Cloud save active')}</div><div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn" id="sync">⟳ Sync now</button><button class="btn sec" id="lb">🏆 Leaderboards</button><button class="btn sec" id="out">Log out</button></div>
      <div style="margin-top:22px"><a href="#" id="del" style="color:#a99;font-size:12px">Remove my account from leaderboards and cloud</a></div><div style="color:#ff8a8a;margin-top:8px">${esc(msg)}</div></div>`;
      const q = (x) => root.querySelector(x);
      q('#sync').onclick = async () => { q('#ss').textContent = 'Syncing…'; await cloudPush(); q('#ss').textContent = _syncState; };
      q('#lb').onclick = () => { closePanels(); openLeaderboard(onClose); };
      q('#out').onclick = async () => { try { await Acct.call('/api/logout', { token: Acct.d.token }); } catch (e) { } Acct.set(null); Net.disconnect(); try { localStorage.removeItem('hexclash_net'); } catch (e) { } toast('Logged out'); draw(); };
      q('#del').onclick = async (e) => { e.preventDefault(); if (!confirm('Remove your account, cloud save and leaderboard entry? Your local progress on this device stays.')) return; try { await Acct.call('/api/delete', { token: Acct.d.token }); Acct.set(null); msg = ''; toast('Account removed'); draw(); } catch (er) { msg = er.message; draw(); } }; return; }
    root.innerHTML = `<div style="max-width:420px"><div class="modes"><div class="tab ${tab === 'login' ? 'on' : ''}" data-t="login">Log in</div><div class="tab ${tab === 'reg' ? 'on' : ''}" data-t="reg">Create account</div></div>
      <p class="dim" style="margin:10px 0">${tab === 'reg' ? 'Save your progress to the cloud, play on any device and appear on the leaderboards. Your current progress and friends are kept.' : 'Log in to load your cloud save.'}</p>
      <div class="dim">Username</div><input id="un" ${inp} maxlength="16" autocomplete="username" placeholder="3-16 letters, numbers, _"><div class="dim" style="margin-top:8px">Password</div><input id="pw" type="password" ${inp} maxlength="64" autocomplete="${tab === 'reg' ? 'new-password' : 'current-password'}" placeholder="at least 6 characters">
      <div style="margin-top:14px"><button class="btn" id="go" ${busy ? 'disabled' : ''}>${busy ? 'Please wait…' : tab === 'reg' ? 'Create account' : 'Log in'}</button></div><div style="color:#ff8a8a;margin-top:10px;font-weight:700">${esc(msg)}</div>
      <p class="dim" style="font-size:12px;margin-top:14px">Passwords are stored hashed on the game server. Don't reuse a password from another site.</p></div>`;
    root.querySelectorAll('[data-t]').forEach(e => e.onclick = () => { tab = e.dataset.t; msg = ''; draw(); });
    const go = async () => {
      const un = root.querySelector('#un').value.trim(), pw = root.querySelector('#pw').value; if (!un || !pw) { msg = 'Enter a username and password'; draw(); return; } busy = true; msg = ''; draw();
      try {
        const cr = Acct.creds(); const r = await Acct.call(tab === 'reg' ? '/api/register' : '/api/login', tab === 'reg' ? { username: un, password: pw, name: Save.d.name, pid: cr.pid, secret: cr.secret } : { username: un, password: pw });
        Acct.set({ token: r.token, username: r.username, pid: r.pid }); Acct.setCreds(r.pid, r.secret); Net.disconnect(); busy = false;
        const localHas = Save.d.stats.matches > 0 || Save.d.created;
        if (r.save && localHas && JSON.stringify(r.save).length > 50) { choice = { cloud: r.save }; draw(); return; }
        if (r.save) { Save.import(r.save); toast('Welcome back, ' + r.username + '!'); setTimeout(() => location.reload(), 500); return; }
        await cloudPush(); toast(tab === 'reg' ? 'Account created, progress saved to the cloud' : 'Logged in'); draw();
      } catch (e) { busy = false; msg = e.message; draw(); }
    };
    root.querySelector('#go').onclick = go; root.querySelectorAll('input').forEach(i => i.onkeydown = (e) => { if (e.key === 'Enter') go(); e.stopPropagation(); });
  };
  draw(); panel('👤 ACCOUNT', root, { onClose });
}
export function openLeaderboard(onClose, board) {
  const root = h(''); let b = board || 'elo', data = null, err = '';
  const NAMES = { elo: 'Rating', wins: 'Wins', kos: 'Knockouts', owned: 'Techniques', mast: 'Mastery' };
  const draw = () => {
    root.innerHTML = `<div class="modes">${Object.keys(NAMES).map(k => `<div class="tab ${b === k ? 'on' : ''}" data-b="${k}">${NAMES[k]}</div>`).join('')}</div>
      <div style="margin-top:10px;max-width:640px">${err ? `<div style="color:#ff8a8a;font-weight:700">${esc(err)}</div>` : !data ? '<div class="dim">Loading…</div>' : `${Acct.d ? (data.you ? `<div style="margin-bottom:8px">Your rank: <b style="color:#ffd98a">#${data.you.rank}</b> of ${data.total} · ${NAMES[b]} <b>${data.you.value}</b></div>` : '<div class="dim" style="margin-bottom:8px">Play a match or press Sync in Account to appear here.</div>') : '<div style="margin-bottom:8px">🔒 <a href="#" id="mk" style="color:#9ad0ff">Create an account</a> to save your progress and join the leaderboards.</div>'}
      <div class="res">${data.top.map(r => `<div class="rr2 ${r.you ? 'me' : ''}" style="grid-template-columns:44px 1fr 90px"><span>#${r.rank}</span><span>${esc(r.name)}</span><span style="text-align:right"><b>${r.value}</b></span></div>`).join('') || '<div class="dim">No one on the board yet. Be the first!</div>'}</div>`}</div>`;
    root.querySelectorAll('[data-b]').forEach(e => e.onclick = () => { b = e.dataset.b; data = null; err = ''; draw(); load(); });
    const mk = root.querySelector('#mk'); if (mk) mk.onclick = (e) => { e.preventDefault(); closePanels(); openAccount(onClose); };
  };
  const load = async () => { try { data = await Acct.call('/api/leaderboard?b=' + b + (Acct.d ? '&token=' + Acct.d.token : '')); err = ''; } catch (e) { err = e.message; } if (document.body.contains(root)) draw(); };
  draw(); panel('🏆 LEADERBOARDS', root, { onClose }); load();
}

/* ---------------- CONTROLS (rebinding) ---------------- */
export const KEYDEF = [
  ['fwd', 'Move forward', 'KeyW'], ['back', 'Move back', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'], ['jump', 'Jump', 'Space'], ['dash', 'Dash', 'KeyQ'], ['sprint', 'Dash (alt key)', 'ShiftLeft'], ['block', 'Block', 'KeyF'], ['heavy', 'Heavy attack (also RMB)', 'KeyR'],
  ['s1', 'Active / Move 1', 'Digit1'], ['s2', 'Passive / Move 2', 'Digit2'], ['s3', 'Shikigami / Move 3', 'Digit3'], ['s4', 'Ultimate (Awakening) / Move 4', 'Digit4'], ['s5', 'Domain', 'Digit5'], ['simple', 'Simple Domain', 'KeyC'],
  ['lock', 'Target lock (also MMB)', 'KeyV'], ['switch', 'Switch target / Interact', 'KeyE'], ['emote', 'Emote', 'KeyB'], ['shiftlock', 'Shift-lock camera', 'KeyZ'], ['score', 'Scoreboard', 'Tab']];
export function keyOf(id) { const c = (Save.d.settings.keys || {})[id]; return c || KEYDEF.find(k => k[0] === id)[2]; }
export function keymap() { const k = keyOf; return { move: [k('fwd'), k('back'), k('left'), k('right')], jump: k('jump'), dash: k('dash'), sprint: k('sprint'), block: k('block'), heavy: k('heavy'), slots: ['s1', 's2', 's3', 's4', 's5'].map(k), simple: k('simple'), lock: k('lock'), switch: k('switch'), emote: k('emote'), shiftlock: k('shiftlock'), score: k('score') }; }
const keyName = (c) => c.replace('Key', '').replace('Digit', '').replace('Arrow', '↑↓←→'.includes('x') ? '' : '').replace('ShiftLeft', 'L-Shift').replace('ShiftRight', 'R-Shift').replace('ControlLeft', 'L-Ctrl').replace('Space', 'Space').replace('Backquote', '`');
export function openControls(onClose) {
  const root = h(''); let listening = null;
  const draw = () => {
    const used = {}; KEYDEF.forEach(([id]) => { const c = keyOf(id); (used[c] = used[c] || []).push(id); });
    root.innerHTML = `<div class="dim" style="margin-bottom:8px">Click an action, then press the new key. Duplicates are flagged in red. Changes apply from your next match. Mouse: LMB light · RMB heavy · MMB lock-on.</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 18px">${KEYDEF.map(([id, nm]) => { const c = keyOf(id), dup = used[c].length > 1; return `<div class="row" style="justify-content:space-between;gap:10px"><span>${nm}</span><button class="btn sm ${listening === id ? '' : 'sec'}" data-kb="${id}" style="min-width:90px;${dup ? 'border-color:#ff5a5a;color:#ff8a8a' : ''}">${listening === id ? 'Press a key…' : keyName(c)}</button></div>${dup ? '' : ''}`; }).join('')}</div>
    ${Object.values(used).some(a => a.length > 1) ? '<div style="color:#ff8a8a;margin-top:8px">⚠ Some actions share a key. They will fire together.</div>' : ''}
    <div class="dim" style="margin-top:10px">🎮 Controller (PS5 DualSense): Left stick move · Right stick camera · ✕ jump · ○ dash · L1 block · R2 light · R1 heavy · △ active · □ passive · D-pad ↑ shikigami · D-pad ↓ ultimate · D-pad → domain · R3 lock-on · L3 sprint · Options menu.</div>
    <div class="row" style="margin-top:10px"><button class="btn sec" id="kdef">Restore defaults</button></div>`;
    root.querySelectorAll('[data-kb]').forEach(b => b.onclick = () => { listening = b.dataset.kb; draw(); });
    root.querySelector('#kdef').onclick = () => { Save.d.settings.keys = {}; Save.save(); listening = null; draw(); sfx('click'); };
  };
  const onKey = (e) => { if (!listening) return; e.preventDefault(); e.stopPropagation(); if (e.code === 'Escape') { listening = null; draw(); return; } Save.d.settings.keys = Save.d.settings.keys || {}; Save.d.settings.keys[listening] = e.code; Save.save(); listening = null; draw(); sfx('click'); };
  window.addEventListener('keydown', onKey, true); draw(); panel('⌨ CONTROLS', root, { onClose: () => { window.removeEventListener('keydown', onKey, true); onClose && onClose(); } });
}
/* ---------------- SETTINGS / PAUSE ---------------- */
export function settingsHtml() { const st = Save.d.settings; return `<div class="row"><b>Graphics</b>${['high', 'med', 'low'].map(q => `<div class="ch ${st.quality === q ? 'on' : ''}" data-q="${q}">${q.toUpperCase()}</div>`).join('')}<b style="margin-left:14px">Sound</b><div class="ch ${st.muted ? '' : 'on'}" data-mute="1">${st.muted ? 'OFF' : 'ON'}</div><b style="margin-left:14px">Voices</b><div class="ch ${st.voices ? 'on' : ''}" data-voice="1">${st.voices ? 'ON' : 'OFF'}</div><b style="margin-left:14px">Keys</b><div class="ch" data-ctl="1">⌨ Controls</div></div>
<div class="row"><span>Master <input type="range" min="0" max="1" step=".05" value="${st.master}" data-vol="master"></span><span>Music <input type="range" min="0" max="1" step=".05" value="${st.music}" data-vol="music"></span><span>SFX <input type="range" min="0" max="1" step=".05" value="${st.sfx}" data-vol="sfx"></span></div>`; }
export function applyVolumes() { const st = Save.d.settings; setVolumes(st.master, st.music, st.sfx); window.__voices = st.voices; }
export function bindSettings(root, eng) {
  root.querySelectorAll('[data-q]').forEach(e => e.onclick = () => { Save.d.settings.quality = e.dataset.q; Save.save(); eng.setQuality(e.dataset.q); root.querySelectorAll('[data-q]').forEach(x => x.classList.toggle('on', x === e)); });
  root.querySelectorAll('[data-vol]').forEach(r => r.oninput = () => { Save.d.settings[r.dataset.vol] = +r.value; Save.save(); applyVolumes(); });
  const ct = root.querySelector('[data-ctl]'); if (ct) ct.onclick = () => openControls();
  const vo = root.querySelector('[data-voice]'); if (vo) vo.onclick = () => { Save.d.settings.voices = !Save.d.settings.voices; window.__voices = Save.d.settings.voices; Save.save(); vo.textContent = Save.d.settings.voices ? 'ON' : 'OFF'; vo.classList.toggle('on', Save.d.settings.voices); };
  const m = root.querySelector('[data-mute]'); if (m) m.onclick = () => { Save.d.settings.muted = !Save.d.settings.muted; Save.save(); setMuted(Save.d.settings.muted); m.textContent = Save.d.settings.muted ? 'OFF' : 'ON'; m.classList.toggle('on', !Save.d.settings.muted); };
}

/* ---------------- CHARACTER CREATOR / WARDROBE ---------------- */
export function openCreator({ first, onChange, onDone, onBack }) {
  const app = Save.d.app; let tab = 'body'; const root = document.createElement('div'); root.className = 'panel cpan'; root.style.animation = 'none';
  const owns = (k, i) => Save.d.cos[k].includes(i);
  const tabs = first ? ['body', 'hair', 'outfit'] : ['body', 'hair', 'outfit', 'extras'];
  const sw = (k, list, getC, cur) => `<div class="sw">${list.map((it, i) => { const price = it[1] ?? 0; const lock = !owns(k, i); return `<i data-k="${k}" data-i="${i}" class="${cur === i ? 'on' : ''} ${lock ? 'lk' : ''}" style="background:${getC(it, i)}" title="${lock ? 'Costs ' + price + ' XP' : ''}"></i>`; }).join('')}</div>`;
  const chips = (k, list, cur, priceIdx = 1) => `<div class="row">${list.map((it, i) => { const lock = !owns(k, i); return `<div class="ch ${cur === i ? 'on' : ''}" data-k="${k}" data-i="${i}">${lock ? '🔒 ' : ''}${Array.isArray(it) ? it[0] : it}${lock ? `<small>${it[priceIdx]} XP</small>` : ''}</div>`; }).join('')}</div>`;
  const draw = () => {
    const priceOf = { hair: HAIRS, hairColor: HAIR_COLORS, outfit: OUTFITS, acc: ACCS, aura: AURAS, pose: POSES };
    let body = '';
    if (tab === 'body') body = `<b>Name</b><input class="nm" id="nm" maxlength="14" value="${Save.d.name}"><b>Build</b><div class="row"><div class="ch ${app.gender === 'm' ? 'on' : ''}" data-g="m">Male uniform</div><div class="ch ${app.gender === 'f' ? 'on' : ''}" data-g="f">Female uniform</div></div><b>Skin tone</b><div class="sw">${SKINS.map((c, i) => `<i data-sk="${i}" class="${app.skin === i ? 'on' : ''}" style="background:${c}"></i>`).join('')}</div><b>Face</b><div class="row">${FACES.map((f, i) => `<div class="ch ${app.face === i ? 'on' : ''}" data-f="${i}">${f}</div>`).join('')}</div>`;
    if (tab === 'hair') body = `<b>Hairstyle</b>${chips('hair', HAIRS, app.hair)}<b>Hair color</b>${sw('hairColor', HAIR_COLORS, (it) => it[0], app.hairColor)}`;
    if (tab === 'outfit') body = `<b>Outfit</b>${chips('outfit', OUTFITS, app.outfit, 2)}`;
    if (tab === 'extras') body = `<b>Accessory</b>${chips('acc', ACCS, app.acc)}<b>Cosmetic aura</b>${chips('aura', AURAS, app.aura)}<b>Victory pose (preview)</b>${chips('pose', POSES, app.pose)}`;
    root.innerHTML = `<div class="ph"><span>${first ? '✨ CREATE YOUR SORCERER' : '👗 WARDROBE'}</span><span class="xp">${Save.d.xp} XP</span></div><div class="pb"><div class="tabs">${tabs.map(t => `<div class="tab ${tab === t ? 'on' : ''}" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</div>`).join('')}</div>${body}<div class="dim" style="font-size:12px">Drag on the preview to rotate. ${first ? 'Locked items can be bought later at the Wardrobe.' : 'Click a locked item to buy it with XP.'}</div><div class="row"><span class="sp"></span>${first ? '' : '<button class="btn sec" id="back">Back</button>'}<button class="btn" id="done">${first ? 'Enter the Academy ▶' : 'Done'}</button></div></div>`;
    root.querySelectorAll('[data-t]').forEach(e => e.onclick = () => { tab = e.dataset.t; sfx('click'); draw(); });
    const nm = root.querySelector('#nm'); if (nm) nm.oninput = () => { Save.d.name = nm.value.trim() || 'Sorcerer'; Save.save(); };
    root.querySelectorAll('[data-g]').forEach(e => e.onclick = () => { app.gender = e.dataset.g; apply(); });
    root.querySelectorAll('[data-sk]').forEach(e => e.onclick = () => { app.skin = +e.dataset.sk; apply(); });
    root.querySelectorAll('[data-f]').forEach(e => e.onclick = () => { app.face = +e.dataset.f; apply(); });
    root.querySelectorAll('[data-k]').forEach(e => e.onclick = () => { const k = e.dataset.k, i = +e.dataset.i; if (!owns(k, i)) { const price = priceOf[k][i][k === 'outfit' ? 2 : 1]; if (Save.d.xp < price) { sfx('lose'); return; } Save.d.xp -= price; Save.d.cos[k].push(i); sfx('win'); setXP(); } app[k] = i; apply(); });
    root.querySelector('#done').onclick = () => { Save.d.created = true; Save.save(); root.remove(); onDone(); };
    const b = root.querySelector('#back'); if (b) b.onclick = () => { Save.save(); root.remove(); onBack && onBack(); };
  };
  const apply = () => { Save.save(); sfx('click'); onChange(); draw(); };
  draw(); document.body.appendChild(root); return root;
}

/* ---------------- HUD ---------------- */
let hudEls = null;
export function buildHUD() {
  const hud = $('#hud'); hud.innerHTML = `<div class="tm"><span id="tmv">2:30</span><small id="tmm"></small></div>
  <div class="pl"><div class="nm" id="pnm"></div><div class="hb"><u id="hpg"></u><i id="hpb"></i><span id="hpt"></span></div><div class="hb ce"><i id="ceb"></i></div><div class="hb ul" id="ulw"><i id="ulb"></i><span id="ult" style="position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font:900 9px system-ui;letter-spacing:1.5px;color:#fff;text-shadow:0 1px 2px #000;pointer-events:none"></span></div></div>
  <div class="slots" id="slots"></div><div id="oh"></div><div id="dnl"></div><div id="xh" style="display:none;position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#fff;box-shadow:0 0 6px #000,0 0 2px #000;pointer-events:none"></div><div id="sdc" style="position:absolute;right:18px;bottom:96px;font-size:12px;font-weight:900;letter-spacing:1px;color:#fff;text-shadow:0 1px 6px #000"></div><div id="feed"></div><div id="bigw"></div><div id="count"></div>
  <div id="cmbhint"><b>LMB</b> light · <b>RMB</b> heavy · <b>F</b> block (tap before a hit = PERFECT) · <b>Q</b> dash · <b>Shift</b> sprint · <b>Space</b> jump<br><b>1</b> Active · <b>2</b> Passive · <b>3</b> Shikigami · <b>4</b> Ultimate State (then 1-4 = your Ultimate Moves; fill the Cursed Energy meter, then <b>5</b> Domain) · <b>6</b>/<b>C</b> Simple Domain (counter) · <b>5</b> during an enemy Domain warning = clash · <b>V</b> lock-on · <b>Z</b> shift-lock · <b>E</b> switch · <b>B</b> emote · <b>Hold Tab</b> scoreboard</div><div id="sc" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:34px;font-weight:900;text-shadow:0 2px 8px #000;letter-spacing:3px;text-align:center"></div><div id="sb"></div>
  <div id="cine"><div class="lb t"></div><div class="lb b"></div><div class="vig"></div><div class="noise"></div><div class="noiset"></div><div class="flash"></div><div class="imp"></div><div class="warn"></div><div class="ttl"><div class="sl"></div><div class="k"></div><div class="n"></div><div class="s"></div></div><div class="clash"></div><div class="trial"></div><div class="reels"></div><div class="resp"></div><div class="hs"></div><div class="kj"></div></div>`;
  hudEls = { slots: [] };
  const sl = $('#slots'); SL.forEach((s, i) => { const d = document.createElement('div'); d.className = 'slot ' + s; d.innerHTML = `<span class="kk">${i < 3 ? i + 1 : i === 3 ? 4 : 5}</span><div class="ic"></div><div class="sn"></div><div class="cdv" style="display:none"></div>`; sl.appendChild(d); hudEls.slots.push(d); });
  hudEls.oh = new Map();
}
let lastSlotKey = '';
export function hudUpdate(g) {
  const p = g.player, E = hudEls; if (!E) return;
  const sc = $('#sc'); if (sc) sc.innerHTML = g.cfg.mode === 'training' ? '<span style="font-size:18px">TRAINING · T resets dummies</span>' : scoreHtml(g); $('#tmv') && ($('#tmv').parentNode.style.display = 'none');
  $('#pnm').textContent = (titleText() ? titleText() + ' · ' : '') + p.name; const hpp = Math.max(0, p.hp / p.maxHp * 100); $('#hpb').style.width = hpp + '%'; const gz = $('#hpg'); gz.style.width = Math.max(hpp, parseFloat(gz.style.width) - 0.5 || 0) + '%'; $('#hpt').textContent = Math.ceil(p.hp); $('#ceb').style.width = p.ce / p.maxCe * 100 + '%'; const uc = (p.ab.u.ultCost || 100); $('#ulb').style.width = (p.ustate ? Math.min(100, p.ult) : Math.min(100, p.ult / uc * 100)) + '%'; $('#ulw').classList.toggle('rdy', p.ult >= uc && !p.ustate && p.cd.u <= 0);
  { const ub = $('#ulb'), ut = $('#ult'), locked = !p.ustate && p.cd.u > 0; ub.style.background = p.ustate ? p.ustate.def.color : locked ? '#555' : ''; ub.style.opacity = locked ? 0.5 : 1; if (locked) ub.style.width = '0%'; ut.textContent = p.ustate ? 'AWAKENED ' + Math.ceil(p.ustate.t) + 's · ' + (p.ult >= 99.5 ? 'DOMAIN READY' : 'DOMAIN ' + Math.floor(p.ult) + '%') + (g.cine || g.dom ? ' (PAUSED)' : '') : locked ? 'LOCKED ' + Math.ceil(p.cd.u) + 's' : p.ult >= uc ? 'AWAKENING READY · 4' : 'CURSED ENERGY ' + Math.floor(p.ult) + '%'; }
  
  SL.forEach((s, i) => { const inSt = !!p.ustate && i < 4; const a = inSt ? Object.assign({}, p.ustate.moves[i], { r: 'L', cast: true }) : (p.ab[s] || { id: 'none', r: 'C', icon: '—', name: s === 'd' ? 'No Domain' : '—' }), d = E.slots[i]; const key = a.id || a.name; if (d.dataset.id !== key) { d.dataset.id = key; d.style.setProperty('--rc', inSt ? p.ustate.def.color : rc(a.r)); $('.ic', d).textContent = a.icon; $('.sn', d).textContent = a.name; } const cd = inSt ? p.ucd[i] : p.cd[s]; if (a.id === 'none') { d.classList.add('no'); d.classList.remove('rdy'); $('.cdv', d).style.display = 'none'; return; } const cv = $('.cdv', d); const cost = (a.cost || 0) * p.ceMul * (p.ceFree ? 0 : 1);
    const noce = inSt ? false : s === 'u' ? (p.ult < (a.ultCost || 100) || !!p.ustate) : s === 'd' ? (!p.ustate || p.ult < 99.5 || p.burnT > 0) : p.ce < cost; if (s === 'd') { const gd = g.dom && g.dom.f === p && g.dom.spec.reels && !g.dom.E.win ? g.dom : null; const sub = gd ? ((gd.E.rh || 0) >= 5 ? 'REROLL READY!' : 'REROLL ' + (gd.E.rh || 0) + '/5 HITS') : p.ustate && p.burnT > 0 ? 'BURNOUT' : p.ult < 99.5 ? Math.floor(p.ult) + '% CE' : ''; if (d._sub !== sub) { d._sub = sub; let sb = d.querySelector('.sb'); if (!sb) sb = d.appendChild(Object.assign(document.createElement('div'), { className: 'sb', style: 'position:absolute;bottom:-14px;left:0;right:0;text-align:center;font-size:10px;font-weight:900;color:#ffd070' })); sb.textContent = sub; } } if (s === 'u' && !inSt) { const gf = d.querySelector('.gf') || d.appendChild(Object.assign(document.createElement('div'), { className: 'gf' })); gf.style.height = Math.min(100, p.ult / (a.ultCost || 100) * 100) + '%'; } cv.style.display = cd > 0.05 ? 'flex' : 'none'; cv.textContent = cd > 0.05 ? (cd >= 10 ? Math.ceil(cd) : cd.toFixed(1)) : ''; d.classList.toggle('no', cd <= 0.05 && noce && (a.cast || a.press) ? true : false); d.classList.toggle('rdy', cd <= 0.05 && !noce); d.classList.toggle('on', !!((a.id === 'mend' && p.mend) || (a.id === 'still' && p.barrierOn) || (a.id === 'overdrive' && p.crit) || (a.id === 'lucky' && (p.jack >= 100 || p.jackT > 0)) || (a.id === 'swap' && p.rock && p.rock.alive) || (a.id === 'mass' && p.mass > 0) || (a.id === 'thunder' && p.thunder > 0))); });
  { const sd = $('#sdc'); if (sd) sd.textContent = p.simple > 0 ? '◯ SIMPLE DOMAIN ACTIVE ' + p.simple.toFixed(1) + 's' : p.sdCd > 0 ? '6 · Simple Domain ' + Math.ceil(p.sdCd) + 's' : p.ce >= 30 ? '6 · SIMPLE DOMAIN READY' : ''; }
  // overheads
  const cam = g.cam; const w = g.eng.size.w, h2 = g.eng.size.h; const ohr = $('#oh');
  for (const f of g.fighters) { if (f.isPlayer) continue; let o = E.oh.get(f); if (!o) { o = document.createElement('div'); o.className = 'oh'; o.innerHTML = `<div class="n"></div><div class="hb"><i></i></div><div class="hb ce" style="display:none"><i></i></div>`; ohr.appendChild(o); E.oh.set(f, o); }
    const v = f.pos.clone(); v.y += 3.0; v.project(cam); const vis = v.z < 1 && !f.dead; o.style.display = vis ? 'block' : 'none'; if (!vis) continue; o.style.left = (v.x * 0.5 + 0.5) * w + 'px'; o.style.top = (-v.y * 0.5 + 0.5) * h2 + 'px'; o.firstChild.textContent = (f.isCurse ? '☠ ' : '') + f.name + (f.castWarn > 0 && p.seesCE ? ' ⚠' : '') + (f.team === p.team ? ' ✦' : ''); o.firstChild.style.color = f.team === p.team ? '#9be8ff' : '#fff'; o.children[1].firstChild.style.width = f.hp / f.maxHp * 100 + '%'; const c = o.children[2]; c.style.display = p.seesCE ? 'block' : 'none'; c.firstChild.style.width = f.ce / f.maxCe * 100 + '%'; }
}
export function hudClear() { hudEls = null; $('#hud').innerHTML = ''; }
export const hudShow = (v) => $('#hud').classList.toggle('hidden', !v);
export function dmgNum(world, camera, size, amt, color, big) { return;
  const v = world.clone().project(camera); if (v.z > 1) return; const d = document.createElement('div'); d.className = 'dn' + (big ? ' big' : ''); d.textContent = Math.round(amt * 10) / 10 >= 1 ? Math.round(amt) : amt.toFixed(1); d.style.color = color; d.style.left = (v.x * 0.5 + 0.5) * size.w + (Math.random() * 30 - 15) + 'px'; d.style.top = (-v.y * 0.5 + 0.5) * size.h + 'px'; $('#dnl').appendChild(d); setTimeout(() => d.remove(), 900);
}
export function floatText(world, camera, size, text, color) { const v = world.clone().project(camera); if (v.z > 1) return; const d = document.createElement('div'); d.className = 'dn'; d.style.fontSize = '17px'; d.textContent = text; d.style.color = color; d.style.left = (v.x * 0.5 + 0.5) * size.w + 'px'; d.style.top = (-v.y * 0.5 + 0.5) * size.h + 'px'; $('#dnl').appendChild(d); setTimeout(() => d.remove(), 900); }
export function bigText(text, color, who) { const w = $('#bigw'); if (!w) return; w.innerHTML = `<div id="big" style="color:${color}">${text}<small>${who ? who : ''}</small></div>`; setTimeout(() => { if (w.firstChild && w.firstChild.textContent.startsWith(text)) w.innerHTML = ''; }, 2000); }
export function feed(a, b, mine, assist) { const f = $('#feed'); if (!f) return; const d = document.createElement('div'); d.innerHTML = `<span style="color:${mine ? '#ffd98a' : '#fff'}">${a}</span> ⚔ ${b}${assist && assist.length ? ` <span style="opacity:.7;font-size:12px">+ ${assist.join(', ')}</span>` : ''}`; f.appendChild(d); setTimeout(() => d.remove(), 5000); }
export function countText(c) { const e = $('#count'); if (!e) return; if (c < 0) { e.innerHTML = ''; return; } const n = Math.ceil(c); e.textContent = c > 0.4 ? (n > 3 ? '' : n) : 'FIGHT!'; if (n <= 0) e.textContent = 'FIGHT!'; if (c <= 0 && c > -1) e.textContent = 'FIGHT!'; }

function scoreHtml(g) {
  if (g.cfg.mode === 'ffa') { const me = g.player.kos; const top = Math.max(...g.fighters.filter(f => !f.isCurse).map(f => f.kos)); return `<span style="color:#ffd98a">${me}</span> <span style="font-size:15px;opacity:.7">YOU · LEADER ${top} · FIRST TO ${g.goal}</span>`; }
  const mine = g.score[g.player.team] || 0; let opp = 0; for (const k in g.score) if (+k !== g.player.team) opp = Math.max(opp, g.score[k]); return `<span style="color:#7fe0ff">${mine}</span> <span style="font-size:16px;opacity:.7">FIRST TO ${g.goal}</span> <span style="color:#ff8a8a">${opp}</span>`;
}
export function scoreUpdate() { }
export function scoreboard(g, on) {
  const e = $('#sb'); if (!e) return; e.classList.toggle('on', !!on); if (!on) return;
  const rows = g.fighters.filter(f => !f.isCurse).sort((a, b) => b.kos - a.kos); e.innerHTML = `<table><tr><th>FIGHTER</th><th>KO</th><th>AST</th><th>DEATHS</th><th>DAMAGE</th></tr>${rows.map(f => `<tr class="${f.isPlayer ? 'me' : ''}"><td>${f.name}${f.dead ? ' ☠' : ''}</td><td>${f.kos}</td><td>${f.assists}</td><td>${f.deaths}</td><td>${Math.round(f.dmgDealt)}</td></tr>`).join('')}</table>`;
}
/* ---- cinematic overlay controller ---- */
let reelTimer = null;
export function cine(cmd, data) {
  const c = $('#cine'); if (!c) return; const q = (x) => c.querySelector(x);
  if (cmd === 'bars') { c.classList.toggle('on', !!data); $('#hud').classList.toggle('cin', !!data); }
  else if (cmd === 'impact') { const e = q('.imp'); e.classList.remove('go', 'crit'); void e.offsetWidth; e.classList.add('go'); if (data && data.crit) e.classList.add('crit'); }
  else if (cmd === 'flash') { const f = q('.flash'); if (!data) { f.className = 'flash'; return; } f.style.background = '#fff'; f.className = 'flash'; void f.offsetWidth; f.className = 'flash go'; }
  else if (cmd === 'title') { const t = q('.ttl'); if (!data) { t.classList.remove('on'); return; } t.style.setProperty('--c', data.color); t.style.color = data.color; t.classList.remove('on'); void t.offsetWidth; q('.ttl .k').textContent = data.kind; q('.ttl .n').textContent = data.name.toUpperCase(); q('.ttl .s').textContent = data.sub || ''; q('.ttl .n').style.color = '#fff'; q('.ttl .n').style.textShadow = `0 0 40px ${data.color},0 0 90px ${data.color},0 6px 0 #000`; t.classList.add('on'); }
  else if (cmd === 'hands') { const h = q('.hs'); if (!data) { h.classList.remove('on'); return; } h.style.setProperty('--c', data); h.classList.add('on'); }
  else if (cmd === 'kanji') { const k = q('.kj'); if (!data) { k.classList.remove('on'); k.textContent = ''; return; } k.style.setProperty('--c', data.color); k.textContent = data.text; k.classList.remove('on'); void k.offsetWidth; k.classList.add('on'); }
  else if (cmd === 'warning') { const w = q('.warn'), v = q('.vig'); if (!data) { w.classList.remove('on'); v.classList.remove('on'); return; } w.style.color = data.color; w.innerHTML = `⚠ DOMAIN EXPANSION ⚠<small>${data.who} · ${data.name.toUpperCase()}</small>`; w.classList.add('on'); v.style.setProperty('--c', data.color); v.classList.add('on'); }
  else if (cmd === 'clash') { const e = q('.clash'); if (!data || !data.show) { e.classList.remove('on'); return; } e.classList.add('on'); const tot = Math.max(1, data.pa + data.pb), pa = data.pa / tot * 100; e.innerHTML = `<h2>DOMAIN CLASH!</h2><div style="font-size:18px;font-weight:800;letter-spacing:3px">MASH</div><span class="keycap">${data.key}</span><div class="cb"><i style="width:${pa}%;background:linear-gradient(90deg,#4ad8ff,#2a6cff)"></i><i style="width:${100 - pa}%;background:linear-gradient(90deg,#ff6a6a,#ff2a7a)"></i></div><div class="nn"><span style="color:#7fe0ff">${data.a}</span><span style="color:#ff8a8a">${data.b}</span></div>`; }
  else if (cmd === 'trial') { const e = q('.trial'); if (!data || !data.show) { e.classList.remove('on'); return; } e.classList.add('on'); e.innerHTML = `<div class="t1">COURT IN SESSION</div><div style="font-size:15px;opacity:.85;margin:4px 0">${data.text || 'MASH ATTACK TO DEFEND!'}</div><div class="cb"><i style="width:${Math.round((data.p || 0) * 100)}%;background:linear-gradient(90deg,#ffd070,#ff7a30)"></i></div><div style="font-size:14px;margin-top:4px">${Math.max(0, data.t || 0).toFixed(1)}s</div>`; }
  else if (cmd === 'reels') { const e = q('.reels'); clearInterval(reelTimer); if (!data) { e.classList.remove('on'); return; } e.classList.add('on'); const syms = ['7', '♦', '♣', '★', '♥', '☠']; const fin = data.win ? ['7', '7', '7'] : ['7', '★', '☠']; const t0 = performance.now(); const draw = () => { const k = Math.floor((performance.now() - t0) / 450); e.innerHTML = `<h3 style="color:#ff80d8">${data.who} · IDLE DEATH GAMBLE</h3><div class="rw">${fin.map((v, i) => `<div class="rl">${i < k ? v : syms[Math.floor(Math.random() * syms.length)]}</div>`).join('')}</div><div style="margin-top:8px;font-size:20px;font-weight:900">${k >= 3 ? (data.win ? 'JACKPOT!' : 'NO JACKPOT') : ''}</div>`; if (k >= 6) { clearInterval(reelTimer); e.classList.remove('on'); } }; draw(); reelTimer = setInterval(draw, 70); }
  else if (cmd === 'overload') { const n = q('.noise'), t = q('.noiset'); n.classList.toggle('on', !!data); t.classList.toggle('on', !!data); if (data) { t.textContent = 'SYSTEM OVERLOAD'; if (typeof data === 'number') setTimeout(() => { n.classList.remove('on'); t.classList.remove('on'); }, data * 1000); } }
  else if (cmd === 'respawn') { const e = q('.resp'); if (!data) { e.classList.remove('on'); return; } e.classList.add('on'); e.textContent = data.text; }
}
export function resultHtml(r, xp, delta, rk) {
  const me = r.rows.find(x => x.me);
  return `<h1 style="color:${r.draw ? '#ccc' : r.won ? '#ffd98a' : '#ff6b8a'};text-shadow:0 0 50px currentColor">${r.draw ? 'DRAW' : r.won ? 'VICTORY' : 'DEFEAT'}</h1>
  <div class="res"><div class="rr2 h"><span></span><span>FIGHTER</span><span>KO</span><span>AST</span><span>DTH</span><span>DAMAGE</span></div>${r.rows.map(x => `<div class="rr2 ${x.me ? 'me' : ''}"><span>${x.mvp ? '★' : ''}</span><span>${x.name}${x.mvp ? ' <small style="color:#ffd98a">MVP</small>' : ''}</span><span>${x.kos}</span><span>${x.assists}</span><span>${x.deaths}</span><span>${x.dmg}</span></div>`).join('')}</div>
  <div class="stat"><div><b>+${xp}</b>XP</div><div><b>${r.curses}</b>Curses exorcised</div><div><b>${rk.grade}</b>${rk.full}${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}</div></div>
  ${(r.mast && r.mast.length) ? `<div style="max-width:640px;font-size:13px"><b style="color:#ffd76a">MASTERY</b> ${r.mast.map(m => `<span style="margin-right:12px">${m.icon} ${m.name} +${m.gain}${m.after > m.before ? ' <b style="color:#6bff9a">LV ' + m.after + '!</b>' : ' (Lv ' + m.after + ')'}</span>`).join('')}</div>` : ''}
  <div class="row"><button class="btn" id="hb">Return to Academy</button><button class="btn sec" id="rm">Rematch</button></div>`;
}

/* ---------------- LOADING SCREEN ---------------- */
const LOAD_CHARS = [['Kaito Rend', '#ff4a5a', 0], ['Mirei Vale', '#7ab8ff', 1], ['Tobari Nox', '#a070ff', 2], ['Sora Ibuki', '#ffd070', 3], ['Ryo Kanzaki', '#5affb0', 4]];
function portrait(color, kind) {
  const c = document.createElement('canvas'); c.width = 420; c.height = 520; const x = c.getContext('2d');
  const g = x.createRadialGradient(210, 220, 20, 210, 260, 300); g.addColorStop(0, color + '66'); g.addColorStop(1, '#00000000'); x.fillStyle = g; x.fillRect(0, 0, 420, 520);
  x.fillStyle = '#0c0a14'; x.beginPath(); x.moveTo(40, 520); x.quadraticCurveTo(60, 340, 210, 330); x.quadraticCurveTo(360, 340, 380, 520); x.fill();
  x.fillStyle = color; x.globalAlpha = 0.9; x.fillRect(190, 330, 40, 170); x.globalAlpha = 1;
  x.fillStyle = '#e8c9a8'; x.beginPath(); x.ellipse(210, 230, 74, 92, 0, 0, 6.283); x.fill();
  x.fillStyle = '#14101e'; x.beginPath();
  if (kind === 0) { x.moveTo(120, 220); for (let i = 0; i < 9; i++) { x.lineTo(120 + i * 22, 90 - (i % 2) * 50 - 10); x.lineTo(131 + i * 22, 150); } x.lineTo(300, 220); x.lineTo(290, 150); x.lineTo(130, 150); }
  else if (kind === 1) { x.ellipse(210, 170, 95, 80, 0, Math.PI, 0); x.lineTo(300, 300); x.lineTo(280, 200); x.lineTo(140, 200); x.lineTo(120, 300); }
  else if (kind === 2) { x.ellipse(210, 160, 90, 70, 0, Math.PI, 0); x.lineTo(290, 210); x.lineTo(130, 210); }
  else if (kind === 3) { x.moveTo(125, 230); x.quadraticCurveTo(210, 40, 295, 230); x.lineTo(280, 160); x.lineTo(140, 160); }
  else { x.moveTo(125, 220); for (let i = 0; i < 6; i++) { x.lineTo(125 + i * 34, 80); x.lineTo(142 + i * 34, 160); } x.lineTo(295, 220); }
  x.fill(); x.fillStyle = color; x.shadowColor = color; x.shadowBlur = 18; x.fillRect(166, 232, 28, 7); x.fillRect(226, 232, 28, 7); x.shadowBlur = 0;
  return c;
}
export function showLoading(cfg) {
  const ch = LOAD_CHARS[Math.floor(Math.random() * LOAD_CHARS.length)]; const e = document.createElement('div'); e.id = 'loading';
  e.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#000;display:flex;align-items:center;justify-content:center;gap:48px;color:#fff;font-family:system-ui';
  const cv = portrait(ch[1], ch[2]); cv.style.cssText = 'height:62vh;max-height:520px;filter:drop-shadow(0 0 30px ' + ch[1] + '88)';
  const right = document.createElement('div'); right.style.cssText = 'display:flex;flex-direction:column;gap:12px;min-width:300px';
  const mp = MAPS[cfg.map] ? MAPS[cfg.map].name : cfg.map;
  right.innerHTML = `<div style="font-size:54px;font-weight:900;font-style:italic;letter-spacing:6px;text-shadow:0 0 30px ${ch[1]}">JJKLASH</div><div style="color:${ch[1]};font-weight:800;letter-spacing:4px">${ch[0].toUpperCase()}</div><div style="opacity:.85;font-weight:700">${(cfg.mode || '').toUpperCase()}${cfg.ranked ? ' · RANKED' : cfg.net ? ' · ONLINE' : ''} — ${mp}</div><div style="height:6px;background:#ffffff22;border-radius:4px;overflow:hidden"><i id="ldb" style="display:block;height:100%;width:0%;background:${ch[1]}"></i></div><div id="ldt" style="opacity:.6;font-size:13px">Loading… 0%</div>`;
  e.appendChild(cv); e.appendChild(right); document.body.appendChild(e); const t0 = performance.now(); let alive = true;
  const tick = () => { if (!alive) return; const p = Math.min(0.95, (performance.now() - t0) / 1600); e.querySelector('#ldb').style.width = p * 100 + '%'; e.querySelector('#ldt').textContent = 'Loading… ' + Math.round(p * 100) + '%'; requestAnimationFrame(tick); }; tick();
  return { done: async () => { const wait = Math.max(0, 1200 - (performance.now() - t0)); await new Promise(r => setTimeout(r, wait)); alive = false; const b = e.querySelector('#ldb'); if (b) b.style.width = '100%'; await new Promise(r => setTimeout(r, 150)); e.remove(); } };
}
export function kogane(msg) { toast('🐦 KOGANE · ' + msg); }
