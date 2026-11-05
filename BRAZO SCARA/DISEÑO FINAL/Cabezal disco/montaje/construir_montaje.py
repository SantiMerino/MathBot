"""
Arma el visor 3D del montaje mecánico del cabezal A v3 (montaje/index.html).

    python "BRAZO SCARA/DISEÑO FINAL/Cabezal disco/montaje/construir_montaje.py"

Toma las mallas del cabezal en su marco (ensamble/stl, las escribe fuente/construir.py), el J3 Coupler, el
Gripper to J3 connector y el brazo 2 de HowToMechatronics, y la posición de cada tornillo y tuerca a partir de
las constantes de fuente/cabezal.py. Los tornillos los dibuja el visor; aquí solo van su tipo, medida, punto y
eje. Todo se incrusta en index.html (desde plantilla.html), que abre sin servidor.

Marco: el del cabezal (origen en el eje de J3, z = 0 en la cara superior de la placa, +x hacia el plumón).
"""

from __future__ import annotations

import json
import math
import os
import sys

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
CAB = os.path.dirname(AQUI)
RAIZ = os.path.normpath(os.path.join(CAB, "..", "..", ".."))
sys.path.insert(0, os.path.join(CAB, "fuente"))
sys.path.insert(0, os.path.join(RAIZ, "python"))

import cabezal as C  # noqa: E402
import construir_simulador_scara as sim  # noqa: E402

# El connector y el coupler del simulador tienen el eje largo x' del connector en −y (sus ranuras avellanadas
# quedan en (−1.0, ±18.5)). En el marco del cabezal x' está a ALFA: se giran ALFA + 90°.
GIRO_CONN = C.ALFA + 90.0
# Debajo del connector: cara inferior del connector en z = DELTA, coupler encima, brazo 2 2 mm sobre el coupler.
ROBOT = {
    "j3_coupler": ("J3 Coupler", GIRO_CONN, (0.0, 0.0, C.DELTA + C.T_CONN)),
    "conector_j3": ("Gripper to J3 connector", GIRO_CONN, (0.0, 0.0, C.DELTA)),
    "arm2": ("Brazo 2", 0.0, (-144.0, 0.0, C.DELTA + C.T_CONN + 22.0 + 2.0)),
}


def r3(v):
    return [round(float(x), 3) for x in v]


def girar_z(tris, ang):
    a = math.radians(ang)
    c, s = math.cos(a), math.sin(a)
    x, y = tris[..., 0].copy(), tris[..., 1].copy()
    tris[..., 0], tris[..., 1] = c * x - s * y, s * x + c * y
    return tris


def local_sensor(lx, ly, z):
    """Punto del marco local de la abrazadera (x radial, y tangencial) al marco del cabezal."""
    a = math.radians(C.PHI["sensor"])
    return (C.SEN[0] + lx * math.cos(a) - ly * math.sin(a), C.SEN[1] + lx * math.sin(a) + ly * math.cos(a), z)


def eje_sensor(ly):
    a = math.radians(C.PHI["sensor"])
    return (-ly * math.sin(a), ly * math.cos(a), 0.0)


# ---------------------------------------------------------------------------------------------
# Tornillería: cada elemento lleva su punto de apoyo p y el eje a (de la cabeza hacia la punta)
# ---------------------------------------------------------------------------------------------
FIJ = {}


def tornillo(fid, tipo, d, largo, p, a):
    FIJ[fid] = dict(clase="tornillo", tipo=tipo, d=d, L=largo, p=r3(p), a=r3(a))
    return fid


def tuerca(fid, d, p, a, ec=None, h=None):
    ec = ec or {3: 5.5, 4: 7.0}[d]
    h = h or {3: 2.4, 4: 3.2}[d]
    FIJ[fid] = dict(clase="tuerca", d=d, ec=ec, h=h, p=r3(p), a=r3(a))
    return fid


def arandela(fid, d, p, a):
    FIJ[fid] = dict(clase="arandela", d=d, de=9.0, h=0.8, p=r3(p), a=r3(a))
    return fid


ABAJO, ARRIBA = (0, 0, -1), (0, 0, 1)
PX, PY = C.PEN
S = C.SERVO

# servo: 2 tornillos M2 por las orejas, de +y hacia la pared de la cuna
ua = C.U_EJE_SERVO + S["eje_off"] - S["L"] / 2 - S["agujeros"] / 2
yo = C.Y_SERVO_TAPA + S["H"] - S["oreja_z"] - S["oreja_t"]
M2 = [tornillo(f"m2_{i}", "cilindrica", 2.0, 8.0, (PX + u, yo + S["oreja_t"], C.Z_EJE_SERVO), (0, -1, 0))
      for i, u in enumerate((ua, ua + S["agujeros"]))]

# soporte -> placa: M3 x 10 desde arriba (pie de 3 mm), tuerca en el alojamiento bajo la placa
SOP_T, SOP_N = [], []
for i, (u, v) in enumerate(C.SOP_TORNILLOS):
    x, y = C.en_plumon(u, v)
    SOP_T.append(tornillo(f"sop_t{i}", "allen", 3.0, 10.0, (x, y, 3.0), ABAJO))
    SOP_N.append(tuerca(f"sop_n{i}", 3, (x, y, C.Z_INF + 2.4), ABAJO))

# electroimán: M3 x 35 desde la cara superior de la placa
IMAN_T = [tornillo("iman_t", "allen", 3.0, 35.0, (*C.MAG, 0.0), ABAJO)]

# abrazadera -> placa: 2 x M3 x 20 desde arriba, tuercas en la cara inferior de la abrazadera
z_abr = C.Z_INF - C.H_ABRAZ
ABR_T, ABR_N = [], []
for i, (r, t) in enumerate(C.ABR_TORNILLOS):
    x, y = C.herr_local("sensor", r, t)
    ABR_T.append(tornillo(f"abr_t{i}", "allen", 3.0, 20.0, (x, y, 0.0), ABAJO))
    ABR_N.append(tuerca(f"abr_n{i}", 3, (x, y, z_abr + 2.4), ABAJO))

# apriete de la abrazadera: M3 x 25 tangencial (cabeza en el lado +y local), tuerca en el lado −y
zc = C.Z_INF - C.H_ABRAZ / 2
APR_T = [tornillo("apr_t", "allen", 3.0, 25.0, local_sensor(14.0, 12.0, zc), eje_sensor(-1.0))]
APR_N = [tuerca("apr_n", 3, local_sensor(14.0, -10.4, zc), eje_sensor(-1.0))]

# puente -> poste: M3 x 16 avellanado desde arriba, tuerca en la trampa lateral del poste
z_pte = C.Z_PUENTE + C.H_PUENTE
PTE_T = [tornillo("pte_t", "avellanado", 3.0, 16.0, (PX, PY + C.Y_TORN_PUENTE, z_pte), ABAJO)]
PTE_N = [tuerca("pte_n", 3, (PX, PY + C.Y_TORN_PUENTE, C.Z_PUENTE - 7.5 + 2.6), ABAJO)]

# collar: M3 x 12 de −y a +y por las orejas de apriete
z_col = C.C_TRAZO + C.H_COLLAR / 2
COL_T = [tornillo("col_t", "allen", 3.0, 12.0, (PX + 12.75, PY - 5.5, z_col), (0, 1, 0))]
COL_N = [tuerca("col_n", 3, (PX + 12.75, PY + 3.0, z_col), (0, 1, 0))]

# separador -> connector: 2 x M3 x 16 avellanados desde la cara superior del connector, tuerca por abajo
z_conn = C.DELTA + C.T_CONN
CSK_T, CSK_N = [], []
for i, (x, y) in enumerate(C.CSK):
    CSK_T.append(tornillo(f"csk_t{i}", "avellanado", 3.0, 16.0, (x, y, z_conn), ABAJO))
    CSK_N.append(tuerca(f"csk_n{i}", 3, (x, y, 5.4), ABAJO))

# cabezal -> brida del J3 Coupler: 4 x M4 x 35 desde abajo con arandela, tuerca arriba sin arandela
M4_T, M4_A, M4_N = [], [], []
for i, (x, y) in enumerate(C.PERNOS):
    M4_A.append(arandela(f"m4_a{i}", 4, (x, y, C.Z_INF - 0.8), ARRIBA))
    M4_T.append(tornillo(f"m4_t{i}", "allen", 4.0, 35.0, (x, y, C.Z_INF - 0.8), ARRIBA))
    M4_N.append(tuerca(f"m4_n{i}", 4, (x, y, C.Z_BRIDA_SUP), ARRIBA))


# ---------------------------------------------------------------------------------------------
# Pasos. "seq" va en orden de tiempo: cada entrada mueve sus objetos desde d (mm) hasta su lugar.
# Un objeto puede estar en varias entradas: los desplazamientos se suman (la tuerca entra a su pieza
# y luego viaja con ella).
# ---------------------------------------------------------------------------------------------
def e(objs, d, txt=None, clase="pieza"):
    return dict(objs=list(objs), d=r3(d), txt=txt, clase=clase)


def rad_sensor(dist):
    a = math.radians(C.PHI["sensor"])
    return (dist * math.cos(a), dist * math.sin(a), 0.0)


BANCO = ["placa", "soporte", "servo", "porta_iman", "electroiman", "abrazadera", "sensor", "collar", "resorte",
         "puente", "plumon", "horn"]
FIJ_BANCO = M2 + SOP_T + SOP_N + IMAN_T + ABR_T + ABR_N + APR_T + APR_N + PTE_T + PTE_N + COL_T + COL_N

PASOS = [
    dict(titulo="Servo en la cuna", lugar="banco",
         texto=["Pasa el servo por la ventana del soporte desde el lado del cuerpo (+y) hasta que las orejas toquen la pared.",
                "Atorníllalo con los 2 tornillos M2 que trae. Todavía sin brazo."],
         piezas=["soporte", "servo"],
         seq=[e(["servo"], (0, 45, 0), "Servo por la ventana"),
              e(M2, (0, 22, 0), "2 × tornillo M2 del servo", "tornillo")],
         lista=[("2", "Tornillo M2 (viene con el servo)", "Destornillador Phillips chico")],
         vista="servo"),
    dict(titulo="Soporte a la placa", lugar="banco",
         texto=["Mete las 4 tuercas M3 en los alojamientos hexagonales de la cara inferior de la placa.",
                "Apoya el soporte con el servo sobre la placa y atorníllalo desde arriba."],
         piezas=["placa", "soporte", "servo"],
         seq=[e(SOP_N, (0, 0, -22), "4 × tuerca M3 bajo la placa", "tuerca"),
              e(["soporte", "servo"] + M2, (0, 0, 40), "Soporte + servo"),
              e(SOP_T, (0, 0, 22), "4 × M3 × 10 DIN 912", "tornillo")],
         lista=[("4", "M3 × 10 DIN 912", "Allen 2.5 mm"), ("4", "Tuerca M3", "Alojamiento bajo la placa")],
         vista="soporte"),
    dict(titulo="Electroimán y su copa", lugar="banco",
         texto=["Mete el electroimán en la copa, con los cables por la ranura del fondo.",
                "Pon la copa bajo la placa con el pasador en su agujero.",
                "Pasa el M3 × 35 desde arriba hasta la rosca del electroimán. Los cables suben por el agujero de 5.5 mm."],
         piezas=["placa", "porta_iman", "electroiman"],
         seq=[e(["electroiman"], (0, 0, -26), "Electroimán en la copa"),
              e(["porta_iman", "electroiman"], (0, 0, -40), "Copa bajo la placa"),
              e(IMAN_T, (0, 0, 42), "1 × M3 × 35", "tornillo")],
         lista=[("1", "M3 × 35 (M4 × 35 si el electroimán es M4)", "Allen 2.5 mm")],
         vista="iman"),
    dict(titulo="Abrazadera del sensor", lugar="banco",
         texto=["Mete 2 tuercas M3 por la cara inferior de la abrazadera y la tercera en el alojamiento lateral.",
                "Pon la abrazadera bajo la placa y atorníllala con 2 × M3 × 20 desde arriba."],
         piezas=["placa", "abrazadera"],
         seq=[e(ABR_N, (0, 0, -18), "2 × tuerca M3", "tuerca"),
              e(APR_N, eje_sensor(-14), "Tuerca lateral M3", "tuerca"),
              e(["abrazadera"] + ABR_N + APR_N, (0, 0, -40), "Abrazadera bajo la placa"),
              e(ABR_T, (0, 0, 28), "2 × M3 × 20", "tornillo")],
         lista=[("2", "M3 × 20", "Allen 2.5 mm"), ("3", "Tuerca M3", "2 abajo, 1 lateral")],
         vista="sensor"),
    dict(titulo="Sensor a 40 mm", lugar="banco",
         texto=["Mete el LJ18A3 desde abajo por la abrazadera y el paso de la placa.",
                "Deja su cara 40 mm bajo la cara inferior de la placa (un taco de 40 mm ayuda).",
                "Aprieta el M3 × 25 lateral. Las 2 tuercas M18 del sensor no se usan."],
         piezas=["placa", "abrazadera", "sensor"],
         seq=[e(["sensor"], (0, 0, -70), "Sensor LJ18A3"),
              e(APR_T, eje_sensor(30), "1 × M3 × 25 de apriete", "tornillo")],
         lista=[("1", "M3 × 25", "Allen 2.5 mm"), ("1", "Taco de 40 mm", "Para fijar la altura")],
         cotas=[dict(a=r3((*[C.SEN[i] + rad_sensor(26)[i] for i in (0, 1)], C.Z_INF)),
                     b=r3((*[C.SEN[i] + rad_sensor(26)[i] for i in (0, 1)], C.Z_SENSOR_CARA)), txt="40 mm")],
         vista="sensor"),
    dict(titulo="Collar, resorte y puente", lugar="banco",
         texto=["Pon el collar suelto sobre la guía del plumón y el resorte encima.",
                "Mete la tuerca M3 por la ranura lateral del poste.",
                "Coloca el puente sobre el poste y fíjalo con el M3 × 16 avellanado."],
         piezas=["placa", "soporte", "servo", "collar", "resorte", "puente"],
         seq=[e(["collar"], (0, 0, 46), "Collar"),
              e(["resorte"], (0, 0, 62), "Resorte Ø16 × 30"),
              e(PTE_N, (22, 0, 0), "Tuerca M3 en el poste", "tuerca"),
              e(["puente"], (0, 0, 44), "Puente"),
              e(PTE_T, (0, 0, 24), "1 × M3 × 16 avellanado", "tornillo")],
         lista=[("1", "M3 × 16 avellanado DIN 7991", "Allen 2 mm"), ("1", "Tuerca M3", "Trampa lateral del poste"),
                ("1", "Resorte Ø15–16 × 30", "")],
         vista="plumon"),
    dict(titulo="Plumón y apriete del collar", lugar="banco",
         texto=["Mete el Sharpie sin tapa desde arriba: pasa por el puente, el resorte, el collar y la guía.",
                "Tuerca M3 en la oreja del collar y M3 × 12 desde el otro lado. Apriétalo suave: la altura final se ajusta con Z."],
         piezas=["placa", "soporte", "servo", "collar", "resorte", "puente", "plumon"],
         seq=[e(["plumon"], (0, 0, 120), "Plumón sin tapa"),
              e(COL_N, (0, 16, 0), "Tuerca M3 del collar", "tuerca"),
              e(COL_T, (0, -20, 0), "1 × M3 × 12", "tornillo")],
         lista=[("1", "M3 × 12", "Allen 2.5 mm"), ("1", "Tuerca M3", "Oreja del collar")],
         vista="collar"),
    dict(titulo="Brazo del servo", lugar="banco",
         texto=["Monta el brazo simple en el eje del servo, apuntando al plumón, unos 57° bajo la horizontal.",
                "Su punta queda bajo la oreja del collar, casi tocando la placa.",
                "Si el ángulo no cae, sácalo y mételo un diente más allá. No gires el eje a mano."],
         piezas=["placa", "soporte", "servo", "collar", "resorte", "puente", "plumon", "horn"],
         seq=[e(["horn"], (0, -24, 0), "Brazo simple")],
         lista=[("1", "Brazo simple (viene con el servo)", "A presión en el eje")],
         vista="horn"),
    dict(titulo="Separador bajo el connector", lugar="robot",
         texto=["Saca la pinza original y separa el Gripper to J3 connector del J3 Coupler.",
                "Mete 2 tuercas M3 por abajo del separador.",
                "Atornilla el separador bajo el connector con 2 × M3 × 16 avellanados: las cabezas quedan a ras en el connector.",
                "La muesca en V del separador apunta al pasador del J3 Coupler."],
         piezas=["conector_j3", "separador"], solo=True,
         seq=[e(CSK_N, (0, 0, -18), "2 × tuerca M3", "tuerca"),
              e(["separador"] + CSK_N, (0, 0, -34), "Separador de brida"),
              e(CSK_T, (0, 0, 30), "2 × M3 × 16 avellanado", "tornillo")],
         lista=[("2", "M3 × 16 avellanado DIN 7991", "Allen 2 mm"), ("2", "Tuerca M3", "Por abajo del separador")],
         vista="separador"),
    dict(titulo="Cabezal al J3 Coupler", lugar="robot",
         texto=["Presenta connector + separador + placa bajo el J3 Coupler.",
                "Pasa los 4 M4 × 35 desde abajo, con una arandela bajo cada cabeza.",
                "Tuercas arriba, sobre la brida del coupler, con fijador de rosca y sin arandela.",
                "Aprieta a mano y firme (~1 N·m): son bosses de plástico."],
         piezas=BANCO + ["separador", "conector_j3", "j3_coupler", "arm2"],
         seq=[e(BANCO + ["separador", "conector_j3"] + FIJ_BANCO + CSK_T + CSK_N, (0, 0, -40), "Cabezal + separador + connector"),
              e(M4_T + M4_A, (0, 0, -48), "4 × M4 × 35 + arandela", "tornillo"),
              e(M4_N, (0, 0, 22), "4 × tuerca M4 con fijador", "tuerca")],
         lista=[("4", "M4 × 35 DIN 912", "Allen 3 mm"), ("4", "Arandela M4", "Bajo la cabeza"),
                ("4", "Tuerca M4 + fijador azul", "Sin arandela: el final de carrera pasa a 1.8 mm")],
         vista="brida"),
    dict(titulo="Giro de J3 a mano", lugar="robot", giro=True,
         texto=["Gira J3 despacio desde la polea, de −120° a +121°, con el plumón abajo y luego levantado con el dedo.",
                "Cerca de −120° el pasador del coupler pisa el final de carrera.",
                "Mira los puntos justos de la lista. Si algo roza, detente y revisa la altura del sensor o el largo del plumón."],
         piezas=BANCO + ["separador", "conector_j3", "j3_coupler", "arm2"],
         seq=[],
         lista=[("−58°", "Tuercas M4 ↔ final de carrera", "1.8 mm"), ("−50°", "Sensor y su cable ↔ final de carrera", "1.5 mm"),
                ("−44°", "Puente ↔ cubierta del brazo 2", "3.4 mm"), ("0°", "Plumón ↔ punta del brazo 2", "2.5 mm"),
                ("±121°", "Plumón ↔ costado del brazo 2", "2.1 mm")],
         vista="giro"),
]

# cámaras: posición y objetivo (mm, marco del cabezal)
VISTAS = {
    "servo": ([150, 150, 70], [62, 22, 14]),
    "soporte": ([170, -150, 120], [55, 0, 0]),
    "iman": ([60, 190, -120], [-27, 47, -20]),
    "sensor": ([60, -200, -110], [-27, -47, -22]),
    "plumon": ([170, -150, 100], [55, 0, 18]),
    "collar": ([150, -130, 40], [60, 0, 8]),
    "horn": ([140, -150, 30], [62, 10, 10]),
    "separador": ([110, -120, 90], [0, 0, 10]),
    "brida": ([160, -210, 60], [0, 0, 10]),
    "giro": ([150, -330, 260], [-30, 0, 0]),
}


def main():
    meta = json.load(open(os.path.join(CAB, "ensamble", "stl", "meta.json"), encoding="utf-8"))
    piezas = {}
    for p in meta["piezas"]:
        k = p["clave"]
        if k == "tornillos_m4":
            continue
        info = dict(nombre=p["nombre"], color=p["color"], tipo="impresa" if p["impresa"] else "comprada")
        if p.get("helice"):
            info["helice"] = dict(**p["helice"], x=C.PEN[0], y=C.PEN[1], z0=meta["resorte"]["z0"], z1=meta["resorte"]["z1"])
        else:
            info["m"] = sim.empaquetar(sim.leer_stl(os.path.join(CAB, "ensamble", "stl", k + ".stl")))
        piezas[k] = info
    for k, (nombre, giro, off) in ROBOT.items():
        archivo, mapeo, centro, volteado = sim.PIEZAS[k]
        t = sim.transformar(sim.leer_stl(os.path.join(sim.DIR_STL, archivo)), mapeo, centro, volteado)
        t = girar_z(t, giro) + np.array(off)
        piezas[k] = dict(nombre=nombre, color=[0.36, 0.39, 0.43], tipo="robot", m=sim.empaquetar(t))
    datos = dict(piezas=piezas, fij=FIJ, pasos=PASOS, vistas=VISTAS)
    plantilla = open(os.path.join(AQUI, "plantilla.html"), encoding="utf-8").read()
    cuerpo = plantilla.replace("/*DATOS*/null", json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
    # plantilla.html es solo el contenido de la página; index.html le pone el documento alrededor para abrirlo
    # con doble clic. Con --fragmento RUTA se escribe además el contenido solo (para publicarlo como Artifact).
    if "--fragmento" in sys.argv:
        with open(sys.argv[sys.argv.index("--fragmento") + 1], "w", encoding="utf-8") as f:
            f.write(cuerpo)
    salida = os.path.join(AQUI, "index.html")
    with open(salida, "w", encoding="utf-8") as f:
        f.write('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                '<style>body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n')
        f.write(cuerpo)
        f.write("\n</body>\n</html>\n")
    print(f"{salida}  ({os.path.getsize(salida) / 1e6:.2f} MB, {len(piezas)} mallas, {len(FIJ)} elementos de tornillería, {len(PASOS)} pasos)")


if __name__ == "__main__":
    main()
