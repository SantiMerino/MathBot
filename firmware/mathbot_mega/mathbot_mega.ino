/*
  MathBot · firmware principal
  Arduino MEGA 2560 + CNC Shield V3 + 4 x A4988 (1/4 de micropaso: jumper solo en MS2)

  SCARA de HowToMechatronics con el cabezal A · disco tri-herramienta:
    plumón (phi 0°, r 55 mm), electroimán (phi 120°, r 45 mm), sensor inductivo (phi 240°, r 45 mm).
  J3 gira el disco para poner al frente la herramienta activa; un micro-servo SG90 sube/baja el plumón.

  La CNC Shield usa los mismos pines en el Mega que en el UNO (D2–D13, A0–A3), así que los motores y
  finales de carrera quedan igual que en el artículo. Todo lo nuevo va a los pines que el Mega tiene de
  más (header doble D22–D53 y A8–A15), sin tocar la shield.

  Comandos por Serial (115200 baudios, terminar con Enter):
    H              homing (Z, J3, J2, J1 como en HTM)
    S              saltar homing: toma la pose actual como home (banco de pruebas / Wokwi)
    ?              estado
    T p|i|s        herramienta activa: plumón, imán o sensor (gira J3)
    M x y          lleva la herramienta activa a (x, y) mm, movimiento articular
    L x y          línea recta a (x, y) mm a la velocidad de trazo
    Z z            altura de la plataforma (mm)
    A t1 t2 phi z  ángulos directos (grados, grados, grados, mm)
    V v            velocidad de trazo (mm/s)
    P 1|0          plumón abajo / arriba
    E 1|0          electroimán encendido / apagado
    D              dibujar la rosa de 3 pétalos
    X              escanear las piezas con el sensor
    R              misión completa: escaneo -> recolección -> rosa (también el botón START)
    O              desenergizar motores
    C              limpiar el paro de emergencia (obliga a repetir el homing)
    !              paro inmediato (también funciona en pleno movimiento)

  Bibliotecas: AccelStepper (Mike McCauley) y Servo (incluida en el IDE).
*/
#include <AccelStepper.h>
#include <Servo.h>
#include <math.h>

// ============================================================================
// Configuración
// ============================================================================
const bool SIMULACION = false;  // true en Wokwi: los finales de carrera son pulsadores NA

// ---- Pines de la CNC Shield V3 (idénticos en UNO y Mega) ----
const uint8_t PIN_ENABLE = 8;
const uint8_t J1_STEP = 2, J1_DIR = 5;   // ranura X
const uint8_t J2_STEP = 3, J2_DIR = 6;   // ranura Y
const uint8_t J3_STEP = 4, J3_DIR = 7;   // ranura Z  (como en HTM, J3 va en la ranura Z)
const uint8_t Z_STEP = 12, Z_DIR = 13;   // ranura A  (jumpers del eje A en D12/D13)
const uint8_t SW_J1 = 11;  // header Z+/Z-  (limitSwitch1 de HTM)
const uint8_t SW_J2 = 10;  // header Y+/Y-
const uint8_t SW_J3 = 9;   // header X+/X-
const uint8_t SW_Z = A3;   // header CoolEn

// ---- Pines extra del Mega ----
const uint8_t PIN_SENSOR = 22;    // salida del PC817 (LOW = metal)
const uint8_t PIN_IMAN = 24;      // gate del módulo MOSFET D4184
const uint8_t PIN_START = 26;     // pulsador NA a GND
const uint8_t PIN_PARO = 28;      // hongo NC a GND (abierto = paro)
const uint8_t LED_VERDE = 30;     // listo
const uint8_t LED_AMARILLO = 32;  // en movimiento
const uint8_t LED_ROJO = 34;      // paro / error
const uint8_t PIN_BUZZER = 36;
const uint8_t PIN_SERVO = 44;     // SG90 del levante del plumón
const uint8_t PIN_12V = A8;       // divisor 10k / 3.3k desde los 12 V
// Reservados: Serial1 (D18/D19) Bluetooth HC-05 o servos STS3215; I2C (D20/D21) AS5600 o LCD;
// Serial2 (D16/D17), Serial3 (D14/D15), D23–D53 impares y A9–A15 libres.

// ---- Geometría (python/scara_modelo.py) ----
const float L1 = 228.0, L2 = 144.0;
const float CAIDA_BRIDA = 78.5;  // base de la plataforma Z -> brida del cabezal
const float ESPESOR_DISCO = 6.0;
const int CODO = -1;             // theta2 negativo

struct Herramienta {
  const char *nombre;
  float phiDeg;   // posición en el disco
  float radio;    // distancia al eje J3 (mm)
  float bajo;     // cuánto sobresale bajo el disco (mm)
};
enum { PLUMON = 0, IMAN = 1, SENSOR = 2 };
const Herramienta HERR[3] = {
  { "plumon", 0.0, 55.0, 50.0 },
  { "electroiman", 120.0, 45.0, 40.0 },
  { "sensor", 240.0, 45.0, 38.0 },
};

// ---- Accionamiento: NEMA 17, 200 pasos x 1/4 ----
enum { EJE_J1 = 0, EJE_J2 = 1, EJE_J3 = 2, EJE_Z = 3 };
const char *NOMBRE_EJE[4] = { "J1", "J2", "J3", "Z" };
const float PASOS_UNIDAD[4] = { 44.4444, 35.5556, 10.0, 100.0 };  // pasos/grado, pasos/mm en Z
const float VMAX[4] = { 3000, 3000, 1500, 3500 };                  // pasos/s
const float ACEL[4] = { 2000, 2000, 1500, 3000 };                  // pasos/s²
const bool INVERTIR_DIR[4] = { false, false, false, false };       // si un eje gira al revés
const float LIM_MIN[4] = { -150, -150, -170, 103.5 };
const float LIM_MAX[4] = { 150, 150, 170, 203.0 };                 // Z: varillas de 250 mm

// ---- Homing: dónde queda cada final de carrera (valores del sketch de HTM, CALIBRAR) ----
const float HOME_POS[4] = { -89.0, -152.4, -166.2, 203.0 };
const int HOME_SENTIDO[4] = { -1, -1, -1, +1 };       // J1–J3 hacia negativo, Z hacia arriba
const float HOME_VEL[4] = { 1200, 1300, 1100, 1500 };  // pasos/s
const float HOME_RECORRIDO_MAX[4] = { 320, 320, 360, 120 };  // si no toca el final -> error

// ---- Plumón ----
const int SERVO_ABAJO = 20;    // grados; calibrar con prueba_servo
const int SERVO_ARRIBA = 110;  // levanta 18 mm

// ---- Escena de la misión (mismas coordenadas que el simulador) ----
struct Pieza { const char *nombre; float x, y, h; };
const Pieza PIEZAS[4] = {
  { "pieza 1", 60, -215, 3 },
  { "pieza 2", 150, -238, 8 },
  { "pieza 3", 240, -215, 7 },
  { "pieza 4", 325, -172, 12 },
};
const float BANDEJA_X = 95, BANDEJA_Y = 235, BANDEJA_H = 25;
const float Z_TIP_VIAJE = 60;  // altura de la punta en tránsito (mm sobre la mesa)

// ---- Rosa de 3 pétalos ----
const float ROSA_A = 102.9, ROSA_K = 1.3552;
const float ROSA_T0 = 5 * M_PI / 6, ROSA_T1 = 11 * M_PI / 6;
const float ROSA_CX = 185.0, ROSA_CY = 0.0, ROSA_ALFA = M_PI;  // centrada a 185 mm, girada 180°
const float SEG_MM = 1.0;  // largo de cada tramo recto del trazo

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

bool homeHecho = false;
bool enParo = false;
int herrActiva = PLUMON;
float xAct = NAN, yAct = NAN;  // punta de la herramienta activa
float velTrazo = 25.0;         // mm/s
bool piezaMetal[4] = { false, false, false, false };
bool escaneoHecho = false;

// ============================================================================
// Utilidades
// ============================================================================
float envolver(float a) {
  while (a > 180) a -= 360;
  while (a <= -180) a += 360;
  return a;
}

long aPasos(int eje, float v) { return lround(v * PASOS_UNIDAD[eje]); }
float aUnidad(int eje, long p) { return p / PASOS_UNIDAD[eje]; }
float posicion(int eje) { return aUnidad(eje, motor[eje].currentPosition()); }

bool finalActivo(uint8_t pin) {
  // Real: final NC entre pin y GND (como HTM), activo = abierto = HIGH. Wokwi: pulsador NA, activo = LOW.
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

float voltaje12() {
  return analogRead(PIN_12V) * (5.0 / 1023.0) * (13.3 / 3.3);
}

void leds(bool verde, bool amarillo, bool rojo) {
  digitalWrite(LED_VERDE, verde);
  digitalWrite(LED_AMARILLO, amarillo);
  digitalWrite(LED_ROJO, rojo);
}

void pitido(int f, int ms) { tone(PIN_BUZZER, f, ms); }

void motores(bool on) { digitalWrite(PIN_ENABLE, on ? LOW : HIGH); }

void pluma(bool abajo) {
  servoPluma.write(abajo ? SERVO_ABAJO : SERVO_ARRIBA);
  delay(300);
}

void iman(bool on) { digitalWrite(PIN_IMAN, on ? HIGH : LOW); }

// Altura de la plataforma para que la punta de la herramienta k quede a ztip sobre la mesa.
// El plumón se calcula bajado; con el plumón arriba su punta queda 18 mm más alta.
float zPlataforma(float ztip, int k) {
  return ztip + CAIDA_BRIDA + ESPESOR_DISCO + HERR[k].bajo;
}

// ============================================================================
// Paro de emergencia
// ============================================================================
void dispararParo(const char *motivo) {
  if (enParo) return;
  enParo = true;
  homeHecho = false;
  for (int i = 0; i < 4; i++) motor[i].setCurrentPosition(motor[i].currentPosition());
  motores(false);
  iman(false);
  leds(false, false, true);
  pitido(2000, 600);
  Serial.print(F("!! PARO: "));
  Serial.println(motivo);
  Serial.println(F("   Suelta el hongo y envia C; luego repite H."));
}

// Se llama dentro de todos los bucles de movimiento.
bool sigue() {
  if (digitalRead(PIN_PARO) == HIGH) dispararParo("boton de paro");
  if (Serial.available() && Serial.peek() == '!') {
    Serial.read();
    dispararParo("comando !");
  }
  return !enParo;
}

// ============================================================================
// Cinemática
// ============================================================================
bool dentroLimites(const float q[4]) {
  for (int i = 0; i < 4; i++)
    if (q[i] < LIM_MIN[i] || q[i] > LIM_MAX[i]) return false;
  return true;
}

// IK de la punta de la herramienta k con el disco girado para tenerla al frente (phi = -phi_k):
// la herramienta queda en la línea de Arm 2, así que Arm 2 "mide" L2 + r.
bool ik(float x, float y, int k, float &th1, float &th2) {
  float le = L2 + HERR[k].radio;
  float c2 = (x * x + y * y - L1 * L1 - le * le) / (2 * L1 * le);
  if (c2 < -1 || c2 > 1) return false;
  for (int intento = 0; intento < 2; intento++) {
    int codo = intento == 0 ? CODO : -CODO;
    float t2 = codo * acos(c2);
    float t1 = atan2(y, x) - atan2(le * sin(t2), L1 + le * cos(t2));
    th1 = envolver(degrees(t1));
    th2 = envolver(degrees(t2));
    if (th1 >= LIM_MIN[0] && th1 <= LIM_MAX[0] && th2 >= LIM_MIN[1] && th2 <= LIM_MAX[1]) return true;
  }
  return false;
}

float phiHerramienta(int k) { return envolver(-HERR[k].phiDeg); }

// ============================================================================
// Movimiento
// ============================================================================
void limpiarVelocidades() {
  for (int i = 0; i < 4; i++) motor[i].setCurrentPosition(motor[i].currentPosition());
}

// Movimiento articular con perfiles trapezoidales escalados para que los 4 ejes terminen a la vez.
bool moverArticular(float th1, float th2, float phi, float z) {
  float q[4] = { th1, th2, phi, z };
  if (!dentroLimites(q)) {
    Serial.println(F("   fuera de los limites articulares"));
    return false;
  }
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
  leds(false, true, false);
  uint16_t n = 0;
  bool corriendo = true;
  while (corriendo) {
    corriendo = false;
    for (int i = 0; i < 4; i++) corriendo |= motor[i].run();
    if ((++n & 63) == 0 && !sigue()) return false;
  }
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
  if (!ik(x, y, herrActiva, t1, t2)) {
    Serial.print(F("   fuera de alcance: "));
    Serial.print(x); Serial.print(F(", ")); Serial.println(y);
    return false;
  }
  if (!moverArticular(t1, t2, phiHerramienta(herrActiva), posicion(EJE_Z))) return false;
  xAct = x; yAct = y;
  return true;
}

// Interpolación cartesiana: un tramo de IK cada SEG_MM.
bool tramoRecto(float x, float y) {
  if (isnan(xAct)) return irA(x, y);
  float dx = x - xAct, dy = y - yAct, largo = hypot(dx, dy);
  int n = max(1, (int)ceil(largo / SEG_MM));
  float x0 = xAct, y0 = yAct;
  for (int i = 1; i <= n; i++) {
    if (!puntoTrazo(x0 + dx * i / n, y0 + dy * i / n)) return false;
  }
  limpiarVelocidades();
  return true;
}

// Un punto del trazo, desde la punta actual, a velTrazo.
bool puntoTrazo(float x, float y) {
  float t1, t2;
  if (!ik(x, y, herrActiva, t1, t2)) {
    Serial.print(F("   punto fuera de alcance: "));
    Serial.print(x); Serial.print(F(", ")); Serial.println(y);
    return false;
  }
  long obj[4] = { aPasos(EJE_J1, t1), aPasos(EJE_J2, t2), motor[EJE_J3].currentPosition(), motor[EJE_Z].currentPosition() };
  float T = max(hypot(x - xAct, y - yAct) / velTrazo, 0.002f);
  if (!tramo(obj, T)) return false;
  xAct = x; yAct = y;
  return true;
}

bool seleccionarHerramienta(int k) {
  if (k != PLUMON) pluma(false);
  herrActiva = k;
  if (!moverArticular(posicion(EJE_J1), posicion(EJE_J2), phiHerramienta(k), posicion(EJE_Z))) return false;
  xAct = yAct = NAN;  // la punta cambió; el siguiente movimiento parte por IK
  Serial.print(F("   herramienta activa: "));
  Serial.println(HERR[k].nombre);
  return true;
}

// ============================================================================
// Homing
// ============================================================================
bool homeEje(int e) {
  Serial.print(F("   homing "));
  Serial.println(NOMBRE_EJE[e]);
  motor[e].setCurrentPosition(0);
  motor[e].setMaxSpeed(HOME_VEL[e]);
  motor[e].setSpeed(HOME_SENTIDO[e] * HOME_VEL[e]);
  long limite = aPasos(e, HOME_RECORRIDO_MAX[e]);
  uint16_t n = 0;
  while (!finalActivo(PIN_FINAL[e])) {
    motor[e].runSpeed();
    if ((++n & 63) == 0 && !sigue()) return false;
    if (labs(motor[e].currentPosition()) > limite) {
      Serial.print(F("   ERROR: el final de "));
      Serial.print(NOMBRE_EJE[e]);
      Serial.println(F(" no se activo. Revisa cableado, 12 V y sentido del motor."));
      leds(false, false, true);
      pitido(400, 800);
      return false;
    }
  }
  motor[e].setCurrentPosition(aPasos(e, HOME_POS[e]));
  return true;
}

bool homing() {
  if (enParo) { Serial.println(F("   primero limpia el paro (C)")); return false; }
  if (voltaje12() < 10.5) Serial.println(F("   AVISO: no detecto los 12 V; los motores no van a moverse."));
  motores(true);
  pluma(false);
  iman(false);
  leds(false, true, false);
  const int orden[4] = { EJE_Z, EJE_J3, EJE_J2, EJE_J1 };
  for (int i = 0; i < 4; i++) {
    if (!homeEje(orden[i])) return false;
    if (orden[i] == EJE_Z) {
      // Z arriba primero para que el brazo no barra nada al buscar los otros finales
      if (!moverArticular(posicion(0), posicion(1), posicion(2), zPlataforma(Z_TIP_VIAJE, IMAN))) return false;
    }
  }
  homeHecho = true;
  herrActiva = PLUMON;
  if (!moverArticular(0, 0, 0, zPlataforma(Z_TIP_VIAJE, IMAN))) return false;
  xAct = yAct = NAN;
  leds(true, false, false);
  pitido(1500, 120);
  Serial.println(F("   homing listo"));
  return true;
}

void saltarHoming() {
  float q[4] = { 0, 0, 0, zPlataforma(Z_TIP_VIAJE, IMAN) };
  for (int i = 0; i < 4; i++) motor[i].setCurrentPosition(aPasos(i, q[i]));
  motores(true);
  homeHecho = true;
  herrActiva = PLUMON;
  xAct = yAct = NAN;
  leds(true, false, false);
  Serial.println(F("   pose actual tomada como home (th1 = th2 = phi = 0)"));
}

// ============================================================================
// Rutinas
// ============================================================================
void rosaPunto(float t, float &x, float &y) {
  float r = cos(3 * t);
  float xl = -ROSA_A * r * cos(t);
  float yl = -ROSA_A * ROSA_K * r * sin(t);
  x = ROSA_CX + cos(ROSA_ALFA) * xl - sin(ROSA_ALFA) * yl;
  y = ROSA_CY + sin(ROSA_ALFA) * xl + cos(ROSA_ALFA) * yl;
}

bool dibujarRosa() {
  Serial.println(F("== Rosa de 3 petalos con plumon =="));
  float x, y;
  rosaPunto(ROSA_T0, x, y);
  if (!seleccionarHerramienta(PLUMON)) return false;
  if (!irA(x, y)) return false;
  pluma(true);
  if (!moverZ(zPlataforma(8, PLUMON))) return false;
  if (!moverZ(zPlataforma(0, PLUMON))) return false;

  const int N = 4000;
  float total = 0;
  unsigned long t0 = millis();
  for (int i = 1; i <= N; i++) {
    float px, py;
    rosaPunto(ROSA_T0 + (ROSA_T1 - ROSA_T0) * i / N, px, py);
    float d = hypot(px - xAct, py - yAct);
    if (d >= SEG_MM || i == N) {
      if (!puntoTrazo(px, py)) return false;
      total += d;
    }
  }
  limpiarVelocidades();
  if (!moverZ(zPlataforma(10, PLUMON))) return false;
  pluma(false);
  if (!moverZ(zPlataforma(Z_TIP_VIAJE, IMAN))) return false;
  Serial.print(F("   rosa terminada: "));
  Serial.print(total, 0);
  Serial.print(F(" mm en "));
  Serial.print((millis() - t0) / 1000.0, 1);
  Serial.println(F(" s"));
  return true;
}

bool escanear() {
  Serial.println(F("== Fase 1: escaneo con sensor inductivo =="));
  if (!seleccionarHerramienta(SENSOR)) return false;
  for (int i = 0; i < 4; i++) {
    if (!moverZ(zPlataforma(Z_TIP_VIAJE, IMAN))) return false;
    if (!irA(PIEZAS[i].x, PIEZAS[i].y)) return false;
    if (!moverZ(zPlataforma(PIEZAS[i].h + 3, SENSOR))) return false;  // 3 mm sobre la pieza
    delay(300);
    piezaMetal[i] = hayMetal();
    Serial.print(F("   "));
    Serial.print(PIEZAS[i].nombre);
    Serial.println(piezaMetal[i] ? F(": METALICA") : F(": no metalica"));
    if (piezaMetal[i]) pitido(1800, 80);
  }
  escaneoHecho = true;
  return moverZ(zPlataforma(Z_TIP_VIAJE, IMAN));
}

bool recolectar() {
  Serial.println(F("== Fase 2: recoleccion con electroiman =="));
  if (!escaneoHecho) { Serial.println(F("   primero escanea (X)")); return false; }
  if (!seleccionarHerramienta(IMAN)) return false;
  int lugar = 0;
  for (int i = 0; i < 4; i++) {
    if (!piezaMetal[i]) continue;
    if (!irA(PIEZAS[i].x, PIEZAS[i].y)) return false;
    if (!moverZ(zPlataforma(PIEZAS[i].h + 0.5, IMAN))) return false;
    iman(true);
    delay(500);
    Serial.print(F("   iman ON -> levanta "));
    Serial.println(PIEZAS[i].nombre);
    if (!moverZ(zPlataforma(Z_TIP_VIAJE, IMAN))) return false;
    float bx = BANDEJA_X + (lugar % 2 ? 14 : -14);
    float by = BANDEJA_Y + (lugar < 2 ? -10 : 10);
    lugar++;
    if (!irA(bx, by)) return false;
    if (!moverZ(zPlataforma(BANDEJA_H + PIEZAS[i].h + 6, IMAN))) return false;
    iman(false);
    delay(400);
    Serial.println(F("   iman OFF -> pieza en la bandeja"));
    if (!moverZ(zPlataforma(Z_TIP_VIAJE, IMAN))) return false;
  }
  return true;
}

bool mision() {
  if (!homeHecho) { Serial.println(F("   primero haz homing (H) o S")); return false; }
  unsigned long t0 = millis();
  if (!escanear() || !recolectar() || !dibujarRosa()) return false;
  Serial.println(F("== Regreso a home =="));
  if (!seleccionarHerramienta(PLUMON)) return false;
  if (!moverArticular(0, 0, 0, zPlataforma(Z_TIP_VIAJE, IMAN))) return false;
  Serial.print(F("== Mision completa en "));
  Serial.print((millis() - t0) / 1000.0, 1);
  Serial.println(F(" s =="));
  pitido(1500, 100); delay(150); pitido(2000, 150);
  return true;
}

void estado() {
  Serial.println(F("---- estado ----"));
  Serial.print(F("home: ")); Serial.print(homeHecho ? F("si") : F("no"));
  Serial.print(F("   paro: ")); Serial.println(enParo ? F("SI") : F("no"));
  for (int i = 0; i < 4; i++) {
    Serial.print(NOMBRE_EJE[i]); Serial.print(F(" = ")); Serial.print(posicion(i), 2);
    Serial.print(i == EJE_Z ? F(" mm") : F(" deg"));
    Serial.print(F("   final: ")); Serial.println(finalActivo(PIN_FINAL[i]) ? F("ACTIVO") : F("libre"));
  }
  Serial.print(F("herramienta: ")); Serial.print(HERR[herrActiva].nombre);
  Serial.print(F("   punta: ")); Serial.print(xAct, 1); Serial.print(F(", ")); Serial.println(yAct, 1);
  Serial.print(F("sensor: ")); Serial.print(digitalRead(PIN_SENSOR) == LOW ? F("METAL") : F("nada"));
  Serial.print(F("   iman: ")); Serial.print(digitalRead(PIN_IMAN) ? F("ON") : F("off"));
  Serial.print(F("   12 V: ")); Serial.print(voltaje12(), 1); Serial.println(F(" V"));
  Serial.print(F("velocidad de trazo: ")); Serial.print(velTrazo, 0); Serial.println(F(" mm/s"));
}

void ayuda() {
  Serial.println(F("Comandos: H S ? | T p/i/s | M x y | L x y | Z z | A t1 t2 phi z | V v"));
  Serial.println(F("          P 1/0 | E 1/0 | D rosa | X escaneo | R mision | O motores off | C limpiar paro | ! paro"));
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

bool requiereHome() {
  if (!homeHecho) Serial.println(F("   primero haz homing (H) o S"));
  return homeHecho;
}

void ejecutar(char *linea) {
  while (*linea == ' ') linea++;
  if (!*linea) return;
  char c = toupper(linea[0]);
  char *args = linea + 1;
  float v[4];
  int n = leerNumeros(args, v, 4);

  switch (c) {
    case 'H': homing(); break;
    case 'S': saltarHoming(); break;
    case '?': estado(); break;
    case 'T': {
      while (*args == ' ') args++;
      char h = tolower(*args);
      int k = h == 'p' ? PLUMON : h == 'i' ? IMAN : h == 's' ? SENSOR : -1;
      if (k < 0) Serial.println(F("   usa T p, T i o T s"));
      else if (requiereHome()) seleccionarHerramienta(k);
      break;
    }
    case 'M': if (n == 2 && requiereHome()) irA(v[0], v[1]); break;
    case 'L': if (n == 2 && requiereHome()) tramoRecto(v[0], v[1]); break;
    case 'Z': if (n == 1 && requiereHome()) moverZ(v[0]); break;
    case 'A':
      if (n == 4 && requiereHome() && moverArticular(v[0], v[1], v[2], v[3])) xAct = yAct = NAN;
      break;
    case 'V': if (n == 1 && v[0] > 0) velTrazo = constrain(v[0], 2, 80); break;
    case 'P': if (n == 1) pluma(v[0] != 0); break;
    case 'E': if (n == 1) iman(v[0] != 0); break;
    case 'D': if (requiereHome()) dibujarRosa(); break;
    case 'X': if (requiereHome()) escanear(); break;
    case 'R': mision(); break;
    case 'O': motores(false); homeHecho = false; leds(false, false, false); Serial.println(F("   motores libres (repite H)")); break;
    case 'C':
      if (digitalRead(PIN_PARO) == HIGH) { Serial.println(F("   el hongo sigue presionado")); break; }
      enParo = false;
      leds(false, false, false);
      Serial.println(F("   paro limpiado; haz homing (H)"));
      break;
    default: ayuda();
  }
  if (!enParo) Serial.println(F("ok"));
}

// ============================================================================
void setup() {
  Serial.begin(115200);
  Serial.setTimeout(50);

  pinMode(PIN_ENABLE, OUTPUT);
  motores(false);
  for (int i = 0; i < 4; i++) {
    pinMode(PIN_FINAL[i], INPUT_PULLUP);
    motor[i].setPinsInverted(INVERTIR_DIR[i], false, false);
    motor[i].setMaxSpeed(VMAX[i]);
    motor[i].setAcceleration(ACEL[i]);
    motor[i].setMinPulseWidth(2);
  }
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
  servoPluma.write(SERVO_ARRIBA);

  Serial.println(F("MathBot SCARA · Mega 2560 · cabezal de disco"));
  Serial.print(F("12 V: ")); Serial.print(voltaje12(), 1); Serial.println(F(" V"));
  ayuda();
  pitido(1200, 100);
}

void loop() {
  static char buf[48];
  static uint8_t len = 0;

  if (digitalRead(PIN_PARO) == HIGH) dispararParo("boton de paro");

  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '!') { dispararParo("comando !"); len = 0; continue; }
    if (ch == '\n' || ch == '\r') {
      buf[len] = 0;
      if (len) ejecutar(buf);
      len = 0;
    } else if (len < sizeof(buf) - 1) {
      buf[len++] = ch;
    }
  }

  if (digitalRead(PIN_START) == LOW && !enParo) {
    delay(30);
    while (digitalRead(PIN_START) == LOW) {}
    if (!homeHecho) homing();
    if (homeHecho) mision();
  }
}
