'use strict';
// Espacio de nombres global del juego
const RS = (window.RS = window.RS || {});

RS.util = {
  TAU: Math.PI * 2,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  },
  angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  fmtTime(s) {
    s = Math.max(0, Math.floor(s));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  },
  // Ruido determinista por celda (para decorar el mapa)
  hash(x, y) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  },
  // Elige n elementos distintos según su peso
  weightedSample(list, n) {
    const pool = list.slice();
    const out = [];
    while (out.length < n && pool.length) {
      const total = pool.reduce((a, o) => a + o.weight, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        r -= pool[idx].weight;
        if (r <= 0) break;
      }
      idx = Math.min(idx, pool.length - 1);
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return out;
  },
};

// Rejilla espacial para buscar enemigos cercanos rápido
RS.SpatialHash = class {
  constructor(cell) {
    this.cell = cell;
    this.map = new Map();
  }
  clear() {
    this.map.clear();
  }
  key(cx, cy) {
    return (cx + 50000) * 100000 + (cy + 50000);
  }
  insert(e) {
    const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
    let b = this.map.get(k);
    if (!b) {
      b = [];
      this.map.set(k, b);
    }
    b.push(e);
  }
  query(x, y, r, out) {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const b = this.map.get(this.key(cx, cy));
        if (b) for (let i = 0; i < b.length; i++) out.push(b[i]);
      }
    }
    return out;
  }
};

// Guardado persistente (oro, mejoras permanentes, récords)
RS.save = {
  KEY: 'riftSurvivors.save.v1',
  data: null,
  load() {
    try {
      this.data = JSON.parse(localStorage.getItem(this.KEY));
    } catch (e) {
      this.data = null;
    }
    if (!this.data || typeof this.data !== 'object') this.data = {};
    this.data.gold = this.data.gold || 0;
    this.data.upgrades = this.data.upgrades || {};
    this.data.best = this.data.best || {};
    this.data.runs = this.data.runs || 0;
    this.data.muted = !!this.data.muted;
    return this.data;
  },
  write() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch (e) {
      /* almacenamiento no disponible: se juega igual */
    }
  },
  up(id) {
    return this.data.upgrades[id] || 0;
  },
};

// Efectos de sonido sintetizados con WebAudio (sin archivos externos)
RS.audio = (function () {
  let ctx = null, master = null, muted = false;
  const last = {};

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.22;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type, vol, slide, delay) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq || 900;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  const sfx = {
    hit: () => tone(180 + Math.random() * 60, 0.05, 'square', 0.05, -80),
    shoot: () => tone(600, 0.06, 'triangle', 0.05, 300),
    slash: () => noise(0.08, 0.12, 2500),
    xp: () => tone(900 + Math.random() * 250, 0.05, 'sine', 0.06),
    coin: () => {
      tone(988, 0.06, 'square', 0.06);
      tone(1319, 0.1, 'square', 0.06, 0, 0.06);
    },
    levelup: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.22, 0, i * 0.07)),
    evolve: () => [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.12, 0, i * 0.06)),
    hurt: () => tone(160, 0.18, 'sawtooth', 0.18, -90),
    explode: () => noise(0.35, 0.35, 700),
    zap: () => tone(1400, 0.08, 'sawtooth', 0.06, -900),
    boss: () => {
      tone(80, 0.8, 'sawtooth', 0.25, -30);
      tone(120, 0.8, 'square', 0.12, -40, 0.1);
    },
    ult: () => {
      noise(0.5, 0.3, 1600);
      tone(220, 0.5, 'sawtooth', 0.2, 600);
    },
    flash: () => tone(500, 0.12, 'sine', 0.15, 1200),
    heal: () => [660, 880].forEach((f, i) => tone(f, 0.12, 'sine', 0.15, 0, i * 0.08)),
    chest: () => [523, 784, 1046, 1568].forEach((f, i) => tone(f, 0.2, 'triangle', 0.2, 0, i * 0.1)),
    click: () => tone(700, 0.04, 'square', 0.06),
  };

  return {
    ensure,
    play(name) {
      if (!ctx || muted || !sfx[name]) return;
      const now = performance.now();
      if (last[name] && now - last[name] < 45) return;
      last[name] = now;
      sfx[name]();
    },
    setMuted(m) {
      muted = !!m;
    },
    get muted() {
      return muted;
    },
  };
})();
