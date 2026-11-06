# MathBot · Segundo avance: prototipo virtual en MATLAB

Simulación 3D del MathBot real: el SCARA de HowToMechatronics impreso en **PLA negro** con el **cabezal de disco v3** (plumón, electroimán KK-P20/15 y sensor LJ18A3 a 55 mm de J3). El robot traza la rosa de tres pétalos del Avance 1 con la misma secuencia y los mismos números que el firmware (`firmware/mathbot_mega`, orden `D`). Arranca y termina en HOME.

## Cómo se ejecuta

1. Abrir MATLAB (R2020a o más nuevo) y poner como carpeta actual `matlab/avance2`.
2. Escribir en la ventana de comandos:

```matlab
ejecutar_todo
```

**No necesita toolboxes.** Los cálculos tardan segundos; lo lento es el video, que captura un cuadro por cada 1/30 s de misión (1555 cuadros). En MATLAB Online son ≈17 min y sale en `.avi`, porque en Linux MATLAB no escribe MP4. Para un video más corto: `P.video.acelerar = 2`.

Probado en MATLAB Online R2026b (MATLAB, Simulink, Simscape, Simscape Multibody).

Al terminar quedan en la carpeta:

| Archivo | Qué es |
|---|---|
| `mathbot_simulacion.mp4` | Video del prototipo virtual ejecutando la misión (`.avi` si el MATLAB no escribe MP4) |
| `mathbot_captura_1_inicio.png`, `_2_trazo.png`, `_3_final.png` | Capturas para el informe |
| `validacion_mathbot.png` | Deseada vs ejecutada, error a lo largo del trazo y sensibilidad |
| `referencia_mathbot.mat` | Misión completa (`REF`) y señales para Simscape |
| `resultados_optimizacion.mat`, `resultados_validacion.mat` | Números del antes/después y del error |

La carpeta `entrega/` guarda lo que salió en MATLAB Online R2026b, listo para subir a Canvas:

- `mathbot_sim.slx`: el modelo de Simulink/Simscape ya configurado.
- `mathbot_simulacion.mp4`: el video, convertido del `.avi` con ffmpeg; el `.avi` no se versiona.
- Las capturas y `validacion_mathbot.png`.
- Los logs de la corrida.

Cada paso también se puede correr por separado, en este orden:

| Paso | Script | Qué hace |
|---|---|---|
| 0 | `verificar_entorno` | Revisa que estén los archivos y dice si hay Simscape |
| 1 | `trayectoria_mathbot` | Arma la misión HOME → rosa → HOME en 10 fases, con la cinemática inversa en cada tramo de 1 mm y redondeo a pasos enteros |
| 2 | `optimizar_mathbot` | Mejora del diseño: dónde poner la rosa para que los errores de las juntas pesen menos en la punta (jacobiano), con antes y después |
| 3 | `validar_mathbot` | Compara la trayectoria deseada con la ejecutada: error máximo, RMS, precisión y sensibilidad al largo de los tramos |
| 4 | `simular_mathbot` | Anima el robot en 3D con sus piezas reales y graba el video |

## Qué se puede cambiar

Todo está en `mathbot_parametros.m`:

- **Sección C:** ubicación de la rosa (`P.centro`, `P.giro`), velocidad de trazo (`P.v_trazo`), largo de los tramos (`P.seg_mm`) y pose de HOME.
- **Sección D:** video. `P.video.grabar = false` solo anima en pantalla; `P.video.acelerar = 2` hace el video el doble de rápido; `P.video.orbita` controla cuántos grados gira la cámara.
- **Secciones A y B:** copian el firmware y el CAD. Solo se tocan si cambian allá.

## Resultados esperados

Con los valores por defecto:

| | |
|---|---|
| Largo de la rosa | 814 mm en 733 tramos de ≈1 mm |
| Trazo | 32.6 s a 25 mm/s |
| Rangos articulares | J1 de 14.7° a 99.3°, J2 de −139.6° a −95.5°, J3 = 0° (plumón al frente), Z = 150.5 mm |
| Condición del jacobiano | κ máx 2.27 (antes 3.14 con la rosa en (260, 0) sin girar) |
| Sensibilidad | 1° de error en una junta mueve la punta a lo sumo 5.59 mm (antes 6.49 mm) |
| Error deseada vs ejecutada | máx ≈ 0.075 mm, RMS ≈ 0.023 mm |

## Cómo está hecho

**Modelo del robot.** `meshes/*.stl` son las piezas del repositorio, agrupadas por cuerpo y color:

- las STL "updated" del SCARA, transformadas como en el simulador y el panel;
- el cabezal de `BRAZO SCARA/DISEÑO FINAL/Cabezal disco/ensamble/stl`.

Cada cuerpo cuelga de su junta:

```
base ── J1 (columna, gira) ── JZ (plataforma + brazo 1, sube) ── J2 (brazo 2) ── J3 (cabezal) ── JP (plumón, sube 18 mm)
```

El origen del cuerpo `plumon` es la punta del plumón: es el TCP. Si cambia el CAD, se regeneran mallas y URDF con:

```bash
python matlab/avance2/fuente/exportar_modelo.py
```

**Cinemática** (marco del robot: origen en el eje de J1 sobre la mesa, mm y grados):

- Directa: `mathbot_fk`. `x = L1 cos θ1 + L2 cos(θ1+θ2) + R cos(θ1+θ2+φ)`, y análogo para `y`. `z = z_plataforma − 150.5 + levante`.
- Inversa: `mathbot_ik`. Con el plumón al frente (φ = 0) es un 2R de eslabones L1 = 228 y Le = L2 + R = 199 mm, con el codo a la derecha (θ2 < 0).
- Jacobiano y valores singulares: `mathbot_jacobiano`.

**Misión.** Es la misma de `dibujarRosa()` en el firmware:

1. Girar J3 para dejar el plumón al frente.
2. Subir a tránsito.
3. Ir al inicio.
4. Bajar el plumón con el servo.
5. Bajar la plataforma a 8 mm y luego a la hoja.
6. Trazar la rosa en tramos rectos de ≥1 mm a 25 mm/s.
7. Subir y levantar el plumón.
8. Volver a HOME.

Los movimientos entre puntos usan la rampa trapezoidal de AccelStepper: todos los ejes salen y llegan juntos.

**Medida de error.** Distancia mínima de cada punto ejecutado por la punta a la curva deseada, evaluada con 20 muestras por tramo. La precisión se calcula como `100·(1 − e_máx / L_ref)`, con L_ref = radio máximo de la rosa (criterio del PBL: ≥ 90 %).

## Supuestos y limitaciones

- La simulación es **cinemática**: el movimiento se impone en las juntas. No modela inercia, holgura de correas, flexión de los brazos ni pasos perdidos.
- El error que se ve en la simulación viene solo de dos cosas: cortar la curva en tramos rectos y redondear cada eje a pasos enteros (1/4 de micropaso: 0.0225° en J1 y 0.028° en J2). El error del robot real será mayor. La optimización baja cuánto pesa cada grado de holgura en la punta, y la entrega final lo medirá sobre el trazo físico.
- La hoja está a z = 0 (mesa) y J3 no se mueve durante el trazo.

## Opcional: modelo en Simscape Multibody

Requiere Simulink, Simscape y Simscape Multibody. Se adaptaron los scripts del ejemplo `MATHBOT_sim` a este robot: se agregó la junta JP del plumón, y el sensor mide en la punta del plumón.

```matlab
trayectoria_mathbot
smimport('mathbot_negro.urdf', 'ModelName', 'mathbot_sim')
configurar_modelo_mathbot
USAR_SIMSCAPE = true; validar_mathbot
```

Probado en MATLAB Online R2026b. `configurar_modelo_mathbot` hace todo esto solo:

- conecta las referencias de las 5 juntas;
- activa las salidas X, Y, Z del sensor de la punta;
- llama a `conectar_sensor_tcp`.

Si en otra versión imprime `[MANUAL]`, hay que hacer a mano lo que diga y después correr `conectar_sensor_tcp`.

Para ver la animación de Simscape, dale **Run** en el modelo: se abre Multibody Explorer. El `.slx` que queda guardado (`mathbot_sim.slx`) es el archivo editable de Simulink para la entrega.

Resultado en Simscape: la punta medida por el Transform Sensor queda a 0.067 mm como máximo de la curva deseada (RMS 0.023 mm), lo mismo que el modelo cinemático. La medida "en el tiempo" llega a ≈0.8 mm por el retardo del filtro de 2 ms de las entradas en los movimientos rápidos. No es error de forma.
