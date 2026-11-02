// Dibujos del cuerpo humano visto de frente (acostado boca arriba en la mesa).
// Coordenadas locales: y = 0 en la coronilla, y = 1 en los pies; x = 0 al
// centro. El lado izquierdo del cuerpo queda a la derecha de quien mira
// (por eso el corazón está en x > 0).

export const ORGANOS = [
  {
    id: 'cerebro', x: 0, y: 0.058, rx: 0.048, ry: 0.038, color: '#f4a7b9',
    ficha: { tema: 'Sistema nervioso', titulo: 'El cerebro', texto: ['Manda mensajes a todo tu cuerpo por los nervios, más rápido que un parpadeo.', 'En un adulto pesa alrededor de 1.4 kg, como una piña.'], dato: 'Usa cerca del 20 % de la energía de tu cuerpo.' },
  },
  {
    id: 'pulmones', x: 0, y: 0.245, rx: 0.1, ry: 0.075, color: '#ff9eb0',
    ficha: { tema: 'Sistema respiratorio', titulo: 'Los pulmones', texto: ['Llevan el oxígeno del aire a tu sangre.', 'El izquierdo es un poco más pequeño para dejarle lugar al corazón.'], dato: 'Respiras unas 20,000 veces al día.' },
  },
  {
    id: 'corazon', x: 0.022, y: 0.258, rx: 0.03, ry: 0.034, color: '#e63946',
    ficha: { tema: 'Sistema circulatorio', titulo: 'El corazón', texto: ['Es un músculo del tamaño de tu puño.', 'Late unas 100,000 veces al día, sin descansar nunca.'], dato: 'Empuja la sangre por todo tu cuerpo. ¡Siéntelo en tu pecho!' },
  },
  {
    id: 'higado', x: -0.04, y: 0.335, rx: 0.062, ry: 0.03, color: '#a4373a',
    ficha: { tema: 'Sistema digestivo', titulo: 'El hígado', texto: ['Es el órgano más grande dentro de tu cuerpo.', 'Limpia la sangre y guarda energía para después.'], dato: 'Si se le quita un pedazo, puede volver a crecer.' },
  },
  {
    id: 'estomago', x: 0.045, y: 0.345, rx: 0.038, ry: 0.03, color: '#f0b27a',
    ficha: { tema: 'Sistema digestivo', titulo: 'El estómago', texto: ['Mezcla la comida con jugos que la deshacen.', 'Se estira como un globo cuando comes mucho.'], dato: 'Una capa de moco lo protege de su propio ácido.' },
  },
  {
    id: 'rinones', x: 0, y: 0.395, rx: 0.075, ry: 0.03, color: '#9c4f7a', pares: [-0.062, 0.062],
    ficha: { tema: 'Sistema urinario', titulo: 'Los riñones', texto: ['Son dos y tienen forma de frijol.', 'Limpian la sangre y hacen la orina.'], dato: 'Filtran toda tu sangre muchas veces al día.' },
  },
  {
    id: 'intestinos', x: 0, y: 0.44, rx: 0.075, ry: 0.055, color: '#f6b7a0',
    ficha: { tema: 'Sistema digestivo', titulo: 'Los intestinos', texto: ['El intestino delgado mide unos 6 metros: ¡más que un coche!', 'Ahí tu cuerpo toma lo bueno de la comida.'], dato: 'Ahí viven billones de bacterias que te ayudan a digerir.' },
  },
];

export const HUESOS = [
  { id: 'craneo', x: 0, y: 0.06, rx: 0.068, ry: 0.065, ficha: { tema: 'Esqueleto', titulo: 'El cráneo', texto: ['Protege tu cerebro como un casco.', 'Está formado por 22 huesos que encajan como rompecabezas.'], dato: 'La mandíbula es el único hueso de la cabeza que se mueve.' } },
  { id: 'costillas', x: 0, y: 0.25, rx: 0.12, ry: 0.1, ficha: { tema: 'Esqueleto', titulo: 'Las costillas', texto: ['Tienes 24 costillas, 12 de cada lado.', 'Forman una jaula que protege el corazón y los pulmones.'], dato: 'Se mueven un poquito cada vez que respiras.' } },
  { id: 'columna', x: 0, y: 0.33, rx: 0.02, ry: 0.2, ficha: { tema: 'Esqueleto', titulo: 'La columna', texto: ['Está hecha de muchas piezas llamadas vértebras.', 'Te permite doblarte y protege la médula espinal.'], dato: 'Los mensajes del cerebro viajan por dentro de ella.' } },
  { id: 'femur', x: 0, y: 0.64, rx: 0.1, ry: 0.11, ficha: { tema: 'Esqueleto', titulo: 'El fémur', texto: ['Es el hueso más largo y fuerte de tu cuerpo.', 'Está en tu muslo, de la cadera a la rodilla.'], dato: 'Un adulto tiene 206 huesos; los bebés nacen con unos 300.' } },
];

/**
 * Pinta la silueta del cuerpo de un solo color (sirve de máscara).
 * Brazos y piernas son trazos gruesos con puntas redondas, que se adelgazan
 * hacia las manos y los pies.
 */
export function pintarSilueta(c, t, color = '#fff') {
  c.save();
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const miembro = (puntos, grueso) => {
    for (let i = 0; i < puntos.length - 1; i++) {
      const pasos = 8;
      for (let k = 0; k < pasos; k++) {
        const u0 = k / pasos, u1 = (k + 1) / pasos;
        const [x0, y0] = puntos[i], [x1, y1] = puntos[i + 1];
        c.lineWidth = (grueso[i] + (grueso[i + 1] - grueso[i]) * (u0 + u1) / 2) * 2 * t.s;
        c.beginPath();
        c.moveTo(t.x(x0 + (x1 - x0) * u0), t.y(y0 + (y1 - y0) * u0));
        c.lineTo(t.x(x0 + (x1 - x0) * u1), t.y(y0 + (y1 - y0) * u1));
        c.stroke();
      }
    }
  };
  c.beginPath(); c.ellipse(t.x(0), t.y(0.07), 0.062 * t.s, 0.072 * t.s, 0, 0, Math.PI * 2); c.fill(); // cabeza
  c.fillRect(t.x(-0.026), t.y(0.13), 0.052 * t.s, 0.06 * t.s); // cuello
  // Tronco con hombros redondeados y cintura
  c.beginPath();
  c.moveTo(t.x(0), t.y(0.165));
  c.bezierCurveTo(t.x(0.09), t.y(0.162), t.x(0.135), t.y(0.17), t.x(0.135), t.y(0.215));
  c.bezierCurveTo(t.x(0.135), t.y(0.32), t.x(0.095), t.y(0.39), t.x(0.1), t.y(0.47));
  c.bezierCurveTo(t.x(0.105), t.y(0.52), t.x(0.1), t.y(0.55), t.x(0.09), t.y(0.565));
  c.lineTo(t.x(-0.09), t.y(0.565));
  c.bezierCurveTo(t.x(-0.1), t.y(0.55), t.x(-0.105), t.y(0.52), t.x(-0.1), t.y(0.47));
  c.bezierCurveTo(t.x(-0.095), t.y(0.39), t.x(-0.135), t.y(0.32), t.x(-0.135), t.y(0.215));
  c.bezierCurveTo(t.x(-0.135), t.y(0.17), t.x(-0.09), t.y(0.162), t.x(0), t.y(0.165));
  c.fill();
  for (const l of [-1, 1]) {
    miembro([[l * 0.118, 0.2], [l * 0.158, 0.34], [l * 0.183, 0.48]], [0.03, 0.024, 0.019]); // brazo
    c.beginPath(); c.ellipse(t.x(l * 0.188), t.y(0.515), 0.022 * t.s, 0.034 * t.s, l * -0.15, 0, Math.PI * 2); c.fill(); // mano
    miembro([[l * 0.052, 0.54], [l * 0.062, 0.75], [l * 0.063, 0.945]], [0.052, 0.034, 0.024]); // pierna
    c.beginPath(); c.ellipse(t.x(l * 0.074), t.y(0.975), 0.026 * t.s, 0.02 * t.s, 0, 0, Math.PI * 2); c.fill(); // pie
  }
  c.restore();
}

/** Lienzos fijos del cuerpo: máscara (blanco) y piel con ropa y cara. */
export function pintarCuerpo(W, H, t) {
  const mascara = document.createElement('canvas');
  mascara.width = W; mascara.height = H;
  pintarSilueta(mascara.getContext('2d'), t);

  const piel = document.createElement('canvas');
  piel.width = W; piel.height = H;
  const c = piel.getContext('2d');
  const g = c.createLinearGradient(t.x(-0.2), 0, t.x(0.2), 0);
  g.addColorStop(0, '#b97e5c'); g.addColorStop(0.5, '#efbd96'); g.addColorStop(1, '#b97e5c');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#4f7fe8'; // short
  c.beginPath(); c.roundRect(t.x(-0.112), t.y(0.5), 0.224 * t.s, 0.12 * t.s, 0.02 * t.s); c.fill();
  c.fillStyle = '#3d68c9';
  c.fillRect(t.x(-0.004), t.y(0.56), 0.008 * t.s, 0.06 * t.s);
  c.fillStyle = '#ffffff'; c.globalAlpha = 0.85; // camiseta sin mangas
  c.beginPath(); c.roundRect(t.x(-0.11), t.y(0.2), 0.22 * t.s, 0.31 * t.s, 0.03 * t.s); c.fill();
  c.globalAlpha = 1;
  c.fillStyle = '#ff6b8a';
  c.font = `800 ${Math.round(0.05 * t.s)}px "Avenir Next", sans-serif`;
  c.textAlign = 'center';
  c.fillText('♥', t.x(0.03), t.y(0.28));
  c.fillStyle = '#4a2f1f'; // pelo, ojos y sonrisa
  c.beginPath(); c.ellipse(t.x(0), t.y(0.03), 0.062 * t.s, 0.034 * t.s, 0, Math.PI, Math.PI * 2); c.fill();
  for (const l of [-1, 1]) { c.beginPath(); c.arc(t.x(l * 0.022), t.y(0.072), 0.0065 * t.s, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#4a2f1f'; c.lineWidth = 0.005 * t.s; c.lineCap = 'round';
  c.beginPath(); c.arc(t.x(0), t.y(0.093), 0.017 * t.s, 0.25, Math.PI - 0.25); c.stroke();
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(mascara, 0, 0);
  return { mascara, piel };
}

export function dibujarEsqueleto(c, t) {
  c.save();
  c.strokeStyle = '#f2f5ff';
  c.fillStyle = '#f2f5ff';
  c.lineCap = 'round';
  c.shadowColor = 'rgba(150, 210, 255, 0.8)';
  c.shadowBlur = t.s * 0.01;
  const linea = (pts, g) => { c.lineWidth = g * t.s; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(t.x(x), t.y(y)) : c.moveTo(t.x(x), t.y(y)))); c.stroke(); };
  // Cráneo con ojos y mandíbula
  c.beginPath(); c.ellipse(t.x(0), t.y(0.062), 0.056 * t.s, 0.06 * t.s, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#0a1a33';
  for (const l of [-1, 1]) { c.beginPath(); c.ellipse(t.x(l * 0.022), t.y(0.07), 0.014 * t.s, 0.012 * t.s, 0, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.moveTo(t.x(0), t.y(0.085)); c.lineTo(t.x(-0.006), t.y(0.097)); c.lineTo(t.x(0.006), t.y(0.097)); c.fill();
  c.fillStyle = '#f2f5ff';
  c.beginPath(); c.ellipse(t.x(0), t.y(0.118), 0.035 * t.s, 0.018 * t.s, 0, 0, Math.PI); c.fill();
  // Columna (vértebras)
  for (let y = 0.15; y < 0.5; y += 0.014) { c.beginPath(); c.roundRect(t.x(-0.009), t.y(y), 0.018 * t.s, 0.01 * t.s, 0.003 * t.s); c.fill(); }
  // Clavículas y costillas
  for (const l of [-1, 1]) {
    linea([[0, 0.17], [l * 0.11, 0.18]], 0.008);
    for (let k = 0; k < 8; k++) {
      const y = 0.19 + k * 0.019, ancho = 0.1 - Math.abs(k - 2.5) * 0.006;
      c.lineWidth = 0.0065 * t.s;
      c.beginPath(); c.moveTo(t.x(l * 0.01), t.y(y));
      c.quadraticCurveTo(t.x(l * (ancho + 0.01)), t.y(y - 0.01), t.x(l * ancho * 0.85), t.y(y + 0.03));
      c.stroke();
    }
    // Brazo: húmero, antebrazo y mano
    linea([[l * 0.12, 0.185], [l * 0.158, 0.34]], 0.014);
    linea([[l * 0.16, 0.345], [l * 0.183, 0.49]], 0.01);
    linea([[l * 0.17, 0.345], [l * 0.19, 0.49]], 0.007);
    for (let d = -2; d <= 2; d++) linea([[l * 0.188, 0.5], [l * (0.19 + d * 0.006), 0.535]], 0.004);
    // Pierna: fémur, rodilla, tibia y pie
    linea([[l * 0.055, 0.53], [l * 0.065, 0.74]], 0.02);
    c.beginPath(); c.arc(t.x(l * 0.065), t.y(0.752), 0.013 * t.s, 0, Math.PI * 2); c.fill();
    linea([[l * 0.063, 0.765], [l * 0.064, 0.95]], 0.014);
    linea([[l * 0.07, 0.765], [l * 0.072, 0.95]], 0.006);
    linea([[l * 0.065, 0.955], [l * 0.085, 0.985]], 0.012);
  }
  // Pelvis
  c.beginPath();
  c.moveTo(t.x(0), t.y(0.5));
  c.bezierCurveTo(t.x(-0.1), t.y(0.46), t.x(-0.11), t.y(0.53), t.x(-0.05), t.y(0.555));
  c.lineTo(t.x(0.05), t.y(0.555));
  c.bezierCurveTo(t.x(0.11), t.y(0.53), t.x(0.1), t.y(0.46), t.x(0), t.y(0.5));
  c.fill();
  c.restore();
}

export function dibujarOrgano(c, t, o, tiempo, activo) {
  c.save();
  const pulso = o.id === 'corazon' ? 1 + 0.09 * Math.max(0, Math.sin(tiempo * (activo ? 12 : 7.5))) ** 6
    : o.id === 'pulmones' ? 1 + 0.06 * Math.sin(tiempo * 1.6) : 1;
  c.globalAlpha = 0.92;
  c.shadowColor = activo ? '#fff3c4' : 'rgba(0,0,0,0)';
  c.shadowBlur = activo ? t.s * 0.03 : 0;
  const g = (x, y, r) => {
    const gr = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, o.color); gr.addColorStop(1, oscurecer(o.color));
    return gr;
  };
  const elipse = (x, y, rx, ry) => {
    c.fillStyle = g(t.x(x), t.y(y), Math.max(rx, ry) * t.s);
    c.beginPath(); c.ellipse(t.x(x), t.y(y), rx * t.s, ry * t.s, 0, 0, Math.PI * 2); c.fill();
  };
  if (o.id === 'pulmones') {
    elipse(-0.052, o.y, 0.045 * pulso, 0.075 * pulso);
    elipse(0.056, o.y + 0.005, 0.039 * pulso, 0.068 * pulso);
  } else if (o.id === 'rinones') {
    for (const x of o.pares) elipse(x, o.y, 0.018, 0.03);
  } else if (o.id === 'intestinos') {
    elipse(o.x, o.y, o.rx, o.ry);
    c.strokeStyle = 'rgba(150, 70, 60, 0.55)';
    c.lineWidth = t.s * 0.006;
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.3) {
        const x = o.x + Math.cos(a + k) * o.rx * (0.25 + k * 0.13), y = o.y + Math.sin(a * 2 + k) * o.ry * 0.6;
        a ? c.lineTo(t.x(x), t.y(y)) : c.moveTo(t.x(x), t.y(y));
      }
      c.stroke();
    }
  } else if (o.id === 'cerebro') {
    elipse(o.x, o.y, o.rx, o.ry);
    c.strokeStyle = 'rgba(150, 60, 90, 0.5)';
    c.lineWidth = t.s * 0.004;
    c.beginPath(); c.moveTo(t.x(0), t.y(o.y - o.ry)); c.lineTo(t.x(0), t.y(o.y + o.ry)); c.stroke();
    for (let k = 0; k < 6; k++) {
      c.beginPath();
      c.arc(t.x((k % 2 ? 1 : -1) * 0.022), t.y(o.y - 0.02 + (k >> 1) * 0.02), 0.012 * t.s, 0, Math.PI * 1.4);
      c.stroke();
    }
  } else {
    elipse(o.x, o.y, o.rx * pulso, o.ry * pulso);
  }
  c.restore();
}

/** ¿El punto (en coordenadas locales) cae dentro de esta figura? */
export function dentro(f, x, y) {
  if (f.pares) return f.pares.some((px) => ((x - px) / 0.022) ** 2 + ((y - f.y) / 0.034) ** 2 <= 1);
  return ((x - f.x) / f.rx) ** 2 + ((y - f.y) / f.ry) ** 2 <= 1;
}

function oscurecer(hex) {
  const n = parseInt(hex.slice(1), 16);
  const m = (v) => Math.round(v * 0.55);
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`;
}
