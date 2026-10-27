// Geometría y modelo de la Fig 6: el electroimán hecho a mano en sus dos variantes (olla y perno),
// colgado del cabezal A v3 en la copa del separador del electroimán (pieza 06).
// Se usa en Node (cuadro inicial) y en el navegador (se inyecta sin import/export).
// Marco del cabezal como fuente/cabezal.py: origen en el eje de J3, herramientas a 55 mm en
// 0° (plumón) / 120° (electroimán) / 240° (sensor); la cara del electroimán queda 40 mm bajo la placa.
import { iso, depthOf, pathOf, extrude, cylinder, circleRing, solidSvg, lineSvg, dotsSvg, ring, sideArc, towardViewer, cameraOf, roundedPlan, haloOf, topMatrix, faceTextSvg } from "../kit/iso-kit.mjs";

const MU0 = 4e-7 * Math.PI, RHO_CU = 1.72e-8, V = 12;

// ---- Las dos variantes (mm). Bobinado: ventana × 0.85 / d² con esmalte; R = ρ·N·π·d_media / A.
export const VAR = {
  olla: {
    name: "Olla", awg: 33, d: 0.18, dEnamel: 0.205, h: 15, D: 17.9, screw: 40,
    // núcleo Ø8 · camisa EMT ½" (Ø17.9 × 1.07) · tapa arandela Ø17.9 × 2 · carrete PLA 0.8
    core: 8, wall: 1.07, cap: 2, flange: 0.8,
  },
  perno: {
    name: "Perno", awg: 30, d: 0.255, dEnamel: 0.285, h: 31.8, D: 18.6, screw: 20,
    // perno 3/8"-16 × 1" cabeza arriba · 2 arandelas SAE Ø18.6 × 1.6 · tuerca 3/8" (5.6) · 2 mm de punta
    bolt: 9.525, head: 6.4, hexR: 8.25, washer: 1.6, nut: 5.6, tip: 2, coilOD: 18,
  },
};

function winding(v) {
  let wr, wa, idD;
  if (v.core) { idD = v.core + 0.4; wr = (v.D - 2 * v.wall - v.core) / 2 - 0.5; wa = v.h - v.cap - v.flange; }
  else { idD = v.bolt + 0.6; wr = (v.coilOD - idD) / 2; wa = 25.4 - 2 * v.washer - v.nut - v.tip; }
  const N = Math.floor((wr * wa) / (v.dEnamel * v.dEnamel) * 0.85);
  const lt = Math.PI * (idD + wr) / 1000, a = Math.PI / 4 * v.d * v.d * 1e-6;
  const R = RHO_CU * N * lt / a, I = V / R;
  return { N, R, I, P: V * I, NI: N * I, wr, wa, length: N * lt };
}

// Fuerza de retención (N) con un entrehierro efectivo g (mm).
// Olla: circuito cerrado núcleo → pieza → camisa → tapa, B ≤ 1.5 T (acero dulce), F = Σ B²A / 2μ0.
// Perno: núcleo abierto; el retorno por aire se estima como un camino de 30 mm y Ø25 (orden de magnitud).
export function force(key, g) {
  const v = VAR[key], w = winding(v);
  if (key === "olla") {
    const Ac = Math.PI / 4 * v.core ** 2, Ar = Math.PI / 4 * (v.D ** 2 - (v.D - 2 * v.wall) ** 2);
    const ge = (g + g * Ac / Ar) * 1e-3;
    const B = Math.min(MU0 * w.NI / ge, 1.5), Br = B * Ac / Ar;
    return (B * B * Ac + Br * Br * Ar) * 1e-6 / (2 * MU0);
  }
  const Ac = Math.PI / 4 * v.bolt ** 2 * 0.8;                     // la rosca deja ≈80 % del área
  const Rret = 0.03 / (MU0 * Math.PI / 4 * 0.025 ** 2), Rg = g * 1e-3 / (MU0 * Ac * 1e-6);
  const B = Math.min(w.NI / (Rret + Rg) / (Ac * 1e-6), 1.5);
  return B * B * Ac * 1e-6 / (2 * MU0);
}

export const PIECE = { r: 20, h: 7, grams: Math.PI * 2 * 2 * 0.7 * 7.85 };   // disco de acero Ø40 × 7
export const WEIGHT = PIECE.grams / 1000 * 9.81;
export const MODEL = Object.fromEntries(Object.keys(VAR).map((k) => {
  const w = winding(VAR[k]);
  return [k, { ...w, Fc: force(k, 0.3), Fg: force(k, 0.5) }];
}));

// ---- Cabezal A v3 (fuente/cabezal.py)
const R_HERR = 55, PHI = { pen: 0, mag: 120, sen: 240 }, BAJO = 40, T_PLACA = 6;
const polarC = (a, r) => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)];
const rotC = ([x, y], a) => { const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180); return [x * c - y * s, x * s + y * c]; };
const TOOL = { pen: polarC(0, R_HERR), mag: polarC(120, R_HERR), sen: polarC(240, R_HERR) };
const herr = (t, r, q = 0) => { const [x, y] = TOOL[t], a = (PHI[t] * Math.PI) / 180; return [x + r * Math.cos(a) - q * Math.sin(a), y + r * Math.sin(a) + q * Math.cos(a)]; };
const ALFA = 50.4;
const PERNOS = [[32.1, 10.4], [32.1, -10.4], [-32.1, 10.4], [-32.1, -10.4]].map((p) => rotC(p, ALFA));
export const Z_DOWN = PIECE.h + 0.5 + BAJO;
export const EXPLODE_LIFT = 80;                     // al separar, la abrazadera sube para dejar caer las piezas          // cara inferior de la placa con la cara del imán 0.5 mm sobre la pieza

// Contorno de la placa (contorno_placa de cabezal.py): unión de figuras convexas, muestreada por rayos desde J3.
function convexPolys() {
  const circ = ([x, y], r, n = 36) => Array.from({ length: n }, (_, i) => [x + r * Math.cos((i / n) * Math.PI * 2), y + r * Math.sin((i / n) * Math.PI * 2)]);
  const strip = ([x1, y1], w) => { const L = Math.hypot(x1, y1), ux = x1 / L, uy = y1 / L, h = w / 2; return [[-uy * h, ux * h], [x1 - uy * h, y1 + ux * h], [x1 + uy * h, y1 - ux * h], [uy * h, -ux * h]]; };
  const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const out = [circ([0, 0], 19)];
  for (const p of PERNOS) out.push(strip(p, 10), circ(p, 6.5));
  out.push(strip(TOOL.pen, 20), circ(TOOL.pen, 13), box(55 - 15, -22, 55 + 33, 27.5));
  out.push(strip(TOOL.mag, 15), circ(TOOL.mag, 14));
  out.push(strip(TOOL.sen, 15), circ(TOOL.sen, 10), box(-8, -14.5, 6, 14.5).map((p) => rotC(p, 240)).map(([x, y]) => [x + TOOL.sen[0], y + TOOL.sen[1]]));
  return out;
}
function rayFar(poly, ux, uy) {
  let best = -1;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length], ex = bx - ax, ey = by - ay;
    const den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / den, s = (ax * uy - ay * ux) / den;
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.max(best, t);
  }
  return best;
}
export function plateOutline(n = 360) {
  const polys = convexPolys(), pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2, ux = Math.cos(th), uy = Math.sin(th);
    let r1 = 0, r2 = 0;
    for (const p of polys) { const r = rayFar(p, ux, uy); if (r > r1) { r2 = r1; r1 = r; } else if (r > r2) r2 = r; }
    const R = r1 + 2.5 * Math.log1p(Math.exp((r2 - r1) / 2.5));
    pts.push([R * ux, R * uy]);
  }
  return pts;
}

function hullOf(points) {
  const s = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of s) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
// Tronco de cono vertical (chaflanes de la copa, punta del plumón), sombreado por caras como extrude.
function frustum(cx, cy, r0, r1, z, h, P, steps = 32) {
  const { sinA, cosA } = cameraOf(P), [vx, vy] = towardViewer(P);
  const bot = circleRing(cx, cy, r0, steps).map(([x, y]) => iso([x, y, z], P));
  const top = circleRing(cx, cy, r1, steps).map(([x, y]) => iso([x, y, z + h], P));
  const shades = [[], [], [], []];
  for (let i = 0; i < steps; i++) {
    const a = ((i + 0.5) / steps) * Math.PI * 2, nx = Math.cos(a), ny = Math.sin(a), j = (i + 1) % steps;
    if (nx * vx + ny * vy <= 0) continue;
    const lit = (nx * -sinA + ny * cosA + 1) / 2;
    shades[Math.min(3, Math.floor(lit * 4))].push(pathOf([top[i], top[j], bot[j], bot[i]], true));
  }
  const hull = hullOf([...bot, ...top]);
  return { fill: pathOf(hull, true), outline: pathOf(hull, true), crease: "", top: pathOf(top, true), shades: shades.map((s) => s.join("")) };
}
function helixZ(cx, cy, R, z0, z1, turns, P) {
  const n = Math.max(8, Math.round(turns * 28)), back = [], front = [];
  let run = [], near = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * Math.PI * 2;
    const p = iso([cx + R * Math.cos(a), cy + R * Math.sin(a), z0 + (z1 - z0) * t], P);
    const f = depthOf([Math.cos(a), Math.sin(a), 0], P) > 0;
    if (near === null) near = f;
    if (f !== near) { run.push(p); (near ? front : back).push(pathOf(run)); run = [p]; near = f; continue; }
    run.push(p);
  }
  if (run.length > 1) (near ? front : back).push(pathOf(run));
  return { back: back.join(""), front: front.join("") };
}

// Escena: giro del cabezal para que el electroimán mire al lector y posición del soporte de banco.
export function sceneOf(P) {
  const [vx, vy] = towardViewer(P), view = (Math.atan2(vy, vx) * 180) / Math.PI;
  const rot = view - 15 - PHI.mag;
  const W = (p) => rotC(p, rot);
  const post = polarC(view + 165, 122);
  return { rot, W, post, mag: W(TOOL.mag), pen: W(TOOL.pen), sen: W(TOOL.sen) };
}

// Pila coaxial: cada pieza se corta en las cotas de las que la envuelven y se pinta de abajo arriba;
// a la misma cota, la de menor radio primero (núcleo → bobina → camisa → copa).
function stackSvg(parts) {
  const pieces = [];
  for (const p of parts) {
    if (p.whole) { pieces.push({ p, a: p.z0, b: p.z1, key: p.z0, r: p.r }); continue; }
    // solo se corta donde entra o sale de una pieza que la envuelve (así no quedan costuras en las de afuera)
    const cuts = new Set();
    for (const q of parts) if (q.r > p.r + 1e-6) { cuts.add(q.z0); cuts.add(q.z1); }
    const inner = [...cuts].filter((z) => z > p.z0 + 1e-6 && z < p.z1 - 1e-6).sort((a, b) => a - b);
    const bounds = [p.z0, ...inner, p.z1];
    for (let i = 0; i < bounds.length - 1; i++) {
      // un tramo dentro de otra pieza se pinta con ella (antes, por menor radio), aunque empiece más arriba
      const a = bounds[i], b = bounds[i + 1];
      let key = a;
      for (const q of parts) if (q.r > p.r + 1e-6 && q.z0 <= a + 1e-6 && q.z1 >= b - 1e-6) key = Math.min(key, q.z0);
      pieces.push({ p, a, b, key, r: p.r });
    }
  }
  pieces.sort((u, w) => u.key - w.key || u.r - w.r);
  return pieces.map(({ p, a, b }) => p.draw(a, b, b >= p.z1 - 1e-6, a <= p.z0 + 1e-6)).join("");
}

// Cuadro: variante v, separación e ∈ [0, 1], subida z (mm), imán encendido on, pieza pegada stuck.
export function frameSvg(P, { v = "olla", e = 0, lift = 0, on = false, stuck = false } = {}) {
  const sc = sceneOf(P), W = sc.W;
  const S = (paths, style) => solidSvg(paths, style);
  const L = (d, style) => lineSvg(d, style);
  const D = (pts, style) => dotsSvg(pts.map((p) => iso(p, P)), style);
  const C = (x, y, r, z, h, style, steps = 36, bevel = 0) => S(cylinder(x, y, r, z, Math.max(0.01, h), P, steps, bevel), style);
  const hexAt = (x, y, R, z, h, style, a0 = 0) => S(extrude(Array.from({ length: 6 }, (_, i) => [x + R * Math.cos(((a0 + 30 + i * 60) * Math.PI) / 180), y + R * Math.sin(((a0 + 30 + i * 60) * Math.PI) / 180)]), z, Math.max(0.01, h), P, { bevel: 0.35 }), style);
  const dep = ([x, y]) => depthOf([x, y, 0], P);
  const arcs = (x, y, r, a, b, step, from) => { const out = []; for (let z = from + step; z < b - 0.25; z += step) if (z > a + 0.25) out.push(sideArc(x, y, r, z, P, 28)); return out.join(""); };
  const hole = (x, y, r, z) => S(cylinder(x, y, r, z - 0.01, 0.01, P, 24), { tone: "lo", flat: true, crease: "none" });
  const local = (t, r, q = 0) => W(herr(t, r, q));
  const dirOf = (t) => { const [x, y] = W(polarC(PHI[t], 1)); return [x, y]; };

  const Zp = Z_DOWN + lift + EXPLODE_LIFT * e, PT = Zp + T_PLACA, zf = Zp - BAJO;
  const [mx, my] = sc.mag, [ux, uy] = dirOf("mag");
  const below = [], above = [];
  const spec = VAR[v];

  // ---------------------------------------------------------------- electroimán
  const parts = [];
  const coilLit = { tone: "hi", crease: "lo", lit: on };
  const leads = (z, r) => {
    // dos puntas del esmaltado: suben 6 mm desde el lado interior de la bobina y terminan en un punto
    const a = [mx - ux * r, my - uy * r], q = [-uy * 1.3, ux * 1.3];
    return [-1, 1].map((s) => L(pathOf([iso([a[0] + q[0] * s, a[1] + q[1] * s, z], P), iso([a[0] + q[0] * s, a[1] + q[1] * s, z + 6], P)]), { tone: "mid" })).join("") +
      D([-1, 1].flatMap((s) => [[a[0] + q[0] * s, a[1] + q[1] * s, z], [a[0] + q[0] * s, a[1] + q[1] * s, z + 6]]), { size: 0.55, tone: "mid" });
  };
  if (v === "olla") {
    const h = spec.h, R = spec.D / 2, Ri = R - spec.wall, rc = spec.core / 2;
    const dz = (d) => zf - d * e;
    const zb = zf + h;
    // separador 06: brida Ø24 × 3, columna Ø14, copa Ø(D + 4) × 8 con chaflanes de 42°
    const cd = 10 * e, cR = R + 2;
    const copa = [
      { r: 12, z0: Zp - 3 - cd, z1: Zp - cd, draw: (a, b) => C(mx, my, 12, a, b - a, { tone: "mid" }, 40, 0.3) },
      { r: 11.9, z0: Zp - 7 - cd, z1: Zp - 3 - cd, whole: true, draw: (a, b) => S(frustum(mx, my, 7, 12, a, b - a, P), { tone: "mid" }) },
      { r: 7, z0: zb + 7.5 - cd, z1: Zp - 7 - cd, draw: (a, b) => C(mx, my, 7, a, b - a, { tone: "mid", crease: "none" }, 32) },
      { r: cR - 0.1, z0: zb + 2 - cd, z1: zb + 7.5 - cd, whole: true, draw: (a, b) => S(frustum(mx, my, cR, 7, a, b - a, P), { tone: "mid" }) },
      { r: cR, z0: zb - 6 - cd, z1: zb + 2 - cd, draw: (a, b) => C(mx, my, cR, a, b - a, { tone: "mid" }, 44, 0.3) },
    ];
    parts.push(...copa);
    const md = 69.2, bd = 50, nd = 30, td = 23;
    // camisa EMT con su costura de soldadura y el hueco a la vista por arriba
    parts.push({ r: R, z0: dz(md), z1: dz(md) + h - spec.cap, draw: (a, b, top) => {
      const sa = (((Math.atan2(uy, ux) * 180) / Math.PI + 38) * Math.PI) / 180, sx = mx + R * Math.cos(sa), sy = my + R * Math.sin(sa);
      return C(mx, my, R, a, b - a, { tone: "mid", inner: L(pathOf([iso([sx, sy, a], P), iso([sx, sy, b], P)]), { tone: "faint" }) }, 44, top ? 0.25 : 0) +
        (top ? hole(mx, my, Ri, b) + L(ring(mx, my, Ri, b, P, 40), { tone: "lo" }) : "");
    } });
    // carrete (pestaña de PLA) + bobina AWG 33
    const bz = dz(bd);
    parts.push({ r: Ri - 0.15, z0: bz, z1: bz + spec.flange, draw: (a, b) => C(mx, my, Ri - 0.15, a, b - a, { tone: "mid" }, 40) });
    parts.push({ r: Ri - 0.3, z0: bz + spec.flange, z1: bz + h - spec.cap, draw: (a, b, top) => {
      const r = Ri - 0.3;
      return C(mx, my, r, a, b - a, { ...coilLit, inner: L(arcs(mx, my, r, a, b, 0.9, bz + spec.flange), { tone: "faint" }) }, 44) +
        (top ? hole(mx, my, rc + 0.25, b) + L(ring(mx, my, rc + 0.25, b, P, 24), { tone: "lo" }) + (e > 0.02 ? leads(b, r - 1.6) : "") : "");
    } });
    // núcleo Ø8 roscado M3 arriba
    parts.push({ r: rc, z0: dz(nd), z1: dz(nd) + h - spec.cap, draw: (a, b, top) => C(mx, my, rc, a, b - a, { tone: "hi", crease: "lo" }, 28, top ? 0.3 : 0) +
      (top ? L(ring(mx, my, 1.25, b, P, 14), { tone: "lo" }) + D([[mx, my, b]], { size: 0.45, tone: "lo" }) : "") });
    // tapa: arandela Ø17.9 × 2 con el paso del tornillo y el de los cables
    const tz = dz(td) + h - spec.cap, cw = [mx - ux * 6, my - uy * 6];
    parts.push({ r: R, z0: tz, z1: tz + spec.cap, draw: (a, b, top) => C(mx, my, R, a, b - a, { tone: "mid" }, 44, 0.25) +
      (top ? hole(mx, my, 1.7, b) + L(ring(mx, my, 1.7, b, P, 14) + ring(cw[0], cw[1], 1.5, b, P, 14), { tone: "lo" }) : "") });
  } else {
    const s = spec, rb = s.bolt / 2, cd = 10 * e;
    const dz = (d) => zf - d * e;
    const zb = zf + s.h;
    const cR = s.hexR + 0.3 + 2;
    parts.push(
      { r: 12, z0: Zp - 3 - cd, z1: Zp - cd, draw: (a, b) => C(mx, my, 12, a, b - a, { tone: "mid" }, 40, 0.3) },
      { r: cR, z0: zb - 6 - cd, z1: Zp - 3 - cd, draw: (a, b) => C(mx, my, cR, a, b - a, { tone: "mid" }, 44, 0.3) },
    );
    // perno 3/8"-16 × 1": cabeza hexagonal arriba (en la copa), caña roscada hasta la cara
    const pz = zf - cd;
    parts.push({ r: s.hexR, z0: pz + 25.4, z1: pz + s.h, draw: (a, b, top) => hexAt(mx, my, s.hexR, a, b - a, { tone: "hi", crease: "lo" }, 15) +
      (top ? L(ring(mx, my, 1.25, b, P, 14), { tone: "lo" }) + D([[mx, my, b]], { size: 0.45, tone: "lo" }) : "") });
    parts.push({ r: rb, z0: pz, z1: pz + 25.4, draw: (a, b, top, bottom) => C(mx, my, rb, a, b - a, { tone: "hi", crease: "lo", inner: L(arcs(mx, my, rb, a, b, 1.5875, pz), { tone: "faint" }) }, 28, bottom ? 0.35 : 0) });
    const wd = 10 + 32.4, cdd = 10 + 39.4, bwd = 10 + 46.4, nd = 10 + 53.4;
    const washer = (z, d) => ({ r: s.D / 2, z0: z - d * e, z1: z - d * e + s.washer, draw: (a, b, top) => C(mx, my, s.D / 2, a, b - a, { tone: "mid" }, 44, 0.25) +
      (top ? hole(mx, my, 5.15, b) + L(ring(mx, my, 5.15, b, P, 28), { tone: "lo" }) : "") });
    parts.push(washer(zf + 25.4 - s.washer, wd));
    const cz0 = zf + s.tip + s.nut + s.washer - cdd * e, cz1 = zf + 25.4 - s.washer - cdd * e, cr = s.coilOD / 2;
    parts.push({ r: cr, z0: cz0, z1: cz1, draw: (a, b, top) => C(mx, my, cr, a, b - a, { ...coilLit, inner: L(arcs(mx, my, cr, a, b, 0.95, cz0), { tone: "faint" }) }, 44) +
      (top ? hole(mx, my, rb + 0.35, b) + L(ring(mx, my, rb + 0.35, b, P, 28), { tone: "lo" }) + (e > 0.02 ? leads(b, cr - 1.4) : "") : "") });
    parts.push(washer(zf + s.tip + s.nut, bwd));
    parts.push({ r: s.hexR, z0: zf + s.tip - nd * e, z1: zf + s.tip + s.nut - nd * e, draw: (a, b, top) => hexAt(mx, my, s.hexR, a, b - a, { tone: "mid" }, 15) +
      (top ? hole(mx, my, rb, b) + L(ring(mx, my, rb, b, P, 28), { tone: "lo" }) : "") });
  }
  // tornillo M3: la caña bajo la placa (solo se ve en el hueco brida-placa al separar)
  const rise = (spec.screw + 4) * e, sBot = PT - spec.screw + rise;
  if (sBot < Zp - 0.01) parts.push({ r: 1.5, z0: sBot, z1: Zp, draw: (a, b) => C(mx, my, 1.5, a, b - a, { tone: "mid", crease: "none" }, 12) });
  const magStack = stackSvg(parts);

  // cables del perno: salen bajo la arandela superior por el lado interior y suben por fuera de la copa
  let magBack = "";
  if (v === "perno" && e < 0.02) {
    const z0 = zf + 25.4 - spec.washer - 1.2, q = [-uy * 1.3, ux * 1.3];
    magBack = [-1, 1].map((sg) => {
      const p = (r, z) => iso([mx - ux * r + q[0] * sg, my - uy * r + q[1] * sg, z], P);
      return L(pathOf([p(8.6, z0), p(15.5, z0), p(15.5, Zp)]), { tone: sg < 0 ? "lo" : "mid" });
    }).join("");
  }

  // ---------------------------------------------------------------- plumón (0°) y sensor (240°): referencia
  const [px, py] = sc.pen, [sx, sy] = sc.sen;
  const ref = { tone: "lo" };
  const tz = Zp - 50 + 18;                                         // plumón arriba mientras trabaja el imán
  const sp = helixZ(px, py, 8, PT + 26, PT + 44, 6, P);
  const pen = [
    { r: 9.5, z0: Zp - 16, z1: Zp, draw: (a, b) => C(px, py, 9.5, a, b - a, ref) },
    { r: 9.5, z0: PT, z1: PT + 14, draw: (a, b) => C(px, py, 9.5, a, b - a, ref) },
    { r: 10, z0: PT + 20, z1: PT + 26, draw: (a, b) => C(px, py, 10, a, b - a, { tone: "mid" }, 36, 0.4) },
    { r: -1, z0: PT + 26, z1: PT + 44, whole: true, draw: () => L(sp.back, { tone: "lo" }) },
    { r: 99, z0: PT + 26.001, z1: PT + 44, whole: true, draw: () => L(sp.front, { tone: "mid" }) },
    { r: 10, z0: PT + 44, z1: PT + 48, draw: (a, b) => C(px, py, 10, a, b - a, { tone: "mid" }, 36, 0.4) + L(ring(px, py, 6.4, b, P, 28), { tone: "lo" }) },
    { r: 3.2, z0: tz, z1: tz + 9, whole: true, draw: (a, b) => S(frustum(px, py, 0.6, 3.2, a, b - a, P), { tone: "mid" }) },
    { r: 5, z0: tz + 9, z1: tz + 15, draw: (a, b) => C(px, py, 5, a, b - a, ref, 28) },
    { r: 6, z0: tz + 15, z1: tz + 127, draw: (a, b) => C(px, py, 6, a, b - a, { tone: "mid", crease: "lo" }, 28) },
  ];
  const penLow = stackSvg(pen.map((p) => ({ ...p, z1: Math.min(p.z1, Zp) })).filter((p) => p.z1 > p.z0 + 0.01));
  const penHigh = stackSvg(pen.map((p) => ({ ...p, z0: Math.max(p.z0, PT) })).filter((p) => p.z1 > p.z0 + 0.01));
  // cuna del servo y poste del puente, a un lado del plumón
  const pq = dirOf("pen"), pt = [-pq[1], pq[0]];
  const penPt = (u, q) => [px + pq[0] * u + pt[0] * q, py + pq[1] * u + pt[1] * q];
  const cradle = S(extrude([penPt(-13, -20), penPt(23.5, -20), penPt(23.5, -11), penPt(-13, -11)], PT, 30, P, { bevel: 0.4 }), ref);
  const servo = S(extrude([penPt(-9.5, -10.6), penPt(13, -10.6), penPt(13, 1.6), penPt(-9.5, 1.6)], PT + 8, 22.7, P, { bevel: 0.4 }), { tone: "mid" });
  const postP = penPt(14, -15);
  const penPost = C(postP[0], postP[1], 3, PT + 30, 18, ref, 20);

  const st = dirOf("sen"), stq = [-st[1], st[0]];
  const senPt = (u, q) => [sx + st[0] * u + stq[0] * q, sy + st[1] * u + stq[1] * q];
  const sen = [
    { r: 6, z0: Zp - 38, z1: PT + 16, draw: (a, b, top, bot) => C(sx, sy, 6, a, b - a, { tone: "mid", crease: "lo", inner: L(arcs(sx, sy, 6, a, b, 1.5, Zp - 38 + 3), { tone: "faint" }) }, 32, bot ? 0.4 : 0) },
    { r: 5.5, z0: PT + 16, z1: PT + 21, draw: (a, b) => C(sx, sy, 5.5, a, b - a, ref, 28) + D([[sx + st[0] * 5.5, sy + st[1] * 5.5, (a + b) / 2]], { size: 1, tone: "mid" }) },
    { r: 3.2, z0: PT + 21, z1: PT + 26, draw: (a, b) => C(sx, sy, 3.2, a, b - a, ref, 20) },
  ];
  const clamp = S(extrude([senPt(-8, -14.5), senPt(6, -14.5), senPt(6, 14.5), senPt(-8, 14.5)], Zp - 14, 14, P, { bevel: 0.4 }), ref);
  const senLow = clamp + stackSvg(sen.map((p) => ({ ...p, z1: Math.min(p.z1, Zp - 14) })).filter((p) => p.z1 > p.z0 + 0.01));
  const senHigh = stackSvg(sen.map((p) => ({ ...p, z0: Math.max(p.z0, PT) })).filter((p) => p.z1 > p.z0 + 0.01)) +
    L(pathOf([iso([sx, sy, PT + 26], P), iso([sx, sy, PT + 34], P)]), { tone: "lo" }) + D([[sx, sy, PT + 26], [sx, sy, PT + 34]], { size: 0.7, tone: "lo" });

  // ---------------------------------------------------------------- pernos M4, separador de brida, connector y J3
  const bolts = PERNOS.map((p) => W(p));
  const boltLow = bolts.map(([x, y]) => ({ d: dep([x, y]), svg: C(x, y, 3.5, Zp - 4, 4, { tone: "mid" }, 24, 0.3) }));
  const bar = (w, d, r) => { const pl = roundedPlan({ x: -w / 2, y: -d / 2, w, d, r }, 8); return pl.map((p) => W(rotC(p, ALFA))); };
  const j3 = [];
  j3.push(S(extrude(bar(78, 30, 8), PT, 14, P, { bevel: 0.6 }), { tone: "mid", inner: L(pathOf(bar(70, 22, 5).map(([x, y]) => iso([x, y, PT + 14], P)), true), { tone: "faint" }) }));
  j3.push(S(extrude(bar(80, 32, 9), PT + 14, 4.5, P, { bevel: 0.4 }), ref));
  j3.push(S(extrude(bar(82, 34, 10), PT + 18.5, 7, P, { bevel: 0.5 }), ref));
  for (const [x, y] of [...bolts].sort((a, b) => dep(a) - dep(b))) j3.push(hexAt(x, y, 3.6, PT + 25.5, 3.2, { tone: "mid" }) + C(x, y, 2, PT + 28.7, 1.2, { tone: "mid", crease: "none" }, 14));
  j3.push(C(0, 0, 28, PT + 25.5, 22, { ...ref, inner: L(sideArc(0, 0, 28, PT + 36.5, P, 44), { tone: "faint" }) }, 64, 0.6));
  const armZ = PT + 47.5, armH = 24;
  const [qx, qy] = sc.post, al = Math.hypot(qx, qy), ax = qx / al, ay = qy / al;
  const armEnd = al - 14;
  const arm = S(extrude([[-ay * 16, ax * 16], [ax * armEnd - ay * 16, ay * armEnd + ax * 16], [ax * armEnd + ay * 16, ay * armEnd - ax * 16], [ay * 16, -ax * 16]], armZ, armH, P, { bevel: 0.6 }),
    ref);
  j3.push(C(0, 0, 39, armZ, armH, { ...ref, inner: L(sideArc(0, 0, 39, armZ + 12, P, 56), { tone: "faint" }) }, 72, 0.6));
  j3.push(L(ring(0, 0, 30, armZ + armH, P, 56) + ring(0, 0, 21, armZ + armH, P, 44), { tone: "lo" }));
  j3.push(D([0, 1, 2, 3, 4, 5].map((i) => [25.5 * Math.cos((i * Math.PI) / 3), 25.5 * Math.sin((i * Math.PI) / 3), armZ + armH]), { size: 0.5 }));

  // soporte de banco: poste Ø12 fijo y abrazadera que sube con Z (perilla moleteada al frente)
  const POST_TOP = Z_DOWN + EXPLODE_LIFT + T_PLACA + 47.5 + armH + 8;
  const cz0 = armZ + 3, cz1 = armZ + armH - 3;
  const standLow = C(qx, qy, 6, 4, cz0 - 4, { tone: "mid", crease: "none" }, 32);
  const standClamp = S(extrude([[qx - ay * 10 - ax * 10, qy + ax * 10 - ay * 10], [qx + ax * 10 - ay * 10, qy + ay * 10 + ax * 10], [qx + ax * 10 + ay * 10, qy + ay * 10 - ax * 10], [qx - ax * 10 + ay * 10, qy - ay * 10 - ax * 10]], cz0, cz1 - cz0, P, { bevel: 0.6 }), { tone: "mid" });
  const standHigh = C(qx, qy, 6, cz1, POST_TOP - cz1, { tone: "mid", crease: "none" }, 32) + L(ring(qx, qy, 3, POST_TOP, P, 16), { tone: "lo" });
  const knobAt = [qx - ay * 14, qy + ax * 14];
  const knob = C(knobAt[0], knobAt[1], 4, (cz0 + cz1) / 2 - 3, 6, { tone: "mid" }, 24);

  // ---------------------------------------------------------------- placa del cabezal (6 mm)
  const outline = plateOutline().map((p) => W(p));
  const slot = (p0, p1, w) => {
    const [x0, y0] = W(p0), [x1, y1] = W(p1), L0 = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / L0, dy = (y1 - y0) / L0, h = w / 2, pts = [];
    for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + (Math.PI * i) / 10; pts.push([x0 + h * (Math.cos(a) * dx - Math.sin(a) * dy), y0 + h * (Math.cos(a) * dy + Math.sin(a) * dx)]); }
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 10; pts.push([x1 + h * (Math.cos(a) * dx - Math.sin(a) * dy), y1 + h * (Math.cos(a) * dy + Math.sin(a) * dx)]); }
    return pathOf(pts.map(([x, y]) => iso([x, y, PT], P)), true);
  };
  const cableHole = local("mag", -15.5);
  const tie = [local("mag", -24, -4), local("mag", -24, 4)];
  const plateLines = [
    ring(px, py, 6.4, PT, P, 32), ring(sx, sy, 6.4, PT, P, 32), ring(mx, my, 2.3, PT, P, 16), ring(cableHole[0], cableHole[1], 2.75, PT, P, 18),
    slot(herr("mag", -31), herr("mag", -27.5), 5), slot(herr("pen", -31), herr("pen", -16), 4),
    ...[[-24, -4], [-24, 4]].map(([r, q]) => slot(herr("mag", r - 1.75, q), herr("mag", r + 1.75, q), 1.6)),
  ].join("");
  const plate = S(extrude(outline, Zp, T_PLACA, P, { convex: false, bevel: 0.6 }), { tone: "mid", crease: "lo", inner: L(plateLines, { tone: "lo" }) });

  // ---------------------------------------------------------------- sobre la placa: tornillo, cables, cincho y conector JST
  const screwTop = [];
  if (rise > 0.01) screwTop.push(C(mx, my, 1.5, Math.max(PT, sBot), PT + rise - Math.max(PT, sBot), { tone: "mid", crease: "none" }, 12));
  screwTop.push(C(mx, my, 2.75, PT + rise, 3, { tone: "mid" }, 20, 0.3) + L(ring(mx, my, 1.3, PT + rise + 3, P, 6), { tone: "lo" }));
  let wiresTop = "";
  if (e < 0.02) {
    const jst0 = local("mag", -36), jst1 = local("mag", -30);
    const q = [-uy, ux];
    const jw = 4;
    const jst = S(extrude([[jst0[0] - q[0] * jw, jst0[1] - q[1] * jw], [jst1[0] - q[0] * jw, jst1[1] - q[1] * jw], [jst1[0] + q[0] * jw, jst1[1] + q[1] * jw], [jst0[0] + q[0] * jw, jst0[1] + q[1] * jw]], PT, 4.5, P, { bevel: 0.3 }), { tone: "mid" });
    const leadsTop = [-1, 1].map((sg) => {
      const a = [cableHole[0] + q[0] * 1.2 * sg, cableHole[1] + q[1] * 1.2 * sg], b = [jst1[0] + q[0] * 1.6 * sg, jst1[1] + q[1] * 1.6 * sg];
      return L(pathOf([iso([a[0], a[1], PT], P), iso([a[0], a[1], PT + 1.2], P), iso([b[0], b[1], PT + 1.2], P)]), { tone: sg < 0 ? "lo" : "mid", flow: on }) + D([[a[0], a[1], PT]], { size: 0.45, tone: "lo" });
    }).join("");
    const band = S(extrude([[tie[0][0] - ux * 1.2, tie[0][1] - uy * 1.2], [tie[0][0] + ux * 1.2, tie[0][1] + uy * 1.2], [tie[1][0] + ux * 1.2, tie[1][1] + uy * 1.2], [tie[1][0] - ux * 1.2, tie[1][1] - uy * 1.2]], PT, 2.2, P, { bevel: 0.2 }), { tone: "mid" });
    wiresTop = leadsTop + band + jst + D([[jst0[0] - q[0] * 2, jst0[1] - q[1] * 2, PT + 2.2], [jst0[0] + q[0] * 2, jst0[1] + q[1] * 2, PT + 2.2]], { size: 0.5, tone: "lo" });
  }

  // ---------------------------------------------------------------- pieza de prueba (disco de acero Ø40 × 7, 69 g)
  const pz = stuck ? zf - PIECE.h : 0;
  const pieceSvg = (pz > 0.5 ? `<path class="iso-halo" d="${haloOf({ x: mx - PIECE.r, y: my - PIECE.r, w: PIECE.r * 2, d: PIECE.r * 2, r: PIECE.r }, 0, 1, P)}"/>` : "") +
    C(mx, my, PIECE.r, pz, PIECE.h, { tone: "mid", inner: L(ring(mx, my, PIECE.r - 3, pz + PIECE.h, P, 56), { tone: "faint" }) }, 64, 0.5) +
    (() => {
      // grabado en la cara superior: renglón a lo largo de la tangente, pie hacia el lector
      const o = [mx + ux * 15, my + uy * 15], z = pz + PIECE.h, O = iso([o[0], o[1], z], P);
      let t = [-uy, ux];
      if (iso([o[0] + t[0], o[1] + t[1], z], P)[0] < O[0]) t = [uy, -ux];
      const X = iso([o[0] + t[0], o[1] + t[1], z], P), Y = iso([o[0] + ux, o[1] + uy, z], P);
      const f = (n) => Math.round(n * 1000) / 1000;
      return faceTextSvg(`matrix(${f(X[0] - O[0])} ${f(X[1] - O[1])} ${f(Y[0] - O[0])} ${f(Y[1] - O[1])} ${f(O[0])} ${f(O[1])})`, Math.round(PIECE.grams) + " g", { size: 3.4, tone: "lo", anchor: "middle" });
    })();

  // ---------------------------------------------------------------- orden de pintura
  const lowItems = [
    { d: dep([mx, my]) - 0.01, svg: pieceSvg },
    { d: dep(sc.post) - 1, svg: standLow + standClamp + knob + standHigh },
    { d: dep([px, py]), svg: penLow },
    { d: dep([sx, sy]), svg: senLow },
    ...boltLow,
    { d: dep([mx, my]), svg: magBack + magStack },
  ].sort((a, b) => a.d - b.d);
  below.push(...lowItems.map((i) => i.svg), plate);
  const upItems = [
    { d: dep(sc.post), svg: arm },
    { d: dep([px, py]), svg: cradle + servo + penPost + penHigh },
    { d: dep([sx, sy]), svg: senHigh },
    { d: 0, svg: j3.join("") },
    { d: dep([mx, my]), svg: wiresTop + screwTop.join("") },
  ].sort((a, b) => a.d - b.d);
  above.push(...upItems.map((i) => i.svg));
  return below.join("") + above.join("");
}
