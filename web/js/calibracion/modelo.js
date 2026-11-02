// Matemáticas de la calibración (sin navegador, para poder probarlas).
//
// La calibración convierte "dónde ve la cámara un punto" (0..1 de su imagen)
// en "dónde está ese punto en la imagen del proyector" (0..1 de la pantalla):
//   1. Una homografía: corrige posición, giro, inclinación y perspectiva.
//   2. Una malla de corrección: lo que la homografía no puede, como la
//      curvatura del lente gran angular o una mesa no del todo plana.
//   3. El afinado con el dedo (opcional): la cámara marca la punta de la uña,
//      no la yema que toca la mesa; ese pequeño desvío se mide y se corrige.

import { calcularHomografia, aplicar, errorMedio } from '../homografia.js';

export const MALLA_X = [0.07, 0.285, 0.5, 0.715, 0.93];
export const MALLA_Y = [0.09, 0.363, 0.637, 0.91];
// Puntos de control: NO se usan para calcular; sirven para medir el acierto real.
export const CONTROL = [{ x: 0.18, y: 0.23 }, { x: 0.82, y: 0.23 }, { x: 0.18, y: 0.77 }, { x: 0.82, y: 0.77 }, { x: 0.4, y: 0.5 }];

export function puntosMalla() {
  const ps = [];
  for (let f = 0; f < MALLA_Y.length; f++) for (let c = 0; c < MALLA_X.length; c++) ps.push({ x: MALLA_X[c], y: MALLA_Y[f], c, f });
  return ps;
}

/** Interpolación bilineal en una rejilla regular; fuera de ella usa el borde. */
export function interpolar(rejilla, x, y) {
  if (!rejilla) return { x: 0, y: 0 };
  const { xs, ys, dx, dy } = rejilla;
  const celda = (v, ejes) => {
    if (v <= ejes[0]) return [0, 0];
    for (let i = 0; i < ejes.length - 1; i++) if (v <= ejes[i + 1]) return [i, (v - ejes[i]) / (ejes[i + 1] - ejes[i])];
    return [ejes.length - 2, 1];
  };
  const [i, tx] = celda(x, xs);
  const [j, ty] = celda(y, ys);
  const n = xs.length;
  const v = (arr) => {
    const a = arr[j * n + i], b = arr[j * n + i + 1], c = arr[(j + 1) * n + i], d = arr[(j + 1) * n + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  return { x: v(dx), y: v(dy) };
}

// ---- Corrección suave del lente: un polinomio de grado 3 en (x, y).
// La curvatura de un lente es suave, así que un polinomio la sigue también
// ENTRE los puntos medidos (una interpolación en línea recta no).
const TERMINOS = [[0, 0], [1, 0], [0, 1], [2, 0], [1, 1], [0, 2], [3, 0], [2, 1], [1, 2], [0, 3]];
const base = (x, y) => { const u = (x - 0.5) * 2, v = (y - 0.5) * 2; return TERMINOS.map(([i, j]) => u ** i * v ** j); };

function resolverLineal(a, b) {
  const n = b.length;
  const m = a.map((fila, i) => [...fila, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let f = col + 1; f < n; f++) if (Math.abs(m[f][col]) > Math.abs(m[piv][col])) piv = f;
    if (Math.abs(m[piv][col]) < 1e-14) return null;
    [m[col], m[piv]] = [m[piv], m[col]];
    for (let f = 0; f < n; f++) {
      if (f === col) continue;
      const k = m[f][col] / m[col][col];
      for (let c = col; c <= n; c++) m[f][c] -= k * m[col][c];
    }
  }
  return m.map((fila, i) => fila[n] / fila[i]);
}

/** Ajusta el polinomio a los restos (mínimos cuadrados con un freno suave). */
export function ajustarPolinomio(puntos, restos) {
  const k = TERMINOS.length;
  if (puntos.length < k + 2) return null;
  const ata = Array.from({ length: k }, () => new Array(k).fill(0));
  const atb = new Array(k).fill(0);
  puntos.forEach((p, n) => {
    const f = base(p.x, p.y);
    for (let i = 0; i < k; i++) { atb[i] += f[i] * restos[n]; for (let j = 0; j < k; j++) ata[i][j] += f[i] * f[j]; }
  });
  for (let i = 1; i < k; i++) ata[i][i] += 1e-4; // freno: evita curvas raras en las orillas
  return resolverLineal(ata, atb);
}

export function evaluarCorreccion(corr, x, y) {
  if (!corr) return { x: 0, y: 0 };
  if (corr.tipo !== 'poli') return interpolar(corr, x, y);
  // Fuera de la imagen del proyector no se extrapola la curva
  const f = base(Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y)));
  let dx = 0, dy = 0;
  for (let i = 0; i < f.length; i++) { dx += corr.cx[i] * f[i]; dy += corr.cy[i] * f[i]; }
  return { x: dx, y: dy };
}

/** Devuelve la función cámara -> pantalla de una configuración (vieja o nueva). */
export function crearMapeo(config) {
  const mapa = config?.mapa;
  const h = mapa?.h || config?.homografia || [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const malla = mapa?.malla || null;
  const dedo = mapa?.dedo || null;
  return (x, y, conDedo = true) => {
    const p = aplicar(h, x, y);
    const c = evaluarCorreccion(malla, p.x, p.y);
    p.x += c.x; p.y += c.y;
    if (conDedo && dedo) {
      const d = interpolar(dedo, p.x, p.y);
      p.x += d.x; p.y += d.y;
    }
    return p;
  };
}

/**
 * Calcula la calibración a partir de los puntos medidos.
 * @param medidos [{camara:{x,y}, pantalla:{x,y}, c, f}] puntos de la malla que se vieron
 * @returns { h, malla, usados, descartados, errorHomografia }
 */
export function ajustarCalibracion(medidos) {
  let usados = medidos.filter((m) => m.camara);
  if (usados.length < 4) throw new Error(`Solo se vieron ${usados.length} puntos; hacen falta al menos 4`);
  const descartados = [];

  // Homografía + corrección suave del lente con los puntos que quedan
  const ajustar = () => {
    const h = calcularHomografia(usados.map((m) => m.camara), usados.map((m) => m.pantalla));
    const enPantalla = usados.map((m) => aplicar(h, m.camara.x, m.camara.y));
    const cx = ajustarPolinomio(enPantalla, usados.map((m, i) => m.pantalla.x - enPantalla[i].x));
    const cy = ajustarPolinomio(enPantalla, usados.map((m, i) => m.pantalla.y - enPantalla[i].y));
    const malla = cx && cy ? { tipo: 'poli', cx, cy } : null;
    return { h, malla };
  };
  let modelo = ajustar();

  // Descartar mediciones que no cuadran (un reflejo, una mano, un objeto).
  // Con el lente ya corregido, las mediciones buenas casi no dejan error, así
  // que una que sobresale mucho de las demás es una medición mala.
  while (usados.length > 6) {
    const mapear = crearMapeo({ mapa: modelo });
    const errores = usados.map((m) => dist(mapear(m.camara.x, m.camara.y, false), m.pantalla));
    const ordenados = [...errores].sort((a, b) => a - b);
    const mediana = ordenados[Math.floor(ordenados.length / 2)];
    if (ordenados.at(-1) <= Math.max(mediana * 5, 0.006)) break;
    const peor = errores.indexOf(ordenados.at(-1));
    descartados.push(usados[peor]);
    usados = usados.filter((_, i) => i !== peor);
    modelo = ajustar();
  }
  const errorHomografia = errorMedio(modelo.h, usados.map((m) => m.camara), usados.map((m) => m.pantalla));
  return { h: modelo.h, malla: modelo.malla, usados, descartados, errorHomografia };
}

// Un punto de la malla que no se vio toma el promedio de sus vecinos.
function rellenarHuecos(arr, n, filas) {
  for (let pasada = 0; pasada < n + filas && arr.some((v) => v === null); pasada++) {
    const copia = [...arr];
    for (let i = 0; i < arr.length; i++) {
      if (copia[i] !== null) continue;
      const c = i % n, f = Math.floor(i / n);
      const vecinos = [[c - 1, f], [c + 1, f], [c, f - 1], [c, f + 1]]
        .filter(([x, y]) => x >= 0 && y >= 0 && x < n && y < filas)
        .map(([x, y]) => copia[y * n + x]).filter((v) => v !== null);
      if (vecinos.length) arr[i] = vecinos.reduce((a, b) => a + b, 0) / vecinos.length;
    }
  }
  for (let i = 0; i < arr.length; i++) if (arr[i] === null) arr[i] = 0;
}

/** Error de una calibración en puntos de control: { medio, maximo } en fracción de pantalla. */
export function medirError(mapear, controles) {
  const vistos = controles.filter((m) => m.camara);
  if (!vistos.length) return null;
  const errores = vistos.map((m) => dist(mapear(m.camara.x, m.camara.y, false), m.pantalla));
  return { medio: errores.reduce((a, b) => a + b, 0) / errores.length, maximo: Math.max(...errores), vistos: vistos.length };
}

/** Calificación para personas: lo que importa es cuánto se corre bajo el dedo. */
export function calificar(error, anchoPantalla = 1920) {
  if (!error) return { nota: 'sin medir', ok: false };
  const px = error.medio * anchoPantalla;
  if (error.medio < 0.006) return { nota: 'Excelente', ok: true, px };
  if (error.medio < 0.012) return { nota: 'Muy buena', ok: true, px };
  if (error.medio < 0.025) return { nota: 'Aceptable', ok: true, px };
  return { nota: 'Hay que repetirla', ok: false, px };
}

/**
 * Afinado con el dedo: para cada mira, dónde quedó el dedo (ya calibrado sin
 * afinado) frente a dónde estaba la mira. Devuelve una rejilla 3×3 de desvíos.
 */
export function rejillaDedo(toques, xs = [0.1, 0.5, 0.9], ys = [0.1, 0.5, 0.9], limite = 0.05) {
  const n = xs.length;
  const dx = new Array(n * ys.length).fill(null), dy = new Array(n * ys.length).fill(null);
  for (const t of toques) {
    const c = xs.indexOf(t.mira.x), f = ys.indexOf(t.mira.y);
    if (c < 0 || f < 0) continue;
    dx[f * n + c] = recortar(t.mira.x - t.dedo.x, limite);
    dy[f * n + c] = recortar(t.mira.y - t.dedo.y, limite);
  }
  if (dx.every((v) => v === null)) return null;
  rellenarHuecos(dx, n, ys.length);
  rellenarHuecos(dy, n, ys.length);
  return { xs: [...xs], ys: [...ys], dx, dy };
}

/** Zona que ilumina el proyector, a partir de la diferencia blanco - negro. */
export function zonaProyectada(negro, blanco, ancho, alto) {
  const dif = new Float32Array(negro.length);
  let max = 0;
  for (let i = 0; i < dif.length; i++) { dif[i] = Math.max(0, blanco[i] - negro[i]); if (dif[i] > max) max = dif[i]; }
  if (max < 20) return null;
  const umbral = max * 0.35;
  let n = 0, x0 = ancho, y0 = alto, x1 = 0, y1 = 0, suma = 0, ambiente = 0;
  const bordes = { izquierda: 0, derecha: 0, arriba: 0, abajo: 0 };
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      if (dif[i] <= umbral) continue;
      n++; suma += dif[i]; ambiente += negro[i];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x <= 1) bordes.izquierda++; if (x >= ancho - 2) bordes.derecha++;
      if (y <= 1) bordes.arriba++; if (y >= alto - 2) bordes.abajo++;
    }
  }
  if (n < ancho * alto * 0.01) return null;
  // Un lado está cortado si la zona toca el borde de la imagen en un buen tramo
  const cortado = {
    izquierda: bordes.izquierda > alto * 0.08, derecha: bordes.derecha > alto * 0.08,
    arriba: bordes.arriba > ancho * 0.08, abajo: bordes.abajo > ancho * 0.08,
  };
  return {
    caja: { x0: x0 / ancho, y0: y0 / alto, x1: (x1 + 1) / ancho, y1: (y1 + 1) / alto },
    area: n / (ancho * alto),
    cortado,
    completa: !Object.values(cortado).some(Boolean),
    // Cuánto más ilumina el proyector que la luz del cuarto (0..1+)
    contraste: (suma / n) / Math.max(10, ambiente / n),
    brillo: suma / n,
  };
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function recortar(v, l) { return Math.max(-l, Math.min(l, v)); }
