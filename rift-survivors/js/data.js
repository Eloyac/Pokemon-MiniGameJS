'use strict';
// Datos del juego: campeones, habilidades, objetos, enemigos, jefes y mejoras permanentes.
// Todos los personajes y nombres son originales, inspirados en el género MOBA.
RS.data = (function () {
  const CHAMPIONS = {
    kaelen: {
      id: 'kaelen',
      name: 'Kaelen',
      title: 'El Filo del Alba',
      role: 'Luchador',
      color: '#d9a441',
      hp: 140,
      speed: 150,
      armor: 2,
      regen: 0,
      start: 'cleave',
      passive: { name: 'Valor', desc: '+10% de daño.' },
      mod(s) {
        s.might += 0.1;
      },
      ult: {
        id: 'dawn',
        name: 'Juicio del Alba',
        desc: 'Gira durante 3 s infligiendo daño masivo a su alrededor y recibiendo la mitad de daño.',
      },
    },
    nimra: {
      id: 'nimra',
      name: 'Nimra',
      title: 'Tejedora Arcana',
      role: 'Maga',
      color: '#8a6cf0',
      hp: 90,
      speed: 150,
      armor: 0,
      regen: 0,
      start: 'orb',
      passive: { name: 'Erudición', desc: '+15% de área y -5% de enfriamiento.' },
      mod(s) {
        s.area += 0.15;
        s.cdMult -= 0.05;
      },
      ult: {
        id: 'nova',
        name: 'Supernova Arcana',
        desc: 'Concentra energía y desata una explosión gigantesca alrededor.',
      },
    },
    seryn: {
      id: 'seryn',
      name: 'Seryn',
      title: 'Flecha del Ocaso',
      role: 'Tiradora',
      color: '#4caf7a',
      hp: 100,
      speed: 165,
      armor: 0,
      regen: 0,
      start: 'arrow',
      passive: { name: 'Puntería', desc: '+10% de probabilidad de crítico y +15% de velocidad de proyectil.' },
      mod(s) {
        s.crit += 0.1;
        s.projSpeed += 0.15;
      },
      ult: {
        id: 'volley',
        name: 'Lluvia del Ocaso',
        desc: 'Durante 4 s una lluvia de flechas cae sobre los enemigos cercanos.',
      },
    },
    brakka: {
      id: 'brakka',
      name: 'Brakka',
      title: 'Muralla de Piedra',
      role: 'Tanque',
      color: '#7c93a8',
      hp: 200,
      speed: 135,
      armor: 4,
      regen: 1,
      start: 'shockwave',
      passive: { name: 'Piel de Piedra', desc: 'Regenera 1 de vida por segundo.' },
      mod() {},
      ult: {
        id: 'quake',
        name: 'Fractura Tectónica',
        desc: 'Aturde y daña a todos los enemigos cercanos y obtiene un escudo.',
      },
    },
  };

  // Habilidades (armas automáticas). Cada nivel define sus estadísticas.
  const WEAPONS = {
    cleave: {
      name: 'Tajo Feroz',
      icon: '⚔',
      color: '#e0b04a',
      desc: 'Corta en arco hacia el enemigo más cercano.',
      lv: [
        { dmg: 14, cd: 1.2, range: 85, arc: 2.0, dirs: 1, knock: 140 },
        { dmg: 18, cd: 1.15, range: 85, arc: 2.0, dirs: 1, knock: 140 },
        { dmg: 20, cd: 1.1, range: 90, arc: 2.0, dirs: 2, knock: 150 },
        { dmg: 26, cd: 1.0, range: 105, arc: 2.1, dirs: 2, knock: 160 },
        { dmg: 34, cd: 0.85, range: 110, arc: 2.2, dirs: 2, knock: 170 },
      ],
      ups: ['', '+4 daño', 'Corta también hacia atrás', '+6 daño y +15% alcance', '+8 daño y menos enfriamiento'],
      evo: {
        item: 'longsword',
        name: 'Hoja del Juicio',
        desc: 'Un tajo circular devastador alrededor del campeón.',
        stats: { dmg: 55, cd: 0.8, range: 140, arc: Math.PI * 2, dirs: 1, knock: 220 },
      },
    },
    orb: {
      name: 'Orbe Arcano',
      icon: '✦',
      color: '#a98bff',
      desc: 'Dispara orbes que persiguen a los enemigos.',
      lv: [
        { dmg: 11, cd: 1.3, count: 1, speed: 320, pierce: 0, explode: 0 },
        { dmg: 14, cd: 1.2, count: 1, speed: 340, pierce: 0, explode: 0 },
        { dmg: 15, cd: 1.15, count: 2, speed: 340, pierce: 0, explode: 0 },
        { dmg: 19, cd: 1.0, count: 2, speed: 360, pierce: 1, explode: 0 },
        { dmg: 24, cd: 0.9, count: 3, speed: 380, pierce: 1, explode: 0 },
      ],
      ups: ['', '+3 daño', '+1 orbe', '+4 daño y atraviesa 1 enemigo', '+1 orbe y +5 daño'],
      evo: {
        item: 'tome',
        name: 'Lluvia Estelar',
        desc: 'Cinco estrellas buscadoras que estallan al impactar.',
        stats: { dmg: 32, cd: 0.75, count: 5, speed: 420, pierce: 2, explode: 55 },
      },
    },
    arrow: {
      name: 'Flecha Perforante',
      icon: '➶',
      color: '#7fe0a0',
      desc: 'Flechas rápidas que atraviesan enemigos en línea.',
      lv: [
        { dmg: 15, cd: 1.0, count: 1, pierce: 2, spread: 0.12 },
        { dmg: 19, cd: 0.95, count: 1, pierce: 3, spread: 0.12 },
        { dmg: 21, cd: 0.9, count: 2, pierce: 3, spread: 0.12 },
        { dmg: 26, cd: 0.8, count: 2, pierce: 4, spread: 0.12 },
        { dmg: 32, cd: 0.7, count: 3, pierce: 5, spread: 0.12 },
      ],
      ups: ['', '+4 daño y atraviesa +1', '+1 flecha', '+5 daño y atraviesa +1', '+1 flecha y +6 daño'],
      evo: {
        item: 'dagger',
        name: 'Tormenta de Flechas',
        desc: 'Un abanico de flechas que lo atraviesa todo.',
        stats: { dmg: 42, cd: 0.6, count: 7, pierce: 999, spread: 0.16 },
      },
    },
    shockwave: {
      name: 'Onda Sísmica',
      icon: '◎',
      color: '#c9a27a',
      desc: 'Golpea el suelo y daña a los enemigos a tu alrededor.',
      lv: [
        { dmg: 12, cd: 2.2, r: 95, stun: 0 },
        { dmg: 15, cd: 2.0, r: 105, stun: 0 },
        { dmg: 19, cd: 1.9, r: 115, stun: 0.2 },
        { dmg: 24, cd: 1.7, r: 125, stun: 0.3 },
        { dmg: 30, cd: 1.5, r: 140, stun: 0.4 },
      ],
      ups: ['', '+3 daño y más radio', 'Aturde brevemente', '+5 daño y más radio', '+6 daño y más radio'],
      evo: {
        item: 'armor',
        name: 'Terremoto Ancestral',
        desc: 'Ondas enormes que aturden a todo lo que tocan.',
        stats: { dmg: 60, cd: 1.3, r: 230, stun: 0.8 },
      },
    },
    blades: {
      name: 'Hojas Espectrales',
      icon: '✧',
      color: '#7fd6ff',
      desc: 'Hojas que orbitan a tu alrededor durante unos segundos.',
      lv: [
        { dmg: 9, cd: 5, dur: 3, count: 2, radius: 80, spin: 3.2, size: 14 },
        { dmg: 11, cd: 5, dur: 3.5, count: 2, radius: 85, spin: 3.4, size: 14 },
        { dmg: 13, cd: 5, dur: 3.5, count: 3, radius: 90, spin: 3.6, size: 15 },
        { dmg: 16, cd: 5, dur: 4, count: 3, radius: 95, spin: 3.8, size: 16 },
        { dmg: 20, cd: 5, dur: 4.5, count: 4, radius: 100, spin: 4.0, size: 17 },
      ],
      ups: ['', '+2 daño y más duración', '+1 hoja', '+3 daño y más duración', '+1 hoja y +4 daño'],
      evo: {
        item: 'boots',
        name: 'Torbellino Espectral',
        desc: 'Seis hojas orbitan sin descanso.',
        stats: { dmg: 28, cd: 9999, dur: 9999, count: 6, radius: 115, spin: 4.6, size: 19 },
      },
    },
    chain: {
      name: 'Cadena Eléctrica',
      icon: 'ϟ',
      color: '#ffe66b',
      desc: 'Un rayo que salta entre enemigos cercanos.',
      lv: [
        { dmg: 12, cd: 1.6, jumps: 2, chains: 1 },
        { dmg: 15, cd: 1.5, jumps: 3, chains: 1 },
        { dmg: 18, cd: 1.4, jumps: 4, chains: 1 },
        { dmg: 23, cd: 1.3, jumps: 5, chains: 1 },
        { dmg: 28, cd: 1.15, jumps: 6, chains: 1 },
      ],
      ups: ['', '+3 daño y +1 salto', '+3 daño y +1 salto', '+5 daño y +1 salto', '+5 daño y +1 salto'],
      evo: {
        item: 'lens',
        name: 'Tempestad',
        desc: 'Tres rayos que encadenan hasta 9 enemigos.',
        stats: { dmg: 42, cd: 0.95, jumps: 9, chains: 3 },
      },
    },
    trail: {
      name: 'Rastro Tóxico',
      icon: '☣',
      color: '#9be15d',
      desc: 'Deja charcos venenosos a tu paso.',
      lv: [
        { dps: 9, cd: 1.0, r: 38, dur: 3, slow: 0 },
        { dps: 12, cd: 0.9, r: 42, dur: 3, slow: 0 },
        { dps: 15, cd: 0.85, r: 46, dur: 3.5, slow: 0.2 },
        { dps: 19, cd: 0.75, r: 50, dur: 3.5, slow: 0.25 },
        { dps: 24, cd: 0.65, r: 56, dur: 4, slow: 0.3 },
      ],
      ups: ['', '+3 daño/s', 'Ralentiza a los enemigos', '+4 daño/s y más tamaño', '+5 daño/s y más duración'],
      evo: {
        item: 'pendant',
        name: 'Plaga Nociva',
        desc: 'Charcos enormes que ralentizan mucho y corroen sin piedad.',
        stats: { dps: 45, cd: 0.5, r: 85, dur: 4.5, slow: 0.5 },
      },
    },
    meteor: {
      name: 'Meteoro',
      icon: '☄',
      color: '#ff8a4c',
      desc: 'Invoca meteoros sobre enemigos aleatorios.',
      lv: [
        { dmg: 26, cd: 2.6, count: 1, r: 60, burn: 0 },
        { dmg: 33, cd: 2.4, count: 1, r: 65, burn: 0 },
        { dmg: 36, cd: 2.2, count: 2, r: 70, burn: 0 },
        { dmg: 46, cd: 2.0, count: 2, r: 80, burn: 0 },
        { dmg: 56, cd: 1.8, count: 3, r: 90, burn: 0 },
      ],
      ups: ['', '+7 daño', '+1 meteoro', '+10 daño y más radio', '+1 meteoro y +10 daño'],
      evo: {
        item: 'crown',
        name: 'Cataclismo',
        desc: 'Una lluvia de meteoros que deja el suelo en llamas.',
        stats: { dmg: 100, cd: 1.6, count: 6, r: 110, burn: 25 },
      },
    },
    glaive: {
      name: 'Guja Bumerán',
      icon: '✪',
      color: '#ff6b81',
      desc: 'Lanza una guja que vuelve a ti golpeando todo a su paso.',
      lv: [
        { dmg: 13, cd: 2.0, count: 1, dist: 240, size: 14, ls: 0 },
        { dmg: 16, cd: 1.9, count: 1, dist: 260, size: 15, ls: 0 },
        { dmg: 18, cd: 1.8, count: 2, dist: 260, size: 15, ls: 0 },
        { dmg: 23, cd: 1.6, count: 2, dist: 290, size: 17, ls: 0 },
        { dmg: 29, cd: 1.4, count: 3, dist: 310, size: 18, ls: 0 },
      ],
      ups: ['', '+3 daño y más alcance', '+1 guja', '+5 daño y más alcance', '+1 guja y +6 daño'],
      evo: {
        item: 'ruby',
        name: 'Rueda Carmesí',
        desc: 'Cuatro ruedas enormes que te curan al golpear.',
        stats: { dmg: 48, cd: 1.3, count: 4, dist: 340, size: 24, ls: 0.6 },
      },
    },
  };

  // Objetos pasivos
  const ITEMS = {
    longsword: { name: 'Hoja Afilada', icon: '†', color: '#e57373', max: 5, desc: '+10% de daño por nivel.', apply: (s, l) => (s.might += 0.1 * l) },
    tome: { name: 'Tomo Arcano', icon: '▥', color: '#9575cd', max: 5, desc: '+10% de área por nivel.', apply: (s, l) => (s.area += 0.1 * l) },
    dagger: { name: 'Daga Veloz', icon: '‡', color: '#4dd0e1', max: 5, desc: '-7% de enfriamiento por nivel.', apply: (s, l) => (s.cdMult -= 0.07 * l) },
    boots: { name: 'Botas Aladas', icon: '»', color: '#a1887f', max: 5, desc: '+8% de velocidad por nivel.', apply: (s, l) => (s.speed *= 1 + 0.08 * l) },
    ruby: { name: 'Corazón de Rubí', icon: '♥', color: '#ef5350', max: 5, desc: '+25 de vida máxima por nivel.', apply: (s, l) => (s.maxHp += 25 * l) },
    armor: { name: 'Coraza de Malla', icon: '▣', color: '#90a4ae', max: 5, desc: '+1 de armadura por nivel.', apply: (s, l) => (s.armor += l) },
    lens: { name: 'Lente del Vigía', icon: '◉', color: '#4fc3f7', max: 5, desc: '+30% de radio de recogida por nivel.', apply: (s, l) => (s.magnet *= 1 + 0.3 * l) },
    pendant: { name: 'Amuleto Vital', icon: '❦', color: '#81c784', max: 5, desc: '+0.4 de regeneración/s por nivel.', apply: (s, l) => (s.regen += 0.4 * l) },
    crown: { name: 'Corona del Sabio', icon: '♛', color: '#ffd54f', max: 5, desc: '+8% de experiencia y +5% de oro por nivel.', apply: (s, l) => { s.growth += 0.08 * l; s.greed += 0.05 * l; } },
    prism: { name: 'Prisma Gemelo', icon: '◈', color: '#f48fb1', max: 2, desc: '+1 proyectil a todas las habilidades por nivel.', apply: (s, l) => (s.amount += l) },
  };

  // Enemigos comunes
  const ENEMIES = {
    melee: { name: 'Súbdito', hp: 10, speed: 72, dmg: 8, r: 13, xp: 1, color: '#7a4bc2' },
    caster: { name: 'Súbdito hechicero', hp: 8, speed: 62, dmg: 6, r: 12, xp: 2, color: '#9c5ed6', ranged: { keep: 230, cd: 2.8, speed: 190, dmg: 7 } },
    wolf: { name: 'Lobo sombrío', hp: 14, speed: 118, dmg: 7, r: 12, xp: 2, color: '#4a4f5c' },
    siege: { name: 'Súbdito de asedio', hp: 70, speed: 46, dmg: 15, r: 19, xp: 6, color: '#6d4c41' },
    wraith: { name: 'Espectro', hp: 26, speed: 98, dmg: 9, r: 13, xp: 3, color: '#b6e3f2' },
    golem: { name: 'Gólem de roca', hp: 160, speed: 40, dmg: 20, r: 25, xp: 12, color: '#7d6e5f' },
    brute: { name: 'Súbdito colosal', hp: 320, speed: 56, dmg: 26, r: 23, xp: 18, color: '#5b2a86' },
  };

  // Jefes, en orden de aparición (segundos)
  const BOSSES = [
    { at: 180, type: 'drake', name: 'Draco de Magma', hp: 850, r: 44, speed: 72, dmg: 22, color: '#e0562b', xp: 80 },
    { at: 360, type: 'herald', name: 'Heraldo del Vacío', hp: 2400, r: 46, speed: 82, dmg: 28, color: '#8b3fd1', xp: 140 },
    { at: 540, type: 'colossus', name: 'Coloso de Piedra', hp: 5000, r: 58, speed: 55, dmg: 36, color: '#8d8478', xp: 220 },
    { at: 720, type: 'elder', name: 'Draco Ancestral', hp: 9000, r: 50, speed: 88, dmg: 40, color: '#4fd1c5', xp: 320 },
    { at: 900, type: 'leviathan', name: 'Leviatán del Abismo', hp: 22000, r: 72, speed: 66, dmg: 50, color: '#5e1d8f', xp: 0, final: true },
  ];

  const META = [
    { id: 'might', name: 'Poder', icon: '†', desc: '+5% de daño', max: 5, cost: 60 },
    { id: 'hp', name: 'Vitalidad', icon: '♥', desc: '+10 de vida máxima', max: 5, cost: 50 },
    { id: 'armor', name: 'Blindaje', icon: '▣', desc: '+1 de armadura', max: 3, cost: 90 },
    { id: 'speed', name: 'Celeridad', icon: '»', desc: '+5% de velocidad', max: 3, cost: 60 },
    { id: 'cooldown', name: 'Presteza', icon: '‡', desc: '-3% de enfriamiento', max: 3, cost: 100 },
    { id: 'magnet', name: 'Atracción', icon: '◉', desc: '+15% de radio de recogida', max: 3, cost: 40 },
    { id: 'growth', name: 'Sabiduría', icon: '✦', desc: '+5% de experiencia', max: 5, cost: 60 },
    { id: 'greed', name: 'Codicia', icon: '◆', desc: '+10% de oro', max: 5, cost: 50 },
    { id: 'reroll', name: 'Reconsiderar', icon: '↻', desc: '+1 cambio de opciones por partida', max: 3, cost: 100 },
    { id: 'revive', name: 'Ángel Guardián', icon: '✚', desc: 'Revives una vez por partida', max: 1, cost: 450 },
  ];

  return { CHAMPIONS, WEAPONS, ITEMS, ENEMIES, BOSSES, META, WIN_TIME: 900, ULT_LEVEL: 6, MAX_SLOTS: 6 };
})();
