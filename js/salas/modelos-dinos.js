// Dinosaurios 3D estilo «juguete de museo», hechos con piezas simples.
// Cada uno mira hacia +x. Devuelve el grupo y las piezas que se animan.

import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra });

function esfera(radio, material, [sx, sy, sz] = [1, 1, 1]) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(radio, 2), material);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

function cono(radio, alto, material) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(radio, alto, 8), material);
  m.castShadow = true;
  return m;
}

/**
 * Cuerpo genérico. p = {
 *   piel, panza, cuerpo:[largo, alto, ancho], altura (de la cadera),
 *   bipedo, pataTrasera:[largo, grosor], pataDelantera:[largo, grosor],
 *   cuello:{n, largo, r0, r1, sube}, cola:{n, largo, r0, r1}, cabeza:[largo, alto, ancho]
 * }
 */
function construir(p) {
  const g = new THREE.Group();
  const piel = mat(p.piel), panza = mat(p.panza || p.piel);
  const [cl, ca, cw] = p.cuerpo;
  const cuerpo = esfera(1, piel, [cl / 2, ca / 2, cw / 2]);
  cuerpo.position.y = p.altura;
  if (p.bipedo) cuerpo.rotation.z = 0.18;
  g.add(cuerpo);
  const vientre = esfera(1, panza, [cl * 0.42, ca * 0.36, cw * 0.44]);
  vientre.position.set(0, p.altura - ca * 0.14, 0);
  g.add(vientre);

  // Patas: un pivote en la cadera y la pata colgando hasta el suelo
  const patas = [];
  const pata = (x, z, [largo, grosor], fase) => {
    const pivote = new THREE.Group();
    pivote.position.set(x, p.altura - ca * 0.15, z);
    const muslo = new THREE.Mesh(new THREE.CylinderGeometry(grosor, grosor * 0.75, largo, 7), piel);
    muslo.position.y = -largo / 2;
    muslo.castShadow = true;
    const pie = esfera(grosor * 1.1, panza, [1.4, 0.5, 1]);
    pie.position.set(grosor * 0.4, -largo, 0);
    pivote.add(muslo, pie);
    g.add(pivote);
    patas.push({ pivote, fase });
  };
  const largoTrasera = p.altura - ca * 0.15;
  pata(-cl * 0.22, cw * 0.32, [largoTrasera, p.pataTrasera[1]], 0);
  pata(-cl * 0.22, -cw * 0.32, [largoTrasera, p.pataTrasera[1]], Math.PI);
  if (!p.bipedo) {
    pata(cl * 0.28, cw * 0.3, [largoTrasera * (p.pataDelantera?.[0] ?? 1), p.pataDelantera?.[1] ?? p.pataTrasera[1]], Math.PI);
    pata(cl * 0.28, -cw * 0.3, [largoTrasera * (p.pataDelantera?.[0] ?? 1), p.pataDelantera?.[1] ?? p.pataTrasera[1]], 0);
  }

  // Cadenas de esferas para cuello y cola (se mueven como una ola)
  const cadena = ({ n: minimo, largo, r0, r1 }, inicio, direccion, sube) => {
    // Esferas bien encimadas para que se lea como un tubo y no como un collar
    const n = Math.max(minimo, Math.ceil(largo / (((r0 + r1) / 2) * 0.7)));
    const piezas = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / n;
      const s = esfera(r0 + (r1 - r0) * t, piel);
      g.add(s);
      piezas.push({ m: s, t, base: new THREE.Vector3(inicio.x + direccion * largo * t, inicio.y + sube * largo * t * (direccion > 0 ? t : 1), 0) });
    }
    return piezas;
  };
  const cola = cadena(p.cola, { x: -cl * 0.42, y: p.altura + ca * 0.05 }, -1, p.cola.baja ?? -0.12);
  const cuello = p.cuello ? cadena(p.cuello, { x: cl * 0.4, y: p.altura + ca * 0.15 }, 1, p.cuello.sube) : [];

  // Cabeza
  const cabeza = new THREE.Group();
  const finCuello = cuello.length ? cuello.at(-1).base : new THREE.Vector3(cl * 0.5, p.altura + ca * 0.3, 0);
  cabeza.position.copy(finCuello).add(new THREE.Vector3(p.cabeza[0] * 0.35, 0, 0));
  const craneo = esfera(1, piel, [p.cabeza[0] / 2, p.cabeza[1] / 2, p.cabeza[2] / 2]);
  cabeza.add(craneo);
  const ojoMat = mat(0x111111, { roughness: 0.3 });
  for (const l of [-1, 1]) {
    const blanco = esfera(p.cabeza[1] * 0.16, mat(0xffffff));
    blanco.position.set(p.cabeza[0] * 0.12, p.cabeza[1] * 0.2, l * p.cabeza[2] * 0.42);
    const ojo = esfera(p.cabeza[1] * 0.09, ojoMat);
    ojo.position.copy(blanco.position).add(new THREE.Vector3(0.02, 0, l * p.cabeza[1] * 0.08));
    cabeza.add(blanco, ojo);
  }
  const mandibula = esfera(1, panza, [p.cabeza[0] * 0.42, p.cabeza[1] * 0.18, p.cabeza[2] * 0.38]);
  mandibula.position.set(p.cabeza[0] * 0.08, -p.cabeza[1] * 0.32, 0);
  cabeza.add(mandibula);
  g.add(cabeza);

  return { grupo: g, patas, cola, cuello, cabeza, mandibula, piel, cuerpo, alto: p.altura + ca };
}

export const ESPECIES = {
  trex: {
    nombre: 'T. rex', escala: 1.3, velocidad: 2.2, carnivoro: true, cantidad: 1, color: '#c0563a',
    crear() {
      const d = construir({ piel: 0x6b7f3a, panza: 0xc7b27a, cuerpo: [4.2, 2.2, 1.9], altura: 2.6, bipedo: true, pataTrasera: [0, 0.42], cola: { n: 7, largo: 4.2, r0: 0.8, r1: 0.15, baja: 0.05 }, cabeza: [2.1, 1.25, 1.1] });
      d.cabeza.position.set(2.75, 3.75, 0);
      const cuello = esfera(1, d.piel, [0.85, 0.75, 0.62]); // une la cabeza con el cuerpo
      cuello.position.set(2.0, 3.35, 0);
      d.grupo.add(cuello);
      for (const l of [-1, 1]) { // bracitos
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.7, 5), d.piel);
        b.position.set(1.7, 3.1, l * 0.55); b.rotation.z = 0.9; b.castShadow = true;
        d.grupo.add(b);
      }
      const dientes = mat(0xfffbe8);
      for (let k = 0; k < 6; k++) { const t = cono(0.06, 0.22, dientes); t.rotation.x = Math.PI; t.position.set(0.15 + k * 0.13, -0.32, 0.45 * (k % 2 ? 1 : -1)); d.cabeza.add(t); }
      return d;
    },
    ficha: { tema: 'Carnívoro · Cretácico', titulo: 'Tyrannosaurus rex', texto: ['Medía unos 12 metros de largo, como un autobús.', 'Sus dientes eran del tamaño de un plátano.'], dato: 'Vivió hace unos 68 a 66 millones de años, en lo que hoy es Norteamérica.' },
  },
  triceratops: {
    nombre: 'Triceratops', escala: 1.1, velocidad: 1.4, cantidad: 1, color: '#d98b3a',
    crear() {
      const d = construir({ piel: 0xb5793e, panza: 0xe0c08a, cuerpo: [4, 2.2, 2.3], altura: 1.9, pataTrasera: [0, 0.4], pataDelantera: [0.9, 0.38], cuello: { n: 1, largo: 0.7, r0: 0.8, r1: 0.7, sube: 0.1 }, cola: { n: 5, largo: 2.2, r0: 0.6, r1: 0.12 }, cabeza: [1.8, 1.2, 1.2] });
      const gola = new THREE.Mesh(new THREE.CircleGeometry(1.5, 12), mat(0xd9a05b, { side: THREE.DoubleSide }));
      gola.rotation.y = Math.PI / 2; gola.position.set(-0.4, 0.5, 0); gola.castShadow = true;
      d.cabeza.add(gola);
      const cuerno = mat(0xf3ead2);
      for (const [x, y, z, l] of [[0.25, 0.55, 0.35, 1], [0.25, 0.55, -0.35, 1], [0.95, 0.15, 0, 0.45]]) {
        const c = cono(0.13, l, cuerno); c.position.set(x, y, z); c.rotation.z = -1.1; d.cabeza.add(c);
      }
      return d;
    },
    ficha: { tema: 'Herbívoro · Cretácico', titulo: 'Triceratops', texto: ['Tenía tres cuernos y un gran escudo de hueso en la cabeza.', 'Comía plantas con su pico, como el de un loro.'], dato: 'Vivió al mismo tiempo que el T. rex.' },
  },
  coahuila: {
    nombre: 'Coahuilaceratops', escala: 1, velocidad: 1.3, cantidad: 1, color: '#8fbf5a',
    crear() {
      const d = construir({ piel: 0x6d8f4e, panza: 0xd5c79a, cuerpo: [3.8, 2.1, 2.2], altura: 1.8, pataTrasera: [0, 0.38], pataDelantera: [0.9, 0.36], cuello: { n: 1, largo: 0.7, r0: 0.75, r1: 0.65, sube: 0.1 }, cola: { n: 5, largo: 2.1, r0: 0.55, r1: 0.12 }, cabeza: [1.7, 1.1, 1.1] });
      const gola = new THREE.Mesh(new THREE.CircleGeometry(1.3, 10), mat(0xc7563a, { side: THREE.DoubleSide }));
      gola.rotation.y = Math.PI / 2; gola.position.set(-0.4, 0.5, 0); gola.castShadow = true;
      d.cabeza.add(gola);
      const cuerno = mat(0xf3ead2);
      for (const z of [0.35, -0.35]) { const c = cono(0.16, 1.5, cuerno); c.position.set(0.35, 0.75, z); c.rotation.z = -0.9; d.cabeza.add(c); }
      return d;
    },
    ficha: { tema: 'Herbívoro · ¡De México!', titulo: 'Coahuilaceratops', texto: ['Vivió en lo que hoy es Coahuila, México, hace unos 72 millones de años.', 'Era pariente del triceratops y tenía cuernos enormes sobre los ojos.'], dato: 'Su nombre quiere decir «cara con cuernos de Coahuila».' },
  },
  braquio: {
    nombre: 'Braquiosaurio', escala: 1.45, velocidad: 0.9, cantidad: 1, color: '#7fa8c9',
    crear() {
      return construir({ piel: 0x7c8f9e, panza: 0xb9c3c9, cuerpo: [4.6, 2.6, 2.4], altura: 3.2, pataTrasera: [0, 0.5], pataDelantera: [1.15, 0.5], cuello: { n: 9, largo: 5, r0: 0.75, r1: 0.35, sube: 0.7 }, cola: { n: 8, largo: 4.6, r0: 0.7, r1: 0.1 }, cabeza: [1, 0.6, 0.6] });
    },
    ficha: { tema: 'Herbívoro · Jurásico', titulo: 'Braquiosaurio', texto: ['Su cuello largo le servía para comer las hojas de los árboles más altos.', 'Era tan alto como un edificio de tres pisos.'], dato: 'El T. rex vivió más cerca de nuestro tiempo que del tiempo del braquiosaurio.' },
  },
  estego: {
    nombre: 'Estegosaurio', escala: 1, velocidad: 1.1, cantidad: 1, color: '#c9a04a',
    crear() {
      const d = construir({ piel: 0x8a7a3e, panza: 0xd9c48a, cuerpo: [4, 2.3, 2], altura: 2, pataTrasera: [0, 0.42], pataDelantera: [0.7, 0.32], cuello: { n: 2, largo: 1.2, r0: 0.5, r1: 0.35, sube: -0.2 }, cola: { n: 6, largo: 3.2, r0: 0.6, r1: 0.12 }, cabeza: [0.9, 0.5, 0.5] });
      const placa = mat(0xc4562e);
      for (let k = 0; k < 7; k++) {
        const x = -1.6 + k * 0.55, alto = 0.8 + Math.sin((k / 6) * Math.PI) * 0.7;
        const pl = new THREE.Mesh(new THREE.ConeGeometry(0.45, alto, 3), placa);
        pl.scale.z = 0.25; pl.position.set(x, 2 + 1.05 + alto * 0.4, k % 2 ? 0.12 : -0.12); pl.castShadow = true;
        d.grupo.add(pl);
      }
      const punta = d.cola.at(-1).m;
      for (const [y, z] of [[0.2, 0.25], [0.2, -0.25], [0.3, 0.12], [0.3, -0.12]]) {
        const p = cono(0.06, 0.7, mat(0xf3ead2)); p.position.set(0, y, z); p.rotation.x = z > 0 ? -0.9 : 0.9; punta.add(p);
      }
      return d;
    },
    ficha: { tema: 'Herbívoro · Jurásico', titulo: 'Estegosaurio', texto: ['Tenía placas en la espalda y púas en la cola.', 'Su cerebro era muy pequeño para lo grande que era.'], dato: 'Con las púas de su cola se defendía de los carnívoros.' },
  },
  raptor: {
    nombre: 'Velociraptor', escala: 0.55, velocidad: 4.5, carnivoro: true, cantidad: 2, color: '#d9643a',
    crear() {
      const d = construir({ piel: 0x9a5a34, panza: 0xe8c9a0, cuerpo: [2.4, 1.1, 0.9], altura: 1.6, bipedo: true, pataTrasera: [0, 0.18], cola: { n: 7, largo: 2.8, r0: 0.35, r1: 0.06, baja: 0.08 }, cabeza: [1.1, 0.5, 0.45] });
      d.cabeza.position.set(1.55, 2.05, 0);
      const cuello = esfera(1, d.piel, [0.45, 0.35, 0.3]);
      cuello.position.set(1.1, 1.9, 0);
      d.grupo.add(cuello);
      const plumas = mat(0x3d6ea8);
      for (let k = 0; k < 5; k++) { const p = cono(0.12, 0.6, plumas); p.position.set(-0.5 + k * 0.25, 2.15, 0); p.rotation.z = 1.2; d.grupo.add(p); }
      return d;
    },
    ficha: { tema: 'Carnívoro · Cretácico', titulo: 'Velociraptor', texto: ['Era del tamaño de un pavo y tenía plumas.', 'Tenía una garra curva en cada pata para atrapar a sus presas.'], dato: 'Era mucho más pequeño que en las películas.' },
  },
};

/** Pterosaurio volando: cuerpo, cabeza con cresta y dos alas que aletean. */
export function crearPteranodon() {
  const g = new THREE.Group();
  const piel = mat(0xb08a6a);
  const cuerpo = esfera(0.45, piel, [2.2, 0.8, 0.8]);
  g.add(cuerpo);
  const cabeza = cono(0.22, 1.6, piel); cabeza.rotation.z = -Math.PI / 2; cabeza.position.x = 1.5; g.add(cabeza);
  const cresta = cono(0.12, 0.9, mat(0xc0563a)); cresta.rotation.z = 2.3; cresta.position.set(0.9, 0.35, 0); g.add(cresta);
  const alaGeo = new THREE.BufferGeometry();
  alaGeo.setAttribute('position', new THREE.Float32BufferAttribute([0.6, 0, 0, -0.6, 0, 0, -0.2, 0, 3.6], 3));
  alaGeo.computeVertexNormals();
  const alaMat = mat(0xd7b08c, { side: THREE.DoubleSide });
  const alas = [1, -1].map((l) => {
    const pivote = new THREE.Group();
    const ala = new THREE.Mesh(alaGeo, alaMat);
    ala.scale.z = l; ala.castShadow = true;
    pivote.add(ala);
    g.add(pivote);
    return pivote;
  });
  return { grupo: g, alas };
}

/** Árboles y plantas de la época (coníferas, cícadas y helechos). */
export function crearPlanta(tipo, azar) {
  const g = new THREE.Group();
  if (tipo === 'conifera') {
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3, 6), mat(0x6b4a2f));
    tronco.position.y = 1.5; tronco.castShadow = true; g.add(tronco);
    for (let k = 0; k < 3; k++) {
      const c = cono(2.4 - k * 0.6, 3, mat(k % 2 ? 0x2f6b3a : 0x3c7d44));
      c.position.y = 3.2 + k * 1.5; g.add(c);
    }
  } else if (tipo === 'cicada') {
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.6, 6), mat(0x7a5a3a));
    tronco.position.y = 0.8; tronco.castShadow = true; g.add(tronco);
    for (let k = 0; k < 8; k++) {
      const hoja = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 3), mat(0x5b9a3a));
      hoja.scale.z = 0.3;
      hoja.position.set(Math.cos(k * 0.785) * 1.1, 2, Math.sin(k * 0.785) * 1.1);
      hoja.rotation.set(Math.sin(k * 0.785) * 1.1, 0, -Math.cos(k * 0.785) * 1.1);
      hoja.castShadow = true;
      g.add(hoja);
    }
  } else {
    for (let k = 0; k < 5; k++) {
      const h = cono(0.3, 1.4, mat(0x4f8f3a));
      h.position.set((azar() - 0.5) * 0.8, 0.5, (azar() - 0.5) * 0.8);
      h.rotation.set((azar() - 0.5) * 0.8, 0, (azar() - 0.5) * 0.8);
      g.add(h);
    }
  }
  return g;
}
