// Arranque del Museo Interactivo: cámara -> manos -> vestíbulo -> salas.

import { abrirCamara, cerrarCamara } from './camara.js';
import { DetectorManos, SeguidorManos } from './manos.js';
import { Entrada, Permanencia } from './entrada.js';
import { Fichas } from './fichas.js';
import { sonido, ponerVolumen } from './sonido.js';
import { cargarConfig, guardarConfig } from './config.js';
import { Vestibulo } from './vestibulo.js';
import { Ajustes, pantallaCompleta } from './ajustes.js';
import { SALAS } from './salas/registro.js';
import { salaPrueba } from './salas/prueba.js';
import { crearMapeo } from './calibracion/modelo.js';
import { calibrar, verificar } from './calibracion/asistente.js';
import { crearControl } from './control.js';
import { iniciarActualizaciones } from './actualizaciones.js';
import { narrar, callar } from './narrador.js';
import { Retos } from './retos.js';
import { estadisticas } from './estadisticas.js';

const ui = document.getElementById('ui');
const escena = document.getElementById('escena');
const avisoEl = document.getElementById('aviso');
const guardaVideo = document.createElement('div');
guardaVideo.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;overflow:hidden';
document.body.appendChild(guardaVideo);

const app = {
  config: null,
  cam: null,
  detector: new DetectorManos(),
  seguidor: new SeguidorManos(),
  entrada: new Entrada(document.getElementById('capa')),
  fichas: new Fichas(document.getElementById('fichas')),
  modo: null,
  vista: null, // vestíbulo o ajustes
  sala: null,
  salaDef: null,
  ultimosPuntos: [],
  ultimaMano: performance.now(),
  control: null, // control de la cámara (ver control.js)
  actualizaciones: null,
  retos: null,
  estadisticas,

  mapear: crearMapeo(null),
  actualizarMapeo() { this.mapear = crearMapeo(this.config); this.seguidor.vaciar(); },
  guardar() { guardarConfig(this.config); },
  ponerVolumen(v) { this.config.volumen = v; ponerVolumen(v); this.guardar(); },

  limpiar() {
    this.vista?.destruir();
    this.vista = null;
    try { this.sala?.destruir?.(); } catch (e) { console.error(e); }
    this.sala = null;
    this.salaDef = null;
    escena.innerHTML = '';
    this.fichas.vaciar();
    this.retos?.terminar();
    callar();
    estadisticas.salir();
    botonVolver.ocultar();
  },

  irVestibulo() {
    const venia = this.modo === 'sala';
    this.limpiar();
    this.modo = 'vestibulo';
    this.vista = new Vestibulo(ui, SALAS, (id) => this.irSala(id));
    if (venia) sonido.volver();
  },

  async irSala(id, def = SALAS.find((s) => s.id === id)) {
    if (!def) return;
    this.limpiar();
    this.modo = 'sala';
    this.salaDef = def;
    try {
      this.sala = await def.crear({ contenedor: escena, fichas: this.fichas, sonido, entrada: this.entrada, app: this, opciones: this.opcionesSala || {} });
      this.opcionesSala = null;
    } catch (e) {
      console.error(e);
      avisar(`La sala «${def.titulo}» no pudo abrirse.`);
      return this.irVestibulo();
    }
    botonVolver.mostrar();
    this.ultimaMano = performance.now();
    sonido.entrar();
    if (def.id !== 'prueba') {
      estadisticas.entrar(def.id);
      this.retos.activo = this.config.retos !== false;
      this.retos.iniciar(def);
      setTimeout(() => { if (this.salaDef === def && this.config.voz !== false) this.retos.anunciar(); }, 1400);
    }
  },

  irAjustes() {
    this.limpiar();
    this.modo = 'ajustes';
    this.vista = new Ajustes(ui, this);
  },

  probarCalibracion(afinar = false) {
    this.opcionesSala = { afinar };
    this.irSala('prueba', salaPrueba);
  },

  devolverVideo() {
    if (!this.cam) return;
    guardaVideo.appendChild(this.cam.video);
    this.cam.video.play().catch(() => {});
  },

  async cambiarCamara(deviceId) {
    this.config.camaraId = deviceId;
    this.config.ptz = null;
    this.guardar();
    await encenderCamara();
    await prepararControl();
    if (this.modo === 'ajustes') this.irAjustes();
  },
};

// Lo que pasa cada vez que aparece una ficha nueva: se lee en voz alta y se
// revisa si resolvía el reto de la sala.
app.retos = new Retos(ui, sonido);
app.fichas.alMostrar = (clave, info) => {
  if (app.config?.voz !== false) narrar(clave, info);
  if (app.modo === 'sala' && app.salaDef && app.retos.tocado(clave)) estadisticas.reto(app.salaDef.id);
};

// Control de la cámara: modo museo (sin seguimiento) y posición guardada
async function prepararControl() {
  try {
    app.control = await crearControl(app);
    if (app.control.hid || app.control.agente) await app.control.fijar();
    const pos = app.config.posicionCamara;
    if (pos && app.control.ptz) await app.control.ptz.poner(pos);
  } catch (e) {
    console.warn('Sin control de la cámara', e);
  }
}
window.museo = app; // para revisar desde la consola

// ---------- Botón "volver a las salas" (se activa dejando la mano 2 s)
const botonVolver = (() => {
  const el = document.createElement('div');
  el.className = 'volver';
  el.innerHTML = '<span>🏛️</span><small>Salas</small>';
  el.hidden = true;
  el.addEventListener('click', () => app.irVestibulo());
  ui.appendChild(el);
  const permanencia = new Permanencia(2);
  return {
    mostrar() { el.hidden = false; permanencia.reiniciar(); },
    ocultar() { el.hidden = true; },
    actualizar(dt, manos) {
      if (el.hidden) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width * 0.7;
      const zona = { id: 'volver', contiene: (x, y) => Math.hypot(x - cx, y - cy) < rad };
      if (permanencia.actualizar(manos, [zona], dt, app.entrada)) app.irVestibulo();
      el.style.setProperty('--progreso', permanencia.progreso('volver').toFixed(3));
    },
  };
})();

// ---------- Avisos
let avisoTemporizador = null;
function avisar(texto, ms = 5000) {
  avisoEl.textContent = texto;
  avisoEl.hidden = false;
  clearTimeout(avisoTemporizador);
  if (ms) avisoTemporizador = setTimeout(() => { avisoEl.hidden = true; }, ms);
}

// ---------- Cámara
let reintento = null;
async function encenderCamara() {
  cerrarCamara(app.cam);
  app.cam = null;
  try {
    app.cam = await abrirCamara(app.config);
    guardaVideo.appendChild(app.cam.video);
    if (!app.cam.esPixy) avisar(`Usando la cámara «${app.cam.etiqueta}». Conecta la EMEET PIXY para el museo.`, 7000);
    app.cam.track.addEventListener('ended', () => {
      avisar('Se desconectó la cámara. Reconectando…', 0);
      programarReintento();
    });
  } catch (e) {
    console.warn(e);
    avisar('No pude abrir la cámara: ' + (e.message || e.name) + '. Puedes usar el ratón mientras tanto.', 8000);
    programarReintento();
  }
}
function programarReintento() {
  clearTimeout(reintento);
  reintento = setTimeout(async () => {
    await encenderCamara();
    if (app.cam) avisar('Cámara conectada de nuevo.', 3000);
  }, 3000);
}

// ---------- Bucle principal
let anterior = performance.now();
function cuadro(ahora) {
  const dt = Math.min(0.1, (ahora - anterior) / 1000);
  anterior = ahora;

  // Pase lo que pase en este cuadro, el siguiente se pide igual: el museo nunca se congela.
  requestAnimationFrame(cuadro);

  try {
    if (app.cam && app.detector.detector) {
      const puntos = app.detector.detectar(app.cam.video, ahora);
      if (puntos) {
        app.ultimosPuntos = puntos;
        app.entrada.camara = app.seguidor.actualizar(puntos, app.mapear, innerWidth, innerHeight, ahora);
      }
    }
  } catch (e) {
    console.error(e);
    app.entrada.camara = [];
  }
  const manos = app.entrada.manos(ahora);
  if (manos.length) app.ultimaMano = ahora;

  try {
    if (app.modo === 'vestibulo') app.vista.actualizar(dt, manos, app.entrada);
    else if (app.modo === 'ajustes') app.vista.actualizar(dt, manos);
    else if (app.modo === 'sala' && app.sala) {
      app.sala.actualizar(dt, manos, ahora);
      botonVolver.actualizar(dt, manos);
      if (ahora - app.ultimaMano > app.config.esperaSegundos * 1000) app.irVestibulo();
    }
  } catch (e) {
    console.error(e);
    avisar('Algo falló en esta sala; vuelvo al vestíbulo.');
    app.irVestibulo();
  }

  app.entrada.dibujar(manos, ahora);
  app.fichas.limpiar();
}

// ---------- Teclado (para el encargado)
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') app.irVestibulo();
  else if (e.key === 'a' || e.key === 'A') app.modo === 'ajustes' ? app.irVestibulo() : app.irAjustes();
  else if (e.key === 'f' || e.key === 'F') pantallaCompleta();
  else if (/^[1-9]$/.test(e.key) && SALAS[+e.key - 1]) app.irSala(SALAS[+e.key - 1].id);
});
addEventListener('pointerdown', () => sonido.activar(), { once: true });

// Que la computadora no apague la pantalla ni se duerma mientras el museo está abierto
async function mantenerPantalla() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen'); } catch (e) { /* sin permiso */ }
}
document.addEventListener('visibilitychange', mantenerPantalla);
mantenerPantalla();
addEventListener('resize', () => app.sala?.redimensionar?.());

// ---------- Revisión de la calibración al encender
// Si alguien movió la cámara, el proyector o la mesa, el museo lo nota y
// vuelve a calibrar solo. Si hay manos en la mesa, no revisa (no sería fiable).
async function revisarAlEncender() {
  await new Promise((r) => setTimeout(r, 2500)); // que el detector vea si hay manos
  if (app.entrada.camara.length) {
    avisar('No revisé la calibración porque había manos en la mesa.', 6000);
    return;
  }
  try {
    const r = await verificar(app);
    if (!r.visto) {
      avisar('No pude revisar la calibración: la cámara no ve la luz del proyector.', 8000);
    } else if (r.nota.ok && r.error.medio < 0.015) {
      avisar(`Calibración revisada: ${r.nota.nota.toLowerCase()}.`, 3500);
    } else {
      avisar('Algo se movió: vuelvo a calibrar (no toques la mesa)…', 0);
      const c = await calibrar(app);
      if (c.nota.ok) {
        app.config.mapa = { ...c.mapa, dedo: null };
        app.config.homografia = c.mapa.h;
        app.config.calibracion = { fecha: new Date().toISOString(), tipo: 'automática', error: c.error?.medio, maximo: c.error?.maximo, nota: c.nota.nota, ok: true, px: c.nota.px, vistos: c.vistos, total: c.total, descartados: c.descartados, controles: c.controles };
        app.actualizarMapeo();
        app.guardar();
        avisar(`Listo: calibración repetida (${c.nota.nota.toLowerCase()}). Si quieres más precisión, afina con el dedo en Ajustes.`, 8000);
      } else {
        avisar('La calibración salió mal. Pulsa A y revisa la cámara.', 0);
      }
    }
  } catch (e) {
    console.warn(e);
    avisar('No pude revisar la calibración: ' + e.message, 8000);
  }
}

// ---------- Arranque
(async function iniciar() {
  app.config = await cargarConfig();
  app.actualizarMapeo();
  ponerVolumen(app.config.volumen);
  sonido.activar();
  const parametros = new URLSearchParams(location.search);
  const sinCamara = parametros.has('sincamara') || parametros.has('simular');
  app.irVestibulo();
  requestAnimationFrame(cuadro);
  if (parametros.has('simular')) {
    // Pruebas automáticas: cámara simulada y nada se guarda en la configuración real
    const sim = await import('../pruebas/simulador.js');
    sim.simularServidor();
    const video = document.createElement('video');
    video.muted = true;
    guardaVideo.appendChild(video);
    await sim.iniciarSimulador(video);
    app.cam = { video, track: null, etiqueta: 'Cámara simulada', esPixy: false, deviceId: 'simulada' };
    app.guardar = () => {};
    window.museoSimulador = sim;
    await prepararControl();
  }
  // Actualizaciones: se instalan solas cuando la mesa está libre
  app.actualizaciones = iniciarActualizaciones({
    avisar,
    estaLibre: () => {
      const quieto = performance.now() - app.ultimaMano;
      return app.modo !== 'ajustes' && ((app.modo === 'vestibulo' && quieto > 60000) || quieto > 180000);
    },
  });
  if (!sinCamara) {
    avisar('Encendiendo la cámara…', 0);
    await encenderCamara();
    if (app.cam) avisoEl.hidden = true;
    await prepararControl();
    try {
      await app.detector.iniciar(app.config.maxManos);
    } catch (e) {
      console.error(e);
      avisar('No pude cargar el detector de manos. Puedes usar el ratón.', 8000);
    }
  }
  if (!app.config.calibracion && app.cam) {
    avisar('Primera vez: pulsa la tecla A para calibrar la cámara con el proyector.', 12000);
  } else if (app.cam && app.config.calibracion && app.config.verificarAlEncender !== false && !parametros.has('sala') && !parametros.has('simular')) {
    await revisarAlEncender();
  }
  const ir = parametros.get('sala');
  if (ir === 'ajustes') app.irAjustes();
  else if (ir === 'prueba') app.probarCalibracion();
  else if (ir) app.irSala(ir);
})();
