# Cabezales MathBot: qué imprimir y qué comprar

Supuesto de materiales para los dos efectores que reemplazan la pinza del SCARA de HowToMechatronics.
El resto del robot (base, columna Z, brazos, poleas, NEMA 17, A4988, CNC Shield, Arduino UNO) se mantiene como en el artículo.
Precios de referencia en USD (AliExpress / tiendas de electrónica); hay que confirmarlos en El Salvador.

## Comparación rápida

| | A · Disco tri-herramienta | B · Revólver triangular |
|---|---|---|
| Cómo cambia de herramienta | J3 gira ±120° | Servo de 270° gira el prisma −120° / 0° / +120° |
| Dónde queda la punta activa | 55 mm (plumón) / 45 mm del eje J3 | 60 mm delante de J3, en la línea del brazo 2 |
| Levante del plumón | Micro-servo SG90 (obligatorio) | No hace falta: el plumón sube con Z |
| Masa estimada | ≈ 150 g | ≈ 240 g |
| Varillas Z mínimas (NEMA de J2 estándar / corto 24 mm) | 240 / 220 mm | 310 / 300 mm |
| Principal fuente de error propia | Juego de la correa de J3 (≈0.5°) × 55 mm ≈ 0.5 mm | Zona muerta del servo (≈1°) × 85 mm ≈ 1.5 mm; con enclavamiento ≈ 0.2–0.3 mm |
| Tiempo de la misión simulada | 86 s | 101 s |

Ambos cumplen los tres requisitos (sensor de metales, electroimán y plumón/lápiz). La pinza original (servo MG996R + piezas) pesa unos 130–150 g, así que A queda igual y B suma unos 100 g.

## A · Disco tri-herramienta

**Imprimir** (≈ 50 g, ≈ 4.5 h)

| Pieza | Material | g | h |
|---|---|---:|---:|
| Placa-disco Ø136 × 6 mm (aligerada), 4 M4 al *Gripper to J3 connector* | PLA+/PETG, 3 perímetros, 30 % | 30 | 2.5 |
| Porta-plumón con camisa deslizante y resorte | PETG | 8 | 0.8 |
| Leva + soporte del micro-servo | PLA+ | 5 | 0.5 |
| Separador del electroimán (25 mm) | PLA+ o varilla M4 | 3 | 0.3 |
| Abrazadera M12 del sensor | PLA+ | 4 | 0.4 |

**Comprar**

| Componente | Cant. | USD | g |
|---|---:|---:|---:|
| Electroimán 12 V KK-P20/15 (Ø20 × 15, ≈2.5 kgf) | 1 | 3–5 | 32 |
| Sensor inductivo LJ12A3-4-Z/BX (M12, NPN NA, 4 mm) | 1 | 3–6 | 30 |
| Micro servo SG90 (o MG90S metálico) | 1 | 2–4 | 10 |
| Plumón Sharpie fino (o lápiz) | 1 | 1–2 | 11 |
| Resorte de compresión Ø10–12 × 20 mm | 1 | <1 | 1 |
| Tornillería M3/M4 + tuercas de seguridad | — | 2 | 10 |

## B · Revólver triangular

Prisma triangular en voladizo, 60 mm delante de J3 y con el eje a lo largo del brazo 2. La cara activa queda paralela a la hoja.
El voladizo no es un capricho: con 3 herramientas a 120° y un giro de 240°, dos de ellas pasan apuntando hacia arriba. Si el prisma colgara justo bajo J3, el sensor chocaría con el acople de J3. Por eso el plumón (la herramienta más larga) va en la posición central del servo y nunca apunta hacia arriba.

**Imprimir** (≈ 83 g, ≈ 8 h)

| Pieza | Material | g | h |
|---|---|---:|---:|
| Soporte en L (brida → 60 mm adelante) con mejilla para servo y rodamiento | PETG, 4 perímetros, 40 % | 30 | 3 |
| Prisma triangular hueco (lado 62 mm, largo 40 mm, eje Ø5) | PLA+/PETG, 30 % | 32 | 3 |
| Porta-plumón con resorte (cara 0°) | PETG | 8 | 0.8 |
| Base del electroimán (cara −120°) y boss M12 del sensor (cara +120°) | PLA+ | 7 | 0.7 |
| Acople horn del servo → prisma | PETG | 3 | 0.3 |
| Leva de 3 muescas (enclavamiento) | PETG | 3 | 0.3 |

**Comprar**

| Componente | Cant. | USD | g |
|---|---:|---:|---:|
| Servo 270° metálico DS3218MG (20 kg·cm), o MG996R + engranes impresos 2:3 | 1 | 10–15 | 60 |
| Rodamiento 625ZZ (5 × 16 × 5) + perno M5 × 50 | 1 | 1–2 | 8 |
| Émbolo de bola con resorte M6/M8 (o bola Ø5 + resorte) | 1 | 2–4 | 5 |
| Electroimán 12 V KK-P20/15 | 1 | 3–5 | 32 |
| Sensor inductivo LJ12A3-4-Z/BX | 1 | 3–6 | 30 |
| Sharpie Mini (o lápiz recortado ≈70 mm) | 1 | 1–2 | 7 |
| Resorte de compresión Ø10–12 × 20 mm | 1 | <1 | 1 |
| Tornillería M3/M4/M5 | — | 2 | 12 |

Par necesario: menos de 1 kg·cm (desbalance de herramientas + arrastre del plumón, 0.5 N × 85 mm). Cualquier servo de 270° alcanza; se pide uno metálico por rigidez y para reducir la zona muerta. No se usa otro NEMA.

## Electrónica común (A y B)

| Componente | Cant. | USD | Conexión |
|---|---:|---:|---|
| Módulo MOSFET de nivel lógico D4184 (o IRLZ44N) + diodo 1N5819 | 1 | 1–2 | electroimán → A1 |
| Optoacoplador PC817 (o divisor 10 kΩ / 4.7 kΩ) | 1 | 1 | sensor de 12 V → A2 |
| Convertidor buck 12 → 6 V: LM2596 (A) o XL4015 5 A (B) | 1 | 2–5 | alimenta el servo; señal en A0 |
| Cable flexible de 6–8 hilos AWG 24–26 (silicona), 1.5 m | 1 | 3–5 | pasa por los ejes huecos de J2 y J3 |
| Conectores JST-XH / Dupont y termoretráctil | — | 2 | — |

- **A0** es el pin que el código de HTM usa para la pinza (`gripperServo.attach(A0, 600, 2500)`).
- **A1 y A2** salen en la CNC Shield como *Hold* y *Resume*. Antes de cablear hay que verificar en el sketch de HTM que no los ocupe ningún final de carrera (el código tiene `limitSwitch1..4`).
- **Fuente:** la de 12 V 6 A del artículo alcanza si el servo solo se mueve con los steppers quietos, como en la simulación.

El simulador (`simulador_scara.html`) muestra estas mismas tablas para el cabezal seleccionado.
