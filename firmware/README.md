# Firmware MathBot · Arduino MEGA 2560

![Diagrama de conexión](diagrama_conexion_mega.svg)

Planos eléctricos (conexión general E-01, diagrama de circuito E-02 y conexión del sensor inductivo E-03):
[`diagramas_electricos/index.html`](diagramas_electricos/index.html). S1, F1 y C1 aparecen como agregados recomendados.

La CNC Shield V3 se monta sobre el Mega igual que sobre el UNO: los pines D2–D13 y A0–A3 coinciden,
así que motores y finales de carrera quedan como en el artículo de HowToMechatronics. Lo que agrega
el cabezal de disco va a los pines que solo tiene el Mega.

| Función | Pin | Notas |
|---|---|---|
| J1 · J2 · J3 · Z (STEP / DIR) | 2/5 · 3/6 · 4/7 · 12/13 | ranuras X, Y, Z, A (eje A clonado en D12/D13) |
| Enable de los 4 drivers | D8 | LOW = energizados |
| Finales SW1 J1 · SW2 J2 · SW3 J3 · SW4 Z | D11 · D10 · D9 · A3 | NC a GND, como HTM |
| Sensor inductivo (vía PC817) | D22 | LOW = metal |
| Electroimán (módulo MOSFET D4184) | D24 | diodo 1N5819 en paralelo a la bobina |
| START · PARO | D26 · D28 | NA a GND · hongo NC a GND |
| LED verde · amarillo · rojo | D30 · D32 · D34 | con 220 Ω |
| Buzzer | D36 | |
| Servo SG90 del plumón | D44 | alimentado por el buck a 5.5–6 V, no por el Mega |
| Monitor de 12 V | A8 | divisor 10 kΩ / 3.3 kΩ |
| Libres | Serial1–3, I2C 20/21, A9–A15, impares D23–D53 | HC-05, STS3215, AS5600, LCD |

Microstepping: jumper **solo en MS2** de cada driver (1/4 de paso, el que usa `python/scara_modelo.py`).

## Versiones por etapa

El robot se arma por partes, así que el firmware también: cada etapa tiene su sketch y solo pide el
hardware que ya está montado. No hay que pasar a la siguiente hasta que la anterior funcione.

| Etapa | Sketch | Qué necesita montado | Qué comprueba |
|---|---|---|---|
| 1 · Motores | `prueba_nema/prueba_nema_90deg/` | Mega + shield + drivers + NEMA sueltos sobre la mesa, 12 V. Opcional: relé, sensor y electroimán | Cada joint ~90° ida y vuelta, luego X+Y+Z juntos, jog y la rosa. Relé sensor/imán con `e` `a` `m`. Sin bibliotecas, finales ni PARO. Ajusta Vref antes |
| 2 · Preliminar | `prueba_componentes/` y `prueba_servo/` | Lo anterior + finales, sensor, electroimán, botones, LED, buzzer, divisor de 12 V, servo | Menú uno por uno: sentido de giro (`INVERTIR_DIR`), finales, sensor, imán, 12 V. `prueba_servo` da los ángulos ARRIBA/ABAJO |
| 2b · Sensor | `prueba_sensor/` | Sensor LJ18A3 con su PC817; para el paso de ruido, electroimán y servo | Asistente de 6 pasos (`a`): reposo, detección, distancia con calzas, las 4 piezas de la misión a 3 mm, ruido con imán y servo, rebotes. Repetirlo con el sensor ya montado |
| 3 · Disco | `prueba_cabezal/` | Brazo 2 + J3 + cabezal v3 con sus tres herramientas en un soporte | Homing de J3 y dónde dispara su final, cambio de herramienta, 18 mm de levante del plumón (`c 20`), agarre del imán, distancia de detección del sensor, que nada roce al girar |
| 4 · Robot completo | `mathbot_mega/` (v3.0) | Todo el SCARA | Homing, jog, puntos, rosa y misión; se maneja desde el [panel de operario](../panel/README.md) o el Monitor Serie |

`prueba_cabezal` tiene además `x`, un chequeo guiado de 9 pasos que termina imprimiendo los `CFG` a copiar.
Guía visual de las etapas 2b y 3 (cableado del sensor, montaje, servo y chequeo): [`guia_cabezal/index.html`](guia_cabezal/index.html).

El electroimán de laboratorio del MiniPBL2 (perno 3/8" y AWG 16, relé T73 en D24, fuente de 12 V limitada a 2 A) se prueba aparte, con [`prueba_electroiman/`](prueba_electroiman/): pulsos de máximo 10 s (`e`, `e 5`, `a`) y la prueba oficial (`p`). Construcción y cálculos en [`guia_electroiman/index.html`](guia_electroiman/index.html). El imán del robot sigue siendo el KK-P20/15 con el módulo D4184.

## Cabezal en `prueba_nema` (relé sensor / imán)

`prueba_nema_90deg` maneja también el sensor inductivo y el electroimán con el mismo relé del montaje del
Nano del MiniPBL2: **nunca están los dos con energía**. En reposo el relé alimenta al sensor (NC); al
encender el imán pasa al NO y el sensor se queda sin energía. Solo usa D22 y D24, que la CNC Shield no
tapa, así que funciona con el shield puesto y sin sus 12 V (Mega por USB y la fuente del imán).

| Orden | Qué hace |
|---|---|
| `e` · `e s` | enciende el electroimán 10 s · s segundos (1 a 10) y se apaga solo |
| `a` | apaga el electroimán ya (`!` también) |
| `m` | estado: imán ON/OFF con su tiempo, sensor METAL / sin metal / sin energía / arrancando |

- El sensor avisa solo al cambiar (`L sensor: METAL`, `L sensor: sin metal`), con 50 ms de filtro.
- Tras arrancar o apagar el imán, el sensor recién reconectado se ignora 2 s.
- Máximo 10 s de imán y 3 s de descanso obligatorio entre pulsos (calentamiento y fuente de 2 A).
- Durante una ida y vuelta o la rosa solo se atiende `!`: manda `e` antes o usa el jog, que no bloquea.
  El corte por tiempo del imán se cumple igual mientras los motores giran.
- Ajustes al inicio del sketch: `RELE_ACTIVO_LOW` (true para el JQC3F; false con 2N2222 + T73 o D4184) y
  `SENSOR_POR_NC` (true con este cableado; false si el café del sensor va directo a la fuente).

**Mega y CNC Shield**

| Función | Ranura | Pines |
|---|---|---|
| J1 · J2 · J3 (STEP / DIR) | X · Y · Z | 2/5 · 3/6 · 4/7 |
| Z de la plataforma (STEP / DIR) | A (jumpers del clon) | 12/13 |
| Enable de los 4 drivers | — | D8 (LOW = energizados) |
| Potencia de motores | borne de 12 V del shield | Fuente 1 |

**Módulo relé JQC3F** (optoacoplado, se activa con LOW, jumper JD-VCC ↔ VCC puesto)

| Módulo | Mega |
|---|---|
| IN | D24 |
| VCC | 5V del conector doble (arriba, junto a D22/D23) |
| GND | GND del conector doble (abajo, junto a D52/D53) |

**Potencia del cabezal** (Fuente 2: 12 V, límite 2 A)

| Desde | Hasta |
|---|---|
| Fuente 2 (+) | COM del relé |
| NC | café del sensor (+) |
| NO | electroimán → Fuente 2 (−) |
| 1N4007 | en paralelo al electroimán, franja hacia el NO |
| Azul del sensor | Fuente 2 (−) y GND del Mega (tierra común obligatoria) |
| Negro del sensor | diodo 1N4148/1N4007 (franja hacia el sensor) → D22 |

La Fuente 1 (−) ya queda unida al GND del Mega a través del shield.

| Estado | Relé (IN) | Sensor | Electroimán |
|---|---|---|---|
| Reposo / arranque | HIGH | con energía, se lee | apagado |
| `e` | LOW | sin energía | encendido (máx. 10 s) |
| Tiempo, `a` o `!` | HIGH | se reconecta, 2 s ignorado | apagado, 3 s de descanso |

**Si el sensor no responde**: con acero a 4–8 mm su LED trasero debe prender. Sin LED, falta energía
(¿café en NC y no en NO?, 12 V entre café y azul con el relé en reposo). Con LED pero sin aviso, mide D22:
debe ser ~5 V sin metal y < 1 V con metal. Si se queda en 5 V: diodo al revés, cable en D23 o falta la
tierra común. Si con metal queda en 1.3–2 V, la caída del diodo deja el LOW en el límite: usa un Schottky
1N5819 o el PC817. El sensor debe ser **NPN NO**; con uno PNP el diodo bloquea la señal. No quites el
diodo: si el sensor trae resistencia interna a 12 V, entrarían a D22.

Lo que sale de cada etapa se pasa a la siguiente por `CFG` (sin recompilar): `home3` (ángulo donde
dispara el final de J3, etapa 3), `servoup` / `servodn` (etapas 2–3), `inv` (bits de sentido, etapa 2).

Necesitan la biblioteca **AccelStepper** (Gestor de bibliotecas). Placa: *Arduino Mega or Mega 2560*.
Monitor Serie a 115200 con fin de línea "Nueva línea".

## Protocolo de `mathbot_mega` (v3.0)

Una orden por línea, en ASCII. El panel antepone `#n ` y el Mega contesta con el mismo número:
`ok n` o `err n motivo`. Escrito a mano en el Monitor Serie funciona igual sin el prefijo.

| Orden | Qué hace |
|---|---|
| `?` | identificación `I MATHBOT 3.0 ...` (geometría y límites), configuración `C ...` y puntos |
| `H [j1\|j2\|j3\|z]` | homing con finales (todos: Z, J3, J2, J1; o un eje). Si ya había home, avisa `E DERIVA eje mm/°` |
| `S [t1 t2 phi z]` | home manual: la pose actual pasa a ser esa (sin números: J1–J3 = 0 y Z la que tenía, o `home4` si no la sabía) |
| `O 0` / `O 1` | soltar / energizar los drivers (los 4 a la vez: EN es común en D8) |
| `J eje d` | jog: `1..4` (J1–J3 en °, Z en mm) o `x` `y` `z` (punta, mm). Sin home solo el articular, sin límites |
| `T p\|i\|s` | herramienta activa: plumón, electroimán, sensor (gira J3) |
| `M x y` · `L x y` | mover la herramienta a (x, y) en articular · en línea recta a la velocidad de trazo |
| `Z z` · `ZT h` | altura de la plataforma · punta de la herramienta a h mm sobre la mesa |
| `A t1 t2 phi z` | ángulos directos |
| `P 1\|0` · `E 1\|0` · `V v` | plumón abajo/arriba · electroimán · velocidad de trazo (mm/s) |
| `PT` · `PT n x y h` · `PT n` · `PTB n` · `G n` | listar · guardar punto (o la punta actual) · borrar · ir al punto |
| `X` · `K` · `D` · `D?` · `R` | escanear puntos · recoger metálicas · trazar la rosa · comprobar la rosa · misión completa |
| `CFG [clave valor]` | ver / cambiar: `home1..4 zmesa rosax rosay rosaa binx biny binh vel servoup servodn inv finales cabezal` |
| `GUARDAR` · `CARGAR` · `FABRICA` | EEPROM: guardar la configuración y los puntos · releer · valores de fábrica |
| `C` | limpiar el paro (obliga a repetir el home) |
| `!` | paro inmediato, en cualquier momento, incluso a mitad de otra orden |

Lo que manda el Mega sin que se lo pidan:

- `S est t1 t2 phi z herr pluma iman metal 12V finales`, 5 Hz moviéndose y 2 Hz quieto. `est`: `R` listo,
  `H` listo con home manual, `N` sin home, `M` moviéndose, `L` motores sueltos, `P` en paro.
- `E FASE escaneo|recoleccion|rosa|regreso`, `E METAL n 0|1`, `E DERIVA eje d`, `E FIN segundos`, `E PARO motivo`.
- `L texto`: mensajes para el registro.

## Limitaciones a tener en cuenta al probar

- **Abrir el puerto reinicia el Mega** (DTR). Conectar el panel a mitad de una misión la corta. Durante
  el reinicio (~1 s) D8 queda flotando y los drivers se sueltan: el firmware los energiza en la primera
  línea de `setup()`, pero **la plataforma Z baja un poco cada vez**. Antes de conectar, Z arriba o sobre algo.
- **Z cae con los motores sueltos**: el husillo Tr8×8 no es autobloqueante. `O 0` y el home manual la dejan
  caer; el paro por software la sostiene. Un corte de 12 V también la suelta: deja un tope o un bloque bajo
  la plataforma en las pruebas.
- **El hongo de PARO solo es software**: si el Mega se cuelga no detiene nada. Para la versión final, que el
  hongo corte los 12 V de los drivers con un relé o contactor (y aceptar que Z baje).
- **Posición estimada**: el Mega cuenta pasos, no los mide. Si un motor salta pasos la posición mostrada
  miente hasta el próximo `H`; `E DERIVA` dice cuánto se había perdido.
- **CPU**: AccelStepper da ~4000 pasos/s en total en el Mega. Por eso las velocidades son modestas y el
  estado sale a 5 Hz como máximo; el panel interpola entre lecturas.
- **Serie**: 64 bytes de buffer. El panel manda una orden y espera su `ok` antes de la siguiente; no
  pegues varias líneas de golpe en el Monitor Serie.
- **EEPROM**: ~100 000 escrituras. `CFG` y `PT` cambian la RAM; solo `GUARDAR` escribe.
- **12 V**: el estado los reporta (divisor en A8) y el homing avisa si no los detecta (< 10.5 V): sin ellos
  el Mega cuenta pasos que los motores no dan.

## Simular en Wokwi

1. Abre <https://wokwi.com/projects/new/arduino-mega>.
2. Pestaña `diagram.json`: reemplaza todo por `wokwi/diagram.json`.
3. Library Manager → agrega **AccelStepper** (o crea `libraries.txt` con el de `wokwi/`).
4. Pestaña `sketch.ino`: pega el sketch que quieras probar y cambia `SIMULACION = true`
   (en Wokwi los finales de carrera son pulsadores NA).
5. Play. Comandos útiles en `mathbot_mega`: `S` (home manual), `?`, `T s`, `M 200 -100`, `D?`, `D`, `R`.
   Para probar el homing con `H`, pulsa SW4, SW3, SW2 y SW1 en ese orden mientras cada motor gira.

En la simulación el electroimán es el LED morado, el sensor es el pulsador azul "Sensor: metal"
(mantenlo apretado durante el escaneo para marcar una pieza como metálica), el PARO es el interruptor
deslizante y el potenciómetro hace de divisor de 12 V. El servo se alimenta del 5 V solo en Wokwi.
