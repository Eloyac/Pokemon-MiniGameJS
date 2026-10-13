'use strict';
// Dibujado procedural de campeones, enemigos y jefes (diseños originales, sin imágenes externas)
RS.Draw = (function () {
  const TAU = Math.PI * 2;

  function shadow(ctx, x, y, rx, ry) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lw || 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  // ---------- Campeones ----------
  // facing: 1 derecha, -1 izquierda. moving: anima el balanceo.
  function champion(ctx, id, x, y, scale, facing, t, moving, flash) {
    const bob = moving ? Math.sin(t * 12) * 1.6 : Math.sin(t * 3) * 0.8;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * facing, scale);
    shadow(ctx, 0, 16, 15, 5);
    ctx.translate(0, bob);
    const F = (c) => (flash ? '#ffffff' : c);
    switch (id) {
      case 'kaelen': {
        // Capa
        ctx.fillStyle = F('#9c2b23');
        ctx.beginPath();
        ctx.moveTo(-6, -8);
        ctx.quadraticCurveTo(-20, 6 + Math.sin(t * 8) * 2, -14, 16);
        ctx.lineTo(2, 12);
        ctx.closePath();
        ctx.fill();
        // Cuerpo con armadura
        ctx.fillStyle = F('#d9a441');
        ctx.beginPath();
        ctx.ellipse(0, 4, 11, 12, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = F('#b07f26');
        ctx.fillRect(-11, 4, 22, 3);
        // Casco
        circle(ctx, 1, -10, 9, F('#e8c46a'), F('#8a6216'), 1.5);
        ctx.fillStyle = '#2a1a0a';
        ctx.fillRect(2, -11, 8, 3);
        // Penacho
        ctx.fillStyle = F('#c0392b');
        ctx.beginPath();
        ctx.moveTo(-2, -18);
        ctx.quadraticCurveTo(-12, -24, -14, -12);
        ctx.quadraticCurveTo(-8, -16, -2, -14);
        ctx.fill();
        // Espada
        ctx.save();
        ctx.translate(13, 8);
        ctx.rotate(0.45 + (moving ? Math.sin(t * 12) * 0.15 : 0));
        ctx.fillStyle = F('#dfe6ee');
        ctx.fillRect(-2, -26, 4, 24);
        ctx.beginPath();
        ctx.moveTo(-2, -26);
        ctx.lineTo(0, -31);
        ctx.lineTo(2, -26);
        ctx.fill();
        ctx.fillStyle = F('#c9962c');
        ctx.fillRect(-6, -3, 12, 3);
        ctx.fillStyle = F('#5d3a12');
        ctx.fillRect(-1.5, 0, 3, 6);
        ctx.restore();
        break;
      }
      case 'nimra': {
        // Bastón con orbe flotante
        ctx.strokeStyle = F('#6b4a2b');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(12, 14);
        ctx.lineTo(14, -18);
        ctx.stroke();
        const glow = 0.6 + Math.sin(t * 5) * 0.3;
        ctx.fillStyle = `rgba(120,230,255,${0.25 * glow})`;
        circle(ctx, 14, -24, 9, ctx.fillStyle);
        circle(ctx, 14, -24, 4.5, F('#9ff0ff'));
        // Túnica
        ctx.fillStyle = F('#5b3fb0');
        ctx.beginPath();
        ctx.moveTo(-12, 16);
        ctx.quadraticCurveTo(-10, -2, 0, -6);
        ctx.quadraticCurveTo(10, -2, 12, 16);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = F('#f0c75e');
        ctx.fillRect(-12, 13, 24, 3);
        // Capucha
        ctx.fillStyle = F('#3d2780');
        ctx.beginPath();
        ctx.moveTo(-10, -6);
        ctx.quadraticCurveTo(-8, -24, 4, -22);
        ctx.quadraticCurveTo(12, -16, 10, -6);
        ctx.closePath();
        ctx.fill();
        circle(ctx, 2, -11, 6, F('#f2d2b6'));
        // Ojos brillantes
        ctx.fillStyle = '#7ff6ff';
        ctx.fillRect(3, -12, 2, 2);
        ctx.fillRect(6, -12, 2, 2);
        break;
      }
      case 'seryn': {
        // Carcaj
        ctx.fillStyle = F('#6d4c2f');
        ctx.save();
        ctx.rotate(-0.4);
        ctx.fillRect(-12, -10, 6, 18);
        ctx.fillStyle = F('#e9e2c9');
        ctx.fillRect(-11, -14, 1.5, 5);
        ctx.fillRect(-8.5, -15, 1.5, 6);
        ctx.restore();
        // Cuerpo / capa verde
        ctx.fillStyle = F('#2e7d50');
        ctx.beginPath();
        ctx.moveTo(-11, 15);
        ctx.quadraticCurveTo(-9, -4, 0, -6);
        ctx.quadraticCurveTo(9, -4, 10, 15);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = F('#8d6e3f');
        ctx.fillRect(-9, 4, 18, 3);
        // Cabeza y capucha
        circle(ctx, 1, -11, 7, F('#e9c6a5'));
        ctx.fillStyle = F('#1f5c39');
        ctx.beginPath();
        ctx.arc(0, -12, 8.5, Math.PI * 1.05, Math.PI * 1.95);
        ctx.lineTo(-8, -6);
        ctx.fill();
        ctx.fillStyle = '#20302a';
        ctx.fillRect(4, -12, 2, 2);
        // Arco
        ctx.strokeStyle = F('#8b5a2b');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(9, 2, 15, -1.1, 1.1);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(240,240,220,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(9 + Math.cos(-1.1) * 15, 2 + Math.sin(-1.1) * 15);
        ctx.lineTo(9 + Math.cos(1.1) * 15, 2 + Math.sin(1.1) * 15);
        ctx.stroke();
        break;
      }
      case 'brakka':
      default: {
        // Cuerpo de piedra
        ctx.fillStyle = F('#6f8296');
        ctx.beginPath();
        ctx.moveTo(-15, 14);
        ctx.lineTo(-16, -2);
        ctx.lineTo(-9, -12);
        ctx.lineTo(8, -13);
        ctx.lineTo(15, -2);
        ctx.lineTo(14, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = F('#4b5b6b');
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Grietas brillantes
        ctx.strokeStyle = '#7fe7ff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-8, 6);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, -6);
        ctx.stroke();
        // Cabeza
        ctx.fillStyle = F('#8aa0b4');
        ctx.fillRect(-4, -22, 13, 11);
        ctx.fillStyle = '#7fe7ff';
        ctx.fillRect(3, -18, 3, 2);
        ctx.fillRect(7, -18, 2, 2);
        // Escudo
        circle(ctx, 13, 3, 11, F('#b0a089'), F('#5a4d3d'), 2);
        circle(ctx, 13, 3, 4, F('#7fe7ff'));
        break;
      }
    }
    ctx.restore();
  }

  // ---------- Enemigos ----------
  function enemy(ctx, e, t) {
    const fl = e.flash > 0;
    const F = (c) => (fl ? '#ffffff' : c);
    const r = e.r;
    const face = e.face || 1;
    const wob = Math.sin(t * 10 + e.anim) * 1.2;
    ctx.save();
    ctx.translate(e.x, e.y);
    shadow(ctx, 0, r * 0.85, r * 0.9, r * 0.32);
    if (e.stun > 0) {
      ctx.fillStyle = '#ffe066';
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + (i * TAU) / 3;
        circle(ctx, Math.cos(a) * r * 0.7, -r - 6 + Math.sin(a) * 3, 2.2, '#ffe066');
      }
    }
    ctx.scale(face, 1);
    switch (e.type) {
      case 'melee':
      case 'caster':
      case 'brute': {
        const s = r / 13;
        ctx.scale(s, s);
        ctx.translate(0, wob * 0.5);
        circle(ctx, 0, 2, 11, F(e.color));
        // casco
        ctx.fillStyle = F(e.type === 'brute' ? '#2c0f4a' : '#3b1d63');
        ctx.beginPath();
        ctx.arc(0, -1, 11.5, Math.PI, 0);
        ctx.fill();
        if (e.type === 'brute') {
          ctx.fillStyle = F('#c9b37a');
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(i * 6 - 2, -10);
            ctx.lineTo(i * 6, -18);
            ctx.lineTo(i * 6 + 2, -10);
            ctx.fill();
          }
        }
        ctx.fillStyle = '#ffd34d';
        ctx.fillRect(2, 0, 3, 3);
        ctx.fillRect(6, 0, 2.5, 3);
        if (e.type === 'caster') {
          const g = 0.5 + Math.sin(t * 6 + e.anim) * 0.3;
          circle(ctx, 12, -8, 6, `rgba(220,140,255,${g * 0.4})`);
          circle(ctx, 12, -8, 3, '#f0b8ff');
        } else {
          ctx.fillStyle = F('#c8ccd4');
          ctx.fillRect(9, -6, 3, 14);
        }
        break;
      }
      case 'siege': {
        ctx.translate(0, wob * 0.3);
        ctx.fillStyle = F('#5d4037');
        ctx.fillRect(-r, -r * 0.5, r * 2, r * 1.1);
        ctx.fillStyle = F('#7a4bc2');
        ctx.fillRect(-r, -r * 0.7, r * 2, r * 0.35);
        ctx.fillStyle = F('#333');
        ctx.fillRect(r * 0.2, -r * 0.35, r * 1.1, r * 0.4);
        circle(ctx, -r * 0.55, r * 0.65, r * 0.32, F('#2b2b2b'), '#111', 1);
        circle(ctx, r * 0.55, r * 0.65, r * 0.32, F('#2b2b2b'), '#111', 1);
        break;
      }
      case 'wolf': {
        ctx.translate(0, wob * 0.6);
        ctx.fillStyle = F(e.color);
        ctx.beginPath();
        ctx.ellipse(-2, 2, r * 1.1, r * 0.7, 0, 0, TAU);
        ctx.fill();
        circle(ctx, r * 0.8, -3, r * 0.55, F('#5c6372'));
        ctx.beginPath();
        ctx.moveTo(r * 0.6, -r * 0.7);
        ctx.lineTo(r * 0.75, -r * 1.3);
        ctx.lineTo(r * 1.0, -r * 0.7);
        ctx.fill();
        ctx.fillStyle = '#ff4d4d';
        ctx.fillRect(r * 0.95, -5, 3, 2);
        // cola
        ctx.strokeStyle = F(e.color);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.quadraticCurveTo(-r * 1.6, -r * 0.6 + wob, -r * 1.7, -r * 1.1);
        ctx.stroke();
        break;
      }
      case 'wraith': {
        ctx.globalAlpha = 0.85;
        ctx.translate(0, Math.sin(t * 4 + e.anim) * 3 - 4);
        ctx.fillStyle = F(e.color);
        ctx.beginPath();
        ctx.arc(0, -2, r, Math.PI, 0);
        for (let i = 0; i <= 4; i++) {
          const x = r - (i * 2 * r) / 4;
          ctx.lineTo(x, r + (i % 2 ? -4 : 2) + Math.sin(t * 8 + i) * 2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#1b2a40';
        ctx.fillRect(1, -5, 3, 4);
        ctx.fillRect(6, -5, 3, 4);
        ctx.globalAlpha = 1;
        break;
      }
      case 'golem': {
        ctx.translate(0, wob * 0.3);
        ctx.fillStyle = F(e.color);
        ctx.beginPath();
        const pts = 8;
        for (let i = 0; i < pts; i++) {
          const a = (i / pts) * TAU;
          const rr = r * (0.85 + ((i * 37) % 7) / 30);
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ff9a3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.2);
        ctx.lineTo(-r * 0.1, r * 0.2);
        ctx.lineTo(r * 0.3, -r * 0.1);
        ctx.stroke();
        ctx.fillStyle = '#ffb347';
        ctx.fillRect(r * 0.25, -r * 0.45, 4, 4);
        ctx.fillRect(r * 0.5, -r * 0.45, 4, 4);
        break;
      }
      default:
        circle(ctx, 0, 0, r, F(e.color));
    }
    ctx.restore();
  }

  // ---------- Jefes ----------
  function boss(ctx, b, t) {
    const fl = b.flash > 0;
    const F = (c) => (fl ? '#ffffff' : c);
    const r = b.r;
    ctx.save();
    ctx.translate(b.x, b.y);
    shadow(ctx, 0, r * 0.9, r, r * 0.35);
    // aura
    const pulse = 0.5 + Math.sin(t * 4) * 0.2;
    ctx.fillStyle = hexA(b.color, 0.18 * pulse);
    circle(ctx, 0, 0, r * 1.35, ctx.fillStyle);
    ctx.scale(b.face || 1, 1);
    switch (b.type) {
      case 'drake':
      case 'elder': {
        const body = b.type === 'drake' ? '#d84b23' : '#3fb8ac';
        const belly = b.type === 'drake' ? '#ffb347' : '#c8fff4';
        const flap = Math.sin(t * 6) * 0.5;
        // alas
        ctx.fillStyle = F(b.type === 'drake' ? '#8e2a14' : '#22786f');
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.scale(1, side);
          ctx.rotate(flap * 0.6);
          ctx.beginPath();
          ctx.moveTo(-r * 0.2, -r * 0.2);
          ctx.lineTo(-r * 0.6, -r * 1.5);
          ctx.lineTo(r * 0.1, -r * 1.1);
          ctx.lineTo(r * 0.4, -r * 0.3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        // cola
        ctx.strokeStyle = F(body);
        ctx.lineWidth = r * 0.25;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, r * 0.1);
        ctx.quadraticCurveTo(-r * 1.3, r * 0.5 + flap * 10, -r * 1.5, -r * 0.1);
        ctx.stroke();
        // cuerpo
        ctx.fillStyle = F(body);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.75, r * 0.55, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = F(belly);
        ctx.beginPath();
        ctx.ellipse(r * 0.05, r * 0.15, r * 0.45, r * 0.28, 0, 0, TAU);
        ctx.fill();
        // cabeza
        circle(ctx, r * 0.75, -r * 0.35, r * 0.35, F(body));
        ctx.fillStyle = F('#f5e6c8');
        for (const dy of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(r * 0.6, -r * 0.6 + dy * 4);
          ctx.lineTo(r * 0.4, -r * 0.95 + dy * 2);
          ctx.lineTo(r * 0.7, -r * 0.62 + dy * 4);
          ctx.fill();
        }
        ctx.fillStyle = b.type === 'drake' ? '#ffe14d' : '#ffffff';
        ctx.fillRect(r * 0.85, -r * 0.45, 5, 4);
        break;
      }
      case 'herald': {
        // tentáculos
        ctx.strokeStyle = F('#4a1a7a');
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + t * 0.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
          ctx.quadraticCurveTo(
            Math.cos(a + 0.4) * r * 1.1,
            Math.sin(a + 0.4) * r * 1.1 + Math.sin(t * 5 + i) * 6,
            Math.cos(a + 0.2) * r * 1.4,
            Math.sin(a + 0.2) * r * 1.4
          );
          ctx.stroke();
        }
        circle(ctx, 0, 0, r * 0.85, F('#6a2bb0'), F('#2e0c52'), 3);
        // placas
        ctx.fillStyle = F('#8e4fd8');
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.22, 0, TAU);
          ctx.fill();
        }
        // ojo
        circle(ctx, 0, 0, r * 0.32, '#f2f2f2');
        circle(ctx, r * 0.08, 0, r * 0.16, b.charging ? '#ff2d55' : '#c040ff');
        circle(ctx, r * 0.1, 0, r * 0.07, '#120018');
        break;
      }
      case 'colossus': {
        ctx.fillStyle = F('#8d8478');
        ctx.beginPath();
        const pts = 11;
        for (let i = 0; i < pts; i++) {
          const a = (i / pts) * TAU;
          const rr = r * (0.82 + ((i * 53) % 9) / 40);
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = F('#5a534a');
        ctx.lineWidth = 3;
        ctx.stroke();
        // brazos
        circle(ctx, r * 0.9, r * 0.25, r * 0.35, F('#7a7268'), F('#5a534a'), 2);
        circle(ctx, -r * 0.9, r * 0.25, r * 0.35, F('#7a7268'), F('#5a534a'), 2);
        // runas
        ctx.strokeStyle = `rgba(120,255,200,${0.6 + Math.sin(t * 3) * 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 0.1);
        ctx.lineTo(-r * 0.1, r * 0.3);
        ctx.lineTo(r * 0.2, -r * 0.05);
        ctx.lineTo(r * 0.45, r * 0.3);
        ctx.stroke();
        ctx.fillStyle = '#7dffc8';
        ctx.fillRect(r * 0.15, -r * 0.45, 8, 6);
        ctx.fillRect(r * 0.45, -r * 0.45, 8, 6);
        break;
      }
      case 'leviathan':
      default: {
        ctx.strokeStyle = F('#2e0a4a');
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + Math.sin(t + i) * 0.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
          ctx.quadraticCurveTo(
            Math.cos(a + 0.5) * r * 1.2,
            Math.sin(a + 0.5) * r * 1.2,
            Math.cos(a + 0.3) * r * (1.45 + Math.sin(t * 3 + i) * 0.1),
            Math.sin(a + 0.3) * r * (1.45 + Math.sin(t * 3 + i) * 0.1)
          );
          ctx.stroke();
        }
        const grd = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
        grd.addColorStop(0, fl ? '#fff' : '#9b3fe0');
        grd.addColorStop(1, fl ? '#fff' : '#30084f');
        circle(ctx, 0, 0, r, grd);
        // muchos ojos
        const eyes = [
          [0.35, -0.25, 0.16],
          [-0.2, -0.35, 0.11],
          [0.05, 0.25, 0.13],
          [-0.4, 0.15, 0.09],
          [0.45, 0.3, 0.08],
        ];
        for (const [ex, ey, er] of eyes) {
          circle(ctx, ex * r, ey * r, er * r, '#ffe9ff');
          circle(ctx, ex * r + er * r * 0.3, ey * r, er * r * 0.5, b.enraged ? '#ff2244' : '#ff7ad9');
        }
        break;
      }
    }
    ctx.restore();
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // Retrato para la pantalla de selección
  function portrait(canvas, id) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h * 0.55, 4, w / 2, h * 0.55, w * 0.6);
    g.addColorStop(0, hexA(RS.data.CHAMPIONS[id].color, 0.55));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    champion(ctx, id, w / 2, h * 0.58, w / 40, 1, 0, false, false);
  }

  return { champion, enemy, boss, portrait, hexA, circle };
})();
