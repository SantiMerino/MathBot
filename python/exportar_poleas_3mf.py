"""
Exporta las poleas GT2 impresas del SCARA de HowToMechatronics a 3MF para Orca.

Las STL del artículo salen de SolidWorks con el eje de la polea en +Y. Aquí se gira cada polea para que
su cara plana más grande quede sobre la cama (z = 0), centrada en x = y = 0, y se escribe un 3MF con
vértices compartidos (malla cerrada) y el nombre de la pieza.

    python python/exportar_poleas_3mf.py

Salida: BRAZO SCARA/DISEÑO FINAL/Poleas 3MF/NN_pieza.3mf
"""

import os
import zipfile
from xml.sax.saxutils import quoteattr

import numpy as np
import trimesh

RAIZ = os.path.join(os.path.dirname(__file__), "..", "BRAZO SCARA", "DISEÑO FINAL")
ORIGEN = os.path.join(RAIZ, "SCARA Robot Arm - STL Files - updated")
DESTINO = os.path.join(RAIZ, "Poleas 3MF")

# (STL del artículo, nombre de salida, cantidad)
POLEAS = [
    ("GT2 Pulley - Parametric.STL", "01_polea_motor_20T_x3", 3),
    ("GT2 Pulley - 22 - 80 teeth.STL", "02_polea_intermedia_J1_22-80T", 1),
    ("GT2 Pulley - 110 teeth - J1.STL", "03_polea_J1_110T", 1),
    ("GT2 Pulley - 23 - 80 teeth.STL", "04_polea_intermedia_J2_23-80T", 1),
    ("GT2 Pulley - 92 teeth - J2.STL", "05_polea_J2_92T", 1),
    ("GT2 Pulley - 90 teeth - J3.STL", "06_polea_J3_90T", 1),
]


def a_cama(m):
    """Gira el eje de la polea (+Y) a Z y deja abajo la cara plana de mayor área."""
    y = m.vertices[:, 1]
    n, c, a = m.face_normals[:, 1], m.triangles_center[:, 1], m.area_faces
    abajo = a[(n < -0.99) & (np.abs(c - y.min()) < 1e-3)].sum()
    arriba = a[(n > 0.99) & (np.abs(c - y.max()) < 1e-3)].sum()
    # Rx(+90°) lleva +Y a +Z (la cara de y mínimo queda abajo); Rx(−90°) lleva +Y a −Z.
    ang = np.pi / 2 if abajo >= arriba else -np.pi / 2
    m.apply_transform(trimesh.transformations.rotation_matrix(ang, [1, 0, 0]))
    lo, hi = m.bounds
    m.apply_translation([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])
    return m


def exportar_3mf(m, ruta, nombre, copias=1):
    """3MF con vértices compartidos; con copias > 1 pone varias instancias en fila sobre la cama."""
    modelo = ['<?xml version="1.0" encoding="UTF-8"?>\n'
              '<model unit="millimeter" xml:lang="es-ES" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
              f'<resources><object id="1" name={quoteattr(nombre)} type="model"><mesh><vertices>']
    modelo += [f'<vertex x="{x:.5f}" y="{y:.5f}" z="{z:.5f}"/>' for x, y, z in m.vertices]
    modelo.append("</vertices><triangles>")
    modelo += [f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in m.faces]
    modelo.append("</triangles></mesh></object></resources><build>")
    paso = m.extents[0] + 8
    for i in range(copias):
        dx = (i - (copias - 1) / 2) * paso
        modelo.append(f'<item objectid="1" transform="1 0 0 0 1 0 0 0 1 {dx:.3f} 0 0"/>')
    modelo.append("</build></model>")
    with zipfile.ZipFile(ruta, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml",
                   '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
        z.writestr("_rels/.rels",
                   '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
                   'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
        z.writestr("3D/3dmodel.model", "".join(modelo))


def main():
    os.makedirs(DESTINO, exist_ok=True)
    for stl, nombre, copias in POLEAS:
        m = trimesh.load(os.path.join(ORIGEN, stl), force="mesh")
        m.merge_vertices()
        assert m.is_watertight, stl
        a_cama(m)
        exportar_3mf(m, os.path.join(DESTINO, nombre + ".3mf"), nombre, copias)
        d, h = m.extents[0], m.extents[2]
        print(f"{nombre}.3mf  Ø{d:.1f} × {h:.1f} mm  ×{copias}  {m.volume / 1000:.1f} cm³ c/u")


if __name__ == "__main__":
    main()
