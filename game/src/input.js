// Keyboard and mouse input for a twin-stick arena shooter.
// Held state (movement keys, mouse button) is read every step; one-shot
// presses (dash, nova, pause, mute, confirm, restart) are queued as bit
// flags and taken once by the loop, so a press between frames is never
// lost and never counted twice. Mouse position is reported in field
// coordinates through a converter the renderer installs.

export const ACTION_DASH = 1;
export const ACTION_NOVA = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;
export const ACTION_CONFIRM = 16;
export const ACTION_RESTART = 32;
export const ACTION_UPGRADE_1 = 64;
export const ACTION_UPGRADE_2 = 128;
export const ACTION_UPGRADE_3 = 256;

const KEYMAP = new Map([
  ['ShiftLeft', ACTION_DASH], ['ShiftRight', ACTION_DASH], ['Space', ACTION_DASH],
  ['KeyE', ACTION_NOVA],
  ['KeyP', ACTION_PAUSE], ['Escape', ACTION_PAUSE],
  ['KeyM', ACTION_MUTE],
  ['Enter', ACTION_CONFIRM],
  ['KeyR', ACTION_RESTART],
  ['Digit1', ACTION_UPGRADE_1], ['Digit2', ACTION_UPGRADE_2], ['Digit3', ACTION_UPGRADE_3],
]);

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let clicks = [];
  const mouse = { x: 640, y: 300, down: false };
  let toField = (clientX, clientY) => ({ x: clientX, y: clientY });

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    const flag = KEYMAP.get(event.code);
    if (flag !== undefined) {
      if (!event.repeat) actions |= flag;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });

  canvas.addEventListener('pointermove', (event) => {
    const p = toField(event.clientX, event.clientY);
    mouse.x = p.x; mouse.y = p.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      const p = toField(event.clientX, event.clientY);
      mouse.x = p.x; mouse.y = p.y;
      clicks.push({ x: p.x, y: p.y });
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('pointerup', (event) => { if (event.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    /** Install the client→field coordinate converter (from the renderer). */
    setConverter(fn) { toField = fn; },
    /** Movement vector from held keys, normalised, in field units. */
    moveVector() {
      let x = 0; let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { const inv = Math.SQRT1_2; x *= inv; y *= inv; }
      return { x, y };
    },
    takeActions() { const taken = actions; actions = 0; return taken; },
    takeClicks() { const taken = clicks; clicks = []; return taken; },
  };
}
