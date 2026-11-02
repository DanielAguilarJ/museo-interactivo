// Uso del museo en esta computadora: cuántas veces se abre cada sala, cuánto
// tiempo se queda la gente y cuántos retos resuelve. Solo números: nunca se
// guardan imágenes ni datos de los niños, y nada sale de la computadora.

const CLAVE = 'museo-estadisticas';

function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch (e) { return {}; }
}

export const estadisticas = {
  datos: leer(),
  actual: null,

  _sala(id) {
    const d = this.datos;
    d.salas ??= {};
    return (d.salas[id] ??= { visitas: 0, segundos: 0, retos: 0 });
  },
  _guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(this.datos)); } catch (e) { /* lleno */ } },

  entrar(id) {
    this.salir();
    this.datos.desde ??= new Date().toISOString();
    this._sala(id).visitas++;
    this.actual = { id, desde: performance.now() };
    this._guardar();
  },
  salir() {
    if (!this.actual) return;
    // Visitas de más de 10 minutos casi siempre son una sala abandonada
    this._sala(this.actual.id).segundos += Math.min(600, (performance.now() - this.actual.desde) / 1000);
    this.actual = null;
    this._guardar();
  },
  reto(id) { this._sala(id).retos++; this._guardar(); },

  resumen(salas) {
    return salas.map((s) => {
      const d = this.datos.salas?.[s.id] || { visitas: 0, segundos: 0, retos: 0 };
      return { titulo: s.titulo, icono: s.icono, visitas: d.visitas, minutosPromedio: d.visitas ? d.segundos / d.visitas / 60 : 0, retos: d.retos };
    });
  },
  borrar() { this.datos = {}; this._guardar(); },
};
