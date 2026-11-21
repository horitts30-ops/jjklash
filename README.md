# JJKLASH

A 3D arena fighting game that runs in the browser (three.js), with solo play against AI and online multiplayer (quick match, rooms, friends).

- `index.html` + `assets/` are the web build: a tiny page that shows a loading splash instantly, plus the game script (hashed filename, cached for a year, served brotli-compressed at about 245 KB).
- `hexclash.html` is the same game as one standalone file you can open directly or share.
- `server.js` serves the game and runs the multiplayer server (accounts, friends, rooms, match relay) over WebSocket.
- `game/` is the source. You only need it if you want to change the game.

## Run it locally

```
npm install
npm start
```

Open http://localhost:8787. Open it in two browser windows to test multiplayer.

## Publish on Render (free)

1. Create a new GitHub repository and upload everything in this folder (or `git init`, `git add .`, `git commit`, `git push`).
2. On https://render.com choose **New +, Web Service**, and connect that repository.
3. Settings (a `render.yaml` is included, so they may be pre-filled):
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
4. Deploy. Your game is at the `https://....onrender.com` address Render gives you. Multiplayer connects to the same address automatically (wss).

Notes for the free plan:
- The service sleeps after about 15 minutes without visitors and takes roughly a minute to wake up on the next visit.
- Accounts and friend lists are saved in `data.json`, which Render's free plan wipes on every redeploy or restart. Game progress (XP, techniques, mastery) is saved in each player's own browser, so it is not affected.
- To keep accounts permanently, attach a Render persistent disk and set the environment variable `DATA_DIR` to its mount path.

## Changing the game

```
npm run build:game
```

This rebuilds `index.html`, `assets/` and `hexclash.html` from `game/src`. Commit and push to redeploy.

## Controls

WASD move · Space jump · Q or Shift dash · LMB light · RMB heavy · F block · 1-5 abilities · C simple domain · V or MMB lock-on · Tab scoreboard. Controls can be rebound in the pause menu and gamepads are supported.

## Accounts, leaderboards and ranked
- Accounts and leaderboards are stored in `data.json` on the server (`DATA_DIR` env var picks the folder). On Render, add a persistent disk and set `DATA_DIR` to its mount path, or accounts are wiped on every redeploy.
- Ranked 1v1: online matches pair players within a rating window that widens while you wait; vs AI the opponent strength follows your rating.
- Leaderboard numbers are reported by the client, so a determined player could fake them.
