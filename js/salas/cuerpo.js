// Sala «El cuerpo humano»: un cuerpo acostado sobre la mesa. Cada mano es
// una lupa de rayos X que deja ver por dentro. Con los botones del lado se
// elige ver órganos o huesos; al tocar uno aparece su ficha. El corazón late
// (y suena) y los pulmones respiran.

import { crearLienzo2D, minLado } from './comun.js';
import { ORGANOS, HUESOS, pintarCuerpo, dibujarEsqueleto, dibujarOrgano, dentro } from './dibujos-cuerpo.js';
import { Permanencia } from '../entrada.js';

export default {
  id: 'cuerpo',
  titulo: 'El cuerpo humano',
  tema: 'Ciencias de la salud',
  icono: '🫀',
  color: '#ff6b8a',
  descripcion: 'Tu mano es unos rayos X: mira por dentro del cuerpo.',

  crear({ contenedor, fichas, sonido, entrada }) {
    const { ctx, ajustar } = crearLienzo2D(contenedor);
    const interior = document.createElement('canvas');
    const ictx = interior.getContext('2d');
    let modo = 'organos';
    const permanencia = new Permanencia(1);
    let tiempo = 0, tocado = null, tocadoDesde = 0, ultimoLatido = 0, cuerpo = null, t = null;

    function geometria() {
      const W = innerWidth, H = innerHeight;
      const s = H * 0.93;
      t = { s, x: (lx) => W * 0.42 + lx * s, y: (ly) => H * 0.035 + ly * s, aLocal: (px, py) => ({ x: (px - W * 0.42) / s, y: (py - H * 0.035) / s }) };
      interior.width = W; interior.height = H;
      cuerpo = pintarCuerpo(W, H, t);
    }
    geometria();

    const botones = () => {
      const L = minLado(), W = innerWidth, H = innerHeight;
      return [
        { id: 'organos', texto: '🫀 Órganos', x: W * 0.84, y: H * 0.36, r: L * 0.085 },
        { id: 'huesos', texto: '🦴 Huesos', x: W * 0.84, y: H * 0.62, r: L * 0.085 },
      ];
    };

    return {
      actualizar(dt, manos) {
        tiempo += dt;
        const W = innerWidth, H = innerHeight, L = minLado();
        const radioLupa = L * 0.15;

        // Cambiar de modo dejando la mano sobre un botón
        const bs = botones();
        const elegido = permanencia.actualizar(manos, bs.map((b) => ({ id: b.id, contiene: (x, y) => Math.hypot(x - b.x, y - b.y) < b.r })), dt, entrada);
        if (elegido && elegido !== modo) { modo = elegido; sonido.entrar(); fichas.vaciar(); }

        // ¿Qué toca cada dedo dentro del cuerpo?
        let ahora = null;
        for (const m of manos) {
          const p = t.aLocal(m.x, m.y);
          const lista = modo === 'organos' ? [...ORGANOS].reverse() : HUESOS;
          const f = lista.find((o) => dentro(o, p.x, p.y));
          if (f) { ahora = { f, m }; break; }
        }
        if (ahora?.f.id !== tocado) { tocado = ahora?.f.id ?? null; tocadoDesde = tiempo; if (tocado) sonido.tocar(); }
        if (ahora && tiempo - tocadoDesde > 0.35) {
          const f = ahora.f;
          // La ficha va al lado del cuerpo, nunca encima de él
          fichas.mostrar(f.id, { ...f.ficha, color: f.color || '#9fd3ff' }, t.x(0), t.y(f.y), 0.24 * t.s);
        }
        // Latido que se oye al tocar el corazón
        if (tocado === 'corazon' && tiempo - ultimoLatido > 0.52) { ultimoLatido = tiempo; sonido.latido(); }

        // ---- Interior (rayos X), en su propio lienzo
        ictx.setTransform(1, 0, 0, 1, 0, 0);
        const fondo = ictx.createRadialGradient(t.x(0), H * 0.4, 0, t.x(0), H * 0.4, H * 0.7);
        fondo.addColorStop(0, '#12305c'); fondo.addColorStop(1, '#050d1f');
        ictx.fillStyle = fondo; ictx.fillRect(0, 0, W, H);
        ictx.globalAlpha = 0.14; // la silueta se ve como sombra azul en la radiografía
        ictx.drawImage(cuerpo.mascara, 0, 0);
        ictx.globalAlpha = modo === 'organos' ? 0.35 : 1;
        dibujarEsqueleto(ictx, t);
        ictx.globalAlpha = 1;
        if (modo === 'organos') for (const o of ORGANOS) dibujarOrgano(ictx, t, o, tiempo, o.id === tocado);
        if (modo === 'huesos' && tocado) {
          const h = HUESOS.find((b) => b.id === tocado);
          ictx.strokeStyle = '#ffd38a'; ictx.lineWidth = L * 0.006; ictx.setLineDash([L * 0.012, L * 0.01]);
          ictx.beginPath(); ictx.ellipse(t.x(h.x), t.y(h.y), h.rx * t.s, h.ry * t.s, 0, 0, Math.PI * 2); ictx.stroke();
          ictx.setLineDash([]);
        }

        // ---- Mesa: fondo de camilla, cuerpo por fuera y las lupas
        ctx.fillStyle = '#0b1b2b'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(111, 224, 255, 0.07)'; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += L * 0.05) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += L * 0.05) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = L * 0.03; ctx.shadowOffsetY = L * 0.01;
        ctx.drawImage(cuerpo.piel, 0, 0, W, H);
        ctx.restore();

        // Una línea de escáner recorre el cuerpo cuando nadie lo toca
        const lupas = manos.map((m) => ({ x: m.x, y: m.y, r: radioLupa }));
        if (!manos.length) lupas.push({ x: t.x(0) + Math.sin(tiempo * 0.7) * L * 0.08, y: t.y(0.12 + ((Math.sin(tiempo * 0.35) + 1) / 2) * 0.55), r: radioLupa * 0.8 });
        for (const lu of lupas) {
          ctx.save();
          ctx.beginPath(); ctx.arc(lu.x, lu.y, lu.r, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(interior, 0, 0, W, H);
          ctx.restore();
          ctx.strokeStyle = 'rgba(150, 220, 255, 0.9)'; ctx.lineWidth = L * 0.006;
          ctx.beginPath(); ctx.arc(lu.x, lu.y, lu.r, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(150, 220, 255, 0.9)';
          ctx.font = `700 ${Math.round(L * 0.018)}px "Avenir Next", sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('RAYOS X', lu.x, lu.y - lu.r - L * 0.012);
        }

        // Botones de modo
        for (const b of bs) {
          const activo = b.id === modo;
          const prog = permanencia.progreso(b.id);
          ctx.fillStyle = activo ? 'rgba(255, 200, 97, 0.22)' : 'rgba(255,255,255,0.06)';
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = activo ? '#ffc861' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = L * 0.005;
          ctx.stroke();
          if (prog > 0.02 && !activo) { ctx.strokeStyle = '#ffc861'; ctx.lineWidth = L * 0.01; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke(); }
          ctx.fillStyle = activo ? '#ffe3a8' : '#f4efe4';
          ctx.font = `700 ${Math.round(L * 0.03)}px "Avenir Next", sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(b.texto, b.x, b.y);
          ctx.textBaseline = 'alphabetic';
        }
        ctx.fillStyle = '#b9b2a3';
        ctx.font = `600 ${Math.round(L * 0.024)}px "Avenir Next", sans-serif`;
        ctx.fillText(manos.length ? 'Toca una parte para conocerla' : 'Pon tu mano sobre el cuerpo para verlo por dentro', W * 0.84, H * 0.16);
      },
      redimensionar() { ajustar(); geometria(); },
      posiciones() {
        const r = {};
        for (const f of [...ORGANOS, ...HUESOS]) r[f.id] = { x: t.x(f.pares ? f.pares[0] : f.x) / innerWidth, y: t.y(f.y) / innerHeight };
        r.botonHuesos = { x: botones()[1].x / innerWidth, y: botones()[1].y / innerHeight };
        return r;
      },
      destruir() {},
    };
  },
};
