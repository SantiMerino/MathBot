// Robot virtual: responde el mismo protocolo que firmware/mathbot_mega v3.0 para probar el panel sin hardware.
// Lleva dos posiciones: la "contada" (la que reporta, como el Mega) y la "real" (la del mundo simulado:
// tinta, piezas, choques). Si se mueve a mano con los motores sueltos, solo cambia la real, igual que en el robot.
import {
  GEO, CFG_FABRICA, PUNTOS_FABRICA, envolver, fk, ik, limites, phiHerramienta, zPlataforma, zTransito,
  rosaTramos, bandeja, perfil,
} from './geometria.js';

const CLAVE_EEPROM = 'mathbot-eeprom-virtual';
const SW_REAL = [-89, -152.4, -120, 203];          // dónde están de verdad los finales (los de fábrica)
const OBJETOS = [
  { n: 'Arandela de acero', metal: true, x: 60, y: -215, h: 3, r: 15, color: '#a9b2bb' },
  { n: 'Ficha de PLA', metal: false, x: 150, y: -238, h: 8, r: 15, color: '#f2c14e' },
  { n: 'Tuerca de acero', metal: true, x: 240, y: -215, h: 7, r: 13, color: '#8d969e' },
  { n: 'Bloque de madera', metal: false, x: 325, y: -172, h: 12, r: 15, color: '#b07d4f' },
];

class Paro extends Error {}

export class MegaVirtual {
  constructor() {
    this.vel = 1;                                  // multiplicador del reloj (misiones largas)
    this.real = [25, -70, 30, 190];
    this.cuenta = [...this.real];
    this.conocido = [false, false, false, false];
    this.motoresOn = false;
    this.homeManual = false;
    this.enParo = false;
    this.moviendo = false;
    this.pluma = false;
    this.iman = false;
    this.herr = 'p';
    this.cargar();
    this.metal = [];
    this.escaneo = false;
    this.mundo = { objetos: OBJETOS.map(o => ({ ...o, z: 0 })), tinta: [[]], choque: null };
    this.cola = [];
  }

  get homeHecho() { return this.conocido.every(Boolean); }
  letra() {
    if (this.enParo) return 'P';
    if (!this.motoresOn) return 'L';
    if (this.moviendo) return 'M';
    if (!this.homeHecho) return 'N';
    return this.homeManual ? 'H' : 'R';
  }

  // ---- enlace
  conectar(salida) {
    this.salida = salida;
    this.buf = '';
    this.estadoT = setInterval(() => { if (!this.moviendo) this.enviarEstado(); }, 500);
    this.caidaT = setInterval(() => this.caidaZ(), 50);
    // como el Mega real al abrir el puerto: se reinicia (drivers sin energía unos instantes), energiza y se identifica
    this.motoresOn = false;
    this.conocido = [false, false, false, false];
    this.homeManual = false;
    setTimeout(() => {
      this.motoresOn = true;
      this.identificar();
      this.decir('L robot virtual (sin hardware): mismo protocolo que el firmware v3.0');
      this.decir('L sin home: H (finales) o S (manual)');
    }, 400);
  }
  desconectar() { clearInterval(this.estadoT); clearInterval(this.caidaT); this.salida = null; }
  decir(l) { this.salida?.(l); }

  recibir(texto) {
    for (const ch of texto) {
      if (ch === '!') { this.dispararParo('panel'); this.buf = ''; continue; }
      if (ch === '\n') {
        const l = this.buf.trim();
        this.buf = '';
        if (l) this.cola.push(l);
        if (!this.atendiendo) this.atender();
      } else this.buf += ch;
    }
  }

  async atender() {
    this.atendiendo = true;
    while (this.cola.length) {
      let l = this.cola.shift(), id = null;
      const m = l.match(/^#(\d+)\s*(.*)$/);
      if (m) { id = m[1]; l = m[2]; }
      let ok = true, motivo = '';
      try { await this.ejecutar(l); } catch (e) { ok = false; motivo = e.message || 'argumentos'; }
      this.moviendo = false;
      this.decir(`${ok ? 'ok' : 'err'}${id ? ' ' + id : ''}${ok ? '' : ' ' + motivo}`);
      this.enviarEstado();
    }
    this.atendiendo = false;
  }

  // ---- EEPROM (localStorage)
  cargar() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE_EEPROM));
      if (d?.cfg && d?.puntos) { this.cfg = { ...CFG_FABRICA, ...d.cfg }; this.puntos = d.puntos; return true; }
    } catch {}
    this.fabrica();
    return false;
  }
  fabrica() { this.cfg = { ...CFG_FABRICA }; this.puntos = PUNTOS_FABRICA.map(p => ({ ...p })); }
  guardar() { try { localStorage.setItem(CLAVE_EEPROM, JSON.stringify({ cfg: this.cfg, puntos: this.puntos })); } catch {} }

  // ---- mensajes
  identificar() {
    const L = limites(this.cfg);
    this.decir(`I MATHBOT 3.0 L1 228 L2 144 CAIDA 80.5 DISCO 20 R 55 PHI 0 120 240 BAJO 50 40 38 PASOS 44.4444 35.5556 10 100 ZMAX 203 J3 ${L.min[2]} ${L.max[2]} ZMIN ${L.min[3].toFixed(1)}`);
  }
  listarConfig() { for (const [k, v] of Object.entries(this.cfg)) this.decir(`C ${k} ${Number.isInteger(v) && !['zmesa', 'rosax', 'rosay'].includes(k) ? v : v.toFixed(2)}`); }
  listarPuntos() {
    this.decir(`C npuntos ${this.puntos.length}`);
    this.puntos.forEach((p, i) => this.decir(`C pt ${i + 1} ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.h.toFixed(1)}`));
  }
  sensorVe() {
    if (this.herr !== 's' || !this.cfg.cabezal) return false;
    const t = fk(this.real, this.cfg).puntas.s;
    return this.mundo.objetos.some(o => o.metal && !o.llevado && Math.hypot(t[0] - o.x, t[1] - o.y) < o.r - 2 && t[2] - (o.z + o.h) <= 4.5 && t[2] - (o.z + o.h) > -0.5);
  }
  enviarEstado() {
    const q = this.cuenta.map((v, i) => v.toFixed(i === 3 ? 1 : 2)).join(' ');
    const fin = this.real.map((v, i) => (Math.abs(v - SW_REAL[i]) < 0.3 ? 1 : 0)).join('');
    this.decir(`S ${this.letra()} ${q} ${this.herr} ${this.pluma ? 1 : 0} ${this.iman ? 1 : 0} ${this.sensorVe() ? 1 : 0} ${this.motoresOn ? 12.1 : 12.0} ${fin}`);
  }

  // ---- paro y reloj
  dispararParo(motivo) {
    if (this.enParo) return;
    this.enParo = true;
    this.conocido = [false, false, false, false];
    this.homeManual = false;
    this.setIman(false);                     // los motores siguen energizados: sostienen Z
    this.decir(`E PARO ${motivo}`);
  }
  vivo() { if (this.enParo) throw new Paro('paro'); }
  esperar(ms) { return new Promise(r => setTimeout(r, ms / this.vel)); }

  // Con los motores sueltos la plataforma Z baja por su peso (el husillo Tr8×8 no se frena solo).
  caidaZ() {
    if (this.motoresOn || this.sostenerZ) return;
    if (this.real[3] > GEO.ZMIN_MECANICO) {
      this.real[3] = Math.max(GEO.ZMIN_MECANICO, this.real[3] - 0.5);   // ≈10 mm/s
      this.revisarMundo();
    }
  }

  // ---- movimiento
  async mover(obj, conLimites = true) {
    if (conLimites) {
      const L = limites(this.cfg);
      if (obj.some((v, i) => v < L.min[i] - 1e-3 || v > L.max[i] + 1e-3)) throw new Error('fuera de los limites articulares');
    }
    if (!this.motoresOn) throw new Error('motores sueltos (O 1)');
    this.vivo();
    const d = obj.map((v, i) => Math.abs(v - this.cuenta[i]) * GEO.PASOS[i]);
    let ref = 0, tmax = 0;
    d.forEach((di, i) => { const t = di / GEO.VMAX[i]; if (t > tmax) { tmax = t; ref = i; } });
    if (d[ref] < 0.5) return;
    const pf = perfil(d[ref], GEO.VMAX[ref], GEO.ACEL[ref]);
    const c0 = [...this.cuenta], r0 = [...this.real], delta = obj.map((v, i) => v - c0[i]);
    await this.animar(pf.T, f => {
      const s = pf.f(f);
      for (let i = 0; i < 4; i++) { this.cuenta[i] = c0[i] + delta[i] * s; this.real[i] = r0[i] + delta[i] * s; }
    });
    for (let i = 0; i < 4; i++) { this.cuenta[i] = obj[i]; this.real[i] = r0[i] + delta[i]; }
  }

  async animar(T, aplicar) {
    this.moviendo = true;
    const t0 = performance.now();
    let tEstado = 0;
    for (;;) {
      this.vivo();
      const t = (performance.now() - t0) / 1000 * this.vel;
      aplicar(Math.min(t, T));
      this.revisarMundo();
      if (t - tEstado >= 0.2 * this.vel) { tEstado = t; this.enviarEstado(); }
      if (t >= T) break;
      await new Promise(r => setTimeout(r, 16));
    }
  }

  posicion = i => this.cuenta[i];
  moverZ(z) { return this.mover([this.cuenta[0], this.cuenta[1], this.cuenta[2], z]); }
  async irA(x, y) {
    const q = ik(x, y, this.herr, this.cfg);
    if (!q) throw new Error('fuera de alcance');
    await this.mover([q[0], q[1], phiHerramienta(this.herr, this.cfg), this.cuenta[3]]);
  }
  puntaActual() { return fk(this.cuenta, this.cfg).puntas[this.herr]; }

  // Recorre una polilínea a velocidad constante (como los tramos del firmware).
  async trazar(pts) {
    let largo = 0;
    const acum = [0];
    for (let i = 1; i < pts.length; i++) { largo += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); acum.push(largo); }
    const T = largo / this.cfg.vel, dif = this.real.map((v, i) => v - this.cuenta[i]);
    let j = 0;
    await this.animar(T, t => {
      const s = (t / T) * largo;
      while (j < pts.length - 2 && acum[j + 1] < s) {
        j++;
        const trazo = this.mundo.tinta[this.mundo.tinta.length - 1];
        if (this.pluma && trazo.length) trazo.push([pts[j][0], pts[j][1]]);   // tinta en cada vértice (solo si la punta ya toca), a cualquier velocidad
      }
      const u = Math.min(1, (s - acum[j]) / Math.max(acum[j + 1] - acum[j], 1e-9));
      const x = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u;
      const q = ik(x, y, this.herr, this.cfg);
      if (!q) throw new Error('punto del trazo fuera de alcance');
      this.cuenta[0] = q[0]; this.cuenta[1] = q[1];
      this.real[0] = q[0] + dif[0]; this.real[1] = q[1] + dif[1];
    });
  }

  setPluma(abajo) { this.pluma = abajo; return this.esperar(350); }
  setIman(on) {
    this.iman = on;
    const t = fk(this.real, this.cfg).puntas.i;
    if (on) {
      const o = this.mundo.objetos.find(o => o.metal && Math.hypot(t[0] - o.x, t[1] - o.y) < o.r && t[2] - (o.z + o.h) < 1.5);
      if (o) o.llevado = true;
    } else {
      for (const o of this.mundo.objetos.filter(o => o.llevado)) {
        o.llevado = false;
        const b = bandeja(this.cfg);
        o.x = t[0]; o.y = t[1];
        o.z = o.x > b.x0 && o.x < b.x1 && o.y > b.y0 && o.y < b.y1 ? 2 : 0;
      }
    }
  }

  // Tinta, piezas llevadas y choques del cabezal con la mesa / piezas / bandeja.
  revisarMundo() {
    const f = fk(this.real, this.cfg, this.pluma ? 0 : GEO.LEVANTE).puntas;
    for (const o of this.mundo.objetos) if (o.llevado) { o.x = f.i[0]; o.y = f.i[1]; o.z = f.i[2] - o.h; }
    const tinta = this.mundo.tinta, trazo = tinta[tinta.length - 1];
    if (this.cfg.cabezal && this.pluma && f.p[2] <= 0.3) trazo.push([f.p[0], f.p[1]]);
    else if (trazo.length) tinta.push([]);
    if (!this.cfg.cabezal || !this.motoresOn) return;
    const b = bandeja(this.cfg);
    for (const k of 'pis') {
      const [x, y, z] = f[k];
      let piso = 0;
      if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) piso = b.h;
      for (const o of this.mundo.objetos) if (!o.llevado && Math.hypot(x - o.x, y - o.y) < o.r) piso = Math.max(piso, o.z + o.h);
      const cede = k === 'p' && this.pluma ? GEO.LEVANTE : 0;                       // el plumón tiene resorte
      if (z < piso - cede - 0.5) {
        this.mundo.choque = { k, x, y };
        this.dispararParo(`choque del ${k === 'p' ? 'plumon' : k === 'i' ? 'electroiman' : 'sensor'}`);
        return;
      }
    }
  }

  // ---- home
  async homeEje(e) {
    if (!this.cfg.finales) throw new Error('sin finales de carrera: usa S (home manual)');
    this.motoresOn = true;
    const conocido = this.conocido[e];
    const dReal = SW_REAL[e] - this.real[e];
    const sentido = e === 3 ? 1 : -1;
    if (Math.sign(dReal) !== sentido && Math.abs(dReal) > 0.01) throw new Error('el final de carrera no se activo (cableado, 12 V o sentido)');
    const T = Math.abs(dReal) * GEO.PASOS[e] / [1200, 1300, 1100, 1500][e];
    const c0 = this.cuenta[e], r0 = this.real[e];
    await this.animar(T, t => { this.cuenta[e] = c0 + dReal * t / T; this.real[e] = r0 + dReal * t / T; });
    this.real[e] = SW_REAL[e];
    if (conocido) this.decir(`E DERIVA ${['J1', 'J2', 'J3', 'Z'][e]} ${(c0 + dReal - this.cfg['home' + (e + 1)]).toFixed(2)}`);
    this.cuenta[e] = this.cfg['home' + (e + 1)];
    this.conocido[e] = true;
  }

  async homing(solo) {
    if (this.enParo) throw new Error('primero limpia el paro (C)');
    if (this.pluma) await this.setPluma(false);
    this.setIman(false);
    if (solo != null) return this.homeEje(solo);
    for (const e of [3, 2, 1, 0]) {
      await this.homeEje(e);
      if (e === 3) await this.mover([this.cuenta[0], this.cuenta[1], this.cuenta[2], zTransito(this.cfg)], false);
    }
    this.homeManual = false;
    this.herr = 'p';
    await this.mover([0, 0, 0, zTransito(this.cfg)]);
  }

  // ---- rutinas (mismo orden que el firmware)
  comprobarRosa() {
    const { pts, largo } = rosaTramos(this.cfg);
    for (const p of pts) if (!ik(p[0], p[1], 'p', this.cfg)) {
      this.decir(`L rosa fuera de alcance en ${p[0].toFixed(0)}, ${p[1].toFixed(0)}`);
      throw new Error('la rosa no se alcanza completa');
    }
    this.decir(`L rosa alcanzable: ${largo.toFixed(0)} mm`);
    return pts;
  }
  async herramienta(k) {
    if (k !== 'p' && this.pluma) await this.setPluma(false);
    this.herr = k;
    await this.mover([this.cuenta[0], this.cuenta[1], phiHerramienta(k, this.cfg), this.cuenta[3]]);
    this.decir(`L herramienta activa: ${{ p: 'plumon', i: 'electroiman', s: 'sensor' }[k]}`);
  }
  async dibujarRosa() {
    if (!this.cfg.cabezal) throw new Error('sin cabezal');
    const pts = this.comprobarRosa();
    this.decir('E FASE rosa');
    await this.herramienta('p');
    await this.moverZ(zTransito(this.cfg));
    await this.irA(...pts[0]);
    await this.setPluma(true);
    await this.moverZ(zPlataforma(8, 'p', this.cfg));
    await this.moverZ(zPlataforma(0, 'p', this.cfg));
    const t0 = performance.now();
    await this.trazar(pts);
    await this.moverZ(zPlataforma(10, 'p', this.cfg));
    await this.setPluma(false);
    await this.moverZ(zTransito(this.cfg));
    this.decir(`L rosa terminada en ${((performance.now() - t0) / 1000 * this.vel).toFixed(1)} s`);
  }
  async irAPunto(i) {
    const p = this.puntos[i];
    if (!p) throw new Error('no existe ese punto');
    await this.moverZ(zTransito(this.cfg));
    await this.irA(p.x, p.y);
  }
  async escanear() {
    if (!this.cfg.cabezal) throw new Error('sin cabezal');
    if (!this.puntos.length) throw new Error('no hay puntos guardados (PT)');
    this.decir('E FASE escaneo');
    await this.herramienta('s');
    for (let i = 0; i < this.puntos.length; i++) {
      await this.irAPunto(i);
      await this.moverZ(zPlataforma(this.puntos[i].h + 3, 's', this.cfg));
      await this.esperar(500);
      this.metal[i] = this.sensorVe();
      this.decir(`E METAL ${i + 1} ${this.metal[i] ? 1 : 0}`);
    }
    this.escaneo = true;
    await this.moverZ(zTransito(this.cfg));
  }
  async recolectar() {
    if (!this.escaneo) throw new Error('primero escanea (X)');
    this.decir('E FASE recoleccion');
    await this.herramienta('i');
    let lugar = 0;
    for (let i = 0; i < this.puntos.length; i++) {
      if (!this.metal[i]) continue;
      await this.irAPunto(i);
      await this.moverZ(zPlataforma(this.puntos[i].h + 0.5, 'i', this.cfg));
      this.setIman(true);
      await this.esperar(500);
      this.decir(`L iman ON -> punto ${i + 1}`);
      await this.moverZ(zTransito(this.cfg));
      const bx = this.cfg.binx + (lugar % 2 ? 14 : -14), by = this.cfg.biny + (Math.floor(lugar / 2) % 2 ? 10 : -10);
      lugar++;
      await this.irA(bx, by);
      await this.moverZ(zPlataforma(this.cfg.binh + this.puntos[i].h + 6, 'i', this.cfg));
      this.setIman(false);
      await this.esperar(400);
      await this.moverZ(zTransito(this.cfg));
    }
  }
  async mision() {
    if (!this.homeHecho) throw new Error('primero haz home (H o S)');
    this.comprobarRosa();
    const t0 = performance.now();
    await this.escanear();
    await this.recolectar();
    await this.dibujarRosa();
    this.decir('E FASE regreso');
    await this.herramienta('p');
    await this.mover([0, 0, 0, zTransito(this.cfg)]);
    this.decir(`E FIN ${((performance.now() - t0) / 1000 * this.vel).toFixed(1)}`);
  }

  // ---- intérprete (mismas órdenes y mensajes que el firmware)
  async ejecutar(linea) {
    const m = linea.match(/^([A-Za-z?]+)\s*(.*)$/);
    if (!m) throw new Error('orden desconocida (? para ver todo)');
    const orden = m[1].toUpperCase(), args = m[2].trim();
    const v = args.split(/[\s,]+/).filter(Boolean).map(Number).filter(n => !Number.isNaN(n));
    const requiereHome = () => { if (!this.homeHecho) throw new Error('primero haz home (H o S)'); };
    const eje = s => { s = (s || '').toLowerCase(); return { 1: 0, 2: 1, 3: 2, 4: 3, j1: 0, j2: 1, j3: 2, x: 4, y: 5, z: 6 }[s] ?? -1; };

    switch (orden) {
      case '?': this.identificar(); this.listarConfig(); this.listarPuntos(); this.enviarEstado(); return;
      case 'H': {
        if (!args) return this.homing(null);
        const e = eje(args);
        if (e < 0) throw new Error('usa H, H j1, H j2, H j3 o H z');
        return this.homing(e === 6 ? 3 : e);
      }
      case 'S': {
        if (this.enParo) throw new Error('primero limpia el paro (C)');
        const q = v.length === 4 ? v : v.length === 0 ? [0, 0, 0, this.conocido[3] ? this.cuenta[3] : this.cfg.home4] : null;
        if (!q) throw new Error('usa S o S t1 t2 phi z');
        this.cuenta = [...q];
        this.conocido = [true, true, true, true];
        this.motoresOn = true;
        this.homeManual = true;
        this.herr = 'p';
        this.decir('L home manual: la precision depende de la alineacion a mano');
        return;
      }
      case 'O':
        if (v[0]) { this.motoresOn = true; return; }
        this.motoresOn = false;
        this.conocido = [false, false, false, false];
        this.homeManual = false;
        this.decir('L motores sueltos: Z puede bajar por su peso');
        return;
      case 'J': {
        const [a, d] = args.split(/\s+/);
        const e = eje(a), paso = Math.max(-20, Math.min(20, Number(d)));
        if (e < 0 || Number.isNaN(paso)) throw new Error('usa J eje paso (eje 1..4, x, y, z)');
        if (e <= 3) {
          const q = [...this.cuenta];
          q[e] += paso;
          if (this.homeHecho || this.conocido[e]) {
            const L = limites(this.cfg);
            if (q[e] < L.min[e] || q[e] > L.max[e]) throw new Error('limite del eje');
          }
          return this.mover(q, false);
        }
        requiereHome();
        if (e === 6) return this.moverZ(this.cuenta[3] + paso);
        const t = this.puntaActual();
        return this.irA(t[0] + (e === 4 ? paso : 0), t[1] + (e === 5 ? paso : 0));
      }
      case 'T': {
        const k = args[0]?.toLowerCase();
        if (!'pis'.includes(k) || !k) throw new Error('usa T p, T i o T s');
        requiereHome();
        return this.herramienta(k);
      }
      case 'M': requiereHome(); if (v.length !== 2) throw new Error('argumentos'); return this.irA(v[0], v[1]);
      case 'L': {
        requiereHome();
        if (v.length !== 2) throw new Error('argumentos');
        const a = this.puntaActual();
        return this.trazar([[a[0], a[1]], [v[0], v[1]]]);
      }
      case 'Z': requiereHome(); if (v.length !== 1) throw new Error('argumentos'); return this.moverZ(v[0]);
      case 'ZT': requiereHome(); if (v.length !== 1) throw new Error('argumentos');
        return this.moverZ(zPlataforma(v[0], this.herr, this.cfg) + (this.herr === 'p' && !this.pluma ? -GEO.LEVANTE : 0));
      case 'A': requiereHome(); if (v.length !== 4) throw new Error('argumentos'); return this.mover(v);
      case 'V': if (v.length !== 1 || v[0] <= 0) throw new Error('usa V mm/s'); this.cfg.vel = Math.max(2, Math.min(80, v[0])); return;
      case 'P':
        if (v.length !== 1) throw new Error('usa P 1 o P 0');
        if (v[0] && this.herr !== 'p') throw new Error('el plumon solo baja con T p');
        return this.setPluma(!!v[0]);
      case 'E': if (v.length !== 1) throw new Error('usa E 1 o E 0'); this.setIman(!!v[0]); return;
      case 'PT': {
        if (!v.length) return this.listarPuntos();
        const i = v[0] - 1;
        if (i < 0 || i >= 12 || i > this.puntos.length) throw new Error('numero de punto invalido');
        if (v.length === 4) this.puntos[i] = { x: v[1], y: v[2], h: v[3] };
        else if (v.length === 1) {
          requiereHome();
          const t = this.puntaActual();
          this.puntos[i] = { x: t[0], y: t[1], h: this.puntos[i]?.h ?? 0 };
        } else throw new Error('usa PT n x y h o PT n');
        this.escaneo = false;
        return this.listarPuntos();
      }
      case 'PTB': {
        const i = v[0] - 1;
        if (!(i >= 0 && i < this.puntos.length)) throw new Error('numero de punto invalido');
        this.puntos.splice(i, 1);
        this.escaneo = false;
        return this.listarPuntos();
      }
      case 'G': requiereHome(); return this.irAPunto(v[0] - 1);
      case 'X': requiereHome(); return this.escanear();
      case 'K': requiereHome(); return this.recolectar();
      case 'D': requiereHome(); return this.dibujarRosa();
      case 'D?': this.comprobarRosa(); return;
      case 'R': return this.mision();
      case 'CFG': {
        if (!args) return this.listarConfig();
        const [clave, val] = args.split(/\s+/);
        if (!(clave.toLowerCase() in this.cfg) || val === undefined) throw new Error('clave desconocida');
        this.cfg[clave.toLowerCase()] = Number(val);
        return;
      }
      case 'GUARDAR': this.guardar(); return;
      case 'CARGAR': if (!this.cargar()) throw new Error('EEPROM vacia: valores de fabrica'); return;
      case 'FABRICA': this.fabrica(); return;
      case 'C':
        this.enParo = false;
        this.mundo.choque = null;
        return;
      default: throw new Error('orden desconocida (? para ver todo)');
    }
  }

  // ---- solo del robot virtual: mover a mano con los motores sueltos y reiniciar la mesa
  aMano(i, v) {
    if (this.motoresOn) return false;
    this.real[i] = v;
    this.revisarMundo();
    return true;
  }
  reiniciarMesa() { this.mundo.objetos = OBJETOS.map(o => ({ ...o, z: 0 })); this.mundo.tinta = [[]]; this.mundo.choque = null; }
}

export { envolver };
