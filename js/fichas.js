// Fichas de museo: la tarjeta con el nombre y los datos de lo que el niño toca.

export class Fichas {
  constructor(contenedor) {
    this.contenedor = contenedor;
    this.actuales = new Map();
  }

  /**
   * Muestra (o mueve) la ficha con esa clave junto al punto x, y.
   * info = { titulo, tema, texto: [..], dato, color }
   */
  mostrar(clave, info, x, y, radio = 0) {
    let f = this.actuales.get(clave);
    if (!f) {
      const el = document.createElement('div');
      el.className = 'ficha';
      el.style.setProperty('--color', info.color || 'var(--oro)');
      el.innerHTML = `
        ${info.tema ? `<div class="tema">${escapar(info.tema)}</div>` : ''}
        <h3>${escapar(info.titulo)}</h3>
        ${(info.texto || []).map((t) => `<p>${escapar(t)}</p>`).join('')}
        ${info.dato ? `<div class="dato">${escapar(info.dato)}</div>` : ''}`;
      this.contenedor.appendChild(el);
      requestAnimationFrame(() => el.classList.add('visible'));
      f = { el, ancho: 0, alto: 0 };
      this.actuales.set(clave, f);
      try { this.alMostrar?.(clave, info); } catch (e) { console.error(e); } // voz y retos
    }
    f.vista = performance.now();
    this._colocar(f, x, y, radio);
    return f;
  }

  // (x, y) es el centro del objeto y radio su tamaño: la ficha nunca lo tapa.
  _colocar(f, x, y, radio) {
    const r = f.el.getBoundingClientRect();
    const margen = Math.min(innerWidth, innerHeight) * 0.03;
    // Hacia el borde más cercano, para no tapar el centro de la sala; si no
    // cabe de ese lado, del otro.
    const derecha = x + radio + margen;
    const izquierda = x - radio - margen - r.width;
    let izq = x >= innerWidth / 2 ? derecha : izquierda;
    if (izq + r.width > innerWidth - margen) izq = izquierda;
    if (izq < margen) izq = derecha;
    let arriba = y - r.height / 2;
    izq = Math.max(margen, Math.min(innerWidth - r.width - margen, izq));
    arriba = Math.max(margen, Math.min(innerHeight - r.height - margen, arriba));
    f.el.style.left = `${izq}px`;
    f.el.style.top = `${arriba}px`;
  }

  /** Cierra las fichas que no se han vuelto a mostrar en `ms` milisegundos. */
  limpiar(ms = 2500) {
    const ahora = performance.now();
    for (const [clave, f] of this.actuales) {
      if (ahora - f.vista > ms) this.ocultar(clave);
    }
  }

  ocultar(clave) {
    const f = this.actuales.get(clave);
    if (!f) return;
    this.actuales.delete(clave);
    f.el.classList.remove('visible');
    setTimeout(() => f.el.remove(), 400);
  }

  vaciar() {
    for (const clave of [...this.actuales.keys()]) this.ocultar(clave);
  }
}

export function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
