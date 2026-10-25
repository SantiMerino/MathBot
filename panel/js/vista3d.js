// Vista 3D: el SCARA (STL de HowToMechatronics) con el cabezal A v3 (mallas del CAD) en la pose que reporta el Mega,
// y el modo "Cabezal": el cabezal solo, con despiece y la ficha de cada pieza.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ROBOT, CABEZAL, META } from '../modelos.js';
import { GEO, bandeja } from './geometria.js';

const G = { H_BASE: 45, H_PINF: 10, H_PSUP: 26, H_PSUP_DISK: 8, H_TCOV: 23, H_PLAT: 45, H_ARM1: 42, H_J2C: 24, H_ARM2: 31,
  H_J3C: 22, H_CON: 4.5, ZROD0: 72, ROD: 250, H_J3GAP: 2 };
const rad = d => d * Math.PI / 180;

function geometria(p) {
  const bin = atob(p.q), n = bin.length / 2, f = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8), a = i % 3; f[i] = p.lo[a] + u / 65535 * p.span[a]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(f, 3));
  g.computeVertexNormals();
  return g;
}
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide, ...o });
const PLA = 0x1b1c1f;
const colorDe = rgb => new THREE.Color(rgb[0], rgb[1], rgb[2]);
function malla(g, m, x = 0, y = 0, z = 0, rz = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.z = rz; o.castShadow = o.receiveShadow = true; return o; }
function cilindro(r, h, m, x, y, z) { const g = new THREE.CylinderGeometry(r, r, h, 20); g.rotateX(Math.PI / 2); g.translate(0, 0, h / 2); return malla(g, m, x, y, z); }
function caja(w, d, h, m, x, y, z) { const g = new THREE.BoxGeometry(w, d, h); g.translate(0, 0, h / 2); return malla(g, m, x, y, z); }

// Hélice del resorte entre z0 y z1 (se reconstruye al levantar el plumón).
function helice(d, alambre, vueltas, z0, z1) {
  const r = (d - alambre) / 2, pts = [];
  for (let i = 0; i <= vueltas * 24; i++) { const t = i / (vueltas * 24), a = t * vueltas * Math.PI * 2; pts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z0 + (z1 - z0) * t)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), vueltas * 24, alambre / 2, 6, false);
}

export class Vista3D {
  constructor(contenedor, app) {
    this.app = app;
    this.cont = contenedor;
    this.ren = new THREE.WebGLRenderer({ antialias: true });
    this.ren.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.ren.shadowMap.enabled = true;
    this.ren.setClearColor(0x07100a);   // fondo del cristal de fósforo
    contenedor.appendChild(this.ren.domElement);
    this.escena = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(36, 1, 5, 6000);
    this.cam.up.set(0, 0, 1);
    this.ctrl = new OrbitControls(this.cam, this.ren.domElement);
    this.ctrl.enableDamping = true;
    this.escena.add(new THREE.HemisphereLight(0xffffff, 0x5a5650, 1.35));
    const sol = new THREE.DirectionalLight(0xffffff, 1.5);
    sol.position.set(-300, -500, 900); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -600, right: 600, top: 600, bottom: -600, near: 100, far: 2500 });
    this.escena.add(sol);
    const relleno = new THREE.DirectionalLight(0xffffff, 0.45); relleno.position.set(600, 400, 300); this.escena.add(relleno);
    // contraluz frío: separa el PLA negro del fondo oscuro
    const contra = new THREE.DirectionalLight(0xa8e4ff, 1.1); contra.position.set(500, 700, 500); this.escena.add(contra);
    this.modo = 'robot';
    this.construirRobot();
    this.construirCabezal();
    this.ponerModo('robot');
    new ResizeObserver(() => this.redimensionar()).observe(contenedor);
    this.ray = new THREE.Raycaster();
    this.ren.domElement.addEventListener('click', e => this.elegir(e));
    const bucle = () => { requestAnimationFrame(bucle); if (this.visible) { this.ctrl.update(); this.ren.render(this.escena, this.cam); } };
    bucle();
  }

  redimensionar() {
    const r = this.cont.getBoundingClientRect();
    if (!r.width) return;
    this.ren.setSize(r.width, r.height);
    this.cam.aspect = r.width / r.height;
    this.cam.updateProjectionMatrix();
  }

  construirRobot() {
    // todo el PLA del MathBot es negro
    const M = { azul: mat(PLA, { roughness: 0.62 }), azul2: mat(0x26272b, { roughness: 0.58 }), oscuro: mat(0x121315, { roughness: 0.6 }), acero: mat(0xc9ced4, { roughness: 0.3, metalness: 0.85 }),
      motor: mat(0x3a3d42, { roughness: 0.45, metalness: 0.55 }), caja: mat(PLA, { roughness: 0.62 }), mesa: mat(0x8f8b82, { roughness: 0.92 }), bin: mat(0x2b2c30, { roughness: 0.7 }) };
    const g = {};
    for (const [k, v] of Object.entries(ROBOT)) g[k] = geometria(v);
    const raiz = this.robot = new THREE.Group();
    this.escena.add(raiz);
    const mesa = malla(new THREE.PlaneGeometry(1400, 1100), M.mesa, 120, 0, -0.5); mesa.receiveShadow = true; raiz.add(mesa);
    raiz.add(malla(g.base, M.oscuro));
    raiz.add(malla(g.caja_uno, M.caja, -188.5, 0, 0), malla(g.tapa_uno, M.caja, -188.5, 0, 5));
    raiz.add(caja(42, 42, 40, M.motor, -114, 34, G.H_BASE));
    // bandeja y piezas (se actualizan con la configuración / el mundo virtual)
    this.bandeja = new THREE.Group(); raiz.add(this.bandeja);
    for (const [x, y, w, d] of [[0, -39, 80, 2], [0, 39, 80, 2], [-39, 0, 2, 80], [39, 0, 2, 80]]) this.bandeja.add(caja(w, d, 25, M.bin, x, y, 0));
    this.bandeja.add(caja(80, 80, 2, M.bin, 0, 0, 0));
    this.piezas = new THREE.Group(); raiz.add(this.piezas);
    // columna (gira con θ1)
    const col = this.col = new THREE.Group(); raiz.add(col);
    col.add(malla(g.j1_coupler, M.azul, 0, 0, G.H_BASE), malla(g.placa_inf, M.azul, 0, 0, G.ZROD0), malla(g.tapa_base, M.azul2, 0, 0, G.ZROD0 + G.H_PINF));
    const RODS = [[33.6, 33.6], [33.6, -33.6], [-33.6, 33.6], [-33.6, -33.6]];
    for (const [x, y] of RODS) col.add(cilindro(5, G.ROD, M.acero, x, y, G.ZROD0));
    col.add(cilindro(4, G.ROD - 18, mat(0xb08d57, { metalness: 0.6, roughness: 0.4 }), 33, 0, G.ZROD0 + 2));
    const arriba = new THREE.Group(); arriba.position.z = G.ZROD0 + G.ROD - G.H_PSUP; col.add(arriba);
    arriba.add(malla(g.placa_sup, M.azul), malla(g.tapa_sup, M.azul2, 0, 0, G.H_PSUP - G.H_PSUP_DISK - G.H_TCOV), caja(42, 42, 40, M.motor, 33, 0, G.H_PSUP));
    for (const [x, y] of RODS) { col.add(malla(g.abrazadera, M.azul2, x, y, G.ZROD0 + G.H_PINF, Math.atan2(y, x) - Math.PI / 2)); arriba.add(malla(g.abrazadera, M.azul2, x, y, G.H_PSUP - G.H_PSUP_DISK - 14, Math.atan2(y, x) - Math.PI / 2)); }
    // plataforma + brazo 1
    const plat = this.plat = new THREE.Group(); col.add(plat);
    plat.add(malla(g.plataforma, M.azul), malla(g.arm1, M.azul, 0, 0, G.H_PLAT - G.H_ARM1), malla(g.arm1_tapa, M.azul2, 0, 0, G.H_PLAT), caja(42, 42, 40, M.motor, -10, 0, G.H_PLAT));
    // J2 + brazo 2
    const j2 = this.j2 = new THREE.Group(); j2.position.set(GEO.L1, 0, G.H_PLAT - G.H_ARM1); plat.add(j2);
    const za2 = -G.H_J2C - G.H_ARM2;
    j2.add(malla(g.j2_coupler, M.oscuro, 0, 0, -G.H_J2C), malla(g.arm2, M.azul2, 0, 0, za2));
    const mj3 = caja(42, 42, 24, M.motor, 0, 0, za2 - 24); j2.add(mj3);
    // J3 (gira con φ): coupler, connector y el cabezal v3 colgando 14 mm bajo el connector
    const j3 = this.j3 = new THREE.Group(); j3.position.set(GEO.L2, 0, za2 - G.H_J3GAP); j2.add(j3);
    const zh = -G.H_J3C - G.H_CON;
    j3.add(malla(g.j3_coupler, M.oscuro, 0, 0, -G.H_J3C), malla(g.conector_j3, M.oscuro, 0, 0, zh));
    this.cabezalRobot = this.armarCabezal();
    this.cabezalRobot.grupo.position.z = zh - META.z_conector;
    j3.add(this.cabezalRobot.grupo);
  }

  // Cabezal en su marco (z = 0 en la cara superior de la placa): mallas del CAD, hélice y piezas móviles.
  armarCabezal() {
    const grupo = new THREE.Group(), piezas = {};
    for (const p of META.piezas) {
      let o;
      if (p.helice) o = new THREE.Mesh(new THREE.BufferGeometry(), mat(0xbfc3c9, { metalness: 0.8, roughness: 0.3 }));
      else if (CABEZAL[p.clave]) o = new THREE.Mesh(geometria(CABEZAL[p.clave]), p.impresa ? mat(PLA, { roughness: 0.6 }) : mat(colorDe(p.color), { roughness: 0.4 }));
      else continue;
      o.castShadow = true;
      o.userData.pieza = p;
      const nodo = new THREE.Group(); nodo.add(o); grupo.add(nodo);
      piezas[p.clave] = { nodo, malla: o, info: p };
    }
    const c = { grupo, piezas, levante: -1 };
    this.ponerLevante(c, 0);
    return c;
  }

  // Plumón, collar y resorte suben "lev" mm; el brazo del servo gira alrededor de su eje.
  ponerLevante(c, lev) {
    if (Math.abs(lev - c.levante) < 0.05) return;
    c.levante = lev;
    for (const k of ['plumon', 'collar']) if (c.piezas[k]) c.piezas[k].malla.position.z = lev;
    const h = c.piezas.horn;
    if (h) {
      const tabla = META.horn.arriba;
      let a = tabla[0][1];
      for (let i = 1; i < tabla.length; i++) if (lev <= tabla[i][0]) { const [d0, a0] = tabla[i - 1], [d1, a1] = tabla[i]; a = a0 + (a1 - a0) * (lev - d0) / (d1 - d0); break; } else a = tabla[i][1];
      const [ex, , ez] = META.horn.eje, giro = rad(a - META.horn.reposo);
      h.malla.position.set(0, 0, 0); h.malla.rotation.set(0, 0, 0);
      // rotación alrededor del eje del servo (paralelo a y) que pasa por (ex, ez)
      const m = new THREE.Matrix4().makeTranslation(ex, 0, ez).multiply(new THREE.Matrix4().makeRotationY(giro)).multiply(new THREE.Matrix4().makeTranslation(-ex, 0, -ez));
      h.malla.applyMatrix4(m);
    }
    const r = c.piezas.resorte;
    if (r) {
      const p = r.info.helice;
      r.malla.geometry.dispose();
      r.malla.geometry = helice(p.d, p.alambre, p.vueltas, META.resorte.z0 + lev, META.resorte.z1);
      r.malla.position.set(55, 0, 0);
    }
  }

  construirCabezal() {
    const grupo = this.cabezalSolo = new THREE.Group();
    this.escena.add(grupo);
    this.despiece = this.armarCabezal();
    grupo.add(this.despiece.grupo);
    // aristas finas para leer las piezas negras en el despiece
    const arista = new THREE.LineBasicMaterial({ color: 0x5b6067 });
    for (const p of Object.values(this.despiece.piezas)) if (p.info.impresa) p.malla.add(new THREE.LineSegments(new THREE.EdgesGeometry(p.malla.geometry, 30), arista));
    // dirección de despiece de cada pieza (mm): sale por su eje de montaje
    const D = { separador: [0, 0, 45], soporte: [0, 0, 24], puente: [0, 0, 90], collar: [0, 0, 52], resorte: [0, 0, 68], plumon: [0, 0, -90],
      servo: [0, 45, 24], horn: [0, 22, 24], porta_iman: [-14, 24, -26], electroiman: [-14, 24, -55], abrazadera: [-14, -24, -26],
      sensor: [-14, -24, -70], tornillos_m4: [0, 0, -50] };
    for (const [k, v] of Object.entries(D)) if (this.despiece.piezas[k]) this.despiece.piezas[k].dir = new THREE.Vector3(...v);
    this.ponerDespiece(0.6);
  }

  ponerDespiece(f) {
    this.fDespiece = f;
    for (const p of Object.values(this.despiece.piezas)) if (p.dir) p.nodo.position.copy(p.dir).multiplyScalar(f);
  }

  ponerModo(modo) {
    this.modo = modo;
    this.robot.visible = modo === 'robot';
    this.cabezalSolo.visible = modo === 'cabezal';
    if (modo === 'robot') { this.cam.position.set(-430, -860, 640); this.ctrl.target.set(150, -20, 110); }
    else { this.cam.position.set(190, -340, 150); this.ctrl.target.set(10, 0, -10); }
    this.redimensionar();
  }

  elegir(e) {
    if (this.modo !== 'cabezal') return;
    const r = this.ren.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.cam);
    const hit = this.ray.intersectObjects(this.cabezalSolo.children, true).find(h => h.object.isMesh);
    for (const p of Object.values(this.despiece.piezas)) p.malla.material.emissive?.setHex(0);
    if (hit) { hit.object.material.emissive?.setHex(0x0b4a5c); this.app.piezaElegida?.(hit.object.userData.pieza); }
  }

  actualizar(estado, cfg, mundo) {
    if (!this.visible) return;
    const q = estado.q;
    this.col.rotation.z = rad(q[0]);
    this.plat.position.z = q[3];
    this.j2.rotation.z = rad(q[1]);
    this.j3.rotation.z = rad(q[2]);
    this.cabezalRobot.grupo.visible = !!cfg.cabezal;
    this.ponerLevante(this.cabezalRobot, estado.pluma ? 0 : GEO.LEVANTE);
    const b = bandeja(cfg);
    this.bandeja.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 0);
    this.bandeja.scale.z = cfg.binh / 25;
    // piezas del mundo virtual
    const obs = mundo?.objetos ?? [];
    while (this.piezas.children.length > obs.length) this.piezas.remove(this.piezas.children[0]);
    obs.forEach((o, i) => {
      let m = this.piezas.children[i];
      if (!m) { m = cilindro(1, 1, mat(o.color)); this.piezas.add(m); }
      m.scale.set(o.r, o.r, o.h); m.position.set(o.x, o.y, o.z);
    });
  }
}
