// Prueba de la homografía: node --test pruebas/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularHomografia, aplicar, errorMedio, invertir } from '../web/js/homografia.js';

// Una cámara de techo típica: imagen girada 180°, con perspectiva.
const real = [-0.8, 0.05, 0.9, -0.04, -0.7, 0.85, 0.06, -0.08, 1];
const malla = [];
for (const x of [0.12, 0.5, 0.88]) for (const y of [0.12, 0.5, 0.88]) malla.push({ x, y });
const camara = malla.map((p) => {
  const inv = invertir(real);
  return aplicar(inv, p.x, p.y);
});

test('recupera la transformación con 9 puntos exactos', () => {
  const h = calcularHomografia(camara, malla);
  assert.ok(errorMedio(h, camara, malla) < 1e-9);
  const p = aplicar(h, camara[4].x, camara[4].y);
  assert.ok(Math.abs(p.x - 0.5) < 1e-9 && Math.abs(p.y - 0.5) < 1e-9);
});

test('con 4 esquinas también funciona', () => {
  const idx = [0, 2, 6, 8];
  const h = calcularHomografia(idx.map((i) => camara[i]), idx.map((i) => malla[i]));
  assert.ok(errorMedio(h, camara, malla) < 1e-9);
});

test('tolera ruido de medición pequeño', () => {
  const ruidosa = camara.map((p, i) => ({ x: p.x + ((i % 3) - 1) * 0.002, y: p.y + ((i % 2) - 0.5) * 0.002 }));
  const h = calcularHomografia(ruidosa, malla);
  assert.ok(errorMedio(h, camara, malla) < 0.01);
});

test('rechaza puntos alineados', () => {
  const linea = [0, 0.25, 0.5, 0.75].map((t) => ({ x: t, y: t }));
  assert.throws(() => calcularHomografia(linea, linea));
});

test('invertir deshace aplicar', () => {
  const inv = invertir(real);
  const p = aplicar(real, 0.3, 0.7);
  const q = aplicar(inv, p.x, p.y);
  assert.ok(Math.abs(q.x - 0.3) < 1e-9 && Math.abs(q.y - 0.7) < 1e-9);
});
