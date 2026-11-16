// NEONFALL ARENA — drawing only: world state + current screen in, pixels out.
// The 1280x720 arena is scaled to fit the window and centred; the margin is
// filled with the backdrop colour. Neon glow is faked with layered strokes
// (cheap, no shadowBlur in the hot path) and everything animated reads the
// world's clock, so screenshot scenes render deterministically.

import { FIELD, FONT, PALETTE, PLAYER, TOTAL_WAVES, UPGRADE_LAYOUT } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_OVER = 'over';

export function upgradeCardRect(index) {
  const { cardW, cardH, gap, top } = UPGRADE_LAYOUT;
  const total = cardW * 3 + gap * 2;
  return { x: (FIELD.width - total) / 2 + index * (cardW + gap), y: top, w: cardW, h: cardH };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  function text(value, x, y, size, color, align = 'center', weight = 600) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(value, x, y);
  }

  function bar(x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.10)') {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }

  // ---------- arena ----------
  function drawArena(state) {
    ctx.fillStyle = PALETTE.arena;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Parallax starfield: layers drift against the player's offset.
    const ox = (state.player.x - FIELD.width / 2);
    const oy = (state.player.y - FIELD.height / 2);
    for (const s of state.stars) {
      const tw = 0.55 + 0.45 * Math.sin(state.time * 2 + s.tw);
      ctx.globalAlpha = 0.35 + 0.5 * tw * s.layer;
      ctx.fillStyle = '#cfe4ff';
      const px = s.x - ox * 0.05 * s.layer;
      const py = s.y - oy * 0.05 * s.layer;
      ctx.fillRect(px, py, s.size, s.size);
    }
    ctx.globalAlpha = 1;
    // Grid.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); }
    for (let y = 80; y < FIELD.height; y += 80) { ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); }
    ctx.stroke();
    // Walls.
    ctx.strokeStyle = PALETTE.wall;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, FIELD.width - 3, FIELD.height - 3);
    ctx.strokeStyle = 'rgba(34,230,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(5.5, 5.5, FIELD.width - 11, FIELD.height - 11);
  }

  function drawShards(state) {
    for (const s of state.shards) {
      if (s.life < 3 && Math.floor(s.life * 6) % 2 === 0) continue; // expiring blink
      const r = 6 + Math.sin(state.time * 6 + s.x) * 1.2;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(state.time * 3 + s.x * 0.05);
      ctx.fillStyle = 'rgba(255,225,77,0.22)';
      ctx.beginPath(); ctx.moveTo(0, -r * 1.9); ctx.lineTo(r * 1.9, 0); ctx.lineTo(0, r * 1.9); ctx.lineTo(-r * 1.9, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawEnemy(e, state) {
    const flash = e.flash > 0;
    const color = flash ? '#ffffff' : e.color;
    ctx.save();
    ctx.translate(e.x, e.y);
    // Outer glow halo.
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(0, 0, e.radius * 1.55, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    const r = e.radius;
    if (e.type === 'chaser' || e.type === 'mini') {
      ctx.rotate(Math.atan2(state.player.y - e.y, state.player.x - e.x));
      ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.8, r * 0.75); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.8, -r * 0.75); ctx.closePath(); ctx.fill();
    } else if (e.type === 'speeder') {
      ctx.rotate(Math.atan2(e.vy, e.vx));
      ctx.beginPath(); ctx.moveTo(r * 1.25, 0); ctx.lineTo(-r, r * 0.55); ctx.lineTo(-r * 0.55, 0); ctx.lineTo(-r, -r * 0.55); ctx.closePath(); ctx.fill();
    } else if (e.type === 'tank' || e.type === 'boss' || e.type === 'finalboss') {
      ctx.rotate(state.time * 0.6 + e.wobble);
      const n = e.type === 'tank' ? 6 : 8;
      ctx.beginPath();
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        const px = Math.cos(a) * r; const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0a0e20';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'shooter') {
      ctx.rotate(state.time * 1.4 + e.wobble);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, 3.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'splitter') {
      const pulse = 1 + Math.sin(e.wobble * 2) * 0.07;
      ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(10,14,32,0.65)';
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2 + state.time;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.28, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    // Mini HP bar for tough enemies.
    if (e.maxHp >= 36 && e.hp < e.maxHp && e.type !== 'boss' && e.type !== 'finalboss') {
      bar(e.x - r, e.y - r - 12, r * 2, 4, e.hp / e.maxHp, e.color, 'rgba(255,255,255,0.12)');
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (state.dead) return;
    if (p.invuln > 0 && p.dashTimer <= 0 && Math.floor(state.time * 14) % 2 === 0) return; // hurt blink
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.shield) {
      ctx.strokeStyle = 'rgba(125,249,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, p.radius + 8 + Math.sin(state.time * 4) * 1.5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.rotate(p.aim);
    // Muzzle flash.
    if (p.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,240,170,0.9)';
      ctx.beginPath(); ctx.moveTo(p.radius + 16, 0); ctx.lineTo(p.radius + 4, 5); ctx.lineTo(p.radius + 4, -5); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath(); ctx.arc(0, 0, p.radius * 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.flash > 0 ? '#ffffff' : PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(p.radius + 5, 0); ctx.lineTo(-p.radius * 0.8, p.radius * 0.78); ctx.lineTo(-p.radius * 0.35, 0); ctx.lineTo(-p.radius * 0.8, -p.radius * 0.78);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#062a38';
    ctx.beginPath(); ctx.arc(1, 0, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawProjectiles(state) {
    ctx.fillStyle = '#aef7ff';
    for (const b of state.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.globalAlpha = 0.3; ctx.fillStyle = PALETTE.cyan;
      ctx.fillRect(-12, -3.4, 20, 6.8);
      ctx.globalAlpha = 1; ctx.fillStyle = '#eaffff';
      ctx.fillRect(-8, -1.8, 14, 3.6);
      ctx.restore();
    }
    for (const b of state.ebullets) {
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#ff2e97';
      ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#ff5c8a';
      ctx.beginPath(); ctx.arc(b.x, b.y, 4.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      const frac = Math.max(0, pt.life / pt.maxLife);
      if (pt.type === 'ring') {
        ctx.globalAlpha = frac * 0.9;
        ctx.strokeStyle = pt.color; ctx.lineWidth = 5 * frac + 1;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = frac;
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * frac + 0.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      text(f.text, f.x, f.y, 16, f.color, 'center', 700);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- HUD ----------
  function drawHud(state, best) {
    const p = state.player;
    // HP, top-left.
    text('HULL', 24, 24, 13, PALETTE.muted, 'left', 700);
    bar(24, 34, 230, 15, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? PALETTE.hpLow : PALETTE.hp);
    text(`${Math.ceil(p.hp)} / ${p.maxHp}`, 264, 42, 14, PALETTE.text, 'left', 700);
    // Wave, top-centre.
    text(`WAVE ${Math.max(1, state.wave)} / ${TOTAL_WAVES}`, FIELD.width / 2, 30, 24, PALETTE.text, 'center', 800);
    text(`HOSTILES LEFT  ${state.enemiesLeft}`, FIELD.width / 2, 56, 14, PALETTE.muted, 'center', 700);
    // Score, top-right.
    text(`SCORE  ${state.score}`, FIELD.width - 24, 30, 24, '#ffe14d', 'right', 800);
    text(`BEST  ${Math.max(best, state.score)}`, FIELD.width - 24, 56, 13, PALETTE.muted, 'right', 700);
    // Boss bar.
    const boss = state.enemies.find((e) => e.type === 'boss' || e.type === 'finalboss');
    if (boss) {
      const label = boss.type === 'finalboss' ? '⚠ FINAL GUARDIAN ⚠' : '⚠ GUARDIAN ⚠';
      text(label, FIELD.width / 2, 84, 15, '#ff5c8a', 'center', 800);
      bar(FIELD.width / 2 - 260, 96, 520, 10, boss.hp / boss.maxHp, '#ff2e63', 'rgba(255,46,99,0.15)');
    }
    // Dash, bottom-left.
    const dashReady = p.dashCdTimer <= 0;
    text('DASH [SHIFT]', 24, FIELD.height - 52, 13, PALETTE.muted, 'left', 700);
    bar(24, FIELD.height - 42, 150, 10, dashReady ? 1 : 1 - p.dashCdTimer / p.dashCdMax, PALETTE.dash);
    if (dashReady) text('READY', 184, FIELD.height - 37, 13, PALETTE.dash, 'left', 800);
    // Nova, bottom-centre.
    const novaReady = p.nova >= PLAYER.novaMax;
    text(novaReady ? 'NOVA READY — PRESS E' : 'NOVA CHARGE', FIELD.width / 2, FIELD.height - 52, 13, novaReady ? '#ffe14d' : PALETTE.muted, 'center', 800);
    const pulse = novaReady ? 0.75 + 0.25 * Math.sin(state.time * 8) : 1;
    ctx.globalAlpha = pulse;
    bar(FIELD.width / 2 - 130, FIELD.height - 42, 260, 10, p.nova / PLAYER.novaMax, PALETTE.nova);
    ctx.globalAlpha = 1;
    // Hint, bottom-right.
    text('P pause · M mute', FIELD.width - 24, FIELD.height - 37, 13, PALETTE.muted, 'right', 600);
  }

  // ---------- panels & screens ----------
  function panel(w, h) {
    const x = (FIELD.width - w) / 2; const y = (FIELD.height - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    return { x, y };
  }

  function drawTitle(state, best) {
    // Neon halo: the title drawn wide and faint in magenta behind the cyan face.
    ctx.globalAlpha = 0.35;
    text('NEONFALL', FIELD.width / 2, 150, 96, PALETTE.magenta, 'center', 900);
    ctx.globalAlpha = 1;
    text('NEONFALL', FIELD.width / 2, 148, 92, PALETTE.cyan, 'center', 900);
    text('A R E N A', FIELD.width / 2, 208, 40, PALETTE.magenta, 'center', 800);
    text('Survive 10 waves. Break the Guardians on wave 5 and wave 10.', FIELD.width / 2, 268, 20, PALETTE.text);
    const lines = [
      'WASD / Arrows — move        Mouse — aim        Hold LMB — shoot',
      'SHIFT / SPACE — dash (brief invulnerability)        E — Nova blast when charged',
      'Collect energy shards to score and charge your Nova. Choose 1 of 3 upgrades after each wave.',
      'P — pause        M — mute        R — restart',
    ];
    lines.forEach((line, i) => text(line, FIELD.width / 2, 322 + i * 32, 17, PALETTE.muted));
    if (best > 0) text(`BEST SCORE  ${best}`, FIELD.width / 2, 478, 18, '#ffe14d', 'center', 700);
    const blink = Math.floor(state.time * 1.6) % 2 === 0;
    if (blink) text('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 540, 24, '#2ee6a8', 'center', 800);
  }

  function drawUpgrade(state, hover) {
    ctx.fillStyle = 'rgba(2,3,10,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 148, 44, '#2ee6a8', 'center', 900);
    text(`Score ${state.score} — choose one upgrade`, FIELD.width / 2, 196, 20, PALETTE.text);
    text('Click a card or press 1 · 2 · 3', FIELD.width / 2, 226, 16, PALETTE.muted);
    state.upgradeChoices.forEach((u, i) => {
      const r = upgradeCardRect(i);
      const hot = hover === i;
      ctx.fillStyle = hot ? 'rgba(24,34,72,0.97)' : 'rgba(10,14,32,0.95)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = u.color; ctx.lineWidth = hot ? 3.5 : 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = u.color;
      ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 62, 26, 0, Math.PI * 2); ctx.fill();
      text(String(i + 1), r.x + r.w / 2, r.y + 63, 26, '#070a18', 'center', 900);
      text(u.name, r.x + r.w / 2, r.y + 122, 22, PALETTE.text, 'center', 800);
      text(u.desc, r.x + r.w / 2, r.y + 162, 16, PALETTE.muted);
    });
  }

  function drawEnd(state, best, victory) {
    panel(620, 340);
    if (victory) {
      text('VICTORY', FIELD.width / 2, 262, 58, '#2ee6a8', 'center', 900);
      text('The final Guardian has fallen. The arena is yours.', FIELD.width / 2, 316, 19, PALETTE.text);
    } else {
      text('GAME OVER', FIELD.width / 2, 262, 58, '#ff4d6d', 'center', 900);
      text(`Your ship fell on wave ${state.wave}.`, FIELD.width / 2, 316, 19, PALETTE.text);
    }
    text(`SCORE  ${state.score}`, FIELD.width / 2, 368, 30, '#ffe14d', 'center', 800);
    text(`Wave reached ${state.wave} / ${TOTAL_WAVES} · Kills ${state.kills} · Best ${Math.max(best, state.score)}`, FIELD.width / 2, 406, 17, PALETTE.muted);
    text('Press R or click to play again', FIELD.width / 2, 462, 20, '#2ee6a8', 'center', 800);
  }

  function draw(state, screen, best, hover = -1) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Deterministic screen shake from the world clock (no Math.random here).
    let sx = 0; let sy = 0;
    if (state.shake > 0.2) {
      sx = Math.sin(state.time * 131.7) * state.shake;
      sy = Math.cos(state.time * 149.3) * state.shake;
    }
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawArena(state);
    drawShards(state);
    for (const e of state.enemies) drawEnemy(e, state);
    drawProjectiles(state);
    drawPlayer(state);
    drawParticles(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(2,3,10,0.6)'; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      text('PAUSED', FIELD.width / 2, FIELD.height / 2 - 16, 52, PALETTE.text, 'center', 900);
      text('Press P to resume', FIELD.width / 2, FIELD.height / 2 + 36, 20, PALETTE.muted);
      drawHud(state, best);
    } else if (screen === SCREEN_UPGRADE) { drawHud(state, best); drawUpgrade(state, hover); }
    else if (screen === SCREEN_VICTORY) drawEnd(state, best, true);
    else if (screen === SCREEN_OVER) drawEnd(state, best, false);
    else drawHud(state, best);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField, view };
}
