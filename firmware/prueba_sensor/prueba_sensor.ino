/*
  MathBot · prueba guiada del sensor inductivo LJ18A3-8-Z/BX (NPN, NA, 8 mm) por el PC817 en D22
  Sirve en el banco (sensor suelto) y otra vez ya montado en el cabezal. Guía visual: firmware/guia_cabezal/.

  Conexión (igual que mathbot_mega.ino):
    sensor café  -> +12 V          sensor azul -> GND
    sensor negro -> cátodo del LED del PC817 (pata 2)
    +12 V -> resistencia 2.2 kΩ -> ánodo del LED del PC817 (pata 1)
    PC817 colector (pata 4) -> D22      PC817 emisor (pata 3) -> GND del Mega
    GND de la fuente de 12 V unido al GND del Mega.
  Con metal el sensor cierra el negro a GND, se enciende el LED del PC817 y D22 baja a LOW.
  D22 usa el pull-up interno, así que no hace falta otra resistencia del lado de 5 V.

  Monitor Serie a 115200, fin de línea "Nueva línea". Escribe la orden y Enter:
    a        asistente: corre los pasos 1 a 6 en orden
    1        reposo: sin metal, D22 debe quedarse en "nada" 3 s
    2        detección: acerca y aleja la arandela
    3        distancia: mides con calzas cada cuántos mm detecta (escribes la distancia)
    4        materiales: las 4 piezas de la misión a 3 mm (acero sí, PLA y madera no)
    5        ruido: electroimán y servo funcionando, sin metal cerca (no debe dispararse)
    6        estabilidad: pieza quieta a 3 mm y pasadas rápidas (rebotes y pulso mínimo)
    v        vista en vivo con pitido y LED verde (Enter para salir)
    ?        resumen de resultados
  En cualquier paso, x y Enter lo cancela.
*/
#include <Servo.h>

const uint8_t PIN_SENSOR = 22, PIN_IMAN = 24, LED_VERDE = 30, LED_ROJO = 34, PIN_BUZZER = 36, PIN_SERVO = 44;
const int SERVO_ARRIBA = 110, SERVO_ABAJO = 20;   // los de prueba_servo (CFG servoup / servodn)
const float ALTURA_ESCANEO = 3.0;                 // mm sobre la pieza, como escanear() en mathbot_mega

Servo servo;

// Resultados: -1 sin hacer, 0 falla, 1 bien
int8_t res[7] = { -1, -1, -1, -1, -1, -1, -1 };
const char *const NOMBRE[7] = { "", "reposo", "deteccion", "distancia", "materiales", "ruido", "estabilidad" };
float dEstable = -1, dSinDetectar = -1;   // paso 3
unsigned int falsos = 0;                  // paso 5
unsigned long rebotes = 0, pulsoMinMs = 0; // paso 6

bool metal() { return digitalRead(PIN_SENSOR) == LOW; }

// Igual que hayMetal() de mathbot_mega: 20 lecturas cada 10 ms, mayoría
bool metalVotado() {
  int v = 0;
  for (int i = 0; i < 20; i++) { if (metal()) v++; delay(10); }
  return v > 10;
}

void indicar(bool m) {
  digitalWrite(LED_VERDE, m);
  if (m) tone(PIN_BUZZER, 1800, 60);
}

void vaciar() { delay(5); while (Serial.available()) Serial.read(); }

// Lee una línea; espera hasta 'ms' (0 = sin límite). Devuelve "" si se acabó el tiempo.
String leerLinea(unsigned long ms = 0) {
  unsigned long t0 = millis();
  while (!Serial.available()) {
    if (ms && millis() - t0 > ms) return "";
  }
  String l = Serial.readStringUntil('\n');
  l.trim();
  return l;
}

bool cancelado() {
  if (!Serial.available()) return false;
  String l = Serial.readStringUntil('\n');
  l.trim();
  return l == "x";
}

// Espera Enter (true) o x (false)
bool esperarEnter(const __FlashStringHelper *msg) {
  Serial.print(F("   ")); Serial.print(msg); Serial.println(F("  [Enter = listo, x = cancelar]"));
  vaciar();
  return leerLinea() != "x";
}

// Pregunta s/n
bool preguntar(const __FlashStringHelper *msg) {
  Serial.print(F("   ")); Serial.print(msg); Serial.println(F("  [s/n]"));
  vaciar();
  String l = leerLinea();
  return l == "s" || l == "S";
}

void resultado(uint8_t paso, bool ok, const __FlashStringHelper *siFalla) {
  res[paso] = ok;
  Serial.print(F("   >> paso ")); Serial.print(paso); Serial.print(F(" ("));
  Serial.print(NOMBRE[paso]); Serial.print(F("): "));
  Serial.println(ok ? F("BIEN") : F("FALLA"));
  if (!ok) { Serial.print(F("      revisa: ")); Serial.println(siFalla); digitalWrite(LED_ROJO, HIGH); }
  tone(PIN_BUZZER, ok ? 2000 : 400, ok ? 120 : 400);
}

// ---------------------------------------------------------------- 1 · reposo
void pasoReposo() {
  Serial.println(F("\n== 1 · REPOSO: aleja todo lo metalico de la cara del sensor (10 cm)"));
  if (!esperarEnter(F("Sin metal cerca. El LED rojo del sensor debe estar APAGADO."))) return;
  unsigned long t0 = millis(), bajos = 0, muestras = 0;
  while (millis() - t0 < 3000) { muestras++; if (metal()) bajos++; delay(2); }
  Serial.print(F("   ")); Serial.print(muestras); Serial.print(F(" lecturas, ")); Serial.print(bajos); Serial.println(F(" con METAL"));
  resultado(1, bajos == 0,
    F("si siempre marca METAL: PC817 al reves (pata 1 = punto), negro y cafe cruzados, o falta el GND comun. "
      "Si parpadea: cable del negro suelto o tornillo/tuerca cerca de la cara."));
}

// ---------------------------------------------------------------- 2 · detección
void pasoDeteccion() {
  Serial.println(F("\n== 2 · DETECCION: acerca la arandela de acero de frente a la cara del sensor"));
  Serial.println(F("   tienes 15 s. Debe encender el LED rojo del sensor y aqui salir METAL"));
  vaciar();
  unsigned long t0 = millis();
  while (!metal()) {
    if (cancelado()) return;
    if (millis() - t0 > 15000) {
      resultado(2, false, F("el LED del sensor enciende? si: PC817/resistencia 2.2k/D22. si no: 12 V en el cafe, o la pieza no es acero."));
      return;
    }
  }
  indicar(true);
  Serial.print(F("   METAL a los ")); Serial.print((millis() - t0) / 1000.0, 1); Serial.println(F(" s. Ahora alejala."));
  t0 = millis();
  while (metal()) {
    if (cancelado()) return;
    if (millis() - t0 > 15000) { resultado(2, false, F("no vuelve a nada: la salida queda pegada a GND (PC817 en corto?)")); return; }
  }
  indicar(false);
  resultado(2, true, F(""));
}

// ---------------------------------------------------------------- 3 · distancia
void pasoDistancia() {
  Serial.println(F("\n== 3 · DISTANCIA: arandela de acero de frente a la cara, separada con calzas o regla"));
  Serial.println(F("   escribe la distancia en mm y Enter (ej. 8, luego 7, 6 ... 0). Termina con f."));
  Serial.println(F("   en cada medida tomo 1 s de lecturas y te digo el % con METAL."));
  dEstable = -1; dSinDetectar = -1;
  vaciar();
  for (;;) {
    Serial.print(F("   mm? "));
    String l = leerLinea();
    if (l == "x") return;
    if (l == "f") break;
    float d = l.toFloat();
    if (d < 0 || d > 30 || (d == 0 && l != "0")) { Serial.println(F("   escribe un numero de 0 a 30, f o x")); continue; }
    int si = 0;
    for (int i = 0; i < 100; i++) { if (metal()) si++; delay(10); }
    Serial.print(d, 1); Serial.print(F(" mm -> ")); Serial.print(si); Serial.print(F(" % METAL"));
    if (si == 100) { Serial.println(F("  (estable)")); if (d > dEstable) dEstable = d; indicar(true); }
    else if (si == 0) { Serial.println(F("  (no detecta)")); if (dSinDetectar < 0 || d < dSinDetectar) dSinDetectar = d; indicar(false); }
    else { Serial.println(F("  (borde: aqui oscila)")); indicar(false); }
  }
  if (dEstable < 0) { resultado(3, false, F("no detecto de forma estable a ninguna distancia: repite el paso 2")); return; }
  Serial.print(F("   detecta estable hasta ")); Serial.print(dEstable, 1); Serial.print(F(" mm"));
  if (dSinDetectar > 0) { Serial.print(F(", deja de detectar a ")); Serial.print(dSinDetectar, 1); Serial.print(F(" mm")); }
  Serial.println();
  float margen = dEstable - ALTURA_ESCANEO;
  Serial.print(F("   el escaneo baja a ")); Serial.print(ALTURA_ESCANEO, 1); Serial.print(F(" mm: margen ")); Serial.print(margen, 1); Serial.println(F(" mm (pide 1.5 o mas)"));
  resultado(3, margen >= 1.5, F("margen corto: baja el sensor en la abrazadera o baja la altura de escaneo (+3 en escanear() de mathbot_mega)"));
}

// ---------------------------------------------------------------- 4 · materiales
void pasoMateriales() {
  Serial.println(F("\n== 4 · MATERIALES: pon cada pieza de la mision a 3 mm bajo la cara del sensor"));
  const char *const pieza[4] = { "Arandela de acero", "Ficha de PLA", "Tuerca de acero", "Bloque de madera" };
  const bool esperado[4] = { true, false, true, false };
  bool todo = true;
  for (int i = 0; i < 4; i++) {
    Serial.print(F("   ")); Serial.print(i + 1); Serial.print(F("/4 ")); Serial.print(pieza[i]);
    Serial.println(F(" a 3 mm, quieta  [Enter = medir, x = cancelar]"));
    vaciar();
    if (leerLinea() == "x") return;
    bool m = metalVotado();
    indicar(m);
    bool ok = m == esperado[i];
    todo &= ok;
    Serial.print(F("      lei ")); Serial.print(m ? F("METAL") : F("nada"));
    Serial.println(ok ? F("  ok") : F("  <- NO es lo esperado"));
  }
  indicar(false);
  resultado(4, todo, F("acero que no detecta: mas cerca (paso 3). PLA/madera que detecta: hay metal debajo (mesa, tornillo) o la pieza esta sobre algo de acero."));
}

// ---------------------------------------------------------------- 5 · ruido
void pasoRuido() {
  Serial.println(F("\n== 5 · RUIDO: sin metal cerca del sensor. Muevo el servo y prendo el electroiman 10 veces."));
  Serial.println(F("   necesita el electroiman (D24) y el servo (D44, desde el buck) conectados"));
  if (!esperarEnter(F("Sin metal frente al sensor, electroiman sin pieza pegada."))) return;
  falsos = 0;
  servo.attach(PIN_SERVO, 500, 2400);
  for (int c = 0; c < 10; c++) {
    digitalWrite(PIN_IMAN, HIGH);
    servo.write(c % 2 ? SERVO_ARRIBA : SERVO_ABAJO);
    unsigned long t0 = millis();
    while (millis() - t0 < 600) { if (metal()) falsos++; delayMicroseconds(500); }
    digitalWrite(PIN_IMAN, LOW);   // el apagado de la bobina es el pico más fuerte
    t0 = millis();
    while (millis() - t0 < 600) { if (metal()) falsos++; delayMicroseconds(500); }
    Serial.print('.');
    if (cancelado()) break;
  }
  digitalWrite(PIN_IMAN, LOW);
  servo.write(SERVO_ARRIBA);
  delay(400);
  servo.detach();
  Serial.println();
  Serial.print(F("   lecturas falsas de METAL: ")); Serial.println(falsos);
  resultado(5, falsos == 0, F("pon el diodo 1N5819 en paralelo a la bobina (banda al +), separa el cable del sensor del del iman, "
                              "y une los GND en un solo punto. Si solo falla con el servo: el buck esta lejos o sin GND comun."));
}

// ---------------------------------------------------------------- 6 · estabilidad
void pasoEstabilidad() {
  Serial.println(F("\n== 6 · ESTABILIDAD: pieza de acero quieta a 3 mm durante 5 s"));
  if (!esperarEnter(F("Arandela a 3 mm, sin moverla."))) return;
  rebotes = 0;
  bool antes = metal();
  unsigned long t0 = millis(), conMetal = 0, muestras = 0;
  while (millis() - t0 < 5000) {
    bool m = metal();
    if (m != antes) { rebotes++; antes = m; }
    muestras++; if (m) conMetal++;
    delayMicroseconds(500);
  }
  Serial.print(F("   cambios en 5 s: ")); Serial.print(rebotes);
  Serial.print(F("   con METAL: ")); Serial.print(100.0 * conMetal / muestras, 1); Serial.println(F(" %"));

  Serial.println(F("   ahora pasa la arandela rapido frente a la cara, 5 veces, a 3 mm. Mido cuanto dura cada pulso."));
  if (!esperarEnter(F("Listo para las pasadas (tienes 10 s despues del Enter)."))) return;
  unsigned long pulsos = 0, inicio = 0;
  pulsoMinMs = 0;
  antes = false;
  t0 = millis();
  while (millis() - t0 < 10000 && pulsos < 5) {
    bool m = metal();
    if (m && !antes) inicio = millis();
    if (!m && antes) {
      unsigned long d = millis() - inicio;
      if (d >= 2) {   // menos de 2 ms es rebote, no una pasada
        pulsos++;
        if (!pulsoMinMs || d < pulsoMinMs) pulsoMinMs = d;
        Serial.print(F("   pasada ")); Serial.print(pulsos); Serial.print(F(": ")); Serial.print(d); Serial.println(F(" ms"));
      }
    }
    antes = m;
  }
  Serial.print(F("   pulso mas corto: ")); Serial.print(pulsoMinMs); Serial.println(F(" ms (el escaneo lee 200 ms con la pieza quieta, asi que basta con que no rebote)"));
  resultado(6, rebotes == 0 && conMetal == muestras,
    F("si cambia con la pieza quieta estas en el borde de deteccion: acercala (paso 3) o revisa el cable del negro."));
}

// ---------------------------------------------------------------- vista en vivo y resumen
void vivo() {
  Serial.println(F("\n   vista en vivo (Enter para salir). LED verde y pitido = METAL"));
  vaciar();
  int prev = -1;
  unsigned long n = 0;
  while (!Serial.available()) {
    int m = metal();
    if (m != prev) {
      indicar(m);
      Serial.print(F("   ")); Serial.print(m ? F("METAL") : F("nada"));
      Serial.print(F("   (cambio ")); Serial.print(++n); Serial.println(F(")"));
      prev = m;
    }
    delay(5);
  }
  indicar(false);
  vaciar();
}

void resumen() {
  Serial.println(F("\n---- sensor LJ18A3 en D22 ----"));
  Serial.print(F("ahora: ")); Serial.println(metal() ? F("METAL") : F("nada"));
  for (int p = 1; p <= 6; p++) {
    Serial.print(p); Serial.print(F(" ")); Serial.print(NOMBRE[p]); Serial.print(F(": "));
    Serial.println(res[p] < 0 ? F("sin hacer") : res[p] ? F("BIEN") : F("FALLA"));
  }
  if (dEstable >= 0) { Serial.print(F("distancia estable: ")); Serial.print(dEstable, 1); Serial.println(F(" mm")); }
  if (res[5] >= 0) { Serial.print(F("falsos con iman/servo: ")); Serial.println(falsos); }
  if (res[6] >= 0) { Serial.print(F("rebotes con la pieza quieta: ")); Serial.println(rebotes); }
  Serial.println(F("ordenes: a | 1..6 | v | ?"));
}

void asistente() {
  pasoReposo(); pasoDeteccion(); pasoDistancia(); pasoMateriales(); pasoRuido(); pasoEstabilidad();
  resumen();
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(50);
  pinMode(PIN_SENSOR, INPUT_PULLUP);
  pinMode(PIN_IMAN, OUTPUT);
  digitalWrite(PIN_IMAN, LOW);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_ROJO, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  Serial.println(F("MathBot · prueba del sensor inductivo (D22, LOW = metal)"));
  resumen();
}

void loop() {
  if (!Serial.available()) return;
  String l = Serial.readStringUntil('\n');
  l.trim();
  if (!l.length()) return;
  digitalWrite(LED_ROJO, LOW);
  switch (l[0]) {
    case 'a': asistente(); break;
    case '1': pasoReposo(); break;
    case '2': pasoDeteccion(); break;
    case '3': pasoDistancia(); break;
    case '4': pasoMateriales(); break;
    case '5': pasoRuido(); break;
    case '6': pasoEstabilidad(); break;
    case 'v': vivo(); break;
    default: resumen();
  }
}
