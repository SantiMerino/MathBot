"""
Simulacion del SCARA MathBot dibujando la rosa de 3 petalos con el plumon del
cabezal tri-herramienta. Genera figuras para el informe y un CSV con angulos y
pasos de motor.

Uso (desde python/):
    python simular_scara.py              # figuras + CSV
    python simular_scara.py --gif        # ademas GIF animado (vista XY + 3D)
    python simular_scara.py --varilla 220

Salida: figuras/scara_*.png, figuras/scara_waypoints.csv, figuras/scara_animacion.gif
"""

from __future__ import annotations

import argparse
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.patches import Circle, Polygon, Rectangle, Wedge  # noqa: E402

import scara_modelo as m  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figuras")
C_ARM1 = "#2f6db5"
C_ARM2 = "#4f9be0"
C_PEN = "#d1495b"
C_MAG = "#6c757d"
C_SEN = "#2a9d8f"


# ---------------------------------------------------------------------------
def huella_base():
    """Contorno (x, y) de Base.STL en el marco del robot (eje J1 en el origen)."""
    # Base.STL: 215 x 140 mm, eje J1 en (150, 70); frente redondeado r = 70
    x0, x1, half = -150.0, 65.0 - 70.0, 70.0
    ang = np.linspace(-np.pi / 2, np.pi / 2, 30)
    arco = np.c_[x1 + 70 * np.cos(ang), 70 * np.sin(ang)]
    return np.vstack([[x0, -half], arco, [x0, half]])


def simular(v=25.0, dt=0.02):
    cab = m.Cabezal()
    tiempo, tpar, x, y, largo = m.rosa_por_arco(v, dt)
    th1, th2, phi = m.ik_herramienta(x, y, cab.pluma, 0.0, m.CODO)
    j2, j3, tip = m.fk(th1, th2, phi, cab.pluma)
    return dict(cab=cab, t=tiempo, tpar=tpar, x=x, y=y, largo=largo, th1=th1, th2=th2,
                phi=phi, j2=j2, j3=j3, tip=tip)


def _ejes_xy(ax, lim=(-170, 440, -330, 330)):
    ax.set_aspect("equal")
    ax.set_xlim(lim[0], lim[1])
    ax.set_ylim(lim[2], lim[3])
    ax.grid(True, alpha=0.25)
    ax.set_xlabel("x (mm)")
    ax.set_ylabel("y (mm)")


def _dibujar_robot_xy(ax, th1, th2, phi, cab, alpha=1.0, lw=1.0, detalle=True):
    j2, j3, _ = m.fk(th1, th2, phi)
    psi = np.deg2rad(th1 + th2 + phi)
    ax.plot([0, j2[0]], [0, j2[1]], "-", color=C_ARM1, lw=9 * lw, alpha=alpha,
            solid_capstyle="round", zorder=3)
    ax.plot([j2[0], j3[0]], [j2[1], j3[1]], "-", color=C_ARM2, lw=7 * lw, alpha=alpha,
            solid_capstyle="round", zorder=4)
    if detalle:
        ax.add_patch(Circle(j3, 39, fc="none", ec="#555", lw=0.8, alpha=alpha, zorder=5))
        for h, c in zip(cab.herramientas(), (C_PEN, C_MAG, C_SEN)):
            a = psi + np.deg2rad(h.phi_deg)
            p = j3 + h.radio_mm * np.array([np.cos(a), np.sin(a)])
            ax.plot([j3[0], p[0]], [j3[1], p[1]], "-", color="#888", lw=1, alpha=alpha, zorder=5)
            ax.add_patch(Circle(p, 8 if h is cab.pluma else 10, fc=c, ec="k", lw=0.5,
                                alpha=alpha, zorder=6))
        for p in ([0, 0], j2, j3):
            ax.add_patch(Circle(p, 6, fc="white", ec="k", lw=1, alpha=alpha, zorder=7))


def fig_espacio_trabajo(s):
    cab = s["cab"]
    le, _ = m.largo_equivalente(cab.pluma)
    fig, ax = plt.subplots(figsize=(8.5, 8))
    r_out = m.L1_MM + le
    th2m = np.deg2rad(140)
    r_in = np.sqrt(m.L1_MM**2 + le**2 + 2 * m.L1_MM * le * np.cos(th2m))
    ax.add_patch(Wedge((0, 0), r_out, -150, 150, width=r_out - r_in, fc="#e8f1fb", ec="#9cc3ea",
                       lw=1, label="Alcance del plumon (|θ2| ≤ 140°, |θ1| ≤ 150°)"))
    ax.add_patch(Polygon(huella_base(), fc="#c9d6e3", ec="#456", lw=1, label="Base (Base.STL)"))
    ax.add_patch(Rectangle((-60, -60), 120, 120, fc="#9fb3c8", ec="#456", lw=1,
                           label="Columna Z (placas 120×120)"))
    cx, cy = m.CENTRO_ROSA
    xr, yr = s["x"], s["y"]
    hx = [xr.min() - 20, xr.max() + 20]
    hy = [yr.min() - 20, yr.max() + 20]
    ax.add_patch(Rectangle((hx[0], hy[0]), hx[1] - hx[0], hy[1] - hy[0], fc="#fffdf5",
                           ec="#b59f6b", lw=1, ls="--", label="Zona de papel (+20 mm)"))
    ax.plot(xr, yr, "-", color=C_PEN, lw=2, label="Rosa (trazo del plumon)", zorder=8)
    i0 = 0
    _dibujar_robot_xy(ax, s["th1"][i0], s["th2"][i0], s["phi"][i0], cab)
    ax.annotate("J1", (0, 0), (-40, 30), textcoords="offset points", fontsize=9,
                arrowprops=dict(arrowstyle="-", color="#555"))
    _ejes_xy(ax)
    ax.set_title(
        f"Espacio de trabajo del SCARA y colocación de la rosa\n"
        f"L1 = {m.L1_MM:.0f} mm, L2 = {m.L2_MM:.0f} mm, plumón a {cab.pluma.radio_mm:.0f} mm "
        f"→ L2 equivalente = {le:.0f} mm | centro rosa = ({cx:.0f}, {cy:.0f}) mm, giro "
        f"{m.ALFA_ROSA_DEG:.0f}°",
        fontsize=9,
    )
    ax.legend(loc="lower left", fontsize=7.5, framealpha=0.95)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "scara_espacio_trabajo.png"), dpi=160)
    plt.close(fig)


def fig_estroboscopica(s):
    """Poses sucesivas de los eslabones: como se mueve el brazo en el plano XY."""
    cab = s["cab"]
    n = len(s["t"])
    fig, axes = plt.subplots(1, 3, figsize=(16, 6.2))
    # Cada petalo empieza y termina en el centro de la rosa
    r = np.hypot(s["x"] - m.CENTRO_ROSA[0], s["y"] - m.CENTRO_ROSA[1])
    cortes = [i for i in range(1, n - 1) if r[i] < 3 and r[i] <= r[i - 1] and r[i] <= r[i + 1]]
    b = [0] + cortes + [n - 1]
    tramos = [(b[k], b[k + 1], f"Pétalo {k + 1}") for k in range(len(b) - 1)]
    cmap = plt.cm.viridis
    for ax, (a, b, nombre) in zip(axes, tramos):
        ax.add_patch(Polygon(huella_base(), fc="#e3e9ef", ec="#9aa", lw=0.8))
        ax.plot(s["x"], s["y"], "-", color="#ccc", lw=1.5)
        ax.plot(s["x"][a:b], s["y"][a:b], "-", color=C_PEN, lw=2.5, zorder=9)
        idx = np.linspace(a, b, 9).astype(int)
        for k, i in enumerate(idx):
            col = cmap(k / (len(idx) - 1))
            j2, j3, tip = m.fk(s["th1"][i], s["th2"][i], s["phi"][i], cab.pluma)
            ax.plot([0, j2[0], j3[0], tip[0]], [0, j2[1], j3[1], tip[1]], "-o", color=col,
                    lw=2.2, ms=3.5, alpha=0.9)
        _ejes_xy(ax, (-120, 430, -300, 300))
        ax.set_title(
            f"{nombre}: t = {s['t'][a]:.1f}–{s['t'][b]:.1f} s\n"
            f"θ1 ∈ [{s['th1'][a:b].min():.0f}°, {s['th1'][a:b].max():.0f}°], "
            f"θ2 ∈ [{s['th2'][a:b].min():.0f}°, {s['th2'][a:b].max():.0f}°]",
            fontsize=9,
        )
    sm = plt.cm.ScalarMappable(cmap=cmap)
    cb = fig.colorbar(sm, ax=axes, shrink=0.7, pad=0.01)
    cb.set_label("avance dentro del pétalo")
    fig.suptitle("Movimiento de los eslabones en el plano XY (J1 → J2 → J3 → punta del plumón)",
                 fontsize=11)
    fig.savefig(os.path.join(OUT, "scara_eslabones_xy.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)


def fig_articulaciones(s):
    t = s["t"]
    dt = np.gradient(t)
    w1 = np.gradient(s["th1"]) / dt
    w2 = np.gradient(s["th2"]) / dt
    fig, axes = plt.subplots(3, 1, figsize=(10, 8.5), sharex=True)
    axes[0].plot(t, s["th1"], color=C_ARM1, lw=2, label="θ1 (J1, base)")
    axes[0].plot(t, s["th2"], color=C_ARM2, lw=2, label="θ2 (J2, codo)")
    axes[0].plot(t, s["phi"], color="#999", lw=1.5, ls="--", label="φ (J3, cabezal) = 0")
    axes[0].set_ylabel("ángulo (°)")
    axes[0].legend(fontsize=8, ncol=3)
    axes[1].plot(t, w1, color=C_ARM1, lw=1.5, label="dθ1/dt")
    axes[1].plot(t, w2, color=C_ARM2, lw=1.5, label="dθ2/dt")
    axes[1].set_ylabel("velocidad (°/s)")
    axes[1].legend(fontsize=8)
    axes[2].plot(t, np.abs(w1) * m.PASOS_GRADO_J1, color=C_ARM1, lw=1.5, label="motor J1")
    axes[2].plot(t, np.abs(w2) * m.PASOS_GRADO_J2, color=C_ARM2, lw=1.5, label="motor J2")
    axes[2].set_ylabel("frecuencia de pasos (pasos/s)")
    axes[2].set_xlabel("tiempo (s)")
    axes[2].legend(fontsize=8)
    for a in axes:
        a.grid(True, alpha=0.3)
    axes[0].set_title(
        f"Perfiles articulares a velocidad de punta constante = 25 mm/s "
        f"(rosa de {s['largo']:.0f} mm en {t[-1]:.1f} s)",
        fontsize=10,
    )
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "scara_articulaciones.png"), dpi=160)
    plt.close(fig)
    return w1, w2


def fig_precision(s):
    le, beta = m.largo_equivalente(s["cab"].pluma)
    J = m.jacobiano(s["th1"], s["th2"] + beta, l2=le)
    sv = np.linalg.svd(J, compute_uv=False)
    cond = sv[:, 0] / sv[:, 1]
    # Error por 1 micropaso en cada motor (peor combinacion de signos)
    d = np.deg2rad([1 / m.PASOS_GRADO_J1, 1 / m.PASOS_GRADO_J2])
    e_paso = np.abs(J[:, :, 0]) * d[0] + np.abs(J[:, :, 1]) * d[1]
    e_paso = np.hypot(e_paso[:, 0], e_paso[:, 1])
    # 1 grado de juego (correas) en J1 y J2
    e_grado = np.hypot(*(np.abs(J[:, :, 0]) + np.abs(J[:, :, 1])).T) * np.pi / 180
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))
    sc = axes[0].scatter(s["x"], s["y"], c=e_paso, cmap="magma_r", s=6)
    axes[0].set_aspect("equal")
    axes[0].grid(True, alpha=0.3)
    axes[0].set_xlabel("x (mm)")
    axes[0].set_ylabel("y (mm)")
    fig.colorbar(sc, ax=axes[0], label="error por 1 micropaso (mm)")
    axes[0].set_title(f"Resolución: máx {e_paso.max():.3f} mm por micropaso", fontsize=10)
    axes[1].plot(s["t"], cond, color="#444", lw=1.8, label="número de condición del jacobiano")
    axes[1].set_ylabel("κ(J)")
    axes[1].set_xlabel("tiempo (s)")
    ax2 = axes[1].twinx()
    ax2.plot(s["t"], e_grado, color=C_PEN, lw=1.5, label="error si J1 y J2 tienen 1° de juego")
    ax2.set_ylabel("mm por grado de juego", color=C_PEN)
    axes[1].grid(True, alpha=0.3)
    axes[1].set_title(f"κ máx = {cond.max():.2f} (lejos de singularidad) | "
                      f"1° de juego → hasta {e_grado.max():.1f} mm", fontsize=10)
    h1, l1 = axes[1].get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    axes[1].legend(h1 + h2, l1 + l2, fontsize=8, loc="upper right")
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "scara_precision.png"), dpi=160)
    plt.close(fig)
    return e_paso, cond, e_grado


def fig_pila_z(varilla):
    """Alzado lateral: pila vertical del SCARA con varillas recortadas vs original."""
    cab = m.Cabezal()
    fig, axes = plt.subplots(1, 2, figsize=(12, 7), sharey=True)
    for ax, L in zip(axes, (m.LARGO_VARILLA_ORIGINAL, varilla)):
        zmin, zmax = m.carrera_z(L)
        zp_draw = m.z_plataforma_para_punta(0.0, cab.pluma, cab)
        zp = zp_draw
        top = m.Z_VARILLA_INF + L
        ax.add_patch(Rectangle((-150, 0), 215, m.H_BASE, fc="#9fb3c8", ec="k"))
        ax.add_patch(Rectangle((-60, m.H_BASE), 120, m.H_J1_COUPLER, fc="#7f9bb8", ec="k"))
        ax.add_patch(Rectangle((-60, m.Z_VARILLA_INF), 120, m.H_PLACA_INF, fc="#5d7fa3", ec="k"))
        for xv in (-33.6, 33.6):
            ax.add_patch(Rectangle((xv - 5, m.Z_VARILLA_INF), 10, L, fc="#ddd", ec="#777"))
        ax.add_patch(Rectangle((-60, m.Z_VARILLA_INF + m.H_PLACA_INF), 120, m.H_TAPA_INF, fc="#7f9bb8", ec="k"))
        ax.add_patch(Rectangle((-60, top - m.H_PLACA_SUP_DISCO), 120, m.H_PLACA_SUP_DISCO, fc="#5d7fa3", ec="k"))
        ax.add_patch(Rectangle((-60, m.fondo_tapa_sup(L)), 120, m.H_TAPA_SUP, fc="#7f9bb8", ec="k"))
        ax.add_patch(Rectangle((-60, zp), 122, m.H_PLATAFORMA, fc=C_ARM1, ec="k"))
        # NEMA de J2 en su altura maxima: fija el tope superior de Z
        ax.add_patch(Rectangle((-31, zmax + m.H_PLATAFORMA), 42, m.H_MOTOR_J2, fc="#2b2f33", ec="k", alpha=0.35, ls="--"))
        ax.add_patch(Rectangle((-31, zp + m.H_PLATAFORMA), 42, m.H_MOTOR_J2, fc="#2b2f33", ec="k"))
        a1 = zp + m.H_PLATAFORMA - m.H_ARM1
        ax.add_patch(Rectangle((62, a1), 205, m.H_ARM1, fc=C_ARM1, ec="k"))
        a2 = a1 - m.H_J2_COUPLER - m.H_ARM2
        ax.add_patch(Rectangle((228 - 39, a1 - m.H_J2_COUPLER), 78, m.H_J2_COUPLER, fc="#888", ec="k"))
        ax.add_patch(Rectangle((228 - 39, a2), 222, m.H_ARM2, fc=C_ARM2, ec="k"))
        j3x = 228 + 144
        brida = a2 - m.H_J3_COUPLER - m.H_CONECTOR
        ax.add_patch(Rectangle((j3x - 39, brida), 78, m.H_J3_COUPLER + m.H_CONECTOR, fc="#888", ec="k"))
        ax.add_patch(Rectangle((j3x - 70, brida - cab.espesor_placa), 140, cab.espesor_placa,
                               fc="#f4a261", ec="k"))
        px = j3x + cab.pluma.radio_mm
        ax.add_patch(Rectangle((px - 6, 0), 12, 140, fc=C_PEN, ec="k", alpha=0.85))
        ax.add_patch(Rectangle((j3x - 45 - 10, brida - cab.espesor_placa - 40), 20, 40, fc=C_MAG, ec="k"))
        ax.axhline(0, color="#8b6f47", lw=3)
        ax.annotate("", (-120, zmax), (-120, zmin), arrowprops=dict(arrowstyle="<->", color="C3"))
        ax.text(-128, (zmin + zmax) / 2, f"carrera\n{zmax - zmin:.0f} mm", color="C3",
                ha="right", va="center", fontsize=9)
        ax.text(px + 10, 5, "punta en la mesa", fontsize=8, color=C_PEN)
        ax.set_title(f"Varillas de {L:.0f} mm → altura total ≈ {top:.0f} mm\n"
                     f"plataforma para dibujar: {zp_draw:.0f} mm (rango {zmin:.0f}–{zmax:.0f})",
                     fontsize=10)
        ax.set_aspect("equal")
        ax.set_xlim(-200, 500)
        ax.set_ylim(-20, 500)
        ax.set_xlabel("distancia radial desde J1 (mm)")
        ax.grid(True, alpha=0.2)
    axes[0].set_ylabel("z (mm) — mesa = 0")
    fig.suptitle("Eje Z: diseño original vs. columna recortada (misma cinemática XY)", fontsize=11)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "scara_pila_z.png"), dpi=150)
    plt.close(fig)


def guardar_csv(s, w1, w2):
    cab = s["cab"]
    zp = m.z_plataforma_para_punta(0.0, cab.pluma, cab)
    th1, th2, phi = s["th1"], s["th2"], s["phi"]
    datos = np.column_stack([
        s["t"], s["tpar"], s["x"], s["y"], th1, th2, phi, np.full_like(th1, zp),
        np.round(th1 * m.PASOS_GRADO_J1), np.round(th2 * m.PASOS_GRADO_J2),
        np.round(phi * m.PASOS_GRADO_J3), np.full_like(th1, round(zp * m.PASOS_MM_Z)), w1, w2,
    ])
    cab_csv = ("tiempo_s,t_param,x_mm,y_mm,theta1_deg,theta2_deg,phi_deg,z_plataforma_mm,"
               "pasos_J1,pasos_J2,pasos_J3,pasos_Z,w1_deg_s,w2_deg_s")
    ruta = os.path.join(OUT, "scara_waypoints.csv")
    np.savetxt(ruta, datos, delimiter=",", header=cab_csv, comments="", fmt="%.5g")
    return ruta


def gif(s, varilla, n_frames=150):
    from matplotlib.animation import FuncAnimation, PillowWriter

    cab = s["cab"]
    idx = np.linspace(0, len(s["t"]) - 1, n_frames).astype(int)
    zp = m.z_plataforma_para_punta(0.0, cab.pluma, cab)
    fig = plt.figure(figsize=(13, 6))
    axl = fig.add_subplot(1, 2, 1)
    ax3 = fig.add_subplot(1, 2, 2, projection="3d")

    def cuadro(k):
        i = idx[k]
        axl.cla()
        axl.add_patch(Polygon(huella_base(), fc="#e3e9ef", ec="#9aa"))
        axl.plot(s["x"], s["y"], "--", color="#ccc", lw=1)
        axl.plot(s["x"][: i + 1], s["y"][: i + 1], "-", color=C_PEN, lw=2.2, zorder=9)
        _dibujar_robot_xy(axl, s["th1"][i], s["th2"][i], s["phi"][i], cab)
        _ejes_xy(axl, (-170, 440, -300, 300))
        axl.set_title(f"Vista superior  t = {s['t'][i]:5.1f} s   θ1 = {s['th1'][i]:6.1f}°   "
                      f"θ2 = {s['th2'][i]:6.1f}°", fontsize=9, family="monospace")

        ax3.cla()
        j2, j3, tip = m.fk(s["th1"][i], s["th2"][i], s["phi"][i], cab.pluma)
        a1 = zp + m.H_PLATAFORMA - m.H_ARM1 / 2
        a2 = zp + m.H_PLATAFORMA - m.H_ARM1 - m.H_J2_COUPLER - m.H_ARM2 / 2
        brida = a2 - m.H_ARM2 / 2 - m.H_J3_COUPLER - m.H_CONECTOR
        top = m.Z_VARILLA_INF + varilla
        for sx, sy in ((-34, -34), (34, -34), (34, 34), (-34, 34)):
            ax3.plot([sx, sx], [sy, sy], [m.Z_VARILLA_INF, top], color="#aaa", lw=2)
        ax3.plot([0, j2[0]], [0, j2[1]], [a1, a1], color=C_ARM1, lw=8, solid_capstyle="round")
        ax3.plot([j2[0], j3[0]], [j2[1], j3[1]], [a2, a2], color=C_ARM2, lw=6, solid_capstyle="round")
        ax3.plot([j3[0], j3[0]], [j3[1], j3[1]], [a2, brida], color="#777", lw=6)
        ax3.plot([j3[0], tip[0]], [j3[1], tip[1]], [brida, brida], color="#f4a261", lw=4)
        ax3.plot([tip[0], tip[0]], [tip[1], tip[1]], [0, brida + 80], color=C_PEN, lw=4)
        ax3.plot(s["x"][: i + 1], s["y"][: i + 1], 0, color=C_PEN, lw=2)
        ax3.plot(s["x"], s["y"], 0, "--", color="#ccc", lw=0.8)
        ax3.set_xlim(-150, 420)
        ax3.set_ylim(-285, 285)
        ax3.set_zlim(0, top + 10)
        ax3.set_box_aspect((570, 570, top + 10))
        ax3.view_init(elev=24, azim=-60 + 40 * k / n_frames)
        ax3.set_title(f"Columna de {varilla:.0f} mm — plumón en la mesa", fontsize=9)
        return []

    anim = FuncAnimation(fig, cuadro, frames=n_frames, interval=60)
    ruta = os.path.join(OUT, "scara_animacion.gif")
    anim.save(ruta, writer=PillowWriter(fps=16))
    plt.close(fig)
    return ruta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gif", action="store_true")
    ap.add_argument("--varilla", type=float, default=240.0, help="largo de varillas Z (mm)")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    s = simular()
    cab = s["cab"]
    le, beta = m.largo_equivalente(cab.pluma)
    fig_espacio_trabajo(s)
    fig_estroboscopica(s)
    w1, w2 = fig_articulaciones(s)
    e_paso, cond, e_grado = fig_precision(s)
    fig_pila_z(args.varilla)
    ruta_csv = guardar_csv(s, w1, w2)

    _, _, tip = m.fk(s["th1"], s["th2"], s["phi"], cab.pluma)
    err = np.hypot(tip[:, 0] - s["x"], tip[:, 1] - s["y"])
    zmin, zmax = m.carrera_z(args.varilla)
    zp = m.z_plataforma_para_punta(0, cab.pluma, cab)
    print("=== SCARA MathBot: rosa con plumon del cabezal tri-herramienta ===")
    print(f"L1={m.L1_MM} mm  L2={m.L2_MM} mm  plumon r={cab.pluma.radio_mm} -> L2e={le:.1f} mm")
    print(f"Rosa: centro={m.CENTRO_ROSA} giro={m.ALFA_ROSA_DEG} deg  largo={s['largo']:.0f} mm  "
          f"T={s['t'][-1]:.1f} s a 25 mm/s  ({len(s['t'])} muestras)")
    print(f"theta1 [{s['th1'].min():.1f}, {s['th1'].max():.1f}] deg   "
          f"theta2 [{s['th2'].min():.1f}, {s['th2'].max():.1f}] deg   phi = 0 (J3 quieto)")
    print(f"Vel. max: J1 {np.abs(w1).max():.1f} deg/s ({np.abs(w1).max() * m.PASOS_GRADO_J1:.0f} pasos/s)"
          f"  J2 {np.abs(w2).max():.1f} deg/s ({np.abs(w2).max() * m.PASOS_GRADO_J2:.0f} pasos/s)")
    print(f"Error IK->FK: {err.max():.2e} mm | kappa max {cond.max():.2f} | "
          f"micropaso -> {e_paso.max():.3f} mm | 1 deg juego -> {e_grado.max():.2f} mm")
    print(f"Eje Z con varillas de {args.varilla:.0f} mm: plataforma {zmin:.0f}-{zmax:.0f} mm, "
          f"dibujar en {zp:.1f} mm -> punta puede subir hasta {zmax - zp:.0f} mm sobre la mesa")
    print(f"CSV: {ruta_csv}")
    if args.gif:
        print("GIF:", gif(s, args.varilla))
    print(f"Figuras en {OUT}")


if __name__ == "__main__":
    main()
