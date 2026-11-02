// Se conecta a un Chrome ya abierto con --remote-debugging-port, evalúa una
// expresión en la página del museo y opcionalmente guarda una captura.
// Uso: node pruebas/inspeccionar.mjs <puerto> "<expresión>" [captura.png]

import { writeFileSync } from 'node:fs';

const [puerto = '9335', expresion = '1', captura] = process.argv.slice(2);
const lista = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json();
const pagina = lista.find((t) => t.type === 'page' && t.url.includes('127.0.0.1:8777'));
if (!pagina) { console.error('No encuentro la página del museo'); process.exit(1); }
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let n = 0;
const pendientes = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
});
const enviar = (method, params = {}) => new Promise((r) => { const id = ++n; pendientes.set(id, r); ws.send(JSON.stringify({ id, method, params })); });

const r = await enviar('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true });
console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r.result, null, 1));
if (captura) {
  const foto = await enviar('Page.captureScreenshot', { format: 'png' });
  writeFileSync(captura, Buffer.from(foto.result.data, 'base64'));
}
ws.close();
