// Lista de salas del museo. Para añadir una sala nueva:
//   1. Copia una sala parecida (por ejemplo oceano.js) con otro nombre.
//   2. Cambia su id, titulo, tema, icono, color y descripcion.
//   3. Impórtala aquí y agrégala a la lista. El orden de la lista es el
//      orden de las tarjetas en el vestíbulo (y de las teclas 1 a 9).

import sistemaSolar from './sistema-solar.js';
import oceano from './oceano.js';
import fosiles from './fosiles.js';
import tierra from './tierra.js';
import cuerpo from './cuerpo.js';
import dinosaurios from './dinosaurios.js';
import { RETOS } from './retos-salas.js';

export const SALAS = [sistemaSolar, dinosaurios, oceano, fosiles, tierra, cuerpo]
  .map((s) => ({ ...s, retos: RETOS[s.id] || [] }));
