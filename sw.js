// Service worker del Museo Interactivo: guarda TODO el museo en la
// computadora (funciona sin internet) y prepara las versiones nuevas en
// segundo plano. La línea VERSION la escribe herramientas/publicar.mjs: al
// cambiar, el navegador detecta un museo nuevo.
const VERSION = '2026.11.02-2202';
const CACHE = 'museo-' + VERSION;
const LISTA = 'precache.json';

let mapa = null; // ruta -> huella del archivo

async function cargarMapa() {
  if (mapa) return mapa;
  const c = await caches.open(CACHE);
  const r = await c.match(LISTA);
  mapa = r ? Object.fromEntries((await r.json()).archivos.map((a) => [a.u, a.h])) : {};
  return mapa;
}

const clave = (u, h) => new URL(u + '?__h=' + h, self.registration.scope).href;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    // Nunca hacia atrás: si ya hay guardada una versión más nueva (por ejemplo,
    // una Mac sin internet que entrega su copia vieja), esta no se instala.
    const fecha = /^\d{4}\.\d{2}\.\d{2}-\d{4}$/;
    if (fecha.test(VERSION)) {
      const mayor = (await caches.keys()).some((n) => n.startsWith('museo-') && fecha.test(n.slice(6)) && n.slice(6) > VERSION);
      if (mayor) throw new Error('Ya hay una versión más nueva guardada');
    }
    const r = await fetch(LISTA + '?v=' + VERSION, { cache: 'no-store' });
    if (!r.ok) throw new Error('No hay lista de archivos');
    const lista = await r.clone().json();
    const c = await caches.open(CACHE);
    // Lo que no cambió se copia de la versión anterior (no se vuelve a bajar:
    // los modelos pesan ~35 MB y en una sede con internet lento importa).
    // Lo nuevo se baja de 4 en 4 y cada archivo se reintenta hasta 3 veces:
    // una conexión que se corta no echa a perder toda la actualización.
    const pendientes = [...lista.archivos];
    const bajar = async (a) => {
      const k = clave(a.u, a.h);
      if (await c.match(k)) return; // ya quedó de un intento anterior
      const viejo = await caches.match(k);
      if (viejo) return c.put(k, viejo);
      let error = null;
      for (let intento = 0; intento < 3; intento++) {
        try {
          const nuevo = await fetch(new URL(a.u, self.registration.scope).href, { cache: 'reload' });
          if (!nuevo.ok) throw new Error(`${a.u}: ${nuevo.status}`);
          // Chrome intenta compilar los .wasm al guardarlos y esa compilación
          // corta la descarga (medido: 11 de 11 descargas cortadas). Se guardan
          // como datos sueltos y se les devuelve su tipo al entregarlos.
          if (a.u.endsWith('.wasm')) {
            const datos = await nuevo.arrayBuffer();
            return await c.put(k, new Response(datos, { headers: { 'Content-Type': 'application/octet-stream', 'X-Tipo-Real': 'application/wasm' } }));
          }
          return await c.put(k, nuevo);
        } catch (e) {
          error = e;
          await new Promise((res) => setTimeout(res, 1000 * (intento + 1)));
        }
      }
      throw new Error('No pude bajar ' + a.u + ': ' + error?.message);
    };
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (pendientes.length) await bajar(pendientes.shift());
    }));
    await c.put(LISTA, r);
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nombre of await caches.keys()) if (nombre.startsWith('museo-') && nombre !== CACHE) await caches.delete(nombre);
    mapa = null;
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'activar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const alcance = new URL(self.registration.scope);
  if (url.origin !== alcance.origin || !url.pathname.startsWith(alcance.pathname)) return;
  let ruta = url.pathname.slice(alcance.pathname.length);
  if (ruta === '' || req.mode === 'navigate') ruta = 'index.html';
  if (ruta === 'version.json' || ruta === 'sw.js' || ruta === LISTA) return; // siempre de internet
  e.respondWith((async () => {
    const m = await cargarMapa();
    if (m[ruta]) {
      const guardado = await caches.match(clave(ruta, m[ruta]));
      const tipo = guardado?.headers.get('X-Tipo-Real');
      if (tipo) return new Response(guardado.body, { status: 200, headers: { 'Content-Type': tipo } });
      if (guardado) return guardado;
    }
    return fetch(req);
  })());
});
