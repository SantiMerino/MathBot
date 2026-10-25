// Consola de operario de MathBot: une el robot (real por Web Serial o virtual), las vistas y los controles.
import { Robot, EnlaceSerial, EnlaceVirtual } from './robot.js';
import { MegaVirtual } from './virtual.js';
import { GEO, HERR, fk, comprobarRosa, zPlataforma } from './geometria.js';
import { Vista2D } from './vista2d.js';
import { COMANDOS } from './comandos.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const robot = new Robot();
const mega = new MegaVirtual();
const app = {
  robot, mundo: null, rosaPrevia: null, colores: {}, tab: 'mover', vista: 'mesa', clic: 'rosa',
  rosa: { rosax: 185, rosay: 0, rosaa: 180, vel: 25 },
};
window.mathbot = app;                       // para depurar desde la consola

// preferencias de esta pantalla (no del robot)
const pref = (k, def) => { try { return localStorage.getItem('mathbot.' + k) ?? def; } catch { return def; } };
const guardarPref = (k, v) => { try { localStorage.setItem('mathbot.' + k, v); } catch {} };

// ---------------------------------------------------------------- colores del lienzo (de las variables CSS)
function leerColores() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  Object.assign(app.colores, {
    rejilla: v('--rejilla'), eje: v('--eje'), alcance: v('--alcance'), obst: v('--obst'), obstBorde: v('--obst-borde'),
    bandeja: v('--bandeja'), bandejaBorde: v('--bandeja-borde'), punto: v('--punto'), puntoTxt: v('--punto-txt'), metal: v('--metal'),
    noMetal: v('--nometal'), rosaOk: v('--rosa-ok'), rosaMal: v('--rosa-mal'), tinta: v('--tinta'), brazo1: v('--brazo1'),
    brazo2: v('--brazo2'), placa: v('--placa-cab'), texto: v('--texto'),
  });
}
leerColores();

const v2d = new Vista2D($('#mesa'), app);
// alto del riel: el cajón de comandos se abre debajo, sin tapar el PARO
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--riel', e.target.offsetHeight + 'px')).observe($('.riel'));
let v3d = null;

// ---------------------------------------------------------------- piezas de la consola
// Perilla selectora: las etiquetas rodean la perilla y el puntero gira al detente elegido.
function selector(el, alElegir, local = true) {
  const botones = [...el.querySelectorAll('[role="radio"]')], n = botones.length;
  const arco = el.closest('.clic-mesa') ? 170 : n === 2 ? 80 : n === 3 ? 110 : 140;
  const angulos = botones.map((_, i) => n === 1 ? 0 : -arco / 2 + (arco * i) / (n - 1));
  const perilla = el.querySelector('.perilla');
  const colocar = () => {
    const w = el.clientWidth, h = el.clientHeight, tam = perilla.offsetWidth;
    const cx = w / 2, cy = h - 2 - tam / 2, r = tam / 2 + (tam > 40 ? 20 : 15);
    const rx = Math.max(r * 1.25, (w / 2 - 26) / Math.sin(arco * Math.PI / 360));   // las etiquetas usan el ancho del selector
    botones.forEach((b, i) => {
      const a = angulos[i] * Math.PI / 180;
      b.style.left = cx + rx * Math.sin(a) + 'px';
      b.style.top = cy - r * Math.cos(a) + 'px';
    });
  };
  colocar();
  new ResizeObserver(colocar).observe(el);
  const api = {
    valor: null,
    poner(v) {
      api.valor = v;
      botones.forEach((b, i) => {
        const on = b.dataset.v === String(v);
        b.setAttribute('aria-checked', on);
        b.tabIndex = on ? 0 : -1;
        if (on) perilla.style.setProperty('--rot', angulos[i] + 'deg');
      });
    },
  };
  const elegir = b => { if (b.disabled) return; if (local) api.poner(b.dataset.v); alElegir(b.dataset.v); };
  el.addEventListener('click', e => { const b = e.target.closest('[role="radio"]'); if (b) elegir(b); });
  el.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    const i = Math.max(0, botones.findIndex(b => b.dataset.v === String(api.valor)));
    const b = botones[(i + d + n) % n];
    elegir(b); b.focus();
  });
  return api;
}

// Palanca: aria-checked = posición de arriba.
const ponerPalanca = (el, on) => el.setAttribute('aria-checked', String(!!on));

// ---------------------------------------------------------------- terminal
function log(texto, tipo = 'rx') {
  const d = document.createElement('div');
  d.className = tipo;
  d.textContent = (tipo === 'tx' ? '› ' : '') + texto;
  const box = $('#log');
  box.appendChild(d);
  while (box.children.length > 300) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
}
robot.addEventListener('log', e => log(e.detail.texto, e.detail.tipo));
robot.addEventListener('aviso', e => log('AVISO: ' + e.detail, 'err'));

// ---------------------------------------------------------------- conexión
const swFuente = $('#swFuente');
ponerPalanca(swFuente, pref('fuente', 'virtual') === 'virtual');
function esVirtual() { return swFuente.getAttribute('aria-checked') === 'true'; }
const marcarFuente = () => document.body.classList.toggle('virtual', esVirtual());
marcarFuente();
swFuente.addEventListener('click', () => {
  ponerPalanca(swFuente, !esVirtual());
  guardarPref('fuente', esVirtual() ? 'virtual' : 'usb');
  marcarFuente();
});

$('#conectar').addEventListener('click', async () => {
  if (robot.conectado) { await robot.desconectar(); return; }
  try {
    let enlace;
    if (esVirtual()) enlace = new EnlaceVirtual(mega);
    else {
      if (!EnlaceSerial.disponible()) { log('Este navegador no tiene Web Serial: usa Chrome o Edge de escritorio, con la página servida desde localhost.', 'err'); return; }
      enlace = new EnlaceSerial();
      log('Al abrir el puerto el Mega se reinicia: pierde el home y Z baja un poco.', 'ev');
    }
    $('#conectar').disabled = true;
    await robot.conectar(enlace);
  } catch (e) {
    log('No se pudo conectar: ' + e.message, 'err');
    await robot.desconectar();
  } finally {
    $('#conectar').disabled = false;
  }
});

robot.addEventListener('conexion', e => {
  const on = e.detail;
  $('#conectar span').textContent = on ? 'DESCONECTAR' : 'CONECTAR';
  $('#conectar').classList.toggle('tecla-luz', !on);
  swFuente.disabled = on;
  app.mundo = on && esVirtual() ? mega.mundo : null;
  if (on) { cargarRosaDeCfg(); llenarAjustes(); }
  refrescar();
});

// ---------------------------------------------------------------- órdenes
async function orden(cmd) {
  try { await robot.enviar(cmd); return true; } catch { return false; }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cmd]');
  if (!b || b.disabled) return;
  const cmd = b.dataset.cmd;
  if ((cmd === 'D' || cmd === 'R') && app.rosaPrevia && !app.rosaPrevia.ok && !confirm('La vista previa de la rosa pasa por zonas en rojo. ¿Enviar igual?')) return;
  orden(cmd);
});
// palancas que mandan una orden: la posición la decide el estado que reporta el Mega
$$('.palanca[data-on]').forEach(p => p.addEventListener('click', () => {
  if (!p.disabled) orden(p.getAttribute('aria-checked') === 'true' ? p.dataset.off : p.dataset.on);
}));
$('#paro').addEventListener('click', () => robot.paro());
$('#manual').addEventListener('submit', e => {
  e.preventDefault();
  const t = $('#manualTxt').value.trim();
  if (!t) return;
  if (t === '!') robot.paro(); else orden(t);
  $('#manualTxt').value = '';
});

// ---------------------------------------------------------------- estado: anunciador, lecturas y controles
const COLOR_ESTADO = { R: 'verde', H: 'verde', N: 'ambar', M: 'cian', L: 'ambar', P: 'rojo' };
const lampara = (k, c) => { const l = $(`.lampara[data-l="${k}"]`); if (c) l.dataset.on = c; else delete l.dataset.on; };
const selHerr = selector($('#selHerr'), v => orden('T ' + v), false);

function refrescar() {
  const e = robot.estado, con = robot.conectado, L = e.letra;
  const ven = $('#estado');
  ven.textContent = con ? robot.textoEstado : 'DESCONECTADO';
  ven.dataset.c = con ? COLOR_ESTADO[L] ?? 'off' : 'off';
  lampara('home', con && (L === 'R' || L === 'H' || (L === 'M' && robot.conHome)) ? 'verde' : con && L !== 'P' ? 'ambar' : null);
  lampara('motores', con ? (L === 'L' ? 'ambar' : 'verde') : null);
  lampara('mov', con && (L === 'M' || robot.ocupado) ? 'cian' : null);
  lampara('metal', con && e.metal ? 'lila' : null);
  lampara('paro', con && L === 'P' ? 'rojo' : null);
  const bajo = con && e.v12 < 10.5;
  $('#v12').textContent = con ? e.v12.toFixed(1) : '--.-';
  $('#v12').parentElement.dataset.c = bajo ? 'ambar' : '';
  $$('.finales i').forEach((i, k) => i.classList.toggle('on', con && !!e.finales[k]));
  const led = $('#ledSensor');
  if (con && e.metal) led.dataset.on = 'lila'; else delete led.dataset.on;

  const quieto = con && !robot.ocupado;
  $$('.accion').forEach(b => { b.disabled = !quieto; });
  $$('#irBtn, #ptActual, #ptNuevo, #rosaAplicar, #fijarPapel, #binAplicar, #cfgEnviar, #fijarHome').forEach(b => { b.disabled = !quieto; });
  $$('#selHerr [role="radio"]').forEach(b => { b.disabled = !quieto; });
  $$('[data-jog]').forEach(b => { b.disabled = !con; });   // un botón deshabilitado no recibe el "soltar"
  $('#paro').disabled = !con;
  ponerPalanca($('#swMotores'), con && L !== 'L');
  ponerPalanca($('#swPluma'), con && e.pluma);
  ponerPalanca($('#swIman'), con && e.iman);
  selHerr.poner(con ? e.herr : null);
  if (!$('.tapa-caja').classList.contains('abierta')) $('#btnFabrica').disabled = true;

  // posición estimada (lo que el Mega contó)
  const cfg = robot.cfg, f = fk(e.q, cfg, e.pluma ? 0 : GEO.LEVANTE), t = f.puntas[e.herr] ?? f.puntas.p;
  const nom = ['J1', 'J2', 'J3', 'Z'], u = ['°', '°', '°', 'mm'];
  $('#lectura').innerHTML = e.q.map((v, i) => `<div class="eje"><small>${nom[i]}</small><div class="dig">${v.toFixed(i === 3 ? 1 : 2)}<i>${u[i]}</i></div></div>`).join('') +
    `<div class="punta">PUNTA ${(HERR[e.herr]?.nombre ?? 'Plumón').toUpperCase()} · <b>x ${t[0].toFixed(1)}</b> · <b>y ${t[1].toFixed(1)}</b> · <b>z ${t[2].toFixed(1)}</b> mm sobre la mesa</div>`;
  const vals = modoJog === 'art' ? e.q : t;
  $$('#jog .dig').forEach((d, i) => { d.textContent = (+vals[i]).toFixed(modoJog === 'art' && i < 3 ? 2 : 1); });
  $('#zmesaV').textContent = (+cfg.zmesa).toFixed(2) + ' mm';
}
robot.addEventListener('estado', refrescar);
robot.addEventListener('ocupado', e => {
  $('#ocupado').textContent = e.detail ? 'EJECUTANDO › ' + e.detail : '';
  refrescar();
});

// ---------------------------------------------------------------- gemelo / solo mando, stickers
function aplicarModo() {
  const gem = document.body.classList.contains('gemelo');
  $$('.mod').forEach(m => { m.hidden = gem && m.dataset.g !== app.tab; });
  if (!gem && app.vista !== 'mesa') cambiarVista('mesa');
}
const swGemelo = $('#swGemelo'), swStickers = $('#swStickers');
document.body.classList.toggle('gemelo', pref('gemelo', '1') === '1');
document.body.classList.toggle('sin-stickers', pref('stickers', '1') === '0');
ponerPalanca(swGemelo, document.body.classList.contains('gemelo'));
ponerPalanca(swStickers, !document.body.classList.contains('sin-stickers'));
swGemelo.addEventListener('click', () => {
  const on = document.body.classList.toggle('gemelo');
  ponerPalanca(swGemelo, on); guardarPref('gemelo', on ? '1' : '0'); aplicarModo();
});
swStickers.addEventListener('click', () => {
  const on = !document.body.classList.toggle('sin-stickers');
  ponerPalanca(swStickers, on); guardarPref('stickers', on ? '1' : '0');
});

// ---------------------------------------------------------------- vistas de la pantalla
async function cambiarVista(v) {
  app.vista = v;
  $$('#vistas button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  $('#lienzo2d').hidden = v !== 'mesa';
  $('#lienzo3d').hidden = v === 'mesa';
  $('#ctlDespiece').hidden = v !== 'cabezal';
  $('#ficha').hidden = true;
  $('.clic-mesa').style.visibility = v === 'mesa' ? '' : 'hidden';
  if (v !== 'mesa') {
    if (!v3d) {
      $('#lienzo3d').innerHTML = '<div class="carga">CARGANDO MALLAS…</div>';
      try {
        const { Vista3D } = await import('./vista3d.js');
        $('#lienzo3d').innerHTML = '';
        v3d = new Vista3D($('#lienzo3d'), app);
      } catch (err) {
        $('#lienzo3d').innerHTML = `<div class="carga">No se pudo cargar three.js (¿sin internet?): ${err.message}</div>`;
        return;
      }
    }
    v3d.visible = true;
    v3d.ponerModo(v);
  } else if (v3d) v3d.visible = false;
}
$('#vistas').addEventListener('click', e => { const b = e.target.closest('button'); if (b) cambiarVista(b.dataset.v); });
$('#fDespiece').addEventListener('input', e => v3d?.ponerDespiece(+e.target.value));
app.piezaElegida = p => {
  const f = $('#ficha');
  f.hidden = false;
  f.innerHTML = `<h4>${p.nombre}</h4>` + (p.impresa
    ? `<div>${p.material} · ${p.perimetros} perímetros · ${p.relleno} % relleno</div><div>${p.gramos} g · ${p.horas} h</div>
       <div class="tenue">STL/${p.archivo}.stl</div><div class="tenue">${p.nota}</div>`
    : '<div class="tenue">Pieza comprada (modelo de referencia)</div>');
};

function bucle() {
  if (app.vista === 'mesa') v2d.dibujar();
  else v3d?.actualizar(robot.estado, robot.cfg, app.mundo);
  requestAnimationFrame(bucle);
}
requestAnimationFrame(bucle);

// ---------------------------------------------------------------- secciones de la bahía
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  app.tab = b.dataset.t;
  $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  aplicarModo();
});

// clic en la mesa: qué hace lo elige la perilla del bisel
const PISTA = { ir: 'CLIC: LLEVAR LA HERRAMIENTA AHÍ (M)', punto: 'CLIC: AGREGAR UN PUNTO DE ESCANEO', rosa: 'CLIC: CENTRO DE LA ROSA' };
const selClic = selector($('#selClic'), v => { app.clic = v; guardarPref('clic', v); $('#pista').textContent = PISTA[v] ?? ''; });
app.clic = pref('clic', 'rosa'); selClic.poner(app.clic); $('#pista').textContent = PISTA[app.clic] ?? '';
app.clicMesa = ([x, y]) => {
  if (app.clic === 'ir' && robot.conectado && !robot.ocupado) orden(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
  else if (app.clic === 'punto') editarPunto(robot.puntos.length, { x, y, h: 0 });
  else if (app.clic === 'rosa') { app.rosa.rosax = Math.round(x); app.rosa.rosay = Math.round(y); rosaAInputs(); actualizarRosa(); }
};

// ---------------------------------------------------------------- jog (mantener presionado = repetir pasos)
let modoJog = 'art', pasoJog = 1;
const EJES = {
  art: [['J1', '1'], ['J2', '2'], ['J3', '3'], ['Z', '4']],
  xy: [['X', 'x'], ['Y', 'y'], ['Z', 'z']],
};
function armarJog() {
  $('#jog').innerHTML = EJES[modoJog].map(([n, e]) =>
    `<b>${n}</b><button class="tecla" data-jog="${e}" data-s="-1" aria-label="${n} menos">−</button><span class="dig"></span><button class="tecla" data-jog="${e}" data-s="1" aria-label="${n} más">+</button>`).join('');
  refrescar();
}
selector($('#selModoJog'), v => { modoJog = v; armarJog(); }).poner('art');
selector($('#selPaso'), v => { pasoJog = +v; }).poner('1');
armarJog();

let jogActivo = null;
async function jogLoop(eje, signo) {
  const id = Symbol();
  jogActivo = id;
  while (jogActivo === id && robot.conectado) {
    const ok = await orden(`J ${eje} ${(signo * pasoJog).toFixed(2)}`);
    if (!ok) break;
  }
}
const pararJog = () => { jogActivo = null; };
$('#jog').addEventListener('pointerdown', e => { const b = e.target.closest('[data-jog]'); if (b && !b.disabled) jogLoop(b.dataset.jog, +b.dataset.s); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(t => $('#jog').addEventListener(t, pararJog));
window.addEventListener('pointerup', pararJog);
window.addEventListener('blur', pararJog);
const TECLAS = { ArrowLeft: ['1', 'x', -1], ArrowRight: ['1', 'x', 1], ArrowUp: ['2', 'y', 1], ArrowDown: ['2', 'y', -1], PageUp: ['4', 'z', 1], PageDown: ['4', 'z', -1] };
const jogVisible = () => !$('#jog').closest('.mod').hidden;
document.addEventListener('keydown', e => {
  const t = TECLAS[e.key];
  if (!t || !jogVisible() || e.target.closest('input, [role="radiogroup"], dialog, .cajon') || e.repeat) return;
  e.preventDefault();
  jogLoop(modoJog === 'art' ? t[0] : t[1], t[2]);
});
document.addEventListener('keyup', e => { if (TECLAS[e.key]) pararJog(); });

$('#irBtn').addEventListener('click', () => orden(`M ${$('#irX').value} ${$('#irY').value}`));

// ---------------------------------------------------------------- teclado global: paro y menú de comandos
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); robot.paro(); return; }
  if (e.key === 'F1' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); alternarComandos(); }
});

// ---------------------------------------------------------------- menú de comandos
function pintarComandos(filtro = '') {
  const q = filtro.trim().toLowerCase();
  $('#listaCmd').innerHTML = COMANDOS.map(g => {
    const items = g.lista.filter(c => !q || (c.c + ' ' + c.d + ' ' + (c.n ?? '')).toLowerCase().includes(q));
    if (!items.length) return '';
    return `<h3>${g.grupo.toUpperCase()}</h3>` + items.map(c =>
      `<button class="cmd${c.peligro ? ' peligro' : ''}" data-plantilla="${c.plantilla}"><code>${c.c}</code><span>${c.d}</span>${c.n ? `<small>${c.n}</small>` : ''}</button>`).join('');
  }).join('') || '<p class="nota">Nada coincide.</p>';
}
function alternarComandos(abrir) {
  const c = $('#cajonComandos');
  c.hidden = abrir === undefined ? !c.hidden : !abrir;
  if (!c.hidden) { pintarComandos($('#filtroCmd').value); $('#filtroCmd').focus(); }
}
$('#abrirComandos').addEventListener('click', () => alternarComandos());
$('#abrirComandos2').addEventListener('click', () => alternarComandos(true));
$('#cerrarComandos').addEventListener('click', () => alternarComandos(false));
$('#filtroCmd').addEventListener('input', e => pintarComandos(e.target.value));
$('#listaCmd').addEventListener('click', e => {
  const b = e.target.closest('.cmd');
  if (!b) return;
  const inp = $('#manualTxt');
  inp.value = b.dataset.plantilla;
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
});
$('#sugerencias').innerHTML = COMANDOS.flatMap(g => g.lista).map(c => `<option value="${c.plantilla.trim()}">${c.d}</option>`).join('');

// ---------------------------------------------------------------- tapa de FÁBRICA
$('#tapaFabrica').addEventListener('click', () => {
  const caja = $('.tapa-caja'), btn = $('#btnFabrica');
  caja.classList.add('abierta');
  $('#tapaFabrica').setAttribute('aria-expanded', 'true');
  btn.disabled = !robot.conectado || robot.ocupado; btn.tabIndex = 0; btn.focus();
  clearTimeout(caja.cierre);
  caja.cierre = setTimeout(cerrarTapa, 6000);
});
function cerrarTapa() {
  const caja = $('.tapa-caja');
  caja.classList.remove('abierta');
  $('#tapaFabrica').setAttribute('aria-expanded', 'false');
  $('#btnFabrica').disabled = true; $('#btnFabrica').tabIndex = -1;
}
$('#btnFabrica').addEventListener('click', () => setTimeout(cerrarTapa, 300));

// ---------------------------------------------------------------- home a mano (panel no modal: el PARO sigue accesible)
$('#abrirManual').addEventListener('click', () => {
  const manos = $('#manos');
  manos.innerHTML = '';
  const rangos = [[-150, 150], [-150, 150], [-180, 180], [103.5, 203]];
  ['J1', 'J2', 'J3', 'Z'].forEach((n, i) => {
    const l = document.createElement('label');
    l.innerHTML = `${n} <input type="range" min="${rangos[i][0]}" max="${rangos[i][1]}" step="0.5" value="${mega.real[i]}"> <b>${mega.real[i].toFixed(1)}</b>`;
    const inp = l.querySelector('input'), val = l.querySelector('b');
    inp.addEventListener('input', () => {
      if (!mega.aMano(i, +inp.value)) { inp.value = mega.real[i]; log('Primero suelta los motores (O 0)', 'err'); return; }
      val.textContent = (+inp.value).toFixed(1);
    });
    manos.appendChild(l);
  });
  $('#dlgManual').show();
});
$('#fijarHome').addEventListener('click', async () => {
  if (await orden('O 1') && await orden('S')) $('#dlgManual').close();
});

// ---------------------------------------------------------------- puntos
function tablaPuntos() {
  const filas = robot.puntos.map((p, i) => {
    const m = robot.metal[i];
    return `<tr><td>${i + 1}</td><td>${p.x.toFixed(1)}</td><td>${p.y.toFixed(1)}</td><td>${p.h.toFixed(1)}</td>
      <td>${m === true ? '<span class="es-metal">METAL</span>' : m === false ? 'no' : '—'}</td>
      <td><button class="tecla mini accion" data-cmd="G ${i + 1}"><span>IR</span></button> <button class="tecla mini" data-edit="${i}"><span>EDITAR</span></button> <button class="tecla mini accion" data-cmd="PTB ${i + 1}"><span>BORRAR</span></button></td></tr>`;
  }).join('');
  $('#tablaPuntos').innerHTML = `<tr><th>#</th><th>X</th><th>Y</th><th>ALTO</th><th>SENSOR</th><th></th></tr>${filas || '<tr><td colspan="6" class="vacio">Sin puntos: lleva el sensor sobre una pieza y pulsa GUARDAR PUNTA, o elige PUNTO en la perilla de la pantalla y haz clic en la mesa.</td></tr>'}`;
  refrescar();
}
robot.addEventListener('puntos', tablaPuntos);
tablaPuntos();
$('#tablaPuntos').addEventListener('click', e => { const b = e.target.closest('[data-edit]'); if (b) editarPunto(+b.dataset.edit, robot.puntos[+b.dataset.edit]); });

function editarPunto(i, p) {
  if (i >= 12) { log('Caben 12 puntos', 'err'); return; }
  $('#dlgPuntoTit').textContent = `PUNTO ${i + 1}`;
  $('#ptx').value = p.x.toFixed(1); $('#pty').value = p.y.toFixed(1); $('#pth').value = p.h.toFixed(1);
  const dlg = $('#dlgPunto');
  dlg.onclose = () => { if (dlg.returnValue === 'ok' && robot.conectado) orden(`PT ${i + 1} ${$('#ptx').value} ${$('#pty').value} ${$('#pth').value}`); };
  dlg.returnValue = '';
  dlg.show();
  $('#ptx').focus();
}
$('#ptNuevo').addEventListener('click', () => {
  const t = fk(robot.estado.q, robot.cfg).puntas[robot.estado.herr] ?? [250, 0];
  editarPunto(robot.puntos.length, { x: t[0], y: t[1], h: 0 });
});
$('#ptActual').addEventListener('click', async () => {
  const n = robot.puntos.length + 1;
  if (await orden(`PT ${n}`)) editarPunto(n - 1, robot.puntos[n - 1]);
});

// ---------------------------------------------------------------- rosa
function cargarRosaDeCfg() {
  for (const k of ['rosax', 'rosay', 'rosaa', 'vel']) app.rosa[k] = +robot.cfg[k];
  rosaAInputs();
  actualizarRosa();
}
function rosaAInputs() {
  $('#rx').value = app.rosa.rosax; $('#ry').value = app.rosa.rosay; $('#ra').value = app.rosa.rosaa; $('#vel').value = app.rosa.vel;
  $('#raV').textContent = app.rosa.rosaa + '°';
  $('#velV').textContent = app.rosa.vel + ' mm/s';
}
function actualizarRosa() {
  const cfg = { ...robot.cfg, ...app.rosa };
  const r = comprobarRosa(cfg);
  app.rosaPrevia = r;
  const t = r.largo / app.rosa.vel;
  const enviada = ['rosax', 'rosay', 'rosaa', 'vel'].every(k => Math.abs(app.rosa[k] - robot.cfg[k]) < 1e-6);
  const box = $('#estadoRosa');
  box.className = 'estadoRosa ' + (r.ok ? 'ok' : 'mal');
  box.innerHTML = (r.ok ? `ALCANZABLE · ${r.largo.toFixed(0)} mm · ${t.toFixed(0)} s de trazo` : `NO LLEGA · ${r.malos.length} de ${r.pts.length} tramos fuera de alcance o sobre un obstáculo`) +
    (enviada ? '' : ' · <b>SIN ENVIAR</b>');
}
for (const [s, k] of [['#rx', 'rosax'], ['#ry', 'rosay'], ['#ra', 'rosaa'], ['#vel', 'vel']])
  $(s).addEventListener('input', e => {
    app.rosa[k] = +e.target.value;
    $('#raV').textContent = app.rosa.rosaa + '°'; $('#velV').textContent = app.rosa.vel + ' mm/s';
    actualizarRosa();
  });
robot.addEventListener('cfg', () => { actualizarRosa(); llenarAjustes(); });
$('#rosaAplicar').addEventListener('click', async () => {
  for (const k of ['rosax', 'rosay', 'rosaa']) if (!(await orden(`CFG ${k} ${app.rosa[k]}`))) return;
  await orden(`V ${app.rosa.vel}`);
  await orden('CFG');
});
$('#fijarPapel').addEventListener('click', async () => {
  const e = robot.estado;
  if (e.herr !== 'p' || !e.pluma) { log('Primero: herramienta plumón y plumón abajo, punta tocando la hoja', 'err'); return; }
  const zmesa = e.q[3] - zPlataforma(0, 'p', { ...robot.cfg, zmesa: 0 });
  if (await orden(`CFG zmesa ${zmesa.toFixed(2)}`)) orden('CFG');
});
rosaAInputs();
actualizarRosa();

// ---------------------------------------------------------------- misión
robot.addEventListener('evento', e => {
  const [tipo, ...r] = e.detail;
  const lamparaPaso = (li, c) => { const l = li.querySelector('.lampara'); if (c) l.dataset.on = c; else delete l.dataset.on; };
  if (tipo === 'FASE') {
    $('#resumenMision').textContent = '';
    let pasada = true;
    $$('#pasos li').forEach(li => {
      if (li.dataset.f === r[0]) { li.className = 'activa'; lamparaPaso(li, 'cian'); pasada = false; }
      else { li.className = pasada ? 'hecha' : ''; lamparaPaso(li, pasada ? 'verde' : null); }
    });
  }
  if (tipo === 'FIN') { $$('#pasos li').forEach(li => { li.className = 'hecha'; lamparaPaso(li, 'verde'); }); $('#resumenMision').textContent = `FIN · ${r[0]} s`; }
  if (tipo === 'PARO') $$('#pasos li').forEach(li => { if (li.className === 'activa') lamparaPaso(li, 'rojo'); li.className = ''; });
  if (tipo === 'DERIVA') log(`Comprobación de pasos: ${r[0]} difería ${r[1]} del final de carrera${Math.abs(+r[1]) > 1 ? ' (se perdieron pasos)' : ''}`, Math.abs(+r[1]) > 1 ? 'err' : 'ok');
});
$('#binAplicar').addEventListener('click', async () => {
  for (const [s, k] of [['#bx', 'binx'], ['#by', 'biny'], ['#bh', 'binh']]) if (!(await orden(`CFG ${k} ${$(s).value}`))) return;
  orden('CFG');
});
selector($('#selVel'), v => { mega.vel = +v; }).poner('1');
$('#reiniciarMesa').addEventListener('click', () => mega.reiniciarMesa());

// ---------------------------------------------------------------- ajustes
const ETIQUETAS = {
  home1: 'Final J1 (°)', home2: 'Final J2 (°)', home3: 'Final J3 (°)', home4: 'Final Z (mm)', zmesa: 'Altura papel (mm)',
  servoup: 'Servo arriba (°)', servodn: 'Servo abajo (°)', vel: 'Trazo (mm/s)', inv: 'Invertir ejes (bits)',
  finales: 'Hay finales (0/1)', cabezal: 'Cabezal puesto (0/1)',
};
function llenarAjustes() {
  $('#ajustes').innerHTML = Object.entries(ETIQUETAS).map(([k, n]) =>
    `<label><span>${n.toUpperCase()}</span><input type="number" step="any" data-k="${k}" value="${robot.cfg[k]}"></label>`).join('');
  $('#bx').value = robot.cfg.binx; $('#by').value = robot.cfg.biny; $('#bh').value = robot.cfg.binh;
  const i = robot.info;
  $('#infoFirmware').textContent = i ? `FIRMWARE ${i.version} · L1 ${i.L1} · L2 ${i.L2} · CAÍDA ${i.CAIDA} · DISCO ${i.DISCO} · J3 ${i.J3?.join(' … ')}° · Z MÍN ${i.ZMIN} mm` : 'Conecta para leer el firmware.';
  refrescar();
}
$('#cfgEnviar').addEventListener('click', async () => {
  for (const inp of $$('#ajustes input')) {
    const k = inp.dataset.k;
    if (+inp.value !== +robot.cfg[k] && !(await orden(`CFG ${k} ${inp.value}`))) return;
  }
  orden('CFG');
});

llenarAjustes();
aplicarModo();
refrescar();
