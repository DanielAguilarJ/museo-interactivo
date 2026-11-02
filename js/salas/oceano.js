// Sala «El Océano»: la mesa es el fondo del mar. Si mueves la mano rápido,
// el agua hace ondas y los peces huyen. Si te quedas quieto, los curiosos
// se acercan y, al tocarlos, aparece su ficha.

import { crearLienzo2D, azar, minLado } from './comun.js';
import { ESPECIES } from './criaturas-mar.js';

export default {
  id: 'oceano',
  titulo: 'El Océano',
  tema: 'Biología marina',
  icono: '🐢',
  color: '#3fd0e0',
  descripcion: 'Mueve la mano y los peces huyen; quédate quieto y se acercan.',

  crear({ contenedor, fichas, sonido }) {
    const { ctx, ajustar } = crearLienzo2D(contenedor);
    const r = azar(11);
    let fondo = pintarFondo();
    const patron = ctx.createPattern(crearCaustica(128), 'repeat');

    const animales = [];
    for (const [nombre, esp] of Object.entries(ESPECIES)) {
      for (let i = 0; i < esp.cantidad; i++) {
        animales.push({
          nombre, esp,
          x: innerWidth * (0.15 + r() * 0.7), y: innerHeight * (0.15 + r() * 0.7),
          ang: r() * Math.PI * 2, giro: 0, fase: r() * 10, impulso: 1,
          altura: nombre === 'pulpo' ? 0.05 : nombre === 'ballena' ? 0.9 : 0.25 + r() * 0.6,
          tocado: 0, avisado: false, tono: 0,
        });
      }
    }
    animales.sort((a, b) => a.altura - b.altura); // los de abajo se dibujan primero

    const ondas = [];
    const manosPrevias = new Map();
    let tiempo = 0;
    let ultimoBurbujeo = 0;

    return {
      actualizar(dt, manos) {
        tiempo += dt;
        const W = innerWidth, H = innerHeight, L = minLado();

        // Velocidad de cada mano: rápida = asusta, quieta = atrae
        for (const m of manos) {
          const prev = manosPrevias.get(m.id);
          const vel = prev ? Math.hypot(m.x - prev.x, m.y - prev.y) / Math.max(dt, 1e-3) : 0;
          const suave = prev ? prev.vel * 0.7 + vel * 0.3 : 0;
          const quietaDesde = suave < L * 0.2 ? (prev?.quietaDesde ?? tiempo) : null;
          let rastro = prev?.rastro ?? 0;
          if (suave > L * 0.5) {
            rastro += dt;
            if (rastro > 0.07) { rastro = 0; ondas.push({ x: m.x, y: m.y, r: L * 0.01, vida: 1 }); }
            if (tiempo - ultimoBurbujeo > 0.25) { ultimoBurbujeo = tiempo; sonido.burbuja(); }
          }
          manosPrevias.set(m.id, { x: m.x, y: m.y, vel: suave, quietaDesde, rastro });
          m.rapida = suave > L * 0.5;
          m.quieta = quietaDesde !== null && tiempo - quietaDesde > 0.8;
        }
        for (const id of manosPrevias.keys()) if (!manos.some((m) => m.id === id)) manosPrevias.delete(id);

        // Animales
        for (const a of animales) {
          const s = a.esp.tam * L;
          a.giro += (r() - 0.5) * dt * 3;
          a.giro = Math.max(-0.8, Math.min(0.8, a.giro * 0.98));
          let deseado = null;
          let empuje = 1;
          let tocandolo = false;
          for (const m of manos) {
            const d = Math.hypot(a.x - m.x, a.y - m.y);
            if (d < s * 0.9 + L * 0.03) tocandolo = true;
            if (m.rapida && d < L * (0.12 + 0.2 * a.esp.asustadizo)) {
              deseado = Math.atan2(a.y - m.y, a.x - m.x);
              empuje = 1 + 3 * a.esp.asustadizo;
            } else if (m.quieta && d < L * 0.4 && d > s * 0.7 && deseado === null) {
              deseado = Math.atan2(m.y - a.y, m.x - a.x);
              empuje = 0.8;
            }
          }
          // No salirse de la mesa
          const margen = s * 1.2 + L * 0.04;
          if (a.x < margen || a.x > W - margen || a.y < margen || a.y > H - margen) {
            deseado = Math.atan2(H / 2 - a.y, W / 2 - a.x);
          }
          if (deseado !== null) a.ang += angulo(a.ang, deseado) * Math.min(1, dt * 3);
          else a.ang += a.giro * dt;
          a.impulso += (empuje - a.impulso) * Math.min(1, dt * 4);
          const v = a.esp.velocidad * L * a.impulso * (tocandolo ? 0.15 : 1);
          a.x += Math.cos(a.ang) * v * dt;
          a.y += Math.sin(a.ang) * v * dt;
          a.x = Math.max(s * 0.5, Math.min(W - s * 0.5, a.x));
          a.y = Math.max(s * 0.5, Math.min(H - s * 0.5, a.y));
          a.fase += dt * (3 + a.impulso * 3);

          if (tocandolo) {
            if (a.tocado === 0) sonido.tocar();
            a.tocado += dt;
            if (a.tocado > 0.4) {
              if (!a.avisado) { a.avisado = true; sonido.ficha(); }
              fichas.mostrar(a.nombre, { ...a.esp.ficha, color: a.esp.color }, a.x, a.y, s);
            }
          } else { a.tocado = 0; a.avisado = false; }
          // El pulpo cambia de color mientras lo tocan
          a.tono += ((tocandolo ? 1 : 0) - a.tono) * Math.min(1, dt * 2.5);
        }

        // ---- Dibujo
        ctx.drawImage(fondo, 0, 0, W, H);
        const dpr = Math.min(devicePixelRatio || 1, 2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const escala = L / 300;
        for (const [vx, vy, alfa] of [[18, 7, 0.1], [-11, 15, 0.07]]) {
          ctx.globalAlpha = alfa;
          const k = escala * dpr;
          ctx.setTransform(k, 0, 0, k, ((tiempo * vx) % (128 * escala)) * dpr, ((tiempo * vy) % (128 * escala)) * dpr);
          ctx.fillStyle = patron;
          ctx.fillRect(-128, -128, W / escala + 256, H / escala + 256);
        }
        ctx.restore();

        for (const a of animales) {
          const s = a.esp.tam * L;
          // Sombra sobre la arena: más lejos cuanto más alto nada
          const off = a.altura * L * 0.045;
          const g = ctx.createRadialGradient(a.x + off, a.y + off, 0, a.x + off, a.y + off, s * 1.1);
          g.addColorStop(0, `rgba(0, 10, 20, ${0.35 - a.altura * 0.15})`);
          g.addColorStop(1, 'rgba(0, 10, 20, 0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(a.x + off, a.y + off, s * 1.1, 0, Math.PI * 2); ctx.fill();

          ctx.save();
          ctx.translate(a.x, a.y);
          ctx.rotate(a.ang);
          const crece = 1 + Math.min(1, a.tocado * 3) * 0.12;
          ctx.scale(crece, crece);
          a.esp.dibujar(ctx, s, a.fase, a.tono);
          ctx.restore();
        }

        // Ondas del agua
        ctx.lineWidth = L * 0.004;
        for (let i = ondas.length - 1; i >= 0; i--) {
          const o = ondas[i];
          o.r += L * 0.18 * dt;
          o.vida -= dt * 1.1;
          if (o.vida <= 0) { ondas.splice(i, 1); continue; }
          ctx.strokeStyle = `rgba(200, 250, 255, ${o.vida * 0.5})`;
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.stroke();
        }
        if (ondas.length > 120) ondas.splice(0, ondas.length - 120);
      },
      redimensionar() { ajustar(); fondo = pintarFondo(); },
      posiciones() {
        return Object.fromEntries(animales.map((a) => [a.nombre, { x: a.x / innerWidth, y: a.y / innerHeight }]));
      },
      destruir() {},
    };
  },
};

// Diferencia de ángulos en (-π, π]
function angulo(de, a) {
  let d = (a - de) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Fondo marino: agua turquesa, arena, rocas y corales en las orillas.
function pintarFondo() {
  const W = innerWidth, H = innerHeight, L = Math.min(W, H);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const r = azar(3);
  const g = x.createRadialGradient(W / 2, H / 2, L * 0.1, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, '#187585'); g.addColorStop(0.6, '#0c4f66'); g.addColorStop(1, '#062b3d');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(230, 210, 160, ${r() * 0.07})`;
    x.beginPath(); x.ellipse(r() * W, r() * H, 4 + r() * L * 0.06, 3 + r() * L * 0.03, r() * 3, 0, Math.PI * 2); x.fill();
  }
  const colores = ['#ff7a8a', '#ffb05c', '#c780ff', '#ff9ed1', '#5fe0b0'];
  const orilla = () => {
    const lado = Math.floor(r() * 4), t = r();
    return lado === 0 ? [t * W, r() * L * 0.08] : lado === 1 ? [t * W, H - r() * L * 0.08] : lado === 2 ? [r() * L * 0.08, t * H] : [W - r() * L * 0.08, t * H];
  };
  for (let i = 0; i < 26; i++) {
    const [cx, cy] = orilla();
    x.fillStyle = 'rgba(40, 55, 60, 0.7)';
    x.beginPath(); x.ellipse(cx, cy, L * (0.03 + r() * 0.05), L * (0.02 + r() * 0.04), r() * 3, 0, Math.PI * 2); x.fill();
    const col = colores[i % colores.length];
    for (let k = 0; k < 14; k++) {
      x.fillStyle = col;
      x.globalAlpha = 0.55 + r() * 0.4;
      x.beginPath(); x.arc(cx + (r() - 0.5) * L * 0.08, cy + (r() - 0.5) * L * 0.08, L * (0.006 + r() * 0.012), 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
  }
  return c;
}

// Luz del sol que atraviesa las olas (patrón de cáusticas que se repite).
function crearCaustica(n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  const img = x.createImageData(n, n);
  const r = azar(5);
  const puntos = Array.from({ length: 16 }, () => [r() * n, r() * n]);
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      let d1 = 1e9, d2 = 1e9;
      for (const [qx, qy] of puntos) {
        let dx = Math.abs(px - qx), dy = Math.abs(py - qy);
        dx = Math.min(dx, n - dx); dy = Math.min(dy, n - dy);
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const borde = Math.sqrt(d2) - Math.sqrt(d1);
      const v = Math.max(0, 1 - borde / 5) ** 2 * 255;
      const i = (py * n + px) * 4;
      img.data[i] = v * 0.85; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
