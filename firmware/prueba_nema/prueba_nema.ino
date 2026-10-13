/*
  MathBot · prueba mínima de los NEMA 17 (sin bibliotecas, sin finales de carrera ni PARO)
  Arduino MEGA 2560 + CNC Shield V3 + A4988 con 1/4 de micropaso (jumper solo en MS2) -> 800 pasos/vuelta.

  Monitor Serie a 115200. Escribe una tecla y Enter:
    1  motor X (J1)    2  motor Y (J2)    3  motor Z (J3)    4  motor A (Z, solo con los jumpers D12/D13)
    t  X, Y y Z a la vez
  Cada prueba da media vuelta de motor hacia adelante, espera 1 s y regresa al mismo punto.
  Al terminar suelta los drivers (EN en HIGH) para que no se calienten.
*/

const int EN = 8;  // LOW = drivers energizados
const int STEP[4] = { 2, 3, 4, 12 };
const int DIR[4] = { 5, 6, 7, 13 };
const char *NOMBRE[4] = { "X (J1)", "Y (J2)", "Z (J3)", "A (Z)" };

const int PASOS_VUELTA = 800;          // 200 sin jumpers, 3200 con MS1+MS2+MS3
const int PASOS = PASOS_VUELTA / 2;    // media vuelta: J1 ~9°, J2 ~11°, J3 ~40°, Z ~4 mm
const int MEDIO_PERIODO_US = 800;      // más grande = más lento (800 -> ~47 rpm)

// Mueve a la vez los motores marcados en 'mascara' (bit 0 = X, bit 1 = Y, bit 2 = Z, bit 3 = A).
void mover(byte mascara, bool adelante) {
  for (int i = 0; i < 4; i++)
    if (mascara & (1 << i)) digitalWrite(DIR[i], adelante ? HIGH : LOW);
  delayMicroseconds(5);
  for (int p = 0; p < PASOS; p++) {
    for (int i = 0; i < 4; i++)
      if (mascara & (1 << i)) digitalWrite(STEP[i], HIGH);
    delayMicroseconds(MEDIO_PERIODO_US);
    for (int i = 0; i < 4; i++)
      if (mascara & (1 << i)) digitalWrite(STEP[i], LOW);
    delayMicroseconds(MEDIO_PERIODO_US);
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
  Serial.println(F("   listo, drivers libres"));
}

void setup() {
  pinMode(EN, OUTPUT);
  digitalWrite(EN, HIGH);  // arranca con los motores apagados
  for (int i = 0; i < 4; i++) {
    pinMode(STEP[i], OUTPUT);
    pinMode(DIR[i], OUTPUT);
  }
  Serial.begin(115200);
  Serial.println(F("1 X | 2 Y | 3 Z | 4 A | t X+Y+Z juntos"));
}

void loop() {
  if (!Serial.available()) return;
  char c = Serial.read();
  if (c >= '1' && c <= '4') {
    Serial.print(F("Motor "));
    Serial.println(NOMBRE[c - '1']);
    prueba(1 << (c - '1'));
  } else if (c == 't') {
    Serial.println(F("X, Y y Z a la vez"));
    prueba(0b0111);
  }
}
