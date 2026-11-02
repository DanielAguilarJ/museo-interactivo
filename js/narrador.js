// Narrador: lee en voz alta el título y la primera frase de cada ficha, para
// los niños que todavía no leen. Usa la voz en español que tenga la
// computadora (Windows y Mac traen voces de español de México o de España).

let activo = true;
let voz = null;
const recientes = new Map(); // clave -> última vez que se dijo

function elegirVoz() {
  if (!('speechSynthesis' in window)) return;
  const voces = speechSynthesis.getVoices();
  voz = voces.find((v) => /es[-_]MX/i.test(v.lang)) || voces.find((v) => /es[-_](US|419)/i.test(v.lang)) || voces.find((v) => /^es/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) {
  elegirVoz();
  speechSynthesis.addEventListener?.('voiceschanged', elegirVoz);
}

export function ponerNarrador(encendido) {
  activo = !!encendido;
  if (!activo) callar();
}

/** Lee una ficha. No repite la misma en 25 segundos. */
export function narrar(clave, info) {
  if (!activo || !('speechSynthesis' in window) || !info?.titulo) return;
  const ahora = performance.now();
  if (ahora - (recientes.get(clave) || -1e9) < 25000) return;
  recientes.set(clave, ahora);
  decir(`${info.titulo}. ${info.texto?.[0] || ''}`);
}

export function decir(texto) {
  if (!activo || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto.replace(/[«»]/g, ''));
  u.lang = voz?.lang || 'es-MX';
  if (voz) u.voice = voz;
  u.rate = 0.95;
  u.pitch = 1.05;
  speechSynthesis.speak(u);
}

export function callar() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
