// Fotos de la cámara para calibrar: sincronizadas con cada cuadro nuevo del
// video, promediadas para quitar ruido, y búsqueda precisa del punto de luz.

export class Medidor {
  constructor(video, ancho = 640) {
    this.video = video;
    this.ancho = ancho;
    this.alto = Math.round((ancho * video.videoHeight) / video.videoWidth);
    this.lienzo = new OffscreenCanvas(this.ancho, this.alto);
    this.ctx = this.lienzo.getContext('2d', { willReadFrequently: true });
    this.latenciaMs = 200; // se mide en cada calibración
  }

  /** Espera a que la cámara entregue un cuadro nuevo. */
  cuadroNuevo() {
    return new Promise((r) => {
      if (this.video.requestVideoFrameCallback) this.video.requestVideoFrameCallback(() => r());
      else setTimeout(r, 34);
    });
  }

  esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

  leer() {
    this.ctx.drawImage(this.video, 0, 0, this.ancho, this.alto);
    const d = this.ctx.getImageData(0, 0, this.ancho, this.alto).data;
    const lum = new Float32Array(this.ancho * this.alto);
    for (let i = 0; i < lum.length; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    return lum;
  }

  /** Promedio de n cuadros nuevos seguidos. */
  async foto(n = 2) {
    let suma = null;
    for (let k = 0; k < n; k++) {
      await this.cuadroNuevo();
      const l = this.leer();
      if (!suma) suma = l; else for (let i = 0; i < l.length; i++) suma[i] += l[i];
    }
    if (n > 1) for (let i = 0; i < suma.length; i++) suma[i] /= n;
    return suma;
  }

  /** Espera a que lo que cambió en la pantalla ya aparezca en la cámara. */
  async asentar() {
    await this.esperar(this.latenciaMs);
    await this.cuadroNuevo();
  }

  brilloMedio(lum, caja = null) {
    let s = 0, n = 0;
    const x0 = caja ? Math.floor(caja.x0 * this.ancho) : 0, x1 = caja ? Math.ceil(caja.x1 * this.ancho) : this.ancho;
    const y0 = caja ? Math.floor(caja.y0 * this.alto) : 0, y1 = caja ? Math.ceil(caja.y1 * this.alto) : this.alto;
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { s += lum[y * this.ancho + x]; n++; }
    return n ? s / n : 0;
  }
}

/**
 * Busca dónde se encendió el punto: la zona que más se aclaró entre las dos
 * fotos. Devuelve null si no hay un punto claro y único (por ejemplo, si
 * alguien pasó la mano o se encendió una luz).
 */
export function buscarMancha(fondo, luz, ancho, alto) {
  const dif = new Float32Array(fondo.length);
  for (let i = 0; i < fondo.length; i++) { const d = luz[i] - fondo[i]; dif[i] = d > 0 ? d : 0; }
  // Suavizado 3×3 para que un píxel suelto no gane
  const suave = new Float32Array(dif.length);
  let max = 0, imax = -1;
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * ancho + x;
      const v = (dif[i - ancho - 1] + dif[i - ancho] + dif[i - ancho + 1] + dif[i - 1] + dif[i] + dif[i + 1] + dif[i + ancho - 1] + dif[i + ancho] + dif[i + ancho + 1]) / 9;
      suave[i] = v;
      if (v > max) { max = v; imax = i; }
    }
  }
  if (max < 18 || imax < 0) return null;
  const umbral = max * 0.5;
  const cx = imax % ancho, cy = Math.floor(imax / ancho);
  const radio = Math.max(6, Math.round(ancho * 0.06));
  let sx = 0, sy = 0, sp = 0, dentro = 0, total = 0;
  for (let i = 0; i < suave.length; i++) if (suave[i] > umbral) total++;
  for (let y = Math.max(0, cy - radio); y < Math.min(alto, cy + radio); y++) {
    for (let x = Math.max(0, cx - radio); x < Math.min(ancho, cx + radio); x++) {
      const v = dif[y * ancho + x] - umbral;
      if (suave[y * ancho + x] > umbral) dentro++;
      if (v > 0) { sx += x * v; sy += y * v; sp += v; }
    }
  }
  if (!sp || dentro < 3) return null;
  // Si buena parte de lo que se aclaró está lejos del punto, la medición no es confiable
  if (dentro / total < 0.7) return null;
  return { x: (sx / sp + 0.5) / ancho, y: (sy / sp + 0.5) / alto, fuerza: max, pixeles: dentro };
}
