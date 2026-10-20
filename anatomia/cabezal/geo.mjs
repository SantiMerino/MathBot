// Geometría del cabezal A v2 (placa trébol) para la Fig 4. Se usa en Node (cuadro inicial) y en el navegador
// (se inyecta sin import/export). Mismas medidas que simulador_scara/plantilla.html: herramientas a 55 mm del
// eje J3 en 0° / 120° / 240°, placa de 6 mm, plumón 50 mm bajo la placa, levante 18 mm.
import { iso, depthOf, pathOf, extrude, cylinder, circleRing, solidSvg, lineSvg, dotsSvg, ring, sideArc, knurl, towardViewer, cameraOf } from "../kit/iso-kit.mjs";

export const HEAD = {
  Zp: 100, plate: 6, lift: 18, tools: { pen: [0, 55], mag: [120, 55], sen: [240, 55] },
  lobes: [{ a: 0, d: 55, r: 20, w: 40 }, { a: -13.5, d: 73, r: 9, w: 0 }, { a: 120, d: 55, r: 13, w: 20 }, { a: 240, d: 55, r: 12, w: 20 }],
  hub: 27,
};

// Contorno en estrella: cubo + brazo y lóbulo por herramienta, con máximo suave en los rincones.
export function trefoil(lobes, hubR, n = 240) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    let r1 = hubR, r2 = 0;
    const put = (r) => { if (r > r1) { r2 = r1; r1 = r; } else if (r > r2) r2 = r; };
    for (const L of lobes) {
      const D = th - (L.a * Math.PI) / 180, c = Math.cos(D), s = Math.abs(Math.sin(D));
      if (c <= 0) continue;
      const q = L.r * L.r - L.d * L.d * s * s;
      if (q >= 0) put(L.d * c + Math.sqrt(q));
      put(Math.min(L.w / 2 / Math.max(s, 1e-6), L.d / c));
    }
    const R = r1 + 1.5 * Math.log1p(Math.exp((r2 - r1) / 1.5));
    pts.push([R * Math.cos(th), R * Math.sin(th)]);
  }
  return pts;
}

const hullOf = (points) => {
  const s = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of s) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
};

// Tronco de cono vertical (punta del plumón): mismo sombreado por caras que extrude.
function frustum(cx, cy, r0, r1, z, h, P, steps = 28) {
  const { sinA, cosA } = cameraOf(P), [vx, vy] = towardViewer(P);
  const bot = circleRing(cx, cy, r0, steps).map(([x, y]) => iso([x, y, z], P));
  const top = circleRing(cx, cy, r1, steps).map(([x, y]) => iso([x, y, z + h], P));
  const shades = [[], [], [], []], front = [];
  for (let i = 0; i < steps; i++) {
    const a = ((i + 0.5) / steps) * Math.PI * 2, nx = Math.cos(a), ny = Math.sin(a), j = (i + 1) % steps;
    if (nx * vx + ny * vy <= 0) continue;
    const lit = (nx * -sinA + ny * cosA + 1) / 2;
    shades[Math.min(3, Math.floor(lit * 4))].push(pathOf([top[i], top[j], bot[j], bot[i]], true));
    front.push(i);
  }
  const hull = hullOf([...bot, ...top]);
  return { fill: pathOf(hull, true), outline: pathOf(hull, true), crease: "", top: pathOf(top, true), shades: shades.map((s) => s.join("")) };
}

// Placa delgada en un plano vertical y = y0..y1, contorno [x, z] (brazo del servo). Cara cercana = "top".
function plateY(outline, y0, y1, P) {
  const near = depthOf([0, 1, 0], P) > 0 ? y1 : y0, far = near === y1 ? y0 : y1;
  const a = outline.map(([x, z]) => iso([x, near, z], P)), b = outline.map(([x, z]) => iso([x, far, z], P));
  const hull = hullOf([...a, ...b]);
  return { fill: pathOf(hull, true), outline: pathOf(hull, true), crease: pathOf(a, true), top: pathOf(a, true), shades: ["", pathOf(hull, true), "", ""] };
}

// Hélice vertical partida en mitad trasera y delantera (resorte alrededor del plumón).
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

// Cuadro del cabezal con separación e ∈ [0, 1] y levante del plumón l ∈ [0, 18] mm.
// Devuelve { below, above }: lo que va antes de la brida / J3 y lo que va después, ya en orden de pintura.
export function headSvg(P, e, l) {
  const H = HEAD, Zp = H.Zp, ZH = Zp + H.plate;
  const S = (paths, style) => solidSvg(paths, style);
  const L = (d, style) => lineSvg(d, style);
  const D = (pts, style) => dotsSvg(pts.map((p) => iso(p, P)), style);
  const C = (x, y, r, z, h, style, steps = 32, bevel = 0) => S(cylinder(x, y, r, z, Math.max(0.01, h), P, steps, bevel), style);
  const hex = (x, y, r, z, h, style) => S(extrude(circleRing(x, y, r, 6).map(([px, py]) => [px, py]), z, h, P, { bevel: 0.4 }), style);
  const dep = ([x, y]) => depthOf([x, y, 0], P);
  const polar = ([a, r]) => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)];
  const out = (a, k) => polar([a, k]);

  // Pila coaxial: cuerpos largos ("rod") partidos en cada collar y en la placa; se ordenan por su cota inferior.
  // pass 0 = bajo la cara superior de la placa, pass 1 = sobre ella.
  function stack(x, y, items, zPlateTop) {
    const cuts = new Set([zPlateTop]);
    for (const it of items) if (it.kind !== "rod") { cuts.add(it.z1); cuts.add(it.z0); }
    const pieces = [];
    for (const it of items) {
      if (it.kind !== "rod") { pieces.push({ ...it, key: it.z0 + (it.kind === "springFront" || it.kind === "mark" ? 0.002 : 0.001) }); continue; }
      const zs = [it.z0, ...[...cuts].filter((z) => z > it.z0 + 1e-6 && z < it.z1 - 1e-6).sort((a, b) => a - b), it.z1];
      for (let i = 0; i < zs.length - 1; i++) pieces.push({ ...it, z0: zs[i], z1: zs[i + 1], key: zs[i] });
    }
    pieces.sort((a, b) => a.key - b.key);
    const pass = [[], []];
    for (const p of pieces) {
      const svg = p.kind === "rod" || p.kind === "collar" ? (p.draw ? p.draw(p.z0, p.z1) : C(x, y, p.r, p.z0, p.z1 - p.z0, p.style, p.steps ?? 32, p.bevel ?? 0)) : p.svg;
      pass[p.z0 < zPlateTop - 1e-6 ? 0 : 1].push(svg);
    }
    return pass.map((list) => list.join(""));
  }

  const below = [], above = [];
  const plateDz = -20 * e;
  const PZ = Zp + plateDz, PT = PZ + H.plate;                             // placa ya desplazada

  // ---- pernos M4 (salen hacia abajo)
  const bz = Zp - 48 * e;
  const bolts = [0, 1, 2, 3].map((k) => polar([45 + 90 * k, 16])).sort((a, b) => dep(a) - dep(b));
  const boltSvg = bolts.map(([x, y]) => C(x, y, 3.5, bz - 4, 4, { tone: "mid" }, 24, 0.3) + L(ring(x, y, 1.6, bz - 4, P, 6), { tone: "lo" }) + C(x, y, 2, bz, 10, { tone: "mid", crease: "none" }, 16)).join("");

  // ---- electroimán (120°)
  const [mx0, my0] = polar(H.tools.mag), [mox, moy] = out(120, 28 * e);
  const mx = mx0 + mox, my = my0 + moy, mdz = plateDz;
  const magDz = -38 * e, scrDz = 30 * e;
  const mag = stack(mx, my, [
    { kind: "collar", z0: PZ - 25, z1: PZ, draw: (a, b) => hex(mx, my, 6.5, a, b - a, { tone: "mid" }) },
    { kind: "collar", z0: PZ - 40 + magDz, z1: PZ - 38 + magDz, r: 10.2, style: { tone: "lo" } },
    { kind: "collar", z0: PZ - 38 + magDz, z1: PZ - 25 + magDz, r: 10, style: { tone: "hi", crease: "lo", inner: L(sideArc(mx, my, 10, PZ - 34 + magDz, P, 28), { tone: "faint" }) }, steps: 40, bevel: 0.4 },
    { kind: "collar", z0: PT + scrDz, z1: PT + 3 + scrDz, r: 2.8, style: { tone: "mid" }, steps: 18 },
    { kind: "rod", z0: PT - 35 + scrDz + 3, z1: PT + scrDz, r: 1.5, style: { tone: "mid", crease: "none" }, steps: 12, hide: true },
  ], PT);
  // cables del electroimán: suben junto al separador hasta la placa y terminan en un conector
  // (al separar, el electroimán baja con sus cables y un conector JST en la punta)
  const wz0 = PZ - 25 + magDz, wz1 = wz0 + 25;
  const jst = e > 0.02;
  const wires = [[-1.4, "lo"], [1.4, "mid"]].map(([dy, tone]) => L(pathOf([iso([mx + 7.5, my + dy, wz0], P), iso([mx + 7.5, my + dy, wz1 - (jst ? 4 : 0)], P)]), { tone })).join("") +
    (jst ? S(extrude([[mx + 5, my - 2.5], [mx + 10, my - 2.5], [mx + 10, my + 2.5], [mx + 5, my + 2.5]], wz1 - 4, 4, P, { bevel: 0.3 }), { tone: "mid" }) : "");

  // ---- sensor inductivo (240°)
  const [sx0, sy0] = polar(H.tools.sen), [sox, soy] = out(240, 28 * e);
  const sx = sx0 + sox, sy = sy0 + soy;
  const bD = -30 * e;
  const senBody = (a, b) => C(sx, sy, 6, a, b - a, { tone: "hi", crease: "lo" }, 32);
  const sen = stack(sx, sy, [
    { kind: "collar", z0: PZ - 38 + bD, z1: PZ - 35 + bD, r: 6.1, style: { tone: "lo" }, steps: 32 },
    { kind: "rod", z0: PZ - 35 + bD, z1: PZ + 17 + bD, draw: senBody },
    { kind: "collar", z0: PZ - 5 - 12 * e, z1: PZ - 12 * e, draw: (a, b) => hex(sx, sy, 9.5, a, b - a, { tone: "mid" }) },
    { kind: "collar", z0: PT + 18 * e, z1: PT + 5 + 18 * e, draw: (a, b) => hex(sx, sy, 9.5, a, b - a, { tone: "mid" }) },
    { kind: "rod", z0: PZ + 17 + bD, z1: PZ + 23 + bD, r: 5, style: { tone: "mid" }, steps: 28 },
    { kind: "rod", z0: PZ + 23 + bD, z1: PZ + 27 + bD, r: 2.2, style: { tone: "mid", crease: "none" }, steps: 16 },
    { kind: "mark", z0: PZ + 20 + bD, z1: PZ + 20 + bD, svg: D([[sx + 5, sy, PZ + 20 + bD]], { size: 1.3, tone: "hi" }) },
  ], PT);

  // ---- módulo del plumón (0°)
  const px = 55 + 30 * e, py = 0;
  const Zc = PZ + 16, Zb = PZ + 52, Zs = Zc + 9;
  const penDz = -60 * e, colDz = 16 * e, sprDz = 34 * e, briDz = 58 * e;
  const tz = PZ - 50 + penDz + l;
  const cz = Zc + colDz + l;                                                // cara inferior del collar
  const sb0 = cz + 6, sb1 = Zb + sprDz;                                     // resorte entre collar y puente
  const coil = helixZ(px, py, 8, sb0, sb1, 7, P);
  const penStyle = { tone: "hi", crease: "lo", lit: true };
  const hornAng = Math.asin(Math.max(-1, Math.min(1, (l * 20 / 18 - 11) / 12)));
  const servoD = [0, -30 * e, 10 * e], hornD = [0, -10 * e, 10 * e];
  const hx = px + 12 + hornD[0], hy = py - 8 + hornD[1], hz = Zs + hornD[2];
  const hornTip = [hx - 12 * Math.cos(hornAng), hz + 12 * Math.sin(hornAng)];
  const hornSvg = (() => {
    const w = 1.3, dx = hornTip[0] - hx, dz = hornTip[1] - hz, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    const arm = [[hx - uz * w * 2, hz + ux * w * 2], [hornTip[0] - uz * w, hornTip[1] + ux * w], [hornTip[0] + uz * w, hornTip[1] - ux * w], [hx + uz * w * 2, hz - ux * w * 2]];
    const disc = Array.from({ length: 20 }, (_, i) => [hx + 3.6 * Math.cos((i / 20) * Math.PI * 2), hz + 3.6 * Math.sin((i / 20) * Math.PI * 2)]);
    return S(plateY(arm, hy - 1, hy + 1, P), { tone: "mid" }) + S(plateY(disc, hy - 1.2, hy + 1.2, P), { tone: "mid" }) +
      D([[hx, hy + 1.2, hz]], { size: 0.5, tone: "mid" });
  })();
  const servoSvg = (() => {
    // cuerpo en y ∈ [−32.7, −10] respecto al plumón; la cara del eje mira al plumón
    const [dx, dy, dz] = servoD, x0 = px - 4.6 + dx, y0 = py - 32.7 + dy, z0 = Zs - 6.1 + dz;
    const body = S(extrude([[x0, y0], [x0 + 22.5, y0], [x0 + 22.5, y0 + 22.7], [x0, y0 + 22.7]], z0, 12.2, P, { bevel: 0.4 }), { tone: "mid", inner: L(pathOf([iso([x0 + 22.5, y0 + 16.7, z0], P), iso([x0 + 22.5, y0 + 16.7, z0 + 12.2], P)]) + pathOf([iso([x0, y0 + 16.7, z0 + 12.2], P), iso([x0 + 22.5, y0 + 16.7, z0 + 12.2], P)]), { tone: "faint" }) });
    const ears = S(extrude([[x0 - 5, y0 + 16.95], [x0 + 27.5, y0 + 16.95], [x0 + 27.5, y0 + 19.45], [x0 - 5, y0 + 19.45]], z0, 12.2, P), { tone: "mid" });
    const holes = D([[x0 - 2.6, y0 + 18.2, z0 + 12.2], [x0 + 25.1, y0 + 18.2, z0 + 12.2]], { size: 0.45 });
    const cable = L(pathOf([iso([x0 + 22.5, y0 + 4.7, z0 + 4], P), iso([x0 + 26, y0 + 4.7, z0 + 4], P), iso([x0 + 26, y0 + 4.7, z0 - 4], P)]), { tone: "lo" });
    return ears + body + holes + cable;
  })();
  const pillars = [-7.6, 20.9].map((x) => {
    const X = px + x - 2, Y = py - 18.75;
    return S(extrude([[X, Y], [X + 4, Y], [X + 4, Y + 3], [X, Y + 3]], PT, Zs + 6.1 - PT, P, { bevel: 0.3 }), { tone: "mid" }) + D([[X + 2, Y + 1.5, Zs + 6.1]], { size: 0.45 });
  });
  const post = S(cylinder(px + 14, py + 8, 3, PT + briDz, Zb + 4 - PT, P, 20), { tone: "mid" });
  const bridgeTop = (() => {
    const z = Zb + briDz, a = Math.atan2(8, 14), c = Math.cos(a), s = Math.sin(a), x = px + 7, y = py + 4;
    const bar = [[-8, -3], [8, -3], [8, 3], [-8, 3]].map(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
    return S(extrude(bar, z, 4, P, { bevel: 0.3 }), { tone: "mid" }) + C(px, py, 10, z, 4, { tone: "mid", inner: L(ring(px, py, 6.4, z + 4, P, 32), { tone: "lo" }) }, 36, 0.4);
  })();
  const penBody = (a, b) => {
    const parts = [];
    const seg = (z0, z1, r, style, steps = 28) => { const lo = Math.max(a, z0), hi = Math.min(b, z1); if (hi > lo + 0.01) parts.push(C(px, py, r, lo, hi - lo, style, steps)); };
    seg(tz + 15, tz + 95, 6, penStyle); seg(tz + 95, tz + 105, 6.2, { tone: "hi", crease: "lo" }); seg(tz + 105, tz + 127, 6, penStyle);
    return parts.join("");
  };
  const penTip = S(frustum(px, py, 0.6, 3.2, tz, 9, P), { tone: "hi" }) + C(px, py, 5, tz + 9, 6, { tone: "mid" }, 28);
  const pen = stack(px, py, [
    { kind: "collar", z0: PZ - 16, z1: PZ, r: 9.5, style: { tone: "mid", inner: L(sideArc(px, py, 9.5, PZ - 8, P, 28), { tone: "faint" }) }, steps: 36 },
    { kind: "collar", z0: PT, z1: PT + 2, r: 13, style: { tone: "mid" }, steps: 40, bevel: 0.3 },
    { kind: "collar", z0: PT + 2, z1: PZ + 14, r: 9.5, style: { tone: "mid" }, steps: 36 },
    { kind: "rod", z0: tz + 15, z1: tz + 127, draw: penBody },
    { kind: "collar", z0: cz, z1: cz + 6, draw: (a, b) => C(px, py, 10, a, b - a, { tone: "mid" }, 36, 0.4) + C(px + 11.2, py, 1.4, a + 2.2, 1.6, { tone: "mid" }, 12) },
    { kind: "springBack", z0: sb0 - 0.01, z1: sb1, svg: L(coil.back, { tone: "lo" }) },
    { kind: "springFront", z0: sb0, z1: sb1, svg: L(coil.front, { tone: "mid" }) },
    { kind: "collar", z0: Zb + briDz, z1: Zb + 4 + briDz, draw: () => bridgeTop },
  ], PT);
  const penBelow = (tz < PZ - 16 ? penTip : "") + pen[0];
  const penAbove = (tz >= PZ - 16 ? penTip : "") + pen[1];

  // ---- placa trébol
  const ringPts = trefoil(H.lobes, H.hub);
  const holes = [[0, 0, 7], ...[0, 1, 2, 3].map((k) => [...polar([45 + 90 * k, 16]), 2.2]), [55, 0, 9.6], [mx0, my0, 1.7], [mx0 + 7.5, my0, 2.2], [sx0, sy0, 6.1]];
  const slot = [];
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 12; slot.push([45 + 3 * Math.cos(a), 11.5 + 3 * Math.sin(a)]); }
  for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + (Math.PI * i) / 12; slot.push([29 + 3 * Math.cos(a), 11.5 + 3 * Math.sin(a)]); }
  const plate = S(extrude(ringPts, PZ, H.plate, P, { convex: false, bevel: 0.6 }), {
    tone: "hi", crease: "lo",
    inner: L(holes.map(([x, y, r]) => ring(x, y, r, PT, P, r > 5 ? 40 : 16)).join("") + pathOf(slot.map(([x, y]) => iso([x, y, PT], P)), true), { tone: "lo" }),
  });

  // ---- orden de pintura: bajo la placa por profundidad, luego la placa; sobre la placa se reparte antes/después de J3
  const lowItems = [
    { d: dep([mx, my]), svg: mag[0] + wires },
    { d: dep([0, 0]), svg: boltSvg },
    { d: dep([sx, sy]), svg: sen[0] },
    { d: dep([px, py]), svg: penBelow },
  ].sort((a, b) => a.d - b.d);
  below.push(...lowItems.map((i) => i.svg), plate);
  const upItems = [
    { d: dep([mx, my]), svg: mag[1] },
    { d: dep([sx, sy]), svg: sen[1] },
    { d: dep([px, py]), svg: pillars[0] + servoSvg + pillars[1] + hornSvg + penAbove + post },
  ].sort((a, b) => a.d - b.d);
  for (const it of upItems) (it.d < 0 ? below : above).push(it.svg);
  return { below: below.join(""), above: above.join("") };
}
