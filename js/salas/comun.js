// Utilidades compartidas por las salas.

import * as THREE from 'three';

/** Lienzo WebGL a pantalla completa dentro del contenedor de la escena. */
export function crearRender(contenedor, { fondo = 0x000000 } = {}) {
  const render = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  render.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  render.setSize(innerWidth, innerHeight);
  render.setClearColor(fondo, 1);
  render.outputColorSpace = THREE.SRGBColorSpace;
  contenedor.appendChild(render.domElement);
  return render;
}

/** Lienzo 2D a pantalla completa (con nitidez en pantallas retina). */
export function crearLienzo2D(contenedor) {
  const lienzo = document.createElement('canvas');
  lienzo.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  contenedor.appendChild(lienzo);
  const ctx = lienzo.getContext('2d');
  const ajustar = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    lienzo.width = Math.round(innerWidth * dpr);
    lienzo.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  ajustar();
  return { lienzo, ctx, ajustar };
}

/** Posición en píxeles de pantalla de un punto 3D. */
export function aPantalla(v, camara) {
  const p = v.clone().project(camara);
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
}

/** Punto 3D sobre el plano y = altura que queda bajo el píxel (x, y). */
export function enPlano(x, y, camara, altura = 0) {
  const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  const rayo = new THREE.Raycaster();
  rayo.setFromCamera(ndc, camara);
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -altura);
  const punto = new THREE.Vector3();
  return rayo.ray.intersectPlane(plano, punto) ? punto : null;
}

/** Textura hecha con un lienzo 2D (para planetas, arena, etc.). */
export function texturaLienzo(ancho, alto, dibujar) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  dibujar(c.getContext('2d'), ancho, alto);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Libera geometrías, materiales y texturas de una escena. */
export function liberar(objeto) {
  objeto.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
  });
}

/** Número pseudoaleatorio repetible (para que cada sala salga igual de bonita). */
export function azar(semilla = 1) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const minLado = () => Math.min(innerWidth, innerHeight);
