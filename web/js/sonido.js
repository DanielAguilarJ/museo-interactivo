// Sonidos sintetizados (sin archivos): campanita, burbuja, descubrimiento.

let ctx = null;
let maestro = null;
let volumen = 0.5;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    maestro = ctx.createGain();
    maestro.gain.value = volumen;
    maestro.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function ponerVolumen(v) {
  volumen = Math.max(0, Math.min(1, v));
  if (maestro) maestro.gain.value = volumen;
}

function tono(frec, inicio, duracion, tipo = 'sine', fuerza = 0.25, frecFinal = null) {
  const a = audio();
  const t = a.currentTime + inicio;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(frec, t);
  if (frecFinal) o.frequency.exponentialRampToValueAtTime(frecFinal, t + duracion);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(fuerza, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
  o.connect(g).connect(maestro);
  o.start(t);
  o.stop(t + duracion + 0.02);
}

export const sonido = {
  entrar() { [523, 659, 784, 1047].forEach((f, i) => tono(f, i * 0.07, 0.5, 'triangle', 0.18)); },
  volver() { [784, 587, 440].forEach((f, i) => tono(f, i * 0.08, 0.4, 'triangle', 0.15)); },
  tocar() { tono(880, 0, 0.18, 'sine', 0.12, 1320); },
  ficha() { tono(660, 0, 0.35, 'sine', 0.14); tono(990, 0.06, 0.45, 'sine', 0.1); },
  burbuja() { tono(300 + Math.random() * 300, 0, 0.16, 'sine', 0.08, 900 + Math.random() * 500); },
  descubrir() { [523, 659, 784, 1047, 1319].forEach((f, i) => tono(f, i * 0.09, 0.7, 'sine', 0.16)); },
  raspar() { tono(140 + Math.random() * 80, 0, 0.06, 'sawtooth', 0.02, 90); },
  retumbar() { tono(70, 0, 0.9, 'sine', 0.3, 40); },
  latido() { tono(62, 0, 0.16, 'sine', 0.35, 45); tono(55, 0.17, 0.2, 'sine', 0.28, 40); },
  rugido() {
    tono(110, 0, 1.1, 'sawtooth', 0.12, 55);
    tono(165, 0.05, 0.9, 'sawtooth', 0.08, 70);
    tono(82, 0.1, 1.2, 'square', 0.05, 45);
  },
  pasos() { tono(48, 0, 0.25, 'sine', 0.3, 30); },
  activar() {
    try { audio(); } catch (e) { /* sin audio */ }
  },
};
