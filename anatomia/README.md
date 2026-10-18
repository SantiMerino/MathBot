# Figuras Anatomy de MathBot

Tres figuras isométricas interactivas hechas con la skill [Anatomy](https://skills.wheresryan.sh/anatomy).
Cada una es una página HTML suelta (sin dependencias) que se abre con doble clic.

| Figura | Qué muestra | Interacción |
|---|---|---|
| `nema17/nema17.html` | Los dos NEMA 17 (17HS4401 de 40 mm y el corto de 23 mm) con el mismo tren de pasos del A4988 a 1/4: 800 pasos/vuelta, rampa de `prueba_nema.ino` | Puntero en horizontal = ángulo; ← → un paso completo, Mayús 36° |
| `mega/mega.html` | Arduino MEGA 2560 + CNC Shield V3: qué pin usa cada función (tabla de `firmware/README.md`) | Puntero o ← → recorre las 14 funciones |
| `lm10uu/lm10uu.html` | La columna Z: 4 × LM10UU en varillas Ø10, husillo Tr8×8, 100 pasos/mm, VMAX/ACEL de Z en `mathbot_mega.ino` | Puntero en vertical = altura; ↑ ↓ 1 mm, Mayús 10 mm |

Cada carpeta tiene también la versión `-light.html`.

## Regenerar

Requiere Node 20+. Desde la raíz del repositorio:

```bash
node anatomia/nema17/build.mjs && node anatomia/nema17/build.mjs --light
node anatomia/mega/build.mjs && node anatomia/mega/build.mjs --light
node anatomia/lm10uu/build.mjs && node anatomia/lm10uu/build.mjs --light
```

`kit/` es una copia del kit de la skill (`iso-kit.mjs`, MIT); `comun.mjs` tiene la placa base y el cuerpo del NEMA 17 que comparten las figuras.
Si cambian los valores del firmware (pasos, velocidades, pines), actualiza las constantes `MODEL` / `STOPS` del `build.mjs` correspondiente.
