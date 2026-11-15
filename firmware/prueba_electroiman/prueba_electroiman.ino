/*
  MathBot · prueba del electroimán con relé (MiniPBL2, Física Aplicada III)

  Circuito (guia_electroiman/index.html, hoja E-03):
    D24 -> 1 kΩ -> base del 2N2222 (10 kΩ de base a GND), emisor a GND,
    colector -> bobina del relé T73 5 V -> +5 V, 1N4007 en paralelo a la bobina (franja a +5 V).
    Contacto del relé: fuente (+) -> COM, NA -> electroimán -> fuente (−).
  La bobina del relé pide ≈70 mA: el pin del Mega no la mueve solo (máx. 20 mA recomendado).

  Reglas de la prueba: máximo 10 s encendido; cuenta la masa sostenida 5 s y que se suelte al apagar.

  Monitor Serie a 115200, con Enter:
    e        encender (se apaga solo a los 10 s)
    e 5      encender 5 s (1 a 10)
    a        apagar ya
    p        prueba oficial: 3 s de cuenta atrás, 10 s encendido, avisa al cumplir 5 s
    ?        estado
  START (D26 a GND) también enciende 10 s; PARO (D28, NC a GND) apaga si HAY_PARO = true.
*/

const uint8_t PIN_IMAN = 24;     // base del 2N2222 (vía 1 kΩ)
const uint8_t PIN_START = 26;
const uint8_t PIN_PARO = 28;     // hongo NC: HIGH = presionado o cable suelto
const bool HAY_PARO = false;     // true si el hongo de PARO está conectado (en el robot sí)
const uint8_t PIN_BUZZER = 36;
const uint8_t PIN_LED = 13;

const unsigned long T_MAX = 10000;   // regla del MiniPBL2
const unsigned long T_SOSTENER = 5000;
const unsigned long T_DESCANSO = 2000; // entre pulsos, para no rebotar el relé

bool encendido = false, avisado = false;
unsigned long tOn = 0, tDur = 0, tOff = 0;

bool paro() { return HAY_PARO && digitalRead(PIN_PARO) == HIGH; }

void imanOn(unsigned long ms) {
  if (millis() - tOff < T_DESCANSO && tOff != 0) { Serial.println(F("! espera 2 s entre pulsos")); return; }
  if (paro()) { Serial.println(F("! PARO presionado")); return; }
  tDur = min(ms, T_MAX);
  digitalWrite(PIN_IMAN, HIGH); digitalWrite(PIN_LED, HIGH);
  encendido = true; avisado = false; tOn = millis();
  Serial.print(F("ON  ")); Serial.print(tDur / 1000.0, 1); Serial.println(F(" s"));
}

void imanOff(const __FlashStringHelper *por) {
  digitalWrite(PIN_IMAN, LOW); digitalWrite(PIN_LED, LOW);
  if (encendido) {
    Serial.print(F("OFF tras ")); Serial.print((millis() - tOn) / 1000.0, 2);
    Serial.print(F(" s (")); Serial.print(por); Serial.println(')');
    tOff = millis();
  }
  encendido = false;
}

void pitido(unsigned int ms) { tone(PIN_BUZZER, 2000, ms); }

void pruebaOficial() {
  Serial.println(F("Prueba: coloca la pieza y las masas"));
  for (int i = 3; i > 0; i--) { Serial.println(i); pitido(80); delay(1000); }
  imanOn(T_MAX);
}

void estado() {
  Serial.print(F("iman ")); Serial.print(encendido ? F("ON ") : F("OFF "));
  if (encendido) { Serial.print((millis() - tOn) / 1000.0, 1); Serial.print(F(" s ")); }
  Serial.print(F("| PARO ")); Serial.println(!HAY_PARO ? F("no conectado") : paro() ? F("activo") : F("libre"));
}

void setup() {
  digitalWrite(PIN_IMAN, LOW);
  pinMode(PIN_IMAN, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_START, INPUT_PULLUP);
  pinMode(PIN_PARO, INPUT_PULLUP);
  Serial.begin(115200);
  Serial.println(F("MathBot · prueba_electroiman · e / e 5 / a / p / ?"));
}

void loop() {
  if (encendido) {
    unsigned long t = millis() - tOn;
    if (!avisado && t >= T_SOSTENER) { avisado = true; pitido(300); Serial.println(F("5 s sostenido")); }
    if (t >= tDur) imanOff(F("tiempo"));
    if (paro()) imanOff(F("PARO"));
  }

  static bool startAntes = HIGH;
  bool s = digitalRead(PIN_START);
  if (startAntes == HIGH && s == LOW && !encendido) imanOn(T_MAX);
  startAntes = s;

  if (Serial.available()) {
    String l = Serial.readStringUntil('\n'); l.trim();
    if (l == "a") imanOff(F("orden"));
    else if (l == "e") imanOn(T_MAX);
    else if (l.startsWith("e ")) { long seg = l.substring(2).toInt(); if (seg >= 1 && seg <= 10) imanOn(seg * 1000UL); else Serial.println(F("usa e 1 a e 10")); }
    else if (l == "p") pruebaOficial();
    else if (l == "?") estado();
    else if (l.length()) Serial.println(F("? e / e 5 / a / p / ?"));
  }
}
