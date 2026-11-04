/*
  MathBot · etapa 3: prueba del cabezal A v3 (disco tri-herramienta) en el banco
  Arduino MEGA 2560 + CNC Shield V3. Solo usa J3 (ranura Z), su final de carrera, el servo del plumón,
  el electroimán y el sensor. Mismo mapa de pines que mathbot_mega.ino.

  Montaje para la prueba: el brazo 2 con J3, el J3 Coupler, el connector, el separador y la placa con las
  tres herramientas, sujeto a un soporte (como en anatomia/cabezal) con la punta del plumón al aire o
  sobre una hoja. Los 12 V alimentan el driver y el electroimán; el servo va al buck de 5.5–6 V.

  Monitor Serie a 115200, con Enter:
    h           homing de J3 contra su final de carrera (gira hacia negativo; φ = HOME_J3)
    s           home manual: la pose actual es φ = 0 (plumón alineado con el brazo 2, a ojo)
    o           soltar / energizar el motor de J3
    g 45        ir a φ = 45° (límites −120 … +121 con el plumón puesto)
    + / -       J3 ±1°        ++ / --  J3 ±10°
    t p|i|s     herramienta al frente: plumón (0°), electroimán (−120°), sensor (+120°)
    u 110       ángulo del servo ARRIBA;   d 20  ángulo ABAJO;   p  plumón arriba/abajo
    c 20        20 bajadas y subidas del plumón (repetibilidad del levante)
    e           electroimán ON/OFF;   m  electroimán 5 s (prueba de agarre)
    n           sensor en vivo (cualquier tecla para salir)
    r 3         ciclo completo 3 veces: plumón abajo/arriba -> sensor -> electroimán -> plumón
    x           chequeo guiado de 9 pasos con preguntas s/n y resumen con los CFG a copiar
    ?           estado

  Qué revisar: el plumón baja y sube 18 mm sin trabarse, el collar no toca el puente, las tuercas
  M4 y el cable del sensor no rozan el final de carrera al girar, el disparo del final queda cerca de
  φ = −120° (si no, anota el ángulo y ponlo en CFG home3 del firmware principal) y el sensor ve una
  arandela a 3–4 mm. Al final copia u/d a CFG servoup / servodn.
*/
#include <AccelStepper.h>
#include <Servo.h>

const bool SIMULACION = false;  // true en Wokwi (final como pulsador NA)

const uint8_t PIN_ENABLE = 8, J3_STEP = 4, J3_DIR = 7, SW_J3 = 9;
const uint8_t PIN_SENSOR = 22, PIN_IMAN = 24, PIN_PARO = 28, PIN_BUZZER = 36, PIN_SERVO = 44;
const float PASOS_GRADO = 10.0;            // 200 × 1/4 × 4.5 / 360
const float HOME_J3 = -120.0;              // dónde dispara el final con el cabezal v3 (calibrar)
const float LIM_MIN = -120.0, LIM_MAX = 121.0;
const float PHI_HERR[3] = { 0, -120, 120 };  // plumón, electroimán, sensor al frente
const char *const NOMBRE[3] = { "plumon", "electroiman", "sensor" };

AccelStepper j3(AccelStepper::DRIVER, J3_STEP, J3_DIR);
Servo servo;
int servoArriba = 110, servoAbajo = 20;
bool plumaAbajo = false, home = false, motorOn = false;
bool contar = false;           // chequeo paso 9: cuenta lecturas de METAL mientras J3 gira
unsigned long falsos = 0;
float home3 = HOME_J3;         // HOME_J3 corregido en el chequeo (paso 3)

bool finalActivo() { return digitalRead(SW_J3) == (SIMULACION ? LOW : HIGH); }
bool paro() { return digitalRead(PIN_PARO) == HIGH; }
float phi() { return j3.currentPosition() / PASOS_GRADO; }
void motor(bool on) { digitalWrite(PIN_ENABLE, on ? LOW : HIGH); motorOn = on; }

void pluma(bool abajo) {
  servo.write(abajo ? servoAbajo : servoArriba);
  plumaAbajo = abajo;
  delay(400);
}

bool irA(float a) {
  if (!home) { Serial.println(F("   primero h o s")); return false; }
  if (a < LIM_MIN || a > LIM_MAX) { Serial.println(F("   fuera de -120..121 (el plumon tocaria el brazo 2)")); return false; }
  if (a != PHI_HERR[0] && plumaAbajo) pluma(false);
  motor(true);
  j3.moveTo(lround(a * PASOS_GRADO));
  while (j3.distanceToGo() != 0) {
    j3.run();
    if (contar && digitalRead(PIN_SENSOR) == LOW) falsos++;
    if (paro()) { j3.stop(); motor(false); home = false; Serial.println(F("!! PARO")); return false; }
  }
  return true;
}

void homing() {
  if (plumaAbajo) pluma(false);
  motor(true);
  j3.setMaxSpeed(1100);
  j3.setSpeed(-1100);
  long inicio = j3.currentPosition();
  while (!finalActivo()) {
    j3.runSpeed();
    if (paro()) { motor(false); Serial.println(F("!! PARO")); return; }
    if (labs(j3.currentPosition() - inicio) > 360 * PASOS_GRADO) { Serial.println(F("   ERROR: el final no se activo")); return; }
  }
  if (home) { Serial.print(F("   deriva: ")); Serial.print(phi() - home3, 2); Serial.println(F(" grados")); }
  j3.setCurrentPosition(lround(home3 * PASOS_GRADO));
  j3.setMaxSpeed(1500);
  home = true;
  Serial.println(F("   home J3 listo"));
  irA(0);
}

bool sensorMetal() {
  int v = 0;
  for (int i = 0; i < 20; i++) { if (digitalRead(PIN_SENSOR) == LOW) v++; delay(10); }
  return v > 10;
}

void herramienta(int k) {
  if (irA(PHI_HERR[k])) { Serial.print(F("   al frente: ")); Serial.println(NOMBRE[k]); }
}

void estado() {
  Serial.print(F("phi ")); Serial.print(phi(), 1);
  Serial.print(F("  home ")); Serial.print(home ? F("si") : F("no"));
  Serial.print(F("  motor ")); Serial.print(motorOn ? F("on") : F("suelto"));
  Serial.print(F("  final ")); Serial.print(finalActivo() ? F("ACTIVO") : F("libre"));
  Serial.print(F("  plumon ")); Serial.print(plumaAbajo ? F("abajo") : F("arriba"));
  Serial.print(F(" (u ")); Serial.print(servoArriba); Serial.print(F(" d ")); Serial.print(servoAbajo);
  Serial.print(F(")  iman ")); Serial.print(digitalRead(PIN_IMAN) ? F("ON") : F("off"));
  Serial.print(F("  sensor ")); Serial.println(digitalRead(PIN_SENSOR) == LOW ? F("METAL") : F("nada"));
}

void ciclo(int n) {
  for (int i = 0; i < n; i++) {
    Serial.print(F("== ciclo ")); Serial.println(i + 1);
    herramienta(0); pluma(true); delay(400); pluma(false);
    herramienta(2); delay(300);
    Serial.println(sensorMetal() ? F("   sensor: METAL") : F("   sensor: nada"));
    herramienta(1);
    digitalWrite(PIN_IMAN, HIGH); delay(800); digitalWrite(PIN_IMAN, LOW);
    if (!home) return;
  }
  herramienta(0);
}

// ------------------------------------------------------------------ chequeo guiado (x)
String leerLinea() {
  while (!Serial.available()) {}
  String l = Serial.readStringUntil('\n');
  l.trim();
  return l;
}
void vaciar() { delay(5); while (Serial.available()) Serial.read(); }
bool listo(const __FlashStringHelper *m) {
  Serial.print(F("   ")); Serial.print(m); Serial.println(F("  [Enter = listo, x = cancelar]"));
  vaciar();
  return leerLinea() != "x";
}
bool preguntar(const __FlashStringHelper *m) {
  Serial.print(F("   ")); Serial.print(m); Serial.println(F("  [s/n]"));
  vaciar();
  String l = leerLinea();
  return l == "s" || l == "S";
}
float pedirMm(const __FlashStringHelper *m) {
  Serial.print(F("   ")); Serial.print(m); Serial.println(F("  [mm y Enter]"));
  vaciar();
  return leerLinea().toFloat();
}

const char *const PASO[10] = { "", "final de J3", "homing", "alineacion", "holguras al girar", "herramientas al frente",
                               "levante del plumon", "electroiman", "sensor en el cabezal", "ruido girando" };
int8_t ok[10];
float levante = 0;

void marcar(uint8_t p, bool b) {
  ok[p] = b;
  Serial.print(F("   >> ")); Serial.print(p); Serial.print(F(" ")); Serial.print(PASO[p]);
  Serial.println(b ? F(": BIEN") : F(": FALLA"));
  tone(PIN_BUZZER, b ? 2000 : 400, b ? 120 : 400);
}

void chequeo() {
  for (int i = 0; i < 10; i++) ok[i] = -1;
  Serial.println(F("\n==== CHEQUEO DEL CABEZAL (9 pasos). x en cualquier pregunta Enter corta. ===="));

  Serial.println(F("\n== 1 · FINAL DE CARRERA DE J3 (motor suelto)"));
  motor(false); home = false;
  if (!listo(F("Presiona el final de carrera de J3 con el dedo y mantenlo. Enter."))) return;
  marcar(1, finalActivo());
  if (!ok[1]) Serial.println(F("      no lo leo: cable en D9, NC entre D9 y GND, o el final esta roto"));

  Serial.println(F("\n== 2 · HOMING: J3 gira hacia negativo hasta tocar el final"));
  if (!listo(F("Suelta el final. Mano lejos del cabezal."))) return;
  homing();
  marcar(2, home);
  if (!home) return;

  Serial.println(F("\n== 3 · ALINEACION: el plumon debe quedar sobre la linea del brazo 2"));
  Serial.println(F("   corrige con + - (1 grado) o ++ -- (10). Enter vacio cuando quede alineado."));
  vaciar();
  for (;;) {
    String l = leerLinea();
    if (l == "x") return;
    if (!l.length()) break;
    if (l == "++") irA(phi() + 10); else if (l == "--") irA(phi() - 10);
    else if (l == "+") irA(phi() + 1); else if (l == "-") irA(phi() - 1);
    Serial.print(F("   phi ")); Serial.println(phi(), 1);
  }
  home3 -= phi();
  j3.setCurrentPosition(0);
  Serial.print(F("   correccion ")); Serial.print(HOME_J3 - home3, 1); Serial.print(F(" grados -> CFG home3 ")); Serial.println(home3, 1);
  marcar(3, fabs(home3 - HOME_J3) <= 3);
  if (!ok[3]) Serial.println(F("      mas de 3 grados: la muesca en V del separador no apunta al pasador del coupler"));

  Serial.println(F("\n== 4 · HOLGURAS: giro de -120 a +121 en pasos de 10, despacio en -60..-40 (lo mas justo)"));
  if (!listo(F("Mira el sensor, las tuercas M4 y el plumon contra el final de carrera y el brazo 2."))) return;
  if (plumaAbajo) pluma(false);
  j3.setMaxSpeed(500);
  for (float a = -120; a <= 121; a += 10) {
    if (!irA(a)) { j3.setMaxSpeed(1500); return; }
    delay(a >= -60 && a <= -40 ? 1500 : 300);
  }
  irA(121); delay(800);
  j3.setMaxSpeed(1500);
  irA(0);
  marcar(4, !preguntar(F("Algo rozo, se trabo o un cable se tenso?")));

  Serial.println(F("\n== 5 · HERRAMIENTAS AL FRENTE"));
  bool todas = true;
  for (int k = 0; k < 3; k++) {
    herramienta(k);
    Serial.print(F("   ")); Serial.print(NOMBRE[k]);
    todas &= preguntar(F(" quedo al frente, sobre la linea del brazo 2?"));
  }
  marcar(5, todas);

  Serial.println(F("\n== 6 · LEVANTE DEL PLUMON (servo D44)"));
  herramienta(0);
  pluma(true);
  float abajo = pedirMm(F("Plumon ABAJO: altura de la punta sobre la mesa?"));
  pluma(false);
  float arriba = pedirMm(F("Plumon ARRIBA: altura de la punta sobre la mesa?"));
  levante = arriba - abajo;
  Serial.print(F("   levante ")); Serial.print(levante, 1); Serial.println(F(" mm (diseno 18)"));
  Serial.println(F("   10 bajadas y subidas..."));
  for (int i = 0; i < 10; i++) { pluma(true); pluma(false); }
  marcar(6, levante >= 16 && levante <= 20 && preguntar(F("Bajo y subio igual las 10 veces, sin trabarse ni zumbar arriba?")));
  if (!ok[6]) Serial.println(F("      ajusta u / d (o prueba_servo) y la posicion del brazo del servo (paso 7 del README del cabezal)"));

  Serial.println(F("\n== 7 · ELECTROIMAN (D24)"));
  herramienta(1);
  if (!listo(F("Sosten la tuerca de acero contra la cara del electroiman. Al Enter lo prendo 5 s: suelta la tuerca."))) return;
  digitalWrite(PIN_IMAN, HIGH); delay(5000); digitalWrite(PIN_IMAN, LOW);
  marcar(7, preguntar(F("La sostuvo los 5 s y cayo al apagarse?")));
  if (!ok[7]) Serial.println(F("      no la sostiene: 12 V en el modulo MOSFET, gate en D24. No cae: magnetismo residual, separa con cinta"));

  Serial.println(F("\n== 8 · SENSOR EN EL CABEZAL (D22)"));
  herramienta(2);
  if (!listo(F("Pon la arandela de acero 3 mm bajo la cara del sensor."))) return;
  bool con = sensorMetal();
  if (!listo(F("Quita la arandela."))) return;
  bool sin = sensorMetal();
  Serial.print(F("   con arandela: ")); Serial.print(con ? F("METAL") : F("nada"));
  Serial.print(F("   sin: ")); Serial.println(sin ? F("METAL") : F("nada"));
  marcar(8, con && !sin);
  if (!ok[8]) Serial.println(F("      corre firmware/prueba_sensor (pasos 1-3) con el sensor montado"));

  Serial.println(F("\n== 9 · RUIDO: J3 gira 6 veces con el electroiman prendido; el sensor no debe ver metal"));
  if (!listo(F("Nada metalico cerca del sensor (ni la mesa ni el soporte a menos de 2 cm)."))) return;
  falsos = 0; contar = true;
  digitalWrite(PIN_IMAN, HIGH);
  for (int i = 0; i < 6 && home; i++) irA(i % 2 ? 120 : 100);
  digitalWrite(PIN_IMAN, LOW);
  contar = false;
  Serial.print(F("   lecturas falsas: ")); Serial.println(falsos);
  marcar(9, home && falsos == 0);
  if (!ok[9]) Serial.println(F("      diodo 1N5819 en la bobina, cable del sensor lejos del del motor y del iman, GND en un solo punto"));
  herramienta(0);

  Serial.println(F("\n==== RESUMEN ===="));
  for (int p = 1; p <= 9; p++) {
    Serial.print(p); Serial.print(F(" ")); Serial.print(PASO[p]); Serial.print(F(": "));
    Serial.println(ok[p] < 0 ? F("sin hacer") : ok[p] ? F("BIEN") : F("FALLA"));
  }
  Serial.println(F("copia esto en mathbot_mega (Monitor Serie) y luego GUARDAR:"));
  Serial.print(F("   CFG home3 ")); Serial.println(home3, 1);
  Serial.print(F("   CFG servoup ")); Serial.println(servoArriba);
  Serial.print(F("   CFG servodn ")); Serial.println(servoAbajo);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_ENABLE, OUTPUT);
  motor(false);
  pinMode(SW_J3, INPUT_PULLUP);
  pinMode(PIN_SENSOR, INPUT_PULLUP);
  pinMode(PIN_PARO, INPUT_PULLUP);
  pinMode(PIN_IMAN, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  j3.setMaxSpeed(1500);
  j3.setAcceleration(1500);
  j3.setMinPulseWidth(2);
  servo.attach(PIN_SERVO, 500, 2400);
  servo.write(servoArriba);
  Serial.println(F("MathBot · etapa 3: prueba del cabezal A v3 (x = chequeo guiado; h, s, t p/i/s, p, c, e, n, r, ?)"));
}

void loop() {
  if (!Serial.available()) return;
  String l = Serial.readStringUntil('\n');
  l.trim();
  if (!l.length()) return;
  char c = l[0];
  float v = l.length() > 1 ? l.substring(1).toFloat() : 0;
  bool hayV = l.length() > 1 && l.substring(1).length() && l.substring(1) != "+" && l.substring(1) != "-";
  if (l == "++") { irA(phi() + 10); }
  else if (l == "--") { irA(phi() - 10); }
  else switch (c) {
    case 'h': homing(); break;
    case 's': j3.setCurrentPosition(0); home = true; motor(true); Serial.println(F("   phi = 0 (home manual)")); break;
    case 'o': motor(!motorOn); if (!motorOn) home = false; Serial.println(motorOn ? F("   motor energizado") : F("   motor suelto (repite h o s)")); break;
    case 'g': irA(v); break;
    case '+': irA(phi() + 1); break;
    case '-': irA(phi() - 1); break;
    case 't': { char h = l.length() > 2 ? l[2] : ' '; int k = h == 'p' ? 0 : h == 'i' ? 1 : h == 's' ? 2 : -1; if (k >= 0) herramienta(k); break; }
    case 'u': if (hayV) servoArriba = constrain((int)v, 0, 180); if (!plumaAbajo) servo.write(servoArriba); estado(); break;
    case 'd': if (hayV) servoAbajo = constrain((int)v, 0, 180); if (plumaAbajo) servo.write(servoAbajo); estado(); break;
    case 'p': pluma(!plumaAbajo); estado(); break;
    case 'c': for (int i = 0; i < max(1, (int)v); i++) { pluma(true); pluma(false); } Serial.println(F("   ciclos listos")); break;
    case 'e': digitalWrite(PIN_IMAN, !digitalRead(PIN_IMAN)); estado(); break;
    case 'm': digitalWrite(PIN_IMAN, HIGH); Serial.println(F("   iman 5 s")); delay(5000); digitalWrite(PIN_IMAN, LOW); break;
    case 'n': {
      Serial.println(F("   sensor en vivo (cualquier tecla para salir)"));
      int antes = -1;
      while (!Serial.available()) {
        int ahora = digitalRead(PIN_SENSOR) == LOW;
        if (ahora != antes) { Serial.println(ahora ? F("   METAL") : F("   nada")); antes = ahora; }
        delay(20);
      }
      while (Serial.available()) Serial.read();
      break;
    }
    case 'r': ciclo(max(1, (int)v)); break;
    case 'x': chequeo(); break;
    default: estado();
  }
}
