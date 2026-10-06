"""
Modelo cinematico del SCARA MathBot (basado en el SCARA de HowToMechatronics).

Geometria medida directamente de las STL de `BRAZO SCARA/.../STL Files - updated`:
  - Eje J1 -> eje J2 : L1 = 228 mm  (Arm 1: agujero de rodamiento a 166 mm del
    borde que se atornilla a la plataforma Z, que esta a 62 mm del eje J1)
  - Eje J2 -> eje J3 : L2 = 144 mm  (Arm 2: centros de agujero a 39 y 183 mm)
    OJO: el codigo Arduino original usa L2 = 136.5 mm; las STL "updated" miden
    144 mm entre ejes. Usar 144 en el firmware si se imprimen estas STL.

Cabezal propuesto (reemplaza la pinza): disco tri-herramienta montado en J3.
  - Plumon/lapiz   a phi =   0 deg, radio 55 mm (hacia adelante de Arm 2)
  - Electroiman    a phi = 120 deg, radio 45 mm
  - Sensor induct. a phi = 240 deg, radio 45 mm
Con J3 fijo (phi = 0) al dibujar, el plumon se comporta como si Arm 2 midiera
L2 + 55 = 199 mm: eslabones mas balanceados (228 / 199) y J3 no se mueve
durante el trazo.

Convenciones (marco del robot, mm, grados):
  x hacia adelante, y a la izquierda, z hacia arriba, origen = eje J1 sobre la mesa.
  theta1: angulo del brazo 1 desde +x.  theta2: angulo relativo del brazo 2.
  phi: angulo relativo del cabezal (J3).  psi = theta1 + theta2 + phi.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

# ---------------------------------------------------------------------------
# Geometria del robot (STL) y transmisiones (articulo HowToMechatronics)
# ---------------------------------------------------------------------------
L1_MM = 228.0
L2_MM = 144.0

# Reducciones y resolucion (NEMA 17, 200 pasos/rev, 1/4 de micropaso)
PASOS_REV = 200 * 4
RED_J1 = 20.0  # 2 etapas GT2
RED_J2 = 16.0  # 2 etapas GT2
RED_J3 = 4.5  # 1 etapa GT2: 90/20 (phiAngleToSteps = 10 en el codigo de HTM)
PASO_TORNILLO_MM = 8.0  # tornillo T8, avance 8 mm/rev

PASOS_GRADO_J1 = PASOS_REV * RED_J1 / 360.0  # 44.44
PASOS_GRADO_J2 = PASOS_REV * RED_J2 / 360.0  # 35.56
PASOS_GRADO_J3 = PASOS_REV * RED_J3 / 360.0  # 10
PASOS_MM_Z = PASOS_REV / PASO_TORNILLO_MM  # 100

# Limites articulares (cables / finales de carrera del diseno original)
TH1_LIM = (-150.0, 150.0)
TH2_LIM = (-150.0, 150.0)

# ---------------------------------------------------------------------------
# Pila vertical (alturas de las piezas STL, mm). z = 0 es la mesa.
# ---------------------------------------------------------------------------
H_BASE = 45.0  # Base.STL
H_J1_COUPLER = 27.0  # J1 coupler.STL (gira con J1)
H_PLACA_INF = 10.0  # Z-axis Bottom Plate.STL
H_PLACA_SUP = 26.0  # Z-axis Top Plate.STL
H_TAPA_INF = 21.5  # Base cover.STL (sobre la placa inferior)
H_TAPA_SUP = 23.0  # Top cover.STL (bajo la placa superior)
H_PLATAFORMA = 45.0  # Z-axis Mount Platform.STL (desliza en 4 varillas)
H_ARM1 = 42.0
H_J2_COUPLER = 24.0
H_ARM2 = 31.0
H_J3_COUPLER = 22.0
H_CONECTOR = 4.5  # Gripper to J3 connector.STL -> brida del cabezal
LARGO_VARILLA_ORIGINAL = 400.0

Z_VARILLA_INF = H_BASE + H_J1_COUPLER  # donde arrancan las varillas (72)


@dataclass
class Herramienta:
    nombre: str
    phi_deg: float  # posicion angular en el cabezal
    radio_mm: float  # distancia al eje J3
    bajo_cabezal_mm: float  # cuanto sobresale bajo la placa del cabezal


@dataclass
class Cabezal:
    espesor_placa: float = 6.0
    pluma: Herramienta = field(default_factory=lambda: Herramienta("Plumon", 0.0, 55.0, 50.0))
    iman: Herramienta = field(default_factory=lambda: Herramienta("Electroiman", 120.0, 45.0, 40.0))
    sensor: Herramienta = field(
        default_factory=lambda: Herramienta("Sensor inductivo", 240.0, 45.0, 38.0)
    )
    levante_pluma: float = 18.0  # carrera del micro-servo que sube la pluma

    def herramientas(self):
        return [self.pluma, self.iman, self.sensor]


def caida_brida_desde_plataforma() -> float:
    """Distancia vertical (mm) desde la base de la plataforma Z hasta la brida del cabezal."""
    # Arm1 alineado con el tope de la plataforma; J2 coupler, Arm2, J3 coupler y
    # conector cuelgan debajo.
    arm1_inf = H_PLATAFORMA - H_ARM1
    return -(arm1_inf - H_J2_COUPLER - H_ARM2 - H_J3_COUPLER - H_CONECTOR)


def z_plataforma_para_punta(z_punta: float, herr: Herramienta, cab: Cabezal) -> float:
    """Altura de la base de la plataforma Z para que la punta de `herr` quede en z_punta."""
    return z_punta + caida_brida_desde_plataforma() + cab.espesor_placa + herr.bajo_cabezal_mm


def carrera_z(largo_varilla: float) -> tuple[float, float]:
    """Rango [min, max] de la base de la plataforma para un largo de varilla dado."""
    # Las tapas (Base cover / Top cover) ocultan abrazaderas y limitan la carrera
    z_min = Z_VARILLA_INF + H_PLACA_INF + H_TAPA_INF
    z_max = Z_VARILLA_INF + largo_varilla - H_PLACA_SUP - H_TAPA_SUP - H_PLATAFORMA
    return z_min, z_max


# ---------------------------------------------------------------------------
# Cinematica
# ---------------------------------------------------------------------------
def fk(th1, th2, phi=0.0, herr: Herramienta | None = None, l1=L1_MM, l2=L2_MM):
    """Cinematica directa. Devuelve J2, J3 y punta de herramienta (x, y)."""
    t1 = np.deg2rad(th1)
    t12 = np.deg2rad(np.asarray(th1) + np.asarray(th2))
    j2 = np.stack([l1 * np.cos(t1), l1 * np.sin(t1)], -1)
    j3 = j2 + np.stack([l2 * np.cos(t12), l2 * np.sin(t12)], -1)
    if herr is None:
        return j2, j3, j3
    psi = np.deg2rad(np.asarray(th1) + np.asarray(th2) + np.asarray(phi) + herr.phi_deg)
    tip = j3 + herr.radio_mm * np.stack([np.cos(psi), np.sin(psi)], -1)
    return j2, j3, tip


def ik_muneca(x, y, codo: int = -1, l1=L1_MM, l2=L2_MM):
    """IK del punto J3 (muneca). codo=-1 -> theta2 negativo. Devuelve grados."""
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    c2 = (x**2 + y**2 - l1**2 - l2**2) / (2 * l1 * l2)
    if np.any(np.abs(c2) > 1):
        raise ValueError("Punto fuera del alcance")
    th2 = codo * np.arccos(c2)
    th1 = np.arctan2(y, x) - np.arctan2(l2 * np.sin(th2), l1 + l2 * np.cos(th2))
    return np.rad2deg(th1), np.rad2deg(th2)


def ik_herramienta(x, y, herr: Herramienta, phi=0.0, codo: int = -1):
    """
    IK para la punta de una herramienta del cabezal con J3 relativo fijo = phi.

    Con phi constante la herramienta queda rigida respecto a Arm 2: es un eslabon
    equivalente de largo Le y angulo de desfase beta. Se resuelve como 2R con Le.
    """
    a = np.deg2rad(herr.phi_deg + phi)
    ex = L2_MM + herr.radio_mm * np.cos(a)
    ey = herr.radio_mm * np.sin(a)
    le = np.hypot(ex, ey)
    beta = np.rad2deg(np.arctan2(ey, ex))
    th1, th2e = ik_muneca(x, y, codo, l2=le)
    return th1, th2e - beta, np.full_like(np.asarray(th1, float), phi)


def jacobiano(th1, th2, l1=L1_MM, l2=L2_MM):
    """Jacobiano 2x2 (mm/rad) de la punta respecto a (theta1, theta2)."""
    t1 = np.deg2rad(th1)
    t12 = np.deg2rad(np.asarray(th1) + np.asarray(th2))
    s1, c1, s12, c12 = np.sin(t1), np.cos(t1), np.sin(t12), np.cos(t12)
    j = np.empty(np.shape(t1) + (2, 2))
    j[..., 0, 0] = -l1 * s1 - l2 * s12
    j[..., 0, 1] = -l2 * s12
    j[..., 1, 0] = l1 * c1 + l2 * c12
    j[..., 1, 1] = l2 * c12
    return j


def largo_equivalente(herr: Herramienta, phi=0.0):
    a = np.deg2rad(herr.phi_deg + phi)
    ex = L2_MM + herr.radio_mm * np.cos(a)
    ey = herr.radio_mm * np.sin(a)
    return float(np.hypot(ex, ey)), float(np.rad2deg(np.arctan2(ey, ex)))


# ---------------------------------------------------------------------------
# Trayectoria MathBot: rosa de 3 petalos (misma ecuacion del Avance 1)
# ---------------------------------------------------------------------------
A_MM = 102.9
K_STRETCH = 1.3552
T0, T1 = 5 * np.pi / 6, 11 * np.pi / 6

# Colocacion optimizada (barrido de D y alfa minimizando el numero de condicion
# con |theta2| <= 140 deg y la curva a >= 140 mm del eje J1 para no chocar con la base)
CENTRO_ROSA = (185.0, 0.0)
ALFA_ROSA_DEG = 180.0
CODO = -1


def rosa_local(t):
    x = -A_MM * np.cos(3 * t) * np.cos(t)
    y = -A_MM * K_STRETCH * np.cos(3 * t) * np.sin(t)
    return x, y


def rosa_en_robot(t, centro=CENTRO_ROSA, alfa_deg=ALFA_ROSA_DEG):
    x, y = rosa_local(t)
    a = np.deg2rad(alfa_deg)
    xr = np.cos(a) * x - np.sin(a) * y + centro[0]
    yr = np.sin(a) * x + np.cos(a) * y + centro[1]
    return xr, yr


def rosa_por_arco(v_mm_s: float = 25.0, dt: float = 0.02, n_fino: int = 6000):
    """Muestrea la rosa a velocidad de punta constante (reparametrizacion por arco)."""
    tf = np.linspace(T0, T1, n_fino)
    x, y = rosa_en_robot(tf)
    s = np.concatenate([[0], np.cumsum(np.hypot(np.diff(x), np.diff(y)))])
    total = s[-1]
    tiempo = np.arange(0, total / v_mm_s + dt, dt)
    s_obj = np.minimum(tiempo * v_mm_s, total)
    t_par = np.interp(s_obj, s, tf)
    xs, ys = rosa_en_robot(t_par)
    return tiempo, t_par, xs, ys, total


def optimizar_colocacion(herr: Herramienta, th2_max=140.0, r_min=140.0):
    """Barrido de distancia D y giro alfa. Devuelve lista ordenada por condicion."""
    le, _ = largo_equivalente(herr)
    t = np.linspace(T0, T1, 800)
    x0, y0 = rosa_local(t)
    res = []
    for alfa in range(0, 360, 15):
        a = np.deg2rad(alfa)
        xr = np.cos(a) * x0 - np.sin(a) * y0
        yr = np.sin(a) * x0 + np.cos(a) * y0
        for d in range(120, 340, 5):
            x, y = xr + d, yr
            r = np.hypot(x, y)
            if r.min() < r_min or r.max() > L1_MM + le - 5:
                continue
            try:
                th1, th2 = ik_muneca(x, y, CODO, l2=le)
            except ValueError:
                continue
            if np.abs(th2).max() > th2_max:
                continue
            sv = np.linalg.svd(jacobiano(th1, th2, l2=le), compute_uv=False)
            res.append((float((sv[:, 0] / sv[:, 1]).max()), alfa, d, float(sv[:, 0].max())))
    res.sort()
    return res
