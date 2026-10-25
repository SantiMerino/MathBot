// Geometría y cinemática del MathBot. Copia exacta de firmware/mathbot_mega/mathbot_mega.ino (v3.0):
// si cambia allá, cambia aquí. Al conectar, el panel reemplaza estos valores con los que reporta el Mega ("I ...").

export const GEO = {
  L1: 228, L2: 144,
  CAIDA: 80.5,          // base de la plataforma Z -> brida del cabezal
  DISCO: 20,            // separador 14 + placa 6
  R: 55,                // radio de las herramientas
  PHI: { p: 0, i: 120, s: 240 },
  BAJO: { p: 50, i: 40, s: 38 },
  PASOS: [44.4444, 35.5556, 10, 100],
  VMAX: [3000, 3000, 1500, 3500],
  ACEL: [2000, 2000, 1500, 3000],
  LIM_J: 150,
  J3_CABEZAL: [-120, 121], J3_SIN: [-170, 170],
  ZMAX: 203, ZMIN_MECANICO: 103.5, ZMIN_CABEZAL: 140.5,
  TIP_TRANSITO: 60,
  LEVANTE: 18,
  ROSA: { A: 102.9, K: 1.3552, T0: 5 * Math.PI / 6, T1: 11 * Math.PI / 6 },
  SEG_MM: 1,
  // obstáculos fijos sobre la mesa (marco de J1): base del robot y caja del Arduino
  BASE: { x0: -150, x1: 65, y0: -70, y1: 70, h: 45 },
  CAJA: { x0: -235, x1: -150, y0: -60, y1: 60, h: 45 },
};

export const HERR = {
  p: { letra: 'p', nombre: 'Plumón', color: '#ebe7da' },
  i: { letra: 'i', nombre: 'Electroimán', color: '#c7a6ff' },
  s: { letra: 's', nombre: 'Sensor', color: '#42d3ff' },
};

export const CFG_FABRICA = {
  home1: -89, home2: -152.4, home3: -120, home4: 203, zmesa: 0,
  rosax: 185, rosay: 0, rosaa: 180, binx: 95, biny: 265, binh: 25, vel: 25,
  servoup: 110, servodn: 20, inv: 0, finales: 1, cabezal: 1,
};
export const PUNTOS_FABRICA = [
  { x: 60, y: -215, h: 3 }, { x: 150, y: -238, h: 8 }, { x: 240, y: -215, h: 7 }, { x: 325, y: -172, h: 12 },
];

const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
export const envolver = a => { while (a > 180) a -= 360; while (a <= -180) a += 360; return a; };

export const radioH = (k, cfg) => (cfg.cabezal ? GEO.R : 0);
export const bajoH = (k, cfg) => (cfg.cabezal ? GEO.DISCO + GEO.BAJO[k] : 0);
export const phiHerramienta = (k, cfg) => (cfg.cabezal ? envolver(-GEO.PHI[k]) : 0);

export function limites(cfg) {
  const j3 = cfg.cabezal ? GEO.J3_CABEZAL : GEO.J3_SIN;
  return {
    min: [-GEO.LIM_J, -GEO.LIM_J, j3[0], cfg.cabezal ? GEO.ZMIN_CABEZAL + cfg.zmesa : GEO.ZMIN_MECANICO],
    max: [GEO.LIM_J, GEO.LIM_J, j3[1], GEO.ZMAX],
  };
}

export const zPlataforma = (ztip, k, cfg) => ztip + cfg.zmesa + GEO.CAIDA + bajoH(k, cfg);
export const zTransito = cfg => Math.min(zPlataforma(GEO.TIP_TRANSITO, 'i', cfg), GEO.ZMAX);

// Cinemática directa: J2, J3 y la punta de cada herramienta (x, y, z sobre la mesa).
export function fk(q, cfg, levante = 0) {
  const a1 = rad(q[0]), a12 = a1 + rad(q[1]), psi = a12 + rad(q[2]);
  const j2 = [GEO.L1 * Math.cos(a1), GEO.L1 * Math.sin(a1)];
  const j3 = [j2[0] + GEO.L2 * Math.cos(a12), j2[1] + GEO.L2 * Math.sin(a12)];
  const puntas = {};
  for (const k of 'pis') {
    const a = psi + rad(cfg.cabezal ? GEO.PHI[k] : 0), r = radioH(k, cfg);
    puntas[k] = [j3[0] + r * Math.cos(a), j3[1] + r * Math.sin(a), q[3] - GEO.CAIDA - bajoH(k, cfg) - cfg.zmesa + (k === 'p' ? levante : 0)];
  }
  return { j2, j3, psi, puntas };
}

// IK de la punta de la herramienta k con J3 girado para tenerla al frente (como el firmware).
export function ik(x, y, k, cfg, codo = -1) {
  const le = GEO.L2 + radioH(k, cfg);
  const c2 = (x * x + y * y - GEO.L1 ** 2 - le ** 2) / (2 * GEO.L1 * le);
  if (c2 < -1 || c2 > 1) return null;
  for (const c of [codo, -codo]) {
    const t2 = c * Math.acos(c2);
    const t1 = Math.atan2(y, x) - Math.atan2(le * Math.sin(t2), GEO.L1 + le * Math.cos(t2));
    const th1 = envolver(deg(t1)), th2 = envolver(deg(t2));
    if (Math.abs(th1) <= GEO.LIM_J && Math.abs(th2) <= GEO.LIM_J) return [th1, th2];
  }
  return null;
}

export function rosaPunto(t, cfg) {
  const r = Math.cos(3 * t), a = rad(cfg.rosaa);
  const xl = -GEO.ROSA.A * r * Math.cos(t), yl = -GEO.ROSA.A * GEO.ROSA.K * r * Math.sin(t);
  return [cfg.rosax + Math.cos(a) * xl - Math.sin(a) * yl, cfg.rosay + Math.sin(a) * xl + Math.cos(a) * yl];
}

// Mismos tramos de ≈1 mm que recorre el firmware.
export function rosaTramos(cfg) {
  const N = 4000, R = GEO.ROSA;
  const pts = [rosaPunto(R.T0, cfg)];
  let largo = 0;
  for (let i = 1; i <= N; i++) {
    const p = rosaPunto(R.T0 + (R.T1 - R.T0) * i / N, cfg), a = pts[pts.length - 1];
    const d = Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (d < GEO.SEG_MM && i < N) continue;
    pts.push(p);
    largo += d;
  }
  return { pts, largo };
}

// La rosa se puede trazar si cada punto tiene IK y la punta no pasa sobre la base, la caja ni la bandeja.
export function comprobarRosa(cfg) {
  const { pts, largo } = rosaTramos(cfg);
  const malos = [];
  for (const p of pts) {
    const dentro = (b) => p[0] > b.x0 && p[0] < b.x1 && p[1] > b.y0 && p[1] < b.y1;
    if (!ik(p[0], p[1], 'p', cfg) || dentro(GEO.BASE) || dentro(GEO.CAJA) || dentro(bandeja(cfg))) malos.push(p);
  }
  return { ok: malos.length === 0, pts, malos, largo };
}

export const bandeja = cfg => ({ x0: cfg.binx - 40, x1: cfg.binx + 40, y0: cfg.biny - 40, y1: cfg.biny + 40, h: cfg.binh });

// Radio alcanzable de la punta k (con J2 en ±150°): anillo entre rmin y rmax alrededor de J1.
export function alcance(k, cfg) {
  const le = GEO.L2 + radioH(k, cfg), c = Math.cos(rad(GEO.LIM_J));
  return { rmin: Math.sqrt(GEO.L1 ** 2 + le ** 2 + 2 * GEO.L1 * le * c), rmax: GEO.L1 + le };
}

// Tiempo de un movimiento con rampa trapezoidal (mismo criterio que moverArticular del firmware).
export function perfil(d, v, a) {
  if (d <= 0) return { T: 0, f: () => 1 };
  const da = v * v / a;                        // distancia de aceleración + frenado
  if (d >= da) {
    const ta = v / a, T = d / v + ta;
    return { T, f: t => {
      if (t <= 0) return 0; if (t >= T) return 1;
      const s = t < ta ? 0.5 * a * t * t : t < T - ta ? da / 2 + v * (t - ta) : d - 0.5 * a * (T - t) ** 2;
      return s / d;
    } };
  }
  const tp = Math.sqrt(d / a), T = 2 * tp;
  return { T, f: t => {
    if (t <= 0) return 0; if (t >= T) return 1;
    const s = t < tp ? 0.5 * a * t * t : d - 0.5 * a * (T - t) ** 2;
    return s / d;
  } };
}
