"""
Exporta el MathBot (SCARA de HowToMechatronics, PLA negro, con el cabezal de disco v3) para MATLAB:

    python matlab/avance2/fuente/exportar_modelo.py

Escribe en matlab/avance2/:
  meshes/<cuerpo>.stl   una malla por cuerpo y color, en METROS y en el marco de su junta
  mathbot_negro.urdf    el arbol de juntas J1, JZ, J2, J3, JP para Simscape Multibody (smimport)

Las piezas se colocan exactamente como en el panel (panel/js/vista3d.js): mismas STL, mismas
transformaciones (python/construir_simulador_scara.py) y mismas alturas de la pila. El cabezal sale de
"BRAZO SCARA/DISEÑO FINAL/Cabezal disco/ensamble/stl" (marco: eje de J3, z = 0 en la cara superior de la
placa, +x hacia el plumon).

Juntas (marco del robot: origen en el eje de J1 sobre la mesa, z hacia arriba, mm y grados como el firmware):
  J1  revoluta   columna completa            q1 = 0 con el brazo 1 sobre +x
  JZ  prismatica plataforma Z                valor = altura de la base de la plataforma sobre la mesa
  J2  revoluta   brazo 2                     q2 = 0 con el brazo 2 estirado
  J3  revoluta   cabezal                     phi = 0 con el plumon al frente (alineado con el brazo 2)
  JP  prismatica levante del plumon          0 = plumon abajo (traza), 18 mm = arriba
El origen del cuerpo 'plumon' es la PUNTA del plumon: es el TCP de la simulacion.
"""

from __future__ import annotations

import json
import math
import os
import struct
import sys

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.dirname(AQUI)
RAIZ = os.path.dirname(os.path.dirname(SALIDA))
sys.path.insert(0, os.path.join(RAIZ, "python"))
import construir_simulador_scara as sim  # noqa: E402

CABEZAL = os.path.join(RAIZ, "BRAZO SCARA", "DISEÑO FINAL", "Cabezal disco", "ensamble", "stl")

# Pila vertical (mm), igual que panel/js/vista3d.js
H_BASE, H_PINF, H_PSUP, H_PSUP_DISK, H_TCOV = 45.0, 10.0, 26.0, 8.0, 23.0
H_PLAT, H_ARM1, H_J2C, H_ARM2, H_J3C, H_CON = 45.0, 42.0, 24.0, 31.0, 22.0, 4.5
ZROD0, ROD, H_J3GAP = 72.0, 250.0, 2.0
L1, L2 = 228.0, 144.0
Z_CONECTOR = 14.0                      # meta.json: el cabezal cuelga 14 mm bajo el connector
GIRO_CONN = math.radians(50.4 + 90)    # coupler y connector giran para calzar con los pernos del cabezal
R_HERR = 55.0
BAJO_PLUMON = 56.0                     # punta del plumon bajo la cara superior de la placa (6 + 50)

ZA2 = -H_J2C - H_ARM2                  # cara inferior del brazo 2 respecto a J2
J3_ORIGEN = (L2, 0.0, ZA2 - H_J3GAP)   # respecto a J2
ZH = -H_J3C - H_CON                    # cara inferior del connector respecto a J3
Z_CAB = ZH - Z_CONECTOR                # cara superior de la placa del cabezal respecto a J3
PUNTA = (R_HERR, 0.0, Z_CAB - BAJO_PLUMON)   # punta del plumon respecto a J3 (con JP = 0)

COLORES = {
    "negro": (0.106, 0.110, 0.122),    # PLA negro (0x1b1c1f del panel)
    "acero": (0.79, 0.81, 0.83),
    "motor": (0.23, 0.24, 0.26),
    "iman": (0.45, 0.47, 0.50),
    "sensor": (0.80, 0.72, 0.40),
    "servo": (0.15, 0.35, 0.80),
}


# ---------------------------------------------------------------------------
# Geometria auxiliar
# ---------------------------------------------------------------------------
def pieza(nombre, x=0.0, y=0.0, z=0.0, rz=0.0):
    archivo, mapeo, centro, volteado = sim.PIEZAS[nombre]
    tris = sim.transformar(sim.leer_stl(os.path.join(sim.DIR_STL, archivo)), mapeo, centro, volteado)
    return mover(tris, x, y, z, rz)


def pieza_cabezal(clave, dz):
    return mover(sim.leer_stl(os.path.join(CABEZAL, clave + ".stl")), 0.0, 0.0, dz)


def mover(tris, x=0.0, y=0.0, z=0.0, rz=0.0):
    c, s = math.cos(rz), math.sin(rz)
    r = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    return tris @ r.T + np.array([x, y, z])


def caja(w, d, h, x, y, z):
    """Caja con la cara inferior en z (como caja() del panel)."""
    v = np.array([[sx * w / 2, sy * d / 2, sz * h] for sz in (0, 1) for sy in (-1, 1) for sx in (-1, 1)])
    caras = [(0, 2, 3), (0, 3, 1), (4, 5, 7), (4, 7, 6), (0, 1, 5), (0, 5, 4),
             (2, 6, 7), (2, 7, 3), (0, 4, 6), (0, 6, 2), (1, 3, 7), (1, 7, 5)]
    return v[np.array(caras)] + np.array([x, y, z])


def cilindro(r, h, x, y, z, n=24):
    """Cilindro vertical con la base en z (como cilindro() del panel)."""
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    abajo = np.stack([r * np.cos(a), r * np.sin(a), np.zeros(n)], 1)
    arriba = abajo + [0, 0, h]
    t = []
    for i in range(n):
        j = (i + 1) % n
        t += [[abajo[i], abajo[j], arriba[j]], [abajo[i], arriba[j], arriba[i]],
              [[0, 0, 0], abajo[j], abajo[i]], [[0, 0, h], arriba[i], arriba[j]]]
    return np.array(t) + np.array([x, y, z])


def unir(*partes):
    return np.concatenate(partes, 0)


def escribir_stl(ruta, tris_mm, nombre):
    t = np.asarray(tris_mm, float) / 1000.0           # metros
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    largo = np.linalg.norm(n, axis=1, keepdims=True)
    n = np.divide(n, largo, out=np.zeros_like(n), where=largo > 0)
    reg = np.zeros(len(t), dtype=np.dtype([("n", "<3f4"), ("v", "<9f4"), ("a", "<u2")]))
    reg["n"] = n
    reg["v"] = t.reshape(-1, 9)
    with open(ruta, "wb") as f:
        f.write(nombre.encode("ascii")[:80].ljust(80, b" "))
        f.write(struct.pack("<I", len(t)))
        f.write(reg.tobytes())


# ---------------------------------------------------------------------------
# Cuerpos (cada uno en el marco de su junta, mm)
# ---------------------------------------------------------------------------
def cuerpos():
    rods = [(33.6, 33.6), (33.6, -33.6), (-33.6, 33.6), (-33.6, -33.6)]
    z_arriba = ZROD0 + ROD - H_PSUP
    abraz = [pieza("abrazadera", x, y, ZROD0 + H_PINF, math.atan2(y, x) - math.pi / 2) for x, y in rods]
    abraz += [pieza("abrazadera", x, y, z_arriba + H_PSUP - H_PSUP_DISK - 14, math.atan2(y, x) - math.pi / 2)
              for x, y in rods]
    c = {}
    # base fija
    c["base_link"] = ("negro", unir(pieza("base"), pieza("caja_uno", -188.5), pieza("tapa_uno", -188.5, 0, 5)))
    c["base_motor"] = ("motor", caja(42, 42, 40, -114, 34, H_BASE))
    # columna (gira con J1)
    c["columna"] = ("negro", unir(
        pieza("j1_coupler", z=H_BASE), pieza("placa_inf", z=ZROD0), pieza("tapa_base", z=ZROD0 + H_PINF),
        pieza("placa_sup", z=z_arriba), pieza("tapa_sup", z=z_arriba + H_PSUP - H_PSUP_DISK - H_TCOV), *abraz))
    c["columna_acero"] = ("acero", unir(*[cilindro(5, ROD, x, y, ZROD0) for x, y in rods],
                                        cilindro(4, ROD - 18, 33, 0, ZROD0 + 2)))
    c["columna_motor"] = ("motor", caja(42, 42, 40, 33, 0, z_arriba + H_PSUP))
    # plataforma Z + brazo 1 (sube con JZ)
    c["carro"] = ("negro", unir(pieza("plataforma"), pieza("arm1", z=H_PLAT - H_ARM1), pieza("arm1_tapa", z=H_PLAT)))
    c["carro_motor"] = ("motor", caja(42, 42, 40, -10, 0, H_PLAT))
    # brazo 2 (gira con J2)
    c["brazo2"] = ("negro", unir(pieza("j2_coupler", z=-H_J2C), pieza("arm2", z=ZA2)))
    c["brazo2_motor"] = ("motor", caja(42, 42, 24, 0, 0, ZA2 - 24))
    # cabezal (gira con J3)
    impresas = ["separador", "placa", "soporte", "puente", "porta_iman", "abrazadera"]
    c["cabezal"] = ("negro", unir(pieza("j3_coupler", z=-H_J3C, rz=GIRO_CONN), pieza("conector_j3", z=ZH, rz=GIRO_CONN),
                                  *[pieza_cabezal(k, Z_CAB) for k in impresas]))
    c["cabezal_iman"] = ("iman", unir(pieza_cabezal("electroiman", Z_CAB), pieza_cabezal("tornillos_m4", Z_CAB)))
    c["cabezal_sensor"] = ("sensor", pieza_cabezal("sensor", Z_CAB))
    c["cabezal_servo"] = ("servo", unir(pieza_cabezal("servo", Z_CAB), pieza_cabezal("horn", Z_CAB)))
    # plumon + collar (sube con JP); su origen es la punta del plumon
    plum = unir(pieza_cabezal("plumon", Z_CAB), pieza_cabezal("collar", Z_CAB))
    c["plumon"] = ("negro", plum - np.array(PUNTA))
    return c


# padre, tipo, junta, origen respecto al padre (mm)
ARBOL = {
    "base_motor": ("base_link", "fixed", "fijo_base_motor", (0, 0, 0)),
    "columna": ("base_link", "revolute", "J1", (0, 0, 0)),
    "columna_acero": ("columna", "fixed", "fijo_columna_acero", (0, 0, 0)),
    "columna_motor": ("columna", "fixed", "fijo_columna_motor", (0, 0, 0)),
    "carro": ("columna", "prismatic", "JZ", (0, 0, 0)),
    "carro_motor": ("carro", "fixed", "fijo_carro_motor", (0, 0, 0)),
    "brazo2": ("carro", "revolute", "J2", (L1, 0, H_PLAT - H_ARM1)),
    "brazo2_motor": ("brazo2", "fixed", "fijo_brazo2_motor", (0, 0, 0)),
    "cabezal": ("brazo2", "revolute", "J3", J3_ORIGEN),
    "cabezal_iman": ("cabezal", "fixed", "fijo_cabezal_iman", (0, 0, 0)),
    "cabezal_sensor": ("cabezal", "fixed", "fijo_cabezal_sensor", (0, 0, 0)),
    "cabezal_servo": ("cabezal", "fixed", "fijo_cabezal_servo", (0, 0, 0)),
    "plumon": ("cabezal", "prismatic", "JP", PUNTA),
}
LIMITES = {  # unidades del URDF (rad, m)
    "J1": (-math.radians(170), math.radians(170)),
    "JZ": (0.10, 0.21),
    "J2": (-math.radians(170), math.radians(170)),
    "J3": (-math.radians(175), math.radians(175)),
    "JP": (0.0, 0.020),
}


def urdf(c):
    m = lambda v: " ".join(f"{x / 1000:.6f}" for x in v)  # noqa: E731
    out = ['<?xml version="1.0"?>',
           "<!-- MathBot negro: SCARA HowToMechatronics + cabezal de disco v3. Generado por",
           "     matlab/avance2/fuente/exportar_modelo.py (no editar a mano). Unidades: m y rad.",
           f"     L1 = {L1} mm, L2 = {L2} mm, plumon a {R_HERR} mm de J3. TCP = origen del cuerpo 'plumon' (punta).",
           "     JZ = altura de la base de la plataforma sobre la mesa; con JZ = 0.1505 m y JP = 0 la punta toca la mesa.",
           "     Masas e inercias nominales: la simulacion es cinematica (movimiento impuesto en las juntas). -->",
           '<robot name="mathbot_negro">']
    for k, rgb in COLORES.items():
        out.append(f'  <material name="{k}"><color rgba="{rgb[0]} {rgb[1]} {rgb[2]} 1"/></material>')
    for nombre, (color, tris) in c.items():
        v = tris.reshape(-1, 3)
        cm = v.mean(0)
        ext = np.maximum(v.max(0) - v.min(0), 1.0) / 1000
        masa = 0.05 if "_" in nombre and nombre != "base_link" else 0.3
        ix = masa / 12 * (ext[1] ** 2 + ext[2] ** 2)
        iy = masa / 12 * (ext[0] ** 2 + ext[2] ** 2)
        iz = masa / 12 * (ext[0] ** 2 + ext[1] ** 2)
        out += [f'  <link name="{nombre}">',
                "    <inertial>",
                f'      <origin xyz="{m(cm)}" rpy="0 0 0"/>',
                f'      <mass value="{masa}"/>',
                f'      <inertia ixx="{ix:.4e}" ixy="0" ixz="0" iyy="{iy:.4e}" iyz="0" izz="{iz:.4e}"/>',
                "    </inertial>",
                "    <visual>",
                '      <origin xyz="0 0 0" rpy="0 0 0"/>',
                f'      <geometry><mesh filename="meshes/{nombre}.stl"/></geometry>',
                f'      <material name="{color}"/>',
                "    </visual>",
                "  </link>"]
    for hijo, (padre, tipo, junta, origen) in ARBOL.items():
        out += [f'  <joint name="{junta}" type="{tipo}">',
                f'    <parent link="{padre}"/>',
                f'    <child link="{hijo}"/>',
                f'    <origin xyz="{m(origen)}" rpy="0 0 0"/>']
        if tipo != "fixed":
            lo, hi = LIMITES[junta]
            out += ['    <axis xyz="0 0 1"/>',
                    f'    <limit lower="{lo:.5f}" upper="{hi:.5f}" effort="1000" velocity="10"/>']
        out.append("  </joint>")
    out.append("</robot>")
    return "\n".join(out) + "\n"


def main():
    c = cuerpos()
    carpeta = os.path.join(SALIDA, "meshes")
    os.makedirs(carpeta, exist_ok=True)
    info = {}
    for nombre, (color, tris) in c.items():
        escribir_stl(os.path.join(carpeta, nombre + ".stl"), tris, f"MathBot {nombre}")
        padre, tipo, junta, origen = ARBOL.get(nombre, ("", "raiz", "", (0, 0, 0)))
        info[nombre] = {"color": color, "rgb": COLORES[color], "padre": padre, "junta": junta, "tipo": tipo,
                        "origen_mm": [float(x) for x in origen], "triangulos": int(len(tris))}
        print(f"{nombre:15s} {color:7s} {len(tris):6d} triangulos")
    with open(os.path.join(SALIDA, "mathbot_negro.urdf"), "w", encoding="utf-8") as f:
        f.write(urdf(c))
    with open(os.path.join(carpeta, "cuerpos.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, indent=1, ensure_ascii=False)
    print(f"\nPunta del plumon respecto a J3: {PUNTA} mm")
    print(f"URDF: {os.path.join(SALIDA, 'mathbot_negro.urdf')}")


if __name__ == "__main__":
    main()
