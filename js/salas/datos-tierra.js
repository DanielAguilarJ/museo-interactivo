// Capas de la Tierra (del centro hacia afuera). Las capas se dibujan con su
// grosor real salvo la corteza, que de verdad es tan delgada que no se vería
// (por eso se dibuja más gruesa y la ficha lo dice).
// Fuentes de los datos: USGS y National Geographic Education.

export const CAPAS = [
  {
    id: 'nucleo-interno', desde: 0, radioReal: 0, color: '#ffe27a',
    ficha: { tema: 'Capa 5 · el centro', titulo: 'Núcleo interno', color: '#ffe27a', texto: ['Es una bola sólida de hierro y níquel en el centro de la Tierra.', 'Está casi tan caliente como la superficie del Sol: más de 5,000 °C.'], dato: 'Empieza a unos 5,150 km bajo tus pies.' },
  },
  {
    id: 'nucleo-externo', desde: 0.192, radioReal: 1221, color: '#f6a21a',
    ficha: { tema: 'Capa 4', titulo: 'Núcleo externo', color: '#f6a21a', texto: ['Es hierro y níquel derretidos: ¡un océano de metal líquido!', 'Al moverse crea el campo magnético de la Tierra.'], dato: 'Gracias a él funcionan las brújulas.' },
  },
  {
    id: 'manto-inferior', desde: 0.546, radioReal: 3480, color: '#c8461b',
    ficha: { tema: 'Capa 3', titulo: 'Manto inferior', color: '#e2602c', texto: ['Es la capa más gruesa de la Tierra.', 'Llega hasta unos 2,900 km de profundidad.'], dato: 'La presión es tan fuerte que la roca sigue sólida aunque está muy caliente.' },
  },
  {
    id: 'manto-superior', desde: 0.87, radioReal: 5711, color: '#ec7a3a',
    ficha: { tema: 'Capa 2', titulo: 'Manto superior', color: '#ec7a3a', texto: ['Es roca muy caliente que se mueve lentísimo, como plastilina.', 'Sus movimientos empujan a los continentes unos centímetros cada año.'], dato: 'De aquí sale el magma de muchos volcanes.' },
  },
  {
    id: 'corteza', desde: 0.955, radioReal: 6336, color: '#8a5a32',
    ficha: { tema: 'Capa 1 · donde vivimos', titulo: 'Corteza', color: '#c98a52', texto: ['Es la capa donde están las montañas, los océanos y las ciudades.', 'Bajo el mar mide unos 7 km y bajo los continentes, de 30 a 70 km.'], dato: 'Aquí está dibujada más gruesa: de verdad es como la cáscara de una manzana.' },
  },
];

export const SUPERFICIE = {
  tema: 'Nuestro planeta', titulo: 'La Tierra', color: '#6fb6ff',
  texto: ['Para llegar a su centro tendrías que viajar unos 6,371 km hacia abajo.', 'Pon tu mano en el corte para conocer cada capa por dentro.'],
  dato: '¡Cuanto más profundo, más calor!',
};

const RADIO_TIERRA = 6371;

/** Capa en la que cae un radio dibujado (0 = centro, 1 = superficie). */
export function capaEn(radio) {
  let i = 0;
  for (let k = 0; k < CAPAS.length; k++) if (radio >= CAPAS[k].desde) i = k;
  return i;
}

/** Profundidad real (km) del punto dibujado a ese radio. */
export function profundidadKm(radio) {
  const r = Math.max(0, Math.min(1, radio));
  const i = capaEn(r);
  const d0 = CAPAS[i].desde, d1 = CAPAS[i + 1]?.desde ?? 1;
  const k0 = CAPAS[i].radioReal, k1 = CAPAS[i + 1]?.radioReal ?? RADIO_TIERRA;
  const real = k0 + ((r - d0) / (d1 - d0)) * (k1 - k0);
  return RADIO_TIERRA - real;
}

// ---- Superficie pintada: continentes con ruido que no deja costura
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function ruido(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(fx), v = s(fy), w = s(fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm(x, y, z) {
  let t = 0, a = 0.5, f = 1;
  for (let i = 0; i < 5; i++) { t += a * ruido(x * f + 11, y * f + 7, z * f + 3); a *= 0.5; f *= 2.03; }
  return t;
}

export function pintarSuperficie(ctx, w, h) {
  const W = 400, H = 200;
  const img = new ImageData(W, H);
  for (let py = 0; py < H; py++) {
    const lat = (py / H - 0.5) * Math.PI;
    for (let px = 0; px < W; px++) {
      const lon = (px / W) * Math.PI * 2;
      const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
      const n = fbm(x * 1.8, y * 1.8, z * 1.8);
      const hielo = Math.abs(lat) > 1.33;
      let c;
      if (hielo) c = [236, 244, 250];
      else if (n > 0.53) c = n > 0.62 ? [150, 128, 88] : [74, 140, 70];
      else c = [24 + n * 40, 80 + n * 80, 160 + n * 70];
      const i = (py * W + px) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
  }
  const tmp = new OffscreenCanvas(W, H);
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, w, h);
}
