# MathBot: dos propuestas conceptuales
Fecha: 24 de septiembre de 2026.

Láminas elaboradas con image_gen integrado: propuesta_01_scara.png y propuesta_02_eezy.png. Los prompts y ajustes se conservan en prompts.md. Son bocetos de propuesta con despiece y BOM por conjuntos, sin escala ni tolerancias de fabricación. Las dimensiones del modelo y las dimensiones propuestas se distinguen a continuación.

## Requisitos y decisiones de diseño
Del enunciado MATHBOT_-_Semestre_2_2026.pdf: pinza mecánica y electroimán intercambiables, detección de material entre dos objetos desconocidos, selección únicamente del objeto metálico de aproximadamente 70 g, trayectoria matemática, control por computador/Arduino, control verificable de servomotores, sensor capacitivo, simulación del brazo real y objetivo de precisión mínima de 90%.

Solicitud adicional del usuario: dos bocetos, aspecto de lápiz/plano, identificación de piezas y cabezal modular automático con electroimán, sensor y Sharpie o lápiz. Se mantiene la pinza exigida por el proyecto.

Decisiones de estas propuestas: añadir detección inductiva complementaria al sensor capacitivo; bloqueo mecánico verificable; portaplumas con resorte; servos con encoder como candidatos. No son requisitos añadidos al enunciado ni selecciones comerciales definitivas. El sensor capacitivo se conserva en AMBAS propuestas aunque alguna anotación abreviada de la ilustración EEZY lo describa como opcional.

El sensor inductivo identifica presencia de metal bajo condiciones calibradas; no identifica por sí solo el tipo exacto de aleación. El electroimán requiere una pieza ferromagnética. Si el objeto metálico no es atraído, la pinza permite tomarlo después de la detección; no se debe programar la recolección del objeto no metálico. El sensor de bloqueo tiene otra función: verificar el acople o la posición del selector.

## Propuesta 01: SCARA con estación de intercambio
Inspiración mecánica: SCARA de HowToMechatronics. Conserva torre, guías verticales, husillo, carro y dos eslabones horizontales articulados. Adaptación: 2 rotaciones en XY y traslación Z; el cabezal reemplaza la garra original. Se proponen servos con encoder en las dos rotaciones, correas dentadas y motor de pasos en Z. La selección final de actuadores y sus transmisiones requiere cálculo de carga.

Geometría de partida de la investigación local: L1 = L2 = 200 mm y centro de rosa a D = 220 mm del eje de base. Son cotas propuestas de MathBot, no medidas copiadas del robot publicado. Longitudes de guías, recorrido Z, altura de papel y posición del almacén quedan por dimensionar.

Cambio automático: elevar; entrar en el puesto libre; apoyar el cartucho; retraer el pestillo; separar; ir a otra herramienta; centrar y acoplar; bloquear; confirmar; salir. Tres alojamientos: portaplumas, electroimán y pinza. Durante el uso de una herramienta su alojamiento queda vacío. La lámina ilustra el equipamiento de los tres puestos, no un inventario simultáneo de cartuchos.

El receptor permanece en el brazo con sensores y actuador de cierre. Cada cartucho lleva placa común, superficies de referencia, orientación mecánica y contactos eléctricos. El diseño debe descargar fuerzas en las superficies de apoyo, no en los contactos. Los contactos se energizan después de confirmar bloqueo y se desenergizan antes de liberar.

| ID | Pieza o conjunto | Cantidad preliminar | Desglose y función |
|---|---|---|---|
| 01 | Tablero de trabajo | 1 | Superficie plana, sujeción de papel y anclajes |
| 02 | Base y giro J1 | 1 conjunto | Carcasa, plato, eje y soporte de rodamientos |
| 03 | Servos con encoder | 2 | Movimiento de J1 y J2; soportes por diseñar |
| 04 | Guías verticales | 4 | Varillas y abrazaderas superior/inferior |
| 05 | Husillo T8 y tuerca | 1 conjunto | Husillo, tuerca, soporte axial |
| 06 | Motor Z y acople | 1 conjunto | Motor, soporte y acople al husillo |
| 07 | Carro y cojinetes lineales | 1 conjunto | Carro portabrazo y cojinetes correspondientes a las guías |
| 08 | Brazo 1 | 1 | Cuerpo, tapa y uniones; 200 mm entre ejes propuestos |
| 09 | Junta J2 y rodamientos | 1 conjunto | Eje, alojamiento, cojinetes y fijaciones |
| 10 | Brazo 2 | 1 | Cuerpo, tapa y soporte del receptor; 200 mm propuestos |
| 11 | Correas GT2, poleas y tensores | 2 juegos | Un juego por articulación; reducción por definir |
| 12 | Receptor y pestillo con servo | 1 conjunto | Brida, apoyo de centrado, llave antigiro, pestillo, servo, fin de carrera |
| 13 | Contactos y placas de herramienta | 1 juego | Bloque receptor de contactos y 3 placas/cartuchos compatibles |
| 14 | Sensores de material | 1 par | Sensor capacitivo y sensor inductivo auxiliar con soporte fijo |
| 15 | Portaplumas con resorte | 1 | Abrazadera, guía deslizante, resorte, tope y lápiz/Sharpie |
| 16 | Electroimán bobinado | 1 | Núcleo, bobina, carrete, aislamiento y placa |
| 17 | Pinza y microservo | 1 conjunto | 2 mordazas, transmisión, guías/ejes, servo y placa |
| 18 | Estación de tres puestos | 1 | Bastidor y 3 cunas con retención y referencias |
| 19 | Arduino, potencia y fuente | 1 conjunto | Controlador, interfaces, driver Z, reguladores y etapa del electroimán |
| 20 | Tornillos, insertos y cableado | 1 lote | Longitudes, calibres y cantidades por cerrar en CAD |

Ventaja conceptual: el brazo transporta solo el cartucho activo. Compromiso: necesita espacio para la estación y un acople repetible.

## Propuesta 02: EEZY con torreta modular
Inspiración: EEZYbotARM Mk2 y el modelo local easyEEZYbotARM. Conserva base giratoria, hombro, brazo/antebrazo y transmisión por bielas. Se propone estructura reforzada, soporte bilateral de articulaciones y compensación del peso del brazo mediante resorte.

La librería local define L1 = 92, L2 = 135, L3 = 147 y L4 = 87 mm. Son parámetros de referencia de la cadena original. El cabezal nuevo modifica la posición de la punta: L4 y el desplazamiento de cada herramienta necesitan actualización. La simulación local centra la rosa a X = 250 mm, utiliza Z = 5 mm y amplía los límites articulares del modelo; ello no demuestra contacto real con el papel ni ausencia de colisiones.

Selector automático: elevar a una zona despejada; liberar el bloqueo; girar el tambor a la siguiente estación nominal de 120 grados; bloquear y confirmar; compensar la posición de la herramienta; aproximar. Los tres cartuchos permanecen en el cabezal. Son desmontables para mantenimiento, pero la selección en servicio ocurre por giro del tambor. Un eje horizontal coloca un cartucho hacia abajo y los otros fuera del plano de trabajo. El sistema debe limitar el giro y retornar para evitar torsión acumulada del cableado.

| ID | Pieza o conjunto | Cantidad preliminar | Desglose y función |
|---|---|---|---|
| 01 | Tablero y base fija | 1 conjunto | Tablero, base y fijación |
| 02 | Plataforma giratoria J1 | 1 | Plato, apoyo y eje |
| 03 | Servos con encoder | 3 | Base, hombro y accionamiento de codo/bielas |
| 04 | Soportes de hombro | 1 par | Placas laterales con apoyo bilateral |
| 05 | Brazo superior | 1 | Eslabón y fijaciones |
| 06 | Antebrazo | 1 | Eslabón distal y fijaciones |
| 07 | Bielas de paralelogramo | 1 juego | Barras, pivotes y articulaciones de transmisión/nivelación |
| 08 | Ejes, cojinetes y separadores | 1 lote | Uniones de base, brazo y transmisión |
| 09 | Resorte de compensación | 1 | Resorte y dos anclajes; precarga por calcular |
| 10 | Portacabezal nivelado | 1 | Soporte del conjunto distal |
| 11 | Horquilla de torreta | 1 | Dos apoyos del eje y unión al portacabezal |
| 12 | Tambor y eje horizontal | 1 conjunto | Tambor de 3 estaciones, eje y dos rodamientos |
| 13 | Servo selector | 1 | Accionamiento del tambor; transmisión por dimensionar |
| 14 | Indexador, bloqueo y sensor | 1 conjunto | Disco, pasador, liberación actuada y confirmación de posición |
| 15 | Cartucho de lápiz con resorte | 1 | Placa, abrazadera, guía, resorte y herramienta |
| 16 | Cartucho de electroimán | 1 | Placa, núcleo, bobina y conexiones |
| 17 | Cartucho de pinza y microservo | 1 | Placa, mordazas, ejes/transmisión y microservo |
| 18 | Sensores capacitivo e inductivo | 1 par | Soporte fijo fuera del barrido del tambor |
| 19 | Arduino, potencia y fuente | 1 conjunto | Control, interfaces de servos/sensores y etapa de potencia |
| 20 | Tornillos, insertos y cableado | 1 lote | Incluye conectores de cartucho y lazo de cable de giro limitado |

Ventaja conceptual: selección sin estación externa. Compromiso: el brazo soporta todos los cartuchos, el tambor y su accionamiento. Los 70 g corresponden al objeto y se suman al peso completo del cabezal; no se ha validado la capacidad del EEZY modificado.

## Electrónica común y validaciones necesarias
- PC/MATLAB o Python envía trayectorias al controlador. La geometría final deberá trasladarse a Simulink conforme al enunciado.
- Alimentación de actuadores dimensionada por corrientes reales; regulación independiente para lógica/sensores según componentes elegidos.
- Electroimán controlado mediante etapa MOSFET y diodo de rueda libre; adaptar las señales de sensores a la tensión lógica.
- Comprobar bloqueo y herramienta seleccionada antes de ejecutar la trayectoria.
- Calibrar el punto de trabajo de cada herramienta y la altura del papel. La punta de escritura requiere recorrido elástico y fuerza de contacto limitada.
- Verificar par, rigidez, carga con herramienta, holgura, repetibilidad, interferencias, alcance de toda la rosa y acceso al almacén o barrido de torreta.
- Definir con el curso la métrica del 90% y medirla en el robot físico. Ni estos bocetos ni la coincidencia IK/FK prueban esa precisión.
- Tornillos e insertos aparecen como lote porque faltan CAD, espesores y tolerancias. No se trasladan automáticamente las medidas M3/M4 de la imagen original a los nuevos cabezales.

## Fuentes consultadas
- [SCARA de HowToMechatronics](https://howtomechatronics.com/projects/scara-robot-how-to-build-your-own-arduino-based-robot/): arquitectura, guías, transmisiones y montaje de referencia.
- [easyEEZYbotARM](https://github.com/meisben/easyEEZYbotARM): modelo y documentación del brazo. Sus notas de uso no acreditan una capacidad de 70 g para esta adaptación.
- [EEZYbotARM Mk2, autor original](https://www.instructables.com/EEZYbotARM-Mk2-3D-Printed-Robot/).
- Enunciado local: MATHBOT_-_Semestre_2_2026.pdf.
- README.md y mathbot_investigacion_construccion.html: trayectoria y geometría SCARA propuesta. Sus estimaciones de desempeño/costos no se consideran resultados experimentales.
- python/easyEEZYbotARM/kinematic_model.py: dimensiones originales Mk2.
- python/simular_trayectoria_eezy.py y python/figuras/eezy_poses_petalos.png: configuración y vistas de la simulación local.

