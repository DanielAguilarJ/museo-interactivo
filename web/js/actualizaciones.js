// Actualizaciones automáticas: cada 15 minutos el museo pregunta si hay una
// versión nueva publicada. Si la hay, la descarga en segundo plano y se
// reinicia SOLO cuando nadie está usando la mesa, para no cortar a un niño a
// la mitad de una sala.

import { VERSION } from './version.js';

const CADA_MS = 15 * 60 * 1000;

export function iniciarActualizaciones({ estaLibre, avisar }) {
  const parametros = new URLSearchParams(location.search);
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const publicado = (!local || parametros.has('sw')) && 'serviceWorker' in navigator && !parametros.has('simular');
  const a = { version: VERSION, publicado, nueva: null, lista: false, registro: null, buscar };
  if (!publicado) return a;

  let esperando = null;
  const vigilar = (sw) => {
    if (!sw) return;
    const listo = () => { if (sw.state === 'installed' && navigator.serviceWorker.controller) { esperando = sw; a.lista = true; } };
    listo();
    sw.addEventListener('statechange', listo);
  };

  navigator.serviceWorker.register('./sw.js').then((reg) => {
    a.registro = reg;
    vigilar(reg.waiting);
    reg.addEventListener('updatefound', () => vigilar(reg.installing));
  }).catch((e) => console.warn('Sin modo sin internet:', e));

  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    location.reload();
  });

  async function buscar(manual = false) {
    try {
      const r = await fetch('./version.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error('sin respuesta (' + r.status + ')');
      const { version } = await r.json();
      a.nueva = version && version !== VERSION ? version : null;
      if (a.nueva && a.registro) await a.registro.update();
      if (manual && a.nueva) avisar?.(`Descargando la versión ${a.nueva}…`, 6000);
      return { nueva: a.nueva };
    } catch (e) {
      return { error: e.name === 'TimeoutError' ? 'sin internet' : e.message };
    }
  }

  setTimeout(() => buscar(), 20 * 1000);
  setInterval(() => buscar(), CADA_MS);
  // Instalar la versión nueva en cuanto la mesa esté libre
  setInterval(() => {
    if (esperando && estaLibre()) {
      avisar?.('Instalando la versión nueva del museo…', 0);
      esperando.postMessage('activar');
      esperando = null;
    }
  }, 5000);
  return a;
}
