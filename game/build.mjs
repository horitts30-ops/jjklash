import { build } from 'esbuild';
import fs from 'fs';
import crypto from 'crypto';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
const raw = r.outputFiles[0].text;
const inline = raw.replace(/<\/script>/g, '<\\/script>');
const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 10);
const fav = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23120a1c'/%3E%3Cpath d='M32 8l20 12v24L32 56 12 44V20z' fill='none' stroke='%23ff3355' stroke-width='5'/%3E%3Ccircle cx='32' cy='32' r='7' fill='%23ffd070'/%3E%3C/svg%3E";
const desc = 'JJKLASH is a free 3D arena fighting game in your browser. Build a sorcerer, open mystery boxes for techniques, unlock domains and awakenings, and fight AI or friends online.';
const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>JJKLASH - 3D Arena Fighter</title><meta name="description" content="${desc}"><meta name="theme-color" content="#08060f"><meta property="og:type" content="website"><meta property="og:title" content="JJKLASH - 3D Arena Fighter"><meta property="og:description" content="${desc}"><meta name="twitter:card" content="summary"><link rel="icon" href="${fav}">`;
const boot = `<style>html,body{margin:0;background:#08060f;overflow:hidden}#boot{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(circle,#1a1030,#05030a);color:#fff;font:900 54px/1 system-ui,sans-serif;font-style:italic;letter-spacing:8px;transition:opacity .4s}#boot i{display:block;width:220px;height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden;position:relative}#boot i:after{content:'';position:absolute;inset:0;width:40%;background:#ff3355;animation:bt 1.1s infinite ease-in-out}@keyframes bt{from{transform:translateX(-100%)}to{transform:translateX(260%)}}</style><div id="boot">JJKLASH<i></i></div><noscript><p style="color:#fff;font:16px system-ui;text-align:center;margin-top:30vh">JJKLASH needs JavaScript and WebGL.</p></noscript>`;
fs.mkdirSync('dist/assets', { recursive: true });
for (const f of fs.readdirSync('dist/assets')) fs.unlinkSync('dist/assets/' + f);
fs.writeFileSync(`dist/assets/game.${hash}.js`, raw);
// web build: tiny HTML paints a splash instantly, game script loads in parallel (cacheable, hashed)
fs.writeFileSync('dist/index.html', `<!DOCTYPE html><html lang="en"><head>${head}<script defer src="assets/game.${hash}.js"></script></head><body>${boot}</body></html>`);
// single-file build for opening locally / sharing as one file
const single = `<!DOCTYPE html><html lang="en"><head>${head}</head><body>${boot}<script>${inline}</script></body></html>`;
fs.writeFileSync('dist/hexclash.html', single);
console.log('built single', (single.length / 1024).toFixed(0) + 'KB, web js', (raw.length / 1024).toFixed(0) + 'KB, hash', hash);
