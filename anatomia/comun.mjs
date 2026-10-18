// Piezas compartidas por las figuras de MathBot (skill Anatomy). Unidades del mundo: 1 = 1 mm.
import * as k from "./kit/iso-kit.mjs";

export function tools(P) {
  const at = (point) => k.iso(point, P);
  return {
    at,
    S: (paths, style) => k.solidSvg(paths, style),
    L: (d, style) => k.lineSvg(d, style),
    D: (points, style) => k.dotsSvg(points, style),
    byDepth: (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P)),
  };
}

// Base de banco: placa sobre cuatro patas, ranura, tornillos de esquina y regla en el borde frontal.
export function benchPlate(P, PLATE, { h = 8, foot = 4, ruler = true } = {}) {
  const { at, S, L, D, byDepth } = tools(P);
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -h - foot, h, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 14))) {
    out.push(S(k.cylinder(x, y, 6, -h - foot, 1.4, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.6, -h - foot + 1.4, foot - 1.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -h, h, P, 8, 1.2), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 7);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  if (ruler) {
    const strip = { x: PLATE.x + 16, y: PLATE.y + PLATE.d - 11, w: PLATE.w - 32, d: 5, r: 0.8 };
    out.push(S(k.slabOf(strip, 0, 0.5, P, 3), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 2, 5, strip.y + 0.6, 0.5, [1.4, 2.8], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(D([at([strip.x + 1.5, strip.y + 2.5, 0.5]), at([strip.x + strip.w - 1.5, strip.y + 2.5, 0.5])], { size: 0.4 }));
  }
  return out.join("");
}

// Contorno de un NEMA 17: cuadrado de 42.3 mm con las esquinas achaflanadas.
export const NEMA_HALF = 21.15;
export function nemaRing(cx, cy, half = NEMA_HALF, chamfer = 4.6) {
  const a = half, c = half - chamfer;
  return [
    [cx + c, cy - a], [cx + a, cy - c], [cx + a, cy + c], [cx + c, cy + a],
    [cx - c, cy + a], [cx - a, cy + c], [cx - a, cy - c], [cx - c, cy - a],
  ];
}

// Cuerpo del motor parado con el eje hacia arriba: tapa trasera, paquete de láminas del estator,
// tapa delantera con los cuatro M3 a 31 mm, resalte de centrado Ø22 × 2 y conector JST en la tapa trasera.
// Devuelve el SVG del cuerpo y la cota de la cara delantera.
export function nemaBody(P, cx, cy, z0, length, { rear, front, connector = "y" } = {}) {
  const { at, S, L, D } = tools(P);
  rear ??= length > 30 ? 8 : 5.5;
  front ??= length > 30 ? 8 : 5.5;
  const out = [];
  const stack0 = z0 + rear, stack1 = z0 + length - front, top = z0 + length;
  const cap = nemaRing(cx, cy);
  const core = nemaRing(cx, cy, NEMA_HALF - 0.35, 4.5);
  out.push(S(k.extrude(cap, z0, rear, P, { bevel: 0.5 }), { tone: "mid" }));
  if (connector === "y") {
    const shell = { x: cx - 5, y: cy + NEMA_HALF, w: 10, d: 4.2, r: 0.6 };
    out.push(S(k.slabOf(shell, z0 + 0.8, rear - 1.6, P, 2, 0.3), { tone: "mid" }));
    const pins = [-3.5, -1.5, 0.5, 2.5].map((dx) => [cx + dx + 0.5, cy + NEMA_HALF + 4.2, z0 + rear / 2]);
    out.push(D(pins.map(at), { size: 0.45, tone: "lo" }));
  }
  const lamination = [];
  for (let z = stack0 + 1.6; z < stack1 - 0.8; z += 1.6) lamination.push(k.ringSeam(core, z, P));
  out.push(S(k.extrude(core, stack0, stack1 - stack0, P), { tone: "hi", crease: "lo", inner: L(lamination.join(""), { tone: "faint" }) }));
  out.push(S(k.extrude(cap, stack1, front, P, { bevel: 0.6 }), { tone: "mid" }));
  const holes = [[-15.5, -15.5], [15.5, -15.5], [15.5, 15.5], [-15.5, 15.5]].map(([dx, dy]) => [cx + dx, cy + dy]);
  out.push(L(holes.map(([x, y]) => k.ring(x, y, 1.7, top, P, 16)).join(""), { tone: "lo" }));
  out.push(D(holes.map(([x, y]) => at([x, y, top])), { size: 0.45 }));
  out.push(L(k.ring(cx, cy, 14.5, top, P, 48), { tone: "faint" }));
  out.push(S(k.cylinder(cx, cy, 11, top, 2, P, 48, 0.5), { tone: "mid" }));
  return { svg: out.join(""), top, boss: top + 2 };
}
