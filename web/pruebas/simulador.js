// SOLO PARA PRUEBAS: una cámara simulada que "ve" la mesa como la vería una
// cámara de techo real (girada, con perspectiva, lente curvo, ruido, luz del
// cuarto y retraso), mirando lo que el museo dibuja durante la calibración.
// Se activa desde las pruebas automáticas; el museo normal nunca lo carga.

const PROYECTOR_A_CAMARA = [-0.7, 0.03, 0.85, 0.02, -0.62, 0.82, 0.05, 0.04, 1];
const K_LENTE = 0.08;

function aplicar(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

// Posición simulada del motor de la cámara (giro, inclinación y zoom)
export const motor = { giro: 0, inclinacion: 0, zoom: 100, luz: 0 };
const GRADO = 0.012; // cuánto se corre la imagen por grado

export function verCamara(x, y) {
  const p0 = aplicar(PROYECTOR_A_CAMARA, x, y);
  const z = motor.zoom / 100;
  // Girar a la derecha corre la imagen a la izquierda; el zoom agranda desde el centro
  const p = { x: 0.5 + (p0.x - 0.5 - motor.giro * GRADO) * z, y: 0.5 + (p0.y - 0.5 + motor.inclinacion * GRADO) * z };
  const dx = p.x - 0.5, dy = p.y - 0.5, r2 = dx * dx + dy * dy;
  return { x: 0.5 + dx * (1 + K_LENTE * r2 * 4), y: 0.5 + dy * (1 + K_LENTE * r2 * 4) };
}

/** Responde /api/ptz y /api/imagen sin tocar la cámara real. */
export function simularServidor() {
  const original = window.fetch.bind(window);
  window.fetch = async (ruta, opciones = {}) => {
    const r = String(ruta);
    const json = (d) => new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json' } });
    if (r.startsWith('/api/ptz')) {
      if (opciones.method === 'POST') {
        const d = JSON.parse(opciones.body || '{}');
        if (typeof d.giro === 'number') motor.giro = Math.max(-150, Math.min(150, d.giro));
        if (typeof d.inclinacion === 'number') motor.inclinacion = Math.max(-90, Math.min(90, d.inclinacion));
        if (typeof d.zoom === 'number') motor.zoom = Math.max(100, Math.min(150, Math.round(d.zoom)));
        return json({ ok: true });
      }
      return json({ ok: true, ...motor, giroMin: -150, giroMax: 150, inclinacionMin: -90, inclinacionMax: 90, zoomMin: 100, zoomMax: 150 });
    }
    if (r.startsWith('/api/imagen') || r.startsWith('/api/camara') || r.startsWith('/api/config') || r.startsWith('/api/salud')) return json({ ok: true });
    return original(ruta, opciones);
  };
}

export function iniciarSimulador(video, { retrasoMs = 120 } = {}) {
  const W = 640, H = 360;
  const lienzo = document.createElement('canvas');
  lienzo.width = W; lienzo.height = H;
  const ctx = lienzo.getContext('2d');
  const cola = [];
  const borde = [];
  for (let t = 0; t <= 1.0001; t += 0.05) borde.push([t, 0]);
  for (let t = 0; t <= 1.0001; t += 0.05) borde.push([1, t]);
  for (let t = 1; t >= -0.0001; t -= 0.05) borde.push([t, 1]);
  for (let t = 1; t >= -0.0001; t -= 0.05) borde.push([0, t]);

  function estadoPantalla() {
    const cal = document.querySelector('.calibrando');
    if (!cal) return { tipo: 'museo' };
    const blanco = cal.querySelector('.blanco');
    const punto = cal.querySelector('.punto');
    if (blanco && !blanco.hidden) return { tipo: 'blanco' };
    if (punto && !punto.hidden) {
      const r = punto.getBoundingClientRect();
      return { tipo: 'punto', x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight, lado: r.width / innerWidth };
    }
    return { tipo: 'negro' };
  }

  setInterval(() => {
    cola.push({ t: performance.now(), e: estadoPantalla() });
    while (cola.length > 1 && performance.now() - cola[1].t > retrasoMs) cola.shift();
    const e = cola[0].e; // lo que pasaba hace retrasoMs: el retraso real de una cámara
    // Luz del cuarto (motor.luz de 0 a 1): aclara todo por igual, así que el
    // proyector se distingue menos. La luz del proyector se suma encima.
    const A = 42 + (motor.luz || 0) * 150;
    const gris = (v) => { const n = Math.round(Math.min(255, v)); return `rgb(${n},${n},${n})`; };
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, gris(A)); g.addColorStop(1, gris(A + 18));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Lo que proyecta el proyector sobre la mesa
    ctx.beginPath();
    borde.forEach(([x, y], i) => { const q = verCamara(x, y); i ? ctx.lineTo(q.x * W, q.y * H) : ctx.moveTo(q.x * W, q.y * H); });
    ctx.closePath();
    ctx.fillStyle = gris(A + 8 + (e.tipo === 'blanco' ? 180 : e.tipo === 'museo' ? 28 : 0));
    ctx.fill();
    if (e.tipo === 'punto') {
      const c = verCamara(e.x, e.y);
      const c2 = verCamara(e.x + e.lado / 2, e.y);
      const r = Math.max(2, Math.hypot((c2.x - c.x) * W, (c2.y - c.y) * H));
      ctx.fillStyle = gris(A + 8 + 180);
      ctx.beginPath(); ctx.arc(c.x * W, c.y * H, r, 0, Math.PI * 2); ctx.fill();
    }
    // Reflejo fijo de una lámpara en la mesa (no cambia: la calibración no debe confundirse)
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(W * 0.92, H * 0.1, 9, 0, Math.PI * 2); ctx.fill();
    // Ruido del sensor
    const img = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 16) {
      const n = (Math.random() - 0.5) * 14;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }, 33);

  video.srcObject = lienzo.captureStream(30);
  return video.play();
}

/** Error real de la calibración guardada, en fracción de pantalla. */
export function errorReal(mapear) {
  let suma = 0, max = 0, n = 0;
  for (let y = 0.08; y <= 0.92; y += 0.07) {
    for (let x = 0.06; x <= 0.94; x += 0.07) {
      const c = verCamara(x, y);
      const p = mapear(c.x, c.y, false);
      const e = Math.hypot(p.x - x, p.y - y);
      suma += e; n++; if (e > max) max = e;
    }
  }
  return { medio: suma / n, maximo: max };
}
