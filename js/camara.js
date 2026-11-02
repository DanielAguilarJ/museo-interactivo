// Abre la cámara EMEET PIXY (o la que se elija en Ajustes) y aplica el
// giro, inclinación y zoom guardados.

const ES_PIXY = /emeet|pixy/i;
const DESCARTAR = /desk view|virtual|obs/i;

export async function listarCamaras() {
  let lista = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  if (lista.length && !lista[0].label) {
    // Sin permiso todavía no hay nombres: pedimos permiso una vez y volvemos a listar.
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    s.getTracks().forEach((t) => t.stop());
    lista = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  }
  return lista;
}

function elegir(lista, idGuardado) {
  return (
    lista.find((d) => d.deviceId === idGuardado) ||
    lista.find((d) => ES_PIXY.test(d.label)) ||
    lista.find((d) => !DESCARTAR.test(d.label)) ||
    lista[0]
  );
}

/**
 * @returns {Promise<{video:HTMLVideoElement, track:MediaStreamTrack, etiqueta:string, esPixy:boolean, deviceId:string}>}
 */
export async function abrirCamara(config = {}) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara');
  const lista = await listarCamaras();
  if (!lista.length) throw new Error('No hay ninguna cámara conectada');
  const disp = elegir(lista, config.camaraId);

  const restricciones = {
    deviceId: { exact: disp.deviceId },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 60 },
  };
  const soporta = navigator.mediaDevices.getSupportedConstraints();
  if (soporta.pan) Object.assign(restricciones, { pan: true, tilt: true, zoom: true });

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: restricciones, audio: false });
  } catch (e) {
    // Si pedir giro/zoom falla, abrimos solo la imagen.
    delete restricciones.pan; delete restricciones.tilt; delete restricciones.zoom;
    stream = await navigator.mediaDevices.getUserMedia({ video: restricciones, audio: false });
  }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadeddata', r, { once: true }));

  const track = stream.getVideoTracks()[0];
  await aplicarPTZ(track, config.ptz);
  return { video, track, etiqueta: disp.label || 'Cámara', esPixy: ES_PIXY.test(disp.label), deviceId: disp.deviceId };
}

export function capacidadesPTZ(track) {
  const cap = track?.getCapabilities?.() || {};
  const r = {};
  for (const k of ['pan', 'tilt', 'zoom']) if (cap[k] && cap[k].max > cap[k].min) r[k] = cap[k];
  return Object.keys(r).length ? r : null;
}

export function valoresPTZ(track) {
  const s = track?.getSettings?.() || {};
  return { pan: s.pan, tilt: s.tilt, zoom: s.zoom };
}

export async function aplicarPTZ(track, ptz) {
  if (!ptz || !track) return;
  const cap = capacidadesPTZ(track);
  if (!cap) return;
  const avanzado = {};
  for (const k of Object.keys(cap)) if (typeof ptz[k] === 'number') avanzado[k] = ptz[k];
  if (!Object.keys(avanzado).length) return;
  try {
    await track.applyConstraints({ advanced: [avanzado] });
  } catch (e) {
    console.warn('No se pudo mover la cámara', e);
  }
}

export function cerrarCamara(cam) {
  cam?.track?.stop();
  if (cam?.video) cam.video.srcObject = null;
}
