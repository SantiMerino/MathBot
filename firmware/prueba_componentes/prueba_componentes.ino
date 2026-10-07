/*
  MathBot · prueba de componentes (uno por uno)
  Arduino MEGA 2560 + CNC Shield V3. Mismo mapa de pines que mathbot_mega.ino.

  Sirve para el requisito "control individual y verificable de cada servomotor y del sensor":
  cada motor, final de carrera, el sensor inductivo, el electroimán, los botones, los LED,
  el buzzer y la fuente de 12 V se prueban por separado desde el Monitor Serie (115200, con Enter).

  Menú:
    1..4        elegir motor: 1 J1, 2 J2, 3 J3, 4 Z
    + / -       mover el motor elegido N pasos (por defecto una vuelta del motor: 800 pasos)
    n 1600      cambiar N
    g 45        girar el eje elegido 45 unidades físicas (grados en J1–J3, mm en Z)
    v 1500      velocidad en pasos/s
    o           energizar / desenergizar los drivers
    f           finales de carrera en vivo (cualquier tecla para salir)
    s           sensor inductivo en vivo
    e           alternar el electroimán
    b           botones START y PARO en vivo
    l           LED y buzzer
    p           medir los 12 V
    t           prueba automática: cada motor ida y vuelta, imán, LED y buzzer

  No hace homing: antes de mover un eje acerca el brazo a una posición central con la mano
  y usa pocos pasos. Con el plumón puesto, súbelo primero con prueba_servo.
*/
#include <AccelStepper.h>

const bool SIMULACION = false;  // true en Wokwi (finales como pulsadores NA)

const uint8_t PIN_ENABLE = 8;
const uint8_t PIN_STEP[4] = { 2, 3, 4, 12 };
const uint8_t PIN_DIR[4] = { 5, 6, 7, 13 };
const uint8_t PIN_FINAL[4] = { 11, 10, 9, A3 };
const char *NOMBRE[4] = { "J1 (ranura X)", "J2 (ranura Y)", "J3 (ranura Z)", "Z (ranura A)" };
const float PASOS_UNIDAD[4] = { 44.4444, 35.5556, 10.0, 100.0 };

const uint8_t PIN_SENSOR = 22, PIN_IMAN = 24, PIN_START = 26, PIN_PARO = 28;
const uint8_t LED_VERDE = 30, LED_AMARILLO = 32, LED_ROJO = 34, PIN_BUZZER = 36;
const uint8_t PIN_12V = A8;

AccelStepper motor[4] = {
  AccelStepper(AccelStepper::DRIVER, 2, 5),
  AccelStepper(AccelStepper::DRIVER, 3, 6),
  AccelStepper(AccelStepper::DRIVER, 4, 7),
  AccelStepper(AccelStepper::DRIVER, 12, 13),
};

int eje = 0;
long pasosN = 800;
float vel = 1200;
bool energizado = false;

bool finalActivo(uint8_t pin) { return digitalRead(pin) == (SIMULACION ? LOW : HIGH); }
float voltaje12() { return analogRead(PIN_12V) * (5.0 / 1023.0) * (13.3 / 3.3); }

void energizar(bool on) {
  energizado = on;
  digitalWrite(PIN_ENABLE, on ? LOW : HIGH);
  Serial.println(on ? F("   drivers energizados") : F("   drivers libres"));
}

void vaciarEntrada() {
  delay(20);
  while (Serial.available()) Serial.read();
}

bool teclaPulsada() { return Serial.available() > 0; }

// Mueve el eje elegido; para si el hongo de paro se abre o si toca su final de carrera.
void mover(long pasos) {
  if (!energizado) energizar(true);
  AccelStepper &m = motor[eje];
  m.setMaxSpeed(vel);
  m.setAcceleration(vel);
  m.move(pasos);
  Serial.print(F("   "));
  Serial.print(NOMBRE[eje]);
  Serial.print(F(": "));
  Serial.print(pasos);
  Serial.println(F(" pasos"));
  unsigned long t0 = millis();
  while (m.distanceToGo() != 0) {
    m.run();
    if (digitalRead(PIN_PARO) == HIGH) { m.stop(); m.setCurrentPosition(m.currentPosition()); Serial.println(F("   PARO")); return; }
    if (finalActivo(PIN_FINAL[eje]) && millis() - t0 > 200) {
      m.setCurrentPosition(m.currentPosition());
      Serial.println(F("   se activo el final de carrera: detenido"));
      return;
    }
  }
  Serial.print(F("   posicion: "));
  Serial.print(m.currentPosition());
  Serial.print(F(" pasos = "));
  Serial.print(m.currentPosition() / PASOS_UNIDAD[eje], 2);
  Serial.println(eje == 3 ? F(" mm") : F(" grados"));
}

void verFinales() {
  Serial.println(F("   finales en vivo (presiona cada uno; Enter para salir)"));
  vaciarEntrada();
  int previo = -1;
  while (!teclaPulsada()) {
    int estado = 0;
    for (int i = 0; i < 4; i++) estado |= finalActivo(PIN_FINAL[i]) << i;
    if (estado != previo) {
      for (int i = 0; i < 4; i++) {
        Serial.print(F("   SW")); Serial.print(i + 1); Serial.print(F(" ("));
        Serial.print(i == 3 ? F("Z") : i == 0 ? F("J1") : i == 1 ? F("J2") : F("J3"));
        Serial.print(F("): ")); Serial.print(estado >> i & 1 ? F("ACTIVO") : F("libre "));
      }
      Serial.println();
      if (estado) tone(PIN_BUZZER, 1500, 40);
      previo = estado;
    }
  }
  vaciarEntrada();
}

void verSensor() {
  Serial.println(F("   sensor en vivo: acerca/aleja una pieza metalica (Enter para salir)"));
  Serial.println(F("   el LED del propio sensor tambien debe encender a menos de ~4 mm"));
  vaciarEntrada();
  int previo = -1;
  unsigned long cambios = 0;
  while (!teclaPulsada()) {
    int metal = digitalRead(PIN_SENSOR) == LOW;
    if (metal != previo) {
      Serial.print(F("   ")); Serial.print(metal ? F("METAL") : F("nada"));
      Serial.print(F("   (cambio #")); Serial.print(++cambios); Serial.println(F(")"));
      digitalWrite(LED_VERDE, metal);
      if (metal) tone(PIN_BUZZER, 1800, 60);
      previo = metal;
    }
  }
  digitalWrite(LED_VERDE, LOW);
  vaciarEntrada();
}

void verBotones() {
  Serial.println(F("   botones en vivo (Enter para salir)"));
  vaciarEntrada();
  int previo = -1;
  while (!teclaPulsada()) {
    int st = (digitalRead(PIN_START) == LOW) | (digitalRead(PIN_PARO) == HIGH) << 1;
    if (st != previo) {
      Serial.print(F("   START: ")); Serial.print(st & 1 ? F("presionado") : F("suelto    "));
      Serial.print(F("   PARO: ")); Serial.println(st & 2 ? F("ACTIVO (circuito abierto)") : F("normal"));
      digitalWrite(LED_ROJO, st & 2 ? HIGH : LOW);
      digitalWrite(LED_AMARILLO, st & 1);
      previo = st;
    }
  }
  digitalWrite(LED_ROJO, LOW);
  digitalWrite(LED_AMARILLO, LOW);
  vaciarEntrada();
}

void probarLeds() {
  const uint8_t L[3] = { LED_VERDE, LED_AMARILLO, LED_ROJO };
  const char *N[3] = { "verde", "amarillo", "rojo" };
  for (int i = 0; i < 3; i++) {
    Serial.print(F("   LED ")); Serial.println(N[i]);
    digitalWrite(L[i], HIGH); delay(500); digitalWrite(L[i], LOW);
  }
  Serial.println(F("   buzzer 1 kHz -> 2 kHz"));
  tone(PIN_BUZZER, 1000, 200); delay(250); tone(PIN_BUZZER, 2000, 200); delay(250);
}

void probarIman() {
  bool on = !digitalRead(PIN_IMAN);
  digitalWrite(PIN_IMAN, on);
  Serial.println(on ? F("   electroiman ON (prueba con una arandela; no lo dejes encendido mucho tiempo)")
                    : F("   electroiman OFF"));
}

void medir12V() {
  float v = voltaje12();
  Serial.print(F("   12 V medidos: ")); Serial.print(v, 2); Serial.println(F(" V"));
  if (v < 10.5) Serial.println(F("   -> fuente apagada o divisor mal conectado; los motores no se moveran"));
}

void pruebaAutomatica() {
  Serial.println(F("== Prueba automatica =="));
  medir12V();
  const long ida[4] = { 400, 400, 400, 800 };  // ~9°, ~11°, 40° (J3), 8 mm (Z)
  for (int i = 0; i < 4; i++) {
    eje = i;
    mover(ida[i]); delay(300);
    mover(-ida[i]); delay(300);
    if (digitalRead(PIN_PARO) == HIGH) return;
  }
  probarIman(); delay(1000); probarIman();
  probarLeds();
  Serial.println(F("   cada motor debio ir y volver al mismo punto; marca con cinta para comprobarlo"));
}

void menu() {
  Serial.println(F("---- MathBot · prueba de componentes ----"));
  Serial.print(F("motor elegido: ")); Serial.print(NOMBRE[eje]);
  Serial.print(F("   N = ")); Serial.print(pasosN);
  Serial.print(F("   v = ")); Serial.print(vel, 0); Serial.println(F(" pasos/s"));
  Serial.println(F("1-4 motor | + - mover | n N | g unidades | v vel | o drivers"));
  Serial.println(F("f finales | s sensor | e iman | b botones | l LED/buzzer | p 12V | t automatica"));
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(100);
  pinMode(PIN_ENABLE, OUTPUT);
  digitalWrite(PIN_ENABLE, HIGH);
  for (int i = 0; i < 4; i++) pinMode(PIN_FINAL[i], INPUT_PULLUP);
  pinMode(PIN_SENSOR, INPUT_PULLUP);
  pinMode(PIN_START, INPUT_PULLUP);
  pinMode(PIN_PARO, INPUT_PULLUP);
  pinMode(PIN_IMAN, OUTPUT);
  digitalWrite(PIN_IMAN, LOW);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARILLO, OUTPUT);
  pinMode(LED_ROJO, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  menu();
}

void loop() {
  if (!Serial.available()) return;
  String linea = Serial.readStringUntil('\n');
  linea.trim();
  if (!linea.length()) return;
  char c = linea[0];
  float num = linea.substring(1).toFloat();

  switch (c) {
    case '1': case '2': case '3': case '4':
      eje = c - '1';
      Serial.print(F("   motor: ")); Serial.println(NOMBRE[eje]);
      break;
    case '+': mover(pasosN); break;
    case '-': mover(-pasosN); break;
    case 'n': if (num > 0) pasosN = (long)num; Serial.print(F("   N = ")); Serial.println(pasosN); break;
    case 'g': mover(lround(num * PASOS_UNIDAD[eje])); break;
    case 'v': if (num > 0) vel = num; Serial.print(F("   v = ")); Serial.println(vel, 0); break;
    case 'o': energizar(!energizado); break;
    case 'f': verFinales(); break;
    case 's': verSensor(); break;
    case 'e': probarIman(); break;
    case 'b': verBotones(); break;
    case 'l': probarLeds(); break;
    case 'p': medir12V(); break;
    case 't': pruebaAutomatica(); break;
    default: menu();
  }
}
