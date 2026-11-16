// Synthesized sound effects with the Web Audio API — no audio files.
// The context is created lazily on the first user gesture (browser autoplay
// rules); in screenshot mode nothing here ever runs. M toggles mute.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let lastShoot = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.32;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }

  function tone(freqA, freqB, duration, type, volume, delay = 0) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + duration + 0.02);
  }

  function noise(duration, volume, freq = 1200) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = freq;
    const gain = ctx.createGain(); gain.gain.value = volume;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t0);
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.32;
      return muted;
    },
    shoot() {
      const now = performance.now();
      if (now - lastShoot < 45) return; // throttle: full-auto fire would clip
      lastShoot = now;
      tone(880, 220, 0.07, 'square', 0.10);
    },
    enemyHit() { tone(300, 140, 0.05, 'triangle', 0.08); },
    explosion(big = false) { noise(big ? 0.45 : 0.22, big ? 0.5 : 0.28, big ? 700 : 1000); tone(big ? 160 : 200, 40, big ? 0.4 : 0.2, 'sine', 0.3); },
    pickup() { tone(660, 990, 0.08, 'sine', 0.12); },
    dash() { noise(0.14, 0.16, 2400); tone(240, 620, 0.12, 'sawtooth', 0.06); },
    nova() { tone(120, 900, 0.35, 'sawtooth', 0.22); noise(0.35, 0.3, 1600); },
    hurt() { tone(220, 70, 0.22, 'sawtooth', 0.26); noise(0.15, 0.2, 800); },
    shieldBreak() { tone(1200, 300, 0.18, 'triangle', 0.2); },
    waveClear() { tone(523, 523, 0.1, 'triangle', 0.16); tone(659, 659, 0.1, 'triangle', 0.16, 0.1); tone(784, 784, 0.16, 'triangle', 0.18, 0.2); },
    upgrade() { tone(440, 880, 0.18, 'triangle', 0.18); },
    gameOver() { tone(392, 392, 0.2, 'triangle', 0.2); tone(311, 311, 0.2, 'triangle', 0.2, 0.2); tone(233, 110, 0.5, 'triangle', 0.22, 0.4); },
    victory() { tone(523, 523, 0.12, 'triangle', 0.18); tone(659, 659, 0.12, 'triangle', 0.18, 0.12); tone(784, 784, 0.12, 'triangle', 0.18, 0.24); tone(1046, 1046, 0.3, 'triangle', 0.2, 0.36); },
  };
}
