// Homografía: convierte un punto visto por la cámara (0..1) en el punto de la
// imagen del proyector (0..1). Así la mano que la cámara ve en la mesa cae
// justo debajo de lo que el proyector dibuja, aunque la cámara esté girada,
// inclinada o al revés.

export const IDENTIDAD = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/**
 * Calcula la homografía H (9 números, h8 = 1) por mínimos cuadrados.
 * @param {{x:number,y:number}[]} origen  puntos en la cámara
 * @param {{x:number,y:number}[]} destino puntos en el proyector
 * Necesita al menos 4 pares que no estén en línea.
 */
export function calcularHomografia(origen, destino) {
  if (origen.length < 4 || origen.length !== destino.length) {
    throw new Error('Hacen falta al menos 4 pares de puntos');
  }
  // Ecuaciones normales AᵀA·h = Aᵀb con 8 incógnitas
  const ata = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const atb = new Array(8).fill(0);
  const sumar = (fila, b) => {
    for (let i = 0; i < 8; i++) {
      atb[i] += fila[i] * b;
      for (let j = 0; j < 8; j++) ata[i][j] += fila[i] * fila[j];
    }
  };
  for (let k = 0; k < origen.length; k++) {
    const { x, y } = origen[k];
    const { x: u, y: v } = destino[k];
    sumar([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    sumar([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  const h = resolver(ata, atb);
  if (!h) throw new Error('Los puntos no sirven (están alineados o repetidos)');
  return [...h, 1];
}

// Eliminación gaussiana con pivoteo parcial. Devuelve null si es singular.
function resolver(a, b) {
  const n = b.length;
  const m = a.map((fila, i) => [...fila, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let f = col + 1; f < n; f++) if (Math.abs(m[f][col]) > Math.abs(m[piv][col])) piv = f;
    if (Math.abs(m[piv][col]) < 1e-12) return null;
    [m[col], m[piv]] = [m[piv], m[col]];
    for (let f = 0; f < n; f++) {
      if (f === col) continue;
      const factor = m[f][col] / m[col][col];
      for (let c = col; c <= n; c++) m[f][c] -= factor * m[col][c];
    }
  }
  return m.map((fila, i) => fila[n] / fila[i]);
}

/** Aplica H a un punto. */
export function aplicar(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

/** Error medio (en fracción de pantalla) de H sobre los pares dados. */
export function errorMedio(h, origen, destino) {
  let total = 0;
  for (let k = 0; k < origen.length; k++) {
    const p = aplicar(h, origen[k].x, origen[k].y);
    total += Math.hypot(p.x - destino[k].x, p.y - destino[k].y);
  }
  return total / origen.length;
}

/** Inversa de una matriz 3x3 (para dibujar en la vista de cámara dónde cae la mesa). */
export function invertir(h) {
  const [a, b, c, d, e, f, g, hh, i] = h;
  const A = e * i - f * hh, B = -(d * i - f * g), C = d * hh - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const inv = [
    A, -(b * i - c * hh), b * f - c * e,
    B, a * i - c * g, -(a * f - c * d),
    C, -(a * hh - b * g), a * e - b * d,
  ].map((v) => v / det);
  return inv.map((v) => v / inv[8]);
}
