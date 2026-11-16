// NEONFALL ARENA — the game's rules and state, with no drawing and no DOM.
// step() advances one fixed step from a plain input object and returns what
// happened as bit flags, so the caller can play sounds and switch screens
// without the world knowing about either. All randomness flows through the
// seeded generator handed to createWorld, which keeps ?shot= scenes exact.

import { ENEMIES, FIELD, PLAYER, SHARD, TOTAL_WAVES, UPGRADES } from './config.js';

export const EV_SHOOT = 1;
export const EV_HIT = 2;
export const EV_EXPLOSION = 4;
export const EV_BIG_EXPLOSION = 8;
export const EV_PICKUP = 16;
export const EV_DASH = 32;
export const EV_NOVA = 64;
export const EV_HURT = 128;
export const EV_SHIELD = 256;
export const EV_WAVE_CLEAR = 512;
export const EV_VICTORY = 1024;
export const EV_GAMEOVER = 2048;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; }

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
    radius: PLAYER.radius, hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    aim: -Math.PI / 2, fireTimer: 0, muzzle: 0, flash: 0,
    dashTimer: 0, dashCdTimer: 0, dashCdMax: PLAYER.dashCooldown,
    invuln: 0, damage: PLAYER.damage, fireInterval: PLAYER.fireInterval,
    speed: PLAYER.speed, multishot: 1, magnetRadius: PLAYER.magnetRadius,
    nova: 0, shield: false, shieldOwned: false,
  };
  const state = {
    player,
    wave: 0, score: 0, kills: 0, time: 0,
    enemies: [], bullets: [], ebullets: [], shards: [], particles: [], floaters: [], stars: [],
    spawnQueue: [], spawnTimer: 0, enemiesLeft: 0,
    shake: 0, waveComplete: false, victory: false, dead: false, started: false,
    upgradeChoices: [],
  };

  function burst(x, y, color, count, speed, life = 0.45, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * TAU;
      const s = speed * (0.3 + random() * 0.9);
      state.particles.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + random() * 0.8), maxLife: life, size: size * (0.6 + random() * 0.8), color });
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, vy: -46, life: 0.9, maxLife: 0.9, text, color });
  }

  function makeStars() {
    state.stars = [];
    for (let i = 0; i < 120; i += 1) {
      state.stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, size: 0.7 + random() * 1.9, layer: 0.25 + random() * 0.75, tw: random() * TAU });
    }
  }

  function buildWave(n) {
    const q = [];
    const add = (type, count) => { for (let i = 0; i < count; i += 1) q.push(type); };
    if (n === 5) {
      add('chaser', 4); add('speeder', 3); add('boss', 1); add('shooter', 2);
    } else if (n === TOTAL_WAVES) {
      add('chaser', 5); add('speeder', 4); add('tank', 2); add('finalboss', 1); add('shooter', 3); add('splitter', 2);
    } else {
      add('chaser', 4 + n);
      if (n >= 2) add('speeder', 2 + n);
      if (n >= 3) add('splitter', Math.floor(n / 2) + 1);
      if (n >= 4) add('shooter', Math.floor(n / 2));
      if (n >= 4) add('tank', Math.floor((n - 2) / 2));
      if (n >= 7) add('speeder', 3);
      if (n >= 8) add('tank', 2);
    }
    // Fisher–Yates with the seeded RNG, but keep a boss from spawning first.
    for (let i = q.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    const bossIdx = q.findIndex((t) => t === 'boss' || t === 'finalboss');
    if (bossIdx > -1 && bossIdx < 3) { const [b] = q.splice(bossIdx, 1); q.splice(3, 0, b); }
    return q;
  }

  function spawnPoint() {
    // A random arena edge point, at least 280px from the player.
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = Math.floor(random() * 4);
      const x = edge === 0 ? 30 : edge === 1 ? FIELD.width - 30 : 40 + random() * (FIELD.width - 80);
      const y = edge === 2 ? 30 : edge === 3 ? FIELD.height - 30 : 40 + random() * (FIELD.height - 80);
      if (dist2(x, y, player.x, player.y) > 280 * 280) return { x, y };
    }
    return { x: 40, y: 40 };
  }

  function spawnEnemy(type, x, y) {
    const def = ENEMIES[type];
    const scale = 1 + (state.wave - 1) * 0.09;
    const e = {
      type, x, y, vx: 0, vy: 0,
      radius: def.radius,
      hp: Math.round(def.hp * scale), maxHp: Math.round(def.hp * scale),
      speed: def.speed * (0.92 + random() * 0.16),
      damage: def.damage, score: def.score, color: def.color,
      fireTimer: 1 + random() * (def.fireInterval || 2),
      flash: 0, wobble: random() * TAU, addsSpawned: 0,
    };
    state.enemies.push(e);
    burst(x, y, def.color, 8, 130, 0.3, 2.5);
    return e;
  }

  function dropShards(e) {
    const n = ENEMIES[e.type].shards;
    for (let i = 0; i < n; i += 1) {
      const a = random() * TAU; const s = 30 + random() * 70;
      state.shards.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: SHARD.life });
    }
  }

  function killEnemy(e, events) {
    e.dead = true;
    state.kills += 1;
    state.score += e.score;
    floater(e.x, e.y - e.radius, `+${e.score}`, '#eef4ff');
    burst(e.x, e.y, e.color, e.radius > 30 ? 34 : 16, e.radius > 30 ? 320 : 240);
    dropShards(e);
    if (e.type === 'splitter') {
      for (let i = 0; i < 3; i += 1) {
        const m = spawnEnemy('mini', e.x + (random() - 0.5) * 30, e.y + (random() - 0.5) * 30);
        m.vx = (random() - 0.5) * 160; m.vy = (random() - 0.5) * 160;
      }
    }
    if (e.type === 'finalboss') { state.victory = true; events |= EV_VICTORY | EV_BIG_EXPLOSION; state.shake = Math.max(state.shake, 16); }
    else if (e.type === 'boss') { events |= EV_BIG_EXPLOSION; state.shake = Math.max(state.shake, 11); }
    else events |= EV_EXPLOSION;
    return events;
  }

  function hurtPlayer(amount, events) {
    if (player.invuln > 0 || state.dead) return events;
    if (player.shield) {
      player.shield = false;
      player.invuln = 1.0;
      burst(player.x, player.y, '#7df9ff', 18, 260, 0.4);
      floater(player.x, player.y - 26, 'SHIELD DOWN', '#7df9ff');
      return events | EV_SHIELD;
    }
    player.hp -= amount;
    player.flash = 0.18;
    player.invuln = PLAYER.contactInvulnerable;
    state.shake = Math.max(state.shake, 7);
    burst(player.x, player.y, '#ff4d6d', 12, 220, 0.35);
    if (player.hp <= 0) {
      player.hp = 0;
      state.dead = true;
      burst(player.x, player.y, '#22e6ff', 46, 380, 0.8, 4);
      state.shake = 18;
      return events | EV_HURT | EV_GAMEOVER;
    }
    return events | EV_HURT;
  }

  function rollUpgrades() {
    const pool = UPGRADES.filter((u) => !(u.id === 'multishot' && player.multishot >= 4));
    const picks = [];
    const copy = [...pool];
    while (picks.length < 3 && copy.length > 0) {
      const idx = Math.floor(random() * copy.length);
      picks.push(copy.splice(idx, 1)[0]);
    }
    state.upgradeChoices = picks;
    return picks;
  }

  function applyUpgrade(id) {
    if (id === 'damage') player.damage *= 1.3;
    else if (id === 'firerate') player.fireInterval *= 0.78;
    else if (id === 'speed') player.speed *= 1.14;
    else if (id === 'maxhp') { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); }
    else if (id === 'dashcd') { player.dashCdMax *= 0.75; }
    else if (id === 'multishot') player.multishot = Math.min(4, player.multishot + 1);
    else if (id === 'magnet') player.magnetRadius *= 1.7;
    else if (id === 'shield') { player.shieldOwned = true; player.shield = true; }
  }

  function startWave(n) {
    state.wave = n;
    state.spawnQueue = buildWave(n);
    state.spawnTimer = 0.6;
    state.waveComplete = false;
    state.started = true;
    if (player.shieldOwned) player.shield = true;
  }

  function reset() {
    player.x = FIELD.width / 2; player.y = FIELD.height / 2; player.vx = 0; player.vy = 0;
    player.hp = PLAYER.maxHp; player.maxHp = PLAYER.maxHp;
    player.damage = PLAYER.damage; player.fireInterval = PLAYER.fireInterval;
    player.speed = PLAYER.speed; player.multishot = 1; player.magnetRadius = PLAYER.magnetRadius;
    player.dashCdMax = PLAYER.dashCooldown; player.dashCdTimer = 0; player.dashTimer = 0;
    player.invuln = 0; player.nova = 0; player.shield = false; player.shieldOwned = false;
    player.fireTimer = 0; player.muzzle = 0; player.flash = 0;
    state.wave = 0; state.score = 0; state.kills = 0; state.time = 0;
    state.enemies = []; state.bullets = []; state.ebullets = []; state.shards = [];
    state.particles = []; state.floaters = []; state.spawnQueue = [];
    state.shake = 0; state.waveComplete = false; state.victory = false; state.dead = false; state.started = false;
    state.upgradeChoices = [];
    makeStars();
  }

  function step(dt, input) {
    let events = 0;
    state.time += dt;
    const p = player;

    // --- dash & timers ---
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.dashCdTimer > 0) p.dashCdTimer = Math.max(0, p.dashCdTimer - dt);
    if (p.muzzle > 0) p.muzzle = Math.max(0, p.muzzle - dt);
    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 34);

    const wantsDash = input.dash && p.dashCdTimer <= 0 && p.dashTimer <= 0 && !state.dead;
    if (wantsDash) {
      p.dashTimer = PLAYER.dashTime;
      p.dashCdTimer = p.dashCdMax;
      p.invuln = Math.max(p.invuln, PLAYER.dashInvulnerable);
      events |= EV_DASH;
      burst(p.x, p.y, '#b26bff', 10, 160, 0.3, 2.5);
    }

    // --- movement ---
    let mx = input.mx; let my = input.my;
    if (p.dashTimer > 0) {
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      const dirx = (mx !== 0 || my !== 0) ? mx : Math.cos(p.aim);
      const diry = (mx !== 0 || my !== 0) ? my : Math.sin(p.aim);
      p.vx = dirx * PLAYER.dashSpeed; p.vy = diry * PLAYER.dashSpeed;
      state.particles.push({ type: 'spark', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.28, maxLife: 0.28, size: 9, color: 'rgba(34,230,255,0.5)' });
    } else {
      p.vx = mx * p.speed; p.vy = my * p.speed;
    }
    p.x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
    p.y = Math.min(FIELD.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));
    p.aim = Math.atan2(input.aimY - p.y, input.aimX - p.x);

    // --- firing ---
    if (p.fireTimer > 0) p.fireTimer = Math.max(0, p.fireTimer - dt);
    if (input.firing && p.fireTimer <= 0 && !state.dead) {
      p.fireTimer = p.fireInterval;
      p.muzzle = 0.05;
      const n = p.multishot;
      for (let i = 0; i < n; i += 1) {
        const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.085;
        const a = p.aim + off;
        state.bullets.push({ x: p.x + Math.cos(p.aim) * (p.radius + 6), y: p.y + Math.sin(p.aim) * (p.radius + 6), vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed, life: 0.9 });
      }
      events |= EV_SHOOT;
    }

    // --- nova blast ---
    if (input.nova && p.nova >= PLAYER.novaMax && !state.dead) {
      p.nova = 0;
      events |= EV_NOVA;
      state.shake = Math.max(state.shake, 10);
      state.particles.push({ type: 'ring', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.4, maxLife: 0.4, size: 6, color: '#ffe14d', r: 20, vr: PLAYER.novaRadius / 0.4 });
      for (const e of state.enemies) {
        if (dist2(e.x, e.y, p.x, p.y) <= PLAYER.novaRadius * PLAYER.novaRadius) {
          e.hp -= PLAYER.novaDamage;
          e.flash = 0.12;
          const a = Math.atan2(e.y - p.y, e.x - p.x);
          e.vx += Math.cos(a) * 320; e.vy += Math.sin(a) * 320;
          if (e.hp <= 0) events = killEnemy(e, events);
        }
      }
    }

    // --- spawning ---
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = 0.65;
        const type = state.spawnQueue.shift();
        const pt = spawnPoint();
        spawnEnemy(type, pt.x, pt.y);
      }
    }

    // --- enemies ---
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
      e.wobble += dt * 3;
      const def = ENEMIES[e.type];
      const dx = p.x - e.x; const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d; const uy = dy / d;
      let tx = 0; let ty = 0;
      if (e.type === 'shooter') {
        if (d > def.range + 30) { tx = ux; ty = uy; }
        else if (d < def.range - 70) { tx = -ux; ty = -uy; }
        else { tx = -uy * 0.6; ty = ux * 0.6; }
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && d < 460 && !state.dead) {
          e.fireTimer = def.fireInterval * (0.85 + random() * 0.3);
          state.ebullets.push({ x: e.x, y: e.y, vx: ux * def.bulletSpeed, vy: uy * def.bulletSpeed, life: 2.4, damage: 9 });
        }
      } else if (e.type === 'boss' || e.type === 'finalboss') {
        tx = ux; ty = uy;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && !state.dead) {
          e.fireTimer = def.fireInterval;
          const shots = e.type === 'finalboss' ? 8 : 6;
          const base = random() * TAU;
          for (let i = 0; i < shots; i += 1) {
            const a = base + (i / shots) * TAU;
            state.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * def.bulletSpeed, vy: Math.sin(a) * def.bulletSpeed, life: 2.6, damage: 12 });
          }
          state.ebullets.push({ x: e.x, y: e.y, vx: ux * (def.bulletSpeed + 60), vy: uy * (def.bulletSpeed + 60), life: 2.6, damage: 12 });
        }
        // Bosses call reinforcements as they lose quarters of their HP.
        const quarters = Math.floor((1 - e.hp / e.maxHp) * 4);
        if (quarters > e.addsSpawned) {
          e.addsSpawned = quarters;
          spawnEnemy('chaser', e.x + 70, e.y);
          spawnEnemy('speeder', e.x - 70, e.y + 40);
        }
      } else {
        tx = ux; ty = uy;
        if (e.type === 'tank') { tx = ux * 0.9; ty = uy * 0.9; }
      }
      e.vx += (tx * e.speed - e.vx) * Math.min(1, dt * 6);
      e.vy += (ty * e.speed - e.vy) * Math.min(1, dt * 6);
      e.x = Math.min(FIELD.width - e.radius, Math.max(e.radius, e.x + e.vx * dt));
      e.y = Math.min(FIELD.height - e.radius, Math.max(e.radius, e.y + e.vy * dt));
      // Contact with the player.
      if (!state.dead && dist2(e.x, e.y, p.x, p.y) < (e.radius + p.radius) * (e.radius + p.radius)) {
        events = hurtPlayer(e.damage, events);
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        e.vx += Math.cos(a) * 200; e.vy += Math.sin(a) * 200;
      }
    }
    state.enemies = state.enemies.filter((e) => !e.dead);

    // --- player bullets ---
    for (const b of state.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > FIELD.width || b.y < 0 || b.y > FIELD.height) { b.dead = true; continue; }
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (e.radius + 3) * (e.radius + 3)) {
          b.dead = true;
          e.hp -= p.damage;
          e.flash = 0.09;
          const a = Math.atan2(b.vy, b.vx);
          e.vx += Math.cos(a) * 60; e.vy += Math.sin(a) * 60;
          burst(b.x, b.y, e.color, 3, 150, 0.2, 2);
          events |= EV_HIT;
          if (e.hp <= 0) events = killEnemy(e, events);
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => !b.dead);
    state.enemies = state.enemies.filter((e) => !e.dead);

    // --- enemy bullets ---
    for (const b of state.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > FIELD.width || b.y < 0 || b.y > FIELD.height) { b.dead = true; continue; }
      if (!state.dead && dist2(b.x, b.y, p.x, p.y) < (p.radius + 4) * (p.radius + 4)) {
        b.dead = true;
        events = hurtPlayer(b.damage, events);
      }
    }
    state.ebullets = state.ebullets.filter((b) => !b.dead);

    // --- shards ---
    for (const s of state.shards) {
      s.life -= dt;
      const d2 = dist2(s.x, s.y, p.x, p.y);
      if (d2 < p.magnetRadius * p.magnetRadius) {
        const d = Math.sqrt(d2) || 1;
        const pull = 560 * (1 - Math.sqrt(d2) / p.magnetRadius) + 180;
        s.vx += ((p.x - s.x) / d) * pull * dt * 4;
        s.vy += ((p.y - s.y) / d) * pull * dt * 4;
      }
      s.vx *= 0.92; s.vy *= 0.92;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (!state.dead && d2 < (p.radius + 12) * (p.radius + 12)) {
        s.dead = true;
        state.score += SHARD.score;
        p.nova = Math.min(PLAYER.novaMax, p.nova + SHARD.novaCharge);
        events |= EV_PICKUP;
      }
    }
    state.shards = state.shards.filter((s) => !s.dead && s.life > 0);

    // --- particles & floaters ---
    for (const pt of state.particles) {
      pt.life -= dt;
      if (pt.type === 'ring') pt.r += pt.vr * dt;
      else { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy *= 0.94; }
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const f of state.floaters) { f.life -= dt; f.y += f.vy * dt; }
    state.floaters = state.floaters.filter((f) => f.life > 0);

    state.enemiesLeft = state.enemies.length + state.spawnQueue.length;

    // --- wave clear ---
    if (state.started && !state.waveComplete && !state.victory && !state.dead
        && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      state.waveComplete = true;
      state.score += 100 + state.wave * 25;
      // Breathing room between waves: a small hull patch on every clear.
      player.hp = Math.min(player.maxHp, player.hp + 10);
      events |= EV_WAVE_CLEAR;
    }
    return events;
  }

  reset();
  return { state, reset, startWave, step, applyUpgrade, rollUpgrades, spawnEnemy, burst, floater };
}
