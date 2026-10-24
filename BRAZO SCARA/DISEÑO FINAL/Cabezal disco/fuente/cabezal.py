"""
Cabezal A v3 de MathBot: CAD paramétrico (CadQuery) del cabezal de disco tri-herramienta.

Piezas impresas (funciones que devuelven un cq.Workplane en el marco del cabezal):
    separador()          separador de brida, entre la placa y el Gripper to J3 connector
    placa()              placa trébol de 6 mm con la guía inferior del plumón
    soporte_plumon()     poste del puente + cuna del micro-servo
    puente()             puente superior: guía alta del plumón y asiento del resorte
    collar()             collar que se aprieta al plumón; el brazo del servo lo levanta
    porta_iman()         separador de 25 mm con copa para el KK-P20/15
    abrazadera_sensor()  abrazadera partida M12 para el LJ12A3-4-Z/BX

Marco del cabezal: origen en el eje de J3, z = 0 en la cara SUPERIOR de la placa, +x hacia el
plumón y z hacia el brazo 2. Herramientas a 55 mm del eje en 0° / 120° / 240° como en
anatomia/cabezal/geo.mjs y simulador_scara/plantilla.html.

Medidas del robot tomadas de 'SCARA Robot 3D Model.STEP' (ver README):
    cara inferior del connector  -> cara inferior de la cubierta del brazo 2: 22.5 mm
    cara inferior del connector  -> final de carrera de J3 (cuelga bajo la cubierta): 16.5 mm
Con esas alturas el sensor, el servo y el puente del plumón de la v2 chocaban al girar J3, por eso
la placa baja DELTA = 14 mm con un separador (ver README, "Por qué v3").
"""

from __future__ import annotations

import math

import cadquery as cq
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union
from shapely import affinity

# =============================================================================================
# Parámetros
# =============================================================================================

# ---- Especificación del cabezal A (anatomia/cabezal/geo.mjs, firmware HERR[])
R_HERR = 55.0                                   # radio de las tres herramientas (mm)
PHI = {"plumon": 0.0, "iman": 120.0, "sensor": 240.0}
T_PLACA = 6.0                                   # espesor de la placa trébol
BAJO = {"plumon": 50.0, "iman": 40.0, "sensor": 38.0}   # punta bajo la cara inferior de la placa
LEVANTE = 18.0                                  # levante del plumón

# ---- Montaje a J3 (medido en el STEP del ensamble)
DELTA = 14.0          # alto del separador de brida: placa 14 mm más abajo que el connector
ALFA = 50.4           # eje largo del connector en el marco del cabezal (°): sitúa el disparo del
                      # final de carrera de J3 en φ ≈ −120° (ver verificar.py)
T_CONN = 4.5          # espesor del Gripper to J3 connector
Z_BRIDA_SUP = DELTA + T_CONN + 7.0     # cara superior de la brida del J3 Coupler (marco del cabezal)
NOMBRE_TORNILLOS = "Pernos M4 × 35 + tuercas + M3 × 35 del electroimán"
PERNOS_CONN = [(32.1, 10.4), (32.1, -10.4), (-32.1, 10.4), (-32.1, -10.4)]  # Ø4.2 al J3 Coupler
CSK_CONN = [(18.5, -1.0), (-18.5, -1.0)]      # ranuras avellanadas M3 del connector (centro)
PIN_J3_CONN = (10.33, -31.87)                 # pasador del J3 Coupler que dispara el final de carrera

# ---- Holguras de impresión FDM (boquilla 0.4)
HOLG = 0.25           # holgura radial en ajustes deslizantes
M3_PASO = 3.4         # agujero pasante M3
M3_ROSCA = 2.6        # agujero para autorroscar M3 / M2 de las orejas del servo -> 1.8
M2_GUIA = 1.8
M4_PASO = 4.5
TUERCA_M3 = (5.5 + 0.35, 2.4 + 0.4)       # entre caras, alto del alojamiento
CABEZA_M3 = 5.5 + 0.5

# ---- Piezas compradas (medidas nominales: medir las propias y ajustar)
D_PLUMON = 12.0                 # cuerpo del Sharpie fino
PLUMON = dict(punta=9.0, d_punta=6.4, nariz=6.0, d_nariz=10.0, largo=127.0)
SERVO = dict(L=22.6, W=12.2, H=22.7, oreja_span=32.5, oreja_t=2.5, oreja_z=15.9,
             agujeros=27.7, eje_off=5.9, d_boss=11.8, h_boss=4.0, spline=1.6)
HORN = dict(largo=18.0, a_cubo=6.0, a_punta=4.0, d_cubo=7.0, h_cubo=4.0, t_brazo=1.6)   # brazo simple
IMAN = dict(d=20.0, h=15.0)                               # KK-P20/15
SENSOR = dict(d=12.0, frente=3.0, rosca=43.0, d_tapa=11.0, tapa=9.0, d_prensa=6.5, prensa=5.0, d_cable=4.2)
RESORTE = dict(d_ext=16.0, alambre=0.5, libre=30.0, solido=5.0)   # Ø16 × 30, alambre 0.5 (ver README)

# ---- Módulo del plumón (z sobre la cara superior de la placa; u = x − 55 relativo al plumón)
H_COLLAR, P_COLLAR = 7.0, 4.5               # alto del collar y bolsillo del resorte (arriba)
H_OREJA = 3.0                               # la oreja de levante ocupa los 3 mm superiores del collar
U_OREJA = 3.5                               # media anchura de la oreja
SOBRECARRERA = 2.0                          # sin papel, el plumón baja 2 mm más que al trazar
U_EJE_SERVO = 14.0                          # eje del servo
Y_HORN = 12.0                               # plano medio del brazo del servo
Y_SERVO_TAPA = Y_HORN - HORN["t_brazo"] / 2 + HORN["h_cubo"] + 0.5 + SERVO["h_boss"]   # cara del eje (19.7)
H_PUENTE, P_PUENTE = 5.0, 2.5
HOLG_PLACA = 0.6                            # el brazo del servo en reposo queda 0.6 mm sobre la placa


def _brazo(th, ze):
    """Contorno del brazo del servo en el plano (u, z) para un giro th (rad, + = punta arriba)."""
    L, a0, a1 = HORN["largo"], HORN["a_cubo"] / 2, HORN["a_punta"] / 2
    c, s = math.cos(th), math.sin(th)
    return Polygon([(U_EJE_SERVO + x * c + z * s, ze - x * s + z * c) for x, z in ((0, -a0), (-L, -a1), (-L, a1), (0, a0))])


def _apoyo(th, ze):
    """Punto más alto del brazo bajo la oreja del collar (|u| ≤ U_OREJA)."""
    return _brazo(th, ze).intersection(box(-U_OREJA, -99, U_OREJA, 99)).bounds[3]


def _biseccion(f, a, b, n=60):
    fa = f(a)
    for _ in range(n):
        m = (a + b) / 2
        if (f(m) > 0) == (fa > 0):
            a, fa = m, f(m)
        else:
            b = m
    return (a + b) / 2


def _resolver_levante():
    """Altura del eje del servo y ángulos de reposo/levante del brazo.

    En reposo el punto más bajo del brazo queda HOLG_PLACA sobre la placa y la oreja del collar
    (apoyada en el brazo) deja el collar 0.6 mm sobre la placa. Al levantar, la oreja sube
    SOBRECARRERA + LEVANTE.
    """
    def th_reposo(ze):
        return _biseccion(lambda t: _brazo(t, ze).bounds[1] - HOLG_PLACA, math.radians(-85), 0.0)

    bajo_oreja = H_COLLAR - H_OREJA
    ze = _biseccion(lambda z: _apoyo(th_reposo(z), z) - bajo_oreja - 0.6, 4.0, 30.0)
    th_r = th_reposo(ze)
    c_min = _apoyo(th_r, ze) - bajo_oreja
    th_l = _biseccion(lambda t: _apoyo(t, ze) - bajo_oreja - (c_min + SOBRECARRERA + LEVANTE), th_r, math.radians(85))
    return ze, th_r, th_l, c_min


Z_EJE_SERVO, TH_REPOSO, TH_ARRIBA, C_MIN = _resolver_levante()
C_TRAZO = C_MIN + SOBRECARRERA              # cara inferior del collar al trazar
C_ARRIBA = C_TRAZO + LEVANTE                # con el plumón arriba
Z_PUENTE = max(C_ARRIBA + H_COLLAR + 0.5,                       # el collar levantado no toca el puente
               C_ARRIBA + (H_COLLAR - P_COLLAR) + RESORTE["solido"] + 1.0 - P_PUENTE)   # ni el resorte llega a sólido

# ---- Separador del electroimán y abrazadera del sensor (z bajo la placa)
Z_INF = -T_PLACA                            # cara inferior de la placa
Z_IMAN_DORSO = Z_INF - BAJO["iman"] + IMAN["h"]        # −31: dorso del electroimán
Z_SENSOR_CARA = Z_INF - BAJO["sensor"]                  # −44
H_ABRAZ = 14.0


def polar(ang_deg: float, r: float) -> tuple[float, float]:
    a = math.radians(ang_deg)
    return (r * math.cos(a), r * math.sin(a))


def rot(p, ang_deg):
    a = math.radians(ang_deg)
    return (p[0] * math.cos(a) - p[1] * math.sin(a), p[0] * math.sin(a) + p[1] * math.cos(a))


PEN = polar(PHI["plumon"], R_HERR)
MAG = polar(PHI["iman"], R_HERR)
SEN = polar(PHI["sensor"], R_HERR)
PERNOS = [rot(p, ALFA) for p in PERNOS_CONN]
CSK = [rot(p, ALFA) for p in CSK_CONN]
PIN_J3 = rot(PIN_J3_CONN, ALFA)


def en_plumon(u, y):
    """(u, y) relativo al eje del plumón -> marco del cabezal."""
    return (PEN[0] + u, PEN[1] + y)


def herr_local(nombre, r, t):
    """Punto a r (radial, hacia afuera) y t (tangencial, antihorario) del eje de una herramienta."""
    a = math.radians(PHI[nombre])
    er, et = (math.cos(a), math.sin(a)), (-math.sin(a), math.cos(a))
    c = polar(PHI[nombre], R_HERR)
    return (c[0] + r * er[0] + t * et[0], c[1] + r * er[1] + t * et[1])


# =============================================================================================
# Utilidades
# =============================================================================================

def solido(poly, z0, z1):
    """Extruye un polígono de shapely (con huecos) entre z0 y z1."""
    polys = list(poly.geoms) if poly.geom_type == "MultiPolygon" else [poly]
    out = None
    for p in polys:
        p = p.simplify(0.05)
        wp = cq.Workplane("XY", origin=(0, 0, z0)).polyline(list(p.exterior.coords)[:-1]).close()
        for ring in p.interiors:
            wp = wp.polyline(list(ring.coords)[:-1]).close()
        s = wp.extrude(z1 - z0)
        out = s if out is None else out.union(s)
    return out


def cil(x, y, z0, z1, d, n=None):
    """Cilindro vertical (o prisma de n lados) de diámetro d entre z0 y z1."""
    wp = cq.Workplane("XY", origin=(x, y, min(z0, z1)))
    wp = wp.polygon(n, d) if n else wp.circle(d / 2)
    return wp.extrude(abs(z1 - z0))


def hexa(x, y, z0, z1, ec, ang=0.0):
    """Alojamiento hexagonal de tuerca (ec = entre caras)."""
    d = ec / math.cos(math.radians(30))
    s = cq.Workplane("XY", origin=(0, 0, min(z0, z1))).polygon(6, d).extrude(abs(z1 - z0))
    return s.rotate((0, 0, 0), (0, 0, 1), ang).translate((x, y, 0))


def caja(x0, x1, y0, y1, z0, z1):
    return cq.Workplane("XY").box(x1 - x0, y1 - y0, z1 - z0, centered=False).translate((x0, y0, z0))


def cil_eje(p, eje, d, largo, centrado=True):
    """Cilindro de diámetro d a lo largo de 'eje' ('x', 'y' o vector) que pasa por p."""
    if isinstance(eje, str):
        eje = {"x": (1, 0, 0), "y": (0, 1, 0), "z": (0, 0, 1)}[eje]
    v = cq.Vector(*eje).normalized()
    base = cq.Vector(*p) - v * (largo / 2 if centrado else 0)
    return cq.Workplane(obj=cq.Solid.makeCylinder(d / 2, largo, base, v))


def suavizar(poly, r_conc=4.0, r_conv=1.5):
    """Redondea rincones cóncavos (r_conc) y esquinas convexas (r_conv)."""
    p = poly.buffer(r_conc, quad_segs=16).buffer(-r_conc, quad_segs=16)
    return p.buffer(-r_conv, quad_segs=16).buffer(r_conv, quad_segs=16)


def corbatin(off=0.0):
    """Contorno del Gripper to J3 connector en su propio marco (x' = eje largo), crecido 'off'."""
    a = math.degrees(math.asin(19.5 / 39.0))
    arco = [polar(-a + 2 * a * i / 24, 39.0) for i in range(25)]
    der = [(20.0, -11.5)] + arco + [(20.0, 11.5)]
    p = Polygon(der + [(-x, -y) for x, y in der])
    return p.buffer(off, join_style=1, quad_segs=16) if off else p


def girar(poly, ang):
    return affinity.rotate(poly, ang, origin=(0, 0))


def tira(p0, p1, ancho):
    """Rectángulo de ancho dado entre dos puntos (radios de la placa)."""
    from shapely.geometry import LineString
    return LineString([p0, p1]).buffer(ancho / 2, cap_style=2)


# =============================================================================================
# Separador de brida
# =============================================================================================

CEJAS = [box(-17.0, 11.75, -5.0, 14.0), box(5.0, 11.75, 17.0, 14.0), box(-17.0, -14.0, 17.0, -11.75)]


def separador():
    """Araña de DELTA mm bajo el connector (marco del connector, luego girada ALFA).

    Cuatro bosses de los pernos M4, dos de los tornillos avellanados M3 (tuerca cautiva por
    debajo), costillas de 2 mm y paredes en la cintura del connector que suben 1.5 mm como cejas
    piloto (holgura 0.25). La pared −y' lleva una muesca en V hacia el pasador del J3 Coupler; la
    +y' se abre en el centro para los cables que salen de la ranura del connector.
    """
    p = [Point(x, y).buffer(5.0) for x, y in PERNOS_CONN] + [Point(x, y).buffer(4.9) for x, y in CSK_CONN]
    p += [box(31.1, -10.4, 33.1, 10.4), box(-33.1, -10.4, -31.1, 10.4)]               # extremos
    p += [box(17.5, -14.0, 19.5, 14.0), box(-19.5, -14.0, -17.5, 14.0)]               # costillas en x' = ±18.5
    for (xa, ya) in CSK_CONN:
        for (xb, yb) in PERNOS_CONN:
            if xa * xb > 0:
                p.append(tira((xa, ya), (xb, yb), 2.0))
    p += CEJAS
    arana = suavizar(unary_union(p), r_conc=1.5, r_conv=0.4)
    cuerpo = solido(girar(arana, ALFA), 0, DELTA)
    cuerpo = cuerpo.union(solido(girar(unary_union(CEJAS), ALFA), DELTA - 0.01, DELTA + 1.5))
    for x, y in PERNOS:
        cuerpo = cuerpo.cut(cil(x, y, -1, DELTA + 1, M4_PASO))
    for x, y in CSK:
        cuerpo = cuerpo.cut(cil(x, y, -1, DELTA + 1, M3_PASO))
        cuerpo = cuerpo.cut(hexa(x, y, -1, 5.6, TUERCA_M3[0], ALFA))
    # muesca en V hacia el pasador del J3 Coupler (en la pared −y')
    ang_pin = math.degrees(math.atan2(PIN_J3_CONN[1], PIN_J3_CONN[0]))
    xm = 14.0 / math.tan(math.radians(-ang_pin))
    v = Polygon([(xm - 2.0, -14.5), (xm + 2.0, -14.5), (xm, -12.2)])
    cuerpo = cuerpo.cut(solido(girar(v, ALFA), -1, DELTA + 2))
    return cuerpo


# =============================================================================================
# Placa trébol
# =============================================================================================

# Huella del soporte del plumón en (u, y) relativo al plumón
SOP_PIE = [box(-13.0, -20.0, 23.5, -11.0), box(18.0, -20.0, 23.5, 25.5), box(-14.0, 16.5, 31.0, 25.5)]
SOP_TORNILLOS = [(-9.5, -15.5), (20.75, -15.5), (-11.0, 21.0), (28.0, 21.0)]
ABR_TORNILLOS = [(-4.0, 11.0), (-4.0, -11.0)]           # (r, t) del sensor
# (x, y, dirección del cable): brazo del sensor, brazo del electroimán y lado del servo
RANURAS_CINCHO = [(*herr_local("sensor", -11.0, 0.0), PHI["sensor"]), (*herr_local("iman", -24.0, 0.0), PHI["iman"]),
                  (44.0, 12.5, 0.0)]


def contorno_placa():
    piezas = [Point(0, 0).buffer(19.0)]
    for x, y in PERNOS:                                                     # cuatro rayos a los pernos M4
        piezas += [Point(x, y).buffer(6.5), tira((0, 0), (x, y), 10.0)]
    # brazo del plumón con la huella del soporte y la cuna del servo
    piezas.append(tira((0, 0), PEN, 20.0))
    piezas.append(Point(*PEN).buffer(13.0))
    piezas += [affinity.translate(b.buffer(2.0, join_style=2), *PEN) for b in SOP_PIE]
    # brazos del electroimán y del sensor (este con la huella de la abrazadera)
    piezas += [tira((0, 0), MAG, 15.0), Point(*MAG).buffer(14.0)]
    piezas += [tira((0, 0), SEN, 15.0), Point(*SEN).buffer(10.0)]
    a = PHI["sensor"]
    pie_abr = affinity.rotate(box(-8.0, -14.5, 6.0, 14.5), a, origin=(0, 0))
    piezas.append(affinity.translate(pie_abr, *SEN))
    return suavizar(unary_union(piezas), r_conc=8.0, r_conv=2.0)


def aligerados_placa():
    """Ventanas en los brazos (dejan ≥ 4 mm de material alrededor de agujeros y bordes)."""
    v = [tira((24.0, -4.5), (39.0, -4.5), 4.0), tira((34.0, 4.5), (39.0, 4.5), 4.0)]   # brazo del plumón
    # interior de la U del soporte: cuatro ventanas alrededor del buje de la guía del plumón
    u = box(-12.0, -9.5, 16.0, 14.5).difference(Point(0, 0).buffer(10.5))
    u = u.difference(box(-30, -2.0, 30, 2.0)).difference(box(-2.0, -30, 2.0, 30))
    v.append(affinity.translate(u.buffer(-1.0).buffer(1.0), *PEN))
    v.append(tira(herr_local("iman", -31.0, 0), herr_local("iman", -20.0, 0), 5.0))
    return unary_union(v)


def placa():
    p = contorno_placa().difference(aligerados_placa())
    cuerpo = solido(p, Z_INF, 0.0)
    # guía inferior del plumón: atraviesa la placa y baja 14 mm
    gx, gy = PEN
    cuerpo = cuerpo.union(cil(gx, gy, Z_INF - 14.0, Z_INF + 0.5, 19.0))
    cuerpo = cuerpo.cut(cil(gx, gy, Z_INF - 15, 1, D_PLUMON + 2 * HOLG))
    cuerpo = cuerpo.cut(cq.Workplane("XY", origin=(gx, gy, -0.8)).circle((D_PLUMON + 2 * HOLG) / 2)
                        .workplane(offset=0.81).circle((D_PLUMON + 2 * HOLG) / 2 + 0.8).loft())
    # paso central
    cuerpo = cuerpo.cut(cil(0, 0, Z_INF - 1, 1, 14.0))
    # pernos M4 al connector / J3 Coupler (cabeza bajo la placa)
    for x, y in PERNOS:
        cuerpo = cuerpo.cut(cil(x, y, Z_INF - 1, 1, M4_PASO))
    # soporte del plumón: 4 × M3 con tuerca cautiva por debajo
    for u, v in SOP_TORNILLOS:
        x, y = en_plumon(u, v)
        cuerpo = cuerpo.cut(cil(x, y, Z_INF - 1, 1, M3_PASO))
        cuerpo = cuerpo.cut(hexa(x, y, Z_INF - 1, Z_INF + TUERCA_M3[1] + 0.2, TUERCA_M3[0]))
    # electroimán: tornillo central (M3 o M4), pasador de orientación y paso de cables
    cuerpo = cuerpo.cut(cil(*MAG, Z_INF - 1, 1, M4_PASO + 0.1))
    cuerpo = cuerpo.union(cil(*herr_local("iman", 9.0, 0), Z_INF - 2.5, Z_INF + 0.1, 2.8))
    cuerpo = cuerpo.cut(cil(*herr_local("iman", -15.5, 0), Z_INF - 1, 1, 5.5))
    # sensor: paso del cuerpo M12 y dos M3 de la abrazadera
    cuerpo = cuerpo.cut(cil(*SEN, Z_INF - 1, 1, SENSOR["d"] + 0.8))
    for r, t in ABR_TORNILLOS:
        cuerpo = cuerpo.cut(cil(*herr_local("sensor", r, t), Z_INF - 1, 1, M3_PASO))
    # ranuras para cinchos (pares a ±4 mm del cable, que corre en dirección radial)
    for x, y, a in RANURAS_CINCHO:
        for t in (-4.0, 4.0):
            ran = affinity.rotate(box(-1.9, -1.0, 1.9, 1.0), a, origin=(0, 0))
            dx, dy = -t * math.sin(math.radians(a)), t * math.cos(math.radians(a))
            cuerpo = cuerpo.cut(solido(affinity.translate(ran, x + dx, y + dy), Z_INF - 1, 1))
    # flecha hacia el plumón en la cara superior (0.6 mm)
    flecha = Polygon([(30, -3), (36, 0), (30, 3), (31.5, 0)])
    cuerpo = cuerpo.cut(solido(flecha, -0.6, 1))
    return cuerpo


# =============================================================================================
# Módulo del plumón
# =============================================================================================

def _servo_ventana():
    """Ventana de la cuna en (u, z): cuerpo del servo + 0.2."""
    u0 = U_EJE_SERVO + SERVO["eje_off"] - SERVO["L"]
    return (u0 - 0.2, U_EJE_SERVO + SERVO["eje_off"] + 0.2,
            Z_EJE_SERVO - SERVO["W"] / 2 - 0.2, Z_EJE_SERVO + SERVO["W"] / 2 + 0.2)


Y_CUNA = (Y_SERVO_TAPA - 0.7, Y_SERVO_TAPA + SERVO["H"] - SERVO["oreja_z"] - SERVO["oreja_t"])   # pared de la cuna
Y_POSTE = (-18.5, -11.0)
Y_TORN_PUENTE = -14.75
H_CUNA = Z_EJE_SERVO + SERVO["W"] / 2 + 2.4


def soporte_plumon():
    """Pie en U atornillado a la placa, poste del puente (−y) y cuna del servo (+y), en PETG."""
    pie = suavizar(unary_union(SOP_PIE), r_conc=2.0, r_conv=1.5)
    s = solido(pie, 0, 3.0)
    # poste del puente con espiga arriba
    s = s.union(caja(-6.0, 6.0, *Y_POSTE, 0, Z_PUENTE))
    s = s.cut(cil(0, Y_TORN_PUENTE, 12.0, Z_PUENTE + 3, M3_PASO))
    zt = Z_PUENTE - 7.5                                                     # trampa de tuerca, entra por +x
    s = s.cut(caja(-3.5, 7.0, Y_TORN_PUENTE - TUERCA_M3[0] / 2, Y_TORN_PUENTE + TUERCA_M3[0] / 2, zt, zt + TUERCA_M3[1]))
    # cuna del servo
    u0, u1, z0, z1 = _servo_ventana()
    ua = U_EJE_SERVO + SERVO["eje_off"] - SERVO["L"] / 2 - SERVO["agujeros"] / 2     # agujeros de las orejas
    ub = ua + SERVO["agujeros"]
    pared = caja(ua - 2.4, ub + 2.4, *Y_CUNA, 0, H_CUNA)
    pared = pared.cut(caja(u0, u1, Y_CUNA[0] - 1, Y_CUNA[1] + 1, z0, z1))
    for u in (ua, ub):
        pared = pared.cut(cil_eje((u, (Y_CUNA[0] + Y_CUNA[1]) / 2, Z_EJE_SERVO), "y", M2_GUIA, 12))
    s = s.union(pared)
    # aletas antigiro de la oreja del collar
    for ua_, ub_ in ((-5.6, -4.0), (4.0, 5.6)):
        s = s.union(caja(ua_, ub_, 16.5, Y_CUNA[0] + 0.01, 0, C_ARRIBA + H_COLLAR + 0.5))
    # tornillos a la placa (cabeza arriba)
    for u, v in SOP_TORNILLOS:
        s = s.cut(cil(u, v, -1, 10, M3_PASO))
    return s.translate((PEN[0], PEN[1], 0))


def puente():
    """Anillo-guía alto del plumón con asiento del resorte; se atornilla al poste (M3 avellanado)."""
    z0, z1 = Z_PUENTE, Z_PUENTE + H_PUENTE
    p = cil(0, 0, z0, z1, 22.0).union(caja(-6.0, 6.0, Y_POSTE[0], -4.0, z0, z1))
    p = p.cut(cil(0, 0, z0 - 1, z1 + 1, D_PLUMON + 2 * HOLG))
    p = p.cut(cil(0, 0, z0 - 1, z0 + P_PUENTE, RESORTE["d_ext"] + 0.8))
    p = p.cut(cil(0, Y_TORN_PUENTE, z0 - 1, z1 + 1, M3_PASO))
    p = p.cut(cq.Workplane("XY", origin=(0, Y_TORN_PUENTE, z1 - 1.75)).circle(1.7)
              .workplane(offset=1.76).circle(3.45).loft())                   # avellanado M3
    return p.translate((PEN[0], PEN[1], 0))


def collar(c=C_TRAZO):
    """Collar partido que se aprieta al plumón (M3 × 12 + tuerca) con oreja de levante hacia +y."""
    z0 = c
    k = cil(0, 0, z0, z0 + H_COLLAR, 20.0)
    k = k.union(caja(9.0, 16.5, -5.5, 5.5, z0, z0 + H_COLLAR))              # orejas de apriete
    k = k.union(caja(-U_OREJA, U_OREJA, 8.0, 17.6, z0 + H_COLLAR - H_OREJA, z0 + H_COLLAR))   # oreja de levante
    k = k.cut(cil(0, 0, z0 - 1, z0 + H_COLLAR + 1, D_PLUMON + 0.2))
    k = k.cut(cil(0, 0, z0 + H_COLLAR - P_COLLAR, z0 + H_COLLAR + 1, RESORTE["d_ext"] + 0.8))
    k = k.cut(caja(4.0, 17.0, -0.6, 0.6, z0 - 1, z0 + H_COLLAR + 1))         # ranura
    k = k.cut(cil_eje((12.75, 0, z0 + H_COLLAR / 2), "y", M3_PASO, 14))
    k = k.cut(hexa(0, 0, -0.1, TUERCA_M3[1], TUERCA_M3[0], 0).rotate((0, 0, 0), (1, 0, 0), 90)
              .translate((12.75, 5.5, z0 + H_COLLAR / 2)))
    return k.translate((PEN[0], PEN[1], 0))


# =============================================================================================
# Electroimán y sensor
# =============================================================================================

def porta_iman():
    """Columna de 25 mm (placa -> dorso del KK-P20/15) con copa de 6 mm que centra el electroimán."""
    zb = Z_IMAN_DORSO
    k = cil(0, 0, Z_INF - 3.0, Z_INF, 24.0)                                  # brida
    k = k.union(cil(0, 0, zb + 2.0, Z_INF - 3.0 + 0.01, 14.0))               # columna
    k = k.union(cil(0, 0, zb - 6.0, zb + 2.0, IMAN["d"] + 4.0))              # copa
    k = k.union(cq.Workplane("XY", origin=(0, 0, zb + 2.0)).circle((IMAN["d"] + 4.0) / 2)
                .workplane(offset=5.5).circle(7.0).loft())                   # chaflán copa -> columna (42°)
    k = k.union(cq.Workplane("XY", origin=(0, 0, Z_INF - 7.0)).circle(7.0)
                .workplane(offset=4.0).circle(12.0).loft())                  # chaflán columna -> brida
    k = k.cut(cil(0, 0, zb - 7, zb, IMAN["d"] + 0.4))                        # bolsillo del imán
    k = k.cut(cil(0, 0, zb - 1, Z_INF + 1, M4_PASO + 0.1))                   # tornillo M3 o M4
    k = k.cut(cil(9.0, 0, Z_INF - 3.5, Z_INF + 1, 3.2))                      # pasador de la placa
    # paso de cables: riñón en el fondo + ranura en la pared + canal por la columna hacia el eje
    rin = Point(0, 0).buffer(9.5).difference(Point(0, 0).buffer(4.5))
    rin = rin.intersection(Polygon([(0, 0), (-20, -14), (-20, 14)]))
    k = k.cut(solido(rin, zb - 1, zb + 2.5))
    k = k.cut(caja(-13.0, -8.0, -2.0, 2.0, zb - 7, zb + 2.5))
    k = k.cut(caja(-8.5, -5.0, -1.9, 1.9, zb + 0.5, Z_INF + 1))
    k = k.cut(caja(-13.0, -5.0, -1.9, 1.9, Z_INF - 3.5, Z_INF + 1))
    # orientar: +x local = radial hacia afuera
    return k.rotate((0, 0, 0), (0, 0, 1), PHI["iman"]).translate((MAG[0], MAG[1], 0))


def abrazadera_sensor():
    """Abrazadera partida bajo la placa: el LJ12A3 se desliza y se aprieta con un M3 tangencial."""
    z0, z1 = Z_INF - H_ABRAZ, Z_INF
    huella = unary_union([box(-10.0, -15.0, 6.0, 15.0), box(0.0, -10.0, 16.0, 10.0)])
    k = solido(suavizar(huella, 2.0, 2.5), z0, z1)
    k = k.cut(cil(0, 0, z0 - 1, z1 + 1, SENSOR["d"] + 0.3))
    k = k.cut(caja(5.0, 17.0, -0.75, 0.75, z0 - 1, z1 + 1))                   # ranura de apriete
    zc = (z0 + z1) / 2
    k = k.cut(cil_eje((11.0, 0, zc), "y", M3_PASO, 24))
    k = k.cut(hexa(0, 0, -TUERCA_M3[1] - 0.1, 0.1, TUERCA_M3[0], 0).rotate((0, 0, 0), (1, 0, 0), 90).translate((11.0, -10.0, zc)))
    k = k.cut(cil_eje((11.0, 10.0 + 1.0, zc), "y", CABEZA_M3, 4.0))
    for r, t in ABR_TORNILLOS:
        k = k.cut(cil(r, t, z0 - 1, z1 + 1, M3_PASO))
        k = k.cut(hexa(r, t, z0 - 1, z0 + TUERCA_M3[1] + 0.3, TUERCA_M3[0], 90))
    return k.rotate((0, 0, 0), (0, 0, 1), PHI["sensor"]).translate((SEN[0], SEN[1], 0))


# =============================================================================================
# Piezas compradas (modelos de referencia, simplificados)
# =============================================================================================

def plumon(desp=0.0):
    """Sharpie fino sin tapa. desp: levante sobre la posición de trazo (0..LEVANTE)."""
    z = Z_INF - BAJO["plumon"] + desp
    p = cq.Workplane("XY", origin=(0, 0, z)).circle(0.6).workplane(offset=PLUMON["punta"]) \
        .circle(PLUMON["d_punta"] / 2).loft()
    p = p.union(cil(0, 0, z + PLUMON["punta"] - 0.01, z + PLUMON["punta"] + PLUMON["nariz"], PLUMON["d_nariz"]))
    zc = z + PLUMON["punta"] + PLUMON["nariz"] - 0.01
    p = p.union(cil(0, 0, zc, z + PLUMON["largo"], D_PLUMON))
    return p.translate((PEN[0], PEN[1], 0))


def servo():
    """SG90 / MG90S acostado: eje horizontal hacia −y, cuerpo en +y."""
    u0 = U_EJE_SERVO + SERVO["eje_off"] - SERVO["L"]
    y0, y1 = Y_SERVO_TAPA, Y_SERVO_TAPA + SERVO["H"]
    zc = Z_EJE_SERVO
    s = caja(u0, u0 + SERVO["L"], y0, y1, zc - SERVO["W"] / 2, zc + SERVO["W"] / 2)
    yo = y1 - SERVO["oreja_z"] - SERVO["oreja_t"]
    um = u0 + SERVO["L"] / 2
    s = s.union(caja(um - SERVO["oreja_span"] / 2, um + SERVO["oreja_span"] / 2, yo, yo + SERVO["oreja_t"],
                     zc - SERVO["W"] / 2, zc + SERVO["W"] / 2))
    s = s.union(cil_eje((U_EJE_SERVO, y0 - SERVO["h_boss"] / 2, zc), "y", SERVO["d_boss"], SERVO["h_boss"]))
    return s.translate((PEN[0], PEN[1], 0))


def angulo_horn(desp):
    """Giro del brazo (rad) con el plumón levantado 'desp' mm sobre la altura de trazo.

    A la altura de trazo (desp = 0) el brazo está en reposo, SOBRECARRERA bajo la oreja del collar.
    """
    if desp <= 0:
        return TH_REPOSO
    meta = C_TRAZO + desp + H_COLLAR - H_OREJA
    return _biseccion(lambda t: _apoyo(t, Z_EJE_SERVO) - meta, TH_REPOSO, TH_ARRIBA + 0.2)


def horn(desp=0.0):
    """Brazo simple del servo en el plano y = Y_HORN, apuntando hacia −x (hacia el plumón)."""
    th = angulo_horn(desp)
    L, a0, a1, t = HORN["largo"], HORN["a_cubo"] / 2, HORN["a_punta"] / 2, HORN["t_brazo"]
    cubo = cil_eje((0, Y_HORN - t / 2 + HORN["h_cubo"] / 2, 0), "y", HORN["d_cubo"], HORN["h_cubo"])
    brazo = cq.Workplane("XZ", origin=(0, Y_HORN + t / 2, 0)) \
        .polyline([(0, -a0), (-L, -a1), (-L, a1), (0, a0)]).close().extrude(t)
    h = cubo.union(brazo)
    h = h.rotate((0, 0, 0), (0, 1, 0), math.degrees(th))     # giro en el plano x-z, + = punta arriba
    return h.translate((PEN[0] + U_EJE_SERVO, PEN[1], Z_EJE_SERVO))


def resorte(c=C_TRAZO, helice=False):
    """Resorte del plumón entre el collar y el puente (tubo, o hélice para el ensamble)."""
    z0 = c + H_COLLAR - P_COLLAR
    z1 = Z_PUENTE + P_PUENTE
    ro, ri = RESORTE["d_ext"] / 2, RESORTE["d_ext"] / 2 - RESORTE["alambre"]
    if not helice:
        r = cil(0, 0, z0, z1, 2 * ro).cut(cil(0, 0, z0 - 1, z1 + 1, 2 * ri))
        return r.translate((PEN[0], PEN[1], 0))
    rm = (ro + ri) / 2
    vueltas = 8
    paso = (z1 - z0 - RESORTE["alambre"]) / vueltas
    hel = cq.Wire.makeHelix(paso, z1 - z0 - RESORTE["alambre"], rm)
    perfil = cq.Workplane("XZ", origin=(rm, 0, 0)).circle(RESORTE["alambre"] / 2)
    sw = perfil.sweep(cq.Workplane(obj=hel), isFrenet=True)
    return sw.translate((PEN[0], PEN[1], z0 + RESORTE["alambre"] / 2))


def electroiman():
    zb = Z_IMAN_DORSO
    m = cil(0, 0, zb - IMAN["h"], zb, IMAN["d"])
    m = m.cut(cil(0, 0, zb - IMAN["h"] - 0.1, zb - IMAN["h"] + 0.4, 9.0)).union(
        cil(0, 0, zb - IMAN["h"], zb - IMAN["h"] + 0.4, 6.0))
    return m.translate((MAG[0], MAG[1], 0))


def sensor_lj12(cable=True):
    """LJ12A3-4-Z/BX de 60 mm (cara, rosca 43, tapa con LED, prensaestopa) y curva del cable."""
    z = Z_SENSOR_CARA
    s = cil(0, 0, z, z + SENSOR["frente"], 11.8)
    z += SENSOR["frente"]
    s = s.union(cil(0, 0, z - 0.01, z + SENSOR["rosca"], SENSOR["d"]))
    z += SENSOR["rosca"]
    s = s.union(cil(0, 0, z - 0.01, z + SENSOR["tapa"], SENSOR["d_tapa"]))
    z += SENSOR["tapa"]
    s = s.union(cil(0, 0, z - 0.01, z + SENSOR["prensa"], SENSOR["d_prensa"]))
    z += SENSOR["prensa"]
    if cable:   # curva de radio 6 hacia el eje de J3 y 6 mm horizontales (cadena de cilindros)
        rb, dc = 6.0, SENSOR["d_cable"]
        pts = [(-rb + rb * math.cos(math.radians(a)), z + rb * math.sin(math.radians(a))) for a in range(0, 91, 15)]
        pts.append((-rb - 6.0, z + rb))
        for (x0, z0), (x1, z1) in zip(pts[:-1], pts[1:]):
            seg = cq.Solid.makeCylinder(dc / 2, math.hypot(x1 - x0, z1 - z0), cq.Vector(x0, 0, z0), cq.Vector(x1 - x0, 0, z1 - z0))
            s = s.union(cq.Workplane(obj=seg)).union(cq.Workplane(obj=cq.Solid.makeSphere(dc / 2, cq.Vector(x1, 0, z1))))
    return s.rotate((0, 0, 0), (0, 0, 1), PHI["sensor"]).translate((SEN[0], SEN[1], 0))


def tornillo(x, y, z_cabeza, largo, d=4.0, d_cab=7.0, h_cab=4.0, hacia_arriba=True):
    """Tornillo Allen de cabeza cilíndrica (cabeza abajo y vástago hacia arriba por defecto)."""
    s = 1 if hacia_arriba else -1
    cab = cil(x, y, z_cabeza - s * h_cab, z_cabeza, d_cab)
    vas = cil(x, y, z_cabeza, z_cabeza + s * largo, d)
    return cab.union(vas)


def tuerca(x, y, z0, alto, ec):
    return hexa(x, y, z0, z0 + alto, ec)


# =============================================================================================
# Conjunto
# =============================================================================================

IMPRESAS = {
    "separador": dict(fn=separador, nombre="Separador de brida", material="PETG", color=(0.18, 0.42, 0.71)),
    "placa": dict(fn=placa, nombre="Placa trébol", material="PETG", color=(0.93, 0.62, 0.20)),
    "soporte": dict(fn=soporte_plumon, nombre="Soporte del plumón y del servo", material="PETG", color=(0.20, 0.55, 0.45)),
    "puente": dict(fn=puente, nombre="Puente del plumón", material="PETG", color=(0.20, 0.55, 0.45)),
    "collar": dict(fn=collar, nombre="Collar del plumón", material="PETG", color=(0.85, 0.30, 0.30)),
    "porta_iman": dict(fn=porta_iman, nombre="Separador del electroimán", material="PLA+", color=(0.55, 0.45, 0.75)),
    "abrazadera": dict(fn=abrazadera_sensor, nombre="Abrazadera M12 del sensor", material="PLA+", color=(0.55, 0.45, 0.75)),
}

# Orientación de impresión: (eje, ángulo) aplicados antes de apoyar la pieza en z = 0
ORIENT_IMPRESION = {
    "separador": None,                     # cara del connector arriba, aligerado contra la cama
    "placa": ((1, 0, 0), 180),             # cara superior contra la cama, guía del plumón hacia arriba
    "soporte": None,
    "puente": ((1, 0, 0), 180),            # bolsillo del resorte hacia arriba
    "collar": ((1, 0, 0), 180),            # oreja de levante contra la cama
    "porta_iman": ((1, 0, 0), 180),        # brida contra la cama, copa hacia arriba
    "abrazadera": ((1, 0, 0), 180),        # cara de la placa contra la cama
}


def a_cama(nombre, wp):
    """Lleva una pieza a su orientación de impresión, centrada en x-y y apoyada en z = 0."""
    o = ORIENT_IMPRESION[nombre]
    s = wp.val() if isinstance(wp, cq.Workplane) else wp
    if o:
        s = s.rotate(cq.Vector(0, 0, 0), cq.Vector(*o[0]), o[1])
    bb = s.BoundingBox()
    return s.translate(cq.Vector(-(bb.xmin + bb.xmax) / 2, -(bb.ymin + bb.ymax) / 2, -bb.zmin))


def compradas(desp=0.0, helice=False):
    """Modelos de referencia de lo comprado, con el plumón levantado 'desp' mm."""
    c = C_TRAZO + desp
    out = {
        "plumon": (plumon(desp), "Plumón Sharpie fino", (0.10, 0.10, 0.12)),
        "servo": (servo(), "Micro servo SG90 / MG90S", (0.15, 0.35, 0.80)),
        "horn": (horn(desp), "Brazo simple del servo", (0.95, 0.95, 0.95)),
        "resorte": (resorte(c, helice), "Resorte Ø16 × 30", (0.75, 0.75, 0.78)),
        "electroiman": (electroiman(), "Electroimán KK-P20/15", (0.45, 0.47, 0.50)),
        "sensor": (sensor_lj12(), "Sensor inductivo LJ12A3-4-Z/BX", (0.80, 0.72, 0.40)),
    }
    torn = None
    for x, y in PERNOS:
        # M4 × 35 desde abajo con arandela bajo la cabeza; tuerca normal (3.2) con fijador de rosca sobre la
        # brida del J3 Coupler, sin arandela: el final de carrera de J3 cuelga 5 mm sobre la brida
        t = tornillo(x, y, Z_INF - 0.8, 35.0).union(cil(x, y, Z_INF - 0.8, Z_INF, 9.0))
        t = t.union(tuerca(x, y, Z_BRIDA_SUP, 3.2, 7.0))
        torn = t if torn is None else torn.union(t)
    t2 = tornillo(*MAG, 0.0, 35.0, d=3.0, d_cab=5.5, h_cab=3.0, hacia_arriba=False)
    torn = torn.union(t2)
    out["tornillos_m4"] = (torn, NOMBRE_TORNILLOS, (0.30, 0.30, 0.32))
    return out


def impresas(desp=0.0):
    out = {}
    for k, v in IMPRESAS.items():
        out[k] = (collar(C_TRAZO + desp) if k == "collar" else v["fn"](), v["nombre"], v["color"])
    return out
