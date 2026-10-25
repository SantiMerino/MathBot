---
version: 1
slug: "panel-index-html"
primary_target: "panel/index.html"
related_targets: []
---

## Scope
panel/index.html: panel de operario del MathBot. Mode: Operate. Laptop junto al robot, mouse y teclado.

## Task
Conectar (virtual o USB), hacer home, mover, elegir herramienta, guardar puntos, ajustar la rosa, correr la misión y parar.
Estados que deben leerse de un vistazo: desconectado, sin home, motores sueltos, moviendo, listo, paro, 12 V bajos, finales.

## Pinned by the user
Panel negro como el robot de PLA negro; tablero de control tradicional (consola Soyuz, consola de radar) con partes modernas;
rojo solo para peligro; stickers Y2K en cada control con función + código serie; alternar solo controles / gemelo virtual;
terminal más menú de comandos siempre disponible. Con el gemelo apagado: consola completa con una pantalla pequeña de mesa 2D.

## Direction contract
THESIS: El panel es el frente de un instrumento negro de PLA: cada comando del firmware es un control físico grabado en serigrafía, y su sticker enseña el código que manda. Rechaza el dashboard gris de pestañas y botones genéricos.
OWN-WORLD: Placa negra mate con líneas de capa FDM finísimas, tornillos en las esquinas de cada módulo, serigrafía blanca condensada con títulos espaciados, palancas metálicas, perillas selectoras con puntero, teclas redondas con aro, ventanas de dígitos en verde fósforo, lámparas anunciadoras rectangulares. Semáforo fijo: rojo peligro, ámbar precaución, verde listo, cian actividad. Stickers Y2K pastel (lila, lima, celeste, plata; ámbar solo para advertencias), ligeramente girados, con chip del código.
STORY: El operario ve primero el anunciador de estado y el PARO, luego lee posiciones en las ventanas de fósforo, y opera módulo por módulo sin leer el firmware; el sticker le dice qué manda cada control.
FIRST VIEWPORT: Riel superior: placa de marca, selector VIRTUAL/USB + tecla CONECTAR, fila de lámparas anunciadoras (estado, 12 V, finales), interruptores GEMELO y STICKERS, tecla COMANDOS, hongo de PARO rojo sobre aro amarillo a la derecha. Gemelo encendido: pantalla CRT con bisel (MESA / ROBOT 3D / CABEZAL) a la izquierda y bahía de módulos a la derecha con selector MOVER/PUNTOS/ROSA/MISIÓN/AJUSTES. Gemelo apagado: todos los módulos en rejilla a lo ancho, con la mesa en una pantalla de fósforo pequeña. Teletipo (registro + orden) abajo.
FORM: Pinned by the user (no roll): tablero de control negro con stickers Y2K. Signature move: perillas selectoras que giran al detente elegido (herramienta, paso de jog, modo de jog) y la tapa transparente que hay que levantar antes de las acciones destructivas.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
