// Cliente del protocolo del firmware v3 (firmware/README.md) sobre Web Serial o sobre el robot virtual.
import { CFG_FABRICA, PUNTOS_FABRICA, GEO } from './geometria.js';

// ---- Enlaces: los dos exponen abrir(), cerrar(), escribir(texto) y onLinea(cb)
export class EnlaceSerial {
  static disponible() { return 'serial' in navigator; }
  async abrir() {
    this.puerto = await navigator.serial.requestPort();
    // Abrir el puerto reinicia el Mega (DTR): el firmware vuelve a mandar "I MATHBOT ..." en ≈1.5 s.
    await this.puerto.open({ baudRate: 115200 });
    this.salida = this.puerto.writable.getWriter();
    this.leyendo = this.leer();
  }
  async leer() {
    const dec = new TextDecoder();
    let resto = '';
    while (this.puerto?.readable) {
      this.lector = this.puerto.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.lector.read();
          if (done) break;
          resto += dec.decode(value, { stream: true });
          let i;
          while ((i = resto.indexOf('\n')) >= 0) {
            const linea = resto.slice(0, i).replace(/\r$/, '');
            resto = resto.slice(i + 1);
            if (linea) this.cb?.(linea);
          }
        }
      } catch (e) {
        this.alCaer?.(e);
        break;
      } finally {
        this.lector.releaseLock();
      }
    }
  }
  onLinea(cb) { this.cb = cb; }
  async escribir(texto) { await this.salida.write(new TextEncoder().encode(texto)); }
  async cerrar() {
    try { await this.lector?.cancel(); } catch {}
    try { this.salida?.releaseLock(); } catch {}
    try { await this.puerto?.close(); } catch {}
    this.puerto = null;
  }
}

export class EnlaceVirtual {
  constructor(mega) { this.mega = mega; }
  async abrir() { this.mega.conectar(l => this.cb?.(l)); }
  onLinea(cb) { this.cb = cb; }
  async escribir(texto) { this.mega.recibir(texto); }
  async cerrar() { this.mega.desconectar(); }
}

const ESTADOS = { R: 'Listo', H: 'Listo (home manual)', N: 'Sin home', M: 'Moviendo', L: 'Motores sueltos', P: 'PARO' };

export class Robot extends EventTarget {
  constructor() {
    super();
    this.enlace = null;
    this.conectado = false;
    this.cfg = { ...CFG_FABRICA };
    this.puntos = PUNTOS_FABRICA.map(p => ({ ...p }));
    this.metal = [];
    this.info = null;
    this.estado = { letra: '-', q: [0, 0, 0, GEO.ZMAX], herr: 'p', pluma: 0, iman: 0, metal: 0, v12: 0, finales: [0, 0, 0, 0] };
    this.pendientes = new Map();
    this.cola = Promise.resolve();
    this.sigId = 1;
    this.ocupado = false;
    this.tUltimaLinea = 0;
  }

  get textoEstado() { return ESTADOS[this.estado.letra] ?? 'Desconectado'; }
  // Con home: "R" o "H"; mientras se mueve ("M") vale lo último que se supo.
  get conHome() { return this.homeVisto; }

  emitir(tipo, detalle) { this.dispatchEvent(new CustomEvent(tipo, { detail: detalle })); }

  async conectar(enlace) {
    if (this.enlace) await this.desconectar();
    this.enlace = enlace;
    enlace.onLinea(l => this.linea(l));
    enlace.alCaer = () => this.perdido('se cortó la comunicación');
    const listo = new Promise(res => { this.alIdentificar = res; });
    await enlace.abrir();
    // El Mega real se reinicia al abrir el puerto: espera su identificación (o la pide si no llega).
    const t = setTimeout(() => this.enlace?.escribir('?\n'), 2500);
    await Promise.race([listo, new Promise((_, rej) => setTimeout(() => rej(new Error('el Mega no respondió (¿firmware v3 cargado?)')), 6000))]);
    clearTimeout(t);
    this.conectado = true;
    this.vigilar = setInterval(() => {
      if (this.ocupado && performance.now() - this.tUltimaLinea > 3000) this.emitir('aviso', 'Sin noticias del Mega hace 3 s');
    }, 1000);
    await this.enviar('?');
    this.emitir('conexion', true);
  }

  async desconectar() {
    clearInterval(this.vigilar);
    try { await this.enlace?.cerrar(); } catch {}
    this.enlace = null;
    this.conectado = false;
    for (const p of this.pendientes.values()) p.rechazar(new Error('desconectado'));
    this.pendientes.clear();
    this.estado.letra = '-';
    this.emitir('conexion', false);
    this.emitir('estado', this.estado);
  }

  perdido(motivo) {
    this.emitir('aviso', motivo);
    this.desconectar();
  }

  // Una orden a la vez: la siguiente sale cuando llega "ok"/"err" de la anterior (el UART del Mega tiene 64 bytes).
  enviar(orden) {
    const tarea = this.cola.then(() => this.enviarYa(orden));
    this.cola = tarea.catch(() => {});
    return tarea;
  }

  enviarYa(orden) {
    if (!this.enlace) return Promise.reject(new Error('sin conexión'));
    const id = this.sigId++;
    this.ocupado = true;
    this.emitir('ocupado', orden);
    this.emitir('log', { tipo: 'tx', texto: orden });
    return new Promise((resolver, rechazar) => {
      this.pendientes.set(id, { resolver, rechazar, orden });
      this.enlace.escribir(`#${id} ${orden}\n`).catch(rechazar);
    }).finally(() => { if (!this.pendientes.size) { this.ocupado = false; this.emitir('ocupado', null); } });
  }

  // "!" no espera turno: el firmware lo lee aunque esté en medio de un movimiento.
  async paro() {
    await this.enlace?.escribir('!');
    this.emitir('log', { tipo: 'tx', texto: '! (PARO)' });
  }

  linea(l) {
    this.tUltimaLinea = performance.now();
    const t = l.trim().split(/\s+/);
    switch (t[0]) {
      case 'S': {
        const e = this.estado;
        e.letra = t[1];
        e.q = t.slice(2, 6).map(Number);
        e.herr = t[6]; e.pluma = +t[7]; e.iman = +t[8]; e.metal = +t[9]; e.v12 = +t[10];
        e.finales = [...(t[11] ?? '0000')].map(Number);
        if (e.letra !== 'M') this.homeVisto = 'RH'.includes(e.letra);
        this.emitir('estado', e);
        return;
      }
      case 'I': {
        const info = { version: t[2] };
        for (let i = 3; i < t.length; i++) if (/^[A-Z][A-Z0-9]*$/.test(t[i])) {
          const v = [];
          while (i + 1 < t.length && !/^[A-Z][A-Z0-9]*$/.test(t[i + 1])) v.push(Number(t[++i]));
          info[t[i - v.length]] = v.length === 1 ? v[0] : v;
        }
        this.info = info;
        if (info.CAIDA) GEO.CAIDA = info.CAIDA;
        if (info.DISCO) GEO.DISCO = info.DISCO;
        this.emitir('log', { tipo: 'rx', texto: l });
        this.alIdentificar?.();
        this.emitir('info', info);
        return;
      }
      case 'C':
        if (t[1] === 'pt') { this.puntos[+t[2] - 1] = { x: +t[3], y: +t[4], h: +t[5] }; this.emitir('puntos', this.puntos); }
        else if (t[1] === 'npuntos') { this.puntos.length = +t[2]; this.metal.length = +t[2]; this.emitir('puntos', this.puntos); }
        else { this.cfg[t[1]] = Number(t[2]); this.emitir('cfg', this.cfg); }
        return;
      case 'E':
        if (t[1] === 'METAL') { this.metal[+t[2] - 1] = t[3] === '1'; this.emitir('puntos', this.puntos); }
        this.emitir('evento', t.slice(1));
        this.emitir('log', { tipo: t[1] === 'PARO' ? 'err' : 'ev', texto: l.slice(2) });
        return;
      case 'L':
        this.emitir('log', { tipo: 'rx', texto: l.slice(2) });
        return;
      case 'ok':
      case 'err': {
        const id = Number(t[1]);
        const p = this.pendientes.get(id);
        if (!p) { if (t[0] === 'err') this.emitir('log', { tipo: 'err', texto: l }); return; }
        this.pendientes.delete(id);
        if (t[0] === 'ok') { this.emitir('log', { tipo: 'ok', texto: `${p.orden} ✓` }); p.resolver(true); }
        else { const m = t.slice(2).join(' '); this.emitir('log', { tipo: 'err', texto: `${p.orden}: ${m}` }); p.rechazar(new Error(m)); }
        return;
      }
      default:
        this.emitir('log', { tipo: 'rx', texto: l });
    }
  }
}
