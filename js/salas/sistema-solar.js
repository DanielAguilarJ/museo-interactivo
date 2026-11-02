// Sala «El Sistema Solar»: planetas en 3D girando alrededor del Sol.
// Al poner la mano sobre un planeta, se detiene, crece y aparece su ficha.

import * as THREE from 'three';
import { crearRender, crearLienzo2D, aPantalla, texturaLienzo, liberar, azar, minLado } from './comun.js';
import { PLANETAS, SOL } from './datos-planetas.js';

export default {
  id: 'sistema-solar',
  titulo: 'El Sistema Solar',
  tema: 'Astronomía',
  icono: '🪐',
  color: '#ffb84d',
  descripcion: 'Toca un planeta para detenerlo y conocerlo.',

  crear({ contenedor, fichas, sonido }) {
    const render = crearRender(contenedor, { fondo: 0x02030a });
    const etiquetas = crearLienzo2D(contenedor);
    const escena = new THREE.Scene();
    const camara = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 500);

    // Encuadre: vista inclinada para que las órbitas se vean en 3D. Se aleja
    // la cámara justo lo necesario para que la órbita de Neptuno quepa en la mesa.
    const encuadrar = () => {
      camara.aspect = innerWidth / innerHeight;
      camara.updateProjectionMatrix();
      const radioMax = PLANETAS.at(-1).orbita + PLANETAS.at(-1).radio * 1.2;
      const extremos = [[radioMax, 0], [-radioMax, 0], [0, radioMax], [0, -radioMax]].map(([x, z]) => new THREE.Vector3(x, 0, z));
      // Cuanto más ancha la mesa, más inclinada la vista (órbitas más aplanadas).
      const angulo = Math.asin(THREE.MathUtils.clamp(0.95 / camara.aspect, 0.42, 0.86));
      const cabe = (dist) => {
        camara.position.set(0, Math.sin(angulo) * dist, Math.cos(angulo) * dist);
        camara.lookAt(0, 0, 0);
        camara.updateMatrixWorld();
        return extremos.every((p) => { const q = p.clone().project(camara); return Math.abs(q.x) < 0.94 && Math.abs(q.y) < 0.9; });
      };
      let cerca = 10, lejos = 400;
      for (let i = 0; i < 30; i++) { const m = (cerca + lejos) / 2; if (cabe(m)) lejos = m; else cerca = m; }
      cabe(lejos);
      render.setSize(innerWidth, innerHeight);
      etiquetas.ajustar();
    };
    encuadrar();

    // Estrellas de fondo
    const r = azar(7);
    const estrellasGeo = new THREE.BufferGeometry();
    const pos = [];
    for (let i = 0; i < 2200; i++) {
      const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1), R = 150;
      pos.push(R * Math.sin(v) * Math.cos(u), R * Math.cos(v) * 0.6 - 40, R * Math.sin(v) * Math.sin(u));
    }
    estrellasGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const estrellas = new THREE.Points(estrellasGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
    escena.add(estrellas);

    // Sol
    const texSol = texturaLienzo(512, 256, (c, w, h) => {
      c.fillStyle = '#ffb02e'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        c.fillStyle = `rgba(${255},${120 + r() * 120 | 0},${20 + r() * 40 | 0},${0.25 + r() * 0.3})`;
        c.beginPath(); c.arc(r() * w, r() * h, 2 + r() * 9, 0, Math.PI * 2); c.fill();
      }
    });
    const sol = new THREE.Mesh(new THREE.SphereGeometry(SOL.radio, 48, 32), new THREE.MeshBasicMaterial({ map: texSol }));
    escena.add(sol);
    const brilloTex = texturaLienzo(256, 256, (c, w) => {
      const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,220,140,1)'); g.addColorStop(0.25, 'rgba(255,160,40,0.55)'); g.addColorStop(1, 'rgba(255,120,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, w);
    });
    const brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    brillo.scale.setScalar(SOL.radio * 4.2);
    escena.add(brillo);
    escena.add(new THREE.PointLight(0xfff1d6, 3.2, 0, 0));
    // Un proyector no muestra bien lo muy oscuro: la cara de noche se ve tenue, no negra.
    escena.add(new THREE.AmbientLight(0x5a6688, 0.9));

    // Planetas
    const planetas = PLANETAS.map((p, i) => {
      const grupo = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ map: texturaLienzo(512, 256, p.pintar), roughness: 0.85, metalness: 0 });
      const malla = new THREE.Mesh(new THREE.SphereGeometry(p.radio, 40, 28), mat);
      malla.rotation.z = THREE.MathUtils.degToRad(p.inclinacion || 0);
      grupo.add(malla);
      if (p.anillos) {
        const anillo = new THREE.Mesh(
          new THREE.RingGeometry(p.radio * 1.35, p.radio * 2.3, 96),
          new THREE.MeshBasicMaterial({ map: texturaLienzo(512, 8, p.anillos), side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
        );
        fijarUVAnillo(anillo.geometry, p.radio * 1.35, p.radio * 2.3);
        anillo.rotation.x = -Math.PI / 2 - 0.5;
        grupo.add(anillo);
      }
      let luna = null;
      if (p.luna) {
        luna = new THREE.Mesh(new THREE.SphereGeometry(p.radio * 0.27, 20, 14), new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 1 }));
        grupo.add(luna);
      }
      const orbita = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, k) => {
          const a = (k / 160) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a) * p.orbita, 0, Math.sin(a) * p.orbita);
        })),
        new THREE.LineBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.16 }),
      );
      escena.add(orbita, grupo);
      return { ...p, grupo, malla, luna, orbitaLinea: orbita, angulo: i * 1.7 + 0.4, escala: 1, sostenido: 0, avisado: false };
    });

    // Cinturón de asteroides entre Marte y Júpiter
    const cinturon = new THREE.Points(
      (() => {
        const g = new THREE.BufferGeometry();
        const ps = [];
        const r1 = PLANETAS[3].orbita + 0.9, r2 = PLANETAS[4].orbita - 1.6;
        for (let i = 0; i < 900; i++) {
          const a = r() * Math.PI * 2, d = r1 + r() * (r2 - r1);
          ps.push(Math.cos(a) * d, (r() - 0.5) * 0.3, Math.sin(a) * d);
        }
        g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
        return g;
      })(),
      new THREE.PointsMaterial({ color: 0xb8a58c, size: 2, sizeAttenuation: false }),
    );
    escena.add(cinturon);

    const v = new THREE.Vector3();
    let tiempo = 0;
    let solTocado = 0;

    function radioEnPantalla(centro, radio) {
      const d = camara.position.distanceTo(centro);
      return (radio / (2 * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) * d)) * innerHeight;
    }

    return {
      actualizar(dt, manos) {
        tiempo += dt;
        const holgura = minLado() * 0.035;
        sol.rotation.y += dt * 0.05;
        brillo.scale.setScalar(SOL.radio * (4.1 + Math.sin(tiempo * 1.7) * 0.15));
        cinturon.rotation.y += dt * 0.01;

        // Sol tocado
        const centroSol = aPantalla(v.set(0, 0, 0), camara);
        const rSol = radioEnPantalla(v, SOL.radio) + holgura;
        const manoSol = manos.find((m) => Math.hypot(m.x - centroSol.x, m.y - centroSol.y) < rSol);
        if (manoSol) {
          if (solTocado === 0) sonido.ficha();
          solTocado += dt;
          fichas.mostrar('sol', SOL.ficha, centroSol.x, centroSol.y, rSol);
        } else solTocado = 0;

        for (const p of planetas) {
          p.grupo.getWorldPosition(v);
          const c = aPantalla(v, camara);
          const rp = radioEnPantalla(v, p.radio * p.escala) + holgura;
          const encima = manos.some((m) => Math.hypot(m.x - c.x, m.y - c.y) < rp);
          if (encima) {
            if (p.sostenido === 0) sonido.tocar();
            p.sostenido += dt;
          } else {
            p.sostenido = 0;
            p.avisado = false;
          }
          if (!encima) p.angulo += dt * p.velocidad;
          p.escala += ((encima ? 1.7 : 1) - p.escala) * Math.min(1, dt * 6);
          p.grupo.position.set(Math.cos(p.angulo) * p.orbita, 0, Math.sin(p.angulo) * p.orbita);
          p.grupo.scale.setScalar(p.escala);
          p.malla.rotation.y += dt * p.giro;
          if (p.luna) {
            const a = tiempo * 1.4;
            p.luna.position.set(Math.cos(a) * p.radio * 1.9, 0, Math.sin(a) * p.radio * 1.9);
          }
          p.orbitaLinea.material.opacity = encima ? 0.45 : 0.16;
          if (p.sostenido > 0.35) {
            if (!p.avisado) { p.avisado = true; sonido.ficha(); }
            fichas.mostrar(p.id, p.ficha, c.x, c.y, rp);
          }
        }

        render.render(escena, camara);

        // Nombres de los planetas
        const ctx = etiquetas.ctx;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(minLado() * 0.022)}px "Avenir Next", sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 6;
        // Si dos nombres se enciman, el segundo va arriba del planeta; si
        // tampoco cabe, se omite ese instante (los planetas se separan solos).
        const ocupados = [];
        const tamLetra = minLado() * 0.022;
        const choca = (a) => ocupados.some((b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1);
        const orden = [...planetas].sort((a, b) => b.sostenido - a.sostenido);
        for (const p of orden) {
          p.grupo.getWorldPosition(v);
          const c = aPantalla(v, camara);
          const rp = radioEnPantalla(v, p.radio * p.escala);
          const ancho = ctx.measureText(p.ficha.titulo).width;
          for (const y of [c.y + rp + tamLetra * 1.3, c.y - rp - tamLetra * 0.5]) {
            const caja = { x1: c.x - ancho / 2, x2: c.x + ancho / 2, y1: y - tamLetra, y2: y + tamLetra * 0.3 };
            if (choca(caja)) continue;
            ocupados.push(caja);
            ctx.fillStyle = p.sostenido > 0 ? '#ffc861' : 'rgba(244,239,228,0.85)';
            ctx.fillText(p.ficha.titulo, c.x, y);
            break;
          }
        }
        ctx.shadowBlur = 0;
      },
      redimensionar: encuadrar,
      // Para las pruebas automáticas: dónde está cada planeta en la pantalla (0..1)
      posiciones() {
        return Object.fromEntries(planetas.map((p) => {
          p.grupo.getWorldPosition(v);
          const c = aPantalla(v, camara);
          return [p.id, { x: c.x / innerWidth, y: c.y / innerHeight }];
        }));
      },
      destruir() {
        liberar(escena);
        render.dispose();
      },
    };
  },
};

// Hace que la textura del anillo vaya del borde interior al exterior.
function fijarUVAnillo(geo, rIn, rOut) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const d = Math.hypot(p.getX(i), p.getY(i));
    uv.setXY(i, (d - rIn) / (rOut - rIn), 0.5);
  }
  uv.needsUpdate = true;
}
