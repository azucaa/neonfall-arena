// NEONFALL ARENA — boot and the one loop.
// Input is read every frame, the world advances in fixed 1/60 s steps, and
// the renderer paints what is there. Screens: title, play, paused, upgrade,
// victory and game over.
// ?seed=N fixes the random pattern. ?shot=start|play|upgrade|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP, TOTAL_WAVES } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EV_BIG_EXPLOSION, EV_DASH, EV_EXPLOSION, EV_GAMEOVER, EV_HIT,
  EV_HURT, EV_NOVA, EV_PICKUP, EV_SHIELD, EV_SHOOT, EV_VICTORY, EV_WAVE_CLEAR,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_NOVA, ACTION_PAUSE,
  ACTION_RESTART, ACTION_UPGRADE_1, ACTION_UPGRADE_2, ACTION_UPGRADE_3, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  SCREEN_UPGRADE, SCREEN_VICTORY, upgradeCardRect,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* private window */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.hover);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  input.setConverter((x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let pendingDash = false;
  let pendingNova = false;
  let hover = -1;

  function announce(message) { status.textContent = message; }

  function startGame() {
    audio.unlock();
    world.reset();
    world.startWave(1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Wave 1. Survive all 10 waves.');
  }

  function finishRun(won) {
    if (world.state.score > best) { best = world.state.score; saveBest(best); }
    screen = won ? SCREEN_VICTORY : SCREEN_OVER;
    announce(won ? `Victory. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Wave ${world.state.wave}.`);
  }

  function chooseUpgrade(index) {
    const choice = world.state.upgradeChoices[index];
    if (!choice) return;
    world.applyUpgrade(choice.id);
    audio.upgrade();
    world.startWave(world.state.wave + 1);
    screen = SCREEN_PLAY;
    announce(`Upgrade ${choice.name}. Wave ${world.state.wave} of ${TOTAL_WAVES}.`);
  }

  function playSounds(events) {
    if (events & EV_SHOOT) audio.shoot();
    if (events & EV_HIT) audio.enemyHit();
    if (events & EV_EXPLOSION) audio.explosion(false);
    if (events & EV_BIG_EXPLOSION) audio.explosion(true);
    if (events & EV_PICKUP) audio.pickup();
    if (events & EV_DASH) audio.dash();
    if (events & EV_NOVA) audio.nova();
    if (events & EV_HURT) audio.hurt();
    if (events & EV_SHIELD) audio.shieldBreak();
  }

  function handleActions() {
    const actions = input.takeActions();
    const clicks = input.takeClicks();
    if (actions & ACTION_MUTE) announce(audio.toggleMute() ? 'Muted.' : 'Sound on.');
    if (actions & ACTION_DASH) pendingDash = true;
    if (actions & ACTION_NOVA) pendingNova = true;

    if (screen === SCREEN_TITLE) {
      if ((actions & (ACTION_CONFIRM | ACTION_DASH)) || clicks.length > 0) startGame();
      return;
    }
    if (screen === SCREEN_VICTORY || screen === SCREEN_OVER) {
      if ((actions & (ACTION_RESTART | ACTION_CONFIRM | ACTION_DASH)) || clicks.length > 0) startGame();
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_UPGRADE_1) chooseUpgrade(0);
      else if (actions & ACTION_UPGRADE_2) chooseUpgrade(1);
      else if (actions & ACTION_UPGRADE_3) chooseUpgrade(2);
      else {
        for (const click of clicks) {
          for (let i = 0; i < 3; i += 1) {
            const r = upgradeCardRect(i);
            if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) { chooseUpgrade(i); break; }
          }
          if (screen !== SCREEN_UPGRADE) break;
        }
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
      return;
    }
    if ((actions & ACTION_RESTART) && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) startGame();
  }

  function updateHover() {
    hover = -1;
    if (screen !== SCREEN_UPGRADE) return;
    for (let i = 0; i < 3; i += 1) {
      const r = upgradeCardRect(i);
      if (input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h) { hover = i; break; }
    }
  }

  function stepWorld() {
    if (screen === SCREEN_TITLE) {
      // Calm backdrop: the ship idles, stars drift, nothing can hurt it.
      world.step(STEP, { mx: 0, my: 0, aimX: world.state.player.x + 200, aimY: world.state.player.y - 120, firing: false, dash: false, nova: false });
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.moveVector();
    const events = world.step(STEP, {
      mx: move.x, my: move.y,
      aimX: input.mouse.x, aimY: input.mouse.y,
      firing: input.mouse.down,
      dash: pendingDash, nova: pendingNova,
    });
    pendingDash = false;
    pendingNova = false;
    playSounds(events);
    if (events & EV_GAMEOVER) { audio.gameOver(); finishRun(false); }
    else if (events & EV_VICTORY) { audio.victory(); finishRun(true); }
    else if (events & EV_WAVE_CLEAR) {
      audio.waveClear();
      world.rollUpgrades();
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.state.wave} cleared. Choose an upgrade.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    updateHover();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepWorld();
        accumulator -= STEP;
      }
    } else accumulator = 0;
    renderer.draw(world.state, screen, best, hover);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });

  announce('Neonfall Arena. Click or press Enter to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
