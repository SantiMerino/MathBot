# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Estudiantes del equipo MathBot (PBL, semestre 2 2026) operando su robot SCARA desde una laptop junto a la
mesa de trabajo, con mouse/trackpad y teclado. Lo usan para probar el robot por etapas mientras se arma,
para calibrar (home, alturas, puntos) y para correr y presentar la misión completa.

## Product Purpose
Panel de operario del MathBot: controlar el robot como si fuera un tablero físico. Home con finales o a
mano, jog por articulación o en X/Y/Z, cambio de herramienta del disco (plumón, electroimán, sensor),
puntos de escaneo guardados, centro y giro de la rosa, misión completa (escaneo → recolección → rosa →
regreso) y paro. Funciona con el robot real por USB (Web Serial) o con un gemelo virtual que habla el
mismo protocolo. Éxito: que alguien del equipo pueda operar el robot sin leer el firmware y sin miedo a
romperlo.

## Positioning
Las acciones son comandos cortos precargados del firmware (H, J, T, D, R…) pero se sienten libres desde la
PC; el panel enseña ese protocolo mientras se usa.

## Operating Context
Laptop al lado del robot, luz de laboratorio o aula. El robot y todas sus piezas impresas son PLA negro.
Arduino Mega 2560 + CNC Shield V3 + A4988. Abrir el puerto reinicia el Mega; Z cae con los drivers
sueltos; la posición mostrada es estimada (pasos contados); el estado llega a 5 Hz como máximo.

## Capabilities and Constraints
- Sin build: HTML + CSS + módulos ES; three.js desde CDN; servido con `python -m http.server`.
- Web Serial solo en Chrome/Edge y en localhost.
- Protocolo de líneas `#n orden` → `ok n` / `err n motivo`, estado `S ...`, eventos `E ...` (firmware/README.md).
- Con el gemelo apagado se ve la consola completa con una pantalla pequeña de posición (mesa 2D).

## Brand Commitments
- Panel negro, como el robot. Tablero de control tradicional (consolas soviéticas, radar) con partes modernas.
- Psicología de color básica y constante: rojo = peligro (paro, choque, error, fuera de alcance).
- Stickers informativos estilo Y2K en cada control: función + código serie del comando.
- Terminal de comandos más un menú de comandos consultable en cualquier momento.
- Interfaz en español.

## Evidence on Hand
Protocolo y límites reales en `firmware/README.md`; mallas STL del robot y del cabezal en `panel/modelos.js`.

## Product Principles
1. La seguridad se ve: el paro siempre a la vista, los estados peligrosos nunca se confunden con los normales.
2. Lo que se muestra es lo que el Mega cuenta; lo estimado se dice estimado.
3. Cada control enseña su comando.
4. Probar sin hardware igual que con hardware.
