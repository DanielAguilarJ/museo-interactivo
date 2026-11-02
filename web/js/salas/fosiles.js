// Sala «Excavación de fósiles»: la mesa está cubierta de arena. Al frotar con
// la mano, la arena se va y aparecen fósiles enterrados en la roca. Cuando un
// fósil queda casi todo a la vista, se ilumina y aparece su ficha.

import { crearLienzo2D, azar, minLado } from './comun.js';
import { FOSILES } from './dibujos-fosiles.js';

const CELDA = 8; // px de la rejilla que lleva la cuenta de cuánta arena queda

export default {
  id: 'fosiles',
  titulo: 'Excavación de fósiles',
  tema: 'Paleontología',
  icono: '🦴',
  color: '#e0a35a',
  descripcion: 'Frota la arena con la mano para descubrir fósiles.',

  crear({ contenedor, fichas, sonido }) {
    const { ctx, ajustar } = crearLienzo2D(contenedor);
    let semilla = 1;
    let roca, arena, arenaCtx, mascara, columnas, filas, piezas, granos, terminadaEn, tiempo = 0, ultimoRaspado = 0;

    function nuevaExcavacion() {
      const W = innerWidth, H = innerHeight, L = minLado();
      const r = azar(semilla++);
      // Lugares: rejilla de 3×2 con algo de azar; se deja libre la esquina del botón «Salas».
      const celdas = [];
      for (let fy = 0; fy < 2; fy++) for (let fx = 0; fx < 3; fx++) celdas.push([fx, fy]);
      const elegidas = celdas.filter(([fx, fy]) => !(fx === 0 && fy === 1)).sort(() => r() - 0.5);
      piezas = FOSILES.map((f, i) => {
        const [fx, fy] = elegidas[i % elegidas.length];
        return {
          ...f,
          x: W * (0.2 + fx * 0.3 + (r() - 0.5) * 0.1),
          y: H * (0.3 + fy * 0.42 + (r() - 0.5) * 0.08),
          s: L * (0.09 + r() * 0.025),
          giro: (r() - 0.5) * 1.6,
          descubierto: false, brillo: 0, mostrarHasta: 0,
        };
      });
      roca = pintarRoca(W, H, r, piezas);
      arena = document.createElement('canvas');
      arena.width = W; arena.height = H;
      arenaCtx = arena.getContext('2d');
      arenaCtx.drawImage(pintarArena(W, H, r), 0, 0);
      columnas = Math.ceil(W / CELDA); filas = Math.ceil(H / CELDA);
      mascara = new Float32Array(columnas * filas).fill(1);
      granos = [];
      terminadaEn = null;
      fichas.vaciar();
    }
    nuevaExcavacion();

    function quitarArena(x, y, radio, fuerza) {
      // Dibujo: borra la arena con un pincel suave
      const g = arenaCtx.createRadialGradient(x, y, 0, x, y, radio);
      g.addColorStop(0, `rgba(0,0,0,${fuerza})`);
      g.addColorStop(0.7, `rgba(0,0,0,${fuerza * 0.6})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      arenaCtx.globalCompositeOperation = 'destination-out';
      arenaCtx.fillStyle = g;
      arenaCtx.beginPath(); arenaCtx.arc(x, y, radio, 0, Math.PI * 2); arenaCtx.fill();
      arenaCtx.globalCompositeOperation = 'source-over';
      // Cuenta: la misma cantidad en la rejilla
      const c0 = Math.max(0, Math.floor((x - radio) / CELDA)), c1 = Math.min(columnas - 1, Math.floor((x + radio) / CELDA));
      const f0 = Math.max(0, Math.floor((y - radio) / CELDA)), f1 = Math.min(filas - 1, Math.floor((y + radio) / CELDA));
      for (let f = f0; f <= f1; f++) {
        for (let c = c0; c <= c1; c++) {
          const d = Math.hypot((c + 0.5) * CELDA - x, (f + 0.5) * CELDA - y) / radio;
          if (d < 1) { const i = f * columnas + c; mascara[i] = Math.max(0, mascara[i] - fuerza * (d < 0.7 ? 1 : 0.6)); }
        }
      }
    }

    function descubierta(p) {
      let vistos = 0, total = 0;
      for (let k = 0; k < 60; k++) {
        const a = k * 2.399, rr = p.s * 0.85 * Math.sqrt((k + 0.5) / 60); // espiral de puntos dentro del fósil
        const c = Math.floor((p.x + Math.cos(a) * rr) / CELDA), f = Math.floor((p.y + Math.sin(a) * rr) / CELDA);
        if (c < 0 || f < 0 || c >= columnas || f >= filas) continue;
        total++;
        if (mascara[f * columnas + c] < 0.35) vistos++;
      }
      return total ? vistos / total : 0;
    }

    return {
      actualizar(dt, manos, ahora) {
        tiempo += dt;
        const W = innerWidth, H = innerHeight, L = minLado();
        const fuerza = Math.min(1, dt * 2.6);

        for (const m of manos) {
          quitarArena(m.x, m.y, L * 0.055, fuerza);
          quitarArena(m.palma.x, m.palma.y, Math.max(m.radio, L * 0.06), fuerza * 0.8);
          if (granos.length < 260) {
            for (let k = 0; k < 2; k++) {
              const a = Math.random() * Math.PI * 2, v = L * (0.1 + Math.random() * 0.25);
              granos.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.5 + Math.random() * 0.3 });
            }
          }
          if (tiempo - ultimoRaspado > 0.09) { ultimoRaspado = tiempo; sonido.raspar(); }
        }

        for (const p of piezas) {
          if (!p.descubierto && descubierta(p) > 0.6) {
            p.descubierto = true;
            p.mostrarHasta = tiempo + 7;
            sonido.descubrir();
          }
          if (p.descubierto) {
            p.brillo = Math.min(1, p.brillo + dt * 1.5);
            const encima = manos.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < p.s * 1.1);
            if (encima || tiempo < p.mostrarHasta) fichas.mostrar(p.id, { ...p.ficha, color: '#e0a35a' }, p.x, p.y, p.s * 1.1);
          }
        }
        const encontrados = piezas.filter((p) => p.descubierto).length;
        if (encontrados === piezas.length && terminadaEn === null) { terminadaEn = tiempo; }
        if (terminadaEn !== null && tiempo - terminadaEn > 16) nuevaExcavacion();

        // ---- Dibujo
        ctx.drawImage(roca, 0, 0, W, H);
        for (const p of piezas) {
          if (p.brillo <= 0) continue;
          const pulso = 0.6 + Math.sin(tiempo * 3) * 0.25;
          const g = ctx.createRadialGradient(p.x, p.y, p.s * 0.6, p.x, p.y, p.s * 1.5);
          g.addColorStop(0, `rgba(255, 210, 120, ${0.35 * p.brillo * pulso})`);
          g.addColorStop(1, 'rgba(255, 210, 120, 0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 1.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.drawImage(arena, 0, 0, W, H);

        ctx.fillStyle = 'rgba(214, 180, 120, 0.9)';
        for (let i = granos.length - 1; i >= 0; i--) {
          const g = granos[i];
          g.vida -= dt;
          if (g.vida <= 0) { granos.splice(i, 1); continue; }
          g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= 0.9; g.vy *= 0.9;
          ctx.globalAlpha = Math.min(1, g.vida * 2);
          ctx.fillRect(g.x, g.y, L * 0.005, L * 0.005);
        }
        ctx.globalAlpha = 1;

        // Marcador
        const texto = terminadaEn !== null ? '¡Excavación completa! Encontraste todos los fósiles 🎉' : `Fósiles encontrados: ${encontrados} de ${piezas.length}`;
        ctx.font = `700 ${Math.round(L * (terminadaEn !== null ? 0.04 : 0.03))}px "Avenir Next", sans-serif`;
        const ancho = ctx.measureText(texto).width + L * 0.06;
        ctx.fillStyle = 'rgba(16, 12, 8, 0.78)';
        redondeado(ctx, W / 2 - ancho / 2, L * 0.025, ancho, L * (terminadaEn !== null ? 0.075 : 0.06), L * 0.03);
        ctx.fillStyle = '#ffd99a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(texto, W / 2, L * (terminadaEn !== null ? 0.0625 : 0.055));
        ctx.textBaseline = 'alphabetic';
      },
      redimensionar() { ajustar(); nuevaExcavacion(); },
      posiciones() { return Object.fromEntries(piezas.map((p) => [p.id, { x: p.x / innerWidth, y: p.y / innerHeight }])); },
      destruir() {},
    };
  },
};

function pintarRoca(W, H, r, piezas) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#6b4a2f'); g.addColorStop(1, '#4a3220');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // Capas de roca (estratos)
  for (let i = 0; i < 18; i++) {
    x.strokeStyle = `rgba(${r() > 0.5 ? '30,18,8' : '150,110,70'}, ${0.15 + r() * 0.2})`;
    x.lineWidth = 2 + r() * 10;
    const y0 = (i / 18) * H * 1.2 - H * 0.1;
    x.beginPath(); x.moveTo(0, y0);
    for (let px = 0; px <= W; px += W / 12) x.lineTo(px, y0 + Math.sin(px / W * 6 + i) * H * 0.02 + (r() - 0.5) * 6);
    x.stroke();
  }
  for (let i = 0; i < 1600; i++) {
    x.fillStyle = `rgba(${r() > 0.5 ? '20,10,5' : '190,150,110'}, ${r() * 0.25})`;
    x.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
  }
  for (const p of piezas) {
    x.save();
    x.translate(p.x, p.y);
    x.rotate(p.giro);
    x.shadowColor = 'rgba(0,0,0,0.6)';
    x.shadowBlur = p.s * 0.15;
    x.shadowOffsetY = p.s * 0.04;
    p.dibujar(x, p.s);
    x.restore();
  }
  return c;
}

function pintarArena(W, H, r) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#d8b67c'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    const tono = r();
    x.fillStyle = tono > 0.6 ? 'rgba(250, 228, 180, 0.5)' : tono > 0.3 ? 'rgba(170, 130, 80, 0.4)' : 'rgba(120, 90, 50, 0.35)';
    x.fillRect(r() * W, r() * H, 1 + r() * 2.5, 1 + r() * 2.5);
  }
  for (let i = 0; i < 40; i++) {
    const t = r(); // piedritas en tonos de gris y café, no de colores
    x.fillStyle = `rgba(${120 + t * 70 | 0}, ${105 + t * 60 | 0}, ${85 + t * 50 | 0}, 0.8)`;
    x.beginPath(); x.ellipse(r() * W, r() * H, 3 + r() * 8, 2 + r() * 6, r() * 3, 0, Math.PI * 2); x.fill();
  }
  // Ondas de arena
  x.strokeStyle = 'rgba(160, 120, 70, 0.18)';
  x.lineWidth = 3;
  for (let y = 0; y < H; y += 26) {
    x.beginPath();
    for (let px = 0; px <= W; px += 20) x.lineTo(px, y + Math.sin(px / 60 + y) * 5);
    x.stroke();
  }
  return c;
}

function redondeado(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}
