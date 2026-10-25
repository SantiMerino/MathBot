// Vista superior de la mesa (marco de J1, mm). Rueda = zoom, arrastre = mover, clic = acción de la pestaña activa.
import { GEO, HERR, fk, alcance, bandeja } from './geometria.js';

export class Vista2D {
  constructor(canvas, app) {
    this.cv = canvas;
    // Lienzo en CPU: acelerado en la GPU ocupaba ≈80 MB de búferes; como solo se redibuja cuando algo cambia,
    // en CPU sale ≈30 MB más barato y igual de rápido.
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.app = app;
    this.esc = 1.2;
    this.centro = [130, 0];
    this.cursor = null;
    const ro = new ResizeObserver(() => this.redimensionar());
    ro.observe(canvas.parentElement);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const m = this.aMundo(e.offsetX, e.offsetY);
      this.esc = Math.min(6, Math.max(0.4, this.esc * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      const m2 = this.aMundo(e.offsetX, e.offsetY);
      this.centro[0] += m[0] - m2[0]; this.centro[1] += m[1] - m2[1];
      this.app.marcar();
    }, { passive: false });
    let arrastre = null;
    canvas.addEventListener('pointerdown', e => { arrastre = { x: e.offsetX, y: e.offsetY, c: [...this.centro], movio: false }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!(this.w > 0) || !Number.isFinite(e.offsetX)) return;   // todavía sin medir, o evento sintético sin posición
      this.cursor = this.aMundo(e.offsetX, e.offsetY);
      if (arrastre) {
        const dx = e.offsetX - arrastre.x, dy = e.offsetY - arrastre.y;
        if (Math.hypot(dx, dy) > 4) arrastre.movio = true;
        if (arrastre.movio) { this.centro = [arrastre.c[0] - dx / this.esc, arrastre.c[1] + dy / this.esc]; }
      }
      this.app.marcar();
      this.app.cursorMesa?.(this.cursor);
    });
    canvas.addEventListener('pointerup', e => {
      if (arrastre && !arrastre.movio) this.app.clicMesa?.(this.aMundo(e.offsetX, e.offsetY));
      arrastre = null;
    });
    canvas.addEventListener('pointerleave', () => { this.cursor = null; this.app.marcar(); });
  }

  redimensionar() {
    const r = this.cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.w = r.width; this.h = r.height;
    this.cv.width = r.width * dpr; this.cv.height = r.height * dpr;
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.ajustado && r.width > 0 && r.height > 0) { this.esc = Math.min(r.width / 620, r.height / 680); this.ajustado = true; }
    this.app.marcar();
  }

  aPantalla([x, y]) { return [this.w / 2 + (x - this.centro[0]) * this.esc, this.h / 2 - (y - this.centro[1]) * this.esc]; }
  aMundo(px, py) { return [this.centro[0] + (px - this.w / 2) / this.esc, this.centro[1] - (py - this.h / 2) / this.esc]; }

  caja(b, relleno, borde, texto) {
    const c = this.ctx, a = this.aPantalla([b.x0, b.y1]), z = this.aPantalla([b.x1, b.y0]);
    c.fillStyle = relleno; c.strokeStyle = borde; c.lineWidth = 1;
    c.fillRect(a[0], a[1], z[0] - a[0], z[1] - a[1]); c.strokeRect(a[0], a[1], z[0] - a[0], z[1] - a[1]);
    if (texto) { c.fillStyle = borde; c.font = '11px "Share Tech Mono", monospace'; c.fillText(texto.toUpperCase(), a[0] + 4, a[1] + 13); }
  }

  dibujar() {
    if (!(this.w > 0 && this.h > 0 && this.esc > 0)) return;   // sin tamaño la cuadrícula no termina nunca
    const c = this.ctx, app = this.app, cfg = app.robot.cfg, est = app.robot.estado, css = app.colores;
    c.clearRect(0, 0, this.w, this.h);
    // cuadrícula cada 50 mm
    c.lineWidth = 1;
    const a = this.aMundo(0, this.h), b = this.aMundo(this.w, 0);
    for (let x = Math.ceil(a[0] / 50) * 50; x <= b[0]; x += 50) { const p = this.aPantalla([x, 0]); c.strokeStyle = x === 0 ? css.eje : css.rejilla; c.beginPath(); c.moveTo(p[0], 0); c.lineTo(p[0], this.h); c.stroke(); }
    for (let y = Math.ceil(a[1] / 50) * 50; y <= b[1]; y += 50) { const p = this.aPantalla([0, y]); c.strokeStyle = y === 0 ? css.eje : css.rejilla; c.beginPath(); c.moveTo(0, p[1]); c.lineTo(this.w, p[1]); c.stroke(); }
    // alcance de la herramienta activa
    const al = alcance(est.herr || 'p', cfg), o = this.aPantalla([0, 0]);
    c.beginPath(); c.arc(o[0], o[1], al.rmax * this.esc, 0, Math.PI * 2); c.arc(o[0], o[1], al.rmin * this.esc, 0, Math.PI * 2, true);
    c.fillStyle = css.alcance; c.fill();
    // obstáculos
    this.caja(GEO.BASE, css.obst, css.obstBorde, 'Base');
    this.caja(GEO.CAJA, css.obst, css.obstBorde, 'Mega');
    this.caja(bandeja(cfg), css.bandeja, css.bandejaBorde, `Bandeja (${cfg.binh} mm)`);
    // piezas del mundo virtual
    for (const ob of app.mundo?.objetos ?? []) {
      const p = this.aPantalla([ob.x, ob.y]);
      c.beginPath(); c.arc(p[0], p[1], ob.r * this.esc, 0, Math.PI * 2);
      c.fillStyle = ob.color + 'cc'; c.fill(); c.strokeStyle = ob.metal ? '#555' : '#8a6d3b'; c.stroke();
    }
    // tinta
    c.strokeStyle = css.tinta; c.lineWidth = Math.max(1, 0.8 * this.esc); c.lineJoin = 'round';
    for (const t of app.mundo?.tinta ?? []) {
      if (t.length < 2) continue;
      c.beginPath(); t.forEach((q, i) => { const p = this.aPantalla(q); i ? c.lineTo(...p) : c.moveTo(...p); }); c.stroke();
    }
    // vista previa de la rosa
    const rosa = app.rosaPrevia;
    if (rosa) {
      c.lineWidth = 1.5; c.setLineDash([6, 4]);
      c.strokeStyle = rosa.ok ? css.rosaOk : css.rosaMal;
      c.beginPath(); rosa.pts.forEach((q, i) => { const p = this.aPantalla(q); i ? c.lineTo(...p) : c.moveTo(...p); }); c.stroke();
      c.setLineDash([]);
      c.fillStyle = css.rosaMal;
      for (const q of rosa.malos.filter((_, i) => i % 4 === 0)) { const p = this.aPantalla(q); c.fillRect(p[0] - 2, p[1] - 2, 4, 4); }
      const m = this.aPantalla([cfg.rosax, cfg.rosay]);
      c.strokeStyle = rosa.ok ? css.rosaOk : css.rosaMal; c.beginPath(); c.moveTo(m[0] - 7, m[1]); c.lineTo(m[0] + 7, m[1]); c.moveTo(m[0], m[1] - 7); c.lineTo(m[0], m[1] + 7); c.stroke();
    }
    // puntos guardados
    app.robot.puntos.forEach((pt, i) => {
      const p = this.aPantalla([pt.x, pt.y]), metal = app.robot.metal[i];
      c.beginPath(); c.arc(p[0], p[1], 9, 0, Math.PI * 2);
      c.fillStyle = metal === true ? css.metal : metal === false ? css.noMetal : css.punto; c.fill();
      c.fillStyle = metal === true || metal === false ? '#0d0d0f' : css.puntoTxt; c.font = '12px "Share Tech Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(i + 1), p[0], p[1] + 0.5);
      c.textAlign = 'start'; c.textBaseline = 'alphabetic';
    });
    // brazo (posición estimada: la que reporta el Mega)
    if (app.robot.estado.letra !== '-') this.brazo(app.q ?? est.q, cfg, est.herr, css, 1);
    if (app.fantasma) this.brazo(app.fantasma, cfg, est.herr, css, 0.35);
    if (app.mundo?.choque) { const p = this.aPantalla([app.mundo.choque.x, app.mundo.choque.y]); c.strokeStyle = css.rosaMal; c.lineWidth = 3; c.beginPath(); c.arc(p[0], p[1], 14, 0, Math.PI * 2); c.stroke(); }
    // líneas del tubo de fósforo: un patrón de 3 px dentro del mismo lienzo (una capa CSS encima costaba ≈75 MB de GPU)
    if (!this.lineas) {
      const p = document.createElement('canvas'); p.width = 1; p.height = 3;
      const pc = p.getContext('2d'); pc.fillStyle = 'rgba(0,0,0,.16)'; pc.fillRect(0, 0, 1, 1);
      this.lineas = c.createPattern(p, 'repeat');
    }
    c.fillStyle = this.lineas; c.fillRect(0, 0, this.w, this.h);
    // cursor
    if (this.cursor) {
      c.fillStyle = css.texto; c.font = '12px "Share Tech Mono", monospace';
      c.fillText(`X ${this.cursor[0].toFixed(0)}  Y ${this.cursor[1].toFixed(0)} MM`, 12, this.h - 10);
    }
  }

  brazo(q, cfg, herr, css, alfa) {
    const c = this.ctx, f = fk(q, cfg), o = this.aPantalla([0, 0]), j2 = this.aPantalla(f.j2), j3 = this.aPantalla(f.j3);
    c.globalAlpha = alfa;
    c.lineCap = 'round';
    c.strokeStyle = css.brazo1; c.lineWidth = 34 * this.esc * 0.5; c.beginPath(); c.moveTo(...o); c.lineTo(...j2); c.stroke();
    c.strokeStyle = css.brazo2; c.lineWidth = 30 * this.esc * 0.5; c.beginPath(); c.moveTo(...j2); c.lineTo(...j3); c.stroke();
    if (cfg.cabezal) {
      c.strokeStyle = css.placa; c.lineWidth = 9 * this.esc;
      for (const k of 'pis') { const t = this.aPantalla(f.puntas[k]); c.beginPath(); c.moveTo(...j3); c.lineTo(...t); c.stroke(); }
      for (const k of 'pis') {
        const t = this.aPantalla(f.puntas[k]);
        c.beginPath(); c.arc(t[0], t[1], Math.max(4, (k === herr ? 8 : 6) * this.esc), 0, Math.PI * 2);
        c.fillStyle = HERR[k].color; c.fill();
        if (k === herr) { c.strokeStyle = css.texto; c.lineWidth = 2; c.stroke(); }
      }
    }
    for (const p of [o, j2, j3]) { c.beginPath(); c.arc(p[0], p[1], 4, 0, Math.PI * 2); c.fillStyle = css.texto; c.fill(); }
    c.globalAlpha = 1;
  }
}
