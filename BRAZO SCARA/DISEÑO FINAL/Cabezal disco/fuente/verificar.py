"""
Comprobaciones del cabezal A v3 contra el ensamble de HTM y la misión del simulador.

    python verificar.py

1. Ajuste estático: piezas del cabezal entre sí y contra lo que gira con J3 (J3 Coupler, polea de 90,
   Gripper to J3 connector).
2. Barrido de J3 (φ de −125° a +125°, plumón abajo y arriba): holgura mínima de cada pieza contra lo
   que no gira con J3 (Arm 2, Arm 2 Cover, final de carrera de J3, NEMA de J3).
3. Homing de J3: φ al que el pasador del J3 Coupler toca el final de carrera.
4. Misión del simulador (simulador_scara/plantilla.html, buildTimeline, modo 'mision'): holgura de
   cada pieza sobre la mesa, las piezas y la bandeja, y distancia a la columna; alturas Z.
5. Masa y centro de masa.

Escribe ../verificacion.json y ../img/holguras_j3.png.
"""

from __future__ import annotations

import json
import math
import os
import sys

import fcl
import numpy as np
import trimesh

import cabezal as C
import construir as K

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = K.RAIZ
CACHE = os.path.join(AQUI, "_cache_htm")

# Piezas del STEP de HTM que interesan (nombre de producto -> grupo)
FIJAS = {"Arm 2_Arm 2": "Arm 2", "Arm 2 Cover_Arm 2 Cover": "Arm 2 Cover",
         "NEMA 17 Stepper L24mm - 20mm shaft_NEMA 17 Stepper L24mm - 20mm shaft": "NEMA de J3"}
GIRAN = {"J3 Coupler_J3 Coupler": "J3 Coupler", "GT2 Pulley - 90 teeth - J3_GT2 Pulley - Parametric": "Polea 90 J3",
         "Gripper to J3 connector_Gripper to J3 connector": "Gripper to J3 connector"}
CENTRO_FINAL_J3 = (327.5, -2.9)    # el micro switch que está junto a J3 (hay cuatro en el STEP)


# ---------------------------------------------------------------------------------------------
# Piezas de HTM (se leen una vez del STEP y se guardan como STL en _cache_htm)
# ---------------------------------------------------------------------------------------------

def _leer_htm():
    import cadquery as cq
    from OCP.STEPCAFControl import STEPCAFControl_Reader
    from OCP.TDocStd import TDocStd_Document
    from OCP.TCollection import TCollection_ExtendedString
    from OCP.XCAFDoc import XCAFDoc_DocumentTool
    from OCP.TDF import TDF_LabelSequence, TDF_Label
    from OCP.TDataStd import TDataStd_Name
    from OCP.TopLoc import TopLoc_Location

    doc = TDocStd_Document(TCollection_ExtendedString("doc"))
    r = STEPCAFControl_Reader()
    r.SetNameMode(True)
    r.ReadFile(K.STEP_HTM)
    r.Transfer(doc)
    st = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())

    def nombre(l):
        n = TDataStd_Name()
        return n.Get().ToExtString() if l.FindAttribute(TDataStd_Name.GetID_s(), n) else ""

    out = []

    def rec(l, loc):
        if st.IsReference_s(l):
            ref = TDF_Label()
            st.GetReferredShape_s(l, ref)
            loc, l = loc.Multiplied(st.GetLocation_s(l)), ref
        n = nombre(l)
        if st.IsAssembly_s(l):
            comps = TDF_LabelSequence()
            st.GetComponents_s(l, comps)
            for i in range(1, comps.Length() + 1):
                rec(comps.Value(i), loc)
            return
        s = cq.Shape.cast(st.GetShape_s(l).Moved(loc))
        if n in FIJAS or n in GIRAN:
            out.append((FIJAS.get(n) or GIRAN.get(n), n in GIRAN, s))
        elif n.startswith("Micro switch"):
            c = s.Center()
            if math.hypot(c.x - CENTRO_FINAL_J3[0], c.y - CENTRO_FINAL_J3[1]) < 15:
                out.append(("Final de carrera J3", False, s))

    roots = TDF_LabelSequence()
    st.GetFreeShapes(roots)
    for i in range(1, roots.Length() + 1):
        rec(roots.Value(i), TopLoc_Location())
    return out


def _trsf_a_marco(gira):
    """gp_Trsf mundo (STEP) -> marco del brazo 2 (origen en el eje de J3, z = 0 en la cara superior de
    la placa, x de J2 hacia J3). Si la pieza gira con J3, además deshace la φ del STEP (marco del cabezal)."""
    from OCP.gp import gp_Ax1, gp_Dir, gp_Pnt, gp_Trsf, gp_Vec
    t = gp_Trsf()
    t.SetTranslation(gp_Vec(-K.EJE_J3[0], -K.EJE_J3[1], -(K.Z_CONN_INF - C.DELTA)))
    r = gp_Trsf()
    r.SetRotation(gp_Ax1(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1)), math.radians(-K.ANG_BRAZO2 - (K.phi_en_step() if gira else 0.0)))
    return r.Multiplied(t)


def piezas_htm():
    """{nombre: (gira_con_J3, cq.Shape)}: las que giran con J3 en el marco del cabezal (φ = 0) y las
    fijas en el marco del brazo 2. Se leen del STEP una vez y se guardan como BREP en _cache_htm."""
    import cadquery as cq
    from OCP.BRep import BRep_Builder
    from OCP.BRepTools import BRepTools
    from OCP.TopoDS import TopoDS_Shape
    os.makedirs(CACHE, exist_ok=True)
    idx = os.path.join(CACHE, "indice.json")
    if not os.path.exists(idx):
        datos = []
        for i, (n, gira, s) in enumerate(_leer_htm()):
            f = os.path.join(CACHE, f"p{i:02d}.brep")
            BRepTools.Write_s(s.wrapped, f)
            datos.append((n, gira, f))
        with open(idx, "w", encoding="utf-8") as fh:
            json.dump(datos, fh)
    out = {}
    with open(idx, encoding="utf-8") as fh:
        for n, gira, f in json.load(fh):
            sh = TopoDS_Shape()
            BRepTools.Read_s(sh, f, BRep_Builder())
            s = cq.Shape.cast(sh).transformShape(cq.Matrix(_trsf_a_marco(gira)))
            out[n if n not in out else n + " 2"] = (gira, s)
    return out


# ---------------------------------------------------------------------------------------------
# Mallas del cabezal
# ---------------------------------------------------------------------------------------------

def malla(shape, tol=0.08):
    v, t = shape.tessellate(tol, 0.2)
    return trimesh.Trimesh(np.array([(p.x, p.y, p.z) for p in v]), np.array(t), process=True)


def piezas_cabezal(desp):
    """{nombre: cq.Shape} del cabezal con el plumón levantado 'desp'."""
    return {n: w.val() for k, (w, n, c) in list(C.impresas(desp).items()) + list(C.compradas(desp).items())}


def _bvh(m):
    b = fcl.BVHModel()
    b.beginModel(len(m.vertices), len(m.faces))
    b.addSubModel(m.vertices.astype(float), m.faces.astype(np.int32))
    b.endModel()
    return b


def _tf(phi_deg):
    a = math.radians(phi_deg)
    R = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1.0]])
    return fcl.Transform(R, np.zeros(3))


def distancia(o1, o2):
    req = fcl.DistanceRequest(enable_nearest_points=False)
    res = fcl.DistanceResult()
    d = fcl.distance(o1, o2, req, res)
    if d <= 0:
        cr = fcl.CollisionRequest(num_max_contacts=1, enable_contact=True)
        cres = fcl.CollisionResult()
        if fcl.collide(o1, o2, cr, cres):
            return -max((c.penetration_depth for c in cres.contacts), default=0.0) or -1e-3
        return 0.0
    return d


# ---------------------------------------------------------------------------------------------
# 1–3. Ajuste estático, barrido de J3 y homing
# ---------------------------------------------------------------------------------------------

def interferencias(cab_cq, htm_gira_cq):
    """Volumen común (mm³, booleano exacto) entre piezas que no deben tocarse (ajuste estático)."""
    import itertools
    todas = dict(cab_cq)
    todas.update(htm_gira_cq)
    permitidas = {frozenset(p) for p in (
        ("Electroimán KK-P20/15", C.NOMBRE_TORNILLOS),   # tornillo en la rosca
    )}
    malas = []
    for a, b in itertools.combinations(todas, 2):
        if frozenset((a, b)) in permitidas:
            continue
        ba, bb = todas[a].BoundingBox(), todas[b].BoundingBox()
        if ba.xmax < bb.xmin or bb.xmax < ba.xmin or ba.ymax < bb.ymin or bb.ymax < ba.ymin or ba.zmax < bb.zmin or bb.zmax < ba.zmin:
            continue
        i = todas[a].intersect(todas[b])
        v = i.Volume()
        if v > 0.05 and min(i.BoundingBox().xlen, i.BoundingBox().ylen, i.BoundingBox().zlen) > 0.05:
            malas.append((a, b, round(v, 2)))       # (las caras en contacto dan láminas de espesor ~0)
    return malas


def barrido(cab_por_desp, htm_gira, fijas, phis):
    """Holgura mínima (mm) de cada pieza que gira con J3 contra cada pieza fija, para cada φ."""
    res = {}
    obj_f = {n: fcl.CollisionObject(_bvh(m), fcl.Transform()) for n, m in fijas.items()}
    def bandas(m):
        r = np.hypot(m.vertices[:, 0], m.vertices[:, 1])
        return r.min(), r.max(), m.vertices[:, 2].min(), m.vertices[:, 2].max()

    bf = {n: bandas(m) for n, m in fijas.items()}
    for desp, cab in cab_por_desp.items():
        moviles = dict(cab)
        moviles.update(htm_gira)
        for n, m in moviles.items():
            o = fcl.CollisionObject(_bvh(m), fcl.Transform())
            r0, r1, z0, z1 = bandas(m)
            for nf, of in obj_f.items():
                R0, R1, Z0, Z1 = bf[nf]
                # descarte: si la pieza, al girar, no comparte banda de radio y de altura con la fija
                # (con 15 mm de margen), la holgura no baja de ese margen en ningún φ
                if z0 > Z1 + 15 or Z0 > z1 + 15 or r0 > R1 + 15 or R0 > r1 + 15:
                    continue
                serie = []
                for phi in phis:
                    o.setTransform(_tf(phi))
                    serie.append(distancia(o, of))
                res[(desp, n, nf)] = serie
    return res


def homing(htm_gira, final):
    """φ (decreciente desde 0) al que el pasador del J3 Coupler toca el final de carrera."""
    cp = fcl.CollisionObject(_bvh(htm_gira["J3 Coupler"]), fcl.Transform())
    fc = fcl.CollisionObject(_bvh(final), fcl.Transform())
    phi = 0.0
    while phi > -200:
        cp.setTransform(_tf(phi))
        if distancia(cp, fc) <= 0.05:
            return phi
        phi -= 0.25
    return None


# ---------------------------------------------------------------------------------------------
# 4. Misión del simulador (port de buildTimeline, cabezal 'disc', modo 'mision')
# ---------------------------------------------------------------------------------------------

L1, L2 = 228.0, 144.0
DROP_REAL = 228.62 - K.Z_CONN_INF          # base de la plataforma -> cara inferior del connector (80.5)
DROP_SIM = 78.5
ZROD0, H_PINF, H_BCOV, H_PSUP_DISK, H_TCOV, H_PLAT = 72, 10, 21.5, 8, 23, 45
P = dict(rod=250, D=185, alpha=180, v=25, codo=-1, mj2=40)
OBJ = [dict(n="Arandela de acero", metal=True, x=60, y=-215, h=3, r=15), dict(n="Ficha de PLA", metal=False, x=150, y=-238, h=8, r=15),
       dict(n="Tuerca de acero", metal=True, x=240, y=-215, h=7, r=13), dict(n="Bloque de madera", metal=False, x=325, y=-172, h=12, r=15)]
BIN = dict(x=95, y=265, w=80, d=80, h=25)   # y = 235 en la v2 del simulador: el electroimán la rozaba al trazar
# obstáculos en la mesa (marco del simulador: eje J1 en el origen): bandeja, base del robot (STEP: x −107.5..107.5,
# y ±70, 45 mm, con J1 en x = 42.5) y la caja del Arduino junto a ella
CAJAS = {"bandeja": (BIN["x"] - BIN["w"] / 2, BIN["x"] + BIN["w"] / 2, BIN["y"] - BIN["d"] / 2, BIN["y"] + BIN["d"] / 2, BIN["h"]),
         "base del robot": (-150.0, 65.0, -70.0, 70.0, 45.0),
         "caja del Arduino": (-235.0, -150.0, -60.0, 60.0, 45.0)}
ROSA = dict(A=102.9, K=1.3552, T0=5 * math.pi / 6, T1=11 * math.pi / 6)
DT = 1 / 60
HERR = {k: dict(phi=C.PHI[k], r=C.R_HERR, below=C.BAJO[k]) for k in C.PHI}


def wrap(a):
    return ((a + 180) % 360 + 360) % 360 - 180


def mision(drop, extra):
    """Línea de tiempo del simulador. drop: base plataforma -> brida; extra: DELTA (0 en el simulador)."""
    zmin = ZROD0 + H_PINF + H_BCOV
    zmax = ZROD0 + P["rod"] - H_PSUP_DISK - H_TCOV - H_PLAT - P["mj2"] - 3

    def zp_for(ztip, tk, lift=0.0):
        return ztip + drop + extra + C.T_PLACA + HERR[tk]["below"] - (lift if tk == "plumon" else 0)

    avisos = set()

    def clamp(z):
        if z > zmax + 1e-6:
            avisos.add(f"Z pide {z:.1f} > zmax {zmax:.1f}")
            return zmax
        if z < zmin - 1e-6:
            avisos.add(f"Z pide {z:.1f} < zmin {zmin:.1f}")
            return zmin
        return z

    z_tr = clamp(zp_for(60, "iman"))
    s = dict(th1=0.0, th2=0.0, phi=0.0, zp=clamp(min(zmax, z_tr + 15)), lift=C.LEVANTE, tool="plumon", fase="inicio")
    F = []

    def push():
        F.append(dict(s))

    def hold(sec):
        for _ in range(max(1, round(sec / DT))):
            push()

    def smooth(u):
        return u * u * (3 - 2 * u)

    def interp(target, dur):
        a = dict(s)
        n = max(1, round(dur / DT))
        for i in range(1, n + 1):
            u = smooth(i / n)
            for k, v in target.items():
                s[k] = a[k] + (v - a[k]) * u
            push()

    def joints(q):
        interp(dict(th1=q[0], th2=q[1], phi=q[2]), max(0.5, max(abs(q[0] - s["th1"]), abs(q[1] - s["th2"]), abs(q[2] - s["phi"])) / 55))

    def z_to(z, v=35):
        z = clamp(z)
        interp(dict(zp=z), max(0.25, abs(z - s["zp"]) / v))

    def ik(x, y, tk, codo):
        t = HERR[tk]
        phi = wrap(-t["phi"])
        le = L2 + t["r"]
        c2 = (x * x + y * y - L1 * L1 - le * le) / (2 * L1 * le)
        if abs(c2) > 1:
            return None
        t2 = codo * math.acos(c2)
        t1 = math.atan2(y, x) - math.atan2(le * math.sin(t2), L1 + le * math.cos(t2))
        return (wrap(math.degrees(t1)), wrap(math.degrees(t2)), phi)

    def solve(x, y, tk):
        q = ik(x, y, tk, P["codo"])
        ok = lambda q: q and abs(q[0]) <= 150 and abs(q[1]) <= 150
        if not ok(q):
            q = ik(x, y, tk, -P["codo"])
            if not ok(q):
                avisos.add(f"{tk} fuera de alcance en ({x:.0f}, {y:.0f})")
                return None
        return q

    def go_above(x, y, tk):
        s["tool"] = tk
        q = solve(x, y, tk)
        if q:
            joints(q)
        return q is not None

    hold(0.8)
    z_to(z_tr)
    s["fase"] = "escaneo"
    for o in OBJ:
        if not go_above(o["x"], o["y"], "sensor"):
            continue
        z_to(zp_for(o["h"] + 3, "sensor"), 30)
        hold(0.9)
        z_to(z_tr)
    s["fase"] = "recoleccion"
    slot = 0
    for o in OBJ:
        if not o["metal"] or not go_above(o["x"], o["y"], "iman"):
            continue
        z_to(zp_for(o["h"] + 0.5, "iman"), 30)
        hold(0.5)
        z_to(z_tr)
        bx, by = BIN["x"] + (14 if slot % 2 else -14), BIN["y"] + (-10 if slot < 2 else 10)
        slot += 1
        if not go_above(bx, by, "iman"):
            continue
        z_to(zp_for(BIN["h"] + o["h"] + 6, "iman"), 30)
        hold(0.4)
        z_to(z_tr)
    s["fase"] = "rosa"
    pts = rosa()
    if go_above(*pts[0], "plumon"):
        interp(dict(lift=0.0), 0.35)
        z_to(zp_for(8, "plumon"))
        z_to(zp_for(0, "plumon"), 10)
        for p in pts:
            q = solve(*p, "plumon")
            if q:
                s["th1"], s["th2"], s["phi"] = q
            push()
        z_to(zp_for(10, "plumon"), 20)
        interp(dict(lift=C.LEVANTE), 0.35)
    s["fase"] = "regreso"
    z_to(z_tr)
    joints((0.0, 0.0, 0.0))
    hold(0.8)
    return F, dict(zmin=zmin, zmax=zmax, z_transito=z_tr, avisos=sorted(avisos), zp_for=zp_for)


def rosa():
    a = math.radians(P["alpha"])

    def w(t):
        c3 = math.cos(3 * t)
        x, y = -ROSA["A"] * c3 * math.cos(t), -ROSA["A"] * ROSA["K"] * c3 * math.sin(t)
        return (math.cos(a) * x - math.sin(a) * y + P["D"], math.sin(a) * x + math.cos(a) * y)

    n = 5000
    p = [w(ROSA["T0"] + (ROSA["T1"] - ROSA["T0"]) * i / n) for i in range(n + 1)]
    s = [0.0]
    for i in range(1, n + 1):
        s.append(s[-1] + math.dist(p[i], p[i - 1]))
    out, j, d = [], 0, 0.0
    while d <= s[-1] + 1e-9:
        while j < n - 1 and s[j + 1] < d:
            j += 1
        u = (d - s[j]) / max(s[j + 1] - s[j], 1e-9)
        out.append((p[j][0] + (p[j + 1][0] - p[j][0]) * u, p[j][1] + (p[j + 1][1] - p[j][1]) * u))
        d += P["v"] * DT
    return out


def chequeo_mision(cab0, cab18, F, drop):
    """Holgura vertical de cada pieza del cabezal sobre la mesa, las piezas y la bandeja en cada cuadro."""
    muestras = {}
    for desp, cab in ((0.0, cab0), (C.LEVANTE, cab18)):
        for n, m in cab.items():
            pts = np.vstack([m.vertices, trimesh.sample.sample_surface(m, 1500, seed=1)[0]])
            muestras[(desp, n)] = pts[pts[:, 2] < pts[:, 2].min() + 25]
    peor = {}
    col_min = (1e9, None)
    for i, f in enumerate(F[::2]):
        a1, a12 = math.radians(f["th1"]), math.radians(f["th1"] + f["th2"])
        j3 = np.array([L1 * math.cos(a1) + L2 * math.cos(a12), L1 * math.sin(a1) + L2 * math.sin(a12)])
        psi = math.radians(f["th1"] + f["th2"] + f["phi"])
        R = np.array([[math.cos(psi), -math.sin(psi)], [math.sin(psi), math.cos(psi)]])
        z0 = f["zp"] - drop - C.DELTA                       # cara superior de la placa
        desp = C.LEVANTE if f["lift"] > C.LEVANTE / 2 else 0.0
        for (d_, n), pts in muestras.items():
            if d_ != desp:
                continue
            xy = pts[:, :2] @ R.T + j3
            z = pts[:, 2] + z0
            h = np.zeros(len(z))                             # mesa
            que = np.full(len(z), "mesa", dtype=object)
            for o in OBJ:
                dentro = np.hypot(xy[:, 0] - o["x"], xy[:, 1] - o["y"]) < o["r"]
                que[dentro & (o["h"] > h)] = o["n"]
                h[dentro] = np.maximum(h[dentro], o["h"])
            for nombre_c, (x0, x1, y0, y1, hc) in CAJAS.items():
                enb = (xy[:, 0] > x0) & (xy[:, 0] < x1) & (xy[:, 1] > y0) & (xy[:, 1] < y1)
                que[enb & (hc > h)] = nombre_c
                h[enb] = np.maximum(h[enb], hc)
            i_min = int(np.argmin(z - h))
            hol = float(z[i_min] - h[i_min])
            if n not in peor or hol < peor[n][0]:
                peor[n] = (hol, f["fase"], f["tool"], round(f["zp"], 1), que[i_min],
                           [round(float(v), 0) for v in xy[i_min]], round(float(f["th1"]), 1), round(float(f["th2"]), 1))
            rmin = float(np.hypot(xy[:, 0], xy[:, 1]).min())
            if rmin < col_min[0]:
                col_min = (rmin, f["fase"], round(f["th2"], 1))
    return peor, col_min


# ---------------------------------------------------------------------------------------------
# 5. Masa y centro de masa
# ---------------------------------------------------------------------------------------------

MASA_COMPRADAS = {     # g (CABEZALES_compras.md y hojas de datos; sin cables)
    "Plumón Sharpie fino": 11.0, "Micro servo SG90 / MG90S": 13.4, "Brazo simple del servo": 0.6,
    "Resorte Ø16 × 30": 0.7, "Electroimán KK-P20/15": 32.0, "Sensor inductivo LJ12A3-4-Z/BX": 30.0,
    C.NOMBRE_TORNILLOS: 4 * (4.4 + 1.1 + 0.4) + 2.3,     # M4×35 + tuerca + arandela, M3×35
}
TORNILLERIA_M3 = 9.5   # 4 M3×10 + 2 M3×20 + M3×20 + M3×12 + M3×16 + 2 M3×16 avellanados + tuercas


def masas(cab0):
    with open(os.path.join(RAIZ, "piezas.json"), encoding="utf-8") as fh:
        imp = {p["nombre"]: p["gramos"] for p in json.load(fh)}
    filas, M, S = [], 0.0, np.zeros(3)
    for n, m in cab0.items():
        g = imp.get(n, MASA_COMPRADAS.get(n))
        c = m.center_mass if m.is_volume else m.centroid
        filas.append((n, round(g, 1), [round(float(v), 1) for v in c]))
        M += g
        S += g * np.asarray(c)
    # tornillería M3 repartida en el plumón (≈ la mitad) y el resto del cabezal
    filas.append(("Tornillería M3 (estimada)", TORNILLERIA_M3, [30.0, 0.0, 0.0]))
    M += TORNILLERIA_M3
    S += TORNILLERIA_M3 * np.array([30.0, 0.0, 0.0])
    return filas, M, S / M


# ---------------------------------------------------------------------------------------------

def main():
    rep = {}
    print("Mallas de HTM ...", flush=True)
    htm = piezas_htm()
    gira_cq = {n: s for n, (g, s) in htm.items() if g}
    gira = {n: malla(s, 0.3) for n, s in gira_cq.items()}
    fijas = {n: malla(s, 0.3) for n, (g, s) in htm.items() if not g}
    print("Mallas del cabezal ...", flush=True)
    cab0_cq, cab18_cq = piezas_cabezal(0.0), piezas_cabezal(C.LEVANTE)
    cab0 = {n: malla(s, 0.2) for n, s in cab0_cq.items()}
    cab18 = {n: malla(s, 0.2) for n, s in cab18_cq.items()}
    print("   triángulos:", sum(len(m.faces) for m in cab0.values()), "cabezal,", sum(len(m.faces) for m in fijas.values()), "fijas", flush=True)

    # 1. ajuste estático
    malas = interferencias(cab0_cq, gira_cq) + interferencias(cab18_cq, gira_cq)
    rep["interferencias"] = sorted(set(malas))
    print("1. Interferencias:", rep["interferencias"] or "ninguna", flush=True)

    # 3. homing (antes del barrido para saber hasta dónde barrer)
    phi_h = homing(gira, fijas["Final de carrera J3"])
    rep["homing_contacto_phi"] = phi_h
    print(f"3. El pasador del J3 Coupler toca el final de carrera en φ = {phi_h:.2f}°", flush=True)

    # 2. barrido
    phis = [float(x) for x in range(-125, 126)]
    print("2. Barrido de J3 ...", flush=True)
    sw = barrido({0.0: cab0, C.LEVANTE: cab18}, gira, fijas, phis)
    lim = (phi_h - 1.0, 121.0)
    resumen = {}
    for (desp, n, nf), serie in sw.items():
        dentro = [d for p, d in zip(phis, serie) if lim[0] <= p <= lim[1]]
        dmin = min(dentro)
        p_min = [p for p, d in zip(phis, serie) if lim[0] <= p <= lim[1] and d == dmin][0]
        clave = f"{n} ↔ {nf}"
        if clave not in resumen or dmin < resumen[clave]["holgura_mm"]:
            resumen[clave] = dict(holgura_mm=round(dmin, 2), phi=p_min, plumon="arriba" if desp else "abajo")
    rep["barrido_J3"] = dict(rango_phi=lim, pares=dict(sorted(resumen.items(), key=lambda kv: kv[1]["holgura_mm"])))
    for k, v in list(rep["barrido_J3"]["pares"].items())[:12]:
        print(f"   {v['holgura_mm']:7.2f} mm  φ={v['phi']:7.1f}°  plumón {v['plumon']:6s}  {k}")
    # límites de φ por pieza (primer contacto a cada lado de 0)
    lim_phi = {}
    for (desp, n, nf), serie in sw.items():
        neg = [p for p, d in zip(phis, serie) if p <= 0 and d <= 0]
        pos = [p for p, d in zip(phis, serie) if p >= 0 and d <= 0]
        if neg or pos:
            k = f"{n} ↔ {nf}"
            a = max(neg) if neg else None
            b = min(pos) if pos else None
            o = lim_phi.get(k, [a, b])
            lim_phi[k] = [max(x for x in (o[0], a) if x is not None) if (o[0] or a) else None,
                          min(x for x in (o[1], b) if x is not None) if (o[1] or b) else None]
    rep["contacto_fuera_de_rango"] = lim_phi
    graficar(sw, phis, lim)

    # 4. misión
    print("4. Misión del simulador ...", flush=True)
    F, z = mision(DROP_REAL, C.DELTA)
    peor, col = chequeo_mision(cab0, cab18, F, DROP_REAL)
    zp_for = z.pop("zp_for")
    rep["mision"] = dict(cuadros=len(F), duracion_s=round(len(F) * DT, 1), **z,
                         z_plumon_trazo=round(zp_for(0, "plumon"), 1),
                         holguras={n: dict(mm=round(v[0], 2), fase=v[1], herramienta=v[2], zp=v[3], sobre=v[4], xy=v[5], th1=v[6], th2=v[7])
                                   for n, v in sorted(peor.items(), key=lambda kv: kv[1][0])},
                         radio_min_al_eje_J1=dict(mm=round(col[0], 1), fase=col[1], th2=col[2]),
                         drop_real_mm=round(DROP_REAL, 2), drop_simulador_mm=DROP_SIM)
    print(f"   {len(F)} cuadros ({len(F) * DT:.1f} s); z tránsito {z['z_transito']:.1f}, zmax {z['zmax']:.1f}; avisos: {z['avisos'] or 'ninguno'}")
    for n, v in rep["mision"]["holguras"].items():
        print(f"   {v['mm']:7.2f} mm  {v['fase']:12s} {v['herramienta']:8s} sobre {v['sobre']:18s} xy={v['xy']}  {n}")
    print(f"   radio mínimo del cabezal al eje de J1: {col[0]:.1f} mm ({col[1]}, θ2 = {col[2]}°)")

    # 5. masa
    filas, M, cm = masas(cab0)
    rep["masa"] = dict(total_g=round(M, 1), centro_de_masa_mm=[round(float(v), 1) for v in cm],
                       radio_cm_mm=round(float(math.hypot(cm[0], cm[1])), 1), piezas=filas)
    print(f"5. Masa {M:.1f} g, centro de masa ({cm[0]:.1f}, {cm[1]:.1f}, {cm[2]:.1f}) mm, a {math.hypot(cm[0], cm[1]):.1f} mm del eje de J3")

    with open(os.path.join(RAIZ, "verificacion.json"), "w", encoding="utf-8") as fh:
        json.dump(rep, fh, ensure_ascii=False, indent=1, default=str)
    return rep


def graficar(sw, phis, lim):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(11, 5.5))
    curvas = {}
    for (desp, n, nf), serie in sw.items():
        k = (n, nf)
        curvas[k] = np.minimum(curvas.get(k, np.full(len(phis), 1e9)), np.array(serie))
    top = sorted(curvas.items(), key=lambda kv: kv[1][(np.array(phis) >= lim[0]) & (np.array(phis) <= lim[1])].min())[:6]
    for (n, nf), y in top:
        ax.plot(phis, np.clip(y, -5, 30), lw=1.6, label=f"{n} ↔ {nf}")
    ax.axhline(0, color="k", lw=0.8)
    ax.axvspan(lim[0], lim[1], color="#2a9d8f", alpha=0.08, label="rango de J3 con el cabezal")
    for p in (-120, 0, 120):
        ax.axvline(p, color="#999", lw=0.6, ls=":")
    ax.set_xlabel("φ de J3 (°)  ·  −120 electroimán, 0 plumón, +120 sensor")
    ax.set_ylabel("holgura mínima (mm, recortada a 30)")
    ax.set_title("Cabezal A v3: holgura contra el brazo 2, su cubierta y el final de carrera de J3")
    ax.set_ylim(-5, 30)
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8, loc="upper center", ncol=2)
    fig.tight_layout()
    os.makedirs(os.path.join(RAIZ, "img"), exist_ok=True)
    fig.savefig(os.path.join(RAIZ, "img", "holguras_j3.png"), dpi=130)


if __name__ == "__main__":
    main()
