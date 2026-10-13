'use strict';
// Motor principal: simulación de la partida y renderizado en canvas.
RS.Game = (function () {
  const U = RS.util, D = RS.data, TAU = Math.PI * 2;
  const MAXR = 80; // margen para el radio de los enemigos más grandes
  const hash = new RS.SpatialHash(64);
  const sepCand = [];
  const projCand = [];

  let g = null;
  let canvas = null, ctx = null;
  let W = 800, H = 600, DPR = 1, zoom = 1;
  const hooks = {};
  const hud = { ult: null, flash: null, pause: null };

  // ------------------------------------------------------------------
  // API que usan las habilidades (weapons.js)
  // ------------------------------------------------------------------
  const G = {
    get state() {
      return g;
    },
    nearest,
    forEnemiesIn,
    damage: damageEnemy,
    addProj(p) {
      p.id = g.idSeq++;
      p.hitSet = new Set();
      g.projs.push(p);
    },
    addEffect(e) {
      e.t = 0;
      g.effects.push(e);
    },
    addZone(z) {
      g.zones.push(z);
    },
    addTelegraph(t) {
      t.t = 0;
      g.tgs.push(t);
    },
    randomEnemyNear,
    sfx: (n) => RS.audio.play(n),
    shake(v) {
      g.shake = Math.max(g.shake, v);
    },
    particles,
  };

  const xpFor = (lvl) => Math.floor(5 + (lvl - 1) * 7 + Math.pow(lvl - 1, 1.45));
  const viewW = () => W / zoom;
  const viewH = () => H / zoom;
  const spawnR = () => Math.hypot(viewW(), viewH()) / 2 + 40;

  // ------------------------------------------------------------------
  // Inicio de partida y estadísticas
  // ------------------------------------------------------------------
  function newRun(champId) {
    const ch = D.CHAMPIONS[champId];
    g = {
      champ: ch, time: 0, kills: 0, gold: 0, level: 1, xp: 0, xpNext: xpFor(1), pending: 0,
      player: { x: 0, y: 0, r: 15, dirX: 1, dirY: 0, face: 1, moving: false, hp: 1, iframes: 0, ultCd: 0, flashCd: 0, shield: 0 },
      stats: null, weapons: [], items: [],
      enemies: [], bosses: [], projs: [], eprojs: [], zones: [], tgs: [], effects: [], gems: [], pickups: [], texts: [], parts: [], toasts: [],
      spawnAcc: 0, bossIdx: 0, nextEvent: 90, eventN: 0,
      rerolls: RS.save.up('reroll'), revives: RS.save.up('revive'),
      shake: 0, hurtT: 0, ult: null, over: false, won: false, idSeq: 1, gemMerge: 0, evolutions: 0, damageDealt: 0,
    };
    recompute();
    g.player.hp = g.stats.maxHp;
    addWeapon(ch.start);
    toast('Sobrevive 15:00 y derrota al Leviatán', '#c8aa6e');
    return g;
  }

  function recompute() {
    const ch = g.champ, up = (k) => RS.save.up(k);
    const s = {
      maxHp: ch.hp + 10 * up('hp'),
      speed: ch.speed * (1 + 0.05 * up('speed')),
      armor: ch.armor + up('armor'),
      might: 1 + 0.05 * up('might'),
      area: 1,
      cdMult: 1 - 0.03 * up('cooldown'),
      amount: 0,
      duration: 1,
      magnet: 100 * (1 + 0.15 * up('magnet')),
      regen: ch.regen,
      growth: 1 + 0.05 * up('growth'),
      greed: 1 + 0.1 * up('greed'),
      crit: 0.05,
      projSpeed: 1,
    };
    ch.mod(s);
    for (const it of g.items) D.ITEMS[it.id].apply(s, it.level);
    s.cdMult = Math.max(0.35, s.cdMult);
    if (g.stats) {
      const diff = s.maxHp - g.stats.maxHp;
      if (diff > 0) g.player.hp += diff;
    }
    g.stats = s;
    g.player.hp = Math.min(g.player.hp, s.maxHp);
  }

  function addWeapon(id) {
    g.weapons.push({ id, level: 1, evolved: false, timer: 0.3 });
  }

  // ------------------------------------------------------------------
  // Mejoras al subir de nivel
  // ------------------------------------------------------------------
  function buildChoices(n) {
    const opts = [];
    for (const w of g.weapons) {
      const d = D.WEAPONS[w.id];
      if (w.evolved) continue;
      if (w.level >= d.lv.length) {
        if (g.items.some((i) => i.id === d.evo.item)) opts.push({ kind: 'evo', id: w.id, weight: 1000 });
      } else opts.push({ kind: 'weapon', id: w.id, weight: 12 });
    }
    if (g.weapons.length < D.MAX_SLOTS) {
      for (const id in D.WEAPONS) if (!g.weapons.some((w) => w.id === id)) opts.push({ kind: 'weapon', id, isNew: true, weight: 6 });
    }
    for (const it of g.items) if (it.level < D.ITEMS[it.id].max) opts.push({ kind: 'item', id: it.id, weight: 10 });
    if (g.items.length < D.MAX_SLOTS) {
      for (const id in D.ITEMS) if (!g.items.some((i) => i.id === id)) opts.push({ kind: 'item', id, isNew: true, weight: 5 });
    }
    const picks = U.weightedSample(opts, n);
    if (!picks.length) return [{ kind: 'heal' }, { kind: 'gold' }];
    return picks;
  }

  function describe(c) {
    if (c.kind === 'weapon') {
      const d = D.WEAPONS[c.id];
      const w = g.weapons.find((x) => x.id === c.id);
      if (!w) return { icon: d.icon, color: d.color, name: d.name, tag: 'Nueva habilidad', desc: d.desc };
      return { icon: d.icon, color: d.color, name: d.name, tag: 'Nv ' + (w.level + 1), desc: d.ups[w.level] };
    }
    if (c.kind === 'evo') {
      const d = D.WEAPONS[c.id];
      return { icon: d.icon, color: '#ffd54f', name: d.evo.name, tag: 'Evolución', desc: d.evo.desc + ' (' + d.name + ' + ' + D.ITEMS[d.evo.item].name + ')', evo: true };
    }
    if (c.kind === 'item') {
      const d = D.ITEMS[c.id];
      const it = g.items.find((x) => x.id === c.id);
      if (!it) return { icon: d.icon, color: d.color, name: d.name, tag: 'Nuevo objeto', desc: d.desc };
      return { icon: d.icon, color: d.color, name: d.name, tag: 'Nv ' + (it.level + 1), desc: d.desc };
    }
    if (c.kind === 'heal') return { icon: '✚', color: '#ef5350', name: 'Poción de vida', tag: 'Consumible', desc: 'Recupera el 50% de la vida máxima.' };
    return { icon: '◆', color: '#ffd54f', name: 'Bolsa de oro', tag: 'Consumible', desc: '+30 de oro.' };
  }

  function applyChoice(c) {
    if (c.kind === 'weapon') {
      const w = g.weapons.find((x) => x.id === c.id);
      if (w) w.level++;
      else addWeapon(c.id);
    } else if (c.kind === 'evo') {
      const w = g.weapons.find((x) => x.id === c.id);
      w.evolved = true;
      w.timer = 0;
      w.active = 0;
      g.evolutions++;
      toast('¡' + D.WEAPONS[c.id].evo.name + '!', '#ffd54f');
      RS.audio.play('evolve');
      G.addEffect({ type: 'ring', x: g.player.x, y: g.player.y, r: 160, life: 0.6, color: '#ffd54f', width: 8, follow: true });
    } else if (c.kind === 'item') {
      const it = g.items.find((x) => x.id === c.id);
      if (it) it.level++;
      else g.items.push({ id: c.id, level: 1 });
      recompute();
    } else if (c.kind === 'heal') {
      healPlayer(g.stats.maxHp * 0.5);
    } else if (c.kind === 'gold') {
      g.gold += 30;
    }
  }

  function gainXp(v) {
    g.xp += v * g.stats.growth;
    while (g.xp >= g.xpNext) {
      g.xp -= g.xpNext;
      g.level++;
      g.xpNext = xpFor(g.level);
      g.pending++;
      if (g.level === D.ULT_LEVEL) toast('¡Definitiva desbloqueada! Pulsa R', '#4fd1ff');
    }
  }

  // ------------------------------------------------------------------
  // Utilidades sobre enemigos
  // ------------------------------------------------------------------
  function nearest(x, y, maxR, exclude) {
    let best = null, bd = maxR * maxR;
    for (const e of g.enemies) {
      if (e.dead || (exclude && exclude.has(e))) continue;
      const d = U.dist2(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  function randomEnemyNear(r) {
    const p = g.player, r2 = r * r, list = [];
    for (const e of g.enemies) if (!e.dead && U.dist2(p.x, p.y, e.x, e.y) < r2) list.push(e);
    return list.length ? U.choice(list) : null;
  }

  function forEnemiesIn(x, y, r, fn) {
    const list = hash.query(x, y, r + MAXR, []);
    for (const e of list) {
      if (e.dead) continue;
      const rr = r + e.r;
      if (U.dist2(x, y, e.x, e.y) <= rr * rr) fn(e);
    }
  }

  function damageEnemy(e, amount, o) {
    if (e.dead) return;
    o = o || {};
    let dmg = amount * U.rand(0.9, 1.1);
    let crit = false;
    if (Math.random() < g.stats.crit) {
      dmg *= 2;
      crit = true;
    }
    e.hp -= dmg;
    e.flash = 0.08;
    g.damageDealt += dmg;
    if (o.knock && o.fx !== undefined) {
      const kb = (e.boss ? 0.04 : 1) * (e.heavy ? 0.4 : 1);
      const dx = e.x - o.fx, dy = e.y - o.fy;
      const d = Math.hypot(dx, dy) || 1;
      e.kx += (dx / d) * o.knock * kb;
      e.ky += (dy / d) * o.knock * kb;
    }
    if (o.stun) e.stun = Math.max(e.stun, e.boss ? o.stun * 0.15 : o.stun);
    addText(e.x + U.rand(-6, 6), e.y - e.r, Math.round(dmg), crit ? '#ffd54f' : o.color || '#ffffff', crit ? 17 : 12);
    RS.audio.play('hit');
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true;
    g.kills++;
    particles(e.x, e.y, e.boss ? 50 : 5, e.color, e.boss ? 320 : 120);
    if (e.boss) {
      g.bosses = g.bosses.filter((b) => b !== e);
      G.shake(10);
      RS.audio.play('explode');
      if (e.final) {
        toast('¡Has derrotado al ' + e.name + '!', '#ffd54f');
        endRun(true);
        return;
      }
      dropGem(e.x, e.y, e.xp);
      g.pickups.push({ type: 'chest', x: e.x, y: e.y, sp: 0 });
      toast('¡' + e.name + ' derrotado! Recoge el cofre', '#ffd54f');
      return;
    }
    dropGem(e.x, e.y, e.xp);
    const r = Math.random();
    if (e.heavy) g.pickups.push({ type: 'gold', x: e.x + 8, y: e.y, v: 5, sp: 0 });
    else if (r < 0.1) g.pickups.push({ type: 'gold', x: e.x, y: e.y, v: U.randInt(1, 2), sp: 0 });
    else if (r < 0.104) g.pickups.push({ type: 'potion', x: e.x, y: e.y, sp: 0 });
    else if (r < 0.1055) g.pickups.push({ type: 'magnet', x: e.x, y: e.y, sp: 0 });
  }

  function dropGem(x, y, v) {
    if (g.gems.length >= 450) {
      g.gems[g.gemMerge++ % g.gems.length].v += v;
      return;
    }
    g.gems.push({ x: x + U.rand(-4, 4), y: y + U.rand(-4, 4), v, pull: false, sp: 0 });
  }

  // ------------------------------------------------------------------
  // Generación de enemigos y jefes
  // ------------------------------------------------------------------
  function hpMult() {
    const m = g.time / 60;
    return 1 + m * 0.3 + m * m * 0.02;
  }

  function ringPos(r) {
    const p = g.player;
    let a;
    if (p.moving && Math.random() < 0.6) a = Math.atan2(p.dirY, p.dirX) + U.rand(-1.4, 1.4);
    else a = Math.random() * TAU;
    return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
  }

  function spawnEnemy(type, x, y) {
    const d = D.ENEMIES[type];
    if (x === undefined) {
      const pos = ringPos(spawnR());
      x = pos.x;
      y = pos.y;
    }
    const m = g.time / 60;
    const hp = d.hp * hpMult();
    const e = {
      type, x, y, r: d.r, hp, maxHp: hp, speed: d.speed * U.rand(0.9, 1.1), dmg: d.dmg * (1 + m * 0.08), xp: d.xp,
      color: d.color, kx: 0, ky: 0, flash: 0, stun: 0, slowT: 0, slowF: 0, hits: {}, anim: Math.random() * 10,
      ranged: d.ranged, shootT: U.rand(1, 3), dead: false, face: 1, heavy: type === 'golem' || type === 'brute' || type === 'siege',
    };
    g.enemies.push(e);
    return e;
  }

  function spawnBoss(def) {
    const pos = ringPos(spawnR() - 60);
    const hp = def.hp;
    const b = {
      boss: true, type: def.type, name: def.name, x: pos.x, y: pos.y, r: def.r, hp, maxHp: hp, speed: def.speed, dmg: def.dmg,
      xp: def.xp, color: def.color, final: !!def.final, kx: 0, ky: 0, flash: 0, stun: 0, slowT: 0, slowF: 0, hits: {},
      anim: 0, dead: false, face: 1, ai: { a: 2.5, b: 4, c: 6, d: 9 }, dash: 0, windup: 0, spiral: 0, spiralT: 0, spiralA: 0,
    };
    g.enemies.push(b);
    g.bosses.push(b);
    toast('¡' + def.name + ' ha aparecido!', '#ff5c5c');
    RS.audio.play('boss');
    G.shake(8);
  }

  function pickType() {
    const m = g.time / 60;
    const pool = [{ id: 'melee', weight: m < 6 ? 10 : 5 }];
    if (m >= 0.5) pool.push({ id: 'caster', weight: 4 });
    if (m >= 1.5) pool.push({ id: 'wolf', weight: 6 });
    if (m >= 3) pool.push({ id: 'siege', weight: 2.5 });
    if (m >= 4.5) pool.push({ id: 'wraith', weight: 6 });
    if (m >= 6) pool.push({ id: 'golem', weight: 2 });
    if (m >= 9) pool.push({ id: 'brute', weight: 2 });
    return U.weightedSample(pool, 1)[0].id;
  }

  function waveEvent() {
    const p = g.player, m = g.time / 60;
    g.eventN++;
    if (g.eventN % 2 === 1) {
      const n = Math.floor(22 + m * 3);
      const r = spawnR() * 0.85;
      const type = m > 7 ? 'wraith' : 'melee';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        spawnEnemy(type, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      }
      toast('¡Oleada de súbditos!', '#c792ff');
    } else {
      const n = Math.floor(10 + m * 2);
      const a = Math.random() * TAU;
      const r = spawnR();
      for (let i = 0; i < n; i++) {
        spawnEnemy('wolf', p.x + Math.cos(a) * r + U.rand(-70, 70), p.y + Math.sin(a) * r + U.rand(-70, 70));
      }
      toast('¡Una manada de lobos se acerca!', '#9fb3c8');
    }
  }

  function spawnUpdate(dt) {
    const m = g.time / 60;
    const nb = D.BOSSES[g.bossIdx];
    if (nb && g.time >= nb.at) {
      spawnBoss(nb);
      g.bossIdx++;
    }
    const rate = Math.min(14, 0.9 + m * 0.95) * (g.bosses.length ? 0.6 : 1);
    g.spawnAcc += rate * dt;
    while (g.spawnAcc >= 1) {
      g.spawnAcc -= 1;
      if (g.enemies.length < 360) spawnEnemy(pickType());
    }
    if (g.time >= g.nextEvent) {
      waveEvent();
      g.nextEvent += 60;
    }
  }

  // ------------------------------------------------------------------
  // IA de jefes
  // ------------------------------------------------------------------
  function shootAt(x, y, a, speed, dmg, color, r) {
    g.eprojs.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: r || 8, dmg, life: 5, color });
  }
  function ring(b, n, speed, color) {
    const off = Math.random() * TAU;
    for (let i = 0; i < n; i++) shootAt(b.x, b.y, off + (i / n) * TAU, speed, b.dmg * 0.6, color, 9);
  }
  function aimed(b, n, spread, speed, color) {
    const p = g.player;
    const base = Math.atan2(p.y - b.y, p.x - b.x);
    for (let i = 0; i < n; i++) shootAt(b.x, b.y, base + (i - (n - 1) / 2) * spread, speed, b.dmg * 0.6, color, 8);
  }
  function slam(x, y, r, dmg, delay) {
    G.addTelegraph({
      x, y, r, delay, friendly: false, color: '#ff4040',
      onDone(tg) {
        const p = g.player;
        if (U.dist2(p.x, p.y, tg.x, tg.y) < (tg.r + p.r) * (tg.r + p.r)) hurtPlayer(dmg);
        G.addEffect({ type: 'explosion', x: tg.x, y: tg.y, r: tg.r, life: 0.35, color: '#b0a089' });
        particles(tg.x, tg.y, 12, '#a1887f', 220);
        G.shake(5);
        RS.audio.play('explode');
      },
    });
  }
  function startDash(b) {
    const p = g.player;
    b.windup = 0.75;
    b.dashA = Math.atan2(p.y - b.y, p.x - b.x);
    G.addEffect({ type: 'line', x: b.x, y: b.y, a: b.dashA, len: 650 * 0.55 + b.r, w: b.r * 1.6, life: 0.75, color: '#ff2d55' });
  }

  // Devuelve true si el jefe controla su movimiento este frame
  function bossAI(b, dt) {
    const p = g.player;
    b.enraged = b.hp < b.maxHp * 0.5;
    const k = b.enraged ? 1.3 : 1;
    if (b.dash > 0) {
      b.dash -= dt;
      b.x += Math.cos(b.dashA) * 650 * dt;
      b.y += Math.sin(b.dashA) * 650 * dt;
      b.charging = true;
      if (Math.random() < 0.5) particles(b.x, b.y, 1, b.color, 60);
      return true;
    }
    if (b.windup > 0) {
      b.windup -= dt;
      b.charging = true;
      if (b.windup <= 0) b.dash = 0.55;
      return true;
    }
    b.charging = false;
    const ai = b.ai;
    ai.a -= dt * k;
    ai.b -= dt * k;
    ai.c -= dt * k;
    ai.d -= dt * k;
    switch (b.type) {
      case 'drake':
      case 'elder': {
        const elder = b.type === 'elder';
        const col = elder ? '#7ff6e8' : '#ff7a3c';
        if (ai.a <= 0) {
          ai.a = elder ? 2.4 : 3;
          ring(b, elder ? 16 : 12, 185, col);
          RS.audio.play('shoot');
        }
        if (ai.b <= 0) {
          ai.b = elder ? 1.2 : 1.7;
          aimed(b, 3, 0.22, 240, col);
        }
        if (elder && ai.c <= 0) {
          ai.c = 6;
          b.spiral = 1.6;
        }
        if (b.spiral > 0) {
          b.spiral -= dt;
          b.spiralT -= dt;
          if (b.spiralT <= 0) {
            b.spiralT = 0.07;
            b.spiralA += 0.45;
            for (let i = 0; i < 3; i++) shootAt(b.x, b.y, b.spiralA + (i * TAU) / 3, 200, b.dmg * 0.5, col, 7);
          }
        }
        break;
      }
      case 'herald':
        if (ai.a <= 0) {
          ai.a = 3.6;
          startDash(b);
        }
        if (ai.b <= 0) {
          ai.b = 5;
          ring(b, 10, 160, '#c040ff');
        }
        break;
      case 'colossus':
        if (ai.a <= 0) {
          ai.a = 3.2;
          slam(p.x, p.y, 110, b.dmg * 1.2, 1.0);
        }
        if (ai.b <= 0) {
          ai.b = 8;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            spawnEnemy('golem', b.x + Math.cos(a) * 90, b.y + Math.sin(a) * 90);
          }
        }
        break;
      case 'leviathan':
      default:
        if (ai.a <= 0) {
          ai.a = 3;
          ring(b, b.enraged ? 24 : 18, 175, '#ff7ad9');
        }
        if (ai.b <= 0) {
          ai.b = 5.5;
          startDash(b);
        }
        if (ai.c <= 0) {
          ai.c = 6;
          for (let i = 0; i < 3; i++) slam(p.x + U.rand(-120, 120), p.y + U.rand(-120, 120), 100, b.dmg, 1.0 + i * 0.25);
        }
        if (ai.d <= 0) {
          ai.d = 10;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            spawnEnemy('brute', b.x + Math.cos(a) * 110, b.y + Math.sin(a) * 110);
          }
        }
        break;
    }
    return false;
  }

  // ------------------------------------------------------------------
  // Jugador
  // ------------------------------------------------------------------
  function healPlayer(v) {
    const p = g.player;
    const before = p.hp;
    p.hp = Math.min(g.stats.maxHp, p.hp + v);
    if (p.hp - before >= 1) addText(p.x, p.y - 26, '+' + Math.round(p.hp - before), '#69f0ae', 13);
  }

  function hurtPlayer(dmg) {
    const p = g.player;
    if (p.iframes > 0 || g.over) return;
    let d = Math.max(1, dmg - g.stats.armor);
    if (g.ult && g.ult.id === 'dawn') d *= 0.5;
    if (p.shield > 0) {
      const a = Math.min(p.shield, d);
      p.shield -= a;
      d -= a;
    }
    p.hp -= d;
    p.iframes = 0.5;
    g.hurtT = 0.3;
    G.shake(3);
    RS.audio.play('hurt');
    if (d > 0) addText(p.x, p.y - 24, '-' + Math.round(d), '#ff5252', 15);
    if (p.hp <= 0) {
      if (g.revives > 0) {
        g.revives--;
        p.hp = g.stats.maxHp;
        p.iframes = 2.5;
        forEnemiesIn(p.x, p.y, 380, (e) => damageEnemy(e, e.boss ? 200 : 9999, { fx: p.x, fy: p.y, knock: 500 }));
        G.addEffect({ type: 'ring', x: p.x, y: p.y, r: 380, life: 0.7, color: '#fff59d', width: 12, follow: true });
        toast('¡Ángel Guardián! Has revivido', '#fff59d');
        RS.audio.play('heal');
      } else {
        p.hp = 0;
        endRun(false);
      }
    }
  }

  function tryFlash() {
    const p = g.player;
    if (p.flashCd > 0) return;
    const d = 170;
    particles(p.x, p.y, 14, '#ffe57f', 160);
    p.x += p.dirX * d;
    p.y += p.dirY * d;
    particles(p.x, p.y, 14, '#ffe57f', 160);
    G.addEffect({ type: 'ring', x: p.x, y: p.y, r: 40, life: 0.25, color: '#ffe57f', width: 4 });
    p.flashCd = 18;
    p.iframes = Math.max(p.iframes, 0.3);
    RS.audio.play('flash');
  }

  function tryUlt() {
    const p = g.player, s = g.stats;
    if (g.level < D.ULT_LEVEL) {
      toast('La definitiva se desbloquea en el nivel ' + D.ULT_LEVEL, '#9fb3c8');
      return;
    }
    if (p.ultCd > 0) return;
    p.ultCd = 50 * s.cdMult;
    const id = g.champ.ult.id;
    RS.audio.play('ult');
    toast(g.champ.ult.name + '!', g.champ.color);
    if (id === 'dawn') g.ult = { id, t: 3, tick: 0, ang: 0 };
    else if (id === 'nova') g.ult = { id, t: 0.7, max: 0.7 };
    else if (id === 'volley') g.ult = { id, t: 4, tick: 0 };
    else if (id === 'quake') {
      const r = 420 * s.area;
      forEnemiesIn(p.x, p.y, r, (e) => damageEnemy(e, 150 * s.might, { fx: p.x, fy: p.y, knock: 300, stun: 3 }));
      p.shield = 80;
      G.addEffect({ type: 'ring', x: p.x, y: p.y, r, life: 0.7, color: '#7fe7ff', width: 16, follow: true });
      G.addEffect({ type: 'explosion', x: p.x, y: p.y, r: r * 0.6, life: 0.5, color: '#b0a089', follow: true });
      G.shake(16);
    }
  }

  function updateUlt(dt) {
    const u = g.ult;
    if (!u) return;
    const p = g.player, s = g.stats;
    u.t -= dt;
    if (u.id === 'dawn') {
      u.ang += dt * 14;
      u.tick -= dt;
      if (u.tick <= 0) {
        u.tick = 0.18;
        forEnemiesIn(p.x, p.y, 160 * s.area, (e) => damageEnemy(e, 32 * s.might, { fx: p.x, fy: p.y, knock: 220 }));
        RS.audio.play('slash');
      }
    } else if (u.id === 'volley') {
      u.tick -= dt;
      while (u.tick <= 0) {
        u.tick += 0.07;
        const t = randomEnemyNear(520);
        const x = t ? t.x : p.x + U.rand(-300, 300), y = t ? t.y : p.y + U.rand(-220, 220);
        forEnemiesIn(x, y, 45 * s.area, (e) => damageEnemy(e, 50 * s.might, { fx: x, fy: y - 30, knock: 120 }));
        G.addEffect({ type: 'skyarrow', x, y, life: 0.25, color: '#b9ffcf' });
      }
    } else if (u.id === 'nova' && u.t <= 0) {
      const r = 400 * s.area;
      forEnemiesIn(p.x, p.y, r, (e) => damageEnemy(e, 320 * s.might, { fx: p.x, fy: p.y, knock: 450 }));
      G.addEffect({ type: 'explosion', x: p.x, y: p.y, r, life: 0.6, color: '#b69cff', follow: true });
      G.addEffect({ type: 'ring', x: p.x, y: p.y, r, life: 0.6, color: '#e1d4ff', width: 14, follow: true });
      G.shake(14);
      RS.audio.play('explode');
    }
    if (u.t <= 0) g.ult = null;
  }

  function endRun(won) {
    if (g.over) return;
    g.over = true;
    g.won = won;
    if (won) g.gold += 250;
    const gold = Math.floor(g.gold);
    const sv = RS.save.data;
    sv.gold += gold;
    sv.runs++;
    const b = sv.best[g.champ.id] || { time: 0, kills: 0, level: 0, wins: 0 };
    b.time = Math.max(b.time, Math.floor(g.time));
    b.kills = Math.max(b.kills, g.kills);
    b.level = Math.max(b.level, g.level);
    if (won) b.wins = (b.wins || 0) + 1;
    sv.best[g.champ.id] = b;
    RS.save.write();
    if (hooks.onGameOver) hooks.onGameOver({ won, time: g.time, kills: g.kills, level: g.level, gold, evolutions: g.evolutions, damage: g.damageDealt });
  }

  // ------------------------------------------------------------------
  // Bucle de actualización
  // ------------------------------------------------------------------
  function update(dt) {
    if (!g || g.over) return;
    g.time += dt;
    const p = g.player, s = g.stats;

    // Movimiento
    const mv = RS.input.move();
    p.moving = mv.x !== 0 || mv.y !== 0;
    if (p.moving) {
      p.x += mv.x * s.speed * dt;
      p.y += mv.y * s.speed * dt;
      const l = Math.hypot(mv.x, mv.y) || 1;
      p.dirX = mv.x / l;
      p.dirY = mv.y / l;
      if (Math.abs(mv.x) > 0.1) p.face = mv.x > 0 ? 1 : -1;
    }
    if (RS.input.consume('flash')) tryFlash();
    if (RS.input.consume('ult')) tryUlt();

    p.iframes -= dt;
    p.flashCd -= dt;
    p.ultCd -= dt;
    if (p.shield > 0) p.shield = Math.max(0, p.shield - 4 * dt);
    if (s.regen > 0 && p.hp < s.maxHp) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);
    g.hurtT -= dt;

    hash.clear();
    for (const e of g.enemies) if (!e.dead) hash.insert(e);

    spawnUpdate(dt);
    for (const w of g.weapons) RS.Weapons.update(G, w, dt);
    updateUlt(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateEnemyProjectiles(dt);
    updateZonesAndTelegraphs(dt);
    updatePickups(dt);
    updateFx(dt);

    compact(g.enemies, (e) => !e.dead);
    g.shake = Math.max(0, g.shake - dt * 30);

    if (!g.over && g.pending > 0 && hooks.onLevelUp) {
      RS.audio.play('levelup');
      hooks.onLevelUp();
    }
  }

  function compact(arr, keep) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i];
    arr.length = j;
  }

  function relocate(e) {
    const pos = ringPos(spawnR());
    e.x = pos.x;
    e.y = pos.y;
    e.kx = e.ky = 0;
  }

  function updateEnemies(dt) {
    const p = g.player;
    const despawn2 = Math.pow(spawnR() + 320, 2);
    for (const e of g.enemies) {
      if (e.dead) continue;
      e.flash -= dt;
      let controlled = false;
      if (e.stun > 0) e.stun -= dt;
      else if (e.boss) controlled = bossAI(e, dt);
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!controlled && e.stun <= 0) {
        let sp = e.speed * (e.slowT > 0 ? 1 - e.slowF : 1);
        // los jefes alcanzan al jugador si se queda muy atrás
        if (e.boss && d > spawnR()) sp *= 3;
        if (e.ranged) {
          if (d < e.ranged.keep) sp = d < e.ranged.keep * 0.7 ? -sp * 0.6 : 0;
          e.shootT -= dt;
          if (e.shootT <= 0 && d < 520) {
            e.shootT = e.ranged.cd;
            shootAt(e.x, e.y, Math.atan2(dy, dx), e.ranged.speed, e.ranged.dmg * (1 + g.time / 600), '#e48bff', 6);
          }
        }
        e.x += (dx / d) * sp * dt;
        e.y += (dy / d) * sp * dt;
      }
      if (e.slowT > 0) e.slowT -= dt;
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      const decay = Math.min(1, 10 * dt);
      e.kx -= e.kx * decay;
      e.ky -= e.ky * decay;
      e.face = dx >= 0 ? 1 : -1;

      if (!e.boss) {
        hash.query(e.x, e.y, e.r + 26, sepCand);
        let c = 0;
        for (const o of sepCand) {
          if (o === e || o.dead) continue;
          const ox = e.x - o.x, oy = e.y - o.y;
          const rr = e.r + o.r;
          const d2 = ox * ox + oy * oy;
          if (d2 < rr * rr && d2 > 0.01) {
            const dd = Math.sqrt(d2);
            const push = (rr - dd) * (o.boss ? 0.8 : 0.35);
            e.x += (ox / dd) * push;
            e.y += (oy / dd) * push;
          }
          if (++c > 10) break;
        }
        if (d * d > despawn2) relocate(e);
      }
      if (e.stun <= 0 && d < e.r + p.r - 3) hurtPlayer(e.dmg);
    }
  }

  function updateProjectiles(dt) {
    const pl = g.player;
    for (const p of g.projs) {
      p.life -= dt;
      if (p.life <= 0) {
        p.dead = true;
        continue;
      }
      if (p.homing) {
        const t = nearest(p.x, p.y, 450);
        if (t) {
          const cur = Math.atan2(p.vy, p.vx);
          const want = Math.atan2(t.y - p.y, t.x - p.x);
          const da = U.clamp(U.angleDiff(want, cur), -p.homing * dt, p.homing * dt);
          p.vx = Math.cos(cur + da) * p.speed;
          p.vy = Math.sin(cur + da) * p.speed;
        }
      }
      if (p.kind === 'glaive') {
        p.spin += dt * 14;
        if (!p.back) {
          p.travel += p.speed * dt;
          if (p.travel >= p.maxDist) p.back = true;
        } else {
          const dx = pl.x - p.x, dy = pl.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 22) {
            p.dead = true;
            continue;
          }
          p.vx = (dx / d) * p.speed * 1.25;
          p.vy = (dy / d) * p.speed * 1.25;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const list = hash.query(p.x, p.y, p.r + MAXR, projCand);
      for (const e of list) {
        if (e.dead) continue;
        const rr = p.r + e.r;
        if (U.dist2(p.x, p.y, e.x, e.y) > rr * rr) continue;
        if (p.kind === 'glaive') {
          if (!RS.Weapons.canHit(G, e, 'gl' + p.id, 0.35)) continue;
        } else {
          if (p.hitSet.has(e)) continue;
          p.hitSet.add(e);
        }
        damageEnemy(e, p.dmg, { fx: p.x - p.vx * 0.05, fy: p.y - p.vy * 0.05, knock: p.knock });
        if (p.explode) {
          forEnemiesIn(p.x, p.y, p.explode, (o) => {
            if (o !== e) damageEnemy(o, p.dmg * 0.6, { fx: p.x, fy: p.y, knock: 80 });
          });
          G.addEffect({ type: 'explosion', x: p.x, y: p.y, r: p.explode, life: 0.3, color: '#fff59d' });
        }
        if (p.ls) healPlayer(p.ls);
        p.pierce--;
        if (p.pierce < 0) {
          p.dead = true;
          break;
        }
      }
    }
    compact(g.projs, (p) => !p.dead);
  }

  function updateEnemyProjectiles(dt) {
    const p = g.player;
    for (const b of g.eprojs) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const rr = b.r + p.r - 4;
      if (U.dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        hurtPlayer(b.dmg);
        b.life = 0;
      }
    }
    compact(g.eprojs, (b) => b.life > 0);
  }

  function updateZonesAndTelegraphs(dt) {
    for (const z of g.zones) {
      z.life -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.35;
        forEnemiesIn(z.x, z.y, z.r, (e) => {
          damageEnemy(e, z.dps * 0.35, { color: '#c5ff8a' });
          if (z.slow) {
            e.slowT = 0.5;
            e.slowF = z.slow;
          }
        });
      }
    }
    compact(g.zones, (z) => z.life > 0);
    for (const t of g.tgs) {
      t.t += dt;
      if (t.t >= t.delay) {
        t.done = true;
        t.onDone(t);
      }
    }
    compact(g.tgs, (t) => !t.done);
  }

  function updatePickups(dt) {
    const p = g.player, s = g.stats;
    const m2 = s.magnet * s.magnet;
    const grab = (p.r + 10) * (p.r + 10);
    const pull = (o) => {
      const dx = p.x - o.x, dy = p.y - o.y;
      const d2 = dx * dx + dy * dy;
      if (o.pull || d2 < m2) {
        o.pull = true;
        o.sp = Math.min(950, o.sp + 1500 * dt);
        const d = Math.sqrt(d2) || 1;
        o.x += (dx / d) * o.sp * dt;
        o.y += (dy / d) * o.sp * dt;
      }
      return d2 < grab;
    };
    for (const gm of g.gems) {
      if (pull(gm)) {
        gm.got = true;
        gainXp(gm.v);
        RS.audio.play('xp');
      }
    }
    compact(g.gems, (gm) => !gm.got);
    for (const o of g.pickups) {
      if (!pull(o)) continue;
      o.got = true;
      if (o.type === 'gold') {
        g.gold += o.v * s.greed;
        RS.audio.play('coin');
      } else if (o.type === 'potion') {
        healPlayer(s.maxHp * 0.3);
        RS.audio.play('heal');
      } else if (o.type === 'magnet') {
        for (const gm of g.gems) gm.pull = true;
        toast('¡Orbe del Vigía! Atraes toda la experiencia', '#4fc3f7');
        RS.audio.play('heal');
      } else if (o.type === 'chest') {
        g.gold += 60 * s.greed;
        RS.audio.play('chest');
        if (hooks.onChest) hooks.onChest();
      }
    }
    compact(g.pickups, (o) => !o.got);
  }

  function updateFx(dt) {
    const p = g.player;
    for (const e of g.effects) {
      e.t += dt;
      if (e.follow) {
        e.x = p.x;
        e.y = p.y;
      }
    }
    compact(g.effects, (e) => e.t < e.life);
    for (const q of g.parts) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 1 - Math.min(1, 4 * dt);
      q.vy *= 1 - Math.min(1, 4 * dt);
    }
    compact(g.parts, (q) => q.life > 0);
    for (const t of g.texts) {
      t.life -= dt;
      t.y -= 35 * dt;
    }
    compact(g.texts, (t) => t.life > 0);
    for (const t of g.toasts) t.life -= dt;
    compact(g.toasts, (t) => t.life > 0);
  }

  function particles(x, y, n, color, speed) {
    if (!g || g.parts.length > 500) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = Math.random() * speed;
      const life = U.rand(0.3, 0.7);
      g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: U.rand(2, 4) });
    }
  }

  function addText(x, y, txt, color, size) {
    if (g.texts.length > 140) return;
    g.texts.push({ x, y, txt: String(txt), color, size, life: 0.6, max: 0.6 });
  }

  function toast(text, color) {
    if (!g) return;
    g.toasts.push({ text, color: color || '#fff', life: 3, max: 3 });
    if (g.toasts.length > 3) g.toasts.shift();
  }

  // ------------------------------------------------------------------
  // Renderizado
  // ------------------------------------------------------------------
  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    zoom = U.clamp(Math.min(W, H) / 760, 0.62, 1.15);
  }

  function drawBackground(cx, cy, vw, vh) {
    ctx.fillStyle = '#20402b';
    ctx.fillRect(cx, cy, vw, vh);
    // manchas grandes de tierra
    const B = 520;
    for (let x = Math.floor(cx / B) - 1; x <= Math.floor((cx + vw) / B) + 1; x++) {
      for (let y = Math.floor(cy / B) - 1; y <= Math.floor((cy + vh) / B) + 1; y++) {
        const h = U.hash(x * 3 + 17, y * 5 - 9);
        if (h < 0.35) {
          ctx.fillStyle = 'rgba(92,72,44,0.22)';
          ctx.beginPath();
          ctx.ellipse(x * B + U.hash(x, y + 1) * B, y * B + U.hash(x + 1, y) * B, 120 + h * 300, 70 + h * 160, h * 6, 0, TAU);
          ctx.fill();
        }
      }
    }
    const S = 96;
    const x0 = Math.floor(cx / S), x1 = Math.floor((cx + vw) / S);
    const y0 = Math.floor(cy / S), y1 = Math.floor((cy + vh) / S);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const h = U.hash(x, y);
        if (h < 0.3) {
          ctx.fillStyle = h < 0.15 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
          ctx.fillRect(x * S, y * S, S, S);
        }
        const h2 = U.hash(x * 7 + 3, y * 13 + 1);
        const px = x * S + U.hash(x + 11, y - 5) * S * 0.8 + 8;
        const py = y * S + U.hash(x - 3, y + 7) * S * 0.8 + 8;
        if (h2 < 0.05) {
          ctx.fillStyle = '#56615c';
          ctx.beginPath();
          ctx.ellipse(px, py, 11, 8, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#6f7a74';
          ctx.beginPath();
          ctx.ellipse(px - 2, py - 2, 7, 5, 0, 0, TAU);
          ctx.fill();
        } else if (h2 < 0.25) {
          ctx.strokeStyle = '#2f5c3c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px - 4, py);
          ctx.lineTo(px - 6, py - 8);
          ctx.moveTo(px, py);
          ctx.lineTo(px, py - 10);
          ctx.moveTo(px + 4, py);
          ctx.lineTo(px + 6, py - 8);
          ctx.stroke();
        } else if (h2 < 0.285) {
          ctx.fillStyle = h2 < 0.27 ? '#e9c46a' : '#c792ea';
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, TAU);
          ctx.arc(px + 6, py + 3, 2.5, 0, TAU);
          ctx.fill();
        } else if (h2 < 0.292) {
          // seta brillante
          ctx.fillStyle = 'rgba(120,255,220,0.18)';
          ctx.beginPath();
          ctx.arc(px, py, 10, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#7dffd8';
          ctx.beginPath();
          ctx.arc(px, py - 2, 4, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#d7f5ea';
          ctx.fillRect(px - 1, py - 2, 2, 5);
        }
      }
    }
  }

  function gemColor(v) {
    return v < 3 ? '#4fc3f7' : v < 10 ? '#66bb6a' : v < 40 ? '#ef5350' : '#ffd54f';
  }

  function render(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!g) {
      renderIdle(now / 1000);
      return;
    }
    const p = g.player;
    const vw = viewW(), vh = viewH();
    const sx = g.shake > 0 ? U.rand(-g.shake, g.shake) : 0;
    const sy = g.shake > 0 ? U.rand(-g.shake, g.shake) : 0;
    const camX = p.x - vw / 2 + sx, camY = p.y - vh / 2 + sy;
    const t = g.time;
    const inView = (x, y, m) => x > camX - m && x < camX + vw + m && y > camY - m && y < camY + vh + m;

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawBackground(camX, camY, vw, vh);

    // Zonas
    for (const z of g.zones) {
      const a = Math.min(1, z.life / 0.5);
      ctx.fillStyle = RS.Draw.hexA(z.color, 0.22 * a);
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = RS.Draw.hexA(z.color, 0.45 * a);
      for (let i = 0; i < 3; i++) {
        const ba = t * 2 + i * 2.1 + z.x;
        ctx.beginPath();
        ctx.arc(z.x + Math.cos(ba) * z.r * 0.5, z.y + Math.sin(ba * 1.3) * z.r * 0.4, 3 + ((t * 3 + i) % 1) * 3, 0, TAU);
        ctx.fill();
      }
    }

    // Avisos de área
    for (const tg of g.tgs) {
      const k = Math.min(1, tg.t / tg.delay);
      ctx.strokeStyle = RS.Draw.hexA(tg.color, 0.8);
      ctx.lineWidth = 2;
      ctx.fillStyle = RS.Draw.hexA(tg.color, 0.12);
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, tg.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = RS.Draw.hexA(tg.color, 0.28);
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, tg.r * k, 0, TAU);
      ctx.fill();
      if (tg.friendly) {
        // meteoro cayendo
        const fy = tg.y - (1 - k) * 260;
        ctx.fillStyle = '#ffcc80';
        ctx.beginPath();
        ctx.arc(tg.x + (1 - k) * 80, fy, 9, 0, TAU);
        ctx.fill();
      }
    }

    // Gemas y objetos
    for (const gm of g.gems) {
      if (!inView(gm.x, gm.y, 20)) continue;
      const sz = gm.v < 3 ? 5 : gm.v < 10 ? 6.5 : gm.v < 40 ? 8 : 10;
      ctx.fillStyle = gemColor(gm.v);
      ctx.beginPath();
      ctx.moveTo(gm.x, gm.y - sz);
      ctx.lineTo(gm.x + sz * 0.7, gm.y);
      ctx.lineTo(gm.x, gm.y + sz);
      ctx.lineTo(gm.x - sz * 0.7, gm.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(gm.x - 1.5, gm.y - sz * 0.5, 2, 3);
    }
    for (const o of g.pickups) {
      if (!inView(o.x, o.y, 40)) continue;
      drawPickup(o, t);
    }

    // Enemigos (ordenados por profundidad)
    const vis = [];
    for (const e of g.enemies) if (!e.dead && inView(e.x, e.y, e.r + 60)) vis.push(e);
    vis.sort((a, b) => a.y - b.y);
    for (const e of vis) {
      if (e.boss) RS.Draw.boss(ctx, e, t);
      else RS.Draw.enemy(ctx, e, t);
      if (!e.boss && e.maxHp >= 60 && e.hp < e.maxHp) {
        const w = e.r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4);
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 10, (w * Math.max(0, e.hp)) / e.maxHp, 4);
      }
    }

    // Jugador
    drawPlayer(t);

    // Proyectiles
    for (const pr of g.projs) drawProj(pr, t);
    for (const b of g.eprojs) {
      if (!inView(b.x, b.y, 20)) continue;
      ctx.fillStyle = RS.Draw.hexA(b.color, 0.35);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.4, 0, TAU);
      ctx.fill();
    }

    for (const e of g.effects) drawEffect(e);

    for (const q of g.parts) {
      ctx.globalAlpha = q.life / q.max;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    for (const tx of g.texts) {
      ctx.globalAlpha = Math.min(1, (tx.life / tx.max) * 2);
      ctx.font = `bold ${tx.size}px system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(tx.txt, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.txt, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    drawHUD();
  }

  function drawPlayer(t) {
    const p = g.player;
    const u = g.ult;
    if (u && u.id === 'dawn') {
      const r = 160 * g.stats.area;
      ctx.fillStyle = 'rgba(255,215,120,0.12)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,150,0.85)';
      ctx.lineWidth = 6;
      for (let i = 0; i < 3; i++) {
        const a = u.ang + (i * TAU) / 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.8, a, a + 0.9);
        ctx.stroke();
      }
    }
    if (u && u.id === 'nova') {
      const k = 1 - u.t / u.max;
      ctx.strokeStyle = `rgba(200,170,255,${0.4 + k * 0.6})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 400 * g.stats.area * (1 - k) + 20, 0, TAU);
      ctx.stroke();
    }
    // radio de recogida sutil
    ctx.strokeStyle = 'rgba(120,200,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, g.stats.magnet, 0, TAU);
    ctx.stroke();

    const blink = p.iframes > 0 && Math.floor(t * 20) % 2 === 0;
    ctx.globalAlpha = blink ? 0.5 : 1;
    RS.Draw.champion(ctx, g.champ.id, p.x, p.y, 1, p.face, t, p.moving, false);
    ctx.globalAlpha = 1;
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(127,231,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, 0, TAU);
      ctx.stroke();
    }
    // Hojas espectrales orbitando
    for (const w of g.weapons) {
      if (w.id !== 'blades' || !w.orbs || !w.orbs.length) continue;
      const S = RS.Weapons.stats(w);
      const size = S.size * Math.sqrt(g.stats.area);
      for (const o of w.orbs) {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.a + Math.PI / 2);
        ctx.fillStyle = w.evolved ? 'rgba(180,240,255,0.35)' : 'rgba(127,214,255,0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, TAU);
        ctx.fill();
        ctx.fillStyle = w.evolved ? '#e0f7ff' : '#7fd6ff';
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.4, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    // barra de vida bajo el jugador
    const w = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x - w / 2, p.y + 22, w, 5);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(p.x - w / 2, p.y + 22, (w * Math.max(0, p.hp)) / g.stats.maxHp, 5);
  }

  function drawPickup(o, t) {
    const bob = Math.sin(t * 4 + o.x) * 2;
    const x = o.x, y = o.y + bob;
    if (o.type === 'gold') {
      ctx.fillStyle = '#ffca28';
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 6, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#a67c00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(x - 1, y - 3, 2, 6);
    } else if (o.type === 'potion') {
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.arc(x, y + 2, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#c8b9a6';
      ctx.fillRect(x - 2.5, y - 9, 5, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x - 3, y - 1, 2, 4);
    } else if (o.type === 'magnet') {
      ctx.fillStyle = 'rgba(79,195,247,0.3)';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0d2a3a';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, TAU);
      ctx.fill();
    } else if (o.type === 'chest') {
      const glow = 0.3 + Math.sin(t * 5) * 0.15;
      ctx.fillStyle = `rgba(255,213,79,${glow})`;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#8d5524';
      ctx.fillRect(x - 14, y - 8, 28, 18);
      ctx.fillStyle = '#c68642';
      ctx.fillRect(x - 14, y - 13, 28, 7);
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(x - 15, y - 6, 30, 3);
      ctx.fillRect(x - 3, y - 6, 6, 8);
    }
  }

  function drawProj(p, t) {
    if (p.kind === 'orb') {
      ctx.fillStyle = RS.Draw.hexA(p.color, 0.3);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 1.9, 0, TAU);
      ctx.fill();
      if (p.star) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(t * 8);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? p.r * 0.45 : p.r * 1.3;
          const a = (i / 8) * TAU;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.45, 0, TAU);
        ctx.fill();
      }
    } else if (p.kind === 'arrow') {
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      ctx.strokeStyle = 'rgba(200,255,220,0.35)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.strokeStyle = '#8d6e3f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(4, 0);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(2, -4);
      ctx.lineTo(2, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (p.kind === 'glaive') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      for (let i = 0; i < 3; i++) {
        ctx.rotate(TAU / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(p.r * 0.9, -p.r * 0.4, p.r, p.r * 0.3);
        ctx.quadraticCurveTo(p.r * 0.4, p.r * 0.1, 0, 0);
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, p.r * 0.25, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEffect(e) {
    const k = e.t / e.life;
    if (e.type === 'slash') {
      ctx.fillStyle = RS.Draw.hexA(e.color, 0.4 * (1 - k));
      ctx.beginPath();
      if (e.arc < TAU - 0.01) ctx.moveTo(e.x, e.y);
      ctx.arc(e.x, e.y, e.r, e.a - e.arc / 2, e.a + e.arc / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = RS.Draw.hexA(e.color, 1 - k);
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (0.85 + 0.15 * k), e.a - e.arc / 2, e.a + e.arc / 2);
      ctx.stroke();
    } else if (e.type === 'ring') {
      ctx.strokeStyle = RS.Draw.hexA(e.color, 1 - k);
      ctx.lineWidth = (e.width || 5) * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (0.25 + 0.75 * k), 0, TAU);
      ctx.stroke();
    } else if (e.type === 'explosion') {
      ctx.fillStyle = RS.Draw.hexA(e.color, 0.5 * (1 - k));
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (0.5 + 0.5 * k), 0, TAU);
      ctx.fill();
    } else if (e.type === 'bolt') {
      ctx.strokeStyle = RS.Draw.hexA(e.color, 1 - k);
      ctx.lineWidth = 3;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = 0; i < e.pts.length; i++) {
        const a = e.pts[i];
        if (i === 0) ctx.moveTo(a.x, a.y);
        else {
          const b = e.pts[i - 1];
          const mx = (a.x + b.x) / 2 + U.rand(-12, 12), my = (a.y + b.y) / 2 + U.rand(-12, 12);
          ctx.lineTo(mx, my);
          ctx.lineTo(a.x, a.y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (e.type === 'line') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.a);
      ctx.fillStyle = RS.Draw.hexA(e.color, 0.15 + 0.25 * k);
      ctx.fillRect(0, -e.w / 2, e.len, e.w);
      ctx.strokeStyle = RS.Draw.hexA(e.color, 0.7);
      ctx.lineWidth = 2;
      ctx.strokeRect(0, -e.w / 2, e.len, e.w);
      ctx.restore();
    } else if (e.type === 'skyarrow') {
      const y0 = e.y - 160 * (1 - k);
      ctx.strokeStyle = RS.Draw.hexA(e.color, 1 - k * 0.5);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(e.x - 20 * (1 - k), y0 - 30);
      ctx.lineTo(e.x, y0);
      ctx.stroke();
      if (k > 0.7) {
        ctx.fillStyle = RS.Draw.hexA(e.color, 0.4);
        ctx.beginPath();
        ctx.arc(e.x, e.y, 30 * k, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---------------- HUD ----------------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSlot(x, y, size, def, level, max, evolved) {
    roundRect(x, y, size, size, 6);
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    ctx.fill();
    ctx.lineWidth = evolved ? 2.5 : 1.5;
    ctx.strokeStyle = evolved ? '#ffd54f' : '#c8aa6e';
    ctx.stroke();
    ctx.fillStyle = evolved ? '#ffd54f' : def.color;
    ctx.font = `${Math.floor(size * 0.55)}px "Segoe UI Symbol", "Noto Sans Symbols 2", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, x + size / 2, y + size / 2 - 2);
    ctx.textBaseline = 'alphabetic';
    if (evolved) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText('EVO', x + size / 2, y + size - 3);
    } else {
      const pw = (size - 8) / max;
      for (let i = 0; i < max; i++) {
        ctx.fillStyle = i < level ? '#4fd1ff' : 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 4 + i * pw, y + size - 6, pw - 1.5, 3);
      }
    }
  }

  function drawButton(b, label, key, cd, cdMax, locked, color) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = locked ? '#555' : cd > 0 ? '#5b6b7a' : color;
    ctx.stroke();
    if (!locked && cd > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, b.r - 2, -Math.PI / 2, -Math.PI / 2 + TAU * (cd / cdMax));
      ctx.closePath();
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = locked ? '#777' : '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(locked ? '🔒' : cd > 0 ? Math.ceil(cd) : label, b.x, b.y + 5);
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = '#c8aa6e';
    ctx.fillText(key, b.x, b.y + b.r + 13);
  }

  function drawHUD() {
    const p = g.player, s = g.stats;
    // vignette de daño
    if (g.hurtT > 0) {
      const grd = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      grd.addColorStop(0, 'rgba(255,0,0,0)');
      grd.addColorStop(1, `rgba(255,0,0,${g.hurtT * 1.2})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }
    // barra de experiencia
    ctx.fillStyle = 'rgba(5,8,16,0.85)';
    ctx.fillRect(0, 0, W, 14);
    const xg = ctx.createLinearGradient(0, 0, W, 0);
    xg.addColorStop(0, '#1e88e5');
    xg.addColorStop(1, '#4fd1ff');
    ctx.fillStyle = xg;
    ctx.fillRect(0, 0, (W * g.xp) / g.xpNext, 14);
    ctx.fillStyle = '#c8aa6e';
    ctx.fillRect(0, 14, W, 1.5);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText('NV ' + g.level, W - 8, 11);

    // tiempo (en pantallas estrechas se coloca a la derecha para no tapar las ranuras)
    const narrow = W < 600;
    const tx = narrow ? W - 50 : W / 2;
    ctx.textAlign = narrow ? 'right' : 'center';
    ctx.font = `700 ${narrow ? 24 : 28}px Cinzel, Georgia, serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(U.fmtTime(g.time), tx, 46);
    ctx.fillStyle = '#f0e6d2';
    ctx.fillText(U.fmtTime(g.time), tx, 46);
    ctx.font = 'bold 13px system-ui, sans-serif';
    const info = '☠ ' + g.kills + '    ◆ ' + Math.floor(g.gold);
    ctx.strokeText(info, tx, 66);
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(info, tx, 66);

    // vida
    const hx = 12, hy = 24, hw = Math.min(230, W * 0.4), hh = 16;
    roundRect(hx, hy, hw, hh, 4);
    ctx.fillStyle = 'rgba(5,8,16,0.85)';
    ctx.fill();
    ctx.fillStyle = '#2e7d32';
    roundRect(hx + 2, hy + 2, Math.max(0, ((hw - 4) * p.hp) / s.maxHp), hh - 4, 3);
    ctx.fill();
    if (p.shield > 0) {
      ctx.fillStyle = 'rgba(127,231,255,0.7)';
      ctx.fillRect(hx + 2, hy + hh - 6, Math.min(hw - 4, ((hw - 4) * p.shield) / s.maxHp), 4);
    }
    ctx.strokeStyle = '#c8aa6e';
    ctx.lineWidth = 1.5;
    roundRect(hx, hy, hw, hh, 4);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(p.hp) + ' / ' + Math.round(s.maxHp), hx + hw / 2, hy + 12);

    // habilidades y objetos
    const size = W < 600 ? 28 : 34;
    for (let i = 0; i < g.weapons.length; i++) {
      const w = g.weapons[i];
      const d = D.WEAPONS[w.id];
      drawSlot(hx + i * (size + 4), hy + 24, size, d, w.level, d.lv.length, w.evolved);
    }
    for (let i = 0; i < g.items.length; i++) {
      const it = g.items[i];
      const d = D.ITEMS[it.id];
      drawSlot(hx + i * (size + 4), hy + 28 + size, size, d, it.level, d.max, false);
    }

    // barra de jefe
    if (g.bosses.length) {
      const b = g.bosses[0];
      const bw = Math.min(520, W - 40), bx = (W - bw) / 2;
      const by = narrow ? hy + 2 * size + 52 : 94;
      ctx.font = '700 15px Cinzel, Georgia, serif';
      ctx.fillStyle = '#ffb4b4';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(b.name, W / 2, by - 4);
      ctx.fillText(b.name, W / 2, by - 4);
      roundRect(bx, by, bw, 12, 4);
      ctx.fillStyle = 'rgba(5,8,16,0.85)';
      ctx.fill();
      ctx.fillStyle = b.enraged ? '#ff1744' : '#d32f2f';
      ctx.fillRect(bx + 2, by + 2, Math.max(0, ((bw - 4) * b.hp) / b.maxHp), 8);
      ctx.strokeStyle = '#c8aa6e';
      ctx.lineWidth = 1.5;
      roundRect(bx, by, bw, 12, 4);
      ctx.stroke();
      // flecha indicadora si el jefe está fuera de pantalla
      const vw = viewW(), vh = viewH();
      if (Math.abs(b.x - p.x) > vw / 2 || Math.abs(b.y - p.y) > vh / 2) {
        const a = Math.atan2(b.y - p.y, b.x - p.x);
        const ax = W / 2 + Math.cos(a) * Math.min(W, H) * 0.4;
        const ay = H / 2 + Math.sin(a) * Math.min(W, H) * 0.4;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = '#ff5252';
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-8, -9);
        ctx.lineTo(-8, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // botones de definitiva y destello
    const br = W < 600 ? 30 : 28;
    hud.ult = { x: W - br - 18, y: H - br - 30, r: br };
    hud.flash = { x: W - br * 3 - 30, y: H - br - 30, r: br * 0.85 };
    hud.pause = { x: W - 24, y: 40, r: 16 };
    const locked = g.level < D.ULT_LEVEL;
    drawButton(hud.ult, 'R', 'DEFINITIVA [R]', Math.max(0, p.ultCd), 50 * s.cdMult, locked, g.champ.color);
    drawButton(hud.flash, '✧', 'DESTELLO [ESP]', Math.max(0, p.flashCd), 18, false, '#ffe57f');
    // pausa
    ctx.beginPath();
    ctx.arc(hud.pause.x, hud.pause.y, hud.pause.r, 0, TAU);
    ctx.fillStyle = 'rgba(10,14,24,0.7)';
    ctx.fill();
    ctx.strokeStyle = '#c8aa6e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f0e6d2';
    ctx.fillRect(hud.pause.x - 5, hud.pause.y - 6, 3.5, 12);
    ctx.fillRect(hud.pause.x + 1.5, hud.pause.y - 6, 3.5, 12);

    // avisos
    ctx.textAlign = 'center';
    let ty = H * 0.26;
    for (const tt of g.toasts) {
      const a = Math.min(1, tt.life / 0.5, (tt.max - tt.life) / 0.2);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = '700 20px Cinzel, Georgia, serif';
      const tw = ctx.measureText(tt.text).width;
      if (tw > W - 24) ctx.font = `700 ${Math.floor((20 * (W - 24)) / tw)}px Cinzel, Georgia, serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(tt.text, W / 2, ty);
      ctx.fillStyle = tt.color;
      ctx.fillText(tt.text, W / 2, ty);
      ty += 28;
    }
    ctx.globalAlpha = 1;

    // joystick táctil
    const j = RS.input.joy;
    if (j.active) {
      ctx.strokeStyle = 'rgba(200,170,110,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(j.ox, j.oy, 50, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,170,110,0.45)';
      ctx.beginPath();
      ctx.arc(j.ox + j.dx * 50, j.oy + j.dy * 50, 20, 0, TAU);
      ctx.fill();
    }
  }

  // Fondo animado del menú
  function renderIdle(t) {
    const vw = W / zoom, vh = H / zoom;
    const cx = t * 25, cy = Math.sin(t * 0.2) * 120;
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);
    drawBackground(cx, cy, vw, vh);
    ctx.restore();
    const grd = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
    grd.addColorStop(0, 'rgba(1,10,19,0.35)');
    grd.addColorStop(1, 'rgba(1,10,19,0.9)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  return {
    init,
    resize,
    newRun,
    update,
    render,
    hooks,
    hud,
    buildChoices,
    describe,
    applyChoice,
    get state() {
      return g;
    },
    clear() {
      g = null;
    },
    abandon() {
      if (g && !g.over) endRun(false);
    },
    // Para pruebas/depuración desde la consola
    _debug: { gainXp: (v) => gainXp(v), spawnBoss: (i) => spawnBoss(D.BOSSES[i]), G },
  };
})();
