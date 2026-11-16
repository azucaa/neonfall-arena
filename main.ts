// NEONFALL ARENA — entry program for the make.fun best-game-01 bounty (Node 22,
// standard library only). The game itself lives in this directory's game/ folder:
// plain static files a desktop browser loads fully offline (game/index.html plus
// its ES modules, no library, no network request). This program hands the entry
// in: it copies game/ and screenshots/ from beside this file to the output
// directory, writes the dossier the judge reads with the vendored make.fun
// library, and then audits its own output — counting the game files, weighing
// every screenshot, and refusing to hand in an entry that breaks the intake
// caps, so a broken package fails here instead of at the grader.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// --- NEONFALL ARENA output audit (authored for this entry) -------------------
// Walk the copied game tree and the screenshot folder, and verify the package
// against the same caps the dossier declares. Any violation throws, so the
// entry program exits non-zero rather than handing in a package the scorer
// would refuse.
function auditTree(dir, prefix, acc) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    const st = statSync(full);
    if (st.isDirectory()) {
      auditTree(full, rel, acc);
    } else {
      if (Buffer.byteLength(rel) > 1000) throw new Error(`audit: game path too long: ${rel}`);
      acc.files += 1;
      acc.bytes += st.size;
    }
  }
  return acc;
}

const gameAudit = auditTree(join(out, 'game'), '', { files: 0, bytes: 0 });
if (gameAudit.files > 993) throw new Error(`audit: ${gameAudit.files} game files exceeds the 993 cap`);
if (gameAudit.bytes > 50331648) throw new Error(`audit: game tree is ${gameAudit.bytes} bytes, over the 48 MiB cap`);

const shotDir = join(out, 'screenshots');
const shotNames = existsSync(shotDir) ? readdirSync(shotDir).sort() : [];
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`audit: expected 3 or 4 screenshots, found ${shotNames.length}`);
}
for (const name of shotNames) {
  const size = statSync(join(shotDir, name)).size;
  if (size > 262144) throw new Error(`audit: screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
  console.log(`audit: screenshot ${name} ${size} bytes ok`);
}
console.log(`audit: NEONFALL ARENA package ok — ${gameAudit.files} game files, ${gameAudit.bytes} bytes, ${shotNames.length} screenshots`);
