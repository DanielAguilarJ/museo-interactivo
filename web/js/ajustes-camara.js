// Controles para girar, inclinar y hacer zoom con la cámara desde Ajustes.
// Usan app.control.ptz, que elige solo la vía disponible: el agente local
// (Mac) o el navegador (Windows y Mac, si la cámara lo permite).

export async function moverCamara(valores, app) {
  const ptz = app.control?.ptz;
  if (!ptz) return { ok: false, error: 'No puedo mover esta cámara desde aquí' };
  const r = await ptz.poner(valores);
  const ahora = await ptz.leer();
  if (ahora.ok) {
    app.config.posicionCamara = { giro: ahora.giro, inclinacion: ahora.inclinacion, zoom: ahora.zoom };
    app.guardar();
  }
  return { ...ahora, ok: r.ok && ahora.ok, error: r.error };
}

export async function construirControlesCamara(caja, app, avisar) {
  const ptz = app.control?.ptz;
  const p = ptz ? await ptz.leer() : null;
  if (!p?.ok) {
    caja.innerHTML = '<p>En esta computadora no puedo mover la cámara. Apúntala a mano hacia la mesa (o con la app EMEET Studio) hasta que en la vista se vea toda la imagen del proyector.</p>';
    return false;
  }
  const filas = [
    p.conGiro && ['giro', 'Girar', p.giroMin, p.giroMax, p.giro, '°'],
    p.conGiro && ['inclinacion', 'Inclinar', p.inclinacionMin, p.inclinacionMax, p.inclinacion, '°'],
    p.conZoom && ['zoom', 'Zoom', p.zoomMin, p.zoomMax, p.zoom, ''],
  ].filter(Boolean);
  caja.innerHTML = filas.map(([k, n, min, max, v, u]) => `
    <div class="deslizador"><label>${n}</label>
      <input type="range" data-srv="${k}" min="${min}" max="${max}" step="1" value="${v}">
      <span data-vsrv="${k}">${Math.round(v)}${u}</span></div>`).join('') +
    `<div class="fila"><button data-a="centrar">⟲ Centrar</button>${p.conGiro ? '<button data-a="abajo">⬇ Apuntar hacia abajo</button>' : ''}</div>` +
    (p.conGiro ? '' : '<p>Esta cámara solo deja cambiar el zoom desde aquí: el giro se ajusta a mano.</p>');
  const enviar = async (valores) => {
    const r = await moverCamara(valores, app);
    if (!r.ok) avisar(r.error || 'La cámara no se movió', false);
    return r;
  };
  let espera = null;
  caja.querySelectorAll('input[data-srv]').forEach((inp) => {
    inp.oninput = () => {
      const fila = filas.find((f) => f[0] === inp.dataset.srv);
      caja.querySelector(`[data-vsrv="${inp.dataset.srv}"]`).textContent = Math.round(inp.value) + fila[5];
      clearTimeout(espera);
      espera = setTimeout(() => enviar({ [inp.dataset.srv]: +inp.value }), 150);
    };
  });
  caja.querySelector('[data-a="centrar"]').onclick = async () => { await enviar({ giro: 0, inclinacion: 0, zoom: p.zoomMin }); construirControlesCamara(caja, app, avisar); };
  const abajo = caja.querySelector('[data-a="abajo"]');
  if (abajo) abajo.onclick = async () => { await enviar({ inclinacion: p.inclinacionMin }); construirControlesCamara(caja, app, avisar); };
  return true;
}
