# MathBot

Brazo robótico de doble efector final — diseño, modelado y control de trayectorias matemáticas.

Proyecto de Aprendizaje Basado en Proyectos (PBL) que integra **Física Aplicada III** (20% del curso) y **Matemática Multivariable y Ecuaciones Diferenciales / Cálculo III** (15% del curso), semestre 2 de 2026.

---

## Pregunta retadora

> ¿Cómo podemos diseñar un brazo robótico de bajo costo capaz de manipular objetos mediante una pinza mecánica y un electroimán intercambiable, utilizando modelos matemáticos para generar y optimizar trayectorias que alcancen una precisión mínima del 90%?

## Descripción general

MATHBOT integra ambos cursos alrededor de un mismo producto físico: un brazo robótico de doble efector final, controlado por computador, capaz de ejecutar trayectorias matemáticas y realizar tareas de detección, recolección y manipulación de objetos.

A cada equipo se le entrega una **trayectoria física de referencia** construida en cartón (disponible en el SPARK). La primera tarea es observar y medir ese trazo, identificar sus características geométricas, y proponer y justificar una ecuación paramétrica —con dominio, orientación y escala— que la represente. El modelo se valida en MATLAB y, más adelante, se integra a una simulación 3D en Simulink del brazo real construido por el equipo.

---

## Nuestra trayectoria: rosa de tres pétalos

La referencia física asignada a este equipo es una **rosa de tres pétalos** con dos pétalos grandes (cuadrantes 1 y 4) y uno pequeño (eje X negativo).

### Ecuación paramétrica

$$x(t) = -A\cos(3t)\cos(t) \qquad y(t) = -A\,k\cos(3t)\sin(t) \qquad t \in [0,\pi]$$

con **A = 10.29 cm** y **k = 1.355**.

El parámetro `k` no es un ajuste arbitrario: la referencia física, tal como fue medida, parecía tener dos amplitudes distintas (13 cm en los pétalos grandes, 10 cm en el pequeño). Al medir directamente los píxeles del PDF de referencia, los tres pétalos resultaron **geométricamente idénticos** (682/680/680 px) — la asimetría aparente viene de que el documento coloca la imagen con una matriz de escala anisótropa (`sy/sx = 1.364`, confirmado por ajuste de mínimos cuadrados en `k = 1.355`). Es decir: **una sola ecuación con estiramiento en Y**, sin necesidad de una función definida por tramos.

> **Pendiente de validación física:** este modelo asume que el cartón del SPARK se imprimió a partir de ese PDF sin alteración de escala. Falta medir el trazo físico directamente y confirmar la razón pétalo-vertical / pétalo-horizontal ≈ 1.28.

### Discretización para el robot

La ejecución del brazo requiere convertir la curva continua en una lista finita de *waypoints*. El número de puntos se eligió por presupuesto de error, no de forma arbitraria:

- El objetivo de precisión del PBL es del 90% del **sistema completo**, no solo del modelo matemático. Fuentes de error ya presentes en un brazo de bajo costo: zona muerta del servo (4–9 mm), backlash de engranajes (2–5 mm), flexión de eslabones (1–4 mm), calibración del origen (2–5 mm).
- La discretización debe ser el término despreciable de esa suma → objetivo práctico: error de trazo **< 1 mm**.
- Con espaciado **adaptativo por curvatura** (más puntos donde el pétalo es más cerrado, cerca de la punta), **15 puntos por pétalo** (42 en la ruta completa) dan una desviación máxima de 0.56 mm respecto a la curva real — muy por debajo del presupuesto.

| Puntos/pétalo | Uniforme en t | Adaptativo |
|---|---|---|
| 10 | 2.14 mm | 1.37 mm |
| 12 | 1.43 mm | 0.91 mm |
| **15** | 0.93 mm | **0.56 mm** |
| 20 | 0.49 mm | 0.30 mm |

**Advertencia de implementación:** esta tabla asume que el robot interpola en línea recta entre waypoints en el plano X–Y. Si el control mueve los servos linealmente en *espacio articular* (ángulo a ángulo) en vez de cinemática inversa punto a punto, el camino cartesiano real se arquea entre waypoints y el error sube — en ese caso duplicar a 24–30 puntos por pétalo.

---

## Estructura del repositorio

```
MathBot/
├── README.md
├── docs/
│   └── MATHBOT_-_Semestre_2_2026.pdf     # enunciado oficial del PBL
├── modelo/
│   └── mathbot_trayectoria.html           # herramienta interactiva: modelo, error, export CSV/MATLAB/Arduino
├── matlab/                                # simulación y validación (Avance 1 y 2)
└── firmware/                              # control Arduino del brazo (por definir)
```

---

## Cronograma de entregables — Cálculo III (15%)

| Entregable | Semana | Peso | Qué se evalúa |
|---|---|---|---|
| Avance 1 — Trayectoria paramétrica | 4 | 7% | Estimación/modelado, dominio y orientación, coherencia geométrica, justificación matemática, visualización en MATLAB, validación inicial contra la referencia física |
| Avance 2 — Optimización y simulación 3D | 12 | 3% | Actualización del modelo con restricciones de ingeniería, implementación en MATLAB/Simulink, simulación 3D del brazo real, informe técnico breve |
| Entrega final — Validación y defensa | 17 | 5% | Coherencia modelo–simulación–movimiento real, cuantificación y análisis del error, conclusiones, defensa oral |

## Cronograma de entregables — Física Aplicada III (20%)

| Entregable | Peso | Qué se evalúa |
|---|---|---|
| I. Propuesta conceptual y funcional básica | 5% | Bitácora de alternativas de materiales, arquitectura de control, grados de libertad, control individual y verificable de cada servomotor y del sensor de material |
| II. Control automático del robot | 15% | Ciclos estructurados de prueba, medición, análisis y ajuste; optimización del sistema físico y de control |

## Separación de evidencias por curso

| Evidencia | Curso | Enfoque |
|---|---|---|
| Ecuación paramétrica del trazo físico | Cálculo III | Modelado, justificación, dominio, orientación, visualización |
| Simulación 3D en Simulink | Cálculo III | Correspondencia geometría del prototipo ↔ modelo ↔ ejecución |
| Optimización y análisis de sensibilidad | Cálculo III | Herramientas de cálculo multivariable, restricciones, argumentación |
| Modelo con ecuaciones diferenciales | Cálculo III | Formulación, solución/interpretación, comportamiento dinámico |
| Estructura mecánica, servos, efectores | Física III | Diseño físico, viabilidad, carga, decisiones de ingeniería |
| Sensor de material, electroimán, circuitos | Física III | Principios eléctricos/magnéticos, pruebas, desempeño |
| Precisión final del recorrido | Ambas | Cálculo III: fidelidad matemática y error de trayectoria · Física III: desempeño físico y control |

---

## Requisitos funcionales del robot (Física III)

- Doble efector final: pinza mecánica + electroimán intercambiable.
- Sensor capaz de distinguir el tipo de material entre dos objetos desconocidos.
- Debe tomar únicamente el objeto **metálico de ~70 g** y desplazarlo por la trayectoria definida.
- Control individual y verificable de cada servomotor.

## Pendientes abiertos

- [ ] Medir el trazo físico en cartón (SPARK) y confirmar `k ≈ 1.355` contra la referencia real.
- [ ] Definir explícitamente el criterio de error (% del radio máximo, del radio local, o de la longitud de arco) para el reporte del 90% de precisión.
- [ ] Decidir interpolación cartesiana vs. articular en el firmware, y ajustar el número de waypoints en consecuencia.
- [ ] Construir la simulación 3D en Simulink con la geometría real del prototipo (Avance 2).
- [ ] Documentar el diseño mecánico: grados de libertad, actuadores, arquitectura de control.

---

*Documento fuente: `MATHBOT_-_Semestre_2_2026.pdf`, enunciado oficial del PBL.*
