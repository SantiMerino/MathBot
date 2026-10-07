/*
  MathBot · prueba y calibración del servo del plumón (SG90 / MG90S en D44)

  El servo NO se alimenta del 5 V del Arduino: va al buck LM2596 ajustado a 5.5–6 V,
  con la tierra unida a la del Mega. Solo la señal (naranja) va a D44.

  Monitor Serie a 115200, con Enter:
    90          ir a 90 grados
    u1500       ir a 1500 microsegundos (para encontrar los topes reales del servo)
    +  / -      subir / bajar 1 grado
    a           guardar la posición actual como ARRIBA
    z           guardar la posición actual como ABAJO (punta tocando la hoja)
    p           alternar plumón arriba / abajo
    b           barrido lento 0 -> 180 -> 0
    c 20        ciclo de 20 bajadas/subidas (repetibilidad del levante)
    d           soltar el servo (sin pulso: se puede girar con la mano)
    ?           estado

  Al terminar copia los valores de ARRIBA y ABAJO a SERVO_ARRIBA / SERVO_ABAJO en mathbot_mega.ino.
*/
#include <Servo.h>

const uint8_t PIN_SERVO = 44;
const uint8_t PIN_BUZZER = 36;
const int PULSO_MIN = 500, PULSO_MAX = 2400;  // SG90; si zumba en los extremos, estrecha el rango

Servo servo;
int angulo = 90;
int arriba = 110;  // valores iniciales de mathbot_mega.ino
int abajo = 20;
bool plumaAbajo = false;

void ir(int a) {
  angulo = constrain(a, 0, 180);
  if (!servo.attached()) servo.attach(PIN_SERVO, PULSO_MIN, PULSO_MAX);
  servo.write(angulo);
  Serial.print(F("   angulo: ")); Serial.print(angulo);
  Serial.print(F("   pulso: ")); Serial.print(servo.readMicroseconds()); Serial.println(F(" us"));
}

void estado() {
  Serial.println(F("---- servo del plumon (D44) ----"));
  Serial.print(F("actual: ")); Serial.print(angulo);
  Serial.print(F("   ARRIBA: ")); Serial.print(arriba);
  Serial.print(F("   ABAJO: ")); Serial.print(abajo);
  Serial.print(F("   recorrido: ")); Serial.print(abs(arriba - abajo)); Serial.println(F(" grados"));
  Serial.println(F("comandos: <grados> | u<us> | + - | a z | p | b | c N | d | ?"));
}

void barrido() {
  Serial.println(F("   barrido 0 -> 180 -> 0"));
  for (int a = 0; a <= 180; a += 2) { servo.write(a); delay(25); }
  for (int a = 180; a >= 0; a -= 2) { servo.write(a); delay(25); }
  ir(angulo);
}

void ciclo(int n) {
  Serial.print(F("   ciclo de ")); Serial.print(n); Serial.println(F(" levantadas (Enter para cortar)"));
  for (int i = 1; i <= n && !Serial.available(); i++) {
    servo.write(abajo); delay(500);
    servo.write(arriba); delay(500);
    Serial.print(F("   ")); Serial.println(i);
  }
  plumaAbajo = false;
  angulo = arriba;
  tone(PIN_BUZZER, 1500, 100);
  Serial.println(F("   revisa que el plumon marque igual en cada bajada"));
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(100);
  pinMode(PIN_BUZZER, OUTPUT);
  ir(arriba);
  estado();
}

void loop() {
  if (!Serial.available()) return;
  String s = Serial.readStringUntil('\n');
  s.trim();
  if (!s.length()) return;
  char c = s[0];

  if (isDigit(c)) { ir(s.toInt()); return; }
  switch (c) {
    case 'u': {
      int us = constrain(s.substring(1).toInt(), PULSO_MIN, PULSO_MAX);
      if (!servo.attached()) servo.attach(PIN_SERVO, PULSO_MIN, PULSO_MAX);
      servo.writeMicroseconds(us);
      angulo = servo.read();
      Serial.print(F("   pulso: ")); Serial.print(us); Serial.print(F(" us ~ ")); Serial.print(angulo); Serial.println(F(" grados"));
      break;
    }
    case '+': ir(angulo + 1); break;
    case '-': ir(angulo - 1); break;
    case 'a': arriba = angulo; Serial.print(F("   ARRIBA = ")); Serial.println(arriba); break;
    case 'z': abajo = angulo; Serial.print(F("   ABAJO = ")); Serial.println(abajo); break;
    case 'p': plumaAbajo = !plumaAbajo; ir(plumaAbajo ? abajo : arriba); break;
    case 'b': barrido(); break;
    case 'c': ciclo(max(1, (int)s.substring(1).toInt())); break;
    case 'd': servo.detach(); Serial.println(F("   servo suelto")); break;
    default: estado();
  }
}
