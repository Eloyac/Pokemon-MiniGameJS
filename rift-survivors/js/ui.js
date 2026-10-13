'use strict';
// Entrada (teclado/táctil), pantallas del menú y bucle principal.
(function () {
  const U = RS.util, D = RS.data, Game = RS.Game;
  const $ = (s) => document.querySelector(s);

  // ------------------------------------------------------------------
  // Entrada
  // ------------------------------------------------------------------
  const input = (RS.input = {
    keys: {},
    pressed: {},
    joy: { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 },
    move() {
      let x = 0, y = 0;
      const k = this.keys;
      if (k.KeyA || k.ArrowLeft) x -= 1;
      if (k.KeyD || k.ArrowRight) x += 1;
      if (k.KeyW || k.ArrowUp) y -= 1;
      if (k.KeyS || k.ArrowDown) y += 1;
      if (this.joy.active && (this.joy.dx || this.joy.dy)) {
        x = this.joy.dx;
        y = this.joy.dy;
      }
      const l = Math.hypot(x, y);
      if (l > 1) {
        x /= l;
        y /= l;
      }
      return { x, y };
    },
    consume(a) {
      if (this.pressed[a]) {
        this.pressed[a] = false;
        return true;
      }
      return false;
    },
  });

  let mode = 'menu';
  let selectedChamp = 'kaelen';
  let choices = [];
  let choiceMode = 'level';

  window.addEventListener('keydown', (e) => {
    RS.audio.ensure();
    input.keys[e.code] = true;
    if (mode === 'playing') {
      if (e.code === 'KeyR' || e.code === 'KeyQ') input.pressed.ult = true;
      if (e.code === 'Space' || e.code === 'KeyF') input.pressed.flash = true;
      if (e.code === 'Escape' || e.code === 'KeyP') pause();
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    } else if (mode === 'paused') {
      if (e.code === 'Escape' || e.code === 'KeyP') resume();
    } else if (mode === 'levelup') {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= choices.length) pick(n - 1);
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    input.keys = {};
    if (mode === 'playing') pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') pause();
  });

  const canvas = $('#game');
  const hitBtn = (b, x, y) => b && U.dist2(b.x, b.y, x, y) <= (b.r + 8) * (b.r + 8);
  function hudPress(x, y) {
    if (mode !== 'playing') return false;
    if (hitBtn(Game.hud.ult, x, y)) input.pressed.ult = true;
    else if (hitBtn(Game.hud.flash, x, y)) input.pressed.flash = true;
    else if (hitBtn(Game.hud.pause, x, y)) pause();
    else return false;
    return true;
  }
  canvas.addEventListener('mousedown', (e) => {
    RS.audio.ensure();
    hudPress(e.clientX, e.clientY);
  });
  canvas.addEventListener(
    'touchstart',
    (e) => {
      RS.audio.ensure();
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (hudPress(t.clientX, t.clientY)) continue;
        if (!input.joy.active && mode === 'playing') {
          Object.assign(input.joy, { active: true, id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 });
        }
      }
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== input.joy.id) continue;
        let dx = (t.clientX - input.joy.ox) / 50, dy = (t.clientY - input.joy.oy) / 50;
        const l = Math.hypot(dx, dy);
        if (l > 1) {
          dx /= l;
          dy /= l;
        }
        input.joy.dx = l < 0.15 ? 0 : dx;
        input.joy.dy = l < 0.15 ? 0 : dy;
      }
    },
    { passive: false }
  );
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === input.joy.id) Object.assign(input.joy, { active: false, id: null, dx: 0, dy: 0 });
    }
  };
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  // ------------------------------------------------------------------
  // Pantallas
  // ------------------------------------------------------------------
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  }
  function hideAll() {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  }

  function updateGold() {
    document.querySelectorAll('[data-gold]').forEach((el) => (el.textContent = Math.floor(RS.save.data.gold)));
  }

  function goMenu() {
    Game.clear();
    mode = 'menu';
    updateGold();
    show('screen-menu');
  }

  // --- Selección de campeón ---
  function buildSelect() {
    const grid = $('#champ-grid');
    grid.innerHTML = '';
    for (const id in D.CHAMPIONS) {
      const c = D.CHAMPIONS[id];
      const card = document.createElement('button');
      card.className = 'champ-card' + (id === selectedChamp ? ' selected' : '');
      card.style.setProperty('--c', c.color);
      const cv = document.createElement('canvas');
      cv.width = 160;
      cv.height = 160;
      RS.Draw.portrait(cv, id);
      card.appendChild(cv);
      const info = document.createElement('div');
      info.className = 'champ-info';
      info.innerHTML = `<strong>${c.name}</strong><span>${c.role}</span>`;
      card.appendChild(info);
      card.onclick = () => {
        RS.audio.play('click');
        selectedChamp = id;
        buildSelect();
      };
      grid.appendChild(card);
    }
    const c = D.CHAMPIONS[selectedChamp];
    const w = D.WEAPONS[c.start];
    const best = RS.save.data.best[c.id];
    $('#champ-detail').innerHTML = `
      <h3 style="color:${c.color}">${c.name}</h3>
      <p class="sub">${c.title} · ${c.role}</p>
      <div class="stat-row"><span>Vida</span><b>${c.hp}</b><span>Velocidad</span><b>${c.speed}</b><span>Armadura</span><b>${c.armor}</b></div>
      <div class="ability"><i style="color:${w.color}">${w.icon}</i><div><b>Habilidad inicial: ${w.name}</b><p>${w.desc}</p></div></div>
      <div class="ability"><i style="color:#c8aa6e">P</i><div><b>Pasiva: ${c.passive.name}</b><p>${c.passive.desc}</p></div></div>
      <div class="ability"><i style="color:#4fd1ff">R</i><div><b>Definitiva: ${c.ult.name}</b><p>${c.ult.desc} Se desbloquea en el nivel ${D.ULT_LEVEL}.</p></div></div>
      <p class="best">${best ? `Récord: ${U.fmtTime(best.time)} · ${best.kills} bajas · Nv ${best.level}${best.wins ? ` · ${best.wins} victoria(s)` : ''}` : 'Sin partidas todavía'}</p>`;
  }

  // --- Tienda de mejoras permanentes ---
  function buildShop() {
    const grid = $('#shop-grid');
    grid.innerHTML = '';
    for (const m of D.META) {
      const lvl = RS.save.up(m.id);
      const maxed = lvl >= m.max;
      const cost = m.cost * (lvl + 1);
      const el = document.createElement('div');
      el.className = 'shop-card' + (maxed ? ' maxed' : '');
      el.innerHTML = `
        <div class="shop-icon">${m.icon}</div>
        <div class="shop-body"><b>${m.name}</b><p>${m.desc}</p>
        <div class="pips">${Array.from({ length: m.max }, (_, i) => `<span class="${i < lvl ? 'on' : ''}"></span>`).join('')}</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = maxed ? 'Máx.' : '◆ ' + cost;
      btn.disabled = maxed || RS.save.data.gold < cost;
      btn.onclick = () => {
        if (RS.save.data.gold < cost || maxed) return;
        RS.save.data.gold -= cost;
        RS.save.data.upgrades[m.id] = lvl + 1;
        RS.save.write();
        RS.audio.play('coin');
        buildShop();
      };
      el.appendChild(btn);
      grid.appendChild(el);
    }
    updateGold();
  }

  // Reembolso con confirmación en dos clics (sin diálogos del navegador)
  let refundArmed = 0;
  function refundShop() {
    let total = 0;
    for (const m of D.META) {
      const lvl = RS.save.up(m.id);
      for (let i = 0; i < lvl; i++) total += m.cost * (i + 1);
    }
    const btn = $('#btn-refund');
    if (!total) {
      btn.textContent = 'Nada que reembolsar';
      setTimeout(() => (btn.textContent = 'Reembolsar'), 1500);
      return;
    }
    if (performance.now() - refundArmed > 4000) {
      refundArmed = performance.now();
      btn.textContent = '¿Seguro? Recuperas ◆ ' + total;
      setTimeout(() => {
        if (performance.now() - refundArmed >= 4000) btn.textContent = 'Reembolsar';
      }, 4100);
      return;
    }
    refundArmed = 0;
    btn.textContent = 'Reembolsar';
    RS.save.data.gold += total;
    RS.save.data.upgrades = {};
    RS.save.write();
    buildShop();
  }

  // --- Ayuda ---
  function buildHelp() {
    const rows = Object.keys(D.WEAPONS)
      .map((id) => {
        const w = D.WEAPONS[id], it = D.ITEMS[w.evo.item];
        return `<tr><td><i style="color:${w.color}">${w.icon}</i> ${w.name}</td><td><i style="color:${it.color}">${it.icon}</i> ${it.name}</td><td class="gold">${w.evo.name}</td></tr>`;
      })
      .join('');
    $('#evo-table').innerHTML = `<tr><th>Habilidad (Nv 5)</th><th>+ Objeto</th><th>= Evolución</th></tr>${rows}`;
  }

  // --- Partida ---
  function startRun() {
    RS.audio.ensure();
    Game.newRun(selectedChamp);
    input.keys = {};
    input.pressed = {};
    mode = 'playing';
    hideAll();
  }

  function pause() {
    if (mode !== 'playing') return;
    mode = 'paused';
    const g = Game.state, s = g.stats;
    const build = g.weapons
      .map((w) => {
        const d = D.WEAPONS[w.id];
        return `<li><i style="color:${d.color}">${d.icon}</i> ${w.evolved ? `<b class="gold">${d.evo.name}</b>` : `${d.name} <small>Nv ${w.level}</small>`}</li>`;
      })
      .concat(
        g.items.map((it) => {
          const d = D.ITEMS[it.id];
          return `<li><i style="color:${d.color}">${d.icon}</i> ${d.name} <small>Nv ${it.level}</small></li>`;
        })
      )
      .join('');
    $('#pause-build').innerHTML = build;
    const pct = (v) => Math.round(v * 100) + '%';
    $('#pause-stats').innerHTML = [
      ['Vida', Math.ceil(g.player.hp) + ' / ' + Math.round(s.maxHp)],
      ['Daño', pct(s.might)],
      ['Área', pct(s.area)],
      ['Enfriamiento', pct(s.cdMult)],
      ['Velocidad', Math.round(s.speed)],
      ['Armadura', s.armor],
      ['Crítico', pct(s.crit)],
      ['Regeneración', s.regen.toFixed(1) + '/s'],
      ['Recogida', Math.round(s.magnet)],
      ['Proyectiles', '+' + s.amount],
    ]
      .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
      .join('');
    show('screen-pause');
  }

  function resume() {
    if (!Game.state || Game.state.over) return;
    input.keys = {};
    mode = 'playing';
    hideAll();
  }

  function openChoices(kind) {
    const g = Game.state;
    choiceMode = kind;
    mode = 'levelup';
    choices = Game.buildChoices(3);
    $('#lu-title').textContent = kind === 'chest' ? '¡Cofre del jefe!' : '¡Subes de nivel!';
    $('#lu-sub').textContent = kind === 'chest' ? 'Elige una recompensa gratuita (+60 oro)' : 'Nivel ' + (g.level - g.pending + 1) + ' · Elige una mejora';
    const box = $('#lu-cards');
    box.innerHTML = '';
    choices.forEach((c, i) => {
      const d = Game.describe(c);
      const b = document.createElement('button');
      b.className = 'lu-card' + (d.evo ? ' evo' : '');
      b.style.setProperty('--c', d.color);
      b.innerHTML = `<div class="lu-icon">${d.icon}</div><div class="lu-text"><span class="lu-tag">${d.tag}</span><b>${d.name}</b><p>${d.desc}</p></div><kbd>${i + 1}</kbd>`;
      b.onclick = () => pick(i);
      box.appendChild(b);
    });
    const rr = $('#lu-reroll');
    rr.textContent = 'Cambiar opciones (' + g.rerolls + ')';
    rr.disabled = g.rerolls <= 0;
    $('#lu-skip').style.display = kind === 'chest' ? 'none' : '';
    show('screen-levelup');
  }

  function afterChoice() {
    const g = Game.state;
    if (g.pending > 0) openChoices('level');
    else resume();
  }

  function pick(i) {
    const c = choices[i];
    if (!c) return;
    Game.applyChoice(c);
    RS.audio.play('click');
    if (choiceMode === 'level') Game.state.pending--;
    afterChoice();
  }

  Game.hooks.onLevelUp = () => {
    if (mode === 'playing') openChoices('level');
  };
  Game.hooks.onChest = () => {
    openChoices('chest');
  };
  Game.hooks.onGameOver = (r) => {
    mode = 'gameover';
    setTimeout(() => {
      $('#go-title').textContent = r.won ? '¡Victoria!' : 'Derrota';
      $('#go-title').className = r.won ? 'win' : 'lose';
      $('#go-sub').textContent = r.won ? 'Has salvado la Grieta del Leviatán del Abismo.' : 'Las hordas del Vacío te han superado.';
      $('#go-stats').innerHTML = [
        ['Tiempo', U.fmtTime(r.time)],
        ['Bajas', r.kills],
        ['Nivel', r.level],
        ['Evoluciones', r.evolutions],
        ['Daño total', Math.round(r.damage).toLocaleString('es-ES')],
        ['Oro ganado', '◆ ' + r.gold],
      ]
        .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
        .join('');
      updateGold();
      show('screen-gameover');
    }, 700);
  };

  // ------------------------------------------------------------------
  // Botones
  // ------------------------------------------------------------------
  function on(id, fn) {
    $(id).addEventListener('click', () => {
      RS.audio.ensure();
      RS.audio.play('click');
      fn();
    });
  }
  on('#btn-play', () => {
    buildSelect();
    mode = 'select';
    show('screen-select');
  });
  on('#btn-shop', () => {
    buildShop();
    mode = 'shop';
    show('screen-shop');
  });
  on('#btn-help', () => {
    buildHelp();
    mode = 'help';
    show('screen-help');
  });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => {
    RS.audio.play('click');
    goMenu();
  }));
  on('#btn-start', startRun);
  on('#btn-refund', refundShop);
  on('#btn-resume', resume);
  on('#btn-quit', () => Game.abandon());
  on('#btn-retry', () => {
    startRun();
  });
  on('#btn-menu', goMenu);
  on('#lu-reroll', () => {
    const g = Game.state;
    if (g.rerolls <= 0) return;
    g.rerolls--;
    openChoices(choiceMode);
  });
  on('#lu-skip', () => {
    Game.state.gold += 10;
    Game.state.pending--;
    afterChoice();
  });
  const soundBtn = $('#btn-sound');
  function syncSound() {
    soundBtn.textContent = RS.audio.muted ? '🔇 Sonido: no' : '🔊 Sonido: sí';
  }
  soundBtn.addEventListener('click', () => {
    RS.audio.ensure();
    RS.audio.setMuted(!RS.audio.muted);
    RS.save.data.muted = RS.audio.muted;
    RS.save.write();
    syncSound();
  });

  // ------------------------------------------------------------------
  // Arranque y bucle
  // ------------------------------------------------------------------
  RS.save.load();
  RS.audio.setMuted(RS.save.data.muted);
  syncSound();
  Game.init(canvas);
  window.addEventListener('resize', () => Game.resize());
  goMenu();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      if (mode === 'playing') Game.update(dt);
      Game.render(now);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  RS.ui = { get mode() { return mode; }, startRun, pick, pause, resume, select: (id) => (selectedChamp = id) };
})();
