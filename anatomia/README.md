# Figuras Anatomy de MathBot

Seis figuras isométricas interactivas hechas con la skill [Anatomy](https://skills.wheresryan.sh/anatomy).
Cada una es una página HTML suelta (sin dependencias) que se abre con doble clic.

| Figura | Qué muestra | Interacción |
|---|---|---|
| `nema17/nema17.html` | Los dos NEMA 17 (17HS4401 de 40 mm y el corto de 23 mm) con el mismo tren de pasos del A4988 a 1/4: 800 pasos/vuelta, rampa de `prueba_nema.ino` | Puntero en horizontal = ángulo; ← → un paso completo, Mayús 36° |
| `mega/mega.html` | Arduino MEGA 2560 + CNC Shield V3: qué pin usa cada función (tabla de `firmware/README.md`) | Puntero o ← → recorre las 14 funciones |
| `lm10uu/lm10uu.html` | La columna Z: 4 × LM10UU en varillas Ø10, husillo Tr8×8, 100 pasos/mm, VMAX/ACEL de Z en `mathbot_mega.ino` | Puntero en vertical = altura; ↑ ↓ 1 mm, Mayús 10 mm |
| `cabezal/cabezal.html` | Cabezal A v2: placa trébol con plumón, electroimán y sensor a 55 mm de J3; despiece y levante del plumón (collar, resorte, SG90 con brazo de 12 mm) con las medidas de `simulador_scara/plantilla.html` | Puntero en horizontal = separación; clic o espacio sube el plumón; ← → 10 % |
| `final-carrera/final-carrera.html` | Final de carrera de palanca con rodillo sin tapa en el homing de J3: lámina que salta de NC a NO, D9 con INPUT_PULLUP, 1100 pasos/s y HOME_POS −166.2° de `mathbot_mega.ino` | Puntero en horizontal = ángulo de J3; ← → 1°, Mayús 10°; H corre el homing |
| `electroiman/electroiman.html` | Electroimán hecho a mano en sus dos variantes: olla (núcleo Ø8, camisa EMT ½", AWG 33) y perno 3/8" × 1" (AWG 30), en la copa del separador 06 del cabezal A v3, con despiece de armado y la subida de 40 mm con el disco de 69 g; fuerza, corriente y vueltas salen del modelo de `electroiman/geo.mjs` | Botones o O / P = variante; puntero en horizontal o ← → = despiece; clic o espacio levanta la pieza |

Cada carpeta tiene también la versión `-light.html`.

## Regenerar

Requiere Node 20+. Desde la raíz del repositorio:

```bash
node anatomia/nema17/build.mjs && node anatomia/nema17/build.mjs --light
node anatomia/mega/build.mjs && node anatomia/mega/build.mjs --light
node anatomia/lm10uu/build.mjs && node anatomia/lm10uu/build.mjs --light
node anatomia/cabezal/build.mjs && node anatomia/cabezal/build.mjs --light
node anatomia/final-carrera/build.mjs && node anatomia/final-carrera/build.mjs --light
node anatomia/electroiman/build.mjs && node anatomia/electroiman/build.mjs --light
```

`cabezal/geo.mjs` y `final-carrera/geo.mjs` dibujan las piezas que se mueven; el mismo código corre en Node (cuadro inicial) y en la página.
Los recorridos del final de carrera son típicos de un KW11-3Z (recorrido previo 0.5 mm, diferencial 0.1 mm en el botón): mide los del tuyo y ajusta `SW` en `final-carrera/geo.mjs`.

`kit/` es una copia del kit de la skill (`iso-kit.mjs`, MIT); `comun.mjs` tiene la placa base y el cuerpo del NEMA 17 que comparten las figuras.
Si cambian los valores del firmware (pasos, velocidades, pines), actualiza las constantes `MODEL` / `STOPS` del `build.mjs` correspondiente.
