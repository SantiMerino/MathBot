// Fig 5 · Final de carrera de palanca con rodillo, sin tapa, en el homing de J3 de MathBot.
// node anatomia/final-carrera/build.mjs [--light]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { kitScript } from "../kit/inline-kit.mjs";
import { tools } from "../comun.mjs";
import { SW, CAM, W, leverState, sceneSvg } from "./geo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 600;
const HEIGHT = 440;

// Modelo (mathbot_mega.ino): J3 a 10 pasos/°, homing con runSpeed a 1100 pasos/s hacia negativo hasta que el final
// se activa (NC a GND con INPUT_PULLUP → HIGH = activo), HOME_POS de J3 = −166.2°; regreso con VMAX 1500 y ACEL 1500.
const MODEL = { perDeg: 10, homeSpeed: 1100, vMax: 1500, accel: 1500, home: CAM.home, pin: "D9" };

// La base sigue el marco del interruptor (girada 45° en planta) para no dejar esquinas vacías.
const O = W(0, 0), EXv = [W(1, 0)[0] - O[0], W(1, 0)[1] - O[1]], EYv = [W(0, 1)[0] - O[0], W(0, 1)[1] - O[1]];
const local = ([x, y]) => [(x - O[0]) * EXv[0] + (y - O[1]) * EXv[1], (x - O[0]) * EYv[0] + (y - O[1]) * EYv[1]];
const disc = local([0, 0]);
const LP = { x: Math.min(-30, disc[0] - 30), y: -30, w: 0, d: 0, r: 6 };
LP.w = Math.max(42, disc[0] + 30) - LP.x; LP.d = disc[1] + 30 - LP.y;
const plateRing = k.roundedPlan(LP, 6).map(([x, y]) => W(x, y));
const P = k.fitProjection([...plateRing.flatMap(([x, y]) => [[x, y, -9], [x, y, 0]]), ...[[-20, -20], [20, 20], [-20, 20], [20, -20]].map(([x, y]) => [x, y, 28])], WIDTH, HEIGHT, { pad: 22, azimuth: 45, elevation: 44 });
const { at, S, L, D } = tools(P);
const byDepth = (list) => [...list].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const quad = (x0, y0, x1, y1) => [W(x0, y0), W(x1, y0), W(x1, y1), W(x0, y1)];

function bench() {
  const h = 6, foot = 3, out = [`<path class="iso-halo" d="${k.extrude(plateRing, -h - foot, h, P).fill}"/>`];
  const at4 = (inset) => k.corners(LP, inset).map(([x, y]) => W(x, y));
  for (const [x, y] of byDepth(at4(10))) {
    out.push(S(k.cylinder(x, y, 4.2, -h - foot, 1, P, 24), { tone: "lo" }), S(k.cylinder(x, y, 3.2, -h - foot + 1, foot - 1, P, 24), { tone: "mid" }));
  }
  out.push(S(k.extrude(plateRing, -h, h, P, { bevel: 1 }), { tone: "mid" }), L(k.onTop(k.roundedPlan(k.insetPlan(LP, 3), 6).map(([x, y]) => W(x, y)), 0, P, true), { tone: "lo" }));
  const screws = at4(5);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.3, 0, P, 14)).join(""), { tone: "lo" }), D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.45 }));
  return out.join("");
}

// Bloque del rodamiento de J3 con una escala de grados fija; el índice de la polea marca φ sobre ella.
function bearing() {
  const out = [];
  const blk = { x: -17, y: -17, w: 34, d: 34, r: 3 };
  out.push(S(k.slabOf(blk, 0, 8, P, 6, 0.6), { tone: "mid", inner: L(k.sideSeam(blk, 4, P, 6), { tone: "faint" }) }));
  out.push(D(k.corners(blk, 3).map(([x, y]) => at([x, y, 8])), { size: 0.45 }));
  // escala fija bajo el disco: un tick cada 5°, largo cada 30°
  out.push(S(k.cylinder(0, 0, 21, 8, 0.8, P, 96, 0.3), { tone: "lo", crease: "none" }));
  const t = k.radialTicks(0, 0, 21, 72, 6, 8.8, [1, 2.2], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // marca del home (−166.2°): un tick largo en tono alto
  const a = ((CAM.home + 90) * Math.PI) / 180;
  out.push(L(k.lineOnTop([Math.sin(a) * 17.6, -Math.cos(a) * 17.6], [Math.sin(a) * 21, -Math.cos(a) * 21], 8.8, P), { tone: "hi" }));
  out.push(S(k.cylinder(0, 0, 5, 8.8, 1.6, P, 32), { tone: "mid" }), S(k.cylinder(0, 0, 2.5, 10.4, 3.6, P, 20), { tone: "mid", crease: "none" }));
  return out.join("");
}

// Pedestal impreso y escuadra donde se atornilla el interruptor (en el robot es la cara inferior del brazo 2).
function bracket() {
  const out = [];
  out.push(S(k.extrude(quad(-12, -15, 10, 5), 0, 16, P, { bevel: 0.5 }), { tone: "mid", inner: L(k.ringSeam(quad(-12, -15, 10, 5), 8, P), { tone: "faint" }) }));
  out.push(S(k.extrude(quad(-17, -19, 15, 9.5), 16, 4, P, { bevel: 0.5 }), { tone: "mid" }));
  out.push(D([W(-14.5, -16.5), W(12.5, -16.5), W(-14.5, 7), W(12.5, 7)].map(([x, y]) => at([x, y, 20])), { size: 0.45 }));
  return out.join("");
}

// Conector JST de 2 vías sobre la escuadra y cable al Mega (termina en un cabezal de dos pines en el banco).
const JST = [-4, -17.5, 4, -12.5];
function connector(blades) {
  const out = [];
  const z = SW.z0 + 2.1;
  const ends = { COM: W(-1.6, -12.5), NC: W(1.6, -12.5) };
  for (const [x, name] of blades) {
    if (!ends[name]) continue;
    const from = at([...W(x, -3.6), z]), mid = at([...W(x, -8), z + 1.5]), to = at([...ends[name], SW.z0 + 3.2]);
    out.push(k.wireSvg(from, to, { via: [mid], tone: name === "NC" ? "mid" : "lo", size: 0.7 }));
  }
  out.push(S(k.extrude(quad(...JST), SW.z0, 4, P, { bevel: 0.3 }), { tone: "mid" }));
  out.push(D([W(-1.6, -15), W(1.6, -15)].map(([x, y]) => at([x, y, SW.z0 + 4])), { size: 0.45 }));
  return out.join("");
}
function cable() {
  // dos hilos del conector bajan por el frente de la escuadra y corren por el banco hasta el cabezal D9 · GND
  const head = W(-24, -23), out = [];
  for (const [dx, tone] of [[-1.2, "lo"], [1.2, "mid"]]) {
    const a = at([...W(dx, -17.5), SW.z0 + 1.2]), b = at([...W(dx, -19.3), SW.z0 - 1]), c = at([...W(dx, -19.3), 0.6]), d = at([...W(dx, -23), 0.6]), e = at([...W(-18 + dx, -23), 0.6]), f = at([head[0] + dx * 0.7, head[1] + dx * 0.7, 4.4]);
    out.push(k.wireSvg(a, f, { via: [b, c, d, e], tone, ends: "to", size: 0.6 }));
  }
  const hp = { x: head[0] - 5, y: head[1] - 5, w: 10, d: 10, r: 1 };
  out.unshift(S(k.slabOf(hp, 0, 4, P, 3, 0.3), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([hp.x + 1.5, hp.y + 8.4], 4, P), "D9", { size: 2.6, tone: "lo" }));
  return out.join("");
}
// La tapa quitada, boca arriba sobre el banco
function cover() {
  const out = [], c = [W(19, -14), W(39, -14), W(39, -3.8), W(19, -3.8)];
  out.push(S(k.extrude(c, 0, 3.2, P, { bevel: 0.4 }), { tone: "lo" }));
  out.push(L(k.onTop([W(19.9, -13.1), W(38.1, -13.1), W(38.1, -4.7), W(19.9, -4.7)], 3.2, P, true), { tone: "faint" }));
  out.push(L([W(24.25, -11.1), W(33.75, -11.1)].map(([x, y]) => k.ring(x, y, 1.2, 3.2, P, 14)).join(""), { tone: "lo" }));
  return out.join("");
}

const first = sceneSvg(P, 0, leverState(0, false));
const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "Final de carrera de palanca con rodillo, sin tapa, junto al disco de home montado en el eje de J3. Un lóbulo impreso en el disco empuja el rodillo; la palanca baja el botón, que dobla una lámina de contacto hasta que salta del contacto NC al NO. COM y NC van al pin D9 del Mega por un conector JST.",
  body: [bench(), bearing(), cover(), `<g data-part="disc">${first.disc}</g>`, bracket(), `<g data-part="switch">${first.svg}</g>`, connector(first.blades), cable()],
});

const geo = readFileSync(join(HERE, "geo.mjs"), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const liveCode = `${geo}
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(MODEL)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const discG = svg.querySelector('[data-part="disc"]'), swG = svg.querySelector('[data-part="switch"]');
let phi = 0, vel = 0, target = 0, on = false, homed = false, mode = "home", frame = 0, last = 0, visible = false, touring = !still.matches, wait = 0, idle = 0, drawn = "";
function draw() {
  const st = leverState(phi, on); on = st.on;
  const key = phi.toFixed(2) + "|" + on;
  if (key !== drawn) { drawn = key; const s = sceneSvg(P, phi, st); discG.innerHTML = s.disc; swG.innerHTML = s.svg; }
  const text = "φ " + phi.toFixed(1).replace("-", "−") + "° · palanca " + st.tip.toFixed(1) + " mm · " + (on ? "NC abierto · D9 HIGH" : "NC cerrado · D9 LOW");
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() { stage.setAttribute("aria-valuenow", String(Math.round(phi))); stage.setAttribute("aria-valuetext", "J3 a " + phi.toFixed(0) + " grados, final " + (on ? "activo" : "libre")); }
// Homing como homeEje(): velocidad constante hacia negativo hasta leer HIGH; luego fija φ = HOME_POS y vuelve a 0 con rampa.
function step(dt) {
  if (mode === "home") {
    phi -= (M.homeSpeed / M.perDeg) * dt;
    const st = leverState(phi, on); on = st.on;
    if (on) { phi = Math.max(phi, M.home); mode = "pause"; wait = 0.8; }
    return;
  }
  if (mode === "pause") { wait -= dt; if (wait <= 0) { mode = "go"; target = 0; } return; }
  const left = target - phi, vMax = M.vMax / M.perDeg, acc = M.accel / M.perDeg;
  if (Math.abs(left) < 0.05 && Math.abs(vel) < 1) { phi = target; vel = 0; if (mode === "go" && touring) { mode = "rest"; wait = 1.6; } return; }
  const dir = Math.sign(left), cap = Math.sqrt(2 * acc * Math.abs(left));
  vel = dir * Math.min(vMax, cap, Math.abs(vel) + acc * dt);
  phi += vel * dt;
  if (Math.sign(target - phi) !== dir) { phi = target; vel = 0; }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (mode === "rest") { wait -= dt; if (wait <= 0 && touring) mode = "home"; }
  else if (still.matches && mode !== "manual") { phi = mode === "home" || mode === "pause" ? M.home : 0; mode = touring ? "rest" : mode; wait = 3; }
  else step(dt);
  draw();
  frame = visible && (touring || mode !== "manual" || phi !== target) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (deg) => {
  touring = false; mode = "manual"; target = Math.max(-200, Math.min(20, deg));
  clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; mode = "go"; target = 0; run(); }, 4000);
  describe(); run();
};
new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (ev) => { const b = svg.getBoundingClientRect(); steer(20 - Math.min(1, Math.max(0, ((ev.clientX - b.left) / b.width - 0.15) / 0.7)) * 220); });
stage.addEventListener("keydown", (ev) => {
  let to = null;
  if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") to = target - (ev.shiftKey ? 10 : 1);
  if (ev.key === "ArrowRight" || ev.key === "ArrowUp") to = target + (ev.shiftKey ? 10 : 1);
  if (ev.key === "Home") to = 0;
  if (ev.key === "h" || ev.key === "H") { ev.preventDefault(); touring = false; mode = "home"; run(); return; }
  if (to === null) return;
  ev.preventDefault(); steer(to);
});
window.fig5 = { pose(p) { touring = false; mode = "manual"; clearTimeout(idle); phi = target = p; on = leverState(p, false).on; drawn = ""; draw(); } };
describe();
draw();
`;

const body = k.plateHtml({
  fig: "Fig 5",
  title: "Final de carrera · homing J3",
  hint: "Puntero ↔ gira J3 · H homing",
  readout: "φ 0.0° · palanca 0.0 mm · NC cerrado · D9 LOW",
  keys: [
    { mark: "lit", label: "Botón y lámina de contacto: saltan de NC a NO al bajar 0.5 mm el botón" },
    { mark: "raised", label: "Palanca de 22 mm con rodillo (3:1) · disco de home Ø32 con lóbulo impreso en el eje de J3" },
  ],
  caption:
    "Con el interruptor libre, la lámina apoya en NC y une COM con NC: el pin D9 (INPUT_PULLUP) lee LOW. En el homing, J3 gira hacia negativo a 1100 pasos/s (110°/s). Cuando el lóbulo baja la punta de la palanca 1.5 mm, el botón baja 0.5 mm y la lámina salta a NO: NC se abre, D9 lee HIGH y homeEje() detiene el motor y fija φ = −166.2°. Para volver a soltarse, el botón debe subir 0.1 mm más (diferencial). Después J3 regresa a 0° con rampa (1500 pasos/s, 1500 pasos/s²). Los recorridos son típicos de un KW11-3Z; mida los del suyo. Si un cable se corta, D9 queda en HIGH y el robot lo toma como final activo: falla hacia el lado seguro.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Final de carrera: flechas giran J3, H corre el homing" aria-valuemin="-200" aria-valuemax="20" aria-valuenow="0">${svg}</div>`,
});

const file = theme === "light" ? "final-carrera-light.html" : "final-carrera.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Final de carrera · MathBot", theme, body, script: kitScript() + liveCode }));
console.log("wrote", file);
