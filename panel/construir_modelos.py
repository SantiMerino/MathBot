"""
Empaqueta las mallas del panel de operario en panel/modelos.js (un módulo que el navegador carga sin servidor
de archivos especial).

    python panel/construir_modelos.py

Toma las STL del SCARA de HowToMechatronics (mismas transformaciones que el simulador) y las del cabezal A v3
en su marco (BRAZO SCARA/DISEÑO FINAL/Cabezal disco/ensamble/stl, las escribe fuente/construir.py).
"""

from __future__ import annotations

import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "python"))
import construir_simulador_scara as sim  # noqa: E402

CABEZAL = os.path.join(RAIZ, "BRAZO SCARA", "DISEÑO FINAL", "Cabezal disco")
ROBOT = ["base", "j1_coupler", "placa_inf", "tapa_base", "placa_sup", "tapa_sup", "abrazadera", "plataforma",
         "arm1", "arm1_tapa", "j2_coupler", "arm2", "j3_coupler", "conector_j3", "caja_uno", "tapa_uno"]


def main():
    robot = {}
    for nombre in ROBOT:
        archivo, mapeo, centro, volteado = sim.PIEZAS[nombre]
        tris = sim.leer_stl(os.path.join(sim.DIR_STL, archivo))
        robot[nombre] = sim.empaquetar(sim.transformar(tris, mapeo, centro, volteado))
    carpeta = os.path.join(CABEZAL, "ensamble", "stl")
    meta = json.load(open(os.path.join(carpeta, "meta.json"), encoding="utf-8"))
    piezas = {p["archivo"]: p for p in json.load(open(os.path.join(CABEZAL, "piezas.json"), encoding="utf-8"))}
    cabezal = {}
    for p in meta["piezas"]:
        if p.get("archivo") in piezas:
            d = piezas[p["archivo"]]
            p.update(gramos=d["gramos"], horas=d["horas"], perimetros=d["perimetros"], relleno=d["relleno"], nota=d["nota"])
        ruta = os.path.join(carpeta, p["clave"] + ".stl")
        if os.path.exists(ruta):
            cabezal[p["clave"]] = sim.empaquetar(sim.leer_stl(ruta))
    salida = os.path.join(RAIZ, "panel", "modelos.js")
    with open(salida, "w", encoding="utf-8") as f:
        f.write("// Generado por panel/construir_modelos.py: no editar a mano.\n")
        f.write("export const ROBOT = " + json.dumps(robot, separators=(",", ":")) + ";\n")
        f.write("export const CABEZAL = " + json.dumps(cabezal, separators=(",", ":")) + ";\n")
        f.write("export const META = " + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"{salida}  ({os.path.getsize(salida) / 1e6:.2f} MB, {len(robot)} piezas del robot, {len(cabezal)} del cabezal)")


if __name__ == "__main__":
    main()
