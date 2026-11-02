// Datos y texturas pintadas de los planetas. Tamaños y distancias NO están a
// escala (si lo estuvieran, casi todo cabría en un punto); las fichas sí
// dicen datos reales (fuente: NASA Solar System Exploration).

import { azar } from './comun.js';

const r = azar(42);

function bandas(colores, ondas = 0.02) {
  return (c, w, h) => {
    const n = colores.length;
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const i = Math.floor((t + Math.sin(t * 40) * ondas) * n * 2.3) % n;
      c.fillStyle = colores[(i + n) % n];
      c.fillRect(0, y, w, 1);
    }
    for (let k = 0; k < 260; k++) {
      c.fillStyle = `rgba(255,255,255,${r() * 0.06})`;
      c.fillRect(r() * w, r() * h, 20 + r() * 80, 1 + r() * 2);
    }
  };
}

function rocoso(base, manchas, cantidad = 160, tam = 14) {
  return (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let k = 0; k < cantidad; k++) {
      c.fillStyle = manchas[k % manchas.length];
      c.globalAlpha = 0.25 + r() * 0.45;
      c.beginPath(); c.ellipse(r() * w, r() * h, 2 + r() * tam, 2 + r() * tam * 0.7, r() * 3, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  };
}

function tierra(c, w, h) {
  c.fillStyle = '#1f5fbf'; c.fillRect(0, 0, w, h);
  const continente = (cx, cy, s) => {
    c.fillStyle = r() > 0.4 ? '#3f9b4a' : '#8f8a4a';
    for (let k = 0; k < 18; k++) {
      c.beginPath(); c.arc(cx + (r() - 0.5) * s * 2, cy + (r() - 0.5) * s, s * (0.3 + r() * 0.5), 0, Math.PI * 2); c.fill();
    }
  };
  [[90, 90, 40], [130, 170, 28], [260, 80, 34], [280, 150, 30], [400, 110, 45], [430, 190, 22]].forEach(([x, y, s]) => continente(x, y, s));
  c.fillStyle = '#f2f6ff'; c.fillRect(0, 0, w, 14); c.fillRect(0, h - 16, w, 16);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  for (let k = 0; k < 70; k++) { c.beginPath(); c.ellipse(r() * w, r() * h, 10 + r() * 40, 3 + r() * 6, r(), 0, Math.PI * 2); c.fill(); }
}

function jupiter(c, w, h) {
  bandas(['#d9b48a', '#f1dfc2', '#b9845a', '#e8cfa8', '#a8714a', '#f3e6cf'], 0.03)(c, w, h);
  c.fillStyle = '#c0573a';
  c.beginPath(); c.ellipse(w * 0.62, h * 0.66, 30, 15, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,220,200,0.5)';
  c.beginPath(); c.ellipse(w * 0.62, h * 0.66, 18, 8, 0, 0, Math.PI * 2); c.fill();
}

function neptuno(c, w, h) {
  bandas(['#2f5bd8', '#3a6bea', '#2a4fc2', '#4677f0'], 0.01)(c, w, h);
  c.fillStyle = '#16297a';
  c.beginPath(); c.ellipse(w * 0.4, h * 0.6, 26, 12, 0, 0, Math.PI * 2); c.fill();
}

function anillosSaturno(c, w, h) {
  for (let x = 0; x < w; x++) {
    const t = x / w;
    const hueco = t > 0.55 && t < 0.6 ? 0.1 : 1; // división de Cassini
    const a = (0.35 + 0.5 * Math.abs(Math.sin(t * 37)) * (1 - t * 0.5)) * hueco;
    c.fillStyle = `rgba(${215 + t * 20 | 0},${195 + t * 10 | 0},${150},${a})`;
    c.fillRect(x, 0, 1, h);
  }
}

const v = (orbita) => 0.9 * Math.pow(5 / orbita, 1.5);

export const SOL = {
  radio: 3,
  ficha: {
    tema: 'Estrella', titulo: 'El Sol', color: '#ffb84d',
    texto: ['Es una estrella: una bola gigante de gas muy caliente que brilla.', 'Su luz tarda unos 8 minutos en llegar a la Tierra.'],
    dato: 'Dentro del Sol cabrían más de un millón de Tierras.',
  },
};

export const PLANETAS = [
  {
    id: 'mercurio', orbita: 5.4, radio: 0.6, giro: 0.3, pintar: rocoso('#8d8a86', ['#6b6864', '#a8a49f', '#5a5754'], 220, 10),
    ficha: { tema: 'Planeta rocoso', titulo: 'Mercurio', color: '#b5aea6', texto: ['Es el planeta más cercano al Sol y el más pequeño.', 'Un año en Mercurio dura solo 88 días.'], dato: 'No tiene ninguna luna.' },
  },
  {
    id: 'venus', orbita: 7.9, radio: 1.0, giro: -0.1, pintar: bandas(['#e9c98f', '#f3dcae', '#dcb478', '#f6e3bd'], 0.06),
    ficha: { tema: 'Planeta rocoso', titulo: 'Venus', color: '#f0c674', texto: ['Es el planeta más caliente: unos 465 °C, ¡más que un horno!', 'Sus nubes gruesas atrapan el calor del Sol.'], dato: 'Gira al revés que casi todos los planetas.' },
  },
  {
    id: 'tierra', orbita: 10.6, radio: 1.05, giro: 0.6, pintar: tierra, luna: true, inclinacion: 23,
    ficha: { tema: 'Nuestro planeta', titulo: 'La Tierra', color: '#6fb6ff', texto: ['Es nuestro hogar y el único lugar donde sabemos que hay vida.', 'Casi tres cuartas partes de su superficie son agua.'], dato: 'Su Luna tarda unos 27 días en darle la vuelta.' },
  },
  {
    id: 'marte', orbita: 13.1, radio: 0.8, giro: 0.55, pintar: rocoso('#c1440e', ['#8e2f08', '#e07a3c', '#6d2405'], 140, 16), inclinacion: 25,
    ficha: { tema: 'Planeta rocoso', titulo: 'Marte', color: '#ff7a4d', texto: ['Le dicen el planeta rojo: su suelo tiene óxido de hierro, como la herrumbre.', 'Ahí está el Monte Olimpo, el volcán más alto del sistema solar.'], dato: 'Tiene dos lunas pequeñitas: Fobos y Deimos.' },
  },
  {
    id: 'jupiter', orbita: 18.6, radio: 2.2, giro: 1.1, pintar: jupiter,
    ficha: { tema: 'Gigante de gas', titulo: 'Júpiter', color: '#e3a86b', texto: ['Es el planeta más grande: dentro cabrían más de 1,300 Tierras.', 'Su Gran Mancha Roja es una tormenta más grande que la Tierra.'], dato: 'No tiene suelo: es casi todo gas.' },
  },
  {
    id: 'saturno', orbita: 23.4, radio: 1.8, giro: 1, pintar: bandas(['#e6d3a3', '#d8bf86', '#efe0b8', '#cdb27a'], 0.01), anillos: anillosSaturno, inclinacion: 27,
    ficha: { tema: 'Gigante de gas', titulo: 'Saturno', color: '#f1d48b', texto: ['Sus anillos están hechos de muchísimos pedazos de hielo y roca.', 'Es tan ligero para su tamaño que flotaría en una bañera gigante.'], dato: 'Es el planeta con más lunas conocidas.' },
  },
  {
    id: 'urano', orbita: 27.6, radio: 1.35, giro: -0.7, pintar: bandas(['#9fe3e8', '#8fd6dd', '#b0ecf0'], 0.005), inclinacion: 98,
    ficha: { tema: 'Gigante de hielo', titulo: 'Urano', color: '#8fe3ea', texto: ['Gira acostado, como una pelota que rueda.', 'Es un gigante de hielo de color azul verdoso.'], dato: 'Un año en Urano dura 84 años de la Tierra.' },
  },
  {
    id: 'neptuno', orbita: 31, radio: 1.3, giro: 0.75, pintar: neptuno, inclinacion: 28,
    ficha: { tema: 'Gigante de hielo', titulo: 'Neptuno', color: '#6f8dff', texto: ['Es el planeta más lejano del Sol.', 'Tiene los vientos más rápidos del sistema solar: más de 2,000 km/h.'], dato: 'Tarda 165 años en darle una vuelta al Sol.' },
  },
].map((p) => ({ ...p, velocidad: v(p.orbita) }));
