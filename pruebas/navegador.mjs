// Abre el museo en Chrome sin ventana, recoge errores de la consola y toma una
// captura. Uso:
//   node pruebas/navegador.mjs "<ruta y parámetros>" salida.png [espera_ms] [ancho] [alto]
// Ejemplo: node pruebas/navegador.mjs "/?sincamara&sala=sistema-solar&manos=0.5,0.5" /ruta/captura.png 4000

import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [ruta = '/?sincamara', salida = 'captura.png', espera = '4000', ancho = '1280', alto = '720'] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PUERTO_DEPURACION = 9333;
// MUSEO_PERFIL=/ruta guarda el perfil entre corridas (caché, permisos); MUSEO_BASE cambia la dirección
const perfil = process.env.MUSEO_PERFIL || mkdtempSync(join(tmpdir(), 'museo-prueba-'));
const BASE = process.env.MUSEO_BASE || 'http://127.0.0.1:8777';

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PUERTO_DEPURACION}`, `--user-data-dir=${perfil}`,
  `--window-size=${ancho},${alto}`, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--enable-unsafe-swiftshader',
  // MUSEO_VIDEO=/ruta/video.y4m hace que la "cámara" muestre ese video (para probar la detección de manos)
  ...(process.env.MUSEO_VIDEO ? [`--use-file-for-fake-video-capture=${process.env.MUSEO_VIDEO}`] : []),
  'about:blank',
], { stdio: 'ignore' });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let destino = null;
for (let i = 0; i < 50 && !destino; i++) {
  await dormir(200);
  try {
    const lista = await (await fetch(`http://127.0.0.1:${PUERTO_DEPURACION}/json`)).json();
    destino = lista.find((t) => t.type === 'page');
  } catch (e) { /* aún arrancando */ }
}
if (!destino) { console.error('Chrome no arrancó'); chrome.kill(); process.exit(1); }

const ws = new WebSocket(destino.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let n = 0;
const pendientes = new Map();
const mensajes = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') mensajes.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  if (m.method === 'Runtime.exceptionThrown') mensajes.push('[EXCEPCIÓN] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') mensajes.push('[log] ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
});
const enviar = (method, params = {}) => new Promise((r) => { const id = ++n; pendientes.set(id, r); ws.send(JSON.stringify({ id, method, params })); });

await enviar('Runtime.enable');
await enviar('Log.enable');
await enviar('Page.enable');
// MUSEO_PERMISOS="localNetworkAccess,..." concede permisos como si la persona pulsara «Permitir»
if (process.env.MUSEO_PERMISOS) {
  const v = await (await fetch(`http://127.0.0.1:${PUERTO_DEPURACION}/json/version`)).json();
  const nav = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r) => nav.addEventListener('open', r, { once: true }));
  const r = await new Promise((res) => {
    nav.addEventListener('message', (e) => res(JSON.parse(e.data)), { once: true });
    // "nombre:descriptor" usa Browser.setPermission (p. ej. "local-network-access:1")
    const lista = process.env.MUSEO_PERMISOS.split(',');
    if (lista[0].includes(':')) {
      nav.send(JSON.stringify({ id: 1, method: 'Browser.setPermission', params: { origin: new URL(BASE).origin, permission: { name: lista[0].split(':')[0] }, setting: 'granted' } }));
    } else nav.send(JSON.stringify({ id: 1, method: 'Browser.grantPermissions', params: { origin: new URL(BASE).origin, permissions: lista } }));
  });
  console.log('permisos ->', JSON.stringify(r.error || 'concedidos'));
  nav.close();
}
await enviar('Page.navigate', { url: `${BASE}${ruta}` });
await dormir(+espera);

// Pasos opcionales: MUSEO_PASOS='[{"esperar":1000,"js":"window.museoManos=[{x:0.3,y:0.4}]"}]'
const pasos = JSON.parse(process.env.MUSEO_PASOS || '[]');
for (const p of pasos) {
  if (p.js) {
    const r = await enviar('Runtime.evaluate', { expression: p.js, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) console.log('js error ->', r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    const valor = r.result?.result?.value;
    // {"guardar": "ruta.png"}: el paso devuelve una imagen (data URL) y se guarda en disco
    if (p.guardar && typeof valor === 'string' && valor.startsWith('data:')) {
      writeFileSync(p.guardar, Buffer.from(valor.split(',')[1], 'base64'));
      console.log('guardado ->', p.guardar);
    } else if (valor !== undefined) console.log('js ->', JSON.stringify(valor));
  }
  if (p.esperar) await dormir(p.esperar);
}

const foto = await enviar('Page.captureScreenshot', { format: 'png' });
writeFileSync(salida, Buffer.from(foto.result.data, 'base64'));
console.log(mensajes.length ? mensajes.join('\n') : '(sin mensajes en la consola)');
ws.close();
chrome.kill();
