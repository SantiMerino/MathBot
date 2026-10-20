// Geometría de la Fig 5: final de carrera de palanca con rodillo (tipo KW11-3Z) sin tapa, junto a la polea de J3
// con una leva impresa. Se usa en Node (cuadro inicial) y en el navegador (se inyecta sin import/export).
import { iso, depthOf, pathOf, extrude, cylinder, circleRing, solidSvg, lineSvg, dotsSvg, ring, sideArc, radialTicks, wireSvg } from "../kit/iso-kit.mjs";

// Interruptor (mm, valores típicos de un KW11-3Z de palanca con rodillo; mida el suyo):
// cuerpo 20 × 10.2 × 6.4, botón a 7.3 mm del eje de la palanca, palanca de 22 mm → relación ≈ 3:1.
// Recorrido previo (PT) 0.5 mm en el botón, diferencial (MD) 0.1 mm, sobrerrecorrido hasta 1.2 mm.
export const SW = {
  body: [20, 10.2, 6.4], pivot: [8.5, 10.8], plungerX: 1.2, lever: 22, roll: 2.4,
  plungerFree: 1.4, pt: 0.5, md: 0.1, plungerMax: 1.2, z0: 20,
};
SW.ratio = SW.lever / (SW.pivot[0] - SW.plungerX);
SW.sin0 = (SW.body[1] + SW.plungerFree + 0.25 - SW.pivot[1]) / (SW.pivot[0] - SW.plungerX);
SW.tipFree = SW.pivot[1] + SW.lever * SW.sin0;                         // línea media de la palanca en la punta
// Disco de home Ø32 en el eje de J3 con un lóbulo impreso (la polea de 90 dientes queda fuera del dibujo).
export const CAM = { R0: 16, H: 4.6, gap: 1.0, flat: 9, ramp: 22, home: -166.2, gamma: 75 };

const rad = (d) => (d * Math.PI) / 180;
const smooth = (u) => u * u * (3 - 2 * u);
export function camRadius(delta) {                                      // delta: grados entre el centro de la leva y el rodillo
  const a = Math.abs(delta);
  const s = a <= CAM.flat ? 1 : a >= CAM.flat + CAM.ramp ? 0 : smooth(1 - (a - CAM.flat) / CAM.ramp);
  return CAM.R0 + CAM.H * s;
}
// Ángulo (desde el rodillo) en el que la punta ya bajó lo justo para disparar: δ = PT · relación
const TIP_PT = SW.pt * SW.ratio;
let lo = 0, hi = CAM.flat + CAM.ramp;
for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; (camRadius(m) - CAM.R0 - CAM.gap >= TIP_PT ? (lo = m) : (hi = m)); }
CAM.tripDelta = lo;
CAM.beta = CAM.gamma + CAM.tripDelta - CAM.home;                        // la leva dispara justo en φ = −166.2°

// Marco del interruptor: +y local apunta al centro de la polea; el rodillo libre queda a R0 + roll + gap del centro.
const EY = [-Math.cos(rad(CAM.gamma)), -Math.sin(rad(CAM.gamma))], EX = [EY[1], -EY[0]];
const ROLL_LOCAL = [SW.pivot[0] - SW.lever * Math.sqrt(1 - SW.sin0 * SW.sin0), SW.tipFree + 0.25 + SW.roll];
const D0 = CAM.R0 + SW.roll + CAM.gap;
const ROLL_WORLD = [D0 * Math.cos(rad(CAM.gamma)), D0 * Math.sin(rad(CAM.gamma))];
const O = [ROLL_WORLD[0] - ROLL_LOCAL[0] * EX[0] - ROLL_LOCAL[1] * EY[0], ROLL_WORLD[1] - ROLL_LOCAL[0] * EX[1] - ROLL_LOCAL[1] * EY[1]];
export const W = (x, y) => [O[0] + x * EX[0] + y * EY[0], O[1] + x * EX[1] + y * EY[1]];

// Estado de la palanca para un ángulo de J3: desplazamiento de la punta (mm), del botón y si los contactos conmutaron.
export function leverState(phi, wasOn) {
  const delta = ((CAM.beta + phi - CAM.gamma + 540) % 360) - 180;
  const tip = Math.max(0, camRadius(delta) - CAM.R0 - CAM.gap);
  const plunger = Math.min(SW.plungerMax, tip / SW.ratio);
  const on = wasOn ? plunger > SW.pt - SW.md : plunger >= SW.pt;
  return { tip: Math.min(tip, SW.plungerMax * SW.ratio), plunger, on };
}

export function sceneSvg(P, phi, st) {
  const S = (paths, style) => solidSvg(paths, style);
  const L = (d, style) => lineSvg(d, style);
  const D = (pts, style) => dotsSvg(pts.map((p) => iso(p, P)), style);
  const box = (x0, y0, x1, y1, z, h, style, bevel = 0.2) => S(extrude([W(x0, y0), W(x1, y0), W(x1, y1), W(x0, y1)], z, h, P, { bevel }), style);
  const poly = (pts, z, h, style) => S(extrude(pts.map(([x, y]) => W(x, y)), z, h, P, { convex: false }), style);
  const Z = SW.z0, [BL, BW, BH] = SW.body, half = BH / 2;
  const out = [];

  // ---- disco de home y lóbulo (giran con φ)
  const cz0 = 14, cz1 = 19;
  const turn = (r, d) => { const a = rad(phi + d); return [r * Math.cos(a), r * Math.sin(a)]; };
  out.push(S(cylinder(0, 0, CAM.R0, cz0, cz1 - cz0, P, 72, 0.5), { tone: "mid", inner: L(sideArc(0, 0, CAM.R0, cz0 + 2.5, P, 48), { tone: "faint" }) }));
  out.push(L(ring(0, 0, CAM.R0 - 2.5, cz1, P, 64), { tone: "faint" }));
  // índice: marca radial que lee φ sobre la escala fija de abajo
  out.push(L(pathOf([iso([...turn(CAM.R0 - 2.5, 0), cz1], P), iso([...turn(CAM.R0, 0), cz1], P)]), { tone: "hi" }));
  out.push(L([90, 180, 270].map((d) => ring(...turn(10, d), 1.3, cz1, P, 12)).join(""), { tone: "lo" }), D([90, 180, 270].map((d) => [...turn(10, d), cz1]), { size: 0.45 }));
  // lóbulo: arco de 5 mm de alto sobre el borde, perfil camRadius, con dos tornillos
  const lobe = [], span = CAM.flat + CAM.ramp + 3;
  for (let d = -span; d <= span + 1e-6; d += 1) { const a = rad(CAM.beta + phi + d); lobe.push([camRadius(d) * Math.cos(a), camRadius(d) * Math.sin(a)]); }
  for (let d = span; d >= -span - 1e-6; d -= 2) { const a = rad(CAM.beta + phi + d); lobe.push([(CAM.R0 - 4.5) * Math.cos(a), (CAM.R0 - 4.5) * Math.sin(a)]); }
  const lobeSvg = S(extrude(lobe, cz1, 6, P, { convex: false, bevel: 0.3 }), { tone: "mid" }) +
    D([-1, 1].map((i) => [...turn(CAM.R0 - 2.3, CAM.beta + i * 18), cz1 + 6]), { size: 0.45 });
  const hub = S(cylinder(0, 0, 6, cz1, 4, P, 36, 0.4), { tone: "mid" }) + S(cylinder(0, 0, 2.5, cz1 + 4, 4, P, 20), { tone: "mid", crease: "none" }) +
    L(ring(0, 0, 2.5, cz1 + 8, P, 16), { tone: "lo" });
  const setScrew = D([[...turn(6, 200), cz1 + 2]], { size: 0.6, tone: "mid" });
  const lobeDepth = depthOf([CAM.R0 * Math.cos(rad(CAM.beta + phi)), CAM.R0 * Math.sin(rad(CAM.beta + phi)), 0], P), hubDepth = depthOf([6 * Math.cos(rad(CAM.gamma)), 6 * Math.sin(rad(CAM.gamma)), 0], P);
  out.push(...(lobeDepth < hubDepth ? [lobeSvg, hub, setScrew] : [hub, setScrew, lobeSvg]));
  const disc = out.splice(0).join("");

  // ---- palanca con rodillo (detrás de la pared superior del interruptor)
  const [pvx, pvy] = SW.pivot;
  const sinT = (SW.tipFree - st.tip - pvy) / SW.lever, cosT = Math.sqrt(1 - sinT * sinT);
  const tip = [pvx - SW.lever * cosT, pvy + SW.lever * sinT];
  const nx = -sinT, ny = cosT;                                            // normal hacia afuera (lado de la leva)
  const t = 0.25, lz = Z + 1.2, lh = 4;
  const strip = [[pvx + nx * t, pvy + ny * t], [tip[0] + nx * t, tip[1] + ny * t], [tip[0] - nx * t, tip[1] - ny * t], [pvx - nx * t, pvy - ny * t]];
  const rc = [tip[0] + nx * (t + SW.roll), tip[1] + ny * (t + SW.roll)];
  // horquilla del rodillo: dos orejas dobladas en la punta
  const fork = [[tip[0] - cosT * 1.2 + nx * t, tip[1] + sinT * 1.2 + ny * t], [rc[0] - cosT * 1.2, rc[1] + sinT * 1.2], [rc[0] + cosT * 3, rc[1] - sinT * 3], [tip[0] + cosT * 3 + nx * t, tip[1] - sinT * 3 + ny * t]];
  const [rx, ry] = W(...rc);
  out.push(poly(fork, lz - 0.6, 0.4, { tone: "mid" }));
  out.push(S(cylinder(rx, ry, SW.roll, lz - 0.2, 3.2, P, 32, 0.3), { tone: "hi", crease: "lo" }), L(ring(rx, ry, 0.7, lz + 3, P, 12), { tone: "lo" }));
  out.push(poly(fork, lz + 3.2, 0.4, { tone: "mid" }));
  out.push(poly(strip, lz, lh, { tone: "mid" }));
  // bisagra: lengüeta en la cara superior con el pasador
  out.push(box(pvx - 1.6, BW, pvx + 1.8, pvy + 1.2, Z + 0.6, half + 2.6, { tone: "mid" }));
  out.push(D([[...W(pvx + 0.1, pvy), Z + half + 3.2]], { size: 0.5 }));

  // ---- botón (lo que sobresale va antes de la pared superior)
  const pTop = BW + SW.plungerFree - st.plunger, pBot = 5.9 - st.plunger;
  out.push(box(SW.plungerX - 0.9, BW, SW.plungerX + 0.9, pTop, Z + 1.6, 2.4, { tone: "hi", crease: "lo", lit: true }));

  // ---- base del cuerpo (mitad inferior, sin tapa): piso y paredes; las del frente al final
  const wall = 0.9;
  out.push(box(-BL / 2, 0, BL / 2, BW, Z, 0.8, { tone: "lo" }, 0.3));
  out.push(box(-BL / 2, BW - wall, BL / 2, BW, Z + 0.8, half - 0.8, { tone: "lo" }));
  out.push(box(-BL / 2, wall, -BL / 2 + wall, BW - wall, Z + 0.8, half - 0.8, { tone: "lo" }));
  out.push(box(BL / 2 - wall, wall, BL / 2, BW - wall, Z + 0.8, half - 0.8, { tone: "lo" }));
  out.push(L(pathOf([iso([...W(SW.plungerX - 1.1, BW), Z + half], P), iso([...W(SW.plungerX + 1.1, BW), Z + half], P)]), { tone: "faint" }));

  // ---- interior: tetones de los tornillos, bornes de latón, lámina de contacto y botón
  for (const x of [-4.75, 4.75]) {
    const [cx, cy] = W(x, 2.9);
    out.push(S(cylinder(cx, cy, 2.1, Z + 0.8, half - 0.8, P, 24), { tone: "lo" }), S(cylinder(cx, cy, 1.9, Z + half, 1.1, P, 20, 0.3), { tone: "mid" }), L(pathOf([iso([...W(x - 1.2, 2.9), Z + half + 1.1], P), iso([...W(x + 1.2, 2.9), Z + half + 1.1], P)]), { tone: "lo" }));
  }
  const brass = { tone: "mid" }, cz = Z + 1.4, ch = 2.6;
  // COM: poste a la izquierda con el anclaje de la lámina
  out.push(box(-7.8, wall, -6.8, 5.6, cz, ch, brass));
  // NO: sale a la mitad y sube con un codo hasta su contacto fijo (abajo de la lámina)
  out.push(poly([[-0.2, wall], [0.8, wall], [0.8, 1.9], [6.6, 1.9], [6.6, 3.5], [5.6, 3.5], [5.6, 2.9], [-0.2, 2.9]], cz, ch, brass));
  // NC: sube junto a la pared derecha y vuelve en gancho sobre la lámina
  out.push(poly([[7.6, wall], [8.6, wall], [8.6, 8.1], [5.4, 8.1], [5.4, 7.1], [7.6, 7.1]], cz, ch, brass));
  const tipY = st.on ? 4.25 : 6.15, midY = Math.min(5.3, pBot);
  const leafPts = [[-6.8, 5.1], [SW.plungerX, midY], [6.4, tipY]];
  const leaf = [];
  for (const [x, y] of leafPts) leaf.push([x, y + 0.15]);
  for (const [x, y] of [...leafPts].reverse()) leaf.push([x, y - 0.15]);
  out.push(poly(leaf, cz + 0.6, 1.4, { tone: "hi", crease: "lo", lit: true }));
  // lengüeta de compresión: arco que empuja la punta hacia el contacto activo
  const tongue = [];
  for (let i = 0; i <= 12; i++) { const u = i / 12, x = -4.6 + u * 9.6, y = 5.1 + (tipY - 5.1) * u + Math.sin(u * Math.PI) * (st.on ? 0.9 : -0.9); tongue.push(iso([...W(x, y), cz + 2.0], P)); }
  out.push(L(pathOf(tongue), { tone: "mid" }));
  // contactos de plata: fijos en NO (abajo) y NC (arriba), móvil en la punta de la lámina
  out.push(S(cylinder(...W(6.1, 3.85), 0.8, cz + 0.4, 1.8, P, 14), { tone: "hi" }));
  out.push(S(cylinder(...W(6.1, 6.75), 0.8, cz + 0.4, 1.8, P, 14), { tone: "hi" }));
  out.push(S(cylinder(...W(6.1, tipY), 0.85, cz + 0.4, 1.8, P, 14), { tone: "hi", lit: true }));
  // parte del botón dentro del cuerpo
  out.push(box(SW.plungerX - 0.9, pBot, SW.plungerX + 0.9, BW, Z + 1.6, 2.4, { tone: "hi", crease: "lo", lit: true }));

  // ---- pared del frente y las tres paletas de soldar que salen por ella
  out.push(box(-BL / 2, 0, BL / 2, wall, Z + 0.8, half - 0.8, { tone: "lo" }));
  const blades = [[-7.3, "COM"], [0.3, "NO"], [8.1, "NC"]];
  for (const [x] of blades) out.push(box(x - 1.4, -4.2, x + 1.4, 0, Z + 1.6, 0.5, brass, 0.1), L(ring(...W(x, -2.6), 0.6, Z + 2.1, P, 10), { tone: "lo" }));
  return { disc, svg: out.join(""), blades };
}
