"""
Animacion 3D en tiempo real: eslabones del EEZYbotARM Mk2 + trayectoria rosa
dibujada SOBRE LA MESA (z ~ 0).

Abre una ventana interactiva (puedes rotar con el mouse) y dibuja la curva
mientras el brazo avanza. Tambien guarda un GIF en figuras/.

Uso (desde python/):
    python animar_trayectoria_3d.py
    python animar_trayectoria_3d.py --gif-only   # sin ventana, solo GIF
    python animar_trayectoria_3d.py --no-gif     # solo ventana en vivo
"""

from __future__ import annotations

import argparse
import os
import sys

import numpy as np

# Backend interactivo ANTES de importar pyplot (salvo --gif-only)
_GIF_ONLY = "--gif-only" in sys.argv
import matplotlib

if _GIF_ONLY:
    matplotlib.use("Agg")
else:
    try:
        matplotlib.use("TkAgg")
    except Exception:
        pass

import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation, PillowWriter
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from easyEEZYbotARM.kinematic_model import EEZYbotARM_Mk2
from simular_trayectoria_eezy import (
    CX_MM,
    CY_MM,
    Z_DRAW_MM,
    Z_MESA_MM,
    EEZYbotARM_Mk2_Mesa,
    _dibujar_mesa,
    simular,
    trayectoria_en_brazo,
)


def cadena_eslabones(q1_deg: float, q2_deg: float, q3_deg: float, arm: EEZYbotARM_Mk2):
    """
    Puntos de la cadena cinematica (mm):
      base -> J1 -> J3 (fin L2) -> J4 (fin L3) -> EE (fin L4)
    + eslabones del paralelogramo horarm (A, B).
    """
    q1 = np.deg2rad(q1_deg)
    q2 = np.deg2rad(q2_deg)
    q3 = np.deg2rad(q3_deg)
    L1, L2, L3, L4 = arm.L1, arm.L2, arm.L3, arm.L4
    L2A, LAB = arm.L2A, arm.LAB

    def to_xyz(r, z):
        return np.array([r * np.cos(q1), r * np.sin(q1), z])

    j1 = np.array([0.0, 0.0, L1])
    j3 = to_xyz(L2 * np.cos(q2), L1 + L2 * np.sin(q2))
    j4 = to_xyz(
        L2 * np.cos(q2) + L3 * np.cos(q2 + q3),
        L1 + L2 * np.sin(q2) + L3 * np.sin(q2 + q3),
    )
    ee = to_xyz(
        L2 * np.cos(q2) + L3 * np.cos(q2 + q3) + L4,
        L1 + L2 * np.sin(q2) + L3 * np.sin(q2 + q3),
    )

    q3_a = np.pi - (-q3)
    a = to_xyz(
        L2A * np.cos(q2 + q3_a),
        L1 + L2A * np.sin(q2 + q3_a),
    )
    b = to_xyz(
        L2A * np.cos(q2 + q3_a) + LAB * np.cos(q2),
        L1 + L2A * np.sin(q2 + q3_a) + LAB * np.sin(q2),
    )

    principal = np.vstack([[0.0, 0.0, 0.0], j1, j3, j4, ee])
    para = np.vstack([j1, a, b, j4])
    return principal, para, ee


def animar(guardar_gif: bool = True, mostrar: bool = True, n_waypoints: int = 120):
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figuras")
    os.makedirs(outdir, exist_ok=True)

    xyz, _t = trayectoria_en_brazo(n_waypoints)
    _arm_ref, angles, xyz_fk, ok, _err = simular(xyz)
    arm = EEZYbotARM_Mk2_Mesa(0, 20, -100)

    idx = np.where(ok)[0]
    angles = angles[idx]
    xyz_fk = xyz_fk[idx]
    xyz_des = xyz[idx]
    n = len(idx)

    fig = plt.figure(figsize=(10, 7))
    ax = fig.add_subplot(111, projection="3d")
    try:
        fig.canvas.manager.set_window_title("MathBot — dibujo sobre mesa (Mk2)")
    except Exception:
        pass

    ax.set_xlim(-40, 360)
    ax.set_ylim(-160, 160)
    ax.set_zlim(-5, 280)
    ax.set_xlabel("x (mm)")
    ax.set_ylabel("y (mm)")
    ax.set_zlabel("z (mm)  [mesa = 0]")
    ax.set_title(f"Brazo en mesa — trazo a z = {Z_DRAW_MM:.0f} mm")

    # Superficie de la mesa
    _dibujar_mesa(ax)

    # Guia: trayectoria completa deseada sobre la mesa
    ax.plot(
        xyz_des[:, 0],
        xyz_des[:, 1],
        xyz_des[:, 2],
        color="0.55",
        lw=1,
        ls="--",
        label="Rosa deseada (sobre mesa)",
    )
    ax.scatter([0], [0], [Z_MESA_MM], c="k", marker="s", s=35, label="Base en mesa")

    (link_main,) = ax.plot([], [], [], "-o", color="#c45c26", lw=3.5, ms=7, label="Eslabones")
    (link_para,) = ax.plot([], [], [], "-o", color="#b0b0b0", lw=2, ms=4, label="Paralelogramo")
    (trail,) = ax.plot([], [], [], "-", color="#1f77b4", lw=2.5, label="Trazo del efector")
    ee_dot = ax.scatter([], [], [], c="#1f77b4", s=50, depthshade=True)
    txt = ax.text2D(0.02, 0.95, "", transform=ax.transAxes, fontsize=9, family="monospace")

    ax.legend(loc="upper right", fontsize=8)
    # Vista mas cenital para ver la curva en la mesa
    ax.view_init(elev=35, azim=-60)

    trail_x, trail_y, trail_z = [], [], []

    def init():
        link_main.set_data_3d([], [], [])
        link_para.set_data_3d([], [], [])
        trail.set_data_3d([], [], [])
        return link_main, link_para, trail, ee_dot, txt

    def update(frame: int):
        nonlocal trail_x, trail_y, trail_z
        if frame == 0:
            trail_x, trail_y, trail_z = [], [], []

        q1, q2, q3 = angles[frame]
        principal, para, ee = cadena_eslabones(q1, q2, q3, arm)

        link_main.set_data_3d(principal[:, 0], principal[:, 1], principal[:, 2])
        link_para.set_data_3d(para[:, 0], para[:, 1], para[:, 2])

        trail_x.append(float(ee[0]))
        trail_y.append(float(ee[1]))
        trail_z.append(float(ee[2]))
        trail.set_data_3d(trail_x, trail_y, trail_z)

        ee_dot._offsets3d = ([ee[0]], [ee[1]], [ee[2]])
        txt.set_text(
            f"frame {frame+1}/{n}   mesa z={Z_MESA_MM:.0f}\n"
            f"q1={q1:6.1f}  q2={q2:6.1f}  q3={q3:6.1f}\n"
            f"EE=({ee[0]:.0f}, {ee[1]:.0f}, {ee[2]:.0f}) mm"
        )

        ax.view_init(elev=32, azim=-55 + 35 * (frame / max(n - 1, 1)))
        return link_main, link_para, trail, ee_dot, txt

    interval_ms = 45
    anim = FuncAnimation(
        fig,
        update,
        frames=n,
        init_func=init,
        interval=interval_ms,
        blit=False,
        repeat=True,
    )

    gif_path = os.path.join(outdir, "eezy_animacion_3d.gif")
    if guardar_gif:
        print(f"Guardando GIF ({n} frames)... esto tarda ~20-40 s")
        anim.save(gif_path, writer=PillowWriter(fps=int(1000 / interval_ms)))
        print(f"GIF: {gif_path}")

    print(
        f"Mesa z={Z_MESA_MM:.0f} | lapiz z={Z_DRAW_MM:.0f} | "
        f"centro=({CX_MM},{CY_MM}) | waypoints={n}"
    )
    if mostrar and not _GIF_ONLY:
        plt.show()
    else:
        plt.close(fig)

    return gif_path


def main():
    parser = argparse.ArgumentParser(description="Animacion 3D MathBot + EEZYbotARM (mesa)")
    parser.add_argument("--gif-only", action="store_true", help="Solo exportar GIF")
    parser.add_argument("--no-gif", action="store_true", help="Solo ventana en vivo")
    parser.add_argument("--n", type=int, default=120, help="Numero de waypoints")
    args = parser.parse_args()

    animar(
        guardar_gif=not args.no_gif,
        mostrar=not args.gif_only,
        n_waypoints=args.n,
    )


if __name__ == "__main__":
    main()
