// El vestíbulo: las salas del museo como tarjetas sobre la mesa.
// Un niño entra a una sala dejando la mano encima un momento.

import { Permanencia } from './entrada.js';
import { escapar } from './fichas.js';

export class Vestibulo {
  constructor(ui, salas, alEntrar) {
    this.salas = salas;
    this.alEntrar = alEntrar;
    this.permanencia = new Permanencia(1.5);
    this.el = document.createElement('div');
    this.el.className = 'vestibulo';
    const columnas = salas.length <= 4 ? 2 : 3;
    this.el.innerHTML = `
      <h1>Museo Interactivo<small>Explora con tus manos</small></h1>
      <div class="salas${salas.length > 4 ? ' muchas' : ''}" style="--columnas:${columnas}">
        ${salas.map((s) => `
          <div class="sala" data-id="${escapar(s.id)}" style="--color:${escapar(s.color)}">
            <div class="icono">${escapar(s.icono)}</div>
            <div>
              <div class="tema">${escapar(s.tema)}</div>
              <h2>${escapar(s.titulo)}</h2>
              <p>${escapar(s.descripcion)}</p>
            </div>
            <div class="llenado"></div>
          </div>`).join('')}
      </div>
      <div class="instruccion">✋ Deja tu mano sobre una sala para entrar</div>`;
    ui.appendChild(this.el);
    this.tarjetas = [...this.el.querySelectorAll('.sala')];
    // El encargado también puede entrar con un clic.
    this.tarjetas.forEach((t) => t.addEventListener('click', () => this.alEntrar(t.dataset.id)));
    this.el.style.pointerEvents = 'auto';
  }

  actualizar(dt, manos, entrada) {
    const zonas = this.tarjetas.map((t) => {
      const r = t.getBoundingClientRect();
      return { id: t.dataset.id, contiene: (x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom };
    });
    const activada = this.permanencia.actualizar(manos, zonas, dt, entrada);
    for (const t of this.tarjetas) {
      const p = this.permanencia.progreso(t.dataset.id);
      t.style.setProperty('--progreso', p.toFixed(3));
      t.classList.toggle('encima', p > 0.02);
    }
    if (activada) this.alEntrar(activada);
  }

  destruir() { this.el.remove(); }
}
