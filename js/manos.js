// Detección de manos con MediaPipe (funciona sin internet: modelo y motor
// están en la carpeta del museo) y conversión a coordenadas de la mesa.

import { FilesetResolver, HandLandmarker } from 'mediapipe';

const PUNTA_INDICE = 8;
const PUNTA_PULGAR = 4;
const MUNECA = 0;
const BASE_MEDIO = 9;
const PALMA = [0, 5, 9, 13, 17];
const PUNTAS = [8, 12, 16, 20];

export class DetectorManos {
  constructor() {
    this.detector = null;
    this.ultimoTiempoVideo = -1;
    this.ultimaMarca = 0;
    this.motor = '';
    this.msPromedio = 0; // lo que tarda en mirar cada cuadro
    this.reiniciando = false;
  }

  async iniciar(maxManos = 6) {
    this.maxManos = maxManos;
    const archivos = await FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm');
    const opciones = (delegate) => ({
      baseOptions: { modelAssetPath: './modelos/hand_landmarker.task', delegate },
      runningMode: 'VIDEO',
      numHands: maxManos,
      minHandDetectionConfidence: 0.45,
      minHandPresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });
    try {
      this.detector = await HandLandmarker.createFromOptions(archivos, opciones('GPU'));
      this.motor = 'GPU';
    } catch (e) {
      console.warn('GPU no disponible para manos, uso CPU', e);
      this.detector = await HandLandmarker.createFromOptions(archivos, opciones('CPU'));
      this.motor = 'CPU';
    }
  }

  /** Devuelve los puntos de cada mano (0..1 de la cámara) o null si no hay imagen nueva. */
  detectar(video, ahora) {
    if (!this.detector || video.readyState < 2) return null;
    if (video.currentTime === this.ultimoTiempoVideo) return null;
    this.ultimoTiempoVideo = video.currentTime;
    // MediaPipe exige marcas de tiempo siempre crecientes
    const marca = Math.max(Math.round(ahora), this.ultimaMarca + 1);
    this.ultimaMarca = marca;
    const inicio = performance.now();
    try {
      const r = this.detector.detectForVideo(video, marca).landmarks || [];
      this.msPromedio = this.msPromedio * 0.95 + (performance.now() - inicio) * 0.05;
      return r;
    } catch (e) {
      console.warn('El detector de manos falló; lo reinicio', e);
      this.reiniciar();
      return [];
    }
  }

  async reiniciar() {
    if (this.reiniciando) return;
    this.reiniciando = true;
    const viejo = this.detector;
    this.detector = null;
    try { viejo?.close(); } catch (e) { /* ya estaba roto */ }
    await new Promise((r) => setTimeout(r, 500));
    try { await this.iniciar(this.maxManos); } catch (e) { console.error(e); }
    this.ultimaMarca = 0;
    this.reiniciando = false;
  }
}

// ---- Filtro "One Euro": quita el temblor sin añadir retraso al moverse rápido
class FiltroEuro {
  constructor(minCorte = 1.5, beta = 0.007, corteD = 1) {
    Object.assign(this, { minCorte, beta, corteD, x: null, dx: 0, t: 0 });
  }
  static alfa(corte, dt) {
    const tau = 1 / (2 * Math.PI * corte);
    return 1 / (1 + tau / dt);
  }
  filtrar(valor, t) {
    if (this.x === null) { this.x = valor; this.t = t; return valor; }
    const dt = Math.max(1e-3, (t - this.t) / 1000);
    this.t = t;
    const dxCrudo = (valor - this.x) / dt;
    this.dx += FiltroEuro.alfa(this.corteD, dt) * (dxCrudo - this.dx);
    const corte = this.minCorte + this.beta * Math.abs(this.dx);
    this.x += FiltroEuro.alfa(corte, dt) * (valor - this.x);
    return this.x;
  }
}

class Pista {
  constructor(id) {
    this.id = id;
    this.f = [new FiltroEuro(), new FiltroEuro(), new FiltroEuro(), new FiltroEuro()];
    this.nacio = 0;
    this.visto = 0;
    this.mano = null;
  }
}

/** Sigue a cada mano entre fotogramas y le da un número estable. */
export class SeguidorManos {
  constructor() {
    this.pistas = [];
    this.siguienteId = 1;
    this.manos = [];
  }

  /**
   * @param mapear (x, y, conDedo) => {x, y}: de la cámara (0..1) a la pantalla (0..1)
   */
  actualizar(landmarks, mapear, ancho, alto, ahora) {
    const vistas = landmarks.map((lm) => {
      const puntos = lm.map((p, i) => {
        // El afinado con el dedo solo corrige la punta del índice (la que toca)
        const q = mapear(p.x, p.y, i === PUNTA_INDICE);
        return { x: q.x * ancho, y: q.y * alto };
      });
      const palma = promedio(PALMA.map((i) => puntos[i]));
      const tam = Math.max(8, dist(puntos[MUNECA], puntos[BASE_MEDIO]));
      return { puntos, palma, tam, crudo: { x: lm[PUNTA_INDICE].x, y: lm[PUNTA_INDICE].y } };
    });

    const libres = new Set(this.pistas);
    const usadas = [];
    for (const v of vistas) {
      let mejor = null;
      let mejorD = Math.max(ancho, alto) * 0.12;
      for (const p of libres) {
        const d = dist(p.mano.palma, v.palma);
        if (d < mejorD) { mejor = p; mejorD = d; }
      }
      if (mejor) libres.delete(mejor);
      else { mejor = new Pista(this.siguienteId++); mejor.nacio = ahora; }
      mejor.visto = ahora;
      const indice = v.puntos[PUNTA_INDICE];
      const radio = v.tam * 0.9;
      mejor.mano = {
        id: mejor.id,
        x: mejor.f[0].filtrar(indice.x, ahora),
        y: mejor.f[1].filtrar(indice.y, ahora),
        palma: { x: mejor.f[2].filtrar(v.palma.x, ahora), y: mejor.f[3].filtrar(v.palma.y, ahora) },
        radio,
        pellizco: dist(v.puntos[PUNTA_PULGAR], indice) < v.tam * 0.38,
        abierta: promedio(PUNTAS.map((i) => ({ x: dist(v.puntos[i], v.puntos[MUNECA]), y: 0 }))).x > v.tam * 1.55,
        edad: ahora - mejor.nacio,
        puntos: v.puntos,
        crudo: v.crudo, // punta del índice tal como la ve la cámara (0..1)
        fuente: 'camara',
      };
      usadas.push(mejor);
    }
    // Una mano que se pierde un instante conserva su número durante 300 ms.
    const fantasmas = [...libres].filter((p) => ahora - p.visto < 300);
    this.pistas = [...usadas, ...fantasmas];
    this.manos = usadas.map((p) => p.mano);
    return this.manos;
  }

  vaciar() { this.pistas = []; this.manos = []; }
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function promedio(ps) {
  const s = ps.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / ps.length, y: s.y / ps.length };
}
