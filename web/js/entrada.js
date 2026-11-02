// Reúne las manos de la cámara con el ratón (para el encargado y para probar
// sin cámara) y dibuja el brillo de cada dedo sobre la mesa.

const PUNTAS = [4, 8, 12, 16, 20];

export class Entrada {
  constructor(lienzo) {
    this.lienzo = lienzo;
    this.ctx = lienzo.getContext('2d');
    this.raton = { x: 0, y: 0, ultimo: -1e9, abajo: false };
    this.estelas = new Map();
    this.progresos = new Map(); // id de mano -> 0..1 (anillo de "mantén la mano")
    this.camara = [];
    this.ratonActivo = true;
    this.fijas = leerManosDeUrl();

    addEventListener('pointermove', (e) => this._raton(e));
    addEventListener('pointerdown', (e) => { this._raton(e); this.raton.abajo = true; });
    addEventListener('pointerup', () => { this.raton.abajo = false; });
    addEventListener('pointerleave', () => { this.raton.ultimo = -1e9; });
  }

  _raton(e) {
    this.raton.x = e.clientX;
    this.raton.y = e.clientY;
    this.raton.ultimo = performance.now();
    document.body.classList.remove('sin-raton');
  }

  /** Todas las manos de este instante, en píxeles de la pantalla. */
  manos(ahora) {
    const lista = [...this.camara];
    // Manos controladas desde fuera (pruebas automáticas): window.museoManos = [{x:0.5,y:0.5}]
    const externas = window.museoManos || this.fijas;
    if (externas) {
      externas.forEach((m, i) => {
        const mano = manoSintetica(900 + i, m.x * innerWidth, m.y * innerHeight, !!m.pellizco);
        if (m.crudo) mano.crudo = m.crudo; // las pruebas pueden simular lo que ve la cámara
        lista.push(mano);
      });
    }
    if (this.ratonActivo && ahora - this.raton.ultimo < 4000) {
      lista.push(manoSintetica(0, this.raton.x, this.raton.y, this.raton.abajo, 'raton'));
    } else if (ahora - this.raton.ultimo > 4000) {
      document.body.classList.add('sin-raton');
    }
    return lista;
  }

  progreso(idMano, valor) { this.progresos.set(idMano, valor); }

  dibujar(manos, ahora) {
    const { ctx, lienzo } = this;
    const dpr = devicePixelRatio || 1;
    if (lienzo.width !== innerWidth * dpr || lienzo.height !== innerHeight * dpr) {
      lienzo.width = innerWidth * dpr;
      lienzo.height = innerHeight * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const r = Math.min(innerWidth, innerHeight) * 0.022;
    const vivos = new Set();

    for (const m of manos) {
      vivos.add(m.id);
      // Estela del dedo índice
      const estela = this.estelas.get(m.id) || [];
      estela.push({ x: m.x, y: m.y, t: ahora });
      while (estela.length && ahora - estela[0].t > 260) estela.shift();
      this.estelas.set(m.id, estela);
      ctx.lineCap = 'round';
      for (let i = 1; i < estela.length; i++) {
        const a = i / estela.length;
        ctx.strokeStyle = `rgba(150, 235, 255, ${a * 0.45})`;
        ctx.lineWidth = r * 0.7 * a;
        ctx.beginPath();
        ctx.moveTo(estela[i - 1].x, estela[i - 1].y);
        ctx.lineTo(estela[i].x, estela[i].y);
        ctx.stroke();
      }

      // Chispas en las puntas de los dedos (solo manos de cámara)
      if (m.puntos) {
        for (const i of PUNTAS) {
          if (i === 8) continue;
          const p = m.puntos[i];
          brillo(ctx, p.x, p.y, r * 0.45, 'rgba(255, 220, 150, 0.55)');
        }
      }

      // Puntero principal
      const color = m.pellizco ? 'rgba(255, 200, 97, 0.95)' : 'rgba(150, 235, 255, 0.95)';
      brillo(ctx, m.x, m.y, r * 1.6, color.replace('0.95', '0.35'));
      ctx.strokeStyle = color;
      ctx.lineWidth = r * 0.22;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.stroke();

      const prog = this.progresos.get(m.id) || 0;
      if (prog > 0.01) {
        ctx.strokeStyle = 'rgba(255, 200, 97, 1)';
        ctx.lineWidth = r * 0.42;
        ctx.beginPath();
        ctx.arc(m.x, m.y, r * 1.55, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const id of this.estelas.keys()) if (!vivos.has(id)) this.estelas.delete(id);
    this.progresos.clear();
  }
}

function brillo(ctx, x, y, radio, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radio);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radio, 0, Math.PI * 2);
  ctx.fill();
}

function manoSintetica(id, x, y, pellizco, fuente = 'prueba') {
  const radio = Math.min(innerWidth, innerHeight) * 0.05;
  return { id, x, y, palma: { x, y: y + radio * 0.8 }, radio, pellizco, abierta: !pellizco, edad: 1e6, puntos: null, fuente };
}

function leerManosDeUrl() {
  const p = new URLSearchParams(location.search).get('manos');
  if (!p) return null;
  return p.split(';').map((par) => {
    const [x, y, z] = par.split(',');
    return { x: +x, y: +y, pellizco: z === 'p' };
  });
}

/**
 * "Mantén la mano encima": una zona se activa cuando una mano se queda sobre
 * ella el tiempo indicado. Pensado para niños: no hace falta hacer clic.
 */
export class Permanencia {
  constructor(segundos = 1.4) {
    this.segundos = segundos;
    this.tiempos = new Map();
    this.disparadas = new Set();
  }

  /**
   * @param manos   lista de manos
   * @param zonas   [{id, contiene(x, y)}]
   * @param dt      segundos desde el fotograma anterior
   * @param entrada Entrada (para pintar el anillo de progreso)
   * @returns id de la zona activada o null
   */
  actualizar(manos, zonas, dt, entrada) {
    let activada = null;
    for (const z of zonas) {
      const encima = manos.filter((m) => z.contiene(m.x, m.y));
      let t = this.tiempos.get(z.id) || 0;
      if (encima.length) {
        t += dt;
        if (t >= this.segundos && !this.disparadas.has(z.id)) {
          this.disparadas.add(z.id);
          activada = z.id;
        }
      } else {
        t = Math.max(0, t - dt * 3);
        if (t === 0) this.disparadas.delete(z.id);
      }
      this.tiempos.set(z.id, t);
      const prog = this.disparadas.has(z.id) ? 0 : Math.min(1, t / this.segundos);
      for (const m of encima) entrada?.progreso(m.id, prog);
    }
    return activada;
  }

  progreso(id) { return Math.min(1, (this.tiempos.get(id) || 0) / this.segundos); }
  reiniciar() { this.tiempos.clear(); this.disparadas.clear(); }
}
