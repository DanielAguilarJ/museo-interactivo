// Retos: cada sala propone misiones cortas («Encuentra el planeta más
// grande»). El niño explora para resolverlas; al acertar hay confeti, sonido
// y una explicación. Así se queda más tiempo y aprende buscando, no solo
// tocando al azar. Funcionan con las claves de las fichas de cada sala.

import { decir } from './narrador.js';

export class Retos {
  constructor(ui, sonido) {
    this.sonido = sonido;
    this.el = document.createElement('div');
    this.el.className = 'reto';
    this.el.hidden = true;
    ui.appendChild(this.el);
    this.lienzo = document.createElement('canvas');
    this.lienzo.className = 'confeti';
    document.body.appendChild(this.lienzo);
    this.particulas = [];
    this.lista = [];
    this.indice = 0;
    this.activo = true;
    this.alCompletar = null;
  }

  iniciar(sala) {
    clearTimeout(this.siguiente);
    this.lista = this.activo ? barajar(sala?.retos || []).slice(0, 4) : [];
    this.indice = 0;
    this.resueltos = 0;
    this.mostrar();
  }

  actual() { return this.lista[this.indice] || null; }

  mostrar(texto) {
    const r = this.actual();
    if (!this.lista.length) { this.el.hidden = true; return; }
    this.el.hidden = false;
    if (texto) { this.el.innerHTML = texto; return; }
    if (!r) {
      this.el.innerHTML = '<span class="estrella">⭐</span> ¡Completaste todos los retos de esta sala!';
      return;
    }
    this.el.innerHTML = `<small>Reto ${this.indice + 1} de ${this.lista.length}</small>${escapar(r.texto)}`;
  }

  /** Cada vez que aparece una ficha: ¿era lo que pedía el reto? */
  tocado(clave) {
    const r = this.actual();
    if (!r || this.esperando || !r.ids.includes(clave)) return false;
    this.esperando = true;
    this.resueltos++;
    this.sonido?.descubrir();
    this.confeti();
    this.mostrar(`<span class="estrella">🎉</span> ¡Muy bien! ${escapar(r.porque || '')}`);
    decir('¡Muy bien!');
    this.siguiente = setTimeout(() => {
      this.esperando = false;
      this.indice++;
      this.mostrar();
      if (!this.actual()) this.alCompletar?.(this.resueltos);
      else setTimeout(() => decir(this.actual()?.texto || ''), 400);
    }, 4200);
    return true;
  }

  /** Lee el reto en voz alta al entrar a la sala. */
  anunciar() { const r = this.actual(); if (r) decir(r.texto); }

  terminar() {
    clearTimeout(this.siguiente);
    this.esperando = false;
    this.lista = [];
    this.el.hidden = true;
  }

  confeti() {
    const colores = ['#ffc861', '#6fe0ff', '#ff7a8a', '#7be38f', '#c780ff'];
    const r = this.el.getBoundingClientRect();
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, v = 200 + Math.random() * 420;
      this.particulas.push({ x: r.left + r.width / 2, y: r.bottom, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 250, giro: Math.random() * 6, vida: 1.6 + Math.random(), color: colores[i % colores.length] });
    }
    if (!this.animando) { this.animando = true; this.ultimo = performance.now(); requestAnimationFrame((t) => this.paso(t)); }
  }

  paso(t) {
    const dt = Math.min(0.05, (t - this.ultimo) / 1000);
    this.ultimo = t;
    const c = this.lienzo, ctx = c.getContext('2d');
    if (c.width !== innerWidth || c.height !== innerHeight) { c.width = innerWidth; c.height = innerHeight; }
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = this.particulas.length - 1; i >= 0; i--) {
      const p = this.particulas[i];
      p.vida -= dt;
      if (p.vida <= 0) { this.particulas.splice(i, 1); continue; }
      p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.99; p.giro += dt * 8;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.giro);
      ctx.globalAlpha = Math.min(1, p.vida);
      ctx.fillStyle = p.color; ctx.fillRect(-6, -3, 12, 6);
      ctx.restore();
    }
    if (this.particulas.length) requestAnimationFrame((x) => this.paso(x));
    else { this.animando = false; ctx.clearRect(0, 0, c.width, c.height); }
  }
}

function barajar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function escapar(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
