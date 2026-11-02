// Pruebas de la calibración: búsqueda del punto de luz, ajuste con malla de
// corrección del lente, descarte de reflejos, afinado con el dedo y zona del
// proyector.  node --test pruebas/calibracion.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarMancha } from '../web/js/calibracion/medir.js';
import { aplicar } from '../web/js/homografia.js';
import {
  puntosMalla, CONTROL, ajustarCalibracion, crearMapeo, medirError, calificar, rejillaDedo, zonaProyectada, interpolar,
} from '../web/js/calibracion/modelo.js';

const ANCHO = 320, ALTO = 180;

function imagen(fondo, puntos = [], ruido = 6, semilla = 1) {
  let s = semilla;
  const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const lum = new Float32Array(ANCHO * ALTO);
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      let v = fondo + (azar() - 0.5) * ruido + (x / ANCHO) * 30; // mesa con luz desigual
      for (const p of puntos) {
        const d = Math.hypot(x - p.x * ANCHO, y - p.y * ALTO);
        if (d < p.r) v += p.brillo * (1 - (d / p.r) ** 2);
      }
      lum[y * ANCHO + x] = Math.min(255, v);
    }
  }
  return lum;
}

// Cámara de techo: ve la imagen del proyector girada 180°, con perspectiva.
const PROYECTOR_A_CAMARA = [-0.7, 0.03, 0.85, 0.02, -0.62, 0.82, 0.05, 0.04, 1];
// Lente gran angular: curva hacia afuera lo que está lejos del centro.
function lente(p, k = 0.08) {
  const dx = p.x - 0.5, dy = p.y - 0.5, r2 = dx * dx + dy * dy;
  return { x: 0.5 + dx * (1 + k * r2 * 4), y: 0.5 + dy * (1 + k * r2 * 4) };
}
const verCamara = (p, k) => lente(aplicar(PROYECTOR_A_CAMARA, p.x, p.y), k);

test('encuentra el centro del punto proyectado', () => {
  const p = buscarMancha(imagen(60), imagen(60, [{ x: 0.3, y: 0.7, r: 9, brillo: 120 }], 6, 2), ANCHO, ALTO);
  assert.ok(p, 'debe encontrarlo');
  assert.ok(Math.abs(p.x - 0.3) < 0.01 && Math.abs(p.y - 0.7) < 0.015, JSON.stringify(p));
});

test('ignora un reflejo lejano más débil', () => {
  const luz = imagen(60, [{ x: 0.6, y: 0.4, r: 9, brillo: 140 }, { x: 0.1, y: 0.1, r: 6, brillo: 60 }], 6, 3);
  const p = buscarMancha(imagen(60), luz, ANCHO, ALTO);
  assert.ok(Math.abs(p.x - 0.6) < 0.01 && Math.abs(p.y - 0.4) < 0.015, JSON.stringify(p));
});

test('si no se encendió nada, no inventa un punto', () => {
  assert.equal(buscarMancha(imagen(60, [], 6, 4), imagen(60, [], 6, 5), ANCHO, ALTO), null);
});

test('si se aclara todo a la vez (una luz del cuarto), no da un punto falso', () => {
  assert.equal(buscarMancha(imagen(60, [], 6, 6), imagen(110, [], 6, 7), ANCHO, ALTO), null);
});

test('con dos puntos igual de brillantes, no elige uno al azar', () => {
  const luz = imagen(60, [{ x: 0.25, y: 0.5, r: 9, brillo: 130 }, { x: 0.75, y: 0.5, r: 9, brillo: 130 }], 6, 8);
  assert.equal(buscarMancha(imagen(60), luz, ANCHO, ALTO), null);
});

test('la malla corrige la curvatura del lente: acierta mejor que solo la homografía', () => {
  const medidos = puntosMalla().map((p) => ({ pantalla: { x: p.x, y: p.y }, camara: verCamara(p, 0.08), c: p.c, f: p.f }));
  const controles = CONTROL.map((p) => ({ pantalla: p, camara: verCamara(p, 0.08) }));
  const r = ajustarCalibracion(medidos);
  const soloH = medirError(crearMapeo({ mapa: { h: r.h } }), controles);
  const conMalla = medirError(crearMapeo({ mapa: { h: r.h, malla: r.malla } }), controles);
  assert.ok(conMalla.medio < soloH.medio * 0.25, `malla ${conMalla.medio} vs sola ${soloH.medio}`);
  assert.ok(conMalla.medio < 0.001, `error con malla ${conMalla.medio}`);
});

test('mediciones con ruido real (±1 px) siguen dando menos de 0.3 % de error', () => {
  let s = 3;
  const ruido = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * (2 / 640);
  const medidos = puntosMalla().map((p) => { const c = verCamara(p, 0.08); return { pantalla: { x: p.x, y: p.y }, camara: { x: c.x + ruido(), y: c.y + ruido() }, c: p.c, f: p.f }; });
  const r = ajustarCalibracion(medidos);
  assert.equal(r.descartados.length, 0, 'el ruido normal no se confunde con un reflejo');
  const error = medirError(crearMapeo({ mapa: { h: r.h, malla: r.malla } }), CONTROL.map((p) => ({ pantalla: p, camara: verCamara(p, 0.08) })));
  assert.ok(error.medio < 0.003, `error ${error.medio}`);
});

test('descarta una medición mala (un reflejo o una mano) y sigue acertando', () => {
  const medidos = puntosMalla().map((p) => ({ pantalla: { x: p.x, y: p.y }, camara: verCamara(p, 0), c: p.c, f: p.f }));
  medidos[7].camara = { x: medidos[7].camara.x + 0.09, y: medidos[7].camara.y - 0.05 }; // medición equivocada
  const r = ajustarCalibracion(medidos);
  assert.equal(r.descartados.length, 1);
  const error = medirError(crearMapeo({ mapa: { h: r.h, malla: r.malla } }), CONTROL.map((p) => ({ pantalla: p, camara: verCamara(p, 0) })));
  assert.ok(error.medio < 0.003, `error ${error.medio}`);
});

test('si faltan puntos de una orilla, sigue funcionando', () => {
  const medidos = puntosMalla().map((p) => ({ pantalla: { x: p.x, y: p.y }, camara: p.c === 0 ? null : verCamara(p, 0.05), c: p.c, f: p.f }));
  const r = ajustarCalibracion(medidos);
  assert.ok(r.malla, 'con 16 puntos todavía corrige el lente');
  const error = medirError(crearMapeo({ mapa: { h: r.h, malla: r.malla } }), CONTROL.map((p) => ({ pantalla: p, camara: verCamara(p, 0.05) })));
  assert.ok(error.medio < 0.01, `error ${error.medio}`);
});

test('con menos de 4 puntos vistos avisa en vez de inventar', () => {
  const medidos = puntosMalla().map((p, i) => ({ pantalla: p, camara: i < 3 ? verCamara(p, 0) : null }));
  assert.throws(() => ajustarCalibracion(medidos), /al menos 4/);
});

test('el afinado con el dedo corrige un desvío constante', () => {
  const toques = [];
  for (const y of [0.1, 0.5, 0.9]) for (const x of [0.1, 0.5, 0.9]) toques.push({ mira: { x, y }, dedo: { x: x - 0.012, y: y + 0.02 } });
  const rejilla = rejillaDedo(toques);
  const c = interpolar(rejilla, 0.3, 0.7);
  assert.ok(Math.abs(c.x - 0.012) < 1e-9 && Math.abs(c.y + 0.02) < 1e-9, JSON.stringify(c));
  const mapear = crearMapeo({ mapa: { h: [1, 0, 0, 0, 1, 0, 0, 0, 1], dedo: rejilla } });
  const p = mapear(0.3 - 0.012, 0.7 + 0.02, true);
  assert.ok(Math.abs(p.x - 0.3) < 1e-9 && Math.abs(p.y - 0.7) < 1e-9);
  const sinDedo = mapear(0.3, 0.7, false);
  assert.equal(sinDedo.x, 0.3);
});

test('el afinado no acepta desvíos absurdos (un toque fuera de la mira)', () => {
  const rejilla = rejillaDedo([{ mira: { x: 0.5, y: 0.5 }, dedo: { x: 0.9, y: 0.1 } }]);
  assert.ok(Math.abs(rejilla.dx[4]) <= 0.05 && Math.abs(rejilla.dy[4]) <= 0.05);
});

test('la zona del proyector dice qué lado se sale de la vista', () => {
  const negro = new Float32Array(ANCHO * ALTO).fill(40);
  const blanco = new Float32Array(ANCHO * ALTO).fill(40);
  for (let y = 30; y < 160; y++) for (let x = 0; x < 250; x++) blanco[y * ANCHO + x] = 200; // se sale por la izquierda
  const z = zonaProyectada(negro, blanco, ANCHO, ALTO);
  assert.equal(z.cortado.izquierda, true);
  assert.equal(z.cortado.derecha, false);
  assert.equal(z.completa, false);
  assert.ok(Math.abs(z.caja.x1 - 250 / ANCHO) < 0.01);
});

test('una configuración vieja (solo homografía) sigue funcionando', () => {
  const mapear = crearMapeo({ homografia: [1, 0, 0.1, 0, 1, 0, 0, 0, 1] });
  assert.ok(Math.abs(mapear(0.2, 0.3).x - 0.3) < 1e-9);
});

test('la calificación se entiende', () => {
  assert.equal(calificar({ medio: 0.003 }).nota, 'Excelente');
  assert.equal(calificar({ medio: 0.04 }).ok, false);
});
