// Fig 4 · Cabezal A v2 de MathBot: placa trébol con plumón, electroimán y sensor; despiece y levante del plumón.
// node anatomia/cabezal/build.mjs [--light]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { kitScript } from "../kit/inline-kit.mjs";
import { tools } from "../comun.mjs";
import { HEAD, headSvg } from "./geo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 480;
const AZ = 45;                                      // desde +x+y: el brazo del servo queda entre el servo y el plumón

// Modelo (plantilla.html y XSPEC del simulador): 14 piezas, 123 g sin cables; SG90 ≈ 0.1 s / 60°.
const MODEL = { grams: 123, parts: 14, lift: HEAD.lift, servoSec60: 0.1 };
const Zp = HEAD.Zp, ZH = Zp + HEAD.plate;
const J3 = { brida: ZH + 4.5, coupler: ZH + 4.5 + 22, arm: ZH + 4.5 + 22 + 24 };
const POST = [-118, 0];
const PLATE = { x: -140, y: -84, w: 238, d: 168, r: 8 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -14, 0), ...k.boxCorners({ x: -80, y: -78, w: 195, d: 156 }, 0, 196)],
  WIDTH, HEIGHT, { pad: 20, azimuth: AZ },
);
const { at, S, L, D } = tools(P);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function bench() {
  const h = 8, foot = 4, out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -h - foot, h, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 16))) {
    out.push(S(k.cylinder(x, y, 6, -h - foot, 1.4, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.6, -h - foot + 1.4, foot - 1.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -h, h, P, 8, 1.2), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 7);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 16)).join(""), { tone: "lo" }), D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // regla en el borde −y (frente) y placa de identificación en el borde +x
  const strip = { x: PLATE.x + 20, y: PLATE.y + 6, w: PLATE.w - 40, d: 5, r: 0.8 };
  out.push(S(k.slabOf(strip, 0, 0.5, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 2, 5, strip.y + 0.2, 0.5, [1.4, 2.8], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  const label = { x: PLATE.x + PLATE.w - 30, y: 40, w: 20, d: 44, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }), L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([[6, 34], [10, 30], [14, 24]].map(([dx, len]) => k.lineOnTop([label.x + dx, label.y + 6], [label.x + dx, label.y + 6 + len], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 10, label.y + 2.5, 0.8]), at([label.x + 10, label.y + label.d - 2.5, 0.8])], { size: 0.4 }));
  return out.join("");
}

// Soporte de banco: poste con collar y abrazadera, y un tramo del brazo 2 con su J3 de referencia.
function stand() {
  const [x, y] = POST, out = [];
  out.push(S(k.cylinder(x, y, 12, 0, 4, P, 40, 0.5), { tone: "mid" }));
  out.push(L(k.ring(x, y, 9, 4, P, 32), { tone: "faint" }), D([0, 1, 2].map((i) => at([x + 9 * Math.cos(i * 2.1 + 0.4), y + 9 * Math.sin(i * 2.1 + 0.4), 4])), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, 6, 4, J3.coupler - 18 - 4, P, 32), { tone: "mid", crease: "none", inner: L([30, 60, 90].map((z) => k.sideArc(x, y, 6, z, P, 20)).join(""), { tone: "faint" }) }));
  const clamp = { x: x - 10, y: y - 10, w: 20, d: 20, r: 3 };
  out.push(S(k.slabOf(clamp, J3.coupler - 18, 18, P, 4, 0.6), { tone: "mid" }));
  // tornillo de apriete con perilla moleteada hacia −y
  out.push(S(k.slabOf({ x: x - 1.5, y: y - 15, w: 3, d: 5, r: 0.5 }, J3.coupler - 11, 3, P, 2), { tone: "mid" }));
  out.push(S(k.cylinder(x, y - 18, 4, J3.coupler - 12.5, 6, P, 28), { tone: "mid" }), L(k.knurl(x, y - 18, 4, J3.coupler - 12.5, J3.coupler - 6.5, 22, P), { tone: "lo" }));
  return out.join("");
}

function j3() {
  const out = [];
  const ref = { tone: "lo" };
  const brida = { x: -19.5, y: -39, w: 39, d: 78, r: 8 };
  out.push(S(k.slabOf(brida, ZH, 4.5, P, 6, 0.4), ref));
  out.push(S(k.cylinder(0, 0, 39, J3.brida, 22, P, 64, 0.6), { ...ref, inner: L(k.sideArc(0, 0, 39, J3.brida + 11, P, 48), { tone: "faint" }) }));
  // brazo 2 recortado: extremo redondo sobre J3 y el tramo recto hasta la abrazadera del poste
  const arm = { x: POST[0] - 10, y: -16, w: -POST[0] + 10, d: 32, r: 4 };
  out.push(S(k.slabOf(arm, J3.coupler, 24, P, 4, 0.6), { ...ref, inner: L(k.sideSeam(arm, J3.coupler + 12, P, 4), { tone: "faint" }) }));
  out.push(S(k.cylinder(0, 0, 39, J3.coupler, 24, P, 64, 0.6), { ...ref, inner: L(k.sideArc(0, 0, 39, J3.coupler + 12, P, 48), { tone: "faint" }) }));
  out.push(L(k.ring(0, 0, 30, J3.arm, P, 48) + k.ring(0, 0, 21, J3.arm, P, 40), { tone: "lo" }));
  const bolts = [0, 1, 2, 3, 4, 5].map((i) => [25.5 * Math.cos((i * Math.PI) / 3), 25.5 * Math.sin((i * Math.PI) / 3)]);
  out.push(D(bolts.map(([x, y]) => at([x, y, J3.arm])), { size: 0.5 }));
  out.push(D([at([POST[0] + 4, -6, J3.arm]), at([POST[0] + 4, 6, J3.arm])], { size: 0.5 }));
  return out.join("");
}

const first = headSvg(P, 0, 0);
const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "Cabezal A v2 de MathBot colgado de un tramo del brazo 2 sobre un soporte de banco. Una placa trébol de 6 mm lleva tres herramientas a 55 mm del eje J3: el plumón en una guía con collar, resorte y un micro-servo que lo levanta 18 mm; el electroimán sobre un separador hexagonal; el sensor inductivo M12 entre dos tuercas.",
  body: [bench(), stand(), `<g data-part="below">${first.below}</g>`, j3(), `<g data-part="above">${first.above}</g>`],
});

const geo = readFileSync(join(HERE, "geo.mjs"), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const liveCode = `${geo}
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(MODEL)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const below = svg.querySelector('[data-part="below"]'), above = svg.querySelector('[data-part="above"]');
let e = 0, eT = 0, lift = 0, up = false, frame = 0, last = 0, visible = false, touring = !still.matches, clock = 0, idle = 0, drawn = "";
// Recorrido: plumón abajo → arriba → abajo → despiece → armado.
const TOUR = [[0, 0, false], [2.2, 0, true], [4.4, 0, false], [6.4, 1, false], [11.4, 0, false]];
const tourAt = (t) => { const c = t % 14; let s = TOUR[0]; for (const x of TOUR) if (c >= x[0]) s = x; return s; };
function draw() {
  const key = e.toFixed(3) + "|" + lift.toFixed(2);
  if (key !== drawn) { drawn = key; const h = headSvg(P, e, lift); below.innerHTML = h.below; above.innerHTML = h.above; }
  const horn = Math.asin(Math.max(-1, Math.min(1, (lift * 20 / 18 - 11) / 12))) * 180 / Math.PI;
  const text = "Separación " + Math.round(e * 100) + " % · plumón " + (lift < 0.5 ? "abajo" : "+" + lift.toFixed(0) + " mm") + " · brazo " + horn.toFixed(0).replace("-", "−") + "°";
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() {
  stage.setAttribute("aria-valuenow", String(Math.round(eT * 100)));
  stage.setAttribute("aria-valuetext", "Separación " + Math.round(eT * 100) + " %, plumón " + (up ? "arriba" : "abajo"));
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; const [, te, tu] = tourAt(clock); if (te !== eT || tu !== up) { eT = te; up = tu; describe(); } }
  const lT = up && eT < 0.05 ? M.lift : 0;
  if (still.matches) { e = eT; lift = lT; }
  else {
    e += (eT - e) * (1 - Math.exp(-dt / 0.35)); if (Math.abs(eT - e) < 0.002) e = eT;
    // el SG90 gira ≈115° del brazo en ≈0.2 s: el collar sube 18 mm en ese tiempo
    const v = M.lift / (115 / 60 * M.servoSec60), d = lT - lift;
    lift = Math.abs(d) <= v * dt ? lT : lift + Math.sign(d) * v * dt;
  }
  draw();
  const settled = !touring && e === eT && lift === lT;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const hold = () => { touring = false; clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4000); describe(); run(); };
new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (ev) => {
  const box = svg.getBoundingClientRect();
  eT = Math.round(Math.min(1, Math.max(0, ((ev.clientX - box.left) / box.width - 0.2) / 0.6)) * 20) / 20;
  if (eT > 0) up = false;
  hold();
});
stage.addEventListener("click", () => { up = !up; if (up) eT = 0; hold(); });
stage.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowRight" || ev.key === "ArrowUp") eT = Math.min(1, Math.round(eT * 10 + 1) / 10);
  else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") eT = Math.max(0, Math.round(eT * 10 - 1) / 10);
  else if (ev.key === " " || ev.key === "Enter") { up = !up; if (up) eT = 0; }
  else if (ev.key === "Home") eT = 0;
  else if (ev.key === "End") eT = 1;
  else return;
  ev.preventDefault();
  if (eT > 0) up = false;
  hold();
});
// gancho para capturas: fija una pose sin animar
window.fig4 = { pose(ev, lv) { touring = false; clearTimeout(idle); eT = e = ev; lift = lv; up = lv > 0; draw(); } };
describe();
draw();
`;

const body = k.plateHtml({
  fig: "Fig 4",
  title: "Cabezal A v2 · despiece",
  hint: "Puntero ↔ separa · clic levanta",
  readout: "Separación 0 % · plumón abajo · brazo −66°",
  keys: [
    { mark: "lit", label: "Plumón: guía, collar, resorte Ø16 y SG90 con brazo de 12 mm (+18 mm)" },
    { mark: "raised", label: "Placa trébol PETG 6 mm · electroimán KK-P20/15 · sensor LJ12A3 M12" },
  ],
  caption:
    "Las tres herramientas quedan a 55 mm del eje J3, a 0°, 120° y 240°: J3 gira para elegir una. El J3 coupler y la brida ocupan hasta 39 mm del eje sobre la placa, así que todo lo que sube de la placa queda más afuera. Con el plumón abajo, el brazo del servo queda 2 mm bajo el collar y el resorte da la fuerza de trazo; al subir, el brazo levanta el collar 18 mm. Al separar, cada pieza sale por su eje de montaje: el plumón hacia abajo, el puente y el resorte hacia arriba y el servo hacia atrás. 14 piezas, 123 g sin cables.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Cabezal A: flechas para separar las piezas, espacio para subir o bajar el plumón" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${svg}</div>`,
});

const file = theme === "light" ? "cabezal-light.html" : "cabezal.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Cabezal A v2 · MathBot", theme, body, script: kitScript() + liveCode }));
console.log("wrote", file);
