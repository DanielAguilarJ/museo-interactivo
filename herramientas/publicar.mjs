// Prepara una versión nueva del museo para publicar:
//   - le pone número (fecha y hora),
//   - hace la lista de archivos con su huella (para que cada sede baje solo
//     lo que cambió),
//   - escribe ese número en sw.js, js/version.js y version.json.
// Uso: node herramientas/publicar.mjs [carpeta-web]
// Después basta con subir la carpeta web/ (git push): todas las sedes la
// reciben solas en menos de 15 minutos.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = process.argv[2] || join(fileURLToPath(new URL('..', import.meta.url)), 'web');
const FUERA = new Set(['sw.js', 'version.json', 'precache.json', '.DS_Store', 'CNAME', '.nojekyll']);

function recorrer(carpeta) {
  const lista = [];
  for (const nombre of readdirSync(carpeta)) {
    if (nombre.startsWith('.')) continue;
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) lista.push(...recorrer(ruta));
    else lista.push(ruta);
  }
  return lista;
}

const ahora = new Date();
const dos = (n) => String(n).padStart(2, '0');
const version = `${ahora.getUTCFullYear()}.${dos(ahora.getUTCMonth() + 1)}.${dos(ahora.getUTCDate())}-${dos(ahora.getUTCHours())}${dos(ahora.getUTCMinutes())}`;

// Primero el número dentro de js/version.js (cuenta en la lista de archivos)
writeFileSync(join(WEB, 'js', 'version.js'), `// Lo escribe herramientas/publicar.mjs al publicar una versión nueva.\nexport const VERSION = '${version}';\n`);

const archivos = [];
let bytes = 0;
for (const ruta of recorrer(WEB)) {
  const u = relative(WEB, ruta).split(sep).join('/');
  if (FUERA.has(u) || u.split('/').some((p) => FUERA.has(p))) continue;
  const datos = readFileSync(ruta);
  bytes += datos.length;
  archivos.push({ u, h: createHash('sha256').update(datos).digest('hex').slice(0, 16) });
}
archivos.sort((a, b) => a.u.localeCompare(b.u));

writeFileSync(join(WEB, 'precache.json'), JSON.stringify({ version, archivos }, null, 0) + '\n');
writeFileSync(join(WEB, 'version.json'), JSON.stringify({ version, fecha: ahora.toISOString() }) + '\n');
const sw = readFileSync(join(WEB, 'sw.js'), 'utf8');
const nuevo = sw.replace(/^const VERSION = '[^']*';$/m, `const VERSION = '${version}';`);
if (nuevo === sw && !sw.includes(`const VERSION = '${version}';`)) throw new Error('No encontré la línea VERSION en sw.js');
writeFileSync(join(WEB, 'sw.js'), nuevo);

console.log(`Versión ${version}: ${archivos.length} archivos, ${(bytes / 1e6).toFixed(1)} MB`);
