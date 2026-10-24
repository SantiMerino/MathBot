"""
Imágenes PNG del cabezal sin software CAD (VTK fuera de pantalla).

    python render.py            # todas las vistas en ../img
"""

from __future__ import annotations

import math
import os

import vtk
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.normpath(os.path.join(AQUI, "..", "img"))


def _poly(shape, tol=0.02):
    return shape.toVtkPolyData(tol, 0.08)


def escena(items, archivo, az=35.0, el=25.0, tam=(1400, 1000), zoom=1.0, fondo=(1, 1, 1), aristas=True,
           foco=None, dist=None, paralela=False):
    """Renderiza [(shape, (r, g, b), opacidad)] y guarda un PNG. az/el en grados desde +x/+y."""
    ren = vtk.vtkRenderer()
    ren.SetBackground(*fondo)
    win = vtk.vtkRenderWindow()
    win.SetOffScreenRendering(1)
    win.SetMultiSamples(8)
    win.AddRenderer(ren)
    win.SetSize(*tam)
    for shape, color, alfa in items:
        pd = _poly(shape)
        normales = vtk.vtkPolyDataNormals()
        normales.SetInputData(pd)
        normales.SetFeatureAngle(35)
        normales.SplittingOn()
        m = vtk.vtkPolyDataMapper()
        m.SetInputConnection(normales.GetOutputPort())
        a = vtk.vtkActor()
        a.SetMapper(m)
        p = a.GetProperty()
        p.SetColor(*color)
        p.SetOpacity(alfa)
        p.SetAmbient(0.25)
        p.SetDiffuse(0.75)
        p.SetSpecular(0.15)
        p.SetSpecularPower(20)
        ren.AddActor(a)
        if aristas and alfa > 0.5:
            fe = vtk.vtkFeatureEdges()
            fe.SetInputData(pd)
            fe.BoundaryEdgesOn()
            fe.FeatureEdgesOn()
            fe.SetFeatureAngle(35)
            fe.ManifoldEdgesOff()
            fe.NonManifoldEdgesOff()
            me = vtk.vtkPolyDataMapper()
            me.SetInputConnection(fe.GetOutputPort())
            me.ScalarVisibilityOff()
            ae = vtk.vtkActor()
            ae.SetMapper(me)
            ae.GetProperty().SetColor(*(c * 0.35 for c in color))
            ae.GetProperty().SetLineWidth(1.2)
            ren.AddActor(ae)
    cam = ren.GetActiveCamera()
    cam.SetViewUp(0, 0, 1)
    ren.ResetCamera()
    if foco is not None:
        cam.SetFocalPoint(*foco)
    f = cam.GetFocalPoint()
    d = dist or cam.GetDistance()
    import math
    a, e = math.radians(az), math.radians(el)
    cam.SetPosition(f[0] + d * math.cos(e) * math.cos(a), f[1] + d * math.cos(e) * math.sin(a), f[2] + d * math.sin(e))
    cam.SetViewUp(*((0, 1, 0) if el > 89 else (0, 0, 1)))
    if paralela:
        cam.ParallelProjectionOn()
    if foco is None:
        ren.ResetCamera()
    cam.Zoom(zoom)
    ren.ResetCameraClippingRange()
    luz = vtk.vtkLightKit()
    luz.AddLightsToRenderer(ren)
    win.Render()
    w2i = vtk.vtkWindowToImageFilter()
    w2i.SetInput(win)
    w2i.ReadFrontBufferOff()
    w2i.Update()
    png = vtk.vtkPNGWriter()
    png.SetFileName(archivo)
    png.SetInputConnection(w2i.GetOutputPort())
    png.Write()
    return archivo


def _fuente(t):
    for f in ("arial.ttf", "DejaVuSans.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(f, t)
        except OSError:
            continue
    return ImageFont.load_default()


def rotular(archivo, titulo, sub=None, notas=()):
    """Agrega título, subtítulo y notas (x, y, texto) a un PNG."""
    im = Image.open(archivo).convert("RGBA")
    capa = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(capa).rectangle((0, 0, im.width, 100 if sub else 70), fill=(255, 255, 255, 215))
    im = Image.alpha_composite(im, capa).convert("RGB")
    d = ImageDraw.Draw(im)
    d.text((28, 22), titulo, fill=(25, 35, 50), font=_fuente(34))
    if sub:
        d.text((28, 66), sub, fill=(90, 100, 115), font=_fuente(20))
    for x, y, t in notas:
        d.text((x, y), t, fill=(40, 40, 40), font=_fuente(18))
    im.save(archivo)


def hoja(archivos, titulos, salida, cols=4, celda=(520, 420), titulo=None):
    """Junta varias imágenes en una hoja con su nombre debajo."""
    filas = (len(archivos) + cols - 1) // cols
    top = 70 if titulo else 0
    im = Image.new("RGB", (cols * celda[0], top + filas * (celda[1] + 40)), "white")
    d = ImageDraw.Draw(im)
    if titulo:
        d.text((24, 18), titulo, fill=(25, 35, 50), font=_fuente(30))
    for i, (a, t) in enumerate(zip(archivos, titulos)):
        x, y = (i % cols) * celda[0], top + (i // cols) * (celda[1] + 40)
        p = Image.open(a).convert("RGB")
        p.thumbnail(celda)
        im.paste(p, (x + (celda[0] - p.width) // 2, y))
        d.text((x + 16, y + celda[1] + 6), t, fill=(30, 30, 30), font=_fuente(19))
    im.save(salida)
    return salida


# =============================================================================================
# Vistas del cabezal A v3
# =============================================================================================

DESPIECE = {   # desplazamiento (mm, marco del cabezal) de cada pieza en el despiece
    "Separador de brida": (0, 0, 45), "Placa trébol": (0, 0, 0), "Soporte del plumón y del servo": (0, 0, 22),
    "Collar del plumón": (0, 0, 46), "Resorte Ø16 × 30": (0, 0, 62), "Puente del plumón": (0, 0, 84),
    "Plumón Sharpie fino": (0, 0, -80), "Micro servo SG90 / MG90S": (0, 40, 22), "Brazo simple del servo": (0, 18, 22),
    "Separador del electroimán": ("iman", 28, -22), "Electroimán KK-P20/15": ("iman", 28, -48),
    "Abrazadera M12 del sensor": ("sensor", 28, -22), "Sensor inductivo LJ12A3-4-Z/BX": ("sensor", 28, -60),
}


def _piezas(desp=0.0):
    import cabezal as C
    out = []
    for k, (w, n, c) in list(C.impresas(desp).items()) + list(C.compradas(desp, helice=True).items()):
        out.append((n, w.val(), c))
    return out


def _mover(nombre, s):
    import cadquery as cq
    import cabezal as C
    d = DESPIECE.get(nombre)
    if d is None:
        return s.translate(cq.Vector(0, 0, -45)) if nombre.startswith("Pernos") else s
    if isinstance(d[0], str):
        a = math.radians(C.PHI[d[0]])
        return s.translate(cq.Vector(d[1] * math.cos(a), d[1] * math.sin(a), d[2]))
    return s.translate(cq.Vector(*d))


def vistas_cabezal():
    import cadquery as cq
    import cabezal as C
    import construir as K
    os.makedirs(IMG, exist_ok=True)
    # 1. piezas en orientación de impresión
    arch, tit = [], []
    for k, v in C.IMPRESAS.items():
        f = os.path.join(IMG, f"_cama_{k}.png")
        escena([(C.a_cama(k, v["fn"]().val()), v["color"], 1.0)], f, az=-55, el=32, tam=(900, 720), zoom=1.05)
        arch.append(f)
        tit.append(K.ARCHIVO[k][:2] + " · " + v["nombre"])
    hoja(arch, tit, os.path.join(IMG, "piezas_impresion.png"), cols=4,
         titulo="Cabezal A v3 · piezas impresas en su orientación de impresión (sin soportes)")
    for f in arch:
        os.remove(f)
    # 2. ensamble y despiece
    p0 = _piezas(0.0)
    f = escena([(s, c, 1.0) for n, s, c in p0], os.path.join(IMG, "cabezal_ensamble.png"), az=-62, el=24, zoom=1.15)
    rotular(f, "Cabezal A v3 · ensamble", "Plumón abajo (φ = 0). Placa trébol de 6 mm, 14 mm bajo el connector; herramientas a 55 mm del eje J3")
    f = escena([(s, c, 1.0) for n, s, c in p0], os.path.join(IMG, "cabezal_ensamble_abajo.png"), az=120, el=-28, zoom=1.15)
    rotular(f, "Cabezal A v3 · vista inferior", "Electroimán (120°), sensor (240°) y guía del plumón (0°)")
    f = escena([(_mover(n, s), c, 1.0) for n, s, c in p0], os.path.join(IMG, "cabezal_despiece.png"), az=-62, el=20, zoom=1.0)
    rotular(f, "Cabezal A v3 · despiece", "Cada pieza sale por su eje de montaje")
    # 3. levante del plumón (corte por el plano del brazo del servo)
    lados = []
    for desp, t in ((0.0, "Plumón abajo (trazo)"), (C.LEVANTE, "Plumón arriba (+%.0f mm)" % C.LEVANTE)):
        corte = cq.Solid.makeBox(200, 200, 200, cq.Vector(-50, C.Y_HORN - 0.8 - 200, -100))
        items = []
        for n, s, c in _piezas(desp):
            if n in ("Placa trébol", "Soporte del plumón y del servo", "Collar del plumón"):
                items.append((s.cut(corte), c, 1.0))              # cortadas en el plano del brazo del servo
            elif n in ("Plumón Sharpie fino", "Resorte Ø16 × 30", "Puente del plumón"):
                items.append((s, c, 0.22))                         # enteras y translúcidas
            elif n in ("Brazo simple del servo", "Micro servo SG90 / MG90S"):
                items.append((s, c, 1.0))
        f = os.path.join(IMG, "_lado_%d.png" % int(desp))
        escena(items, f, az=-90, el=0, foco=(C.PEN[0] + 4, 0, 12), dist=400, paralela=True, zoom=2.6, tam=(900, 1000))
        rotular(f, t)
        lados.append(f)
    hoja(lados, ["", ""], os.path.join(IMG, "levante_plumon.png"), cols=2, celda=(900, 1000),
         titulo="Levante: el brazo del servo (%.0f° → %+.0f°) sube la oreja del collar; el resorte da la fuerza de trazo"
         % (math.degrees(C.TH_REPOSO), math.degrees(C.TH_ARRIBA)))
    for f in lados:
        os.remove(f)


def vistas_j3():
    """Cabezal bajo el brazo 2 en φ = −120 / 0 / +120 (vista superior)."""
    import cadquery as cq
    import verificar as V
    htm = V.piezas_htm()
    gris, azul = (0.62, 0.66, 0.72), (0.23, 0.45, 0.75)
    arch = []
    for phi in (-120, 0, 120):
        items = []
        for n, (gira, s) in htm.items():
            s = s.rotate(cq.Vector(0, 0, 0), cq.Vector(0, 0, 1), phi) if gira else s
            color = (0.85, 0.2, 0.2) if n.startswith("Final") else (azul if gira else gris)
            items.append((s, color, 1.0 if gira or n.startswith("Final") else 0.35))
        for n, s, c in _piezas(0.0 if phi == 0 else 18.0):
            items.append((s.rotate(cq.Vector(0, 0, 0), cq.Vector(0, 0, 1), phi), c, 1.0))
        f = os.path.join(IMG, "_j3_%d.png" % phi)
        escena(items, f, az=-90, el=89.95, foco=(-15, 0, 0), dist=600, paralela=True, zoom=1.45, tam=(800, 800))
        arch.append(f)
    hoja(arch, ["φ = −120° · electroimán al frente (plumón arriba)", "φ = 0° · plumón al frente",
                "φ = +120° · sensor al frente (plumón arriba)"],
         os.path.join(IMG, "j3_poses.png"), cols=3, celda=(800, 800),
         titulo="Vista superior bajo el brazo 2 (gris translúcido); final de carrera de J3 en rojo")
    for f in arch:
        os.remove(f)


def vista_scara():
    """SCARA completo (ensamble/SCARA con cabezal de disco.step)."""
    import cadquery as cq
    from OCP.STEPCAFControl import STEPCAFControl_Reader
    from OCP.TDocStd import TDocStd_Document
    from OCP.TCollection import TCollection_ExtendedString
    from OCP.XCAFDoc import XCAFDoc_DocumentTool
    from OCP.TDF import TDF_LabelSequence, TDF_Label
    from OCP.TDataStd import TDataStd_Name
    from OCP.TopLoc import TopLoc_Location
    import construir as K
    import cabezal as C
    f = os.path.join(K.RAIZ, "ensamble", "SCARA con cabezal de disco.step")
    doc = TDocStd_Document(TCollection_ExtendedString("doc"))
    r = STEPCAFControl_Reader()
    r.SetNameMode(True)
    r.ReadFile(f)
    r.Transfer(doc)
    st = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())

    def nombre(l):
        n = TDataStd_Name()
        return n.Get().ToExtString() if l.FindAttribute(TDataStd_Name.GetID_s(), n) else ""

    colores = {K.ascii_(v["nombre"]): v["color"] for v in C.IMPRESAS.values()}
    for k, (w, n, c) in C.compradas().items():
        colores[K.ascii_(n)] = c
    items = []

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
        if n.startswith(("Laser", "Arduino")):
            return
        s = cq.Shape.cast(st.GetShape_s(l).Moved(loc))
        metal = any(t in n for t in ("Bolt", "nut", "Nut", "Rod", "Screw", "Bearing", "Stepper", "Washer", "Belt", "switch"))
        items.append((s, colores.get(n, (0.55, 0.57, 0.6) if metal else (0.33, 0.55, 0.82)), 1.0))

    roots = TDF_LabelSequence()
    st.GetFreeShapes(roots)
    for i in range(1, roots.Length() + 1):
        rec(roots.Value(i), TopLoc_Location())
    g = escena(items, os.path.join(IMG, "scara_con_cabezal.png"), az=-125, el=22, zoom=1.1, tam=(1500, 1100))
    rotular(g, "SCARA de HTM con el cabezal A v3 en J3", "ensamble/SCARA con cabezal de disco.step · φ = 0 (plumón sobre la línea del brazo 2)")
    g = escena(items, os.path.join(IMG, "scara_detalle_j3.png"), az=-115, el=8, foco=(372, -25, 140), dist=330, zoom=1.0, tam=(1400, 1000))
    rotular(g, "Detalle de J3", "Brida (Gripper to J3 connector) + separador de 14 mm + placa trébol")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, AQUI)
    vistas_cabezal()
    vistas_j3()
    if "--sin-scara" not in sys.argv:
        vista_scara()
    print("imágenes en", IMG)
