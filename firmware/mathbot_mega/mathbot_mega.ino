/*
  MathBot · firmware principal v3.0 (etapa 4: robot completo + panel de operario)
  Arduino MEGA 2560 + CNC Shield V3 + 4 x A4988 (1/4 de micropaso: jumper solo en MS2)

  SCARA de HowToMechatronics con el cabezal A v3 · disco tri-herramienta:
    plumón (phi 0°, r 55 mm), electroimán (phi 120°), sensor inductivo (phi 240°), todos a 55 mm de J3.
    La placa cuelga 14 mm bajo la brida (separador) y J3 trabaja entre −120° y +121°
    (BRAZO SCARA/DISEÑO FINAL/Cabezal disco/README.md).

  Se maneja desde el panel de operario (panel/) o a mano desde el Monitor Serie (115200, "Nueva línea").
  Protocolo (firmware/README.md): una orden por línea; prefijo opcional "#n " para que la respuesta
  lleve el mismo número. Cada orden termina en "ok [n]" o "err [n] motivo". Mientras tanto el Mega
  manda líneas de estado "S ..." (5 Hz moviéndose, 2 Hz quieto), eventos "E ..." y mensajes "L ...".
  "!" en cualquier momento dispara el paro.

    ?                  identificación, geometría y configuración
    H [j1|j2|j3|z]     homing con finales de carrera (todos, o un eje); si ya había home, informa la deriva
    S [t1 t2 phi z]    home manual: toma la pose actual como (t1, t2, phi, z); sin números J1–J3 = 0
    O 0 | O 1          soltar motores (se mueven con la mano; ¡Z puede bajar!) | energizar
    J eje d            mover un paso de jog: eje 1..4 (J1 J2 J3 en grados, Z en mm) o x / y / z (punta, mm)
    T p|i|s            herramienta activa (gira J3)
    M x y              llevar la herramienta activa a (x, y) en articular
    L x y              línea recta a (x, y) a la velocidad de trazo
    Z z | ZT h         altura de la plataforma (mm) | punta de la herramienta activa a h mm sobre la mesa
    A t1 t2 phi z      ángulos directos
    P 1|0  E 1|0  V v  plumón abajo/arriba, electroimán, velocidad de trazo (mm/s)
    PT                 lista de puntos;  PT n x y h  guarda el punto n;  PT n  guarda la punta actual
    PTB n              borrar el punto n;  G n  ir al punto n (herramienta activa, altura de tránsito)
    X  K  D  D?  R     escanear puntos, recoger metálicas, trazar la rosa, comprobar la rosa, misión completa
    CFG [clave valor]  ver / cambiar la configuración;  GUARDAR  CARGAR  FABRICA  (EEPROM)
    C                  limpiar el paro (obliga a repetir el home)

  Bibliotecas: AccelStepper (Mike McCauley), Servo y EEPROM (incluidas en el IDE).
*/
#include <AccelStepper.h>
#include <Servo.h>
#include <EEPROM.h>
#include <math.h>

#define VERSION "3.0"
const bool SIMULACION = false;  // true en Wokwi: los finales de carrera son pulsadores NA

// ============================================================================
// Hardware
// ============================================================================
const uint8_t PIN_ENABLE = 8;            // común a los 4 drivers: no se puede soltar un eje solo
const uint8_t J1_STEP = 2, J1_DIR = 5;   // ranura X
const uint8_t J2_STEP = 3, J2_DIR = 6;   // ranura Y
const uint8_t J3_STEP = 4, J3_DIR = 7;   // ranura Z  (como en HTM, J3 va en la ranura Z)
const uint8_t Z_STEP = 12, Z_DIR = 13;   // ranura A  (jumpers del eje A en D12/D13)
const uint8_t SW_J1 = 11, SW_J2 = 10, SW_J3 = 9, SW_Z = A3;

const uint8_t PIN_SENSOR = 22;    // salida del PC817 (LOW = metal)
const uint8_t PIN_IMAN = 24;      // gate del módulo MOSFET D4184
const uint8_t PIN_START = 26;     // pulsador NA a GND
const uint8_t PIN_PARO = 28;      // hongo NC a GND (abierto = paro)
const uint8_t LED_VERDE = 30, LED_AMARILLO = 32, LED_ROJO = 34;
const uint8_t PIN_BUZZER = 36;
const uint8_t PIN_SERVO = 44;     // SG90 / MG90S del levante del plumón (alimentado por el buck)
const uint8_t PIN_12V = A8;       // divisor 10k / 3.3k desde los 12 V

// ============================================================================
// Geometría fija (python/scara_modelo.py y el CAD del cabezal)
// ============================================================================
const float L1 = 228.0, L2 = 144.0;
const float CAIDA_BRIDA = 80.5;    // base de la plataforma Z -> brida del cabezal (medido en el STEP de HTM)
const float ESPESOR_DISCO = 20.0;  // separador de brida de 14 mm + placa de 6 mm
const int CODO = -1;               // theta2 negativo

struct Herramienta {
  const char *nombre;
  char letra;
  float phiDeg;  // posición en el disco
  float radio;   // distancia al eje J3 (mm)
  float bajo;    // cuánto sobresale bajo el disco (mm)
};
enum { PLUMON = 0, IMAN = 1, SENSOR = 2 };
const Herramienta HERR[3] = {
  { "plumon", 'p', 0.0, 55.0, 50.0 },
  { "electroiman", 'i', 120.0, 55.0, 40.0 },
  { "sensor", 's', 240.0, 55.0, 38.0 },
};

enum { EJE_J1 = 0, EJE_J2 = 1, EJE_J3 = 2, EJE_Z = 3 };
const char *const NOMBRE_EJE[4] = { "J1", "J2", "J3", "Z" };
const float PASOS_UNIDAD[4] = { 44.4444, 35.5556, 10.0, 100.0 };  // pasos/grado, pasos/mm en Z
const float VMAX[4] = { 3000, 3000, 1500, 3500 };                  // pasos/s (AccelStepper: ≈4000 en total en un AVR)
const float ACEL[4] = { 2000, 2000, 1500, 3000 };                  // pasos/s²
const float LIM_J[2] = { -150, 150 };                              // J1 y J2
const float LIM_J3_CABEZAL[2] = { -120, 121 };   // el plumón sube 71 mm y pasa a 2 mm del brazo 2 en ±121°
const float LIM_J3_SIN[2] = { -170, 170 };
const float Z_MAX = 203.0;                       // varillas de 250 mm
const float Z_MIN_MECANICO = 103.5;              // la plataforma toca la tapa inferior
const float Z_MIN_CABEZAL = 140.5;               // la cara del electroimán toca la mesa (el plumón cede 18 mm)

const int HOME_SENTIDO[4] = { -1, -1, -1, +1 };              // J1–J3 hacia negativo, Z hacia arriba
const float HOME_VEL[4] = { 1200, 1300, 1100, 1500 };         // pasos/s
const float HOME_RECORRIDO_MAX[4] = { 320, 320, 360, 120 };   // si no toca el final -> error

const float Z_TIP_VIAJE = 60;  // altura de la punta en tránsito (mm sobre la mesa)
const float ROSA_A = 102.9, ROSA_K = 1.3552;
const float ROSA_T0 = 5 * M_PI / 6, ROSA_T1 = 11 * M_PI / 6;
const float SEG_MM = 1.0;      // largo de cada tramo recto del trazo
const uint8_t MAX_PUNTOS = 12;

// ============================================================================
// Configuración guardada en EEPROM (se cambia con CFG y se guarda con GUARDAR)
// ============================================================================
struct Punto { float x, y, h; };
struct Config {
  uint16_t magia;
  float home[4];       // dónde queda cada final de carrera (grados / mm): calibrar
  float zMesa;         // altura de la hoja sobre la mesa de referencia (mm)
  float rosaX, rosaY, rosaAlfa;  // centro y giro de la rosa (mm, mm, grados)
  float binX, binY, binH;        // bandeja de metales
  float velTrazo;                // mm/s
  uint8_t servoArriba, servoAbajo;  // grados del SG90 (prueba_servo / prueba_cabezal)
  uint8_t invertir;    // bit i = eje i gira al revés
  uint8_t finales;     // 1 = hay finales de carrera (H permitido)
  uint8_t cabezal;     // 1 = cabezal A montado (límites de J3 y Z, IK por herramienta)
  uint8_t nPuntos;
  Punto pt[MAX_PUNTOS];
  uint16_t suma;
};
const uint16_t MAGIA = 0x4D33;  // "M3"
Config cfg;

void configFabrica() {
  const float home[4] = { -89.0, -152.4, -120.0, 203.0 };  // J1/J2/Z: valores de HTM; J3: cabezal v3
  for (int i = 0; i < 4; i++) cfg.home[i] = home[i];
  cfg.zMesa = 0;
  cfg.rosaX = 185; cfg.rosaY = 0; cfg.rosaAlfa = 180;
  cfg.binX = 95; cfg.binY = 265; cfg.binH = 25;
  cfg.velTrazo = 25;
  cfg.servoArriba = 110; cfg.servoAbajo = 20;
  cfg.invertir = 0; cfg.finales = 1; cfg.cabezal = 1;
  const Punto def[4] = { { 60, -215, 3 }, { 150, -238, 8 }, { 240, -215, 7 }, { 325, -172, 12 } };
  cfg.nPuntos = 4;
  for (int i = 0; i < 4; i++) cfg.pt[i] = def[i];
}

uint16_t sumaConfig() {
  const uint8_t *p = (const uint8_t *)&cfg;
  uint16_t s = 0;
  for (size_t i = 0; i < offsetof(Config, suma); i++) s = s * 31 + p[i];
  return s;
}

bool cargarConfig() {
  EEPROM.get(0, cfg);
  if (cfg.magia == MAGIA && cfg.suma == sumaConfig() && cfg.nPuntos <= MAX_PUNTOS) return true;
  configFabrica();
  return false;
}

void guardarConfig() {  // EEPROM.put solo escribe los bytes que cambian (≈100 000 escrituras por celda)
  cfg.magia = MAGIA;
  cfg.suma = sumaConfig();
  EEPROM.put(0, cfg);
}

// ============================================================================
// Estado
// ============================================================================
AccelStepper motor[4] = {
  AccelStepper(AccelStepper::DRIVER, J1_STEP, J1_DIR),
  AccelStepper(AccelStepper::DRIVER, J2_STEP, J2_DIR),
  AccelStepper(AccelStepper::DRIVER, J3_STEP, J3_DIR),
  AccelStepper(AccelStepper::DRIVER, Z_STEP, Z_DIR),
};
const uint8_t PIN_FINAL[4] = { SW_J1, SW_J2, SW_J3, SW_Z };
Servo servoPluma;

bool ejeConocido[4] = { false, false, false, false };  // posición referida (home con final o manual)
bool homeHecho = false;
bool homeManual = false;
bool motoresOn = false;
bool moviendo = false;
bool plumaAbajo = false;
bool enParo = false;
int herrActiva = PLUMON;
bool piezaMetal[MAX_PUNTOS];
bool escaneoHecho = false;
const __FlashStringHelper *error = nullptr;  // motivo del último fallo (para "err")
unsigned long tEstado = 0;

// ============================================================================
// Utilidades
// ============================================================================
bool fallo(const __FlashStringHelper *motivo) { error = motivo; return false; }

float envolver(float a) {
  while (a > 180) a -= 360;
  while (a <= -180) a += 360;
  return a;
}

long aPasos(int eje, float v) { return lround(v * PASOS_UNIDAD[eje]); }
float posicion(int eje) { return motor[eje].currentPosition() / PASOS_UNIDAD[eje]; }

bool finalActivo(uint8_t pin) {
  // Real: final NC entre pin y GND (como HTM), activo = abierto = HIGH (un cable cortado se lee como activo).
  return digitalRead(pin) == (SIMULACION ? LOW : HIGH);
}

bool hayMetal() {
  int votos = 0;
  for (int i = 0; i < 20; i++) {
    if (digitalRead(PIN_SENSOR) == LOW) votos++;
    delay(10);
  }
  return votos > 10;
}

float voltaje12() { return analogRead(PIN_12V) * (5.0 / 1023.0) * (13.3 / 3.3); }

void leds(bool verde, bool amarillo, bool rojo) {
  digitalWrite(LED_VERDE, verde);
  digitalWrite(LED_AMARILLO, amarillo);
  digitalWrite(LED_ROJO, rojo);
}

void pitido(int f, int ms) { tone(PIN_BUZZER, f, ms); }

void motores(bool on) {
  digitalWrite(PIN_ENABLE, on ? LOW : HIGH);
  motoresOn = on;
}

void pluma(bool abajo) {
  servoPluma.write(abajo ? cfg.servoAbajo : cfg.servoArriba);
  plumaAbajo = abajo;
  delay(350);  // SG90 ≈0.1 s / 60°; el brazo gira ≈76°
}

void iman(bool on) { digitalWrite(PIN_IMAN, on ? HIGH : LOW); }

float limMin(int e) {
  if (e < 2) return LIM_J[0];
  if (e == EJE_J3) return cfg.cabezal ? LIM_J3_CABEZAL[0] : LIM_J3_SIN[0];
  return cfg.cabezal ? Z_MIN_CABEZAL + cfg.zMesa : Z_MIN_MECANICO;
}
float limMax(int e) {
  if (e < 2) return LIM_J[1];
  if (e == EJE_J3) return cfg.cabezal ? LIM_J3_CABEZAL[1] : LIM_J3_SIN[1];
  return Z_MAX;
}

// Herramienta "efectiva": sin cabezal todo se refiere al eje de J3 y a la cara de la brida.
float radioH(int k) { return cfg.cabezal ? HERR[k].radio : 0; }
float bajoH(int k) { return cfg.cabezal ? ESPESOR_DISCO + HERR[k].bajo : 0; }

// Altura de la plataforma para que la punta de la herramienta k quede a ztip sobre la mesa.
// El plumón se calcula bajado; con el plumón arriba su punta queda 18 mm más alta.
float zPlataforma(float ztip, int k) { return ztip + cfg.zMesa + CAIDA_BRIDA + bajoH(k); }
float zTransito() { return min(zPlataforma(Z_TIP_VIAJE, IMAN), Z_MAX); }

// ============================================================================
// Estado para el panel
// ============================================================================
char letraEstado() {
  if (enParo) return 'P';
  if (!motoresOn) return 'L';
  if (moviendo) return 'M';
  if (!homeHecho) return 'N';
  return homeManual ? 'H' : 'R';
}

// "S est th1 th2 phi z herr pluma iman metal 12V finales": ≈50 bytes, cabe en el buffer de 64 del UART
void enviarEstado() {
  Serial.print(F("S "));
  Serial.print(letraEstado());
  for (int i = 0; i < 4; i++) { Serial.print(' '); Serial.print(posicion(i), i == EJE_Z ? 1 : 2); }
  Serial.print(' '); Serial.print(HERR[herrActiva].letra);
  Serial.print(' '); Serial.print(plumaAbajo ? 1 : 0);
  Serial.print(' '); Serial.print(digitalRead(PIN_IMAN) ? 1 : 0);
  Serial.print(' '); Serial.print(digitalRead(PIN_SENSOR) == LOW ? 1 : 0);
  Serial.print(' '); Serial.print(voltaje12(), 1);
  Serial.print(' ');
  for (int i = 0; i < 4; i++) Serial.print(finalActivo(PIN_FINAL[i]) ? 1 : 0);
  Serial.println();
}

void estadoPeriodico() {
  unsigned long ahora = millis();
  if (ahora - tEstado >= (moviendo ? 200UL : 500UL)) {
    tEstado = ahora;
    enviarEstado();
  }
}

// ============================================================================
// Paro de emergencia
// ============================================================================
void dispararParo(const __FlashStringHelper *motivo) {
  if (enParo) return;
  enParo = true;
  homeHecho = homeManual = false;
  // Se detiene en seco y SOSTIENE la posición: soltar los drivers dejaría caer la plataforma Z sobre la mesa.
  // El home se invalida porque un frenado brusco puede perder pasos.
  for (int i = 0; i < 4; i++) { motor[i].setCurrentPosition(motor[i].currentPosition()); ejeConocido[i] = false; }
  iman(false);
  moviendo = false;
  leds(false, false, true);
  pitido(2000, 600);
  Serial.print(F("E PARO "));
  Serial.println(motivo);
  error = F("paro");
}

// Se llama dentro de todos los bucles de movimiento: hongo, "!" y estado periódico.
bool sigue() {
  if (digitalRead(PIN_PARO) == HIGH) dispararParo(F("hongo"));
  if (Serial.available() && Serial.peek() == '!') {
    Serial.read();
    dispararParo(F("panel"));
  }
  estadoPeriodico();
  return !enParo;
}

// ============================================================================
// Cinemática
// ============================================================================
bool dentroLimites(const float q[4]) {
  for (int i = 0; i < 4; i++)
    if (q[i] < limMin(i) - 1e-3 || q[i] > limMax(i) + 1e-3) return false;
  return true;
}

// IK de la punta de la herramienta k con el disco girado para tenerla al frente (phi = -phi_k):
// la herramienta queda en la línea de Arm 2, así que Arm 2 "mide" L2 + r.
bool ik(float x, float y, int k, float &th1, float &th2) {
  float le = L2 + radioH(k);
  float c2 = (x * x + y * y - L1 * L1 - le * le) / (2 * L1 * le);
  if (c2 < -1 || c2 > 1) return false;
  for (int intento = 0; intento < 2; intento++) {
    int codo = intento == 0 ? CODO : -CODO;
    float t2 = codo * acos(c2);
    float t1 = atan2(y, x) - atan2(le * sin(t2), L1 + le * cos(t2));
    th1 = envolver(degrees(t1));
    th2 = envolver(degrees(t2));
    if (th1 >= LIM_J[0] && th1 <= LIM_J[1] && th2 >= LIM_J[0] && th2 <= LIM_J[1]) return true;
  }
  return false;
}

float phiHerramienta(int k) { return cfg.cabezal ? envolver(-HERR[k].phiDeg) : 0; }

// Punta de la herramienta activa con los ángulos actuales (cinemática directa).
void puntaActual(float &x, float &y) {
  float a1 = radians(posicion(EJE_J1)), a12 = a1 + radians(posicion(EJE_J2));
  float psi = a12 + radians(posicion(EJE_J3) + (cfg.cabezal ? HERR[herrActiva].phiDeg : 0));
  x = L1 * cos(a1) + L2 * cos(a12) + radioH(herrActiva) * cos(psi);
  y = L1 * sin(a1) + L2 * sin(a12) + radioH(herrActiva) * sin(psi);
}

// ============================================================================
// Movimiento
// ============================================================================
void limpiarVelocidades() {
  for (int i = 0; i < 4; i++) motor[i].setCurrentPosition(motor[i].currentPosition());
}

// Movimiento articular con perfiles trapezoidales escalados para que los 4 ejes terminen a la vez.
bool moverArticular(float th1, float th2, float phi, float z, bool conLimites = true) {
  float q[4] = { th1, th2, phi, z };
  if (conLimites && !dentroLimites(q)) return fallo(F("fuera de los limites articulares"));
  if (!motoresOn) return fallo(F("motores sueltos (O 1)"));
  if (!sigue()) return false;
  limpiarVelocidades();
  long d[4];
  int ref = 0;
  float tMax = 0;
  for (int i = 0; i < 4; i++) {
    d[i] = labs(aPasos(i, q[i]) - motor[i].currentPosition());
    float t = d[i] / VMAX[i];
    if (t > tMax) { tMax = t; ref = i; }
  }
  if (d[ref] == 0) return true;
  for (int i = 0; i < 4; i++) {
    float k = (float)d[i] / d[ref];
    motor[i].setMaxSpeed(max(1.0f, VMAX[ref] * k));
    motor[i].setAcceleration(max(1.0f, ACEL[ref] * k));
    motor[i].moveTo(aPasos(i, q[i]));
  }
  moviendo = true;
  leds(false, true, false);
  uint16_t n = 0;
  bool corriendo = true;
  while (corriendo) {
    corriendo = false;
    for (int i = 0; i < 4; i++) corriendo |= motor[i].run();
    if ((++n & 63) == 0 && !sigue()) return false;
  }
  moviendo = false;
  leds(homeHecho, false, false);
  return true;
}

bool moverZ(float z) { return moverArticular(posicion(EJE_J1), posicion(EJE_J2), posicion(EJE_J3), z); }

// Tramo a velocidad constante (sin rampa): los ejes llegan a la vez en T segundos.
bool tramo(const long obj[4], float T) {
  for (int i = 0; i < 4; i++) {
    long d = obj[i] - motor[i].currentPosition();
    motor[i].moveTo(obj[i]);
    motor[i].setMaxSpeed(VMAX[i]);
    motor[i].setSpeed(min(VMAX[i], fabs(d / T)) * (d >= 0 ? 1 : -1));
  }
  moviendo = true;
  uint16_t n = 0;
  bool corriendo = true;
  while (corriendo) {
    corriendo = false;
    for (int i = 0; i < 4; i++) {
      if (motor[i].distanceToGo() != 0) {
        motor[i].runSpeedToPosition();
        corriendo = true;
      }
    }
    if ((++n & 63) == 0 && !sigue()) return false;
  }
  return true;
}

// Lleva la punta de la herramienta activa a (x, y) en movimiento articular, a la altura actual.
bool irA(float x, float y) {
  float t1, t2;
  if (!ik(x, y, herrActiva, t1, t2)) return fallo(F("fuera de alcance"));
  return moverArticular(t1, t2, phiHerramienta(herrActiva), posicion(EJE_Z));
}

// Un punto del trazo, desde la punta actual, a la velocidad de trazo.
bool puntoTrazo(float x0, float y0, float x, float y) {
  float t1, t2;
  if (!ik(x, y, herrActiva, t1, t2)) return fallo(F("punto del trazo fuera de alcance"));
  long obj[4] = { aPasos(EJE_J1, t1), aPasos(EJE_J2, t2), motor[EJE_J3].currentPosition(), motor[EJE_Z].currentPosition() };
  float T = max(hypot(x - x0, y - y0) / cfg.velTrazo, 0.002f);
  return tramo(obj, T);
}

// Interpolación cartesiana: un tramo de IK cada SEG_MM.
bool tramoRecto(float x, float y) {
  float x0, y0;
  puntaActual(x0, y0);
  float dx = x - x0, dy = y - y0, largo = hypot(dx, dy);
  int n = max(1, (int)ceil(largo / SEG_MM));
  float xa = x0, ya = y0;
  for (int i = 1; i <= n; i++) {
    float xi = x0 + dx * i / n, yi = y0 + dy * i / n;
    if (!puntoTrazo(xa, ya, xi, yi)) return false;
    xa = xi; ya = yi;
  }
  limpiarVelocidades();
  moviendo = false;
  return true;
}

bool seleccionarHerramienta(int k) {
  if (k != PLUMON && plumaAbajo) pluma(false);
  herrActiva = k;
  if (!moverArticular(posicion(EJE_J1), posicion(EJE_J2), phiHerramienta(k), posicion(EJE_Z))) return false;
  Serial.print(F("L herramienta activa: "));
  Serial.println(HERR[k].nombre);
  return true;
}

// Paso de jog. eje 0..3 articular (sin home se permite, sin límites); 4/5/6 = x / y / z de la punta.
bool jog(int eje, float d) {
  if (eje <= EJE_Z) {
    float q[4];
    for (int i = 0; i < 4; i++) q[i] = posicion(i);
    q[eje] += d;
    if (!homeHecho && !ejeConocido[eje]) return moverArticular(q[0], q[1], q[2], q[3], false);
    if (q[eje] < limMin(eje) || q[eje] > limMax(eje)) return fallo(F("limite del eje"));
    return moverArticular(q[0], q[1], q[2], q[3], false);
  }
  if (!homeHecho) return fallo(F("primero haz home (H o S)"));
  if (eje == 6) return moverZ(posicion(EJE_Z) + d);
  float x, y;
  puntaActual(x, y);
  return irA(x + (eje == 4 ? d : 0), y + (eje == 5 ? d : 0));
}

// ============================================================================
// Home
// ============================================================================
bool homeEje(int e) {
  if (!cfg.finales) return fallo(F("sin finales de carrera: usa S (home manual)"));
  motores(true);
  bool conocido = ejeConocido[e];
  long inicio = motor[e].currentPosition();
  motor[e].setMaxSpeed(HOME_VEL[e]);
  motor[e].setSpeed(HOME_SENTIDO[e] * HOME_VEL[e]);
  long limite = aPasos(e, HOME_RECORRIDO_MAX[e]);
  moviendo = true;
  uint16_t n = 0;
  while (!finalActivo(PIN_FINAL[e])) {
    motor[e].runSpeed();
    if ((++n & 63) == 0 && !sigue()) return false;
    if (labs(motor[e].currentPosition() - inicio) > limite) {
      moviendo = false;
      leds(false, false, true);
      pitido(400, 800);
      return fallo(F("el final de carrera no se activo (cableado, 12 V o sentido)"));
    }
  }
  moviendo = false;
  // Verificación de pasos: si el eje ya tenía referencia, lo contado debería coincidir con el final.
  if (conocido) {
    Serial.print(F("E DERIVA "));
    Serial.print(NOMBRE_EJE[e]);
    Serial.print(' ');
    Serial.println(posicion(e) - cfg.home[e], 2);
  }
  motor[e].setCurrentPosition(aPasos(e, cfg.home[e]));
  ejeConocido[e] = true;
  return true;
}

void actualizarHome() {
  homeHecho = ejeConocido[0] && ejeConocido[1] && ejeConocido[2] && ejeConocido[3];
  leds(homeHecho, false, false);
}

bool homing(int soloEje) {
  if (enParo) return fallo(F("primero limpia el paro (C)"));
  if (voltaje12() < 10.5) Serial.println(F("L AVISO: no detecto los 12 V; los motores no van a moverse"));
  if (plumaAbajo) pluma(false);
  iman(false);
  if (soloEje >= 0) {
    bool ok = homeEje(soloEje);
    actualizarHome();
    return ok;
  }
  const int orden[4] = { EJE_Z, EJE_J3, EJE_J2, EJE_J1 };
  for (int i = 0; i < 4; i++) {
    if (!homeEje(orden[i])) return false;
    if (orden[i] == EJE_Z && !moverArticular(posicion(0), posicion(1), posicion(2), zTransito(), false)) return false;
  }
  homeManual = false;
  actualizarHome();
  herrActiva = PLUMON;
  if (!moverArticular(0, 0, 0, zTransito())) return false;
  pitido(1500, 120);
  return true;
}

// Home manual: la pose actual (alineada a mano, con marcas) pasa a ser (t1, t2, phi, z).
bool homeAMano(int n, const float *v) {
  if (enParo) return fallo(F("primero limpia el paro (C)"));
  float q[4] = { 0, 0, 0, ejeConocido[EJE_Z] ? posicion(EJE_Z) : cfg.home[EJE_Z] };
  if (n == 4) for (int i = 0; i < 4; i++) q[i] = v[i];
  else if (n != 0) return fallo(F("usa S o S t1 t2 phi z"));
  for (int i = 0; i < 4; i++) {
    motor[i].setCurrentPosition(aPasos(i, q[i]));
    ejeConocido[i] = true;
  }
  motores(true);
  homeManual = true;
  actualizarHome();
  herrActiva = PLUMON;
  Serial.println(F("L home manual: la precision depende de la alineacion a mano"));
  return true;
}

// ============================================================================
// Rutinas
// ============================================================================
void rosaPunto(float t, float &x, float &y) {
  float r = cos(3 * t), a = radians(cfg.rosaAlfa);
  float xl = -ROSA_A * r * cos(t);
  float yl = -ROSA_A * ROSA_K * r * sin(t);
  x = cfg.rosaX + cos(a) * xl - sin(a) * yl;
  y = cfg.rosaY + sin(a) * xl + cos(a) * yl;
}

// Recorre la rosa a tramos de ≈SEG_MM; si 'trazar' es falso solo comprueba que cada punto se alcanza.
bool recorrerRosa(bool trazar, float &total) {
  const int N = 4000;
  float xa, ya, t1, t2;
  rosaPunto(ROSA_T0, xa, ya);
  total = 0;
  for (int i = 1; i <= N; i++) {
    float px, py;
    rosaPunto(ROSA_T0 + (ROSA_T1 - ROSA_T0) * i / N, px, py);
    float d = hypot(px - xa, py - ya);
    if (d < SEG_MM && i < N) continue;
    if (trazar) {
      if (!puntoTrazo(xa, ya, px, py)) return false;
    } else if (!ik(px, py, PLUMON, t1, t2)) {
      Serial.print(F("L rosa fuera de alcance en "));
      Serial.print(px, 0); Serial.print(F(", ")); Serial.println(py, 0);
      return fallo(F("la rosa no se alcanza completa"));
    }
    total += d;
    xa = px; ya = py;
  }
  return true;
}

bool comprobarRosa() {
  float total;
  if (!recorrerRosa(false, total)) return false;
  Serial.print(F("L rosa alcanzable: "));
  Serial.print(total, 0);
  Serial.println(F(" mm"));
  return true;
}

bool dibujarRosa() {
  if (!cfg.cabezal) return fallo(F("sin cabezal"));
  if (!comprobarRosa()) return false;
  Serial.println(F("E FASE rosa"));
  float x, y, total;
  rosaPunto(ROSA_T0, x, y);
  if (!seleccionarHerramienta(PLUMON)) return false;
  if (!moverZ(zTransito()) || !irA(x, y)) return false;
  pluma(true);
  if (!moverZ(zPlataforma(8, PLUMON)) || !moverZ(zPlataforma(0, PLUMON))) return false;
  unsigned long t0 = millis();
  if (!recorrerRosa(true, total)) return false;
  limpiarVelocidades();
  moviendo = false;
  if (!moverZ(zPlataforma(10, PLUMON))) return false;
  pluma(false);
  if (!moverZ(zTransito())) return false;
  Serial.print(F("L rosa terminada: "));
  Serial.print(total, 0);
  Serial.print(F(" mm en "));
  Serial.print((millis() - t0) / 1000.0, 1);
  Serial.println(F(" s"));
  return true;
}

bool irAPunto(int i) {
  if (i < 0 || i >= cfg.nPuntos) return fallo(F("no existe ese punto"));
  if (!moverZ(zTransito())) return false;
  return irA(cfg.pt[i].x, cfg.pt[i].y);
}

bool escanear() {
  if (!cfg.cabezal) return fallo(F("sin cabezal"));
  if (cfg.nPuntos == 0) return fallo(F("no hay puntos guardados (PT)"));
  Serial.println(F("E FASE escaneo"));
  if (!seleccionarHerramienta(SENSOR)) return false;
  for (int i = 0; i < cfg.nPuntos; i++) {
    if (!irAPunto(i)) return false;
    if (!moverZ(zPlataforma(cfg.pt[i].h + 3, SENSOR))) return false;  // 3 mm sobre la pieza
    delay(300);
    piezaMetal[i] = hayMetal();
    Serial.print(F("E METAL "));
    Serial.print(i + 1);
    Serial.println(piezaMetal[i] ? F(" 1") : F(" 0"));
    if (piezaMetal[i]) pitido(1800, 80);
  }
  escaneoHecho = true;
  return moverZ(zTransito());
}

bool recolectar() {
  if (!escaneoHecho) return fallo(F("primero escanea (X)"));
  Serial.println(F("E FASE recoleccion"));
  if (!seleccionarHerramienta(IMAN)) return false;
  int lugar = 0;
  for (int i = 0; i < cfg.nPuntos; i++) {
    if (!piezaMetal[i]) continue;
    if (!irAPunto(i)) return false;
    if (!moverZ(zPlataforma(cfg.pt[i].h + 0.5, IMAN))) return false;
    iman(true);
    delay(500);
    Serial.print(F("L iman ON -> punto "));
    Serial.println(i + 1);
    if (!moverZ(zTransito())) return false;
    float bx = cfg.binX + (lugar % 2 ? 14 : -14);
    float by = cfg.binY + ((lugar / 2) % 2 ? 10 : -10);
    lugar++;
    if (!irA(bx, by)) return false;
    if (!moverZ(zPlataforma(cfg.binH + cfg.pt[i].h + 6, IMAN))) return false;
    iman(false);
    delay(400);
    if (!moverZ(zTransito())) return false;
  }
  return true;
}

bool mision() {
  if (!homeHecho) return fallo(F("primero haz home (H o S)"));
  if (!comprobarRosa()) return false;  // antes de mover nada
  unsigned long t0 = millis();
  if (!escanear() || !recolectar() || !dibujarRosa()) return false;
  Serial.println(F("E FASE regreso"));
  if (!seleccionarHerramienta(PLUMON)) return false;
  if (!moverArticular(0, 0, 0, zTransito())) return false;
  Serial.print(F("E FIN "));
  Serial.println((millis() - t0) / 1000.0, 1);
  pitido(1500, 100); delay(150); pitido(2000, 150);
  return true;
}

// ============================================================================
// Identificación y configuración
// ============================================================================
void identificar() {
  Serial.print(F("I MATHBOT " VERSION " L1 228 L2 144 CAIDA 80.5 DISCO 20 R 55 PHI 0 120 240 BAJO 50 40 38"));
  Serial.print(F(" PASOS 44.4444 35.5556 10 100 ZMAX 203 J3 "));
  Serial.print(limMin(EJE_J3), 0); Serial.print(' '); Serial.print(limMax(EJE_J3), 0);
  Serial.print(F(" ZMIN ")); Serial.println(limMin(EJE_Z), 1);
}

struct ClaveF { const char *nombre; float *v; };
struct ClaveB { const char *nombre; uint8_t *v; };
const ClaveF CLAVES_F[] = {
  { "home1", &cfg.home[0] }, { "home2", &cfg.home[1] }, { "home3", &cfg.home[2] }, { "home4", &cfg.home[3] },
  { "zmesa", &cfg.zMesa }, { "rosax", &cfg.rosaX }, { "rosay", &cfg.rosaY }, { "rosaa", &cfg.rosaAlfa },
  { "binx", &cfg.binX }, { "biny", &cfg.binY }, { "binh", &cfg.binH }, { "vel", &cfg.velTrazo },
};
const ClaveB CLAVES_B[] = {
  { "servoup", &cfg.servoArriba }, { "servodn", &cfg.servoAbajo }, { "inv", &cfg.invertir },
  { "finales", &cfg.finales }, { "cabezal", &cfg.cabezal },
};

void listarConfig() {
  for (const ClaveF &c : CLAVES_F) { Serial.print(F("C ")); Serial.print(c.nombre); Serial.print(' '); Serial.println(*c.v, 2); }
  for (const ClaveB &c : CLAVES_B) { Serial.print(F("C ")); Serial.print(c.nombre); Serial.print(' '); Serial.println(*c.v); }
}

void listarPuntos() {
  Serial.print(F("C npuntos ")); Serial.println(cfg.nPuntos);
  for (int i = 0; i < cfg.nPuntos; i++) {
    Serial.print(F("C pt ")); Serial.print(i + 1);
    Serial.print(' '); Serial.print(cfg.pt[i].x, 1);
    Serial.print(' '); Serial.print(cfg.pt[i].y, 1);
    Serial.print(' '); Serial.println(cfg.pt[i].h, 1);
  }
}

void aplicarInversion() {
  for (int i = 0; i < 4; i++) motor[i].setPinsInverted(cfg.invertir & (1 << i), false, false);
}

bool cambiarConfig(const char *clave, float v) {
  for (const ClaveF &c : CLAVES_F)
    if (!strcasecmp(clave, c.nombre)) { *c.v = v; return true; }
  for (const ClaveB &c : CLAVES_B)
    if (!strcasecmp(clave, c.nombre)) {
      *c.v = (uint8_t)constrain(v, 0, 255);
      if (c.v == &cfg.invertir) aplicarInversion();
      if (c.v == &cfg.servoArriba && !plumaAbajo) servoPluma.write(cfg.servoArriba);
      return true;
    }
  return fallo(F("clave desconocida"));
}

// ============================================================================
// Intérprete de comandos
// ============================================================================
int leerNumeros(const char *s, float *out, int maxN) {
  int n = 0;
  char *fin;
  while (n < maxN) {
    while (*s == ' ' || *s == ',' || *s == '\t') s++;
    if (!*s) break;
    float v = strtod(s, &fin);
    if (fin == s) break;
    out[n++] = v;
    s = fin;
  }
  return n;
}

bool requiereHome() { return homeHecho ? true : fallo(F("primero haz home (H o S)")); }

int ejeDeTexto(const char *s) {
  while (*s == ' ') s++;
  char c = tolower(*s);
  if (c >= '1' && c <= '4') return c - '1';
  if (c == 'j' && s[1] >= '1' && s[1] <= '3') return s[1] - '1';
  if (c == 'x') return 4;
  if (c == 'y') return 5;
  if (c == 'z') return 6;
  return -1;
}

// Separa la palabra de orden (letras) de los argumentos: "PTB 3" -> "PTB", "3".
bool ejecutar(char *linea) {
  error = nullptr;
  char orden[8];
  uint8_t n = 0;
  while (*linea && !isspace(*linea) && n < sizeof(orden) - 1 && (isalpha(*linea) || *linea == '?')) orden[n++] = toupper(*linea++);
  orden[n] = 0;
  char *args = linea;
  float v[4];
  int nv = leerNumeros(args, v, 4);
  auto es = [&](const char *s) { return !strcmp(orden, s); };

  if (es("?")) { identificar(); listarConfig(); listarPuntos(); enviarEstado(); return true; }
  if (es("H")) {
    while (*args == ' ') args++;
    if (!*args) return homing(-1);
    int e = ejeDeTexto(args);
    if (e == 6) e = EJE_Z;
    if (e < 0 || e > EJE_Z) return fallo(F("usa H, H j1, H j2, H j3 o H z"));
    return homing(e);
  }
  if (es("S")) return homeAMano(nv, v);
  if (es("O")) {
    bool on = nv == 1 && v[0] != 0;
    if (!on) {
      homeHecho = homeManual = false;
      for (int i = 0; i < 4; i++) ejeConocido[i] = false;
      Serial.println(F("L motores sueltos: Z puede bajar por su peso"));
    }
    motores(on);
    leds(false, false, false);
    return true;
  }
  if (es("J")) {
    int e = ejeDeTexto(args);
    while (*args == ' ') args++;
    while (*args && *args != ' ') args++;
    if (e < 0 || leerNumeros(args, v, 1) != 1) return fallo(F("usa J eje paso (eje 1..4, x, y, z)"));
    return jog(e, constrain(v[0], -20, 20));
  }
  if (es("T")) {
    while (*args == ' ') args++;
    char h = tolower(*args);
    int k = h == 'p' ? PLUMON : h == 'i' ? IMAN : h == 's' ? SENSOR : -1;
    if (k < 0) return fallo(F("usa T p, T i o T s"));
    return requiereHome() && seleccionarHerramienta(k);
  }
  if (es("M")) return nv == 2 && requiereHome() && irA(v[0], v[1]);
  if (es("L")) return nv == 2 && requiereHome() && tramoRecto(v[0], v[1]);
  if (es("Z")) return nv == 1 && requiereHome() && moverZ(v[0]);
  if (es("ZT")) return nv == 1 && requiereHome() && moverZ(zPlataforma(v[0], herrActiva) + (herrActiva == PLUMON && !plumaAbajo ? -18 : 0));
  if (es("A")) return nv == 4 && requiereHome() && moverArticular(v[0], v[1], v[2], v[3]);
  if (es("V")) { if (nv != 1 || v[0] <= 0) return fallo(F("usa V mm/s")); cfg.velTrazo = constrain(v[0], 2, 80); return true; }
  if (es("P")) { if (nv != 1) return fallo(F("usa P 1 o P 0")); if (v[0] == 0 || herrActiva == PLUMON) pluma(v[0] != 0); else return fallo(F("el plumon solo baja con T p")); return true; }
  if (es("E")) { if (nv != 1) return fallo(F("usa E 1 o E 0")); iman(v[0] != 0); return true; }
  if (es("PT")) {
    if (nv == 0) { listarPuntos(); return true; }
    int i = (int)v[0] - 1;
    if (i < 0 || i >= MAX_PUNTOS || i > cfg.nPuntos) return fallo(F("numero de punto invalido"));
    if (nv == 4) cfg.pt[i] = { v[1], v[2], v[3] };
    else if (nv == 1) {
      if (!requiereHome()) return false;
      float x, y;
      puntaActual(x, y);
      cfg.pt[i].x = x; cfg.pt[i].y = y;
      if (i == cfg.nPuntos) cfg.pt[i].h = 0;
    } else return fallo(F("usa PT n x y h o PT n"));
    if (i == cfg.nPuntos) cfg.nPuntos++;
    escaneoHecho = false;
    listarPuntos();
    return true;
  }
  if (es("PTB")) {
    int i = nv == 1 ? (int)v[0] - 1 : -1;
    if (i < 0 || i >= cfg.nPuntos) return fallo(F("numero de punto invalido"));
    for (int k = i; k < cfg.nPuntos - 1; k++) cfg.pt[k] = cfg.pt[k + 1];
    cfg.nPuntos--;
    escaneoHecho = false;
    listarPuntos();
    return true;
  }
  if (es("G")) return nv == 1 && requiereHome() && irAPunto((int)v[0] - 1);
  if (es("X")) return requiereHome() && escanear();
  if (es("K")) return requiereHome() && recolectar();
  if (es("D")) return requiereHome() && dibujarRosa();
  if (es("D?")) return comprobarRosa();
  if (es("R")) return mision();
  if (es("CFG")) {
    while (*args == ' ') args++;
    if (!*args) { listarConfig(); return true; }
    char clave[10];
    uint8_t k = 0;
    while (*args && *args != ' ' && k < sizeof(clave) - 1) clave[k++] = *args++;
    clave[k] = 0;
    if (leerNumeros(args, v, 1) != 1) return fallo(F("usa CFG clave valor"));
    return cambiarConfig(clave, v[0]);
  }
  if (es("GUARDAR")) { guardarConfig(); return true; }
  if (es("CARGAR")) { bool ok = cargarConfig(); aplicarInversion(); return ok ? true : fallo(F("EEPROM vacia: valores de fabrica")); }
  if (es("FABRICA")) { configFabrica(); aplicarInversion(); return true; }
  if (es("C")) {
    if (digitalRead(PIN_PARO) == HIGH) return fallo(F("el hongo sigue presionado"));
    enParo = false;
    leds(false, false, false);
    return true;
  }
  return fallo(F("orden desconocida (? para ver todo)"));
}

void responder(bool ok, long id) {
  moviendo = false;
  Serial.print(ok ? F("ok") : F("err"));
  if (id >= 0) { Serial.print(' '); Serial.print(id); }
  if (!ok) { Serial.print(' '); Serial.print(error ? error : F("argumentos")); }
  Serial.println();
  enviarEstado();
}

// ============================================================================
void setup() {
  // Lo primero: energizar los drivers para que sostengan la posición. Mientras el Mega arranca (y se
  // reinicia cada vez que el panel abre el USB) D8 queda flotando, la CNC Shield deshabilita los drivers
  // y la plataforma Z puede bajar por su peso: cuanto antes se vuelvan a energizar, menos baja.
  pinMode(PIN_ENABLE, OUTPUT);
  motores(true);
  Serial.begin(115200);
  bool eeprom = cargarConfig();
  for (int i = 0; i < 4; i++) {
    pinMode(PIN_FINAL[i], INPUT_PULLUP);
    motor[i].setMaxSpeed(VMAX[i]);
    motor[i].setAcceleration(ACEL[i]);
    motor[i].setMinPulseWidth(2);
  }
  aplicarInversion();
  pinMode(PIN_SENSOR, INPUT_PULLUP);
  pinMode(PIN_START, INPUT_PULLUP);
  pinMode(PIN_PARO, INPUT_PULLUP);
  pinMode(PIN_IMAN, OUTPUT);
  iman(false);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARILLO, OUTPUT);
  pinMode(LED_ROJO, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  servoPluma.attach(PIN_SERVO, 500, 2400);
  servoPluma.write(cfg.servoArriba);

  // El Mega se reinicia cada vez que se abre el puerto USB: el panel espera esta línea.
  identificar();
  Serial.println(eeprom ? F("L configuracion de la EEPROM") : F("L EEPROM vacia: valores de fabrica"));
  Serial.println(F("L sin home: H (finales) o S (manual)"));
  pitido(1200, 100);
}

void loop() {
  static char buf[64];
  static uint8_t len = 0;

  if (digitalRead(PIN_PARO) == HIGH) dispararParo(F("hongo"));
  estadoPeriodico();

  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '!') { dispararParo(F("panel")); len = 0; continue; }
    if (ch == '\n' || ch == '\r') {
      buf[len] = 0;
      if (len) {
        char *p = buf;
        long id = -1;
        if (*p == '#') { id = strtol(p + 1, &p, 10); while (*p == ' ') p++; }
        responder(ejecutar(p), id);
      }
      len = 0;
    } else if (len < sizeof(buf) - 1) {
      buf[len++] = ch;
    }
  }

  if (digitalRead(PIN_START) == LOW && !enParo) {
    delay(30);
    while (digitalRead(PIN_START) == LOW) {}
    bool ok = homeHecho || homing(-1);
    responder(ok && mision(), -1);
  }
}
