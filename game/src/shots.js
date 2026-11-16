// Deterministic screenshot scenes behind ?shot=start|play|upgrade|end.
// Each scene builds its moment directly on a fresh world from the seeded
// generator, then advances the real simulation a fixed number of steps, so
// the same seed always renders the same frame — bullets in flight, muzzle
// flash, particles and all.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY } from './render.js';

const IDLE = { mx: 0, my: 0, aimX: 900, aimY: 260, firing: false, dash: false, nova: false };

function steps(world, count, input) {
  for (let i = 0; i < count; i += 1) world.step(STEP, input);
}

function scatterShards(world, count, cx, cy) {
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    world.state.shards.push({ x: cx + Math.cos(a) * (60 + (i % 3) * 36), y: cy + Math.sin(a) * (50 + (i % 4) * 22), vx: 0, vy: 0, life: 12 });
  }
}

function stageStart(world) {
  world.reset();
  const s = world.state;
  s.player.x = 640; s.player.y = 400;
  world.spawnEnemy('chaser', 210, 150);
  world.spawnEnemy('speeder', 1080, 170);
  world.spawnEnemy('splitter', 1010, 560);
  world.spawnEnemy('shooter', 240, 570);
  scatterShards(world, 6, 640, 300);
  steps(world, 24, IDLE);
  return { screen: SCREEN_TITLE, best: 0, hover: -1 };
}

function stagePlay(world) {
  world.reset();
  const s = world.state;
  s.wave = 3;
  s.score = 1240;
  s.player.x = 430; s.player.y = 440;
  s.player.hp = 72;
  s.player.nova = 64;
  world.spawnEnemy('chaser', 820, 300);
  world.spawnEnemy('chaser', 900, 430);
  world.spawnEnemy('speeder', 760, 190);
  world.spawnEnemy('tank', 1010, 520);
  world.spawnEnemy('shooter', 1060, 140);
  world.spawnEnemy('splitter', 660, 120);
  scatterShards(world, 7, 560, 300);
  world.burst(700, 330, '#ff4d6d', 10, 200, 0.4);
  const aim = { mx: 0.3, my: -0.2, aimX: 880, aimY: 290, firing: true, dash: false, nova: false };
  steps(world, 26, aim);
  s.enemiesLeft = s.enemies.length + s.spawnQueue.length;
  return { screen: SCREEN_PLAY, best: 1800, hover: -1 };
}

function stageUpgrade(world) {
  world.reset();
  const s = world.state;
  s.wave = 4;
  s.score = 2870;
  s.player.hp = 58;
  s.player.nova = 82;
  s.waveComplete = true;
  world.rollUpgrades();
  scatterShards(world, 5, 640, 560);
  steps(world, 6, IDLE);
  return { screen: SCREEN_UPGRADE, best: 2870, hover: 1 };
}

function stageEnd(world) {
  world.reset();
  const s = world.state;
  s.wave = 10;
  s.score = 9840;
  s.kills = 137;
  s.victory = true;
  s.player.x = 640; s.player.y = 380;
  s.player.hp = 41;
  s.player.nova = 30;
  s.player.shieldOwned = true; s.player.shield = true;
  world.burst(215, 165, '#2ee6a8', 22, 300, 1.6, 3.5);
  world.burst(1065, 165, '#ffe14d', 18, 260, 1.6, 3.5);
  world.burst(215, 565, '#ff2e97', 16, 240, 1.6, 3);
  world.burst(1065, 565, '#22e6ff', 16, 240, 1.6, 3);
  scatterShards(world, 8, 640, 400);
  steps(world, 4, IDLE);
  return { screen: SCREEN_VICTORY, best: 9840, hover: -1 };
}

/** Set `world` to the named scene and return what the renderer needs. */
export function stageShot(name, world) {
  if (name === 'play') return stagePlay(world);
  if (name === 'upgrade') return stageUpgrade(world);
  if (name === 'end') return stageEnd(world);
  return stageStart(world);
}

export { SCREEN_OVER };
