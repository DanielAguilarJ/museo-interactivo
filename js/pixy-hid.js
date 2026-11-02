// Órdenes propias de la EMEET PIXY (seguimiento, gestos y privacidad
// automática) desde el navegador, con WebHID. Funciona en Chrome y Edge, en
// Windows y en Mac, sin instalar nada. Son los mismos informes de 32 bytes
// que usa pixy.py (identificador de informe 0x09).
//
// La primera vez el navegador pregunta a qué dispositivo dar permiso
// (botón «Conectar el control de la cámara» en Ajustes). Después el permiso
// queda guardado y el museo lo usa solo al encender.

const FILTRO = { vendorId: 0x328f, productId: 0x00c0 };
const ID_INFORME = 0x09;

export const hayWebHID = () => typeof navigator !== 'undefined' && !!navigator.hid;

function esPixy(d) { return d.vendorId === FILTRO.vendorId && d.productId === FILTRO.productId; }

/** Abre la PIXY si ya tiene permiso; con pedir=true muestra el selector del navegador. */
export async function abrirPixy(pedir = false) {
  if (!hayWebHID()) return null;
  let d = (await navigator.hid.getDevices()).find(esPixy);
  if (!d && pedir) [d] = await navigator.hid.requestDevice({ filters: [FILTRO] });
  if (!d) return null;
  if (!d.opened) await d.open();
  return d;
}

// Datos del informe SIN el primer byte (el identificador va aparte en WebHID).
function datos(...bytes) {
  const d = new Uint8Array(31);
  d.set(bytes.slice(0, 31));
  return d;
}

function esperarRespuesta(d, grupo, ms = 600) {
  return new Promise((resolver) => {
    const fin = setTimeout(() => { d.removeEventListener('inputreport', oir); resolver(null); }, ms);
    function oir(e) {
      const b = new Uint8Array(e.data.buffer);
      if (e.reportId === ID_INFORME && b[0] === grupo) {
        clearTimeout(fin);
        d.removeEventListener('inputreport', oir);
        resolver(b);
      }
    }
    d.addEventListener('inputreport', oir);
  });
}

async function orden(d, ...bytes) {
  await d.sendReport(ID_INFORME, datos(...bytes));
  await new Promise((r) => setTimeout(r, 200));
}

/** Modo museo: sin seguimiento automático, sin gestos y sin privacidad automática. */
export async function modoMuseoHID(d) {
  await orden(d, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00); // seguimiento apagado
  await orden(d, 0x01, 0x01, 0x01);
  await orden(d, 0x04, 0x02, 0x00, 0x00, 0x02, 0x00, 0x02, 0x02, 0x00); // gestos apagados
  await orden(d, 0x04, 0x02, 0x01, 0x00, 0x01, 0x00, 0x01, 0x02);
  await orden(d, 0x02, 0x01, 0x00, 0x00, 0x04, 0x00, 0x04, 0x00); // privacidad automática apagada
  await orden(d, 0x02, 0x01, 0x01);
  return leerSeguimiento(d);
}

/**
 * Pregunta a la cámara si contesta. Devuelve 'privacidad' (lente abajo),
 * 'normal' o null si no responde. Medido con la PIXY real: contesta 03 tanto
 * con el seguimiento encendido como apagado, y 02 en privacidad, así que la
 * respuesta solo sirve para saber que la orden llegó y que la lente está arriba.
 */
export async function leerSeguimiento(d) {
  const espera = esperarRespuesta(d, 0x01);
  await d.sendReport(ID_INFORME, datos(0x01, 0x01, 0x01));
  const b = await espera;
  if (!b) return null;
  // Respuesta sin el identificador: 01 01 01 00 01 00 01 XX
  return b[7] === 0x02 ? 'privacidad' : 'normal';
}
