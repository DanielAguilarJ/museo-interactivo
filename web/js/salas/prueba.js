// Sala de prueba de la calibración.
//  - Modo «probar»: cuadrícula y 9 miras; al poner el dedo encima, la mira se
//    pone verde y dice cuántos píxeles se corre.
//  - Modo «afinar»: se toca cada mira con la yema del índice y se mantiene
//    quieto un momento; el museo aprende el desvío del dedo y lo corrige.

import { crearLienzo2D } from './comun.js';
import { rejillaDedo } from '../calibracion/modelo.js';

const EJES = [0.1, 0.5, 0.9];

export const salaPrueba = {
  id: 'prueba',
  titulo: 'Prueba de calibración',
  crear({ contenedor, app, sonido, opciones = {} }) {
    const { ctx, ajustar } = crearLienzo2D(contenedor);
    const miras = [];
    for (const y of EJES) for (const x of EJES) miras.push({ x, y, tocada: 0, desvio: null });
    let modo = opciones.afinar ? 'afinar' : 'probar';
    let indice = 0;
    let muestras = [];
    const toques = [];
    let mensajeFinal = '';
    // El afinado mide con mapear(..., false), que ignora el afinado anterior:
    // si se cancela a medias, el afinado viejo sigue intacto.

    function terminarAfinado() {
      const rejilla = rejillaDedo(toques);
      const L = Math.min(innerWidth, innerHeight);
      const desvios = toques.map((t) => Math.hypot((t.mira.x - t.dedo.x) * innerWidth, (t.mira.y - t.dedo.y) * innerHeight));
      const medio = desvios.reduce((a, b) => a + b, 0) / desvios.length;
      if (app && rejilla) {
        app.config.mapa = { ...(app.config.mapa || { h: app.config.homografia, malla: null }), dedo: rejilla };
        app.config.calibracion = { ...(app.config.calibracion || {}), dedoPx: Math.round(medio), dedoFecha: new Date().toISOString() };
        app.actualizarMapeo();
        app.guardar();
      }
      mensajeFinal = `¡Listo! El dedo se corría ${Math.round(medio)} px (${Math.round((medio / L) * 100)} % de la mesa) y ya está corregido.`;
      sonido?.descubrir();
      modo = 'probar';
    }

    return {
      actualizar(dt, manos) {
        const W = innerWidth, H = innerHeight, L = Math.min(W, H), r = L * 0.035;
        ctx.fillStyle = '#05070c';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(111, 224, 255, 0.16)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 10; i++) {
          ctx.beginPath(); ctx.moveTo((W * i) / 10, 0); ctx.lineTo((W * i) / 10, H); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, (H * i) / 10); ctx.lineTo(W, (H * i) / 10); ctx.stroke();
        }
        const deCamara = manos.filter((m) => m.crudo);

        if (modo === 'afinar') {
          const mira = miras[indice];
          const x = mira.x * W, y = mira.y * H;
          const cerca = deCamara.find((m) => Math.hypot(m.x - x, m.y - y) < L * 0.12);
          let progreso = 0;
          if (cerca) {
            const p = app.mapear(cerca.crudo.x, cerca.crudo.y, false);
            muestras.push(p);
            if (muestras.length > 40) muestras.shift();
            const media = promedio(muestras);
            const dispersion = Math.max(...muestras.map((q) => Math.hypot(q.x - media.x, q.y - media.y)));
            if (dispersion > 0.008) muestras = muestras.slice(-3); // se movió: vuelve a empezar
            progreso = Math.min(1, muestras.length / 24);
            if (muestras.length >= 24) {
              toques.push({ mira: { x: mira.x, y: mira.y }, dedo: media });
              sonido?.tocar();
              muestras = [];
              indice++;
              if (indice >= miras.length) terminarAfinado();
            }
          } else muestras = [];
          // Mira actual grande y pulsante; las ya tocadas en verde
          miras.forEach((m, i) => dibujarMira(ctx, m.x * W, m.y * H, r * (i === indice ? 1.4 : 0.8),
            i < indice ? '#7be38f' : i === indice ? '#ffc861' : 'rgba(255,255,255,0.25)', i === indice ? progreso : 0));
          texto(ctx, W, H, L, `Afinar con el dedo · mira ${Math.min(indice + 1, 9)} de 9`,
            deCamara.length ? 'Pon la YEMA del dedo índice justo en el centro de la mira amarilla y no lo muevas.' : 'Pon una mano en la mesa: la cámara todavía no la ve.');
          return;
        }

        for (const m of miras) {
          const x = m.x * W, y = m.y * H;
          const cerca = manos.find((h) => Math.hypot(h.x - x, h.y - y) < r * 1.6);
          m.tocada = cerca ? 1 : Math.max(0, m.tocada - dt * 2);
          if (cerca) m.desvio = Math.hypot(cerca.x - x, cerca.y - y);
          dibujarMira(ctx, x, y, r, m.tocada > 0 ? `rgba(123, 227, 143, ${0.4 + m.tocada * 0.6})` : 'rgba(255, 200, 97, 0.9)', 0);
          if (m.tocada > 0 && m.desvio != null) {
            ctx.fillStyle = '#7be38f';
            ctx.font = `700 ${Math.round(L * 0.022)}px "Avenir Next", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(m.desvio)} px`, x, y + r * 2.4);
          }
        }
        texto(ctx, W, H, L, mensajeFinal || 'Pon la punta del dedo sobre cada mira',
          'El círculo de luz debe quedar bajo tu dedo y la mira se pone verde. Si queda corrido, pulsa A y afina con el dedo o calibra otra vez.');
      },
      redimensionar: ajustar,
      destruir() {},
    };
  },
};

function dibujarMira(ctx, x, y, r, color, progreso) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * 1.6, y); ctx.lineTo(x + r * 1.6, y); ctx.moveTo(x, y - r * 1.6); ctx.lineTo(x, y + r * 1.6); ctx.stroke();
  if (progreso > 0) {
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(x, y, r * 1.3, -Math.PI / 2, -Math.PI / 2 + progreso * Math.PI * 2); ctx.stroke();
  }
}

function texto(ctx, W, H, L, titulo, detalle) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4efe4';
  ctx.font = `600 ${Math.round(L * 0.032)}px "Avenir Next", sans-serif`;
  ctx.fillText(titulo, W / 2, H * 0.3);
  ctx.fillStyle = '#b9b2a3';
  ctx.font = `500 ${Math.round(L * 0.022)}px "Avenir Next", sans-serif`;
  ctx.fillText(detalle, W / 2, H * 0.36);
}

function promedio(ps) {
  const s = ps.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / ps.length, y: s.y / ps.length };
}
