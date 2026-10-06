"""
Empaqueta las STL del SCARA (HowToMechatronics) dentro del simulador web.

Lee `simulador_scara/plantilla.html`, transforma cada STL al marco de su
articulacion (eje vertical = z, eje de la junta en el origen) y las incrusta
cuantizadas en `simulador_scara/simulador_scara.html` (un solo archivo que se
abre con doble clic, sin servidor).

Uso (desde python/):
    python construir_simulador_scara.py
"""

from __future__ import annotations

import base64
import json
import os
import struct

import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR_STL = os.path.join(RAIZ, "BRAZO SCARA", "DISEÑO FINAL", "SCARA Robot Arm - STL Files - updated")
DIR_SIM = os.path.join(RAIZ, "simulador_scara")

# nombre -> (archivo, mapeo, centro (x_stl, z_stl) del eje, volteado)
#   mapeo "A": X = x - cx, Y = -(z - cz), Z = y      (piezas largas: brazos, base, couplers)
#   mapeo "B": X = z - cz, Y = x - cx,   Z = y       (placas de la columna Z)
# Los centros salen de los agujeros de rodamiento medidos en cada STL.
PIEZAS = {
    "base": ("Base.STL", "A", (150.0, 70.0), False),
    "j1_coupler": ("J1 coupler.STL", "A", (60.0, 60.0), False),
    "placa_inf": ("Z-axis Bottom Plate.STL", "B", (60.0, 60.0), False),
    "placa_sup": ("Z-axis Top Plate.STL", "B", (60.0, 60.0), False),
    "plataforma": ("Z-axis Mount Platform.STL", "B", (60.0, 60.0), False),
    "arm1": ("Arm 1.STL", "A", (-62.0, 39.0), False),
    "arm1_tapa": ("Arm 1 Cover.STL", "A", (-62.0, 39.0), True),
    "j2_coupler": ("J2 Coupler.STL", "A", (39.0, 39.0), False),
    "arm2": ("Arm 2.STL", "A", (39.0, 39.0), False),
    "j3_coupler": ("J3 Coupler.STL", "A", (39.0, 39.0), False),
    "conector_j3": ("Gripper to J3 connector.STL", "A", (19.5, 39.0), False),
    # Tapas de la columna: el agujero del husillo (93, 60) queda en x = +33 como en las placas
    "tapa_base": ("Base cover.STL", "A", (60.0, 60.0), True),
    "tapa_sup": ("Top cover.STL", "A", (60.0, 60.0), False),
    "abrazadera": ("Smooth Rod Clamp.STL", "A", (19.54, 16.40), False),
    "caja_uno": ("Arduino UNO case p1.STL", "A", (37.5, 45.0), False),
    "tapa_uno": ("Arduino UNO case p2.STL", "A", (33.0, 45.0), False),
    # Poleas GT2 (centro = eje). Volteadas las que llevan el cubo hacia arriba.
    "polea_110": ("GT2 Pulley - 110 teeth - J1.STL", "A", (36.0, 36.0), True),
    "polea_22_80": ("GT2 Pulley - 22 - 80 teeth.STL", "A", (26.4, 26.4), False),
    "polea_23_80": ("GT2 Pulley - 23 - 80 teeth.STL", "A", (26.4, 26.4), True),
    "polea_92": ("GT2 Pulley - 92 teeth - J2.STL", "A", (30.2, 30.2), False),
    "polea_90": ("GT2 Pulley - 90 teeth - J3.STL", "A", (29.6, 29.6), False),
    "polea_20": ("GT2 Pulley - Parametric.STL", "A", (7.3, 7.3), False),
}


def leer_stl(ruta: str) -> np.ndarray:
    b = open(ruta, "rb").read()
    if b[:5] == b"solid" and b"facet" in b[:300]:
        v = [list(map(float, ln.split()[1:4])) for ln in b.decode(errors="ignore").splitlines()
             if ln.strip().startswith("vertex")]
        return np.array(v, float).reshape(-1, 3, 3)
    n = struct.unpack("<I", b[80:84])[0]
    d = np.frombuffer(b[84:84 + n * 50], dtype=np.dtype([("n", "<3f4"), ("v", "<9f4"), ("a", "<u2")]))
    return d["v"].reshape(-1, 3, 3).astype(float)


def transformar(tris: np.ndarray, mapeo: str, centro, volteado: bool) -> np.ndarray:
    x, y, z = tris[..., 0], tris[..., 1], tris[..., 2]
    u, w = x - centro[0], z - centro[1]
    if mapeo == "A":
        X, Y = u, -w
    else:
        X, Y = w, u
    Z = y
    if volteado:  # giro de 180 deg alrededor de X: conserva la orientacion de las caras
        Y, Z = -Y, y.max() - y
    return np.stack([X, Y, Z], -1)


def empaquetar(tris: np.ndarray) -> dict:
    v = tris.reshape(-1, 3).astype(np.float64)
    lo, hi = v.min(0), v.max(0)
    span = np.where(hi - lo > 0, hi - lo, 1.0)
    q = np.round((v - lo) / span * 65535).astype("<u2")
    return {
        "lo": np.round(lo, 4).tolist(),
        "span": np.round(span, 4).tolist(),
        "n": int(len(tris)),
        "q": base64.b64encode(q.tobytes()).decode("ascii"),
    }


def main():
    datos = {}
    for nombre, (archivo, mapeo, centro, volteado) in PIEZAS.items():
        tris = leer_stl(os.path.join(DIR_STL, archivo))
        datos[nombre] = empaquetar(transformar(tris, mapeo, centro, volteado))
        print(f"{nombre:12s} {archivo:32s} {len(tris):6d} triangulos")

    plantilla = open(os.path.join(DIR_SIM, "plantilla.html"), encoding="utf-8").read()
    html = plantilla.replace("__STL_DATA__", json.dumps(datos, separators=(",", ":")))
    salida = os.path.join(DIR_SIM, "simulador_scara.html")
    with open(salida, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"\nSimulador: {salida}  ({os.path.getsize(salida) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
