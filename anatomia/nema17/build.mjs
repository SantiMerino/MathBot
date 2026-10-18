// Fig 1 · Los dos NEMA 17 de MathBot en un banco de prueba, con el mismo tren de pasos que prueba_nema.ino.
// node anatomia/nema17/build.mjs [--light]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { kitScript } from "../kit/inline-kit.mjs";
import { tools, benchPlate, nemaBody, NEMA_HALF } from "../comun.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// Modelo: A4988 a 1/4 de micropaso (jumper solo en MS2) y la rampa de prueba_nema.ino.
const MODEL = { stepsRev: 800, vStart: 200, vMax: 800, accel: 2000, half: 400 };
const MOTORS = [
  { name: "17HS4401", cx: -40, length: 40, torque: 45, amps: 1.7, joints: "J1, J2 y Z" },
  { name: "NEMA 17 corto", cx: 40, length: 23, torque: 17, amps: 1.0, joints: "J3" },
];
const CY = -10;
const PAD = 2;
const DRIVER_Y = 36;
const DZ = 5.6; // placa portadora sobre separadores de 4 mm

const WIDTH = 600;
const HEIGHT = 360;
const PLATE = { x: -76, y: -40, w: 152, d: 104, r: 6 };

// Alturas del tren sobre la cara delantera: polea GT2 de 20 dientes y disco graduado.
const PULLEY = { gap: 1, flange: 1, teeth: 6, hub: 6, rTeeth: 6.1, rFlange: 7.5, rHub: 8 };
const DISC = { r: 17, h: 1.2, ticks: 16.2 };
const stackOf = (top) => {
  const z0 = top + 2 + PULLEY.gap;
  const z1 = z0 + PULLEY.flange, z2 = z1 + PULLEY.teeth, z3 = z2 + PULLEY.flange, z4 = z3 + PULLEY.hub;
  return { z0, z1, z2, z3, z4, disc: z4 + DISC.h };
};

const tops = MOTORS.map((m) => PAD + m.length);
const P = k.fitProjection(
  [...k.boxCorners(PLATE, -12, 0), ...MOTORS.map((m, i) => [m.cx, CY, stackOf(tops[i]).disc + 3])],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 60 },
);
const { at, S, L, D } = tools(P);

function motor(m, index) {
  const out = [];
  const { cx } = m;
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: cx - 22, y: CY - 22, w: 44, d: 44, r: 4 }, 0, 1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf({ x: cx - 19, y: CY - 19, w: 38, d: 38, r: 3 }, 0, PAD, P, 4), { tone: "lo" }));
  const body = nemaBody(P, cx, CY, PAD, m.length);
  out.push(body.svg);
  const s = stackOf(body.top);
  out.push(S(k.cylinder(cx, CY, 2.5, body.boss, s.z0 - body.boss, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(cx, CY, PULLEY.rFlange, s.z0, PULLEY.flange, P, 40), { tone: "mid" }));
  out.push(S(k.cylinder(cx, CY, PULLEY.rTeeth, s.z1, PULLEY.teeth, P, 40), { tone: "mid", crease: "none" }));
  out.push(`<path data-part="teeth-${index}" class="iso-line" data-tone="lo" d=""/>`);
  out.push(S(k.cylinder(cx, CY, PULLEY.rFlange, s.z2, PULLEY.flange, P, 40), { tone: "mid" }));
  out.push(S(k.cylinder(cx, CY, PULLEY.rHub, s.z3, PULLEY.hub, P, 40), { tone: "mid" }));
  out.push(L(k.sideArc(cx, CY, PULLEY.rHub, s.z3 + PULLEY.hub / 2, P, 32), { tone: "faint" }));
  out.push(S(k.cylinder(cx, CY, DISC.r, s.z4, DISC.h, P, 72, 0.5), { tone: "hi", crease: "lo", lit: true }));
  out.push(L(k.ring(cx, CY, DISC.ticks, s.disc, P, 72), { tone: "lo" }));
  out.push(L(k.ring(cx, CY, 9, s.disc, P, 40), { tone: "faint" }));
  out.push(`<path data-part="minor-${index}" class="iso-line" data-tone="lo" d=""/>`);
  out.push(`<path data-part="major-${index}" class="iso-line" data-tone="mid" d=""/>`);
  out.push(`<path data-part="zero-${index}" class="iso-line" data-tone="lit" data-free="end" d="" style="stroke-width:1"/>`);
  out.push(S(k.cylinder(cx, CY, 2.5, s.disc, body.top + 20 - s.disc, P, 20), { tone: "mid" }));
  out.push(L(k.ring(cx, CY, 1.2, body.top + 20, P, 12), { tone: "lo" }));
  // Índice fijo: separador M3 en la esquina delantera y un brazo que apunta al disco.
  const post = [cx + 15.5, CY + 15.5];
  const armZ = s.disc + 0.6;
  out.push(S(k.cylinder(post[0], post[1], 2.4, body.top, armZ - body.top, P, 20), { tone: "mid" }));
  const on = (r, w) => [cx + (r + w) * Math.SQRT1_2, CY + (r - w) * Math.SQRT1_2];
  const arm = [on(23.6, 1.3), on(23.6, -1.3), on(14.6, -1.3), on(14.6, 1.3)];
  out.push(S(k.extrude(arm, armZ, 1, P, { bevel: 0.3 }), { tone: "mid" }));
  out.push(S(k.cylinder(post[0], post[1], 1.6, armZ + 1, 0.8, P, 16), { tone: "mid" }));
  out.push(D([at([post[0], post[1], armZ + 1.8])], { size: 0.5, tone: "lo" }));
  const tipA = [cx + 11 * Math.SQRT1_2, CY + 11 * Math.SQRT1_2];
  const tipB = [cx + 15.2 * Math.SQRT1_2, CY + 15.2 * Math.SQRT1_2];
  out.push(L(k.lineOnTop(tipA, tipB, armZ + 1, P), { tone: "hi", free: "start" }));
  return out.join("");
}

// A4988 sobre dos tiras hembra, con el lado de salida al motor (2B 2A 1A 1B) hacia +x.
const PIN = (i) => DRIVER_Y - 8.89 + i * 2.54;
const TOPZ = DZ + 10.1;
function driverBase(cx) {
  const out = [];
  const carrier = { x: cx - 11, y: DRIVER_Y - 14, w: 22, d: 28, r: 1.2 };
  out.push(`<path class="iso-halo" d="${k.haloOf(carrier, 0, 1, P)}" style="filter:blur(2px)"/>`);
  const legs = k.corners(carrier, 2.6);
  for (const [x, y] of legs) out.push(S(k.cylinder(x, y, 1.7, 0, 4, P, 16), { tone: "lo" }));
  out.push(S(k.slabOf(carrier, 4, 1.6, P, 3, 0.4), { tone: "lo" }));
  out.push(L(legs.map(([x, y]) => k.ring(x, y, 1.4, DZ, P, 14)).join(""), { tone: "lo" }));
  out.push(D(legs.map(([x, y]) => at([x, y, DZ])), { size: 0.45 }));
  for (const dx of [-6.35, 6.35]) {
    const strip = { x: cx + dx - 1.25, y: DRIVER_Y - 10.15, w: 2.5, d: 20.3, r: 0.3 };
    out.push(S(k.slabOf(strip, DZ, 8.5, P, 2), { tone: "lo" }));
  }
  const pcb = { x: cx - 7.6, y: DRIVER_Y - 10.15, w: 15.2, d: 20.3, r: 0.6 };
  out.push(S(k.slabOf(pcb, DZ + 8.5, 1.6, P, 3, 0.3), { tone: "mid" }));
  const pins = [];
  for (const dx of [-6.35, 6.35]) for (let i = 0; i < 8; i++) pins.push(at([cx + dx, PIN(i), TOPZ]));
  out.push(D(pins, { size: 0.55, tone: "mid" }));
  out.push(S(k.slabOf({ x: cx - 2.5, y: DRIVER_Y - 2.5, w: 5, d: 5, r: 0.3 }, TOPZ, 0.9, P, 2), { tone: "lo" }));
  return out.join("");
}
function driverTop(cx) {
  const out = [];
  const sink = { x: cx - 3.5, y: DRIVER_Y - 3.5, w: 7, d: 7, r: 0.4 };
  out.push(S(k.slabOf(sink, TOPZ + 0.9, 1.2, P, 2, 0.3), { tone: "mid" }));
  for (const x of [-3, -1.4, 0.2, 1.8].map((dx) => cx + dx)) {
    out.push(S(k.slabOf({ x, y: sink.y, w: 1.2, d: 7, r: 0.2 }, TOPZ + 2.1, 3, P, 2), { tone: "mid" }));
  }
  const pot = [cx - 3.6, DRIVER_Y + 7];
  out.push(S(k.cylinder(pot[0], pot[1], 1.5, TOPZ, 1.4, P, 20), { tone: "mid" }));
  out.push(L(k.lineOnTop([pot[0] - 1.1, pot[1]], [pot[0] + 1.1, pot[1]], TOPZ + 1.4, P), { tone: "lo" }));
  return out.join("");
}
// Los cuatro cables del conector JST a las salidas del driver, sin cruzarse.
function wires(m) {
  const { cx, length } = m;
  const zc = PAD + (length > 30 ? 8 : 5.5) / 2;
  const face = CY + NEMA_HALF + 4.2;
  return [2.5, 0.5, -1.5, -3.5]
    .map((dx, i) => {
      const x = cx + dx, z = TOPZ + 1.4 + i * 0.9, y = PIN(2 + i);
      const pts = [[x, face, zc], [x, 18.5, zc], [x, 18.5, z], [cx + 6.35, 18.5, z], [cx + 6.35, y, z], [cx + 6.35, y, TOPZ]].map(at);
      return k.wireSvg(pts[0], pts[pts.length - 1], { via: pts.slice(1, -1), tone: "lo", size: 0.6 });
    })
    .join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Banco de prueba con los dos NEMA 17 de MathBot: a la izquierda el 17HS4401 de 40 mm, a la derecha el corto de 23 mm. Cada uno lleva una polea GT2 de 20 dientes y un disco graduado frente a un índice fijo, y recibe el mismo tren de pasos de su driver A4988 a 1/4 de micropaso: 800 pasos por vuelta, 0.45° por paso.",
  body: [
    benchPlate(P, PLATE),
    ...MOTORS.map(motor),
    ...MOTORS.map((m) => driverBase(m.cx)),
    ...MOTORS.map(wires),
    ...MOTORS.map((m) => driverTop(m.cx)),
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(MODEL)};
const CY = ${CY}, R_TEETH = ${PULLEY.rTeeth}, DISC_R = ${DISC.ticks};
const RIGS = ${JSON.stringify(MOTORS.map((m, i) => ({ cx: m.cx, ...stackOf(tops[i]) })))};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const parts = RIGS.map((_, i) => ({
  teeth: svg.querySelector('[data-part="teeth-' + i + '"]'),
  minor: svg.querySelector('[data-part="minor-' + i + '"]'),
  major: svg.querySelector('[data-part="major-' + i + '"]'),
  zero: svg.querySelector('[data-part="zero-' + i + '"]'),
}));
const view = towardViewer(P);
// Dientes de la polea: 20 generatrices, solo las que miran al observador.
function teethAt(cx, z0, z1, turn) {
  let d = "";
  for (let i = 0; i < 20; i++) {
    const a = turn + (i / 20) * Math.PI * 2;
    const nx = Math.sin(a), ny = -Math.cos(a);
    if (nx * view[0] + ny * view[1] < 0.12) continue;
    d += segment([cx + nx * R_TEETH, CY + ny * R_TEETH, z0], [cx + nx * R_TEETH, CY + ny * R_TEETH, z1], P);
  }
  return d;
}
let pos = 0, vel = 0, target = 0, frame = 0, last = 0, visible = false, touring = !still.matches, clock = 0, idle = 0;
// Gira media vuelta, espera 1 s y vuelve, como la prueba del firmware.
const tourAt = (t) => { const c = t % 6.2; return c < 3.1 ? M.half : 0; };
function draw() {
  const step = Math.round(pos);
  const turn = (step / M.stepsRev) * Math.PI * 2;
  RIGS.forEach((rig, i) => {
    const p = parts[i];
    p.teeth.setAttribute("d", teethAt(rig.cx, rig.z1, rig.z2, turn));
    const t = radialTicks(rig.cx, CY, DISC_R, 100, 5, rig.disc, [1.2, 2.4], P, turn);
    p.minor.setAttribute("d", t.minor);
    p.major.setAttribute("d", t.major);
    p.zero.setAttribute("d", lineOnTop([rig.cx + Math.sin(turn) * 9, CY - Math.cos(turn) * 9], [rig.cx + Math.sin(turn) * DISC_R, CY - Math.cos(turn) * DISC_R], rig.disc, P));
  });
  const deg = ((step % M.stepsRev) + M.stepsRev) % M.stepsRev * 360 / M.stepsRev;
  const rpm = Math.abs(vel) / M.stepsRev * 60;
  const text = step + " µpasos · " + deg.toFixed(2) + "° · " + rpm.toFixed(0) + " rpm";
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() {
  stage.setAttribute("aria-valuenow", String(target));
  stage.setAttribute("aria-valuetext", target + " micropasos, " + (target * 360 / M.stepsRev).toFixed(2) + " grados");
}
// Rampa del firmware: v = √(vStart² + 2·accel·d), con d los pasos al extremo más cercano, tope vMax.
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
const steer = (next) => {
  touring = false;
  target = Math.max(0, Math.min(M.stepsRev, Math.round(next)));
  describe();
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.min(1, Math.max(0, ((event.clientX - box.left) / box.width - 0.15) / 0.7));
  steer(share * M.stepsRev);
});
stage.addEventListener("keydown", (event) => {
  const big = event.shiftKey ? 80 : 4;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + big;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - big;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = M.stepsRev;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
describe();
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "NEMA 17 · los dos",
  hint: "Puntero o ← →",
  readout: "0 µpasos · 0.00° · 0 rpm",
  keys: [
    { mark: "lit", label: "Disco graduado: gira 0.45° por micropaso, 3.6° por división" },
    { mark: "raised", label: "17HS4401 · 40 mm · 45 N·cm · 1.7 A · J1, J2 y Z" },
    { mark: "flat", label: "NEMA 17 corto · 23 mm · 17 N·cm · 1 A · J3" },
  ],
  caption:
    "Los dos motores reciben el mismo tren de pasos: 200 pasos de 1.8° por vuelta, a 1/4 de micropaso 800, con la rampa de prueba_nema.ino (200 → 800 pasos/s, 2000 pasos/s²). Giran exactamente lo mismo; lo que cambia con el largo del estator es el par: el de 40 mm da 2.6 veces más, por eso va en J1, J2 y Z, y el corto aligera el brazo 2 en J3.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Dos motores NEMA 17: las flechas mandan un paso completo, Mayús 36 grados, Inicio y Fin van a 0 y a una vuelta" aria-valuemin="0" aria-valuemax="${MODEL.stepsRev}" aria-valuenow="0">${svg}</div>`,
});

const file = theme === "light" ? "nema17-light.html" : "nema17.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "NEMA 17 · MathBot", theme, body, script: kitScript() + live }));
console.log("wrote", file);
