/*
  MathBot · prueba mínima de los NEMA 17 (sin bibliotecas, sin finales de carrera ni PARO físico)
  Arduino MEGA 2560 + CNC Shield V3 + A4988 con 1/4 de micropaso (jumper solo en MS2) -> 800 pasos/vuelta.

  Monitor Serie a 115200 con "New Line" (o el panel: panel/, modo PRUEBA NEMA). Escribe y Enter:

  Prueba de ida y vuelta (bloquea hasta terminar):
    1  motor X (J1)    2  motor Y (J2)    3  motor Z (J3)    4  motor A (Z, solo con los jumpers D12/D13)
    varios números juntos mueven esos motores a la vez: 12, 13, 123, 1234...
    t  X, Y y Z a la vez (igual que 123)
  Cada prueba gira el joint ~90° hacia adelante (Z sube/baja ~4 mm), espera 1 s y regresa al mismo
  punto, con rampa de aceleración al arrancar y al frenar. Si van varios motores juntos, salen y
  llegan al mismo tiempo. Al terminar suelta los drivers (EN en HIGH).
  OJO: sin finales de carrera nada detiene el brazo; deja 90° libres hacia adelante antes de probar.

  Prueba de la rosa (solo J1 y J2; Z y J3 no se mueven), la misma rosa de firmware/mathbot_mega:
    r [v]   traza la rosa a v mm/s (por defecto 25, máximo 60): va al centro, recorre los 3 pétalos
            y regresa al cero. "!" la detiene en seco (los drivers siguen energizados).
  ANTES: pon el brazo recto a mano (J1 = J2 = J3 = 0, todo estirado sobre +X, plumón al frente)
  y manda "c". Ese cero es la única referencia: si no está bien alineado, la rosa sale corrida.

  Jog por joint (como un control: se mueve mientras sigas mandando la orden):
    +N [v]  /  -N [v]   mueve el motor N (1-4) hacia + o - a v pasos/s (por defecto 400, máximo 3000).
                        Hay que repetirla cada < 400 ms; si deja de llegar, el motor frena solo.
    xN                  frena el motor N          s   frena todos
    !                   paro inmediato de todos (sin rampa; los drivers siguen energizados)
    c                   pone en cero los contadores     p   imprime la posición
    l                   suelta los drivers (también se sueltan solos tras 30 s quietos)
  Mientras algo se mueve imprime "P j1 j2 j3 z" (grados y mm desde el arranque) 5 veces por segundo,
  y una vez más al detenerse. Es lo que se contó, no una medición: sin finales de carrera no hay home.

  Cabezal: sensor inductivo y electroimán con relé (solo D22 y D24, que la CNC Shield no usa).
  Funciona aunque la shield no tenga los 12 V: basta el Mega por USB y la fuente del imán.
    e [s]   enciende el electroimán s segundos (1 a 10, por defecto 10) y se apaga solo
    a       apaga el electroimán ya          m   estado del imán y del sensor
    !       también apaga el electroimán
  El sensor está encendido por defecto y avisa solo cada cambio: "L sensor: METAL" / "L sensor: sin metal".
  Con el imán encendido el sensor queda sin energía (nunca los dos a la vez); al apagar el imán
  se reconecta y su lectura se ignora 2 s mientras arranca.
  Entre pulsos del imán hay 3 s de descanso obligatorio.
  Mientras corre una prueba de ida y vuelta o la rosa solo se atiende "!": manda "e" antes,
  o usa el jog (+N / -N), que no bloquea, para probar motores e imán a la vez.

  Cableado con una fuente de 12 V (el relé conmuta entre sensor e imán, como el del Nano):
    Fuente (+) -> COM del relé
    NC -> sensor café (+)              relé en reposo: el sensor tiene energía
    NO -> electroimán -> Fuente (−)    relé activo: el imán tiene energía y el sensor no
    1N4007 en paralelo al electroimán (franja hacia el lado del NO)
    Sensor azul -> Fuente (−) y GND del Mega    negro -> diodo -> D22 (franja al sensor)
    Módulo relé JQC3F: VCC -> 5V, GND -> GND, IN -> D24 (se activa con LOW)
  Con dos fuentes, sus (−) y el GND del Mega van unidos.
*/

const int EN = 8;  // LOW = drivers energizados
const int STEP[4] = { 2, 3, 4, 12 };
const int DIR[4] = { 5, 6, 7, 13 };
const char *NOMBRE[4] = { "X (J1)", "Y (J2)", "Z (J3)", "A (Z)" };

const int PASOS_VUELTA = 800;          // 200 sin jumpers, 3200 con MS1+MS2+MS3
const float GRADOS_PRUEBA = 90;        // recorrido de la prueba en J1-J3 (grados del joint, no del motor)
const float MM_PRUEBA_Z = 4;           // recorrido de la prueba en Z (mm)
const float V_INICIO = 200;            // pasos/s al arrancar y al terminar de frenar
const float V_MAX = 800;               // pasos/s de crucero (800 = 1 vuelta/s = 60 rpm)
const float V_MAX_Z = 200;             // pasos/s del eje Z (motor 4) cuando se prueba solo; más bajo = más lento
const float ACEL = 2000;               // pasos/s²; más bajo = rampa más suave y larga

// Jog: mismas relaciones que firmware/mathbot_mega (pasos por grado en J1-J3, por mm en Z).
const float PASOS_UNIDAD[4] = { 44.4444, 35.5556, 10.0, 100.0 };
// Pasos de la prueba para el motor i: J1 4000, J2 3200, J3 900, Z 400.
long pasosPrueba(int i) {
  return lround((i < 3 ? GRADOS_PRUEBA : MM_PRUEBA_Z) * PASOS_UNIDAD[i]);
}
const float ACEL_JOG[4] = { 2000, 2000, 1500, 3000 };   // pasos/s²
const float V_JOG_DEF = 400, V_JOG_MAX = 3000;          // pasos/s
const unsigned long VIVO_MS = 400;        // sin noticias del panel en este tiempo -> frena
const unsigned long SOLTAR_MS = 30000;    // quietos este tiempo -> drivers libres
const unsigned long REPORTE_MS = 200;

struct Eje {
  int8_t sentido;          // hacia dónde se mueve ahora (0 = quieto)
  int8_t objetivo;         // hacia dónde lo piden (0 = frenar)
  float vel, vObj;         // pasos/s
  unsigned long proximo;   // micros() del siguiente paso
  unsigned long tVivo;     // millis() de la última orden de jog
  long pos;                // pasos contados desde el arranque
};
Eje eje[4];
bool energizados = false;
bool reportar = false;
unsigned long tQuieto = 0, tReporte = 0;

// ---------------------------------------------------------------- cabezal: sensor inductivo + relé del imán
const int PIN_SENSOR = 22;                 // negro del sensor vía diodo (o salida del PC817): LOW = metal
const int PIN_RELE = 24;                   // IN del módulo relé
const bool RELE_ACTIVO_LOW = true;         // JQC3F optoacoplado; false para el 2N2222 + T73 o el D4184
const bool SENSOR_POR_NC = true;           // café del sensor en el NC: sin energía con el imán ON.
                                           // false solo si el café va directo a la fuente (+)
const unsigned long IMAN_MAX_MS = 10000;   // regla del MiniPBL2 y para que no se caliente
const unsigned long IMAN_DESCANSO_MS = 3000;
const unsigned long SENSOR_FILTRO_MS = 50;    // mismo nivel este tiempo = cambio real
const unsigned long SENSOR_ARRANQUE_MS = 2000; // solo con SENSOR_POR_NC: sensor recién reconectado

bool imanOn = false;
unsigned long tImanOn = 0, tImanDur = 0, tImanOff = 0;
int sensorCrudo = HIGH, sensorEstable = HIGH;
unsigned long tSensorCambio = 0;

void rele(bool on) { digitalWrite(PIN_RELE, on == RELE_ACTIVO_LOW ? LOW : HIGH); }

void imanApagar(const __FlashStringHelper *por) {
  rele(false);
  if (!imanOn) return;
  imanOn = false;
  tImanOff = millis();
  Serial.print(F("L iman OFF tras "));
  Serial.print((tImanOff - tImanOn) / 1000.0, 1);
  Serial.print(F(" s ("));
  Serial.print(por);
  Serial.println(')');
}

void imanEncender(unsigned long ms) {
  if (imanOn) { Serial.println(F("L iman ya encendido (a para apagar)")); return; }
  unsigned long desde = millis() - tImanOff;
  if (tImanOff && desde < IMAN_DESCANSO_MS) {
    Serial.print(F("L iman: espera "));
    Serial.print((IMAN_DESCANSO_MS - desde) / 1000.0, 1);
    Serial.println(F(" s de descanso"));
    return;
  }
  tImanDur = min(ms, IMAN_MAX_MS);
  rele(true);
  imanOn = true;
  tImanOn = millis();
  Serial.print(F("L iman ON "));
  Serial.print(tImanDur / 1000.0, 1);
  Serial.println(SENSOR_POR_NC ? F(" s (sensor sin energia)") : F(" s"));
}

bool sensorAlimentado() {
  return !SENSOR_POR_NC || (!imanOn && millis() - tImanOff >= SENSOR_ARRANQUE_MS);
}

// Corte del imán por tiempo y lectura filtrada del sensor. Se llama en loop() y dentro de los movimientos.
void atenderCabezal() {
  if (imanOn && millis() - tImanOn >= tImanDur) imanApagar(F("tiempo"));
  int l = digitalRead(PIN_SENSOR);
  if (l != sensorCrudo) { sensorCrudo = l; tSensorCambio = millis(); }
  if (!sensorAlimentado()) return;  // sin energía o arrancando: su lectura no vale
  if (sensorCrudo != sensorEstable && millis() - tSensorCambio >= SENSOR_FILTRO_MS) {
    sensorEstable = sensorCrudo;
    Serial.println(sensorEstable == LOW ? F("L sensor: METAL") : F("L sensor: sin metal"));
  }
}

void estadoCabezal() {
  Serial.print(F("L iman "));
  if (imanOn) {
    Serial.print(F("ON "));
    Serial.print((millis() - tImanOn) / 1000.0, 1);
    Serial.print('/');
    Serial.print(tImanDur / 1000.0, 1);
    Serial.print(F(" s"));
  } else Serial.print(F("OFF"));
  Serial.print(F(" | sensor "));
  if (imanOn && SENSOR_POR_NC) Serial.println(F("sin energia (iman ON)"));
  else if (!sensorAlimentado()) Serial.println(F("arrancando"));
  else Serial.println(sensorEstable == LOW ? F("METAL") : F("sin metal"));
}

// ---------------------------------------------------------------- prueba de ida y vuelta (bloqueante)
// Velocidad en el paso p de 'total': sube con ACEL desde V_INICIO, se queda en V_MAX y frena igual al final.
float velocidad(long p, long total, float vMax) {
  long cerca = min(p, total - p);  // pasos al extremo más cercano del recorrido
  float v = sqrt(V_INICIO * V_INICIO + 2.0 * ACEL * cerca);
  return min(v, vMax);
}

// Mueve a la vez los motores marcados en 'mascara' (bit 0 = X, bit 1 = Y, bit 2 = Z, bit 3 = A).
// El motor con más pasos marca el ritmo (rampa y V_MAX); los demás reparten sus pasos
// a lo largo del mismo tiempo, así todos arrancan y terminan juntos.
void mover(byte mascara, bool adelante) {
  long pasos[4], acum[4], total = 0;
  for (int i = 0; i < 4; i++) {
    pasos[i] = (mascara & (1 << i)) ? pasosPrueba(i) : 0;
    acum[i] = 0;
    if (pasos[i] > total) total = pasos[i];
    if (pasos[i]) digitalWrite(DIR[i], adelante ? HIGH : LOW);
  }
  delayMicroseconds(5);
  for (long p = 0; p < total; p++) {
    if ((p & 31) == 0) abortar();   // no se detiene: solo atiende el imán y el sensor ("!" apaga el imán)
    float vMax = (mascara == 8) ? V_MAX_Z : V_MAX;   // 8 = solo el motor 4
    unsigned int medioPeriodo = 500000.0 / velocidad(p, total, vMax);  // µs en HIGH y en LOW
    bool da[4];
    for (int i = 0; i < 4; i++) {
      acum[i] += pasos[i];
      da[i] = acum[i] >= total;
      if (da[i]) { acum[i] -= total; digitalWrite(STEP[i], HIGH); }
    }
    delayMicroseconds(medioPeriodo);
    for (int i = 0; i < 4; i++)
      if (da[i]) digitalWrite(STEP[i], LOW);
    delayMicroseconds(medioPeriodo);
  }
}

void prueba(byte mascara) {
  digitalWrite(EN, LOW);
  delay(100);
  Serial.println(F("   ida..."));
  mover(mascara, true);
  esperar(1000);
  Serial.println(F("   regreso..."));
  mover(mascara, false);
  delay(300);
  digitalWrite(EN, HIGH);
  energizados = false;
  Serial.println(F("   listo, drivers libres"));
}

// ---------------------------------------------------------------- prueba de la rosa (solo J1 y J2)
// Geometría y rosa iguales a firmware/mathbot_mega (L1, L2, cabezal con el plumón a 55 mm de J3).
const float L1 = 228.0, L2 = 144.0;            // mm
const float RADIO_PLUMON = 55.0;               // 0 si el cabezal no está montado
const float ROSA_A = 102.9, ROSA_K = 1.3552;
const float ROSA_T0 = 5 * M_PI / 6, ROSA_T1 = 11 * M_PI / 6;
const float ROSA_X = 185, ROSA_Y = 0, ROSA_ALFA = 180;   // centro (mm) y giro (grados)
const float SEG_MM = 1.0;                      // largo de cada tramo recto
const int ROSA_N = 1600;                       // muestras del parámetro t
const float V_ROSA_DEF = 25, V_ROSA_MAX = 60;  // mm/s
const float V_ACERCA = 600;                    // pasos/s al ir al centro y al volver al cero
unsigned long tRosa;                           // micros() del siguiente paso del trazo

bool abortar() {
  atenderCabezal();
  if (Serial.available() && Serial.peek() == '!') { Serial.read(); imanApagar(F("paro")); return true; }
  return false;
}

// delay() que sigue atendiendo el cabezal; false si llegó "!".
bool esperar(unsigned long ms) {
  unsigned long t0 = millis();
  while (millis() - t0 < ms)
    if (abortar()) return false;
  return true;
}

float envolver(float a) {
  while (a > 180) a -= 360;
  while (a <= -180) a += 360;
  return a;
}

void rosaPunto(float t, float &x, float &y) {
  static const float ca = cos(radians(ROSA_ALFA)), sa = sin(radians(ROSA_ALFA));
  float r = cos(3 * t);
  float xl = -ROSA_A * r * cos(t);
  float yl = -ROSA_A * ROSA_K * r * sin(t);
  x = ROSA_X + ca * xl - sa * yl;
  y = ROSA_Y + sa * xl + ca * yl;
}

// IK del plumón con el codo en theta2 negativo (como mathbot_mega). Grados.
bool ik(float x, float y, float &t1, float &t2) {
  float le = L2 + RADIO_PLUMON;
  float c2 = (x * x + y * y - L1 * L1 - le * le) / (2 * L1 * le);
  if (c2 < -1 || c2 > 1) return false;
  float b = -acos(c2);
  t1 = envolver(degrees(atan2(y, x) - atan2(le * sin(b), L1 + le * cos(b))));
  t2 = degrees(b);
  return t1 >= -150 && t1 <= 150 && t2 >= -150 && t2 <= 150;
}

// Lleva J1-J3 a 'obj' (pasos) con rampa; los tres llegan juntos.
bool irArticular(const long obj[3]) {
  long d[3], acum[3] = { 0, 0, 0 }, total = 0;
  int8_t s[3];
  for (int i = 0; i < 3; i++) {
    long dd = obj[i] - eje[i].pos;
    s[i] = dd >= 0 ? 1 : -1;
    d[i] = labs(dd);
    if (d[i] > total) total = d[i];
    digitalWrite(DIR[i], dd >= 0 ? HIGH : LOW);
  }
  delayMicroseconds(5);
  for (long p = 0; p < total; p++) {
    unsigned int medio = 500000.0 / velocidad(p, total, V_ACERCA);
    bool da[3];
    for (int i = 0; i < 3; i++) {
      acum[i] += d[i];
      da[i] = acum[i] >= total;
      if (da[i]) { acum[i] -= total; digitalWrite(STEP[i], HIGH); eje[i].pos += s[i]; }
    }
    delayMicroseconds(medio);
    for (int i = 0; i < 3; i++)
      if (da[i]) digitalWrite(STEP[i], LOW);
    delayMicroseconds(medio);
    if ((p & 31) == 0 && abortar()) return false;
  }
  return true;
}

// Tramo a velocidad constante: J1 y J2 llegan a 'obj' en T segundos.
bool tramo(const long obj[3], float T) {
  long d[3], acum[3] = { 0, 0, 0 }, n = 0;
  int8_t s[3];
  for (int i = 0; i < 3; i++) {
    long dd = obj[i] - eje[i].pos;
    s[i] = dd >= 0 ? 1 : -1;
    d[i] = labs(dd);
    if (d[i] > n) n = d[i];
    digitalWrite(DIR[i], dd >= 0 ? HIGH : LOW);
  }
  if (!n) return true;
  unsigned long dt = T * 1e6 / n;
  if ((long)(micros() - tRosa) > 3000) tRosa = micros();  // si el cálculo se atrasó, no recuperar a ráfagas
  for (long k = 0; k < n; k++) {
    while ((long)(micros() - tRosa) < 0) {}
    bool da[3];
    for (int i = 0; i < 3; i++) {
      acum[i] += d[i];
      da[i] = acum[i] >= n;
      if (da[i]) { acum[i] -= n; digitalWrite(STEP[i], HIGH); eje[i].pos += s[i]; }
    }
    delayMicroseconds(3);
    for (int i = 0; i < 3; i++)
      if (da[i]) digitalWrite(STEP[i], LOW);
    tRosa += dt;
    if ((k & 15) == 0 && abortar()) return false;
  }
  return true;
}

// Recorre la rosa a tramos de ≈SEG_MM; si 'trazar' es falso solo comprueba que cada punto se alcanza.
bool recorrerRosa(bool trazar, float v, float &largo) {
  float xa, ya, t1, t2;
  rosaPunto(ROSA_T0, xa, ya);
  largo = 0;
  for (int i = 1; i <= ROSA_N; i++) {
    float px, py;
    rosaPunto(ROSA_T0 + (ROSA_T1 - ROSA_T0) * i / ROSA_N, px, py);
    float d = hypot(px - xa, py - ya);
    if (d < SEG_MM && i < ROSA_N) continue;
    if (!ik(px, py, t1, t2)) {
      Serial.print(F("L rosa fuera de alcance en "));
      Serial.print(px, 0); Serial.print(F(", ")); Serial.println(py, 0);
      return false;
    }
    if (trazar) {
      long obj[3] = { lround(t1 * PASOS_UNIDAD[0]), lround(t2 * PASOS_UNIDAD[1]), eje[2].pos };
      if (!tramo(obj, d / v)) return false;
      if (millis() - tReporte >= REPORTE_MS) { tReporte = millis(); imprimirPosicion(); }
    }
    largo += d;
    xa = px; ya = py;
  }
  return true;
}

void rosa(float v) {
  float largo, x, y, t1, t2;
  Serial.println(F("   rosa: comprobando alcance..."));
  if (!recorrerRosa(false, v, largo)) return;
  Serial.print(F("   rosa alcanzable: "));
  Serial.print(largo, 0);
  Serial.print(F(" mm, unos "));
  Serial.print(largo / v, 0);
  Serial.println(F(" s de trazo"));

  digitalWrite(EN, LOW);
  energizados = true;
  delay(100);
  rosaPunto(ROSA_T0, x, y);
  ik(x, y, t1, t2);
  long inicio[3] = { lround(t1 * PASOS_UNIDAD[0]), lround(t2 * PASOS_UNIDAD[1]), 0 };  // J3 = 0: plumón al frente
  Serial.println(F("   al centro de la rosa..."));
  bool ok = irArticular(inicio);
  if (ok) ok = esperar(500);
  if (ok) {
    Serial.println(F("   trazando..."));
    unsigned long t0 = millis();
    tRosa = micros();
    ok = recorrerRosa(true, v, largo);
    if (ok) {
      Serial.print(F("   rosa terminada en "));
      Serial.print((millis() - t0) / 1000.0, 1);
      Serial.println(F(" s"));
    }
  }
  if (ok) ok = esperar(500);
  if (ok) {
    Serial.println(F("   regreso al cero..."));
    const long cero[3] = { 0, 0, 0 };
    ok = irArticular(cero);
  }
  Serial.println(ok ? F("   listo (drivers energizados; se sueltan solos en 30 s)")
                    : F("L PARO: rosa detenida, drivers energizados"));
  tQuieto = millis();
  reportar = true;
}

// ---------------------------------------------------------------- jog
bool algoSeMueve() {
  for (int i = 0; i < 4; i++)
    if (eje[i].sentido || eje[i].objetivo) return true;
  return false;
}

void imprimirPosicion() {
  Serial.print('P');
  for (int i = 0; i < 4; i++) {
    Serial.print(' ');
    Serial.print(eje[i].pos / PASOS_UNIDAD[i], 2);
  }
  Serial.println();
}

void pararYa() {
  imanApagar(F("paro"));
  for (int i = 0; i < 4; i++) eje[i].sentido = eje[i].objetivo = 0;
  tQuieto = millis();
  reportar = true;
}

// Un paso del motor i si ya le toca, con rampa trapezoidal (v² = v0² ± 2·a por paso).
void atenderEje(int i, unsigned long ahora) {
  Eje &e = eje[i];
  if (e.objetivo && millis() - e.tVivo > VIVO_MS) e.objetivo = 0;  // el panel dejó de mandar: frena
  if (!e.sentido) {
    if (!e.objetivo) return;
    if (!energizados) { digitalWrite(EN, LOW); energizados = true; delay(2); }
    digitalWrite(DIR[i], e.objetivo > 0 ? HIGH : LOW);
    delayMicroseconds(5);
    e.sentido = e.objetivo;
    e.vel = min(V_INICIO, e.vObj);
    e.proximo = ahora;
  }
  if ((long)(ahora - e.proximo) < 0) return;

  digitalWrite(STEP[i], HIGH);
  delayMicroseconds(3);
  digitalWrite(STEP[i], LOW);
  e.pos += e.sentido;
  tQuieto = millis();

  const float a2 = 2.0 * ACEL_JOG[i];
  if (e.objetivo != e.sentido) {             // frenar (o frenar para cambiar de sentido)
    float v2 = e.vel * e.vel - a2;
    if (v2 <= V_INICIO * V_INICIO) { e.sentido = 0; reportar = true; return; }
    e.vel = sqrt(v2);
  } else if (e.vel > e.vObj) {               // bajaron la velocidad
    float v2 = e.vel * e.vel - a2;
    e.vel = v2 > e.vObj * e.vObj ? sqrt(v2) : e.vObj;
  } else if (e.vel < e.vObj) {               // acelerando
    e.vel = min(e.vObj, (float)sqrt(e.vel * e.vel + a2));
  }
  e.proximo += (unsigned long)(1e6 / e.vel);
  if ((long)(ahora - e.proximo) > 0) e.proximo = ahora;  // si el lazo se atrasó, no recuperar a ráfagas
}

// ---------------------------------------------------------------- órdenes
void ejecutar(char *s) {
  while (*s == ' ') s++;
  if (!*s) return;

  if ((s[0] == '+' || s[0] == '-') && s[1] >= '1' && s[1] <= '4') {
    Eje &e = eje[s[1] - '1'];
    float v = atof(s + 2);
    e.vObj = constrain(v > 0 ? v : V_JOG_DEF, 50, V_JOG_MAX);
    e.objetivo = s[0] == '+' ? 1 : -1;
    e.tVivo = millis();
    return;
  }
  if (s[0] == 'x' && s[1] >= '1' && s[1] <= '4') { eje[s[1] - '1'].objetivo = 0; return; }
  if (!strcmp(s, "s")) { for (int i = 0; i < 4; i++) eje[i].objetivo = 0; return; }
  if (!strcmp(s, "p")) { imprimirPosicion(); return; }

  // cabezal (antes de buscar dígitos: "e 3" no debe mover el motor 3)
  if (s[0] == 'e' && (s[1] == 0 || s[1] == ' ')) {
    long seg = s[1] ? atol(s + 2) : IMAN_MAX_MS / 1000;
    if (seg < 1 || seg > (long)(IMAN_MAX_MS / 1000)) { Serial.println(F("L usa e 1 a e 10")); return; }
    imanEncender(seg * 1000UL);
    return;
  }
  if (!strcmp(s, "a")) { if (imanOn) imanApagar(F("orden")); else Serial.println(F("L iman ya apagado")); return; }
  if (!strcmp(s, "m")) { estadoCabezal(); return; }
  if (!strcmp(s, "c")) {
    if (algoSeMueve()) { Serial.println(F("L espera a que se detenga para poner en cero")); return; }
    for (int i = 0; i < 4; i++) eje[i].pos = 0;
    imprimirPosicion();
    return;
  }
  if (!strcmp(s, "l")) {
    if (algoSeMueve()) { Serial.println(F("L espera a que se detenga para soltar")); return; }
    digitalWrite(EN, HIGH);
    energizados = false;
    Serial.println(F("L drivers libres: si mueves los brazos a mano, la posicion contada deja de valer"));
    return;
  }

  if (s[0] == 'r' && (s[1] == 0 || s[1] == ' ')) {
    if (algoSeMueve()) { Serial.println(F("L espera a que el jog se detenga")); return; }
    float v = atof(s + 1);
    rosa(constrain(v > 0 ? v : V_ROSA_DEF, 2, V_ROSA_MAX));
    return;
  }

  // prueba de ida y vuelta: dígitos 1-4 o "t"
  if (!strcmp(s, "t")) s = (char *)"123";
  byte mascara = 0;
  for (char *k = s; *k; k++)
    if (*k >= '1' && *k <= '4') mascara |= 1 << (*k - '1');
  if (!mascara) return;
  if (algoSeMueve()) { Serial.println(F("L espera a que el jog se detenga")); return; }

  Serial.print(F("Motores:"));
  for (int i = 0; i < 4; i++)
    if (mascara & (1 << i)) {
      Serial.print(' ');
      Serial.print(NOMBRE[i]);
    }
  Serial.println();
  prueba(mascara);
  tQuieto = millis();
}

// Lectura sin bloquear: el jog necesita que loop() gire sin parar.
char buf[24];
uint8_t nBuf = 0;
void leerSerie() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '!') { pararYa(); nBuf = 0; continue; }  // no espera el Enter
    if (c == '\n' || c == '\r') {
      if (nBuf) { buf[nBuf] = 0; ejecutar(buf); nBuf = 0; }
    } else if (nBuf < sizeof(buf) - 1) buf[nBuf++] = c;
  }
}

void setup() {
  rele(false);               // relé apagado ANTES de hacer el pin salida: no pulsa al arrancar
  pinMode(PIN_RELE, OUTPUT);
  pinMode(PIN_SENSOR, INPUT_PULLUP);
  sensorCrudo = sensorEstable = digitalRead(PIN_SENSOR);
  tSensorCambio = millis();
  pinMode(EN, OUTPUT);
  digitalWrite(EN, HIGH);  // arranca con los motores apagados
  for (int i = 0; i < 4; i++) {
    pinMode(STEP[i], OUTPUT);
    pinMode(DIR[i], OUTPUT);
  }
  Serial.begin(115200);
  // El panel reconoce este firmware por la primera línea y el jog por la segunda: no cambiarlas.
  Serial.println(F("1 X | 2 Y | 3 Z | 4 A | juntos: 12, 123, 1234... | t = 123"));
  Serial.println(F("JOG +N/-N [pasos/s] cada <400 ms | xN frena N | s frena todo | ! paro | c cero | p posicion | l suelta"));
  Serial.println(F("L cabezal: e [s] enciende el iman (max 10 s) | a apaga | m estado | sensor en D22, rele en D24"));
  estadoCabezal();
}

void loop() {
  leerSerie();
  atenderCabezal();
  unsigned long ahora = micros();
  bool moviendo = false;
  for (int i = 0; i < 4; i++) {
    atenderEje(i, ahora);
    if (eje[i].sentido) moviendo = true;
  }
  if (reportar || (moviendo && millis() - tReporte >= REPORTE_MS)) {
    reportar = false;
    tReporte = millis();
    imprimirPosicion();
  }
  if (energizados && !moviendo && millis() - tQuieto > SOLTAR_MS) {
    digitalWrite(EN, HIGH);
    energizados = false;
    Serial.println(F("L drivers libres (30 s sin moverse)"));
  }
}