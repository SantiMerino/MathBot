// Comandos del firmware v3.0 (firmware/README.md) para el menú de comandos y las sugerencias de la terminal.
// plantilla: lo que queda escrito en la terminal al elegirlo.
export const COMANDOS = [
  { grupo: 'Sistema', lista: [
    { c: '?', plantilla: '?', d: 'Identificación, geometría, configuración y puntos' },
    { c: 'O 1 · O 0', plantilla: 'O ', d: 'Energizar · soltar los 4 drivers', n: 'Al soltar, la plataforma Z cae por su peso' },
    { c: 'C', plantilla: 'C', d: 'Limpiar el paro', n: 'Después hay que repetir el home' },
    { c: '!', plantilla: '!', d: 'Paro inmediato, aunque haya otra orden en curso', peligro: true },
  ] },
  { grupo: 'Home', lista: [
    { c: 'H', plantilla: 'H', d: 'Homing con los 4 finales: Z, J3, J2, J1' },
    { c: 'H eje', plantilla: 'H ', d: 'Homing de un eje: j1, j2, j3 o z', n: 'Si ya había home, avisa la deriva (E DERIVA)' },
    { c: 'S', plantilla: 'S', d: 'Home manual: la pose actual es J1 = J2 = J3 = 0' },
    { c: 'S t1 t2 φ z', plantilla: 'S ', d: 'Home manual con ángulos y altura dados' },
  ] },
  { grupo: 'Mover', lista: [
    { c: 'J eje d', plantilla: 'J ', d: 'Paso de jog: 1–4 (J1–J3 en °, Z en mm) o x, y, z (punta, mm)', n: 'Sin home solo funciona el articular' },
    { c: 'M x y', plantilla: 'M ', d: 'Herramienta activa a (x, y), movimiento articular' },
    { c: 'L x y', plantilla: 'L ', d: 'Línea recta a (x, y) a la velocidad de trazo' },
    { c: 'Z z', plantilla: 'Z ', d: 'Altura de la plataforma (mm)' },
    { c: 'ZT h', plantilla: 'ZT ', d: 'Punta de la herramienta activa a h mm sobre la mesa' },
    { c: 'A t1 t2 φ z', plantilla: 'A ', d: 'Ángulos directos' },
  ] },
  { grupo: 'Herramientas', lista: [
    { c: 'T p|i|s', plantilla: 'T ', d: 'Herramienta activa: plumón, electroimán o sensor (gira J3)' },
    { c: 'P 1 · P 0', plantilla: 'P ', d: 'Plumón abajo · arriba' },
    { c: 'E 1 · E 0', plantilla: 'E ', d: 'Electroimán encendido · apagado' },
    { c: 'V v', plantilla: 'V ', d: 'Velocidad de trazo (mm/s)' },
  ] },
  { grupo: 'Puntos', lista: [
    { c: 'PT', plantilla: 'PT', d: 'Listar los puntos de escaneo' },
    { c: 'PT n x y h', plantilla: 'PT ', d: 'Guardar el punto n (h = alto de la pieza)' },
    { c: 'PT n', plantilla: 'PT ', d: 'Guardar la punta actual como punto n' },
    { c: 'PTB n', plantilla: 'PTB ', d: 'Borrar el punto n' },
    { c: 'G n', plantilla: 'G ', d: 'Ir al punto n a la altura de tránsito' },
  ] },
  { grupo: 'Misión', lista: [
    { c: 'X', plantilla: 'X', d: 'Escanear los puntos con el sensor' },
    { c: 'K', plantilla: 'K', d: 'Recoger las piezas metálicas con el imán' },
    { c: 'D?', plantilla: 'D?', d: 'Comprobar que toda la rosa es alcanzable' },
    { c: 'D', plantilla: 'D', d: 'Trazar la rosa' },
    { c: 'R', plantilla: 'R', d: 'Misión completa: escaneo → recolección → rosa → home' },
  ] },
  { grupo: 'Configuración', lista: [
    { c: 'CFG', plantilla: 'CFG', d: 'Ver la configuración' },
    { c: 'CFG clave valor', plantilla: 'CFG ', d: 'Cambiar un valor en la RAM', n: 'home1..4 zmesa rosax rosay rosaa binx biny binh vel servoup servodn inv finales cabezal' },
    { c: 'GUARDAR', plantilla: 'GUARDAR', d: 'Guardar configuración y puntos en la EEPROM' },
    { c: 'CARGAR', plantilla: 'CARGAR', d: 'Volver a lo guardado en la EEPROM' },
    { c: 'FABRICA', plantilla: 'FABRICA', d: 'Valores de fábrica', n: 'Borra la calibración y los puntos de la RAM', peligro: true },
  ] },
];
