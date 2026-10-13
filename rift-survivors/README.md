# Rift Survivors

Survivor de hordas (estilo *Vampire Survivors* / *PokéSurvivor*) con temática MOBA.
Elige un campeón, muévete por la Grieta, recoge experiencia, mejora y evoluciona tus habilidades,
y resiste 15 minutos hasta derrotar al **Leviatán del Abismo**.

Todos los campeones, enemigos y gráficos son originales y se dibujan por código en un `<canvas>`.
No necesita imágenes ni dependencias.

## Cómo jugar

Abre `rift-survivors/index.html` en el navegador (doble clic vale, no necesita servidor).

| Tecla | Acción |
| --- | --- |
| `WASD` / flechas | Moverse (en móvil: arrastra el dedo) |
| `Espacio` / `F` | Destello: teletransporte corto (18 s) |
| `R` | Definitiva del campeón (a partir del nivel 6) |
| `Esc` / `P` | Pausa |
| `1`–`3` | Elegir mejora |

## Contenido

- **4 campeones**: Kaelen (luchador), Nimra (maga), Seryn (tiradora) y Brakka (tanque), cada uno con habilidad inicial, pasiva y definitiva propias.
- **9 habilidades automáticas** con 5 niveles: Tajo Feroz, Orbe Arcano, Flecha Perforante, Onda Sísmica, Hojas Espectrales, Cadena Eléctrica, Rastro Tóxico, Meteoro y Guja Bumerán.
- **10 objetos pasivos** (daño, área, enfriamiento, velocidad, vida, armadura, recogida, regeneración, experiencia, proyectiles).
- **Evoluciones**: habilidad a nivel 5 + su objeto pareja = versión evolucionada (tabla en *Cómo jugar*).
- **Enemigos** que cambian con el tiempo: súbditos, hechiceros, lobos, asedio, espectros, gólems y súbditos colosales, más oleadas especiales cada minuto.
- **5 jefes** (3:00, 6:00, 9:00, 12:00 y el jefe final a las 15:00) con ataques propios; sueltan cofres con recompensa.
- **Progresión permanente**: el oro de cada partida se gasta en mejoras (se guarda en `localStorage`), con récords por campeón.

## Estructura

```
rift-survivors/
├── index.html
├── css/style.css
└── js/
    ├── util.js     # utilidades, rejilla espacial, guardado y sonido (WebAudio)
    ├── data.js     # campeones, habilidades, objetos, enemigos, jefes y tienda
    ├── draw.js     # dibujado procedural de personajes
    ├── weapons.js  # lógica de cada habilidad
    ├── game.js     # simulación, IA de jefes y render
    └── ui.js       # pantallas, entrada y bucle principal
```

Proyecto de fans sin relación con Riot Games.
