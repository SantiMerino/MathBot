// Fig 3 · La columna Z de MathBot: la plataforma corre sobre cuatro LM10UU en varillas de Ø10 y la sube un husillo Tr8×8.
// node anatomia/lm10uu/build.mjs [--light]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { kitScript } from "../kit/inline-kit.mjs";
import { tools, benchPlate, nemaBody } from "../comun.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 460;

// Modelo: Tr8×8 (8 mm por vuelta), 800 micropasos por vuelta → 100 pasos/mm; VMAX y ACEL del eje Z en mathbot_mega.ino.
const MODEL = { perMm: 100, lead: 8, vStart: 100, vMax: 3500, accel: 3000, travel: 120 };
const ROD_R = 5, ROD_TOP = 240;
const LM = { r: 9.5, len: 29, below: 8.5 }; // LM10UU: Ø19 × 29 mm
const PLAT = { x: -42, y: -36, w: 84, d: 72, r: 6 };
const PLAT_H = 12;
const Z0 = 82; // altura del fondo de la plataforma en Z = 0
const RODS = [[-30, -24], [30, -24], [-30, 24], [30, 24]];
const COUPLER = { r: 9.5, z0: 43, z1: 68 };
const SCREW_R = 4;
const NUT = { flange: 11, flangeH: 3.5, body: 5.1, bodyH: 11.5 };
const RULER = { x: 47, y: 14, w: 4, d: 4.5, top: Z0 + 6 + MODEL.travel + 8 };
const PLATE = { x: -62, y: -50, w: 124, d: 100, r: 6 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -12, 0), ...k.boxCorners(PLAT, ROD_TOP, ROD_TOP + 10)],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 58 },
);
const { at, S, L, D } = tools(P);
const depth = ([x, y]) => k.depthOf([x, y, 0], P);

// Abrazaderas de varilla (impresas) abajo y arriba.
function clamp([x, y], z) {
  const plan = { x: x - 8, y: y - 8, w: 16, d: 16, r: 2 };
  return S(k.slabOf(plan, z, 10, P, 3, 0.5), { tone: "mid" }) + D([at([x - 5, y + 5, z + 10]), at([x + 5, y - 5, z + 10])], { size: 0.45 });
}

function base() {
  const out = [benchPlate(P, PLATE)];
  for (const rod of [...RODS].sort((a, b) => depth(a) - depth(b))) out.push(clamp(rod, 0));
  return out.join("");
}

function motorAndCoupler() {
  const body = nemaBody(P, 0, 0, 0, 40, { connector: "y" });
  return (
    body.svg +
    S(k.cylinder(0, 0, 2.5, body.boss, COUPLER.z0 - body.boss, P, 20), { tone: "mid", crease: "none" }) +
    S(k.cylinder(0, 0, COUPLER.r, COUPLER.z0, COUPLER.z1 - COUPLER.z0, P, 48, 0.5), { tone: "mid" }) +
    L([COUPLER.z0 + 7, COUPLER.z0 + 9.5, COUPLER.z0 + 12, COUPLER.z0 + 14.5, COUPLER.z0 + 17].map((z) => k.sideArc(0, 0, COUPLER.r, z, P, 40)).join(""), { tone: "faint" }) +
    `<path data-part="coupler-mark" class="iso-line" data-tone="hi" d=""/>`
  );
}

// Un LM10UU partido en mitad inferior y superior alrededor de la plataforma; ranuras de los anillos de retención.
function bearingLow([x, y]) {
  const z = -LM.below;
  return S(k.cylinder(x, y, LM.r, Z0 + z, LM.below, P, 48), { tone: "hi", crease: "lo", lit: true, inner: L(k.sideArc(x, y, LM.r, Z0 + z + 3.4, P, 40), { tone: "lo" }) });
}
function bearingHigh([x, y]) {
  const z0 = Z0 + PLAT_H, h = LM.len - LM.below - PLAT_H, top = z0 + h;
  return (
    S(k.cylinder(x, y, LM.r, z0, h, P, 48, 0.4), { tone: "hi", crease: "lo", lit: true, inner: L(k.sideArc(x, y, LM.r, top - 3.4, P, 40), { tone: "lo" }) }) +
    L(k.ring(x, y, 7.6, top, P, 40), { tone: "lo" }) +
    L(k.ring(x, y, 6.2, top, P, 36), { tone: "faint" })
  );
}
function platform() {
  const out = [];
  out.push(S(k.slabOf(PLAT, Z0, PLAT_H, P, 8, 1.2), { tone: "mid", inner: L(k.sideSeam(PLAT, Z0 + PLAT_H / 2, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLAT, 4), Z0 + PLAT_H, P, 8), { tone: "faint" }));
  const screws = RODS.flatMap(([x, y]) => [[x + (x > 0 ? -1 : 1) * 13, y], [x, y + (y > 0 ? -1 : 1) * 13]]);
  out.push(D(screws.map(([x, y]) => at([x, y, Z0 + PLAT_H])), { size: 0.45, tone: "mid" }));
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.6, Z0 + PLAT_H, P, 14)).join(""), { tone: "lo" }));
  return out.join("");
}
function nut() {
  const z = Z0 + PLAT_H;
  const holes = [0, 1, 2, 3].map((i) => [Math.cos((i * Math.PI) / 2 + Math.PI / 4) * 8, Math.sin((i * Math.PI) / 2 + Math.PI / 4) * 8]);
  return (
    S(k.cylinder(0, 0, NUT.flange, z, NUT.flangeH, P, 48, 0.5), { tone: "mid" }) +
    L(holes.map(([x, y]) => k.ring(x, y, 1.5, z + NUT.flangeH, P, 12)).join(""), { tone: "lo" }) +
    D(holes.map(([x, y]) => at([x, y, z + NUT.flangeH])), { size: 0.45 }) +
    S(k.cylinder(0, 0, NUT.body, z + NUT.flangeH, NUT.bodyH, P, 32, 0.4), { tone: "mid" }) +
    L(k.sideArc(0, 0, NUT.body, z + NUT.flangeH + 2, P, 24), { tone: "faint" })
  );
}
const NUT_TOP = PLAT_H + NUT.flangeH + NUT.bodyH;
function pointer() {
  const z = Z0 + 3;
  const arm = { x: PLAT.x + PLAT.w - 1, y: RULER.y + RULER.d + 0.4, w: RULER.x + RULER.w + 2.6 - (PLAT.x + PLAT.w - 1), d: 3, r: 0.6 };
  return (
    S(k.slabOf(arm, z, 6, P, 2, 0.4), { tone: "mid" }) +
    D([at([arm.x + 3, arm.y + 1.5, z + 6])], { size: 0.45 }) +
    L(k.segment([arm.x + arm.w, arm.y, z + 6], [arm.x + arm.w, arm.y + arm.d, z + 6], P), { tone: "hi" })
  );
}
function ruler() {
  const out = [];
  const plan = { x: RULER.x, y: RULER.y, w: RULER.w, d: RULER.d, r: 0.4 };
  out.push(S(k.slabOf({ x: plan.x - 2, y: plan.y - 2, w: plan.w + 4, d: plan.d + 4, r: 1 }, 0, 6, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf(plan, 6, RULER.top - 6, P, 2, 0.3), { tone: "mid" }));
  const face = RULER.x + RULER.w, minor = [], major = [];
  for (let mm = 0; mm <= MODEL.travel; mm += 2) {
    const z = Z0 + 9 + mm, big = mm % 10 === 0;
    (big ? major : minor).push(k.segment([face, RULER.y, z], [face, RULER.y + (big ? 2.8 : 1.4), z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  return out.join("");
}
function topPlate() {
  const out = [];
  for (const rod of [...RODS].sort((a, b) => depth(a) - depth(b))) out.push(clamp(rod, ROD_TOP - 10));
  out.push(S(k.slabOf(PLAT, ROD_TOP, 10, P, 8, 1.2), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLAT, 4), ROD_TOP + 10, P, 8), { tone: "faint" }));
  out.push(L(RODS.map(([x, y]) => k.ring(x, y, ROD_R, ROD_TOP + 10, P, 24)).join(""), { tone: "lo" }));
  out.push(L(k.ring(0, 0, 11, ROD_TOP + 10, P, 40) + k.ring(0, 0, 6, ROD_TOP + 10, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(0, 0, SCREW_R, ROD_TOP + 10, 1.5, P, 20), { tone: "mid" }));
  const screws = k.corners(PLAT, 6);
  out.push(D(screws.map(([x, y]) => at([x, y, ROD_TOP + 10])), { size: 0.5 }));
  return out.join("");
}

// Orden de pintura: grupos por profundidad, cada uno de abajo hacia arriba.
const back = (p) => depth(p) < 0;
const live = (name) => `<g data-part="${name}"></g>`;
const moving = (svg) => `<g data-move>${svg}</g>`;
const order = RODS.map((p, i) => ({ p, i })).sort((a, b) => depth(a.p) - depth(b.p));
const lower = [];
for (const { p, i } of order.filter(({ p }) => back(p))) lower.push(live(`rod-low-${i}`), moving(bearingLow(p)));
lower.push(motorAndCoupler(), live("screw-low"));
for (const { p, i } of order.filter(({ p }) => !back(p))) lower.push(live(`rod-low-${i}`), moving(bearingLow(p)));
const upper = [];
for (const { p, i } of order.filter(({ p }) => back(p))) upper.push(moving(bearingHigh(p)), live(`rod-high-${i}`));
upper.push(moving(nut()), live("screw-high"));
for (const { p, i } of order.filter(({ p }) => !back(p))) upper.push(moving(bearingHigh(p)), live(`rod-high-${i}`));

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "La columna Z de MathBot: un NEMA 17 de 40 mm abajo, un acople flexible de 5 a 8 mm y un husillo Tr8×8 que sube una plataforma. La plataforma corre sobre cuatro rodamientos lineales LM10UU de 19 × 29 mm en cuatro varillas lisas de 10 mm, y un índice en su costado marca la altura en una regla.",
  body: [base(), ...lower, moving(platform()), ...upper, ruler(), moving(pointer()), topPlate()],
});

const liveCode = `
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(MODEL)};
const RODS = ${JSON.stringify(RODS)};
const ROD_R = ${ROD_R}, ROD_TOP = ${ROD_TOP} - 10, CLAMP = 10, SCREW_R = ${SCREW_R}, Z0 = ${Z0};
const LOW = -${LM.below}, HIGH = ${LM.len - LM.below}, NUT_TOP = ${NUT_TOP}, COUPLER_TOP = ${COUPLER.z1}, COUPLER_R = ${COUPLER.r}, COUPLER_Z = ${COUPLER.z0};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const movers = [...svg.querySelectorAll("[data-move]")];
const slot = (name) => svg.querySelector('[data-part="' + name + '"]');
const rodsLow = RODS.map((_, i) => slot("rod-low-" + i)), rodsHigh = RODS.map((_, i) => slot("rod-high-" + i));
const screwLow = slot("screw-low"), screwHigh = slot("screw-high"), mark = slot("coupler-mark");
const view = towardViewer(P);
const rod = (x, y, r, z0, z1, tone) => solidSvg(cylinder(x, y, r, z0, Math.max(0.01, z1 - z0), P, 28), { tone, crease: "none" });
// Rosca: una hélice de 2 mm de paso que gira con el husillo; solo el tramo que mira al observador.
function thread(z0, z1, turn) {
  let d = "", run = [];
  const flush = () => { if (run.length > 1) d += pathOf(run.map((p) => iso(p, P))); run = []; };
  for (let z = z0 + 0.6; z <= z1 - 0.6; z += 0.12) {
    const a = turn + (z / 2) * Math.PI * 2;
    const nx = Math.sin(a), ny = -Math.cos(a);
    if (nx * view[0] + ny * view[1] > 0.2) run.push([nx * SCREW_R, ny * SCREW_R, z]); else flush();
  }
  flush();
  return d;
}
const screw = (z0, z1, turn) => rod(0, 0, SCREW_R, z0, z1, "mid") + '<path class="iso-line" data-tone="lo" d="' + thread(z0, z1, turn) + '"/>';
let pos = 0, vel = 0, target = 0, frame = 0, last = 0, visible = false, touring = !still.matches, clock = 0, idle = 0;
const tourAt = (t) => { const c = t % 12; return c < 6 ? 100 * M.perMm : 20 * M.perMm; };
function draw() {
  const steps = Math.round(pos), mm = steps / M.perMm, zp = Z0 + mm;
  const turn = (mm / M.lead) * Math.PI * 2;
  const shift = translateAlong(P, [0, 0, mm]);
  for (const g of movers) g.setAttribute("transform", shift);
  RODS.forEach(([x, y], i) => {
    rodsLow[i].innerHTML = rod(x, y, ROD_R, CLAMP, zp + LOW, "mid");
    rodsHigh[i].innerHTML = rod(x, y, ROD_R, zp + HIGH, ROD_TOP, "mid");
  });
  screwLow.innerHTML = screw(COUPLER_TOP, zp + 12, turn);
  screwHigh.innerHTML = screw(zp + NUT_TOP, ROD_TOP + 10, turn);
  mark.setAttribute("d", (() => { const nx = Math.sin(turn), ny = -Math.cos(turn); return nx * view[0] + ny * view[1] > 0.15 ? segment([nx * COUPLER_R, ny * COUPLER_R, COUPLER_Z], [nx * COUPLER_R, ny * COUPLER_R, COUPLER_TOP], P) : ""; })());
  const text = "Z " + mm.toFixed(1) + " mm · " + steps + " pasos · " + (Math.abs(vel) / M.perMm).toFixed(0) + " mm/s";
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() {
  stage.setAttribute("aria-valuenow", String(Math.round(target / M.perMm)));
  stage.setAttribute("aria-valuetext", "Plataforma a " + (target / M.perMm).toFixed(0) + " milímetros");
}
// Rampa: v = √(vStart² + 2·accel·d) con tope en vMax, como AccelStepper en el eje Z.
function move(dt) {
  const left = target - pos;
  if (Math.abs(left) < 0.5 && Math.abs(vel) <= M.vStart) { pos = target; vel = 0; return; }
  const dir = Math.sign(left);
  if (vel && Math.sign(vel) !== dir) {
    const speed = Math.abs(vel) - M.accel * dt;
    vel = speed > M.vStart ? Math.sign(vel) * speed : 0;
    pos += vel * dt;
    return;
  }
  const cap = Math.sqrt(M.vStart * M.vStart + 2 * M.accel * Math.abs(left));
  const speed = Math.min(M.vMax, cap, Math.max(M.vStart, Math.abs(vel) + M.accel * dt));
  vel = dir * speed;
  const next = pos + vel * dt;
  if (Math.sign(target - next) !== dir) { pos = target; vel = 0; } else pos = next;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; const next = tourAt(clock); if (next !== target) { target = next; describe(); } }
  if (still.matches) { pos = target; vel = 0; } else move(dt);
  draw();
  const settled = !touring && pos === target && vel === 0;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (mm) => {
  touring = false;
  target = Math.round(Math.max(0, Math.min(M.travel, mm)) * M.perMm);
  describe();
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.min(1, Math.max(0, ((event.clientY - box.top) / box.height - 0.15) / 0.6));
  steer((1 - share) * M.travel);
});
stage.addEventListener("keydown", (event) => {
  const big = event.shiftKey ? 10 : 1, now = target / M.perMm;
  let to = null;
  if (event.key === "ArrowUp" || event.key === "ArrowRight") to = now + big;
  if (event.key === "ArrowDown" || event.key === "ArrowLeft") to = now - big;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = M.travel;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
describe();
draw();
`;

const body = k.plateHtml({
  fig: "Fig 3",
  title: "LM10UU · columna Z",
  hint: "Puntero arriba y abajo · ↑ ↓",
  readout: "Z 0.0 mm · 0 pasos · 0 mm/s",
  keys: [
    { mark: "lit", label: "4 × LM10UU · Ø10 × Ø19 × 29 mm · bolas recirculantes sobre la varilla" },
    { mark: "raised", label: "Varillas lisas Ø10 · husillo Tr8×8 con tuerca de latón" },
  ],
  caption:
    "El husillo solo empuja; los cuatro LM10UU guían. Corren sobre las varillas con bolas que recirculan, así que la plataforma no gira ni cabecea aunque la tuerca esté al centro. Una vuelta del motor (800 micropasos) sube 8 mm: 100 pasos por milímetro, a 3500 pasos/s como máximo, que es lo que usa mathbot_mega.ino para Z. La carrera de 120 mm sale de esta geometría con varillas de 240 mm.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Columna Z: las flechas suben y bajan la plataforma, Mayús 10 milímetros" aria-valuemin="0" aria-valuemax="${MODEL.travel}" aria-valuenow="0">${svg}</div>`,
});

const file = theme === "light" ? "lm10uu-light.html" : "lm10uu.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "LM10UU · MathBot", theme, body, script: kitScript() + liveCode }));
console.log("wrote", file);
