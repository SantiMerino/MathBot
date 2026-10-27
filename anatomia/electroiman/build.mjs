// Fig 6 · Electroimán hecho a mano de MathBot: olla (óptima) y perno (casero), montado en el cabezal A v3
// y en despiece. node anatomia/electroiman/build.mjs [--light]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { kitScript } from "../kit/inline-kit.mjs";
import { tools, benchPlate } from "../comun.mjs";
import { VAR, MODEL, PIECE, WEIGHT, Z_DOWN, EXPLODE_LIFT, sceneOf, frameSvg } from "./geo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 620;
const AZ = 45;

// Eje Z del firmware (mathbot_mega.ino): VMAX 1500 pasos/s y ACEL 1500 pasos/s² a 100 pasos/mm.
const ZMOT = { v: 15, a: 15, lift: 40 };

// Posiciones en planta (dependen solo del azimut), luego la base y la cámara definitiva.
const probe = k.fitProjection([[0, 0, 0], [1, 1, 1]], WIDTH, HEIGHT, { azimuth: AZ });
const sc = sceneOf(probe);
const xs = [sc.post[0], sc.mag[0], -80, 80], ys = [sc.post[1], sc.mag[1], -80, 80];
const PLATE = { x: Math.min(...xs) - 22, y: Math.min(...ys) - 22, w: 0, d: 0, r: 10 };
PLATE.w = Math.max(...xs) + 22 - PLATE.x;
PLATE.d = Math.max(...ys) + 22 - PLATE.y;
const TOP = Z_DOWN + EXPLODE_LIFT + 6 + 47.5 + 24 + 8;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -12, 0), ...k.boxCorners({ x: -80, y: -80, w: 160, d: 160 }, 0, TOP - 40), [sc.post[0], sc.post[1], TOP]],
  WIDTH, HEIGHT, { pad: 18, azimuth: AZ },
);
const { at, S, L, D } = tools(P);

function base() {
  const [x, y] = sc.post, out = [benchPlate(P, PLATE)];
  out.push(S(k.cylinder(x, y, 13, 0, 4, P, 44, 0.5), { tone: "mid" }));
  out.push(L(k.ring(x, y, 10, 4, P, 36), { tone: "faint" }));
  out.push(D([0, 1, 2].map((i) => at([x + 10 * Math.cos(i * 2.1 + 0.6), y + 10 * Math.sin(i * 2.1 + 0.6), 4])), { size: 0.45 }));
  return out.join("");
}

const fmt = (x, n = 1) => x.toFixed(n).replace(".", ",");
const INFO = Object.fromEntries(Object.entries(MODEL).map(([key, m]) => [key, {
  name: VAR[key].name, awg: VAR[key].awg, N: m.N, R: fmt(m.R), I: fmt(m.I, 2), P: fmt(m.P), kg: fmt(m.Fc / 9.81, m.Fc / 9.81 < 1 ? 2 : 1), margin: Math.round(m.Fc / WEIGHT), screw: VAR[key].screw,
}]));

const first = frameSvg(P, { v: "olla" });
const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "Electroimán hecho a mano colgado del cabezal A v3 de MathBot, que cuelga de un tramo del brazo 2 sobre un soporte de banco. La cara del imán queda 40 mm bajo la placa, 0,5 mm sobre un disco de acero de 69 g. Variante olla: núcleo de acero Ø8, bobina AWG 33, camisa de tubo EMT de media pulgada y tapa de arandela, en la copa del separador. Variante perno: perno de 3/8 de pulgada con la cabeza en la copa, dos arandelas, bobina AWG 30 y tuerca.",
  body: [base(), `<g data-part="live">${first}</g>`],
});

const geo = readFileSync(join(HERE, "geo.mjs"), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const liveCode = `${geo}
const P = ${JSON.stringify(P)};
const INFO = ${JSON.stringify(INFO)};
const Z = ${JSON.stringify(ZMOT)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const live = svg.querySelector('[data-part="live"]');
const readout = document.querySelector("[data-readout]");
const tabs = [...document.querySelectorAll("[data-variant]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
let v = "olla", e = 0, eT = 0, lift = 0, vz = 0, zT = 0, on = false, stuck = false, phase = "idle", pt = 0;
let frame = 0, last = 0, visible = false, touring = !still.matches, clock = 0, idle = 0, drawn = "";
// Recorrido: olla levanta la pieza → despiece → armado → perno levanta → despiece → armado.
const TOUR = [[0.6, "go"], [12.5, 1], [17, 0], [19.5, "perno"], [20.5, "go"], [32.5, 1], [37, 0], [39.5, "olla"]];
const LOOP = 41;
function energize() { if (phase !== "idle" || e > 0.01 || eT > 0) return; phase = "snap"; pt = 0; on = true; describe(); }
function setVariant(k) {
  if (phase !== "idle" || k === v) return;
  v = k; drawn = "";
  for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.variant === v));
  describe();
}
function step(dt) {
  pt += dt;
  if (phase === "snap") { if (pt > 0.12) stuck = true; if (pt > 0.5) { phase = "up"; zT = Z.lift; } }
  else if (phase === "up" && lift === zT) { phase = "hold"; pt = 0; }
  else if (phase === "hold" && pt > 1.2) { phase = "down"; zT = -0.5; }
  else if (phase === "down" && lift === zT) { phase = "drop"; pt = 0; on = false; stuck = false; }
  else if (phase === "drop" && pt > 0.4) { phase = "back"; zT = 0; }
  else if (phase === "back" && lift === zT) { phase = "idle"; describe(); }
  // trapecio del eje Z: v ≤ 15 mm/s, a ≤ 15 mm/s²
  const d = zT - lift;
  if (still.matches) { lift = zT; vz = 0; return; }
  const want = Math.sign(d) * Math.min(Z.v, Math.sqrt(2 * Z.a * Math.abs(d)));
  vz += Math.max(-Z.a * dt, Math.min(Z.a * dt, want - vz));
  if (Math.abs(d) < 0.02 && Math.abs(vz) < 0.3) { lift = zT; vz = 0; } else lift += vz * dt;
}
function draw() {
  const key = v + "|" + e.toFixed(3) + "|" + lift.toFixed(2) + "|" + on + stuck;
  if (key !== drawn) { drawn = key; live.innerHTML = frameSvg(P, { v, e, lift, on, stuck }); }
  const I = INFO[v];
  let text;
  if (e > 0.02) text = I.name + " · despiece " + Math.round(e * 100) + " % · M3 × " + I.screw;
  else if (on) text = I.name + " · " + I.I + " A · " + I.P + " W · F ≈ " + I.kg + " kg (×" + I.margin + ") · Z +" + Math.max(0, lift).toFixed(0) + " mm";
  else text = I.name + " · " + I.N + " vueltas AWG " + I.awg + " · " + I.R + " Ω · apagado";
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() {
  stage.setAttribute("aria-valuenow", String(Math.round(eT * 100)));
  stage.setAttribute("aria-valuetext", INFO[v].name + ", despiece " + Math.round(eT * 100) + " %, imán " + (on ? "encendido" : "apagado"));
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    const c0 = clock % LOOP; clock += dt; const c1 = clock % LOOP;
    for (const [t, a] of TOUR) if ((c0 < t && c1 >= t) || (c1 < c0 && t <= c1)) {
      if (a === "go") energize(); else if (typeof a === "string") setVariant(a); else if (phase === "idle") { eT = a; describe(); }
    }
  }
  step(dt);
  if (still.matches) e = eT;
  else { e += (eT - e) * (1 - Math.exp(-dt / 0.45)); if (Math.abs(eT - e) < 0.002) e = eT; }
  draw();
  const settled = !touring && phase === "idle" && e === eT && lift === zT;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const hold = () => { touring = false; clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 6000); describe(); run(); };
new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (ev) => {
  if (phase !== "idle") return;
  const box = svg.getBoundingClientRect();
  eT = Math.round(Math.min(1, Math.max(0, ((ev.clientX - box.left) / box.width - 0.2) / 0.6)) * 20) / 20;
  hold();
});
stage.addEventListener("click", () => { if (eT > 0) eT = 0; else energize(); hold(); });
stage.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { if (phase === "idle") eT = Math.min(1, Math.round(eT * 10 + 1) / 10); }
  else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { if (phase === "idle") eT = Math.max(0, Math.round(eT * 10 - 1) / 10); }
  else if (ev.key === " " || ev.key === "Enter") { if (eT > 0) eT = 0; else energize(); }
  else if (ev.key === "o" || ev.key === "O" || ev.key === "1") setVariant("olla");
  else if (ev.key === "p" || ev.key === "P" || ev.key === "2") setVariant("perno");
  else if (ev.key === "Home") eT = 0;
  else if (ev.key === "End" && phase === "idle") eT = 1;
  else return;
  ev.preventDefault();
  hold();
});
for (const t of tabs) t.addEventListener("click", () => { setVariant(t.dataset.variant); hold(); });
// gancho para capturas: fija una pose sin animar
window.fig6 = { pose(nv, ne, nl = 0, non = false, nst = false) { touring = false; clearTimeout(idle); phase = "idle"; v = nv; eT = e = ne; lift = zT = nl; on = non; stuck = nst; drawn = ""; for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.variant === v)); draw(); } };
describe();
draw();
`;

const O = INFO.olla, Q = INFO.perno;
const tabsHtml = `<style>.ei-tabs{display:flex;gap:6px;justify-content:center;margin:0 0 6px}.ei-tabs button{font:inherit;font-size:12px;letter-spacing:.02em;color:var(--anatomy-muted);background:transparent;border:1px solid var(--anatomy-face);border-radius:999px;padding:3px 12px;cursor:pointer}.ei-tabs button[aria-pressed="true"]{color:var(--anatomy-strong);border-color:var(--anatomy-muted)}.ei-tabs button:focus-visible{outline:1px solid var(--anatomy-strong);outline-offset:2px}</style><div class="ei-tabs" role="group" aria-label="Variante"><button type="button" data-variant="olla" aria-pressed="true">Olla · óptima</button><button type="button" data-variant="perno" aria-pressed="false">Perno · casera</button></div>`;
const body = k.plateHtml({
  fig: "Fig 6",
  title: "Electroimán hecho a mano",
  hint: "Puntero ↔ despiece · clic levanta",
  readout: `Olla · ${O.N} vueltas AWG ${O.awg} · ${O.R} Ω · apagado`,
  keys: [
    { mark: "lit", label: `Bobina: olla AWG ${O.awg} × ${O.N} (${O.I} A) · perno AWG ${Q.awg} × ${Q.N} (${Q.I} A), a 12 V` },
    { mark: "raised", label: `Disco de acero Ø40 × 7 (${Math.round(PIECE.grams)} g) · separador 06 de PLA+ · M3 × ${O.screw} (olla) o × ${Q.screw} (perno)` },
  ],
  caption:
    `La cara del imán queda 40 mm bajo la placa, como el KK-P20/15, así que el firmware no cambia: baja a 0,5 mm de la pieza, la enciende, sube 40 mm a 15 mm/s y la vuelve a dejar. ` +
    `Olla: núcleo Ø8 de acero dulce, carrete de PLA con ${O.N} vueltas de AWG ${O.awg}, camisa de conduit EMT de ½" (Ø17,9 × 1,07) y tapa de arandela; el flujo se cierra por la pieza en los dos polos. Modelo F = B²A/2μ₀ con 0,3 mm de entrehierro y B ≤ 1,5 T: ${O.kg} kg, ×${O.margin} el peso. Cabe en la copa cambiando IMAN a Ø17,9 y reimprimiendo solo el separador. ` +
    `Perno: 3/8" × 1" con la cabeza en una copa hexagonal, arandelas SAE, ${Q.N} vueltas de AWG ${Q.awg} y tuerca; un solo polo y el retorno por aire: unos ${Q.kg} kg estimados (×${Q.margin}) con ${Q.P} W, por eso solo encendido unos segundos. ` +
    `En los dos el M3 de la placa entra a una rosca hecha en el núcleo o en la cabeza. Los números son de modelo: la fuerza real se mide con el dinamómetro.`,
  body: `${tabsHtml}<div class="iso-stage" tabindex="0" role="slider" aria-label="Electroimán: flechas para el despiece, espacio para levantar la pieza, O y P cambian de variante" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${svg}</div>`,
});

const file = theme === "light" ? "electroiman-light.html" : "electroiman.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Electroimán hecho a mano · MathBot", theme, body, script: kitScript() + liveCode }));
console.log("wrote", file, JSON.stringify(INFO));
