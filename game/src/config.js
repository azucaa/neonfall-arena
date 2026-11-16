// NEONFALL ARENA — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical arena; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 265,
  maxHp: 100,
  damage: 12,
  fireInterval: 0.16, // seconds between shots
  bulletSpeed: 720,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 2.2,
  dashInvulnerable: 0.32,
  novaMax: 100,
  novaDamage: 90,
  novaRadius: 300,
  magnetRadius: 90,
  contactInvulnerable: 0.6,
};

export const TOTAL_WAVES = 10;
export const BOSS_WAVE = 5;
export const FINAL_WAVE = 10;

/** Enemy archetypes. hp/speed/damage are base values, scaled per wave in world.js. */
export const ENEMIES = {
  chaser:   { radius: 15, hp: 30,  speed: 105, damage: 10, score: 50,  shards: 1, color: '#ff4d6d' },
  speeder:  { radius: 11, hp: 16,  speed: 195, damage: 8,  score: 70,  shards: 1, color: '#ffb020' },
  tank:     { radius: 26, hp: 130, speed: 52,  damage: 18, score: 150, shards: 3, color: '#b26bff' },
  shooter:  { radius: 14, hp: 36,  speed: 88,  damage: 8,  score: 110, shards: 2, color: '#2ee6a8', range: 300, fireInterval: 1.7, bulletSpeed: 300 },
  splitter: { radius: 19, hp: 48,  speed: 78,  damage: 10, score: 90,  shards: 2, color: '#ff7ad9' },
  mini:     { radius: 9,  hp: 10,  speed: 165, damage: 6,  score: 25,  shards: 0, color: '#ffa3e8' },
  boss:     { radius: 44, hp: 820,  speed: 62, damage: 20, score: 1500, shards: 10, color: '#ff2e63', fireInterval: 1.25, bulletSpeed: 258 },
  finalboss:{ radius: 58, hp: 1850, speed: 54, damage: 26, score: 4000, shards: 16, color: '#ff3860', fireInterval: 1.0, bulletSpeed: 288 },
};

export const SHARD = { score: 15, novaCharge: 9, radius: 6, life: 14 };

/** The upgrade pool. `apply` names are resolved in world.js. */
export const UPGRADES = [
  { id: 'damage',   name: 'OVERCHARGE',      desc: '+30% bullet damage',        color: '#ff4d6d' },
  { id: 'firerate', name: 'RAPID CYCLER',    desc: 'Fire 22% faster',           color: '#ffb020' },
  { id: 'speed',    name: 'ION THRUSTERS',   desc: '+14% move speed',           color: '#39c2ff' },
  { id: 'maxhp',    name: 'REINFORCED HULL', desc: '+25 max HP and heal 25',    color: '#2ee6a8' },
  { id: 'dashcd',   name: 'PHASE COILS',     desc: 'Dash recharges 25% faster', color: '#b26bff' },
  { id: 'multishot',name: 'SPLIT CANNON',    desc: '+1 projectile per shot',    color: '#ff7ad9' },
  { id: 'magnet',   name: 'TRACTOR FIELD',   desc: '+70% shard magnet radius',  color: '#ffe14d' },
  { id: 'shield',   name: 'AEGIS SHIELD',    desc: 'Shield blocks one hit, recharges each wave', color: '#7df9ff' },
];

/** Upgrade card layout, shared by render.js (drawing) and main.js (clicks). */
export const UPGRADE_LAYOUT = { cardW: 300, cardH: 220, gap: 36, top: 268 };

export const PALETTE = {
  backdrop: '#04050c',
  arena: '#070a18',
  grid: 'rgba(70,90,180,0.13)',
  wall: '#1d2a52',
  text: '#eef4ff',
  muted: '#8fa3c8',
  cyan: '#22e6ff',
  magenta: '#ff2e97',
  player: '#22e6ff',
  hp: '#2ee6a8',
  hpLow: '#ff4d6d',
  nova: '#ffe14d',
  dash: '#b26bff',
  panel: 'rgba(10,14,32,0.92)',
  panelEdge: '#2a3a75',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

export const BEST_KEY = 'neonfall-arena.best';
