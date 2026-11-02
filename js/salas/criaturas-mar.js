// Animales del océano vistos desde arriba. Cada dibujo mira hacia +x,
// con su tamaño `s` (medio largo del cuerpo) y una fase de nado `f`.

export const ESPECIES = {
  payaso: {
    cantidad: 5, tam: 0.028, velocidad: 0.11, asustadizo: 1, color: '#ff8a3d',
    dibujar(c, s, f) {
      pez(c, s, f, '#ff7b22', '#ffb36b');
      c.fillStyle = '#fff';
      c.strokeStyle = '#111'; c.lineWidth = s * 0.05;
      for (const x of [0.45, -0.05, -0.55]) {
        c.beginPath(); c.ellipse(x * s, 0, s * 0.09, s * 0.4 * (1 - Math.abs(x) * 0.5), 0, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    },
    ficha: { tema: 'Arrecife de coral', titulo: 'Pez payaso', texto: ['Vive entre los tentáculos de las anémonas, que pican a otros peces.', 'Una capa de moco en su piel lo protege de las picaduras.'], dato: 'Todos nacen machos; el más grande del grupo se vuelve hembra.' },
  },
  cirujano: {
    cantidad: 4, tam: 0.032, velocidad: 0.13, asustadizo: 1, color: '#3d7bff',
    dibujar(c, s, f) {
      pez(c, s, f, '#2a62e8', '#ffd23d', 0.55);
      c.fillStyle = '#0b1640';
      c.beginPath(); c.ellipse(s * 0.05, 0, s * 0.5, s * 0.12, 0, 0, Math.PI * 2); c.fill();
    },
    ficha: { tema: 'Arrecife de coral', titulo: 'Pez cirujano azul', texto: ['Tiene una espina filosa como una navaja a cada lado de la cola.', 'Por eso se llama «cirujano».'], dato: 'Come algas y así ayuda a mantener sanos los arrecifes.' },
  },
  tortuga: {
    cantidad: 1, tam: 0.065, velocidad: 0.05, asustadizo: 0.3, color: '#7bc96f',
    dibujar(c, s, f) {
      const aleteo = Math.sin(f) * 0.5;
      c.fillStyle = '#5f7f4a';
      for (const [x, lado, largo, a] of [[0.45, 1, 0.75, 0.9], [0.45, -1, 0.75, 0.9], [-0.55, 1, 0.4, 2.3], [-0.55, -1, 0.4, 2.3]]) {
        c.save(); c.translate(x * s, lado * 0.42 * s); c.rotate(lado * (a + (x > 0 ? aleteo : -aleteo * 0.5)));
        c.beginPath(); c.ellipse(s * largo * 0.5, 0, s * largo * 0.5, s * 0.16, 0, 0, Math.PI * 2); c.fill(); c.restore();
      }
      c.fillStyle = '#6d8f55';
      c.beginPath(); c.ellipse(s * 1.0, 0, s * 0.24, s * 0.19, 0, 0, Math.PI * 2); c.fill();
      const g = c.createRadialGradient(-s * 0.1, -s * 0.15, s * 0.1, 0, 0, s * 0.85);
      g.addColorStop(0, '#9a7a3c'); g.addColorStop(1, '#4d3a19');
      c.fillStyle = g;
      c.beginPath(); c.ellipse(0, 0, s * 0.8, s * 0.62, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(30, 20, 5, 0.7)'; c.lineWidth = s * 0.04;
      for (const [x, y] of [[0, 0], [0.42, 0], [-0.42, 0], [0.2, 0.36], [-0.2, 0.36], [0.2, -0.36], [-0.2, -0.36]]) hexagono(c, x * s, y * s, s * 0.2);
    },
    ficha: { tema: 'Mar abierto', titulo: 'Tortuga marina', texto: ['Las hembras regresan a la playa donde nacieron para poner sus huevos.', 'Usan sus aletas delanteras como alas para «volar» bajo el agua.'], dato: 'En México anidan 6 de las 7 especies de tortugas marinas del mundo.' },
  },
  manta: {
    cantidad: 1, tam: 0.09, velocidad: 0.06, asustadizo: 0.4, color: '#9fb3c8',
    dibujar(c, s, f) {
      const ala = 1 + Math.sin(f * 0.6) * 0.18;
      c.strokeStyle = '#1b2430'; c.lineWidth = s * 0.03;
      c.beginPath(); c.moveTo(-s * 0.4, 0); c.quadraticCurveTo(-s * 1.0, Math.sin(f) * s * 0.1, -s * 1.5, 0); c.stroke();
      const g = c.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, '#2c3a4b'); g.addColorStop(0.5, '#1a2330'); g.addColorStop(1, '#2c3a4b');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(s * 0.55, 0);
      c.bezierCurveTo(s * 0.4, -s * 0.5 * ala, s * 0.0, -s * 1.1 * ala, -s * 0.15, -s * 1.15 * ala);
      c.bezierCurveTo(-s * 0.25, -s * 0.6, -s * 0.45, -s * 0.15, -s * 0.45, 0);
      c.bezierCurveTo(-s * 0.45, s * 0.15, -s * 0.25, s * 0.6, -s * 0.15, s * 1.15 * ala);
      c.bezierCurveTo(s * 0.0, s * 1.1 * ala, s * 0.4, s * 0.5 * ala, s * 0.55, 0);
      c.fill();
      c.fillStyle = '#e8eef5';
      for (const y of [-1, 1]) { c.beginPath(); c.ellipse(s * 0.55, y * s * 0.14, s * 0.12, s * 0.04, y * 0.4, 0, Math.PI * 2); c.fill(); }
    },
    ficha: { tema: 'Mar abierto', titulo: 'Manta raya', texto: ['Puede medir hasta 7 metros de una aleta a la otra.', 'Come plancton: animalitos diminutos que flotan en el agua.'], dato: 'Tiene uno de los cerebros más grandes de todos los peces.' },
  },
  ballena: {
    cantidad: 1, tam: 0.16, velocidad: 0.035, asustadizo: 0.15, color: '#6fa8ff',
    dibujar(c, s, f) {
      const cola = Math.sin(f * 0.7) * 0.35;
      c.fillStyle = '#34495e';
      c.save(); c.translate(-s * 0.85, 0); c.rotate(cola);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-s * 0.35, -s * 0.28); c.lineTo(-s * 0.25, 0); c.lineTo(-s * 0.35, s * 0.22); c.closePath(); c.fill();
      c.restore();
      for (const y of [-1, 1]) { c.beginPath(); c.ellipse(s * 0.25, y * s * 0.27, s * 0.22, s * 0.06, y * 0.6, 0, Math.PI * 2); c.fill(); }
      const g = c.createLinearGradient(0, -s * 0.25, 0, s * 0.25);
      g.addColorStop(0, '#3e5a74'); g.addColorStop(0.5, '#2a3f55'); g.addColorStop(1, '#3e5a74');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(s * 0.98, -s * 0.13); c.quadraticCurveTo(s * 1.02, 0, s * 0.98, s * 0.13);
      c.bezierCurveTo(s * 0.5, s * 0.3, -s * 0.5, s * 0.2, -s * 0.9, s * 0.04);
      c.lineTo(-s * 0.9, -s * 0.04);
      c.bezierCurveTo(-s * 0.5, -s * 0.2, s * 0.5, -s * 0.3, s * 0.98, -s * 0.13); c.fill();
      c.fillStyle = 'rgba(235, 245, 255, 0.85)';
      for (let i = 0; i < 26; i++) {
        const x = 0.85 - (i % 9) * 0.19, y = ((Math.floor(i / 9) - 1) * 0.1) + (i % 2 ? 0.03 : -0.03);
        c.beginPath(); c.arc(x * s, y * s * (1 - Math.abs(x) * 0.3), s * 0.022, 0, Math.PI * 2); c.fill();
      }
    },
    ficha: { tema: 'Mar abierto', titulo: 'Tiburón ballena', texto: ['Es el pez más grande del mundo: puede medir más de 12 metros, como un autobús.', 'Aunque es enorme, solo come plancton y peces pequeñitos.'], dato: 'Cada uno tiene un dibujo de manchas único, como una huella digital.' },
  },
  medusa: {
    cantidad: 3, tam: 0.035, velocidad: 0.03, asustadizo: 0.2, color: '#e59cff',
    dibujar(c, s, f) {
      const pulso = 1 + Math.sin(f * 1.6) * 0.12;
      c.strokeStyle = 'rgba(240, 190, 255, 0.45)'; c.lineWidth = s * 0.06;
      for (let i = 0; i < 6; i++) {
        const y0 = (i - 2.5) * s * 0.18;
        c.beginPath(); c.moveTo(-s * 0.2, y0);
        for (let k = 1; k <= 6; k++) c.lineTo(-s * 0.2 - k * s * 0.28, y0 + Math.sin(f * 2 + k + i) * s * 0.12);
        c.stroke();
      }
      const g = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.7 * pulso);
      g.addColorStop(0, 'rgba(255, 220, 255, 0.85)'); g.addColorStop(0.7, 'rgba(210, 130, 255, 0.5)'); g.addColorStop(1, 'rgba(210, 130, 255, 0.05)');
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, s * 0.7 * pulso, 0, Math.PI * 2); c.fill();
    },
    ficha: { tema: 'Mar abierto', titulo: 'Medusa', texto: ['Su cuerpo es casi todo agua: alrededor del 95 %.', 'No tiene cerebro, ni corazón, ni huesos.'], dato: 'Existen desde hace más de 500 millones de años, antes que los dinosaurios.' },
  },
  pulpo: {
    cantidad: 1, tam: 0.05, velocidad: 0.04, asustadizo: 0.6, color: '#ff6b8a',
    dibujar(c, s, f, tono = 0) {
      const color = tono > 0.5 ? '#f2e2c4' : '#c8424f';
      c.strokeStyle = color; c.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = Math.PI + (i - 3.5) * 0.32;
        c.lineWidth = s * 0.16;
        c.beginPath(); c.moveTo(0, 0);
        let x = 0, y = 0;
        for (let k = 1; k <= 7; k++) {
          const ang = a + Math.sin(f * 1.3 + i * 0.8 + k * 0.6) * 0.35;
          x += Math.cos(ang) * s * 0.2; y += Math.sin(ang) * s * 0.2;
          c.lineWidth = s * 0.16 * (1 - k / 9);
          c.lineTo(x, y);
        }
        c.stroke();
      }
      c.fillStyle = color;
      c.beginPath(); c.ellipse(s * 0.25, 0, s * 0.55, s * 0.38, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      for (const y of [-1, 1]) { c.beginPath(); c.arc(s * 0.0, y * s * 0.22, s * 0.08, 0, Math.PI * 2); c.fill(); }
    },
    ficha: { tema: 'Fondo marino', titulo: 'Pulpo', texto: ['Tiene tres corazones y sangre azul.', 'Puede cambiar de color en un instante para esconderse. ¡Mira cómo cambia!'], dato: 'Sus ventosas pueden sentir sabores con solo tocar.' },
  },
};

function pez(c, s, f, cuerpo, aleta, altoCuerpo = 0.42) {
  const cola = Math.sin(f * 2.2) * 0.5;
  c.fillStyle = aleta;
  c.save(); c.translate(-s * 0.8, 0); c.rotate(cola);
  c.beginPath(); c.moveTo(s * 0.1, 0); c.lineTo(-s * 0.45, -s * 0.35); c.lineTo(-s * 0.35, 0); c.lineTo(-s * 0.45, s * 0.35); c.closePath(); c.fill();
  c.restore();
  c.beginPath(); c.ellipse(s * 0.1, s * 0.38, s * 0.22, s * 0.07, 0.6 + cola * 0.3, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(s * 0.1, -s * 0.38, s * 0.22, s * 0.07, -0.6 - cola * 0.3, 0, Math.PI * 2); c.fill();
  const g = c.createLinearGradient(0, -s * altoCuerpo, 0, s * altoCuerpo);
  g.addColorStop(0, cuerpo); g.addColorStop(0.5, aclarar(cuerpo)); g.addColorStop(1, cuerpo);
  c.fillStyle = g;
  c.beginPath(); c.ellipse(0, 0, s * 0.95, s * altoCuerpo, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111';
  for (const y of [-1, 1]) { c.beginPath(); c.arc(s * 0.62, y * s * 0.2, s * 0.07, 0, Math.PI * 2); c.fill(); }
}

function hexagono(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath(); c.stroke();
}

function aclarar(hex) {
  const n = parseInt(hex.slice(1), 16);
  const m = (v) => Math.min(255, Math.round(v + (255 - v) * 0.35));
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`;
}
