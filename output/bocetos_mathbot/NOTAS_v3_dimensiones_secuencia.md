# MathBot v3: cabezal sencillo, dimensiones y ángulos
Fecha: 24-09-2026. Dibujos generados con ImageGen; sin escala y sin tolerancias de fabricación. Esta revisión sustituye la propuesta de torreta/cambio automático para la función solicitada. No modifica las simulaciones ni los documentos anteriores.

## Función del cabezal
Una placa fija porta el electroimán y los sensores. Una pinza sencilla de dos mitades sujeta exclusivamente el lápiz; se aprieta manualmente. Un servo auxiliar abate el portaplumas: posición nominal 0° para escribir y 90° para retirarlo. Son posiciones funcionales propuestas, no pulsos ni ángulos absolutos del servo seleccionado.

No hay almacén, cartuchos intercambiables, torreta ni apertura/cierre motorizado de la pinza. El electroimán recoge objetos; la pinza sostiene el instrumento que traza la curva. El lápiz, electroimán y sensores están lateralmente separados, nunca apilados en el mismo eje. El lápiz desplegado llega al papel antes que el imán; al abatirlo, el imán queda libre para aproximarse al objeto. El muelle/guía del portaplumas, los topes de abatimiento y su despeje deben dimensionarse con el lápiz real.

## Dimensiones y grados de libertad
| Parámetro | SCARA | Brazo EEZY |
|---|---|---|
| Primer eslabón móvil | 200 mm entre ejes | L2 = 135 mm, hombro a codo |
| Segundo eslabón móvil | 200 mm entre ejes | L3 = 147 mm, codo a muñeca |
| Desplazamiento vertical fijo | Según montaje de torre | L1 = 92 mm, referencia base a hombro del modelo |
| Desplazamiento de herramienta original | Modelo XY de dos barras | L4 = 87 mm, desplazamiento horizontal original, no longitud del lápiz |
| Eje vertical | Carrera propuesta 60 mm | Movimiento combinado de hombro/codo |
| GDL de posicionamiento | 3: q1, q2, Z | 3: q1, q2, q3 |
| Movimiento auxiliar independiente | 1: abatimiento de lápiz | 1: abatimiento de lápiz |

Por tanto, cada propuesta tiene cuatro movimientos actuados independientes contando el portaplumas. El electroimán ON/OFF no añade un grado de libertad. La pinza apretada no añade otro eje controlado. Las bielas pasivas tampoco son GDL adicionales.

Dimensiones de bielas auxiliares que figuran en la librería EEZY: L2A = 60 mm, LAB = 140 mm y LB3 = 60 mm. Son parámetros de su mecanismo original, no cotas de cualquier barra visualmente parecida del boceto. Conservar su conectividad y validar nivelación en CAD. Las láminas solo acotan la cadena principal para mantener legibilidad.

## Ángulos: cálculo, convenciones y alcance
Se evaluaron 20 001 muestras de:
x_r = -102.9 cos(3t) cos(t), y_r = -102.9 × 1.3552 cos(3t) sin(t), t de 0 a pi.
Todas las longitudes se expresan en mm. La rosa tiene un pétalo hacia -X.

| Articulación | SCARA: centro (220,0) | EEZY original: centro (250,0), z=5 |
|---|---:|---:|
| q1 | -79.467° a -17.963° | -22.696° a 22.696° |
| q2 | 83.419° a 145.955° | 6.577° a 26.388° |
| q3 | No aplica | -136.213° a -50.766° |

Estos son intervalos articulares requeridos por la curva del MODELO DE REFERENCIA, no límites garantizados del mecanismo ni recorridos de servomotores. La ilustración es una vista de conjunto, no una pose numérica determinada.

SCARA: q1 se mide desde +X hacia el primer eslabón; q2 es el giro relativo del segundo respecto al primero. Se utiliza la rama q2 positiva. La orientación completa de la placa distal cambia con q1+q2, por lo que el desplazamiento lateral entre lápiz, sensor e imán debe rotarse al compensarlo.

EEZY: q1 es el giro de base desde +X; q2, la elevación del primer eslabón móvil desde la horizontal; q3, el giro relativo del codo. La elevación absoluta del antebrazo es q2+q3. Los ángulos del modelo no equivalen directamente a los comandos de servo: la librería los transforma mediante calibración y geometría de bielas.

El cálculo reproduce la cinemática directa con error numérico inferior a 1e-8 mm. Esto solo verifica las ecuaciones, no la precisión del robot.

### Diferencia con cifras previas del SCARA
El rango de codo 72° a 126° del documento anterior corresponde al alejamiento del pétalo pequeño respecto a la base, una orientación diferente de la usada aquí. Con la ecuación negativa del README y el centro en (220,0), el rango correcto es 83.4° a 146.0°. Cambiar orientación o ubicación de la curva exige recalcular ambos ángulos.

### Restricción real del EEZY
El modelo original establece q1 entre -30° y 30°, q2 entre 39° y 120°, y límites de q3 dependientes de q2:
q3_min = -0.6755 q2 - 70.768;
q3_max = -0.7165 q2 - 13.144.
La trayectoria actual requiere q2 inferior a 39° en todas las muestras: no cabe en esos límites originales.

La simulación local amplía q2 a 0°–120° y q3 a -160°–-20°. Ampliar esos números no modifica los topes físicos ni demuestra ausencia de colisión. El EEZY requiere adaptar montaje/geometría o reubicar el plano de dibujo y volver a calcular la trayectoria.

El nuevo cabezal introduce desplazamientos horizontales y verticales distintos para lápiz, sensor e imán; L4=87 mm y z=5 mm son referencias del modelo anterior. En particular, z=5 mm no representa automáticamente contacto real con el papel. Hay que medir las tres posiciones de trabajo y actualizar la cinemática antes de usar los rangos como diseño definitivo.

## Secuencia de detección y recogida
1. Elevar el cabezal y abatir el lápiz a la posición retirada; mantener el imán apagado.
2. Situar los sensores frente al objeto a la distancia de detección calibrada, con sus campos despejados del imán y la estructura.
3. Confirmar presencia mediante el capacitivo y comprobar respuesta del inductivo. Solo clasificar tras lecturas estables en una región y distancia donde ambos sensores hayan sido caracterizados.
4. Si hay presencia y no respuesta inductiva, clasificar provisionalmente como no metálico dentro de esa calibración y no activar el imán. Si no se confirma presencia, repetir aproximación; una lectura negativa sola no prueba material no metálico.
5. Si se confirma metal, guardar la clasificación, elevar y desplazar la herramienta para alinear el electroimán sobre el mismo objeto. Compensar la separación física sensor–imán con la orientación actual del brazo.
6. Bajar, activar el imán mediante etapa de potencia y realizar una elevación corta de comprobación. Solo transportar si se verifica recogida; la detección inductiva no confirma por sí misma que la pieza quedó sujeta.
7. Depositar y desactivar. Antes de otra detección, esperar la estabilización del sistema y volver a leer con el imán apagado.
8. Para dibujar: imán apagado, desplegar lápiz, ajustar contacto y ejecutar la rosa.

El capacitivo detecta tanto materiales metálicos como no metálicos; no garantiza clasificación de objetos desconocidos por sí solo. Se propone el inductivo como complemento. La clasificación depende de tamaño, distancia y material, y requiere ensayos con las piezas reales.

Un metal detectado puede no ser ferromagnético: aluminio/cobre pueden detectarse pero no levantarse con este electroimán. La secuencia de recogida presupone una pieza ferromagnética; ante falta de sujeción, detener/rechazar, sin utilizar la pinza del lápiz como garra. El sensor y el imán funcionan en una misma secuencia, sin exigir detección fiable mientras el imán está energizado.

## Pendientes de dimensionamiento
- Masa completa del cabezal más objeto de unos 70 g, par de cada articulación, retención magnética real y calentamiento de bobina.
- Soporte del servo de abatimiento con tope mecánico para que el juego del servo no determine por sí solo la posición de escritura.
- Calibración y montaje de sensores para evitar detectar permanentemente el propio núcleo, tornillos o soporte.
- Transistores/driver, protección de carga inductiva y alimentación compatibles con bobina y sensores.
- Recorridos físicos con margen, altura de objetos, evitación de colisiones y postura para abatir el lápiz.
- Criterio de precisión del 90% y ensayo experimental. No se acredita con este boceto.

## Archivos y fuentes
- scara_vertical_cotas_v3.png y brazo_vertical_cotas_v3.png: láminas finales.
- verificar_angulos_v3.py y angulos_referencia_v3.json: cálculo reproducible y resultados.
- prompts_v3_dimensiones.md: prompts de generación y correcciones.
- python/easyEEZYbotARM/kinematic_model.py: cotas, límites y convenciones originales.
- python/simular_trayectoria_eezy.py: curva, centro, altura y límites ampliados.
- README.md y mathbot_investigacion_construccion.html: geometría propuesta y requisitos.
- [ifm: sensores capacitivos y diferencia con inductivos](https://www.ifm.com/us/en/category/200_010_030).
- [ifm: alcance y respuesta de sensores inductivos](https://www.ifm.com/us/en/us/overview/inductive/technology-overview/tech-overview).

