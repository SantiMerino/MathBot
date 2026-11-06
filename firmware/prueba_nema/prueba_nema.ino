/*
  MathBot · prueba mínima de los NEMA 17 (sin bibliotecas, sin finales de carrera ni PARO físico)
  Arduino MEGA 2560 + CNC Shield V3 + A4988 con 1/4 de micropaso (jumper solo en MS2) -> 800 pasos/vuelta.

  Monitor Serie a 115200 con "New Line" (o el panel: panel/, modo PRUEBA NEMA). Escribe y Enter:

  Prueba de ida y vuelta (bloquea hasta terminar):
    1  motor X (J1)    2  motor Y (J2)    3  motor Z (J3)    4  motor A (Z, solo con los jumpers D12/D13)
    varios números juntos mueven esos motores a la vez: 12, 13, 123, 1234...
    t  X, Y y Z a la vez (igual que 123)
  Cada prueba da media vuelta de motor hacia adelante, espera 1 s y regresa al mismo punto,
  con rampa de aceleración al arrancar y al frenar. Al terminar suelta los drivers (EN en HIGH).

  Jog por joint (como un control: se mueve mientras sigas mandando la orden):
    +N [v]  /  -N [v]   mueve el motor N (1-4) hacia + o - a v pasos/s (por defecto 400, máximo 3000).
                        Hay que repetirla cada < 400 ms; si deja de llegar, el motor frena solo.
    xN                  frena el motor N          s   frena todos
    !                   paro inmediato de todos (sin rampa; los drivers siguen energizados)
    c                   pone en cero los contadores     p   imprime la posición
    l                   suelta los drivers (también se sueltan solos tras 30 s quietos)
  Mientras algo se mueve imprime "P j1 j2 j3 z" (grados y mm desde el arranque) 5 veces por segundo,
  y una vez más al detenerse. Es lo que se contó, no una medición: sin finales de carrera no hay home.
*/

const int EN = 8;  // LOW = drivers energizados
const int STEP[4] = { 2, 3, 4, 12 };
const int DIR[4] = { 5, 6, 7, 13 };
const char *NOMBRE[4] = { "X (J1)", "Y (J2)", "Z (J3)", "A (Z)" };

const int PASOS_VUELTA = 800;          // 200 sin jumpers, 3200 con MS1+MS2+MS3
const int PASOS = PASOS_VUELTA / 2;    // media vuelta: J1 ~9°, J2 ~11°, J3 ~40°, Z ~4 mm
const float V_INICIO = 200;            // pasos/s al arrancar y al terminar de frenar
const float V_MAX = 800;               // pasos/s de crucero (800 = 1 vuelta/s = 60 rpm)
const float ACEL = 2000;               // pasos/s²; más bajo = rampa más suave y larga

// Jog: mismas relaciones que firmware/mathbot_mega (pasos por grado en J1-J3, por mm en Z).
const float PASOS_UNIDAD[4] = { 44.4444, 35.5556, 10.0, 100.0 };
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

// ---------------------------------------------------------------- prueba de ida y vuelta (bloqueante)
// Velocidad en el paso p: sube con ACEL desde V_INICIO, se queda en V_MAX y frena igual al final.
float velocidad(int p) {
  int cerca = min(p, PASOS - p);  // pasos al extremo más cercano del recorrido
  float v = sqrt(V_INICIO * V_INICIO + 2.0 * ACEL * cerca);
  return min(v, V_MAX);
}

// Mueve a la vez los motores marcados en 'mascara' (bit 0 = X, bit 1 = Y, bit 2 = Z, bit 3 = A).
void mover(byte mascara, bool adelante) {
  for (int i = 0; i < 4; i++)
    if (mascara & (1 << i)) digitalWrite(DIR[i], adelante ? HIGH : LOW);
  delayMicroseconds(5);
  for (int p = 0; p < PASOS; p++) {
    unsigned int medioPeriodo = 500000.0 / velocidad(p);  // µs en HIGH y en LOW
    for (int i = 0; i < 4; i++)
      if (mascara & (1 << i)) digitalWrite(STEP[i], HIGH);
    delayMicroseconds(medioPeriodo);
    for (int i = 0; i < 4; i++)
      if (mascara & (1 << i)) digitalWrite(STEP[i], LOW);
    delayMicroseconds(medioPeriodo);
  }
}

void prueba(byte mascara) {
  digitalWrite(EN, LOW);
  delay(100);
  Serial.println(F("   ida..."));
  mover(mascara, true);
  delay(1000);
  Serial.println(F("   regreso..."));
  mover(mascara, false);
  delay(300);
  digitalWrite(EN, HIGH);
  energizados = false;
  Serial.println(F("   listo, drivers libres"));
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
}

void loop() {
  leerSerie();
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
