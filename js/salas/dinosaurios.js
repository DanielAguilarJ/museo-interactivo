// Sala «El valle de los dinosaurios» (3D): dinosaurios que caminan por un
// valle, dejan huellas y reaccionan a las manos. Al tocar uno se detiene,
// ruge o mira, y sale su ficha. Si mueves la mano rápido, los herbívoros
// huyen. Dejando la mano en el meteorito cae el de Chicxulub (Yucatán).

import * as THREE from 'three';
import { crearRender, crearLienzo2D, aPantalla, enPlano, texturaLienzo, liberar, azar, minLado } from './comun.js';
import { ESPECIES, crearPteranodon, crearPlanta } from './modelos-dinos.js';
import { Permanencia } from '../entrada.js';

const PTERANODON = { tema: 'Reptil volador', titulo: 'Pteranodon', color: '#d7b08c', texto: ['No era un dinosaurio: era un pterosaurio, un reptil volador.', 'Sus alas podían medir más de 5 metros de punta a punta.'], dato: 'Atrapaba peces en el mar con su pico largo.' };
const CHICXULUB = { tema: 'México · hace 66 millones de años', titulo: 'El meteorito de Chicxulub', color: '#ff8a4d', texto: ['Un asteroide de unos 10 km cayó en lo que hoy es Yucatán, México.', 'Cambió el clima de todo el planeta y desaparecieron los dinosaurios gigantes.'], dato: 'Las aves de hoy son descendientes de los dinosaurios.' };

export default {
  id: 'dinosaurios',
  titulo: 'El valle de los dinosaurios',
  tema: 'Prehistoria',
  icono: '🦖',
  color: '#8fbf5a',
  descripcion: 'Toca un dinosaurio para conocerlo. ¡Cuidado con el T. rex!',

  crear({ contenedor, fichas, sonido, entrada }) {
    const render = crearRender(contenedor, { fondo: 0x8fb7c9 });
    render.shadowMap.enabled = true;
    render.shadowMap.type = THREE.PCFShadowMap;
    const etiquetas = crearLienzo2D(contenedor);
    const escena = new THREE.Scene();
    escena.fog = new THREE.Fog(0x9cc0cf, 60, 120);
    const camara = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 300);
    const encuadrar = () => {
      camara.aspect = innerWidth / innerHeight;
      camara.position.set(0, 36, 25);
      camara.lookAt(0, 0, 1);
      camara.updateProjectionMatrix();
      camara.updateMatrixWorld(); // para proyectar puntos antes del primer render
      render.setSize(innerWidth, innerHeight);
      etiquetas.ajustar();
    };
    encuadrar();
    const r = azar(66);

    // Luz de sol con sombras
    const sol = new THREE.DirectionalLight(0xfff1d8, 2.4);
    sol.position.set(-20, 40, 15);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -45, right: 45, top: 35, bottom: -35, near: 1, far: 120 });
    escena.add(sol, new THREE.HemisphereLight(0xcfe8ff, 0x5a4a2a, 1.1));

    // Suelo: pasto, tierra y un río
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(140, 100), new THREE.MeshStandardMaterial({
      roughness: 1,
      map: texturaLienzo(1024, 730, (c, w, h) => {
        c.fillStyle = '#7c9a4a'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 380; i++) {
          c.fillStyle = r() > 0.5 ? 'rgba(160, 130, 80, 0.14)' : 'rgba(70, 110, 50, 0.16)';
          c.beginPath(); c.ellipse(r() * w, r() * h, 6 + r() * 40, 4 + r() * 22, r() * 3, 0, Math.PI * 2); c.fill();
        }
        c.strokeStyle = '#4f8fb0'; c.lineWidth = 34; c.lineCap = 'round';
        c.beginPath(); c.moveTo(w * 0.62, 0); c.bezierCurveTo(w * 0.5, h * 0.35, w * 0.85, h * 0.55, w * 0.7, h);
        c.stroke();
        c.strokeStyle = 'rgba(190, 230, 255, 0.5)'; c.lineWidth = 8; c.stroke();
      }),
    }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    escena.add(suelo);

    // Plantas alrededor: no tapan el centro, ni el meteorito, ni el botón «Salas».
    // Las de la orilla cercana a la cámara se ven más grandes, así que van más chicas.
    const libre = (px, py) => !(Math.hypot(px - 0.9, py - 0.82) < 0.16 || Math.hypot(px - 0.06, py - 0.9) < 0.14);
    let puestas = 0;
    for (let intento = 0; intento < 300 && puestas < 24; intento++) {
      const x = (r() - 0.5) * 70, z = (r() - 0.5) * 42;
      if (Math.abs(x) < 20 && Math.abs(z) < 11) continue;
      const q = new THREE.Vector3(x, 2, z).project(camara);
      const px = (q.x + 1) / 2, py = (1 - q.y) / 2;
      if (px < -0.05 || px > 1.05 || py < -0.05 || py > 1.05 || !libre(px, py)) continue;
      const p = crearPlanta(['conifera', 'cicada', 'helecho'][puestas % 3], r);
      p.position.set(x, 0, z);
      p.scale.setScalar((0.55 + r() * 0.4) * (z > 8 ? 0.7 : 1));
      p.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      escena.add(p);
      puestas++;
    }

    // Dinosaurios
    const dinos = [];
    for (const [id, esp] of Object.entries(ESPECIES)) {
      for (let k = 0; k < esp.cantidad; k++) {
        const d = esp.crear();
        d.grupo.scale.setScalar(esp.escala);
        d.grupo.position.set((r() - 0.5) * 34, 0, (r() - 0.5) * 18);
        escena.add(d.grupo);
        dinos.push({ id, esp, ...d, ang: r() * Math.PI * 2, giro: 0, fase: r() * 6, vel: esp.velocidad, susto: 0, tocado: 0, avisado: false, rugido: 0, ultimoPaso: 0 });
      }
    }

    // Pteranodon dando vueltas en el cielo
    const ptera = crearPteranodon();
    ptera.grupo.scale.setScalar(1.2);
    ptera.grupo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    escena.add(ptera.grupo);

    // Huellas (se borran poco a poco)
    const huellaMat = new THREE.MeshBasicMaterial({ color: 0x3a2a18, transparent: true, opacity: 0.45, depthWrite: false });
    const huellaGeo = new THREE.CircleGeometry(0.22, 7);
    const huellas = [];

    // Meteorito para tocar
    const roca = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: 0x5a4a44, emissive: 0x6a1a00, flatShading: true }));
    roca.castShadow = true;
    escena.add(roca);
    const anillo = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.3, 32), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.8 }));
    anillo.rotation.x = -Math.PI / 2;
    escena.add(anillo);
    const colocarRoca = () => {
      const p = enPlano(innerWidth * 0.9, innerHeight * 0.82, camara) || new THREE.Vector3(26, 0, 14);
      roca.position.set(p.x, 1.2, p.z); anillo.position.set(p.x, 0.05, p.z);
    };
    colocarRoca();
    const meteoro = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    meteoro.visible = false;
    escena.add(meteoro);
    const destello = document.createElement('div');
    destello.style.cssText = 'position:absolute;inset:0;background:#fff3d6;opacity:0;pointer-events:none;transition:opacity .5s';
    contenedor.appendChild(destello);
    const permanencia = new Permanencia(1.2);
    let impacto = null; // { t } mientras dura el evento

    const v = new THREE.Vector3();
    const manosPrevias = new Map();
    let tiempo = 0;

    function radioPantalla(d) {
      d.grupo.getWorldPosition(v);
      const c = aPantalla(v.clone().setY(d.alto * d.esp.escala * 0.5), camara);
      const borde = aPantalla(v.clone().setY(d.alto * d.esp.escala * 0.5).add(new THREE.Vector3(3 * d.esp.escala, 0, 0)), camara);
      return { c, r: Math.max(minLado() * 0.04, Math.hypot(borde.x - c.x, borde.y - c.y)) };
    }

    return {
      actualizar(dt, manos) {
        tiempo += dt;
        const L = minLado();
        // Velocidad de las manos (rápida = asusta)
        const rapidas = [];
        for (const m of manos) {
          const prev = manosPrevias.get(m.id);
          const vel = prev ? Math.hypot(m.x - prev.x, m.y - prev.y) / Math.max(dt, 1e-3) : 0;
          manosPrevias.set(m.id, { x: m.x, y: m.y });
          if (vel > L * 0.8) { const p = enPlano(m.x, m.y, camara); if (p) rapidas.push(p); }
        }

        // Meteorito: dejar la mano encima
        const rp = aPantalla(roca.position, camara);
        if (!impacto && permanencia.actualizar(manos, [{ id: 'meteoro', contiene: (x, y) => Math.hypot(x - rp.x, y - rp.y) < L * 0.07 }], dt, entrada)) {
          impacto = { t: 0 };
          meteoro.visible = true;
          sonido.retumbar();
        }
        anillo.material.opacity = 0.5 + Math.sin(tiempo * 4) * 0.3;
        roca.rotation.y += dt * 0.5;
        if (impacto) {
          impacto.t += dt;
          const u = Math.min(1, impacto.t / 1.3);
          meteoro.position.set(-40 + u * 30, 60 * (1 - u) + 1, -30 + u * 12);
          if (u >= 1 && !impacto.choco) {
            impacto.choco = true; meteoro.visible = false; destello.style.opacity = '0.85'; sonido.retumbar(); sonido.rugido();
            setTimeout(() => { destello.style.opacity = '0'; }, 250);
            for (const d of dinos) d.susto = 5;
          }
          if (impacto.choco) {
            fichas.mostrar('chicxulub', CHICXULUB, rp.x, rp.y, L * 0.06);
            const temblor = Math.max(0, 1.6 - (impacto.t - 1.3)) * 0.5;
            camara.position.x = (Math.random() - 0.5) * temblor;
          }
          if (impacto.t > 9) { impacto = null; camara.position.x = 0; permanencia.reiniciar(); }
        }

        // Dinosaurios
        const trex = dinos.find((d) => d.id === 'trex');
        for (const d of dinos) {
          const pos = d.grupo.position;
          const { c, r: rad } = radioPantalla(d);
          const tocandolo = !impacto && manos.some((m) => Math.hypot(m.x - c.x, m.y - c.y) < rad);
          let deseado = null;
          if (!d.esp.carnivoro) {
            for (const p of rapidas) if (Math.hypot(p.x - pos.x, p.z - pos.z) < 10) { deseado = Math.atan2(pos.z - p.z, pos.x - p.x); d.susto = Math.max(d.susto, 2); }
            if (trex && trex !== d && pos.distanceTo(trex.grupo.position) < 9) { deseado = Math.atan2(pos.z - trex.grupo.position.z, pos.x - trex.grupo.position.x); d.susto = Math.max(d.susto, 1); }
          }
          // No amontonarse: si otro está muy cerca, se aparta
          if (deseado === null) {
            const cerca = dinos.find((o) => o !== d && pos.distanceTo(o.grupo.position) < 4.5 * (d.esp.escala + o.esp.escala) / 2);
            if (cerca) deseado = Math.atan2(pos.z - cerca.grupo.position.z, pos.x - cerca.grupo.position.x);
          }
          // No salirse de la mesa
          const q = pos.clone().project(camara);
          if (Math.abs(q.x) > 0.8 || Math.abs(q.y) > 0.75) deseado = Math.atan2(-pos.z, -pos.x);
          d.giro += (r() - 0.5) * dt * 1.5;
          d.giro = Math.max(-0.5, Math.min(0.5, d.giro * 0.99));
          if (deseado !== null) d.ang += angulo(d.ang, deseado) * Math.min(1, dt * 2.5);
          else d.ang += d.giro * dt;
          d.susto = Math.max(0, d.susto - dt);
          const corre = d.susto > 0 ? 2.2 : 1;
          const velocidad = tocandolo ? 0 : d.vel * corre;
          pos.x += Math.cos(d.ang) * velocidad * dt;
          pos.z += Math.sin(d.ang) * velocidad * dt;
          d.grupo.rotation.y = -d.ang;

          // Animación: patas, cola, cuello y cabeza
          const mov = velocidad > 0 ? 1 : 0.1;
          d.fase += dt * (velocidad * 1.6 + 0.5);
          for (const p of d.patas) p.pivote.rotation.z = Math.sin(d.fase + p.fase) * 0.32 * mov;
          d.cola.forEach((s, i) => s.m.position.set(s.base.x, s.base.y + Math.sin(d.fase * 0.5 + i) * 0.05, Math.sin(tiempo * 2 + i * 0.6) * 0.35 * s.t));
          d.cuello.forEach((s, i) => s.m.position.set(s.base.x, s.base.y + (tocandolo ? 0.3 * s.t : 0), Math.sin(tiempo * 0.8 + i * 0.3) * 0.25 * s.t));
          if (d.cuello.length) d.cabeza.position.copy(d.cuello.at(-1).m.position).add(new THREE.Vector3(0.4, 0, 0));
          d.cabeza.rotation.z = tocandolo ? 0.3 : Math.sin(tiempo * 1.3 + d.fase) * 0.06;

          // Huellas al caminar
          if (velocidad > 0 && tiempo - d.ultimoPaso > 1.4 / Math.max(0.5, velocidad)) {
            d.ultimoPaso = tiempo;
            const h = huellas.length > 140 ? huellas.shift() : { m: new THREE.Mesh(huellaGeo, huellaMat.clone()) };
            if (!h.m.parent) { h.m.rotation.x = -Math.PI / 2; escena.add(h.m); }
            const lado = (Math.round(d.fase) % 2 ? 1 : -1) * 0.5 * d.esp.escala;
            h.m.position.set(pos.x - Math.sin(d.ang) * lado, 0.03, pos.z + Math.cos(d.ang) * lado);
            h.m.scale.setScalar(d.esp.escala * (d.esp.carnivoro ? 1.1 : 1.6));
            h.vida = 7;
            huellas.push(h);
          }

          // Al tocarlo: ruge (carnívoros) o mira (herbívoros), y su ficha
          if (tocandolo) {
            if (d.tocado === 0) { d.esp.carnivoro ? sonido.rugido() : sonido.pasos(); d.rugido = 1; }
            d.tocado += dt;
            if (d.tocado > 0.3) {
              if (!d.avisado) { d.avisado = true; sonido.ficha(); }
              fichas.mostrar(d.id, { ...d.esp.ficha, color: d.esp.color }, c.x, c.y, rad);
            }
          } else { d.tocado = 0; d.avisado = false; }
          d.rugido = Math.max(0, d.rugido - dt * 0.8);
          d.mandibula.rotation.z = d.esp.carnivoro ? -d.rugido * 0.6 : 0;
        }
        for (const h of huellas) { h.vida -= dt; h.m.material.opacity = Math.max(0, Math.min(0.45, h.vida * 0.1)); }

        // Pteranodon
        const a = tiempo * 0.18;
        ptera.grupo.position.set(Math.cos(a) * 22, 11 + Math.sin(tiempo * 0.7), Math.sin(a) * 12);
        ptera.grupo.rotation.y = -a - Math.PI / 2;
        ptera.alas.forEach((ala, i) => { ala.rotation.x = (i ? -1 : 1) * Math.sin(tiempo * 3) * 0.35; });
        const pp = aPantalla(ptera.grupo.position, camara);
        if (manos.some((m) => Math.hypot(m.x - pp.x, m.y - pp.y) < L * 0.07)) fichas.mostrar('ptera', PTERANODON, pp.x, pp.y, L * 0.07);

        render.render(escena, camara);

        // Nombres sobre cada dinosaurio
        const ctx = etiquetas.ctx;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        ctx.font = `700 ${Math.round(L * 0.021)}px "Avenir Next", sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 5;
        for (const d of dinos) {
          d.grupo.getWorldPosition(v);
          const top = aPantalla(v.clone().setY(d.alto * d.esp.escala * 1.25), camara);
          ctx.fillStyle = d.tocado > 0 ? '#ffd38a' : 'rgba(255,255,255,0.9)';
          ctx.fillText(d.esp.nombre, top.x, top.y);
        }
        ctx.fillStyle = '#ffd38a';
        ctx.fillText('☄️ Chicxulub', rp.x, rp.y - L * 0.075);
        const prog = permanencia.progreso('meteoro');
        if (prog > 0.02 && !impacto) { ctx.strokeStyle = '#ffd38a'; ctx.lineWidth = L * 0.008; ctx.beginPath(); ctx.arc(rp.x, rp.y, L * 0.06, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke(); }
        ctx.shadowBlur = 0;
      },
      redimensionar() { encuadrar(); colocarRoca(); },
      posiciones() {
        const res = {};
        for (const d of dinos) { const { c } = radioPantalla(d); res[d.id] = { x: c.x / innerWidth, y: c.y / innerHeight }; }
        const rp = aPantalla(roca.position, camara);
        res.meteoro = { x: rp.x / innerWidth, y: rp.y / innerHeight };
        return res;
      },
      destruir() {
        liberar(escena);
        render.dispose();
      },
    };
  },
};

function angulo(de, a) {
  let d = (a - de) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
