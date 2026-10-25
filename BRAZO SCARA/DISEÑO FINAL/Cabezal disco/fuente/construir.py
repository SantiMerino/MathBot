"""
Exporta el cabezal A v3: STL (orientación de impresión) y STEP (marco del cabezal) de cada pieza
impresa, el subensamble del cabezal y el SCARA completo con el cabezal en lugar de la pinza.

    python construir.py              # piezas + subensamble + SCARA completo
    python construir.py --sin-scara  # sin el ensamble completo (el STEP de HTM tarda ~1.5 min en leerse)

Salida (carpeta 'Cabezal disco'):
    STL/NN_pieza.stl, STEP/NN_pieza.step, ensamble/Cabezal A v3.step,
    ensamble/SCARA con cabezal de disco.step, piezas.json (volumen, gramos, horas)
"""

from __future__ import annotations

import json
import math
import os
import sys

import cadquery as cq

import cabezal as C

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
STEP_HTM = os.path.normpath(os.path.join(RAIZ, "..", "SCARA Robot 3D Model.STEP"))

ARCHIVO = {
    "separador": "01_separador_brida",
    "placa": "02_placa_trebol",
    "soporte": "03_soporte_plumon_servo",
    "puente": "04_puente_plumon",
    "collar": "05_collar_plumon",
    "porta_iman": "06_separador_electroiman",
    "abrazadera": "07_abrazadera_sensor_M12",
}

# Ajustes de impresión por pieza (perímetros, relleno, notas)
IMPRESION = {
    "separador": ("PETG", 4, 40, "Sin soportes. Cejas hacia arriba. Tuercas M3 por abajo antes de montar."),
    "placa": ("PETG", 3, 30, "Boca abajo (cara superior en la cama). Sin soportes."),
    "soporte": ("PETG", 4, 40, "Pie en la cama. Ventana del servo: puente de 23 mm sin soporte."),
    "puente": ("PETG", 4, 40, "Boca abajo: el asiento del resorte queda arriba."),
    "collar": ("PETG", 4, 50, "Boca abajo (oreja en la cama). Tuerca M3 en el alojamiento lateral."),
    "porta_iman": ("PLA+", 3, 30, "Brida en la cama, copa hacia arriba. Chaflán de 42°, sin soportes."),
    "abrazadera": ("PLA+", 4, 40, "Cara de la placa en la cama. Tuercas M3 por abajo."),
}

DENSIDAD = {"PETG": 1.27, "PLA+": 1.24}
RENDIMIENTO_GH = 11.7          # g/h, el mismo de presupuesto/construir_presupuesto.py


def ascii_(t):
    """Nombre sin acentos ni símbolos para el STEP (SolidWorks y otros lectores los leen mal)."""
    import unicodedata
    t = t.replace("Ø", "D").replace("×", "x").replace("/", "-")
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()


def gramos(vol_cm3, area_cm2, material):
    """Mismo modelo que la hoja Impresión 3D: paredes y techos de 1.1 mm + 25 % de relleno."""
    cascara = area_cm2 * 0.11
    return DENSIDAD[material] * (min(cascara, vol_cm3) + 0.25 * max(0.0, vol_cm3 - cascara))


def exportar_piezas():
    os.makedirs(os.path.join(RAIZ, "STL"), exist_ok=True)
    os.makedirs(os.path.join(RAIZ, "STEP"), exist_ok=True)
    resumen = []
    for k, v in C.IMPRESAS.items():
        s = v["fn"]().val()
        assert s.isValid(), k
        base = ARCHIVO[k]
        cq.exporters.export(s, os.path.join(RAIZ, "STEP", base + ".step"))
        cama = C.a_cama(k, s)
        cq.exporters.export(cama, os.path.join(RAIZ, "STL", base + ".stl"), tolerance=0.01, angularTolerance=0.1)
        vol, area = s.Volume() / 1000, s.Area() / 100
        mat, per, rel, nota = IMPRESION[k]
        g = gramos(vol, area, mat)
        bb = cama.BoundingBox()
        resumen.append(dict(clave=k, archivo=base, nombre=v["nombre"], material=mat, perimetros=per, relleno=rel,
                            volumen_cm3=round(vol, 2), area_cm2=round(area, 1), gramos=round(g, 1),
                            horas=round(g / RENDIMIENTO_GH, 2), caja_mm=[round(bb.xlen, 1), round(bb.ylen, 1), round(bb.zlen, 1)],
                            nota=nota))
        print(f"  {base:28s} {vol:6.2f} cm³  {g:5.1f} g  {bb.xlen:5.1f}×{bb.ylen:5.1f}×{bb.zlen:5.1f} mm")
    with open(os.path.join(RAIZ, "piezas.json"), "w", encoding="utf-8") as f:
        json.dump(resumen, f, ensure_ascii=False, indent=1)
    return resumen


def subensamble(desp=0.0, helice=True):
    """cq.Assembly del cabezal en su marco (piezas impresas + compradas)."""
    a = cq.Assembly(name="Cabezal A v3")
    for k, (w, nombre, color) in C.impresas(desp).items():
        a.add(w.val(), name=ascii_(nombre), color=cq.Color(*color))
    for k, (w, nombre, color) in C.compradas(desp, helice=helice).items():
        a.add(w.val(), name=ascii_(nombre), color=cq.Color(*color))
    return a


# ---------------------------------------------------------------------------------------------
# Marco del cabezal en el ensamble de HTM (medido en el STEP)
# ---------------------------------------------------------------------------------------------
EJE_J3 = (367.63, -19.48)          # centro de la brida del J3 Coupler
EJE_J2 = (260.87, 65.57)           # centro del rodamiento 30x42 de J2
Z_CONN_INF = 148.1165              # cara inferior del Gripper to J3 connector
ANG_CONN = math.degrees(math.atan2(-14.815 + 24.14, 399.385 - 335.875))   # eje x' del connector (8.35°)
ANG_BRAZO2 = math.degrees(math.atan2(EJE_J3[1] - EJE_J2[1], EJE_J3[0] - EJE_J2[0]))   # J2 -> J3 (−38.55°)


def phi_en_step():
    """φ del cabezal tal como queda montado sobre el connector en la pose del STEP."""
    return (ANG_CONN - C.ALFA) - ANG_BRAZO2


def trsf_cabezal(phi=0.0):
    """gp_Trsf: marco del cabezal -> mundo con J3 girado a φ (plumón a φ grados del brazo 2)."""
    from OCP.gp import gp_Ax1, gp_Dir, gp_Pnt, gp_Trsf, gp_Vec
    r = gp_Trsf()
    r.SetRotation(gp_Ax1(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1)), math.radians(ANG_BRAZO2 + phi))
    t = gp_Trsf()
    t.SetTranslation(gp_Vec(EJE_J3[0], EJE_J3[1], Z_CONN_INF - C.DELTA))
    return t.Multiplied(r)


def trsf_giro_j3(dphi):
    from OCP.gp import gp_Ax1, gp_Dir, gp_Pnt, gp_Trsf
    r = gp_Trsf()
    r.SetRotation(gp_Ax1(gp_Pnt(EJE_J3[0], EJE_J3[1], 0), gp_Dir(0, 0, 1)), math.radians(dphi))
    return r


GIRAN_CON_J3 = ("J3 Coupler_J3 Coupler", "GT2 Pulley - 90 teeth - J3_GT2 Pulley - Parametric")


def ensamble_scara(salida, phi=0.0):
    """Reescribe el STEP de HTM: quita la pinza, deja el connector, gira J3 a φ y monta el cabezal."""
    from OCP.IFSelect import IFSelect_RetDone
    from OCP.Interface import Interface_Static
    from OCP.Quantity import Quantity_Color, Quantity_TOC_RGB
    from OCP.STEPCAFControl import STEPCAFControl_Reader, STEPCAFControl_Writer
    from OCP.STEPControl import STEPControl_AsIs
    from OCP.TCollection import TCollection_ExtendedString
    from OCP.TDataStd import TDataStd_Name
    from OCP.TDF import TDF_Label, TDF_LabelSequence
    from OCP.TDocStd import TDocStd_Document
    from OCP.TopLoc import TopLoc_Location
    from OCP.XCAFDoc import XCAFDoc_ColorType, XCAFDoc_DocumentTool

    doc = TDocStd_Document(TCollection_ExtendedString("MDTV-XCAF"))
    r = STEPCAFControl_Reader()
    r.SetNameMode(True)
    r.SetColorMode(True)
    assert r.ReadFile(STEP_HTM) == IFSelect_RetDone, STEP_HTM
    r.Transfer(doc)
    st = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    ct = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())

    def nombre(l):
        n = TDataStd_Name()
        return n.Get().ToExtString() if l.FindAttribute(TDataStd_Name.GetID_s(), n) else ""

    def ponnombre(l, t):
        TDataStd_Name.Set_s(l, TCollection_ExtendedString(ascii_(t)))

    def ref(c):
        x = TDF_Label()
        st.GetReferredShape_s(c, x)
        return x

    raices = TDF_LabelSequence()
    st.GetFreeShapes(raices)
    R = raices.Value(1)
    comps = TDF_LabelSequence()
    st.GetComponents_s(R, comps)
    dphi = phi - phi_en_step()
    giro = TopLoc_Location(trsf_giro_j3(dphi))
    pinza = conn_lab = conn_loc = None
    girar = []
    for i in range(1, comps.Length() + 1):
        c = comps.Value(i)
        n = nombre(ref(c))
        if n.startswith("Gripper Mechanism"):
            pinza = c
            sub = TDF_LabelSequence()
            st.GetComponents_s(ref(c), sub)
            for j in range(1, sub.Length() + 1):
                if nombre(ref(sub.Value(j))).startswith("Gripper to J3 connector"):
                    conn_lab = ref(sub.Value(j))
                    conn_loc = st.GetLocation_s(c).Multiplied(st.GetLocation_s(sub.Value(j)))
        elif n in GIRAN_CON_J3:
            girar.append((c, ref(c), n))
    assert pinza is not None and conn_lab is not None, "no se encontró la pinza o el connector"
    pinza_ref = ref(pinza)
    st.RemoveComponent(pinza)
    nuevo = st.AddComponent(R, conn_lab, giro.Multiplied(conn_loc))
    ponnombre(nuevo, "Gripper to J3 connector (brida del cabezal)")
    for c, lab, n in girar:
        loc = st.GetLocation_s(c)
        st.RemoveComponent(c)
        ponnombre(st.AddComponent(R, lab, giro.Multiplied(loc)), n.split("_")[0])
    # piezas de la pinza que quedaron sueltas
    st.RemoveShape(pinza_ref, True)
    libres = TDF_LabelSequence()
    st.GetFreeShapes(libres)
    for i in range(1, libres.Length() + 1):
        l = libres.Value(i)
        if not l.IsEqual(R) and not st.IsComponent_s(l):
            st.RemoveShape(l, True)

    # cabezal como subensamble
    cab = st.NewShape()
    ponnombre(cab, "Cabezal A v3 (disco tri-herramienta)")
    piezas = list(C.impresas(0.0).items()) + list(C.compradas(0.0, helice=True).items())
    for k, (w, nom, color) in piezas:
        lab = st.AddShape(w.val().wrapped, False)
        ponnombre(lab, nom)
        ct.SetColor(lab, Quantity_Color(*color, Quantity_TOC_RGB), XCAFDoc_ColorType.XCAFDoc_ColorSurf)
        ponnombre(st.AddComponent(cab, lab, TopLoc_Location()), nom)
    ponnombre(st.AddComponent(R, cab, TopLoc_Location(trsf_cabezal(phi))), "Cabezal A v3")
    st.UpdateAssemblies()

    Interface_Static.SetCVal_s("write.step.schema", "AP214")
    w = STEPCAFControl_Writer()
    w.SetNameMode(True)
    w.SetColorMode(True)
    w.Transfer(doc, STEPControl_AsIs)
    w.Write(salida)
    return dphi


def exportar_mallas_ensamble():
    """STL de cada pieza en el marco del cabezal (plumón abajo) + meta.json: los usa el panel de operario."""
    carpeta = os.path.join(RAIZ, "ensamble", "stl")
    os.makedirs(carpeta, exist_ok=True)
    meta = dict(piezas=[], z_conector=C.DELTA, levante=C.LEVANTE,
                horn=dict(eje=[C.PEN[0] + C.U_EJE_SERVO, C.Y_HORN, C.Z_EJE_SERVO], reposo=math.degrees(C.TH_REPOSO),
                          arriba=[[d, math.degrees(C.angulo_horn(d))] for d in (0, 3, 6, 9, 12, 15, 18)]),
                resorte=dict(z0=C.C_TRAZO + C.H_COLLAR - C.P_COLLAR, z1=C.Z_PUENTE + C.P_PUENTE))
    impresas = {v["nombre"]: (k, v) for k, v in C.IMPRESAS.items()}
    for k, (w, nombre, color) in list(C.impresas(0.0).items()) + list(C.compradas(0.0, helice=False).items()):
        info = dict(clave=k, nombre=nombre, color=color, impresa=nombre in impresas)
        if k == "resorte":                       # el panel lo dibuja como hélice (la del CAD pesa 4 MB)
            info.update(helice=dict(d=C.RESORTE["d_ext"], alambre=C.RESORTE["alambre"], vueltas=8))
            meta["piezas"].append(info)
            continue
        cq.exporters.export(w.val(), os.path.join(carpeta, k + ".stl"), tolerance=0.05, angularTolerance=0.3)
        if nombre in impresas:
            info.update(archivo=ARCHIVO[impresas[nombre][0]], material=IMPRESION[impresas[nombre][0]][0])
        meta["piezas"].append(info)
    with open(os.path.join(carpeta, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print("Mallas del ensamble: ensamble/stl/ (" + str(len(meta["piezas"])) + " piezas)")


def main():
    print("Piezas impresas:")
    exportar_piezas()
    os.makedirs(os.path.join(RAIZ, "ensamble"), exist_ok=True)
    sub = subensamble(0.0)
    sub.export(os.path.join(RAIZ, "ensamble", "Cabezal A v3.step"))
    print("Subensamble: ensamble/Cabezal A v3.step")
    exportar_mallas_ensamble()
    if "--sin-scara" not in sys.argv:
        dphi = ensamble_scara(os.path.join(RAIZ, "ensamble", "SCARA con cabezal de disco.step"), phi=0.0)
        print(f"SCARA completo: J3 girado {dphi:+.2f}° desde la pose del STEP (φ = 0, plumón sobre la línea del brazo 2)")


if __name__ == "__main__":
    main()
