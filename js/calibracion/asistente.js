// Rutinas de calibración que usan el proyector y la cámara de verdad.

import { Medidor, buscarMancha } from './medir.js';
import { puntosMalla, CONTROL, ajustarCalibracion, crearMapeo, medirError, calificar, zonaProyectada } from './modelo.js';

// ---------- Pantalla negra donde se encienden puntos (encima de todo)
class Pantalla {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'calibrando';
    this.el.innerHTML = '<div class="blanco" hidden></div><div class="punto" hidden></div><div class="mensaje"></div><div class="barra"><i></i></div>';
    document.body.appendChild(this.el);
    document.body.classList.add('calibrando-auto');
    this.$blanco = this.el.querySelector('.blanco');
    this.$punto = this.el.querySelector('.punto');
    this.$mensaje = this.el.querySelector('.mensaje');
    this.$barra = this.el.querySelector('.barra i');
  }
  negro() { this.$blanco.hidden = true; this.$punto.hidden = true; }
  blanco() { this.$blanco.hidden = false; this.$punto.hidden = true; }
  punto(x, y, lado) {
    Object.assign(this.$punto.style, { left: x * innerWidth + 'px', top: y * innerHeight + 'px', width: lado + 'px', height: lado + 'px' });
    this.$blanco.hidden = true;
    this.$punto.hidden = false;
  }
  mensaje(t) { this.$mensaje.textContent = t || ''; this.$mensaje.hidden = !t; }
  progreso(t) { this.$barra.style.width = Math.round(t * 100) + '%'; }
  quitar() { this.el.remove(); document.body.classList.remove('calibrando-auto'); }
}

const mediana = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/** Cuánto tarda en verse en la cámara lo que se dibuja en el proyector. */
export async function medirLatencia(m, p) {
  p.negro();
  await m.esperar(600);
  const base = m.brilloMedio(await m.foto(2));
  p.blanco();
  const t0 = performance.now();
  const lecturas = [];
  for (let k = 0; k < 30; k++) {
    await m.cuadroNuevo();
    lecturas.push({ t: performance.now() - t0, b: m.brilloMedio(m.leer()) });
    if (k > 6 && lecturas.at(-1).b - lecturas.at(-4).b < 0.5) break; // ya no cambia
  }
  p.negro();
  const final = Math.max(...lecturas.map((l) => l.b));
  if (final - base < 8) return null; // no se ve el proyector
  const mitad = lecturas.find((l) => l.b > base + (final - base) * 0.5);
  m.latenciaMs = Math.max(80, Math.min(700, (mitad?.t ?? 200) * 1.4 + 40));
  return m.latenciaMs;
}

/** Qué parte de la imagen de la cámara ilumina el proyector. */
export async function medirZona(m, p) {
  p.negro(); await m.asentar(); const negro = await m.foto(3);
  p.blanco(); await m.asentar(); const blanco = await m.foto(3);
  p.negro();
  return zonaProyectada(negro, blanco, m.ancho, m.alto);
}

/** Mide un punto hasta 3 veces; se queda con la mediana de lecturas que coinciden. */
async function medirPunto(m, p, pt, lado, cuadros = 2) {
  const lecturas = [];
  for (let k = 0; k < 3; k++) {
    p.negro(); await m.asentar(); const fondo = await m.foto(cuadros);
    p.punto(pt.x, pt.y, lado); await m.asentar(); const luz = await m.foto(cuadros);
    const r = buscarMancha(fondo, luz, m.ancho, m.alto);
    if (r) lecturas.push(r);
    if (lecturas.length >= 2) {
      const [a, b] = lecturas.slice(-2);
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.004) break;
    }
    if (k === 1 && !lecturas.length) break; // dos veces sin verlo: está fuera de la vista
  }
  p.negro();
  if (!lecturas.length) return null;
  return { x: mediana(lecturas.map((l) => l.x)), y: mediana(lecturas.map((l) => l.y)), lecturas: lecturas.length };
}

// Solo una medición a la vez: si al encender el museo está revisando la
// calibración y el encargado pulsa «Calibrar», la segunda espera su turno
// (dos pantallas de puntos a la vez se arruinarían la una a la otra).
let turno = Promise.resolve();
let liberarTurno = null;

async function preparar(app, textoInicial) {
  const video = app.cam?.video;
  if (!video?.videoWidth) throw new Error('No hay cámara abierta');
  const anterior = turno;
  let soltar;
  turno = new Promise((r) => { soltar = r; });
  await anterior;
  liberarTurno = soltar;
  const p = new Pantalla();
  p.mensaje(textoInicial);
  const m = new Medidor(video);
  await app.control?.bloquearImagen(); // que la cámara no cambie de brillo entre fotos
  await m.esperar(700);
  return { p, m };
}

async function terminar(app, p) {
  p.quitar();
  try { await app.control?.liberarImagen(); } finally {
    const soltar = liberarTurno;
    liberarTurno = null;
    soltar?.();
  }
}

/**
 * Tamaño de los puntos y fotos por medición según cuánto se distingue la luz
 * del proyector de la luz del cuarto: con poco contraste, puntos más grandes
 * y más fotos promediadas.
 */
export function planDeMedicion(zona, intento = 0) {
  const c = zona?.contraste ?? 1;
  const base = c < 0.6 ? 0.075 : c < 1.2 ? 0.062 : 0.052;
  return { lado: base * (1 + intento * 0.35), cuadros: c < 0.6 ? 4 : c < 1.2 ? 3 : 2 };
}

/**
 * Calibración completa: 20 puntos para calcular y 5 de control para medir
 * cuánto acierta de verdad. Si sale mal, la repite sola una vez con puntos
 * más grandes y más fotos.
 */
export async function calibrar(app, { alMensaje = () => {} } = {}) {
  const { p, m } = await preparar(app, 'Calibrando… no toques la mesa (unos 40 segundos)');
  try {
    alMensaje('Midiendo el retraso de la cámara…');
    const latencia = await medirLatencia(m, p);
    if (latencia === null) throw new Error('La cámara no ve la luz del proyector. Apunta la cámara a la mesa o usa «Encuadrar».');
    alMensaje('Buscando la imagen del proyector…');
    const zona = await medirZona(m, p);
    if (!zona) throw new Error('La cámara no ve la luz del proyector. Apunta la cámara a la mesa o usa «Encuadrar».');
    p.mensaje('');
    let resultado = null;
    for (let intento = 0; intento < 2; intento++) {
      const plan = planDeMedicion(zona, intento);
      const lado = Math.round(Math.min(innerWidth, innerHeight) * plan.lado);
      const malla = puntosMalla();
      const total = malla.length + CONTROL.length;
      const medidos = [];
      const etiqueta = intento ? ' (segundo intento, puntos más grandes)' : '';
      for (const [i, pt] of malla.entries()) {
        p.progreso(i / total);
        alMensaje(`Midiendo punto ${i + 1} de ${total}${etiqueta}…`);
        medidos.push({ pantalla: { x: pt.x, y: pt.y }, camara: await medirPunto(m, p, pt, lado, plan.cuadros), c: pt.c, f: pt.f });
      }
      const controles = [];
      for (const [i, pt] of CONTROL.entries()) {
        p.progreso((malla.length + i) / total);
        alMensaje(`Comprobando punto ${malla.length + i + 1} de ${total}${etiqueta}…`);
        controles.push({ pantalla: { ...pt }, camara: await medirPunto(m, p, pt, lado, plan.cuadros) });
      }
      p.progreso(1);
      const vistos = medidos.filter((x) => x.camara).length;
      if (vistos < 4) { resultado = { vistos, total: medidos.length }; continue; }
      const ajuste = ajustarCalibracion(medidos);
      const mapa = { h: ajuste.h, malla: ajuste.malla, dedo: null };
      const error = medirError(crearMapeo({ mapa }), controles);
      const nota = calificar(error, innerWidth);
      const r = {
        mapa, zona, error, nota, vistos, total: medidos.length, intentos: intento + 1,
        descartados: ajuste.descartados.length, controles: error?.vistos ?? 0, latencia: Math.round(m.latenciaMs),
      };
      // Me quedo con el mejor de los dos intentos
      if (!resultado?.mapa || (error && (!resultado.error || error.medio < resultado.error.medio))) resultado = r;
      if (nota.ok && vistos >= 16) break;
    }
    if (!resultado?.mapa) throw new Error(`Solo vi ${resultado?.vistos ?? 0} de ${resultado?.total ?? 20} puntos. Baja la luz del cuarto o usa «Encuadrar».`);
    return resultado;
  } finally {
    await terminar(app, p);
  }
}

/** Revisión rápida (unos 4 s): ¿la calibración guardada sigue acertando? */
export async function verificar(app) {
  const { p, m } = await preparar(app, 'Revisando la calibración… no toques la mesa');
  try {
    if ((await medirLatencia(m, p)) === null) return { visto: false };
    const lado = Math.round(Math.min(innerWidth, innerHeight) * 0.055);
    const controles = [];
    for (const pt of CONTROL.slice(0, 4)) controles.push({ pantalla: { ...pt }, camara: await medirPunto(m, p, pt, lado) });
    const error = medirError(crearMapeo(app.config), controles);
    return { visto: !!error, error, nota: calificar(error, innerWidth) };
  } finally {
    await terminar(app, p);
  }
}

/**
 * Encuadre automático: mueve la cámara (giro, inclinación, zoom) hasta que
 * vea toda la imagen del proyector, centrada y lo más grande posible.
 * Usa el agente local (Mac) o el giro/zoom del navegador (Windows, si la
 * cámara lo permite); si ninguno puede, avisa para moverla a mano.
 */
export async function encuadrar(app, { alMensaje = () => {} } = {}) {
  const ptz = app.control?.ptz;
  let e = ptz ? await ptz.leer() : null;
  if (!e?.ok) throw new Error('En esta computadora no puedo mover la cámara: apúntala a mano hacia la mesa (o con EMEET Studio) y luego calibra.');
  const { p, m } = await preparar(app, 'Encuadrando la cámara… no toques la mesa');
  const mover = async (cambios) => {
    await ptz.poner(cambios);
    await m.esperar(1100); // el motor tarda en llegar
    const ahora = await ptz.leer();
    if (ahora?.ok) e = ahora;
  };
  const centro = (z) => ({ x: (z.caja.x0 + z.caja.x1) / 2, y: (z.caja.y0 + z.caja.y1) / 2 });
  try {
    if ((await medirLatencia(m, p)) === null && e.zoom > e.zoomMin) await mover({ zoom: e.zoomMin });
    let zona = await medirZona(m, p);
    if (!zona && e.zoom > e.zoomMin) { await mover({ zoom: e.zoomMin }); zona = await medirZona(m, p); }
    if (!zona) throw new Error('No veo la luz del proyector. Gira la cámara hacia la mesa con los controles y vuelve a intentar.');

    // Cómo se mueve la imagen al girar e inclinar 4°. Si un lado está cortado,
    // el centro de lo visible engaña: se mide con la orilla que sí se ve.
    alMensaje('Aprendiendo cómo se mueve la cámara…');
    const z0 = zona;
    const ref = (z) => ({
      x: z0.cortado.izquierda && !z0.cortado.derecha ? z.caja.x1 : z0.cortado.derecha && !z0.cortado.izquierda ? z.caja.x0 : (z.caja.x0 + z.caja.x1) / 2,
      y: z0.cortado.arriba && !z0.cortado.abajo ? z.caja.y1 : z0.cortado.abajo && !z0.cortado.arriba ? z.caja.y0 : (z.caja.y0 + z.caja.y1) / 2,
    });
    const c0 = ref(zona);
    await mover({ giro: e.giro + 4 });
    const zg = await medirZona(m, p);
    await mover({ inclinacion: e.inclinacion + 4 });
    const zi = await medirZona(m, p);
    if (!zg || !zi) throw new Error('Al mover la cámara perdí la imagen del proyector. Acércala a mano al centro y vuelve a intentar.');
    const cg = ref(zg), ci = ref(zi);
    let J = [[(cg.x - c0.x) / 4, (ci.x - cg.x) / 4], [(cg.y - c0.y) / 4, (ci.y - cg.y) / 4]];
    zona = zi;
    const lim = (v) => Math.max(-20, Math.min(20, v));
    // Grados de giro e inclinación para correr la imagen (ex, ey) dentro de la vista
    const resolver = (ex, ey) => {
      const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      if (Math.abs(det) < 1e-7) return null;
      return { giro: e.giro + lim((J[1][1] * ex - J[0][1] * ey) / det), inclinacion: e.inclinacion + lim((-J[1][0] * ex + J[0][0] * ey) / det) };
    };

    for (let paso = 0; paso < 12; paso++) {
      const c = centro(zona);
      const tam = Math.max(zona.caja.x1 - zona.caja.x0, zona.caja.y1 - zona.caja.y0);
      alMensaje(`Ajustando (paso ${paso + 1})…`);
      if (!zona.completa && e.zoom > e.zoomMin) {
        const z = Math.max(e.zoomMin, e.zoom - 15);
        J = J.map((f) => f.map((v) => v * (z / e.zoom)));
        await mover({ zoom: z });
      } else if (!zona.completa) {
        // Ya sin zoom: correr la imagen hacia dentro, del lado que se sale
        const k = zona.cortado;
        const ex = (k.izquierda && !k.derecha ? 0.09 : k.derecha && !k.izquierda ? -0.09 : 0);
        const ey = (k.arriba && !k.abajo ? 0.09 : k.abajo && !k.arriba ? -0.09 : 0);
        if (!ex && !ey) break; // se sale por los dos lados: la cámara está demasiado cerca
        const destino = resolver(ex, ey);
        if (!destino) break;
        await mover(destino);
      } else {
        const ex = 0.5 - c.x, ey = 0.5 - c.y;
        if (Math.hypot(ex, ey) > 0.03) {
          const destino = resolver(ex, ey);
          if (!destino) break;
          await mover(destino);
        } else if (zona.completa && tam < 0.8 && e.zoom < e.zoomMax) {
          const z = Math.min(e.zoomMax, Math.round(e.zoom * Math.min(1.15, 0.86 / tam)));
          if (z <= e.zoom) break;
          J = J.map((f) => f.map((v) => v * (z / e.zoom)));
          await mover({ zoom: z });
        } else break;
      }
      const nueva = await medirZona(m, p);
      if (!nueva) { alMensaje('Me pasé; regreso un poco.'); break; }
      zona = nueva;
    }
    return { zona, posicion: { giro: e.giro, inclinacion: e.inclinacion, zoom: e.zoom } };
  } finally {
    await terminar(app, p);
  }
}

/** Calibración a mano con 4 clics (si la automática no puede). */
export { ajustarCalibracion, crearMapeo, calificar, medirError };
