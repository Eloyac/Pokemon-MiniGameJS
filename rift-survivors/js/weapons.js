'use strict';
// Lógica de disparo de cada habilidad automática.
// G es la API del motor (ver game.js): G.state, G.nearest, G.forEnemiesIn, G.damage, G.addProj...
RS.Weapons = (function () {
  const U = RS.util, D = RS.data, TAU = Math.PI * 2;

  function stats(w) {
    const d = D.WEAPONS[w.id];
    return w.evolved ? d.evo.stats : d.lv[w.level - 1];
  }

  function aimAngle(G, maxR) {
    const p = G.state.player;
    const t = G.nearest(p.x, p.y, maxR);
    if (t) return Math.atan2(t.y - p.y, t.x - p.x);
    return Math.atan2(p.dirY, p.dirX);
  }

  // Comprueba y registra el enfriamiento de golpe por enemigo (para efectos persistentes)
  function canHit(G, e, key, cd) {
    const now = G.state.time;
    if (now - (e.hits[key] || -99) < cd) return false;
    e.hits[key] = now;
    return true;
  }

  const IMPL = {
    cleave: {
      fire(G, w, S) {
        const g = G.state, p = g.player, s = g.stats;
        const base = aimAngle(G, 320);
        const range = S.range * s.area;
        const dmg = S.dmg * s.might;
        const hit = new Set();
        for (let i = 0; i < S.dirs; i++) {
          const a = base + (i * TAU) / S.dirs;
          G.addEffect({ type: 'slash', x: p.x, y: p.y, a, arc: S.arc, r: range, life: 0.22, color: w.evolved ? '#fff1a8' : '#ffd27a', follow: true });
          G.forEnemiesIn(p.x, p.y, range, (e) => {
            if (hit.has(e)) return;
            const ea = Math.atan2(e.y - p.y, e.x - p.x);
            const close = U.dist2(e.x, e.y, p.x, p.y) < (e.r + 18) * (e.r + 18);
            if (S.arc >= TAU - 0.01 || close || Math.abs(U.angleDiff(ea, a)) <= S.arc / 2) {
              hit.add(e);
              G.damage(e, dmg, { fx: p.x, fy: p.y, knock: S.knock });
            }
          });
        }
        G.sfx('slash');
      },
    },

    orb: {
      fire(G, w, S) {
        const g = G.state, p = g.player, s = g.stats;
        const n = S.count + s.amount;
        const base = aimAngle(G, 600);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.5;
          const sp = S.speed * s.projSpeed;
          G.addProj({
            kind: 'orb', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, speed: sp,
            r: 8 * Math.sqrt(s.area), dmg: S.dmg * s.might, pierce: S.pierce, life: 3 * s.duration,
            homing: 7, color: w.evolved ? '#fff59d' : '#b69cff', explode: S.explode ? S.explode * s.area : 0,
            star: w.evolved, knock: 60,
          });
        }
        G.sfx('shoot');
      },
    },

    arrow: {
      fire(G, w, S) {
        const g = G.state, p = g.player, s = g.stats;
        const n = S.count + s.amount;
        const base = aimAngle(G, 650);
        const sp = 720 * s.projSpeed;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * S.spread;
          G.addProj({
            kind: 'arrow', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            r: 6, dmg: S.dmg * s.might, pierce: S.pierce, life: 1.1 * s.duration,
            color: w.evolved ? '#c8ffdc' : '#e9f5d0', knock: 80,
          });
        }
        G.sfx('shoot');
      },
    },

    shockwave: {
      fire(G, w, S) {
        const g = G.state, p = g.player, s = g.stats;
        const r = S.r * s.area;
        G.addEffect({ type: 'ring', x: p.x, y: p.y, r, life: 0.35, color: w.evolved ? '#ffd180' : '#e0c39a', width: w.evolved ? 10 : 6, follow: true });
        G.forEnemiesIn(p.x, p.y, r, (e) => {
          G.damage(e, S.dmg * s.might, { fx: p.x, fy: p.y, knock: 260, stun: S.stun });
        });
        G.shake(w.evolved ? 5 : 2);
        G.sfx('explode');
      },
    },

    blades: {
      fire(G, w, S) {
        w.active = S.dur * G.state.stats.duration;
        if (w.ang === undefined) w.ang = 0;
      },
      tick(G, w, S, dt) {
        w.orbs = w.orbs || [];
        w.orbs.length = 0;
        if (!(w.active > 0)) return;
        w.active -= dt;
        const g = G.state, p = g.player, s = g.stats;
        w.ang = (w.ang || 0) + S.spin * dt;
        const n = S.count + s.amount;
        const rad = S.radius * s.area;
        const size = S.size * Math.sqrt(s.area);
        for (let k = 0; k < n; k++) {
          const a = w.ang + (k * TAU) / n;
          const ox = p.x + Math.cos(a) * rad, oy = p.y + Math.sin(a) * rad;
          w.orbs.push({ x: ox, y: oy, a });
          G.forEnemiesIn(ox, oy, size, (e) => {
            if (canHit(G, e, 'blades' + k, 0.4)) G.damage(e, S.dmg * s.might, { fx: p.x, fy: p.y, knock: 180 });
          });
        }
      },
    },

    chain: {
      fire(G, w, S) {
        const g = G.state, p = g.player, s = g.stats;
        const used = new Set();
        let fired = false;
        for (let c = 0; c < S.chains; c++) {
          let cur = G.nearest(p.x, p.y, 420, used);
          if (!cur) break;
          fired = true;
          const pts = [{ x: p.x, y: p.y }];
          const jumps = S.jumps + s.amount;
          for (let j = 0; j <= jumps && cur; j++) {
            used.add(cur);
            pts.push({ x: cur.x, y: cur.y });
            G.damage(cur, S.dmg * s.might, { fx: p.x, fy: p.y, knock: 40, color: '#fff27a' });
            cur = G.nearest(cur.x, cur.y, 170 * s.area, used);
          }
          G.addEffect({ type: 'bolt', pts, life: 0.2, color: w.evolved ? '#bdf3ff' : '#fff27a' });
        }
        if (!fired) return false;
        G.sfx('zap');
      },
    },

    trail: {
      fire(G, w, S) {
        const g = G.state, p = g.player, s = g.stats;
        G.addZone({
          x: p.x, y: p.y, r: S.r * s.area, life: S.dur * s.duration, max: S.dur * s.duration,
          dps: S.dps * s.might, slow: S.slow, color: w.evolved ? '#7dff4d' : '#9be15d', friendly: true, tick: 0,
        });
      },
    },

    meteor: {
      fire(G, w, S) {
        const g = G.state, p = g.player, s = g.stats;
        const n = S.count + s.amount;
        for (let i = 0; i < n; i++) {
          const t = G.randomEnemyNear(520);
          const x = t ? t.x + U.rand(-15, 15) : p.x + U.rand(-250, 250);
          const y = t ? t.y + U.rand(-15, 15) : p.y + U.rand(-180, 180);
          G.addTelegraph({
            x, y, r: S.r * s.area, delay: 0.65 + i * 0.08, friendly: true, color: '#ff8a4c',
            onDone(tg) {
              G.forEnemiesIn(tg.x, tg.y, tg.r, (e) => G.damage(e, S.dmg * s.might, { fx: tg.x, fy: tg.y, knock: 200 }));
              G.addEffect({ type: 'explosion', x: tg.x, y: tg.y, r: tg.r, life: 0.4, color: '#ff8a4c' });
              G.particles(tg.x, tg.y, 14, '#ffb36b', 260);
              if (S.burn) {
                G.addZone({ x: tg.x, y: tg.y, r: tg.r * 0.8, life: 2.5, max: 2.5, dps: S.burn * s.might, slow: 0, color: '#ff6a2b', friendly: true, tick: 0 });
              }
              G.shake(3);
              G.sfx('explode');
            },
          });
        }
      },
    },

    glaive: {
      fire(G, w, S) {
        const g = G.state, p = g.player, s = g.stats;
        const n = S.count + s.amount;
        const base = aimAngle(G, 500);
        const sp = 430 * s.projSpeed;
        for (let i = 0; i < n; i++) {
          const a = base + (i * TAU) / n;
          G.addProj({
            kind: 'glaive', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, speed: sp,
            r: S.size * Math.sqrt(s.area), dmg: S.dmg * s.might, pierce: 1e9, life: 6,
            maxDist: S.dist * s.area, travel: 0, back: false, color: w.evolved ? '#ff3355' : '#ff8fa3',
            ls: S.ls, knock: 120, spin: 0,
          });
        }
        G.sfx('shoot');
      },
    },
  };

  function update(G, w, dt) {
    const S = stats(w);
    const impl = IMPL[w.id];
    if (impl.tick) impl.tick(G, w, S, dt);
    w.timer -= dt;
    if (w.timer <= 0) {
      const res = impl.fire(G, w, S);
      w.timer = res === false ? 0.25 : Math.max(0.1, S.cd * G.state.stats.cdMult);
    }
  }

  return { update, stats, canHit };
})();
