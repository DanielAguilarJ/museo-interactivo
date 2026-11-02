// Genera web/iconos/icono-192.png e icono-512.png con Chrome sin ventana.
// Necesita el servidor del museo encendido en 127.0.0.1:8777.
// Uso: node herramientas/generar-iconos.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const dibujo = readFileSync(join(raiz, 'herramientas', 'icono.js'), 'utf8').replace(/^\/\/.*$/gm, '').trim();
mkdirSync(join(raiz, 'web', 'iconos'), { recursive: true });
const pasos = [192, 512].map((n) => ({ js: `${dibujo}(${n})`, guardar: join(raiz, 'web', 'iconos', `icono-${n}.png`) }));
const salida = execFileSync('node', [join(raiz, 'pruebas', 'navegador.mjs'), '/?sincamara', join(raiz, 'web', 'iconos', '.captura.png'), '1500'], {
  env: { ...process.env, MUSEO_PASOS: JSON.stringify(pasos) }, encoding: 'utf8', timeout: 60000,
});
console.log(salida.trim());
