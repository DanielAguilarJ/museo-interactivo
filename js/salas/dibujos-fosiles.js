// Fósiles dibujados sobre la roca. Cada uno se dibuja centrado en (0, 0)
// con tamaño `s` (medio ancho aproximado).

const HUESO = '#efe2c2';
const SOMBRA = 'rgba(60, 35, 15, 0.75)';

function trazo(c, s) {
  c.strokeStyle = SOMBRA;
  c.lineWidth = s * 0.035;
  c.lineJoin = 'round';
  c.lineCap = 'round';
}

export const FOSILES = [
  {
    id: 'amonita',
    dibujar(c, s) {
      c.fillStyle = HUESO;
      c.beginPath(); c.arc(0, 0, s, 0, Math.PI * 2); c.fill();
      trazo(c, s);
      // Espiral logarítmica con costillas
      const vueltas = 3.2, b = Math.log(1 / 0.12) / (vueltas * Math.PI * 2);
      c.beginPath();
      for (let t = 0; t <= vueltas * Math.PI * 2; t += 0.05) {
        const rr = s * Math.exp(-b * t);
        const x = Math.cos(t) * rr, y = Math.sin(t) * rr;
        t ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      c.lineWidth = s * 0.02;
      for (let t = 0; t <= vueltas * Math.PI * 2; t += 0.22) {
        const r1 = s * Math.exp(-b * t), r2 = s * Math.exp(-b * (t + Math.PI * 2));
        c.beginPath(); c.moveTo(Math.cos(t) * r1, Math.sin(t) * r1); c.lineTo(Math.cos(t) * r2, Math.sin(t) * r2); c.stroke();
      }
    },
    ficha: { tema: 'Mares antiguos', titulo: 'Amonita', texto: ['Era un animal marino con concha en espiral, pariente de los pulpos y los calamares.', 'Su concha tenía cámaras con gas que le servían para flotar.'], dato: 'Vivieron más de 300 millones de años y desaparecieron junto con los dinosaurios.' },
  },
  {
    id: 'trilobite',
    dibujar(c, s) {
      c.fillStyle = HUESO;
      c.beginPath(); c.ellipse(0, 0, s * 0.62, s, 0, 0, Math.PI * 2); c.fill();
      trazo(c, s);
      c.beginPath(); c.ellipse(0, 0, s * 0.62, s, 0, 0, Math.PI * 2); c.stroke();
      // Cabeza
      c.beginPath(); c.moveTo(-s * 0.6, -s * 0.45); c.quadraticCurveTo(0, -s * 0.62, s * 0.6, -s * 0.45); c.stroke();
      for (const x of [-1, 1]) { c.beginPath(); c.ellipse(x * s * 0.3, -s * 0.66, s * 0.1, s * 0.07, 0, 0, Math.PI * 2); c.stroke(); }
      // Tres lóbulos
      c.beginPath(); c.moveTo(-s * 0.16, -s * 0.45); c.lineTo(-s * 0.12, s * 0.85); c.moveTo(s * 0.16, -s * 0.45); c.lineTo(s * 0.12, s * 0.85); c.stroke();
      c.lineWidth = s * 0.022;
      for (let i = 0; i < 11; i++) {
        const y = -s * 0.36 + i * s * 0.11;
        const ancho = Math.sqrt(Math.max(0, 1 - (y / s) ** 2)) * s * 0.6;
        c.beginPath(); c.moveTo(-ancho, y + s * 0.04); c.lineTo(-s * 0.15, y); c.lineTo(s * 0.15, y); c.lineTo(ancho, y + s * 0.04); c.stroke();
      }
    },
    ficha: { tema: 'Mares antiguos', titulo: 'Trilobite', texto: ['Fue uno de los primeros animales con ojos complejos.', 'Su cuerpo tenía tres partes a lo largo: por eso se llama tri-lobite.'], dato: 'Vivieron en el mar hace entre 521 y 252 millones de años.' },
  },
  {
    id: 'pez',
    dibujar(c, s) {
      c.fillStyle = 'rgba(239, 226, 194, 0.55)';
      c.beginPath(); c.ellipse(0, 0, s, s * 0.32, 0, 0, Math.PI * 2); c.fill();
      trazo(c, s);
      c.fillStyle = HUESO;
      // Cráneo
      c.beginPath(); c.moveTo(s * 0.98, 0); c.quadraticCurveTo(s * 0.8, -s * 0.3, s * 0.55, -s * 0.28); c.lineTo(s * 0.55, s * 0.28); c.quadraticCurveTo(s * 0.8, s * 0.3, s * 0.98, 0); c.fill(); c.stroke();
      c.beginPath(); c.arc(s * 0.75, -s * 0.07, s * 0.06, 0, Math.PI * 2); c.stroke();
      // Columna y costillas
      c.beginPath(); c.moveTo(s * 0.55, 0); c.lineTo(-s * 0.85, 0); c.stroke();
      c.lineWidth = s * 0.018;
      for (let i = 0; i < 16; i++) {
        const x = s * 0.48 - i * s * 0.085;
        const alto = s * 0.28 * Math.sqrt(Math.max(0, 1 - (x / s) ** 2));
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x - s * 0.05, -alto); c.moveTo(x, 0); c.lineTo(x - s * 0.05, alto); c.stroke();
      }
      // Cola
      for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(-s * 0.85, 0); c.lineTo(-s * 1.2, i * s * 0.07); c.stroke(); }
    },
    ficha: { tema: 'Lagos antiguos', titulo: 'Pez fósil (Knightia)', texto: ['Es un pez parecido a la sardina que vivió en un gran lago.', 'Lo cubrió el lodo tan rápido que se conservaron hasta sus espinas.'], dato: 'Vivió hace unos 50 millones de años.' },
  },
  {
    id: 'huella',
    dibujar(c, s) {
      c.fillStyle = 'rgba(70, 40, 20, 0.55)';
      c.strokeStyle = 'rgba(255, 235, 200, 0.35)';
      c.lineWidth = s * 0.03;
      for (const a of [-0.42, 0, 0.42]) {
        c.save(); c.rotate(a);
        c.beginPath(); c.ellipse(0, -s * 0.5, s * 0.13, s * (a ? 0.42 : 0.5), 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-s * 0.06, -s * (a ? 0.9 : 1.0)); c.lineTo(0, -s * (a ? 1.05 : 1.17)); c.lineTo(s * 0.06, -s * (a ? 0.9 : 1.0)); c.fill();
        c.restore();
      }
      c.beginPath(); c.ellipse(0, s * 0.12, s * 0.24, s * 0.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    },
    ficha: { tema: 'Huellas', titulo: 'Huella de dinosaurio', texto: ['La dejó un dinosaurio carnívoro que caminaba en dos patas, como el T. rex.', 'Sus tres dedos con garras nos dicen que era un terópodo.'], dato: 'En México hay huellas de dinosaurio en lugares como San Juan Raya, Puebla.' },
  },
  {
    id: 'diente',
    dibujar(c, s) {
      const g = c.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, '#d9d2c0'); g.addColorStop(0.75, '#9b9480'); g.addColorStop(0.76, '#6b4b2e'); g.addColorStop(1, '#4a321c');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, -s);
      const dientes = 12;
      for (let i = 1; i <= dientes; i++) { const t = i / dientes; c.lineTo(s * 0.62 * t + (i % 2 ? s * 0.03 : 0), -s + t * s * 1.5); }
      c.quadraticCurveTo(s * 0.75, s * 0.85, 0, s * 0.7);
      c.quadraticCurveTo(-s * 0.75, s * 0.85, -s * 0.62, s * 0.5);
      for (let i = dientes; i >= 1; i--) { const t = i / dientes; c.lineTo(-s * 0.62 * t - (i % 2 ? s * 0.03 : 0), -s + t * s * 1.5); }
      c.closePath();
      c.fill();
      trazo(c, s);
      c.stroke();
    },
    ficha: { tema: 'Mares antiguos', titulo: 'Diente de megalodón', texto: ['Era de un tiburón gigante, el megalodón, de unos 15 metros de largo.', 'Algunos de sus dientes medían más de 15 centímetros.'], dato: 'Vivió hace entre 23 y 3.6 millones de años; nunca conoció a los dinosaurios.' },
  },
];
