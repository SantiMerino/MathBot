---
name: MathBot · Consola de operario
description: Frente de instrumento de PLA negro donde cada comando del firmware es un control físico con su sticker de código.
colors:
  fondo: "#070808"
  placa: "#131416"
  placa-luz: "#18191c"
  placa-sombra: "#121315"
  tecla-cara: "#2b2d31"
  ranura: "#040405"
  serigrafia: "#ebe7da"
  serigrafia-2: "#aaa69a"
  tenue: "#8f8b81"
  apagado: "#858278"
  filete: "#6d6a62"
  rojo: "#ff3b30"
  rojo-hondo: "#9e130c"
  rojo-texto: "#ff8a83"
  ambar: "#ffb21f"
  verde: "#5dff6e"
  cian: "#42d3ff"
  lila: "#c7a6ff"
  fosforo: "#8dff7a"
  fosforo-2: "#4fbf47"
  fosforo-bg: "#051208"
  aro-paro: "#f2c21b"
  st-lila: "#cdb0ff"
  st-lima: "#cff25a"
  st-celeste: "#94dbff"
  st-ambar: "#ffcb4d"
  st-tinta: "#0d0d0f"
  st-borde: "#f6f4ee"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.32em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.1em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "0.1em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "normal"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.16em"
  digitos:
    fontFamily: "Share Tech Mono, ui-monospace, Consolas, monospace"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.05em"
  digitos-lectura:
    fontFamily: "Share Tech Mono, ui-monospace, Consolas, monospace"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.35
  terminal:
    fontFamily: "Share Tech Mono, ui-monospace, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
  sticker:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.02em"
  chip-codigo:
    fontFamily: "Unbounded, Barlow, sans-serif"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.03em"
rounded:
  lampara: "3px"
  ventana: "4px"
  tecla-mini: "5px"
  tecla: "7px"
  sticker: "8px"
  modulo: "10px"
  panel: "12px"
  tecla-grande: "14px"
  cristal: "16px"
  bisel: "20px"
  redondo: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
components:
  tecla:
    backgroundColor: "{colors.tecla-cara}"
    textColor: "{colors.serigrafia}"
    typography: "{typography.title}"
    rounded: "{rounded.tecla}"
    padding: "0 14px"
    height: "40px"
  tecla-hover:
    textColor: "#ffffff"
  tecla-pulsada:
    textColor: "{colors.cian}"
  tecla-deshabilitada:
    textColor: "{colors.apagado}"
  tecla-mini:
    rounded: "{rounded.tecla-mini}"
    padding: "0 9px"
    height: "28px"
  tecla-grande:
    rounded: "{rounded.tecla-grande}"
    size: "112px"
  tecla-luz:
    textColor: "#eaffe6"
  tecla-peligro:
    backgroundColor: "{colors.rojo-hondo}"
    textColor: "#ffffff"
  lampara:
    backgroundColor: "{colors.placa}"
    textColor: "{colors.apagado}"
    typography: "{typography.label}"
    rounded: "{rounded.lampara}"
    padding: "6px 8px"
    width: "64px"
  ventana:
    backgroundColor: "{colors.fosforo-bg}"
    textColor: "{colors.fosforo}"
    typography: "{typography.digitos}"
    rounded: "{rounded.ventana}"
    padding: "5px 12px"
    width: "200px"
  ventana-ambar:
    backgroundColor: "#160d01"
    textColor: "{colors.ambar}"
  ventana-cian:
    backgroundColor: "#021117"
    textColor: "{colors.cian}"
  ventana-rojo:
    backgroundColor: "{colors.rojo-hondo}"
    textColor: "#ffffff"
  ventana-off:
    textColor: "{colors.apagado}"
  sticker-celeste:
    backgroundColor: "{colors.st-celeste}"
    textColor: "{colors.st-tinta}"
    typography: "{typography.sticker}"
    rounded: "{rounded.sticker}"
    padding: "3px 4px 3px 8px"
  sticker-lila:
    backgroundColor: "{colors.st-lila}"
    textColor: "{colors.st-tinta}"
  sticker-lima:
    backgroundColor: "{colors.st-lima}"
    textColor: "{colors.st-tinta}"
  sticker-ambar:
    backgroundColor: "{colors.st-ambar}"
    textColor: "{colors.st-tinta}"
  chip-codigo:
    backgroundColor: "{colors.st-tinta}"
    textColor: "{colors.st-borde}"
    typography: "{typography.chip-codigo}"
    rounded: "{rounded.tecla-mini}"
    padding: "3px 5px"
  modulo:
    backgroundColor: "{colors.placa-luz}"
    textColor: "{colors.serigrafia}"
    rounded: "{rounded.modulo}"
    padding: "24px 20px 18px"
  campo:
    backgroundColor: "{colors.fosforo-bg}"
    textColor: "{colors.fosforo}"
    rounded: "{rounded.ventana}"
    padding: "6px 30px 6px 8px"
    width: "96px"
  terminal:
    backgroundColor: "{colors.fosforo-bg}"
    textColor: "{colors.fosforo-2}"
    typography: "{typography.terminal}"
    padding: "8px 10px"
  modo-bahia:
    backgroundColor: "{colors.ranura}"
    textColor: "{colors.tenue}"
    rounded: "{rounded.sticker}"
    padding: "4px"
  modo-bahia-on:
    backgroundColor: "{colors.tecla-cara}"
    textColor: "#ffffff"
  paro:
    backgroundColor: "{colors.rojo}"
    textColor: "#ffffff"
    rounded: "{rounded.redondo}"
    size: "74px"
---

# Design System: MathBot · Consola de operario

## Overview

**Creative North Star: "La placa de PLA negro"**

El panel es el frente de un instrumento: una placa negra mate con líneas de capa de impresión FDM, módulos atornillados en las cuatro esquinas, serigrafía blanca condensada y controles físicos (palancas de bate, perillas selectoras con puntero, teclas con faldón, lámparas anunciadoras rectangulares, ventanas de dígitos en fósforo verde). Encima de esa placa viven los stickers Y2K pastel, ligeramente girados, que dicen qué hace cada control y qué código serie manda. El mundo es el de las consolas tradicionales (Soyuz, radar) con piezas modernas, hecho con el mismo material que el robot.

La densidad es de tablero, no de dashboard: muchas piezas pequeñas agrupadas por módulo, cada módulo con su título serigrafiado entre filetes. La jerarquía la dan la luz y el material, no el tamaño: lo encendido brilla (glow del color de la lámpara), lo apagado es serigrafía gris sobre placa. El color tiene un solo trabajo: decir el estado. Rojo, ámbar, verde y cian son un semáforo fijo y el lila marca metal; nada de eso se usa como decoración.

La pantalla del gemelo es un CRT de fósforo dentro de un bisel: rejilla verde, brazo verde translúcido, scanlines y viñeta. El resto del sistema rechaza el dashboard gris de pestañas y botones genéricos; las pestañas de la bahía son un selector de teclas hundido en una ranura.

**Key Characteristics:**
- Placa negra con líneas de capa (`--capas`) y tornillos en las esquinas de cada módulo.
- Serigrafía condensada en mayúsculas con tracking amplio; dígitos en Share Tech Mono con glow de fósforo.
- Semáforo fijo: rojo peligro, ámbar precaución, verde listo, cian actividad y selección, lila metal.
- Stickers pastel girados con chip negro de código: función + orden del firmware.
- Controles con física: las perillas giran al detente, las palancas rotan 180°, las teclas se hunden 2px, la tapa de las acciones destructivas se levanta.
- El PARO rojo sobre aro amarillo siempre visible en el riel; ningún panel lo tapa.

## Colors

Negro casi absoluto con serigrafía hueso, más un semáforo saturado y una familia pastel reservada a los stickers.

### Primary
- **Rojo Paro** (`rojo`): solo peligro. El hongo de PARO, la lámpara PARO (parpadea), la ventana de estado en paro (fondo `rojo-hondo`), la tecla FÁBRICA, la vista previa de la rosa fuera de alcance, el punto de choque y la leyenda NO LLEGA. En texto sobre negro se usa el **Rojo Texto** (`rojo-texto`): errores de la terminal y comandos peligrosos del menú.
- **Fósforo** (`fosforo`): el color de lectura. Ventanas de dígitos, campos numéricos, terminal, CRT de la mesa, tecla de vista activa. No es semántico; es el color de cualquier número que el Mega reporta. Su versión apagada, **Fósforo Tenue** (`fosforo-2`), lleva unidades, leyendas y el texto corriente de la terminal, sobre **Fondo de Fósforo** (`fosforo-bg`).

### Secondary
- **Ámbar Precaución** (`ambar`): sin home, motores sueltos, 12 V bajos (< 10.5 V), finales presionados, sticker de advertencia. Ventana ámbar sobre `#160d01`.
- **Verde Listo** (`verde`): lámpara HOME/MOTORES en orden, paso de misión hecho, y el aro iluminado de las **teclas de marcha** (`tecla-luz`: CONECTAR, ESCANEAR, TRAZAR, MISIÓN COMPLETA, GUARDAR).
- **Cian Actividad** (`cian`): MOVIENDO, paso de misión en curso, "EJECUTANDO ›", eventos de la terminal. En el build también marca **selección y foco**: detente elegido de la perilla, tecla pulsada (`aria-pressed`), subrayado de la sección activa y el anillo de `:focus-visible`.
- **Lila Metal** (`lila`): detección de metal. Lámpara METAL, LED del sensor, filas metálicas de la tabla de puntos, puntos metálicos en la mesa, color del electroimán.

### Tertiary
- **Stickers pastel** (`st-lila`, `st-lima`, `st-celeste`, `st-ambar`, y plata como degradado holográfico `linear-gradient(115deg, #e9edf1, #c5ced7 32%, #efe6ff 50%, #d6f3ff 64%, #ccd3db)`), siempre con tinta `st-tinta` y borde troquelado `st-borde`. Asignación observada: lila = movimiento y home (`H`, `J`, `M`, `O 0 · S`); celeste = conexión, herramienta y configuración (`open`, `T`, `P`, `E`, `PT`, `CFG`, `D?`); lima = secuencias que el robot ejecuta solo (`X`, `D`, `R`), siempre junto a una tecla de marcha; plata = estado y memoria (`S`, `GUARDAR`, `CARGAR`, `sim`); ámbar = advertencia, con triángulo negro (`O 1 / O 0`, `FABRICA`).
- **Aro de Paro** (`aro-paro`): el aro amarillo con borde `#8a6a05` alrededor del hongo. Único uso.

### Neutral
- **Fondo** (`fondo`): detrás de toda la consola.
- **Placa** (`placa`, con degradado `placa-luz` → `placa-sombra`): módulos, teletipo, bisel. El riel y el cajón bajan hasta `#101113`.
- **Ranura** (`ranura`): todo lo hundido (anunciador, selector de bahía, pistas de fader, estado de la rosa).
- **Cara de Tecla** (`tecla-cara`): tope del degradado de teclas (`#2b2d31 → #17181b 60% → #121315`).
- **Serigrafía** (`serigrafia`): títulos, etiquetas activas, texto principal. **Serigrafía 2** (`serigrafia-2`): etiquetas secundarias, notas. **Tenue** (`tenue`): etiquetas de selector y palanca en reposo. **Apagado** (`apagado`): lámparas apagadas, controles deshabilitados.
- **Filete** (`filete`): las líneas que flanquean los títulos serigrafiados.

### Named Rules
**La Regla del Semáforo.** Rojo, ámbar, verde y cian significan peligro, precaución, listo y actividad en cada lugar donde aparecen; ningún color de estado se usa para decorar, y ningún estado peligroso comparte color con uno normal.

**La Regla del Pastel Aparte.** Los pasteles viven solo en los stickers. El ámbar pastel es el único que se cruza con el semáforo, y solo para advertencias.

**La Regla del Número Verde.** Todo valor que reporta el Mega se lee en fósforo sobre `fosforo-bg`; los textos de interfaz nunca van en fósforo.

## Typography

**Display Font:** Barlow Condensed (con Arial Narrow)
**Body Font:** Barlow (con system-ui)
**Label/Mono Font:** Share Tech Mono (con ui-monospace, Consolas) para dígitos y terminal; Unbounded solo en el chip de código del sticker.

**Character:** Serigrafía condensada y espaciada como la de un panel grabado, contra dígitos de segmento suave que parecen salir de un tubo. Unbounded, ancha y pesada, aparece solo dentro del chip negro y le da al sticker su voz Y2K.

### Hierarchy
- **Display** (700, 20px, 1, tracking 0.32em): solo la placa de marca MATHBOT. Su subtítulo va en 600, 11px, 0.2em.
- **Headline** (600, 12.5px, 1, tracking 0.1em, mayúsculas): título serigrafiado de cada módulo, centrado entre dos filetes; también del teletipo, el cajón y los paneles flotantes. El build consigue el espaciado ancho escribiendo espacios entre letras ("P O S I C I Ó N"); eso no es la regla: el mismo aspecto se logra con texto normal y `letter-spacing` ≈0.32em, como en la marca.
- **Title** (600, 13px, 1.05, tracking 0.1em, mayúsculas): rótulo de teclas. 11.5px en tecla mini, 16px en tecla grande; selector de bahía 12.5px, 0.14em.
- **Body** (500, 14px, 1.35): notas y descripciones (notas a 13px, máximo 62ch).
- **Label** (600, 11px, tracking 0.16em, mayúsculas): ejes, campos, finales, nombres de control, encabezados de tabla. Etiquetas de perilla y palanca a 11.5px, 0.08–0.1em.
- **Dígitos** (Share Tech Mono 400): ventana de estado 17px (0.05em, mayúsculas), lectura de ejes 21px, ventana grande 22px, mini 15px, terminal y tabla 12.5–13px/1.45. Unidades a 12px en `fosforo-2`, sin glow.
- **Sticker** (600, 12.5px, 1.15, 0.02em): la frase de función. **Chip de código** en Unbounded 800, 0.03em; el build lo sirve a 9px (igual que el `kbd` dentro de las teclas), por debajo del piso de legibilidad, así que ese tamaño no es parte del sistema: los chips nuevos van a 11px como mínimo.

### Named Rules
**La Regla de la Serigrafía.** Todo rótulo de control y de módulo va en Barlow Condensed mayúsculas con tracking de 0.1em o más, hecho con `letter-spacing`; el texto de interfaz en minúsculas solo aparece en notas, stickers y el menú de comandos.

**La Regla del Glow.** Solo lo que está encendido brilla: dígitos de fósforo (`text-shadow 0 0 6px` del propio color al 50–55%), lámparas con `data-on` y la etiqueta activa de palancas y perillas. Una etiqueta apagada nunca lleva glow.

## Layout

Rejilla de consola a pantalla completa, sin scroll del documento en escritorio (`body` es grid `auto / minmax(0,1fr)` con `overflow: hidden`).

- **Riel superior** (flex, gap 18px, padding 10px 18px 12px): marca, grupo de conexión (palanca VIRTUAL/USB + CONECTAR), anunciador empujado a la derecha (`margin-left: auto`), palancas GEMELO y STICKERS + tecla COMANDOS, y el PARO en el extremo derecho. Los stickers del riel cuelgan en absoluto bajo su grupo.
- **Consola con gemelo** (grid, gap 12px, padding 12px): columnas `minmax(0,1fr) 500px`, filas `minmax(0,1fr) 230px`; áreas `pant bahia / pant tele`. La pantalla CRT ocupa toda la izquierda; la bahía de módulos (selector + módulos con scroll propio) arriba a la derecha y el teletipo abajo.
- **Solo mando** (gemelo apagado): rejilla `repeat(auto-fill, minmax(330px, 1fr))`; los módulos ocupan 1 o 2 columnas (`--span`), la mesa queda en una pantalla chica de 2×2 celdas a 470px de alto, y el teletipo se pega abajo (`sticky`, 200px) con sombra hacia arriba.
- **Dentro de un módulo**: controles en fila con wrap (`gap 18px 20px`), cada control es una columna centrada (control, nombre, sticker, gap 8px). Lectura de ejes en 4 columnas iguales; jog en `30px 54px 1fr 54px`.
- **≤1280px**: bahía a 440px, lámparas más estrechas. **≤980px**: el documento vuelve a hacer scroll, el riel hace wrap, el anunciador ocupa todo el ancho, todo se apila en una columna, pantalla a 60vh, teletipo a 280px, lectura en 2 columnas.
- **Cajón de comandos**: fijo a la derecha, `min(460px, 100vw)`, arranca bajo el riel (`top: var(--riel)`) para que el PARO siga visible. Los paneles flotantes (`dialog` no modal) se anclan a 96px del borde superior.

**La Regla del PARO a la Vista.** Ningún cajón, panel o diálogo cubre el riel superior; todo lo flotante empieza debajo de él y nada es modal.

## Elevation & Depth

Sistema skeuomórfico: la profundidad es física, no tonal. Hay tres alturas. Lo **hundido** (ranuras, ventanas, campos, cristal) usa sombra interior negra casi opaca y un brillo de 1px abajo. Las **placas** (módulos, teletipo, bisel, riel) están apenas levantadas con contorno negro de 1px, brillo superior de 1px y sombra difusa. Los **controles** (teclas, perillas, palancas, stickers, PARO) sobresalen con un faldón sólido abajo y sombra de contacto; al pulsarlos el faldón se acorta y bajan 2–4px.

### Shadow Vocabulary
- **Ranura** (`box-shadow: inset 0 2px 6px rgb(0 0 0 / .9), 0 1px 0 rgb(255 255 255 / .06)`): anunciador, selector de bahía, estado de la rosa.
- **Ventana de fósforo** (`box-shadow: inset 0 2px 5px rgb(0 0 0 / .95), inset 0 0 0 1px rgb(141 255 122 / .07), 0 1px 0 rgb(255 255 255 / .06)`): dígitos y campos.
- **Placa** (`box-shadow: 0 0 0 1px #000, inset 0 1px 0 rgb(255 255 255 / .06), 0 4px 12px rgb(0 0 0 / .5)`): módulos y teletipo.
- **Tecla en reposo** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / .11), inset 0 -2px 0 rgb(0 0 0 / .5), 0 3px 0 #050506, 0 5px 10px rgb(0 0 0 / .55)`): el faldón de 3px es el canto de la tecla.
- **Tecla pulsada** (`transform: translateY(2px)`; `box-shadow: inset 0 1px 0 rgb(255 255 255 / .08), 0 1px 0 #050506, 0 2px 4px rgb(0 0 0 / .6)`).
- **Lámpara encendida** (`box-shadow: 0 0 16px color-mix(in oklab, var(--c) 55%, transparent), inset 0 0 8px color-mix(in oklab, var(--c) 40%, transparent)`): la luz es el único "elevado" que no es físico.
- **Sticker** (`box-shadow: 0 0 0 2px #f6f4ee, 0 2px 0 2px rgb(0 0 0 / .35), 0 4px 8px rgb(0 0 0 / .45)`): borde troquelado blanco y grosor de vinilo.
- **Flotante** (`box-shadow: 0 20px 50px rgb(0 0 0 / .8), inset 0 1px 0 rgb(255 255 255 / .07)`): paneles flotantes; el cajón usa `-14px 0 30px rgb(0 0 0 / .7)`.

### Named Rules
**La Regla del Faldón.** Un control que se puede pulsar tiene un faldón sólido de 3px (`0 3px 0 #050506`) y baja 2px al pulsarlo. Las superficies que no se pulsan nunca llevan faldón.

**La Regla de lo Hundido.** Lo que muestra datos está hundido en la placa (sombra interior); lo que se opera sobresale de ella.

## Shapes

Rectángulos de esquinas suaves, con radio que crece con el tamaño de la pieza: lámparas 3px, ventanas y campos 4px, teclas mini 5px, teclas 7px, stickers 8px, módulos 10px, paneles flotantes 12px, tecla grande 14px, cristal del CRT `16px / 14px`, bisel 20px. Lo circular es solo mecánico: perillas (con moleteado `repeating-conic-gradient` cada 6°), cuerpo de palanca, LED del sensor, lámparas de paso de misión y el hongo de PARO. Los stickers son la única pieza girada (entre −1.6° y +1.4°, alternando por posición). Cada módulo lleva cuatro tornillos dibujados a 8px de las esquinas.

## Components

### Teclas
Tactiles y pesadas: una tecla de consola con canto, no un botón web.
- **Forma:** esquinas suaves (7px), 40px de alto, padding 0 14px; borde negro de 1px y degradado vertical de cara de tecla.
- **Reposo / hover:** rótulo serigrafía; en hover el rótulo pasa a blanco y la cara se aclara un paso.
- **Pulsada (`:active`, `aria-pressed`):** baja 2px con faldón corto; las teclas de estado pulsado llevan rótulo cian y aro interior cian de 2px.
- **Deshabilitada:** rótulo apagado, cara más plana, cursor `not-allowed`. Todas las teclas `.accion` se deshabilitan mientras el robot está ocupado o desconectado.
- **Tecla de marcha (`tecla-luz`):** aro interior verde de 2px, resplandor verde y rótulo verdoso con glow. Solo para lo que pone al robot a trabajar.
- **Tecla de peligro:** cara roja `#d22a20 → #8e140d`, faldón `#3d0704`. Solo FÁBRICA, siempre bajo tapa.
- **Variantes:** mini (28px, 5px de radio, 11.5px), grande (112×112px, 14px de radio, 16px) para MISIÓN COMPLETA. Atajo de teclado en `kbd` dentro de la tecla.

### Tapa transparente
Firma de seguridad: una tapa de acrílico (degradado blanco translúcido, borde blanco al 28%) cubre la tecla de peligro con 5px de margen y el rótulo LEVANTAR. Al pulsarla gira `rotateX(-118deg)` desde el borde superior (0.32s, `cubic-bezier(.2,.9,.25,1.15)`), habilita la tecla y se vuelve a cerrar sola a los 6 s.

### Palancas (interruptor de bate)
- **Anatomía:** cuerpo redondo de 34px con anillos metálicos, bate de acero de 9×21px con bola en la punta; rótulo arriba y abajo.
- **Estado:** `aria-checked="true"` = posición de arriba; el bate rota 180° (0.16s, `cubic-bezier(.3,1.3,.5,1)`) y el rótulo de la posición activa pasa a serigrafía con glow blanco; el otro queda en tenue.
- **Las palancas que mandan órdenes** no cambian solas: su posición la decide el estado que reporta el Mega. Deshabilitada al 45% de opacidad.

### Perillas selectoras
Firma del sistema: herramienta, paso de jog, modo de jog, clic en mesa y tiempo del gemelo.
- **Anatomía:** perilla moleteada (52px, chica 38px, en el bisel 30px) con puntero de serigrafía; las etiquetas se reparten en un arco (80° para 2, 110° para 3, 140° para 4, 170° en el bisel) con un punto de detente bajo cada una.
- **Estado:** la elegida en blanco con glow y detente cian; las demás en tenue con detente apagado. La perilla gira al ángulo del detente (0.26s, `cubic-bezier(.25,1.5,.45,1)`, con rebote). Flechas del teclado recorren los detentes (`role="radiogroup"`).

### Lámparas anunciadoras
- **Forma:** rectángulo de 3px de radio, mínimo 64px de ancho, rótulo label; versión redonda de 22px (LED del sensor) y de 16px (pasos de misión).
- **Apagada:** cara oscura, rótulo apagado.
- **Encendida (`data-on` = verde | ambar | rojo | cian | lila):** cara con degradado radial del color mezclado con negro, rótulo aclarado con glow y halo de 16px. Rojo parpadea (`latido`, 1s en 2 pasos).

### Ventanas de dígitos y campos
- **Estilo:** Share Tech Mono en fósforo sobre `fosforo-bg`, hundidas, 4px de radio, glow de 6px. Valores alineados a la derecha.
- **Ventana de estado:** 17px, mínimo 200px, mayúsculas; cambia de color con el estado (ámbar, cian, rojo parpadeante sobre `rojo-hondo`, apagado).
- **Campos numéricos:** la misma ventana, editable: 16px, 96px de ancho, cursor fósforo, unidad en `fosforo-2` dentro del campo a la derecha. Placeholder `#57a04f`.

### Stickers
- **Estilo:** vinilo pastel con tinta negra, 8px de radio, borde troquelado blanco de 2px, sombra de grosor, girado. Frase de función + **chip de código** negro con el comando en Unbounded.
- **Variantes:** lila, lima, celeste, plata (holográfico), ámbar (con triángulo negro de advertencia). El interruptor STICKERS los oculta todos (`body.sin-stickers`).

### Módulos
- **Forma:** placa de 10px de radio, padding 24px 20px 18px, cuatro tornillos, líneas de capa, contorno negro.
- **Título:** headline serigrafiado centrado entre dos filetes que se desvanecen; el sticker del módulo va al pie.

### Pantalla CRT
Bisel de 20px de radio con teclas de vista (MESA / ROBOT 3D / CABEZAL; la activa en fósforo con aro interior) y la perilla de clic en mesa. El cristal es un degradado radial verde muy oscuro con scanlines (`repeating-linear-gradient` cada 3px) y un reflejo arriba a la izquierda. En el lienzo 2D: rejilla cada 50 mm en fósforo al 7%, ejes al 26%, alcance al 5.5%, brazo en fósforo translúcido (30% y 46%), bandeja en cian, rosa válida en fósforo y fuera de alcance en rojo, discontinua `6 4`.

### Navegación de la bahía
Selector de teclas hundido en una ranura (8px de radio, padding 4px). Sección inactiva: rótulo tenue sin fondo. Activa: cara de tecla, rótulo blanco y un trazo cian de 18×2px con glow bajo el rótulo.

### Teletipo y menú de comandos
Placa atornillada con terminal de fósforo (12.5px/1.45): órdenes enviadas en serigrafía 2, `ok` en fósforo con glow, errores en rojo texto, eventos en cian. Línea de orden con prompt `›`, aro fósforo al enfocar. El cajón de comandos lista cada orden con el código en fósforo (108px), descripción y nota; las peligrosas con código en rojo texto.

### PARO
Hongo rojo de 58px con degradado radial y brillo superior, sobre aro amarillo de 74px; rótulo PARO en 700, 15px, 0.14em. Faldón de 5px `#4a0603`; al pulsar baja 4px. Deshabilitado (sin conexión) se desatura al 35% y oscurece al 60%. Atajo Esc rotulado debajo.

## Do's and Don'ts

### Do:
- **Do** dar a cada control nuevo su sticker con la función y el chip del comando exacto que manda (`T p|i|s`, `CFG zmesa`).
- **Do** usar el semáforo fijo: `rojo` solo peligro, `ambar` precaución, `verde` listo, `cian` actividad y selección, `lila` metal.
- **Do** mostrar todo número que reporta el Mega en una ventana de fósforo hundida (`fosforo` sobre `fosforo-bg`), con la unidad en `fosforo-2`.
- **Do** construir módulos como placas atornilladas con título serigrafiado entre filetes y espaciado con `letter-spacing`.
- **Do** dar faldón de 3px y hundimiento de 2px a todo lo que se pulsa, y sombra interior a todo lo que muestra datos.
- **Do** poner una tapa que haya que levantar sobre cualquier acción que borre datos, con tecla de peligro roja debajo.
- **Do** elegir entre opciones discretas de máquina con una perilla selectora que gira al detente, no con un desplegable.
- **Do** mantener el PARO visible y operable: todo lo flotante arranca bajo el riel y nada es modal.
- **Do** respetar `prefers-reduced-motion`: sin transiciones ni parpadeos.

### Don't:
- **Don't** usar rojo para nada que no sea peligro, ni como acento, ni en hover.
- **Don't** usar los pasteles de sticker fuera de los stickers, ni el ámbar pastel salvo en advertencias.
- **Don't** dibujar pestañas grises de dashboard ni botones planos genéricos; la sección activa es una tecla pulsada en una ranura.
- **Don't** poner glow en etiquetas apagadas o deshabilitadas; la luz significa encendido.
- **Don't** escribir textos de interfaz en fósforo; el verde fósforo es para valores del robot.
- **Don't** usar superficies blancas o grises claras; la placa es negra como el robot.
