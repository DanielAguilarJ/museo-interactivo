// Configuración de ESTA computadora (cámara, calibración, volumen…).
// Se guarda en el navegador; en la copia local de Mac también en config.json.
// Las actualizaciones del museo no la borran.

import { IDENTIDAD } from './homografia.js';

const CLAVE = 'museo-config';
const conServidor = () => ['127.0.0.1', 'localhost'].includes(location.hostname);

export const PREDETERMINADA = {
  camaraId: null,
  ptz: null,
  homografia: IDENTIDAD,
  calibracion: null, // { fecha, error, puntos }
  posicionCamara: null, // { giro, inclinacion, zoom } que se repite al encender
  mapa: null, // { h, malla (corrección del lente), dedo (afinado) } de la calibración
  verificarAlEncender: true, // revisar la calibración (y repetirla si algo se movió) al encender
  voz: true, // leer las fichas en voz alta
  retos: true, // misiones en cada sala
  volumen: 0.5,
  maxManos: 6,
  esperaSegundos: 120,
};

export async function cargarConfig() {
  let guardada = {};
  if (conServidor()) {
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      if (r.ok) guardada = await r.json();
    } catch (e) { /* sin servidor: usamos la copia del navegador */ }
  }
  if (!guardada || !Object.keys(guardada).length) {
    try { guardada = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch (e) { guardada = {}; }
  }
  const c = { ...PREDETERMINADA, ...guardada };
  if (!Array.isArray(c.homografia) || c.homografia.length !== 9 || c.homografia.some((v) => !Number.isFinite(v))) {
    c.homografia = IDENTIDAD;
  }
  return c;
}

export async function guardarConfig(config) {
  localStorage.setItem(CLAVE, JSON.stringify(config));
  if (!conServidor()) return;
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch (e) { /* queda la copia del navegador */ }
}
