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
    // Sin this.cerrando, al cancelar el lector el bucle pedía otro readable al instante y giraba
    // en microtareas sin ceder nunca: la página se congelaba ("La página no responde").
    while (!this.cerrando && this.puerto?.readable) {
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
        if (!this.cerrando) this.alCaer?.(e);
        break;
      } finally {
        this.lector.releaseLock();
      }
    }
  }
  onLinea(cb) { this.cb = cb; }
  async escribir(texto) { await this.salida.write(new TextEncoder().encode(texto)); }
  async cerrar() {
    this.cerrando = true;
    try { await this.lector?.cancel(); } catch {}
    try { await this.leyendo; } catch {}
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

const ESTADOS = { R: 'Listo', H: 'Listo (home manual)', N: 'Sin home', M: 'Moviendo', L: 'Motores sueltos', P: 'PARO', T: 'Prueba NEMA' };

// firmware/prueba_nema: no habla el protocolo v3. Se reconoce por su primera línea y solo acepta
// líneas de dígitos 1-4 (o "t"): cada dígito mueve ese motor media vuelta y lo regresa.
const BANNER_NEMA = /^1 X \| 2 Y \| 3 Z/;
export const ORDEN_NEMA = /^(t|[1-4]{1,4}|[+-][1-4]( \d+)?|x[1-4]|[sclp])$/;

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
    this.modo = 'v3';
    const listo = new Promise(res => { this.alIdentificar = res; });
    await enlace.abrir();
    // El Mega real se reinicia al abrir el puerto: espera su identificación (o la pide si no llega).
    const t = setTimeout(() => this.enlace?.escribir('?\n'), 2500);
    let tMax;
    try {
      this.modo = await Promise.race([listo, new Promise((_, rej) => { tMax = setTimeout(() => rej(new Error('el Mega no respondió (¿firmware v3 o prueba_nema cargado?)')), 6000); })]);
    } finally {
      clearTimeout(t); clearTimeout(tMax);
      this.alIdentificar = null;
    }
    this.conectado = true;
    if (this.modo === 'nema') {
      this.estado.letra = 'T';
      this.estado.q = [0, 0, 0, GEO.ZMAX];   // el Mega se reinició: sus contadores arrancan en cero
      this.emitir('log', { tipo: 'ev', texto: 'Modo PRUEBA NEMA (firmware prueba_nema): usa las teclas de la terminal o escribe 1, 2, 3, 4, 12, 123, t. Cada prueba da media vuelta y regresa. Este firmware no tiene PARO: para cortar, quita los 12 V.' });
      this.emitir('conexion', true);
      this.emitir('estado', this.estado);
      return;
    }
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
    this.modo = 'v3';
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
    if (this.modo === 'nema') return this.enviarNema(orden);
    const id = this.sigId++;
    this.ocupado = true;
    this.emitir('ocupado', orden);
    this.emitir('log', { tipo: 'tx', texto: orden });
    return new Promise((resolver, rechazar) => {
      this.pendientes.set(id, { resolver, rechazar, orden });
      this.enlace.escribir(`#${id} ${orden}\n`).catch(rechazar);
    }).finally(() => { if (!this.pendientes.size) { this.ocupado = false; this.emitir('ocupado', null); } });
  }

  // prueba_nema no contesta "ok": la línea sale tal cual. Cualquier otra orden se bloquea, porque sus
  // dígitos (p. ej. el 1 de "J 1 1.00") moverían motores en este firmware.
  async enviarNema(orden) {
    orden = orden.trim();
    if (!ORDEN_NEMA.test(orden)) {
      this.emitir('log', { tipo: 'err', texto: `${orden}: en PRUEBA NEMA solo 1, 2, 3, 4, sus combinaciones (12, 123, 1234) o t` });
      throw new Error('orden no válida en prueba_nema');
    }
    this.emitir('log', { tipo: 'tx', texto: orden });
    await this.enlace.escribir(orden + '\n');
    return true;
  }

  // Jog de prueba_nema: la orden se repite cada 150 ms mientras se mantiene el botón; va sin cola ni log.
  nemaCrudo(texto) {
    if (this.modo === 'nema' && this.enlace) this.enlace.escribir(texto + '\n').catch(() => {});
  }

  // "!" no espera turno: el firmware lo lee aunque esté en medio de un movimiento.
  async paro() {
    if (this.modo === 'nema') {
      await this.enlace?.escribir('!');
      this.emitir('log', { tipo: 'err', texto: this.nemaJog ? '! (PARO del jog). Una prueba de ½ vuelta en curso no se detiene: para eso quita los 12 V.' : 'Este prueba_nema no tiene PARO: quita los 12 V para cortar los motores.' });
      return;
    }
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
        this.alIdentificar?.('v3');
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
      case 'P':
        // prueba_nema: grados de J1-J3 y mm de Z contados desde que arrancó (no hay home)
        if (this.modo === 'nema' || this.alIdentificar) {
          this.nemaPos = t.slice(1, 5).map(Number);
          this.estado.q = [...this.nemaPos.slice(0, 3), GEO.ZMAX + this.nemaPos[3]];
          this.emitir('estado', this.estado);
          return;
        }
        this.emitir('log', { tipo: 'rx', texto: l });
        return;
      case 'JOG':
        this.nemaJog = true;
        this.emitir('nemajog', true);
        this.emitir('log', { tipo: 'rx', texto: l });
        return;
      default:
        if (BANNER_NEMA.test(l)) { this.nemaJog = false; this.nemaPos = [0, 0, 0, 0]; this.alIdentificar?.('nema'); }
        this.emitir('log', { tipo: 'rx', texto: l });
    }
  }
}
