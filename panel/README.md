# Panel de operario MathBot

Control del robot desde la PC: conexión USB con el Mega (`firmware/mathbot_mega`, v3.0), jog, home,
puntos de análisis, rosa y misión, con el robot dibujado en vivo. El mismo panel trae un **robot
virtual** que responde el mismo protocolo, para practicar y probar todo sin hardware.

## Abrir

```bash
python -m http.server 8770 --directory panel
```

Luego <http://localhost:8770> en **Chrome o Edge** (Web Serial no existe en Firefox ni Safari, y solo
funciona desde `localhost` o https). En Claude Code está como la configuración `panel` de `.claude/launch.json`.
Las vistas 3D cargan three.js desde un CDN: la primera vez hace falta internet.

## Uso

La consola imita un tablero físico negro: palancas, perillas selectoras, teclas, lámparas y ventanas
de fósforo. Los colores significan siempre lo mismo: **rojo** peligro (paro, choque, fuera de alcance),
**ámbar** precaución (sin home, motores sueltos, 12 V bajos), **verde** listo, **cian** en movimiento.
Cada control lleva un sticker con lo que hace y el comando que manda (palanca **STICKERS** para ocultarlos).

1. Palanca **VIRTUAL / USB** y tecla **CONECTAR**. Con USB el navegador pide el puerto; el Mega se
   reinicia al abrirlo (ver limitaciones en `firmware/README.md`).
2. El **anunciador** de arriba dice el estado; las lámparas HOME, MOTORES, MOVIENDO, METAL y PARO, los
   12 V y los finales de carrera completan la lectura.
3. **Home**: **HOMING** (`H`) o **HOME A MANO**: suelta los motores, alinea los brazos con sus marcas y
   pulsa *Esta pose es el home* (`O 1` + `S`).
4. **Mover**: perilla de herramienta (`T`), palancas de plumón (`P`) e imán (`E`), jog manteniendo pulsado
   (o flechas y RePág/AvPág) con perillas de modo y paso.
5. **Clic en mesa**: la perilla del bisel decide qué hace un clic en la pantalla: nada, IR (`M x y`),
   agregar un PUNTO o mover el centro de la ROSA.
6. **Puntos**, **Rosa** (faders de giro y velocidad, vista previa verde o roja) y **Misión** (`R`, con una
   lámpara por fase). **FÁBRICA** está bajo una tapa transparente: hay que levantarla primero.
7. **PARO** (o Esc) manda `!` en cualquier momento. El robot sostiene la posición; `C` lo limpia y pide home.

Palanca **GEMELO / SOLO MANDO**: con el gemelo, pantalla grande (Mesa, Robot 3D, Cabezal con despiece)
y bahía de módulos por sección; en solo mando, todos los módulos a lo ancho con la mesa en una pantalla
chica y la terminal fija abajo. **COMANDOS** (o F1) abre el menú de todos los comandos del firmware:
un clic deja el comando escrito en la terminal.

La posición que se muestra es la que **cuenta** el Mega, no una medición: si un motor salta pasos, la
pantalla no se entera hasta el siguiente homing.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html`, `estilo.css` | la interfaz |
| `js/app.js` | une todo: palancas, perillas, lámparas, paneles, teclado |
| `js/comandos.js` | lista de comandos del firmware (menú y sugerencias de la terminal) |
| `js/robot.js` | enlace serie (Web Serial) y virtual, cola de órdenes con `#n` / `ok n` |
| `js/virtual.js` | robot virtual: mismo protocolo que el firmware, mundo con piezas, tinta y choques |
| `js/geometria.js` | FK/IK, límites, rosa y obstáculos (mismas constantes que el firmware) |
| `js/vista2d.js`, `js/vista3d.js` | mesa 2D y escena three.js |
| `modelos.js` | mallas del robot y del cabezal empaquetadas (generado) |
| `construir_modelos.py` | genera `modelos.js` |

Si cambia el CAD del cabezal: `python "BRAZO SCARA/DISEÑO FINAL/Cabezal disco/fuente/construir.py"`
(exporta `ensamble/stl/` y `meta.json`) y luego `python panel/construir_modelos.py`.

Si cambia la geometría o el protocolo del firmware, cambia también `js/geometria.js` y `js/virtual.js`.
