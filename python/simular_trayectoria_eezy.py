"""
Simula la trayectoria MathBot (rosa de 3 petalos) con el modelo cinematico
easyEEZYbotARM Mk2: IK -> angulos articulares -> FK -> curva del efector.

Escena realista: el brazo esta APOYADO EN UNA MESA y dibuja la rosa SOBRE
la superficie (plano z = Z_MESA, con el lapiz a Z_DRAW_MM ~ unos mm arriba).

Uso (desde la carpeta python/):
    python simular_trayectoria_eezy.py

Salida: figuras/eezy_*.png y consola con resumen de error / limites.
"""

from __future__ import annotations

import contextlib
import io
import os
import sys

import matplotlib.pyplot as plt
import numpy as np
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

# Paquete local (copia de meisben/easyEEZYbotARM)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from easyEEZYbotARM.kinematic_model import EEZYbotARM_Mk2

# ---------------------------------------------------------------------------
# Parametros MathBot (misma ecuacion que Avance 1 / README)
# ---------------------------------------------------------------------------
A_CM = 10.29
K_STRETCH = 1.3552
N_PETALS = 3
T0, T1 = 5 * np.pi / 6, 11 * np.pi / 6

# ---------------------------------------------------------------------------
# Escena: brazo sobre la mesa, curva en el plano de la mesa
#
#   z = 0  -> superficie de la mesa (donde esta la base del brazo)
#   z = Z_DRAW_MM -> punta del lapiz / efector (unos mm sobre el papel)
#
# La libreria stock fija q2_min=39 deg (postura "segura" experimental). Eso
# impide bajar el efector a la mesa. En modo mesa usamos limites mas amplios
# coherentes con el rango servo / la IK (ver EEZYbotARM_Mk2_Mesa).
# ---------------------------------------------------------------------------
CX_MM = 250.0  # centro de la rosa frente a la base (mm)
CY_MM = 0.0
Z_MESA_MM = 0.0  # plano de la mesa
Z_DRAW_MM = 5.0  # altura del tip sobre la mesa (papel + holgura)
SCALE = 1.0  # 1.0 = tamanio fisico MathBot (A=10.29 cm)
N_WAYPOINTS = 90


class EEZYbotARM_Mk2_Mesa(EEZYbotARM_Mk2):
    """Mk2 con limites articulares ampliados para dibujar sobre la mesa."""

    # q2 bajo: necesario para z ~ 0..20 mm (stock: 39 deg)
    q2_min = 0.0
    q2_max = 120.0
    # q1 se mantiene; la rosa cabe en +/-23 deg
    q1_min = -30.0
    q1_max = 30.0

    def q3CalcLimits(self, **kwargs):
        """Limites amplios (servo); los experimentales del repo no cubren z~0."""
        return -160.0, -20.0


def rosa_xy_cm(t: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    x = -A_CM * np.cos(N_PETALS * t) * np.cos(t)
    y = -A_CM * K_STRETCH * np.cos(N_PETALS * t) * np.sin(t)
    return x, y


def trayectoria_en_brazo(n: int = N_WAYPOINTS) -> tuple[np.ndarray, np.ndarray]:
    """Rosa en el plano de la mesa (z = Z_DRAW_MM), centrada frente al brazo."""
    t = np.linspace(T0, T1, n)
    x_cm, y_cm = rosa_xy_cm(t)
    xyz = np.column_stack(
        [
            CX_MM + x_cm * 10.0 * SCALE,  # cm -> mm
            CY_MM + y_cm * 10.0 * SCALE,
            np.full(n, Z_DRAW_MM),
        ]
    )
    return xyz, t


def ik_silencioso(arm: EEZYbotARM_Mk2, x: float, y: float, z: float):
    """IK del modelo original (imprime mucho); silenciamos para el barrido."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        return arm.inverseKinematics(x, y, z)


def simular(xyz: np.ndarray):
    arm = EEZYbotARM_Mk2_Mesa(initial_q1=0, initial_q2=20, initial_q3=-100)
    n = len(xyz)
    angles = np.zeros((n, 3))
    xyz_fk = np.zeros((n, 3))
    ok = np.ones(n, dtype=bool)
    errores = []

    for i, (x, y, z) in enumerate(xyz):
        try:
            q1, q2, q3 = ik_silencioso(arm, float(x), float(y), float(z))
            arm.checkErrorJointLimits(q1=q1, q2=q2, q3=q3)
            xf, yf, zf = arm.forwardKinematics(q1=q1, q2=q2, q3=q3)
            angles[i] = (q1, q2, q3)
            xyz_fk[i] = (xf, yf, zf)
        except Exception as exc:  # limites articulares o dominio acos
            ok[i] = False
            errores.append((i, xyz[i], str(exc)))
            angles[i] = np.nan
            xyz_fk[i] = np.nan

    return arm, angles, xyz_fk, ok, errores


def _dibujar_mesa(ax, x_max=380, y_span=180):
    """Superficie de la mesa (z = Z_MESA_MM) como referencia visual."""
    xx = np.linspace(-40, x_max, 2)
    yy = np.linspace(-y_span, y_span, 2)
    XX, YY = np.meshgrid(xx, yy)
    ZZ = np.full_like(XX, Z_MESA_MM)
    ax.plot_surface(XX, YY, ZZ, color="#d9cbb3", alpha=0.35, linewidth=0, shade=False)
    ax.text(x_max * 0.55, -y_span * 0.85, Z_MESA_MM, "mesa (z=0)", color="#666", fontsize=8)


def plot_resultados(xyz, xyz_fk, angles, ok, outdir: str):
    os.makedirs(outdir, exist_ok=True)
    mask = ok

    # --- Vista superior: curva deseada vs FK (plano de la mesa, vista -Z) ---
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot(xyz[:, 0], xyz[:, 1], "k--", lw=1.2, label="Trayectoria deseada (rosa en mesa)")
    ax.plot(
        xyz_fk[mask, 0],
        xyz_fk[mask, 1],
        "C0-",
        lw=2,
        label="Simulada FK (Mk2 mesa)",
    )
    if np.any(~mask):
        ax.scatter(
            xyz[~mask, 0],
            xyz[~mask, 1],
            c="C3",
            s=28,
            zorder=5,
            label="Fuera de limites / IK fallida",
        )
    ax.scatter([0], [0], c="k", marker="s", s=40, label="Base brazo (sobre mesa)")
    ax.set_aspect("equal")
    ax.set_xlabel("x (mm)  — sobre la mesa")
    ax.set_ylabel("y (mm)  — sobre la mesa")
    ax.set_title(f"Curva en el plano de la mesa  (z_lapiz = {Z_DRAW_MM:.0f} mm)")
    ax.legend(loc="best", fontsize=8)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "eezy_trayectoria_xy.png"), dpi=160)
    plt.close(fig)

    # --- 3D: mesa + trazo ---
    fig = plt.figure(figsize=(8, 6))
    ax = fig.add_subplot(111, projection="3d")
    _dibujar_mesa(ax)
    ax.plot(xyz[:, 0], xyz[:, 1], xyz[:, 2], "k--", lw=1, label="Deseada (sobre mesa)")
    ax.plot(
        xyz_fk[mask, 0],
        xyz_fk[mask, 1],
        xyz_fk[mask, 2],
        "C0-",
        lw=2,
        label="FK simulada",
    )
    ax.scatter([0], [0], [Z_MESA_MM], c="k", marker="s", s=40, label="Base")
    ax.set_xlabel("x (mm)")
    ax.set_ylabel("y (mm)")
    ax.set_zlabel("z (mm)")
    ax.set_zlim(-5, 280)
    ax.set_title("Trayectoria 3D sobre la mesa")
    ax.view_init(elev=28, azim=-65)
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "eezy_trayectoria_3d.png"), dpi=160)
    plt.close(fig)

    # --- Angulos articulares ---
    fig, axes = plt.subplots(3, 1, figsize=(8, 7), sharex=True)
    labels = ("q1 base (deg)", "q2 brazo (deg)", "q3 antebrazo (deg)")
    idx = np.arange(len(angles))
    for ax_i, col, lab in zip(axes, angles.T, labels):
        ax_i.plot(idx[mask], col[mask], "C0-")
        ax_i.set_ylabel(lab)
        ax_i.grid(True, alpha=0.3)
    axes[-1].set_xlabel("indice de waypoint")
    axes[0].set_title("Angulos articulares — dibujo sobre mesa (IK Mk2_Mesa)")
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "eezy_angulos.png"), dpi=160)
    plt.close(fig)

    # --- Pose del brazo en 3 puntas de petalo ---
    arm = EEZYbotARM_Mk2_Mesa(0, 20, -100)
    tips_t = np.array([np.pi, 4 * np.pi / 3, 5 * np.pi / 3])
    t_full = np.linspace(T0, T1, len(xyz))
    tip_idx = [int(np.argmin(np.abs(t_full - tt))) for tt in tips_t]

    fig = plt.figure(figsize=(12, 4))
    for subplot, i in enumerate(tip_idx, start=1):
        if not ok[i]:
            continue
        q1, q2, q3 = angles[i]
        arm.updateJointAngles(q1=q1, q2=q2, q3=q3)
        ax = fig.add_subplot(1, 3, subplot, projection="3d")
        _dibujar_mesa(ax, x_max=360, y_span=150)
        _dibujar_brazo_simple(arm, ax, highlight=xyz_fk[i])
        ax.set_title(f"Punta petalo  t~{t_full[i]:.2f}\nq=({q1:.1f},{q2:.1f},{q3:.1f})")
    fig.suptitle("Mk2 dibujando sobre la mesa — tres puntas de la rosa", fontsize=11)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "eezy_poses_petalos.png"), dpi=160)
    plt.close(fig)


def _dibujar_brazo_simple(arm: EEZYbotARM_Mk2, ax, highlight=None):
    """Esqueleto 3D del brazo a partir de FK de eslabones."""
    q1 = arm.q1 * np.pi / 180
    q2 = arm.q2 * np.pi / 180
    q3 = arm.q3 * np.pi / 180
    L1, L2, L3, L4 = arm.L1, arm.L2, arm.L3, arm.L4

    j1 = np.array([0.0, 0.0, L1])
    j3_local_r = L2 * np.cos(q2)
    j3_local_z = L1 + L2 * np.sin(q2)
    j4_local_r = j3_local_r + L3 * np.cos(q2 + q3)
    j4_local_z = j3_local_z + L3 * np.sin(q2 + q3)
    ee_local_r = j4_local_r + L4
    ee_local_z = j4_local_z

    def cyl_to_xyz(r, z):
        return np.array([r * np.cos(q1), r * np.sin(q1), z])

    chain = np.vstack(
        [
            [0, 0, 0],
            j1,
            cyl_to_xyz(j3_local_r, j3_local_z),
            cyl_to_xyz(j4_local_r, j4_local_z),
            cyl_to_xyz(ee_local_r, ee_local_z),
        ]
    )
    ax.plot(chain[:, 0], chain[:, 1], chain[:, 2], "-o", lw=2, ms=4, color="C1")
    if highlight is not None:
        ax.scatter(*highlight, c="C0", s=40, zorder=5)
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_zlabel("z")
    ax.set_xlim(-50, 360)
    ax.set_ylim(-160, 160)
    ax.set_zlim(-5, 280)


def main():
    import matplotlib

    matplotlib.use("Agg")

    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figuras")
    xyz, t = trayectoria_en_brazo()
    arm, angles, xyz_fk, ok, errores = simular(xyz)

    n_ok = int(np.sum(ok))
    print("=== MathBot + easyEEZYbotARM Mk2 (modo mesa) ===")
    print(f"Rosa: A={A_CM} cm, k={K_STRETCH}, t in [{T0:.3f}, {T1:.3f}]")
    print(
        f"Mesa z={Z_MESA_MM:.0f} mm | lapiz z={Z_DRAW_MM:.0f} mm | "
        f"centro=({CX_MM},{CY_MM}) mm | N={len(xyz)}"
    )
    print(f"Waypoints validos: {n_ok}/{len(xyz)}")

    if n_ok:
        err = np.linalg.norm(xyz[ok] - xyz_fk[ok], axis=1)
        print(f"Error IK->FK: max={err.max():.3f} mm, RMS={np.sqrt(np.mean(err**2)):.3f} mm")
        print(
            f"q1 rango: [{np.nanmin(angles[:, 0]):.1f}, {np.nanmax(angles[:, 0]):.1f}] deg "
            f"(limites: [{arm.q1_min}, {arm.q1_max}])"
        )
        print(
            f"q2 rango: [{np.nanmin(angles[:, 1]):.1f}, {np.nanmax(angles[:, 1]):.1f}] deg "
            f"(limites mesa: [{arm.q2_min}, {arm.q2_max}]; stock lib: 39..120)"
        )
        print(
            f"q3 rango: [{np.nanmin(angles[:, 2]):.1f}, {np.nanmax(angles[:, 2]):.1f}] deg"
        )
        print(
            f"z del trazo: min={xyz_fk[ok, 2].min():.1f} max={xyz_fk[ok, 2].max():.1f} mm "
            f"(debe ~ {Z_DRAW_MM} mm sobre la mesa)"
        )

    if errores:
        print(f"\nFallos ({len(errores)}), primeros 5:")
        for i, p, msg in errores[:5]:
            print(f"  [{i}] xyz={p} -> {msg}")

    plot_resultados(xyz, xyz_fk, angles, ok, outdir)
    print(f"\nFiguras guardadas en: {outdir}")

    csv_path = os.path.join(outdir, "eezy_waypoints_ik.csv")
    header = "t,x_mm,y_mm,z_mm,q1_deg,q2_deg,q3_deg,x_fk,y_fk,z_fk,ok"
    data = np.column_stack([t, xyz, angles, xyz_fk, ok.astype(int)])
    np.savetxt(csv_path, data, delimiter=",", header=header, comments="")
    print(f"CSV waypoints+IK: {csv_path}")


if __name__ == "__main__":
    main()
