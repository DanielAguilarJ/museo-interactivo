// Control de la cámara, igual para Windows y Mac. Usa la mejor vía disponible:
//  1. El agente local (servidor.py, solo Mac): giro, inclinación, zoom,
//     exposición, enfoque y órdenes propias de EMEET por USB.
//  2. El navegador: giro, inclinación y zoom si la cámara y el sistema lo
//     permiten (Chrome/Edge en Windows exponen zoom, exposición y enfoque).
//  3. WebHID (Chrome/Edge, Windows y Mac): apagar el seguimiento automático,
//     los gestos y la privacidad automática de la PIXY. Sin instalar nada.

import { abrirPixy, hayWebHID, modoMuseoHID } from './pixy-hid.js';

const enLocal = () => ['127.0.0.1', 'localhost'].includes(location.hostname);

async function pedir(base, ruta, cuerpo, ms = 2500) {
  try {
    const r = await fetch(base + ruta, {
      signal: AbortSignal.timeout(ms),
      ...(cuerpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

/**
 * ¿Hay un agente local? En Mac el museo se abre desde el propio agente
 * (127.0.0.1), que trae la versión publicada. Desde la dirección de internet
 * solo se busca si se pidió (config.agenteLocal), porque Chrome bloquea esos
 * pedidos salvo permiso de «red local».
 */
async function buscarAgente(config) {
  const candidatos = enLocal() ? [''] : config?.agenteLocal ? ['http://127.0.0.1:8777'] : [];
  for (const base of candidatos) {
    const r = await pedir(base, '/api/salud', undefined, 1200);
    if (r?.ok) return base;
  }
  return null;
}

// ---- Giro, inclinación y zoom desde el navegador (unidades propias de la cámara)
function ptzNavegador(track) {
  const cap = track?.getCapabilities?.() || {};
  const util = (k) => cap[k] && cap[k].max > cap[k].min ? cap[k] : null;
  const pan = util('pan'), tilt = util('tilt'), zoom = util('zoom');
  if (!pan && !tilt && !zoom) return null;
  // Se trabaja en «grados aproximados»: el encuadre automático aprende solo
  // cuánto se mueve la imagen, así que basta con una escala lineal.
  const kp = pan ? Math.max(Math.abs(pan.min), Math.abs(pan.max)) / 150 : 1;
  const kt = tilt ? Math.max(Math.abs(tilt.min), Math.abs(tilt.max)) / 90 : 1;
  const zmin = zoom?.min ?? 1, zmax = zoom?.max ?? 1;
  const aZoom = (v) => 100 + ((v - zmin) / (zmax - zmin || 1)) * 50; // 100..150 como la PIXY
  const deZoom = (z) => zmin + ((z - 100) / 50) * (zmax - zmin);
  return {
    via: 'navegador',
    async leer() {
      const s = track.getSettings();
      return {
        ok: true,
        giro: pan ? s.pan / kp : 0, inclinacion: tilt ? s.tilt / kt : 0, zoom: zoom ? aZoom(s.zoom) : 100,
        giroMin: pan ? pan.min / kp : 0, giroMax: pan ? pan.max / kp : 0,
        inclinacionMin: tilt ? tilt.min / kt : 0, inclinacionMax: tilt ? tilt.max / kt : 0,
        zoomMin: 100, zoomMax: zoom ? 150 : 100, conGiro: !!(pan && tilt), conZoom: !!zoom,
      };
    },
    async poner({ giro, inclinacion, zoom: z }) {
      const a = {};
      if (pan && typeof giro === 'number') a.pan = Math.max(pan.min, Math.min(pan.max, giro * kp));
      if (tilt && typeof inclinacion === 'number') a.tilt = Math.max(tilt.min, Math.min(tilt.max, inclinacion * kt));
      if (zoom && typeof z === 'number') a.zoom = Math.max(zmin, Math.min(zmax, deZoom(z)));
      try { await track.applyConstraints({ advanced: [a] }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
    },
  };
}

function ptzAgente(base) {
  return {
    via: 'agente',
    async leer() { return (await pedir(base, '/api/ptz')) || { ok: false }; },
    async poner(v) { return (await pedir(base, '/api/ptz', v)) || { ok: false, error: 'El agente no respondió' }; },
  };
}

// ---- Exposición, enfoque y balance de blancos desde el navegador
async function imagenNavegador(track, bloquear) {
  const cap = track?.getCapabilities?.() || {};
  const a = {};
  for (const k of ['exposureMode', 'focusMode', 'whiteBalanceMode']) {
    const modos = cap[k] || [];
    const quiero = bloquear ? 'manual' : 'continuous';
    if (modos.includes(quiero)) a[k] = quiero;
  }
  if (!Object.keys(a).length) return false;
  try { await track.applyConstraints({ advanced: [a] }); return true; } catch (e) { return false; }
}

export async function crearControl(app) {
  const base = await buscarAgente(app.config);
  const track = app.cam?.track || null;
  let hid = null;
  try { hid = await abrirPixy(false); } catch (e) { hid = null; }
  const navegador = ptzNavegador(track);
  let ptz = null;
  if (base !== null) {
    const r = await pedir(base, '/api/ptz');
    if (r?.ok) ptz = ptzAgente(base);
  }
  if (!ptz && navegador) ptz = navegador;

  return {
    agente: base !== null,
    hid: !!hid,
    puedeHID: hayWebHID(),
    ptz,
    /** Congela la imagen para medir (si se puede). */
    async bloquearImagen() {
      if (base !== null) await pedir(base, '/api/imagen/bloquear', {});
      await imagenNavegador(track, true);
    },
    async liberarImagen() {
      if (base !== null) await pedir(base, '/api/imagen/liberar', {});
      await imagenNavegador(track, false);
    },
    /** Modo museo: la cámara no se mueve sola ni baja la lente. */
    async fijar() {
      const pasos = [];
      if (hid) { try { const r = await modoMuseoHID(hid); pasos.push(r ? 'usb' : 'usb-sin-respuesta'); } catch (e) { pasos.push('usb-error'); } }
      if (base !== null) { const r = await pedir(base, '/api/camara/fijar', {}); if (r?.ok) pasos.push('agente'); }
      return { ok: pasos.some((p) => p === 'usb' || p === 'agente'), pasos };
    },
    /** Pide permiso para el control USB de la PIXY (necesita un clic del encargado). */
    async conectarHID() {
      hid = await abrirPixy(true);
      this.hid = !!hid;
      return this.hid;
    },
    descripcion() {
      const partes = [];
      if (this.agente) partes.push('programa local');
      if (this.hid) partes.push('control USB de la PIXY');
      if (ptz?.via === 'navegador') partes.push('giro/zoom del navegador');
      return partes.length ? 'Control de la cámara: ' + partes.join(' + ') + '.' : '';
    },
  };
}
