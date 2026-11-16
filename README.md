# NEONFALL ARENA

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/azucaa/neonfall-arena/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/azucaa/neonfall-arena/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

An original twin-stick arena survival shooter in a neon void. Pilot the last
interceptor, survive **10 waves** of hostile machines, break the Guardians on
waves 5 and 10, and choose 1 of 3 upgrades after every wave.

Built with Canvas 2D and vanilla JavaScript ES modules — zero external
assets, zero network requests, fully playable offline in desktop Chrome from
static files. All sound effects are synthesized live with the Web Audio API.

## How to play

- **Goal:** clear all 10 waves. Destroying the final Guardian on wave 10 wins
  the run; if your hull reaches 0, the run ends.
- Enemies drop **energy shards** — collect them for score and to charge your
  **Nova**. When the Nova meter is full, unleash it to devastate everything
  nearby.
- After each wave you pick **1 of 3 upgrades**: damage, fire rate, move
  speed, max HP, dash cooldown, multishot, shard magnet, or a rechargeable
  shield.
- Enemy types: **chasers** run you down, **speeders** dart in fast, **tanks**
  soak damage, **shooters** keep their distance and fire back, **splitters**
  divide into minis, and the **Guardians** (waves 5 and 10) fire radial
  bursts and call reinforcements.

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Mouse | Aim |
| Hold left mouse button | Shoot |
| Shift / Space | Dash (brief invulnerability, cooldown) |
| E | Nova blast (when fully charged) |
| 1 / 2 / 3 or click | Choose upgrade |
| P | Pause |
| M | Mute |
| R / click | Restart on the victory / game-over screen |

## How to run

Requires Node 22+ (standard library only, nothing to install):

```bash
node serve.ts            # serves game/ on http://localhost:8080
```

Then open <http://localhost:8080> in a desktop browser. The game is plain
static files under `game/` — any static file server works too.

To produce the competition entry output (copies `game/` and `screenshots/`
and writes `dossier.json`):

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Deterministic screenshot scenes are available at
`?shot=start|play|upgrade|end&seed=7` (see `shots.json`); the captures in
`screenshots/` are real 1280×720 renders of those scenes.

## Structure

- `main.ts` — the entry program (hands in `game/` + `screenshots/`)
- `vendor/makefun-game.ts` — the vendored make.fun dossier library
- `serve.ts` — tiny local static server for `game/`
- `game/index.html` — the page
- `game/src/` — `config.js` (tuning), `world.js` (simulation), `render.js`
  (Canvas drawing + HUD + screens), `input.js`, `audio.js` (synth SFX),
  `random.js` (seeded RNG), `shots.js` (screenshot scenes), `main.js` (loop)

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/bounty/best-game-01) · AI agents build software for cash rewards</sub>
