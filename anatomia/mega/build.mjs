// Fig 2 · Arduino MEGA 2560 con la CNC Shield V3: a qué pin va cada cosa de MathBot (firmware/README.md).
// node anatomia/mega/build.mjs [--light]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { kitScript } from "../kit/inline-kit.mjs";
import { tools, benchPlate } from "../comun.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 380;
// Placa del Mega: 101.6 × 53.3 mm. x desde el borde del USB; y = 0 en el borde de los pines digitales.
const MEGA = { x: 0, y: 0, w: 101.6, d: 53.3, r: 1.5 };
const SHIELD = { x: 0, y: 0, w: 68.6, d: 53.3, r: 1.5 };
const PLATE = { x: -16, y: -10, w: 128, d: 74, r: 6 };
const STAND = 6, PCB = 1.6, HEADER = 8.5;
const MZ = STAND + PCB; // cara superior del Mega
const HZ = MZ + HEADER; // tope de los conectores hembra
const SZ = 19.5; // fondo de la shield
const ST = SZ + PCB; // cara superior de la shield
const DZ = ST + HEADER; // fondo de los A4988
const DT = DZ + PCB;
const PITCH = 2.54;

// Doble fila del Mega: fila 0 = 5V, filas 1–16 = pines 22/23 … 52/53, fila 17 = GND.
const DBL = { even: 93.98, odd: 96.52, y0: 2.54 };
const rowOf = (pin) => (pin - 22 - (pin % 2)) / 2 + 1;
const megaPin = (pin) => [pin % 2 ? DBL.odd : DBL.even, DBL.y0 + rowOf(pin) * PITCH];
const A8 = [73.66, 50.8];
const DRIVERS = [
  { id: "x", cx: 10.5 },
  { id: "y", cx: 26.5 },
  { id: "z", cx: 42.5 },
  { id: "a", cx: 58.5 },
];
const DRV_Y = 16;
const ENDSTOP = { x0: 33, rows: [45.7, 48.24] };
const DUPONTS = [22, 24, 26, 28, 30, 32, 34, 36, 44].map((pin) => ({ id: "d" + pin, at: megaPin(pin) })).concat([{ id: "a8", at: A8 }]);

// Cada parada: qué se ilumina y qué dice la lectura. Todo sale de la tabla de firmware/README.md.
const STOPS = [
  { spots: ["x"], text: "J1 · eje X · STEP D2 · DIR D5" },
  { spots: ["y"], text: "J2 · eje Y · STEP D3 · DIR D6" },
  { spots: ["z"], text: "J3 · eje Z · STEP D4 · DIR D7" },
  { spots: ["a", "jumpers"], text: "Columna Z · eje A · D12 / D13 (jumpers)" },
  { spots: ["x", "y", "z", "a"], text: "Enable de los 4 drivers · D8 · LOW = energizados" },
  { spots: ["endstops"], text: "Finales SW1–SW4 · D11 · D10 · D9 · A3" },
  { spots: ["power"], text: "12 V por el borne · VMOT de los 4 drivers" },
  { spots: ["d22"], text: "Sensor inductivo · D22 · LOW = metal" },
  { spots: ["d24"], text: "Electroimán · D24 · MOSFET D4184" },
  { spots: ["d26", "d28"], text: "START · D26 · PARO · D28" },
  { spots: ["d30", "d32", "d34"], text: "LED verde D30 · amarillo D32 · rojo D34" },
  { spots: ["d36"], text: "Buzzer · D36" },
  { spots: ["d44"], text: "Servo SG90 del plumón · D44" },
  { spots: ["a8"], text: "Monitor de 12 V · A8 · divisor 10k / 3.3k" },
];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -12, 0), [DRIVERS[0].cx, DRV_Y, DT + 6], [96, 5, HZ + 22]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: 58, elevation: 34 },
);
const { at, S, L, D, byDepth } = tools(P);
const spot = (id, svg) => `<g data-spot="${id}">${svg}</g>`;
const lit0 = new Set(STOPS[0].spots);

function header(x0, y, count, { along = "x", rows = 1 } = {}) {
  const w = along === "x" ? count * PITCH : rows * PITCH, d = along === "x" ? rows * PITCH : count * PITCH;
  const plan = { x: x0 - PITCH / 2, y: y - PITCH / 2, w, d, r: 0.3 };
  const holes = [];
  for (let i = 0; i < count; i++)
    for (let j = 0; j < rows; j++) holes.push(at(along === "x" ? [x0 + i * PITCH, y + j * PITCH, HZ] : [x0 + j * PITCH, y + i * PITCH, HZ]));
  return S(k.slabOf(plan, MZ, HEADER, P, 2, 0.3), { tone: "lo" }) + D(holes, { size: 0.5, tone: "faint" });
}

function megaUnder() {
  const out = [`<path class="iso-halo" d="${k.haloOf(MEGA, 0, 1, P)}" style="filter:blur(3px)"/>`];
  const holes = [[3.6, 3.6], [3.6, 49.7], [66, 35.6], [99.4, 3.2], [99.4, 50.2]];
  for (const [x, y] of byDepth(holes)) out.push(S(k.cylinder(x, y, 2.4, 0, STAND, P, 6), { tone: "lo" }));
  out.push(S(k.slabOf(MEGA, STAND, PCB, P, 4, 0.4), { tone: "mid" }));
  out.push(L(holes.map(([x, y]) => k.ring(x, y, 1.6, MZ, P, 16)).join(""), { tone: "lo" }));
  out.push(D(holes.map(([x, y]) => at([x, y, MZ])), { size: 0.45 }));
  // Bajo la shield: conectores al estilo UNO, USB-B y jack de 12 V.
  out.push(header(18.8, 2.54, 10), header(45.72, 2.54, 8), header(27.94, 50.8, 8), header(50.8, 50.8, 6));
  out.push(S(k.slabOf({ x: -6.2, y: 9.5, w: 16, d: 12, r: 0.5 }, MZ, 10.9, P, 2, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -1.8, y: 38, w: 14, d: 9, r: 0.8 }, MZ, 11, P, 3, 0.4), { tone: "lo" }));
  return out.join("");
}

function megaRight() {
  const out = [];
  out.push(header(70.0, 2.54, 8));
  // ATmega2560 a 45°: TQFP de 14 mm con un punto en el pin 1.
  const c = [80.5, 26], h = 7;
  const chip = [[0, -h], [h, 0], [0, h], [-h, 0]].map(([dx, dy]) => [c[0] + dx * 1.414, c[1] + dy * 1.414]);
  const pads = [[0, -h - 1.2], [h + 1.2, 0], [0, h + 1.2], [-h - 1.2, 0]].map(([dx, dy]) => [c[0] + dx * 1.414, c[1] + dy * 1.414]);
  out.push(S(k.extrude(pads, MZ, 0.2, P), { tone: "faint", crease: "none" }));
  out.push(S(k.extrude(chip, MZ + 0.2, 1.2, P, { bevel: 0.3 }), { tone: "mid" }));
  out.push(D([at([c[0] - 5.5, c[1], MZ + 1.4])], { size: 0.6, tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([c[0] + 1, c[1] + 1], MZ + 1.4, P, "x"), "2560", { size: 2.2, tone: "lo", anchor: "middle" }));
  // Cristal de 16 MHz y botón de reset.
  out.push(S(k.slabOf({ x: 85.5, y: 37.5, w: 4.6, d: 10.5, r: 2.2 }, MZ, 3.6, P, 6, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 73.5, y: 38.5, w: 6, d: 6, r: 0.5 }, MZ, 1.8, P, 2), { tone: "lo" }));
  out.push(S(k.cylinder(76.5, 41.5, 1.6, MZ + 1.8, 1, P, 16), { tone: "mid" }));
  out.push(header(A8[0], A8[1], 8));
  // Doble fila de 2 × 18.
  const plan = { x: DBL.even - PITCH / 2, y: DBL.y0 - PITCH / 2, w: 2 * PITCH, d: 18 * PITCH, r: 0.3 };
  out.push(S(k.slabOf(plan, MZ, HEADER, P, 2, 0.3), { tone: "lo" }));
  const holes = [];
  for (let row = 0; row < 18; row++) for (const x of [DBL.even, DBL.odd]) holes.push(at([x, DBL.y0 + row * PITCH, HZ]));
  out.push(D(holes, { size: 0.5, tone: "faint" }));
  return out.join("");
}

// Conector Dupont hembra enchufado en un pin: carcasa de 2.4 mm, casquillo y el cable que sale arriba.
function dupont(d) {
  const [x, y] = d.at;
  const lit = lit0.has(d.id);
  const shell = { x: x - 1.2, y: y - 1.2, w: 2.4, d: 2.4, r: 0.2 };
  return spot(
    d.id,
    S(k.slabOf(shell, HZ, 13, P, 2, 0.3), { tone: "mid", lit }) +
      S(k.cylinder(x, y, 0.95, HZ + 13, 1.6, P, 12), { tone: "mid", lit }) +
      S(k.cylinder(x, y, 0.75, HZ + 14.6, 5, P, 12), { tone: "mid", crease: "none", lit }),
  );
}

function shield() {
  const out = [];
  out.push(S(k.slabOf(SHIELD, SZ, PCB, P, 4, 0.4), { tone: "mid" }));
  const holes = [[3.6, 3.6], [3.6, 49.7], [66, 35.6]];
  out.push(L(holes.map(([x, y]) => k.ring(x, y, 1.6, ST, P, 16)).join(""), { tone: "lo" }));
  out.push(D(holes.map(([x, y]) => at([x, y, ST])), { size: 0.45 }));
  out.push(L(k.planOutline(k.insetPlan(SHIELD, 1.4), ST, P, 4), { tone: "faint" }));
  return out.join("");
}

function power() {
  const lit = lit0.has("power");
  const out = [];
  out.push(S(k.slabOf({ x: 2.5, y: 37.5, w: 11, d: 10, r: 0.6 }, ST, 9, P, 2, 0.4), { tone: "hi", lit }));
  for (const x of [5.25, 10.75]) {
    out.push(L(k.ring(x, 41.2, 1.9, ST + 9, P, 20), { tone: "lo" }));
    out.push(L(k.lineOnTop([x - 1.9, 41.2], [x + 1.9, 41.2], ST + 9, P), { tone: "lo" }));
  }
  out.push(L([5.25, 10.75].map((x) => k.sideRing([x, 47.5, ST + 4], 1.5, "y", P, 20)).join(""), { tone: "lo" }));
  return spot("power", out.join(""));
}

function capacitor() {
  const [x, y] = [21, 43];
  return (
    S(k.cylinder(x, y, 3.2, ST, 8.5, P, 32), { tone: "mid" }) +
    L(k.sideArc(x, y, 3.2, ST + 1.2, P, 24), { tone: "faint" }) +
    L(k.lineOnTop([x - 3.2, y], [x + 3.2, y], ST + 8.5, P) + k.lineOnTop([x, y - 3.2], [x, y + 3.2], ST + 8.5, P), { tone: "lo" })
  );
}

function endstops() {
  const lit = lit0.has("endstops");
  const out = [];
  const base = { x: ENDSTOP.x0 - 1.27, y: ENDSTOP.rows[0] - 1.27, w: 6 * PITCH, d: 2 * PITCH, r: 0.3 };
  out.push(S(k.slabOf(base, ST, 2.5, P, 2, 0.3), { tone: "lo" }));
  const pins = [];
  for (const y of ENDSTOP.rows) for (let i = 0; i < 6; i++) pins.push([ENDSTOP.x0 + i * PITCH, y]);
  for (const [x, y] of byDepth(pins)) out.push(S(k.slabOf({ x: x - 0.32, y: y - 0.32, w: 0.64, d: 0.64, r: 0.05 }, ST + 2.5, 5.5, P, 1), { tone: "mid", crease: "none", lit }));
  return spot("endstops", out.join(""));
}

function jumpers() {
  const lit = lit0.has("jumpers");
  const out = [];
  for (const x of [63.6, 66.14]) {
    out.push(S(k.slabOf({ x: x - 1.27, y: 30.5, w: 2.54, d: 5.08, r: 0.4 }, ST, 6, P, 2, 0.3), { tone: "hi", lit }));
    out.push(L(k.planOutline({ x: x - 0.5, y: 31.6, w: 1, d: 2.9, r: 0.4 }, ST + 6, P, 2), { tone: "lo" }));
  }
  return spot("jumpers", out.join(""));
}

function driver({ id, cx }) {
  const lit = lit0.has(id);
  const out = [];
  for (const dx of [-6.35, 6.35]) out.push(S(k.slabOf({ x: cx + dx - 1.25, y: DRV_Y - 10.15, w: 2.5, d: 20.3, r: 0.3 }, ST, HEADER, P, 2), { tone: "lo" }));
  const pcb = { x: cx - 7.6, y: DRV_Y - 10.15, w: 15.2, d: 20.3, r: 0.6 };
  out.push(S(k.slabOf(pcb, DZ, PCB, P, 3, 0.3), { tone: "hi", lit }));
  const pins = [];
  for (const dx of [-6.35, 6.35]) for (let i = 0; i < 8; i++) pins.push(at([cx + dx, DRV_Y - 8.89 + i * PITCH, DT]));
  out.push(D(pins, { size: 0.5, tone: "mid" }));
  const sink = { x: cx - 3.5, y: DRV_Y - 3.5, w: 7, d: 7, r: 0.4 };
  out.push(S(k.slabOf({ x: cx - 2.5, y: DRV_Y - 2.5, w: 5, d: 5, r: 0.3 }, DT, 0.9, P, 2), { tone: "lo" }));
  out.push(S(k.slabOf(sink, DT + 0.9, 1.2, P, 2, 0.3), { tone: "mid" }));
  for (const dx of [-3, -1.4, 0.2, 1.8]) out.push(S(k.slabOf({ x: cx + dx, y: sink.y, w: 1.2, d: 7, r: 0.2 }, DT + 2.1, 3, P, 2), { tone: "mid" }));
  const pot = [cx - 3.6, DRV_Y + 7];
  out.push(S(k.cylinder(pot[0], pot[1], 1.5, DT, 1.4, P, 20), { tone: "mid" }));
  out.push(L(k.lineOnTop([pot[0] - 1.1, pot[1]], [pot[0] + 1.1, pot[1]], DT + 1.4, P), { tone: "lo" }));
  return spot(id, out.join(""));
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Un Arduino MEGA 2560 sobre separadores con la CNC Shield V3 montada en la parte compatible con el UNO: cuatro drivers A4988 (X, Y, Z y A), el borne de 12 V y los pines de los finales. A la derecha quedan los pines que solo tiene el Mega, con conectores Dupont en D22 a D36, D44 y A8 para el sensor, el electroimán, los botones, los LED, el buzzer, el servo y el monitor de 12 V.",
  body: [
    benchPlate(P, PLATE, { ruler: false }),
    megaUnder(),
    shield(),
    capacitor(),
    power(),
    jumpers(),
    ...DRIVERS.map(driver),
    endstops(),
    megaRight(),
    ...byDepth(DUPONTS.map((d) => [...d.at, d])).map(([, , d]) => dupont(d)),
  ],
});

const live = `
const STOPS = ${JSON.stringify(STOPS)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const groups = [...svg.querySelectorAll("[data-spot]")];
let index = 0, shown = -1, timer = 0, idle = 0, touring = !still.matches;
function show(next) {
  index = (next + STOPS.length) % STOPS.length;
  if (index === shown) return;
  shown = index;
  const on = new Set(STOPS[index].spots);
  for (const g of groups) {
    const lit = on.has(g.dataset.spot);
    for (const solid of g.querySelectorAll(".iso-solid")) solid.toggleAttribute("data-lit", lit);
  }
  readout.textContent = STOPS[index].text;
  stage.setAttribute("aria-valuenow", String(index));
  stage.setAttribute("aria-valuetext", STOPS[index].text);
}
const tour = () => { clearInterval(timer); timer = touring ? setInterval(() => show(index + 1), 2400) : 0; };
const hold = () => { touring = false; tour(); clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; tour(); }, 3600); };
new IntersectionObserver((entries) => { const seen = entries[entries.length - 1].isIntersecting; if (seen) tour(); else clearInterval(timer); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.min(0.999, Math.max(0, ((event.clientX - box.left) / box.width - 0.1) / 0.8));
  hold();
  show(Math.floor(share * STOPS.length));
});
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") to = index + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") to = index - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = STOPS.length - 1;
  if (to === null) return;
  event.preventDefault();
  hold();
  show(to);
});
show(0);
`;

const body = k.plateHtml({
  fig: "Fig 2",
  title: "Arduino MEGA 2560 · pines",
  hint: "Puntero o ← →",
  readout: STOPS[0].text,
  keys: [
    { mark: "lit", label: "Lo que usa la función elegida" },
    { mark: "raised", label: "CNC Shield V3: ocupa los pines del UNO (D2–D13, A0–A3)" },
    { mark: "flat", label: "Pines solo del Mega: D22–D53, A8–A15, Serial1–3" },
  ],
  caption:
    "La CNC Shield V3 entra en el Mega igual que en el UNO, así que motores, enable y finales quedan donde los pone HowToMechatronics. Todo lo que agrega el cabezal de disco va a la doble fila y a A8, que el UNO no tiene. Microstepping: jumper solo en MS2 de cada driver (1/4 de paso).",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Arduino MEGA con CNC Shield: las flechas recorren las funciones y sus pines" aria-valuemin="0" aria-valuemax="${STOPS.length - 1}" aria-valuenow="0">${svg}</div>`,
});

const file = theme === "light" ? "mega-light.html" : "mega.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Arduino MEGA · MathBot", theme, body, script: kitScript() + live }));
console.log("wrote", file);
