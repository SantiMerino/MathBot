/*
  MathBot · prueba mínima de los NEMA 17 (sin bibliotecas, sin finales de carrera ni PARO)
  Arduino MEGA 2560 + CNC Shield V3 + A4988 con 1/4 de micropaso (jumper solo en MS2) -> 800 pasos/vuelta.

  Monitor Serie a 115200 con "New Line". Escribe y Enter:
    1  motor X (J1)    2  motor Y (J2)    3  motor Z (J3)    4  motor A (Z, solo con los jumpers D12/D13)
    varios números juntos mueven esos motores a la vez: 12, 13, 123, 1234...
    t  X, Y y Z a la vez (igual que 123)
  Cada prueba da media vuelta de motor hacia adelante, espera 1 s y regresa al mismo punto,
  con rampa de aceleración al arrancar y al frenar para no perder pasos.
  Al terminar suelta los drivers (EN en HIGH) para que no se calienten.
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
  Serial.println(F("1 X | 2 Y | 3 Z | 4 A | juntos: 12, 123, 1234... | t = 123"));
}

void loop() {
  if (!Serial.available()) return;
  String linea = Serial.readStringUntil('\n');
  linea.trim();
  if (linea == "t") linea = "123";

  byte mascara = 0;
  for (unsigned int k = 0; k < linea.length(); k++)
    if (linea[k] >= '1' && linea[k] <= '4') mascara |= 1 << (linea[k] - '1');
  if (!mascara) return;

  Serial.print(F("Motores:"));
  for (int i = 0; i < 4; i++)
    if (mascara & (1 << i)) {
      Serial.print(' ');
      Serial.print(NOMBRE[i]);
    }
  Serial.println();
  prueba(mascara);
}
