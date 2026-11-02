// Sala «Viaje al centro de la Tierra»: un planeta en 3D con un gajo cortado
// para ver sus capas por dentro. Al poner la mano sobre una capa, se ilumina,
// aparece su ficha y se ve a cuántos kilómetros de profundidad está.

import * as THREE from 'three';
import { crearRender, crearLienzo2D, aPantalla, texturaLienzo, liberar, azar, minLado } from './comun.js';
import { CAPAS, SUPERFICIE, profundidadKm, capaEn, pintarSuperficie } from './datos-tierra.js';

const R = 10;

const sombreadorCorte = {
  uniforms: { tiempo: { value: 0 }, resaltado: { value: -1 }, luz: { value: 1 }, colores: { value: CAPAS.map((c) => new THREE.Color(c.color)) }, limites: { value: CAPAS.map((c) => c.desde) } },
  vertexShader: `
    varying vec2 vLocal;
    void main() { vLocal = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float tiempo; uniform float resaltado; uniform float luz;
    uniform vec3 colores[${CAPAS.length}]; uniform float limites[${CAPAS.length}];
    varying vec2 vLocal;
    void main() {
      float r = length(vLocal) / ${R.toFixed(1)};
      float ang = atan(vLocal.y, vLocal.x);
      int capa = 0;
      for (int i = 0; i < ${CAPAS.length}; i++) if (r >= limites[i]) capa = i;
      vec3 c = colores[0];
      for (int i = 0; i < ${CAPAS.length}; i++) if (i == capa) c = colores[i];
      // Remolinos lentos: el manto y el núcleo líquido se mueven
      float mov = sin(r * 38.0 + ang * 6.0 - tiempo * 0.8) * 0.5 + sin(r * 21.0 - ang * 9.0 + tiempo * 0.6) * 0.5;
      c *= 0.86 + 0.1 * mov;
      // Calor hacia el centro
      c += vec3(0.25, 0.18, 0.05) * (1.0 - r) * 0.6;
      // Cada cara del corte con su propia luz, para que se lea la esquina en 3D
      c *= luz;
      // La capa señalada brilla sin perder su color
      if (float(capa) == resaltado) c = min(vec3(1.0), c * (1.35 + 0.15 * sin(tiempo * 5.0)) + vec3(0.06));
      // Línea fina entre capas
      for (int i = 1; i < ${CAPAS.length}; i++) if (abs(r - limites[i]) < 0.004) c *= 0.45;
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
};

export default {
  id: 'tierra',
  titulo: 'Viaje al centro de la Tierra',
  tema: 'Geología',
  icono: '🌋',
  color: '#ff8a4d',
  descripcion: 'Pon la mano en el corte y descubre cada capa del planeta.',

  crear({ contenedor, fichas, sonido }) {
    const render = crearRender(contenedor, { fondo: 0x03040a });
    render.localClippingEnabled = true;
    const etiquetas = crearLienzo2D(contenedor);
    const escena = new THREE.Scene();
    const camara = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 400);

    const encuadrar = () => {
      camara.aspect = innerWidth / innerHeight;
      camara.updateProjectionMatrix();
      // Desde arriba y de lado, mirando hacia el gajo cortado
      const dist = (R * 1.32) / Math.tan(THREE.MathUtils.degToRad(16)) / Math.min(1, camara.aspect);
      const elev = THREE.MathUtils.degToRad(36), az = THREE.MathUtils.degToRad(45);
      camara.position.set(Math.cos(elev) * Math.sin(az) * dist, Math.sin(elev) * dist, Math.cos(elev) * Math.cos(az) * dist);
      camara.lookAt(0, -R * 0.08, 0);
      render.setSize(innerWidth, innerHeight);
      etiquetas.ajustar();
    };
    encuadrar();

    // Estrellas
    const r = azar(21);
    const pos = [];
    for (let i = 0; i < 1500; i++) {
      const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1), d = 160;
      pos.push(d * Math.sin(v) * Math.cos(u), d * Math.cos(v), d * Math.sin(v) * Math.sin(u));
    }
    const geoE = new THREE.BufferGeometry();
    geoE.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    escena.add(new THREE.Points(geoE, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false })));

    // Se recorta solo el octante x>0, y>0, z>0 (el gajo que mira a la cámara)
    const planos = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    const superficie = new THREE.Mesh(
      new THREE.SphereGeometry(R, 96, 64),
      new THREE.MeshStandardMaterial({ map: texturaLienzo(1024, 512, pintarSuperficie), roughness: 0.9, clippingPlanes: planos, clipIntersection: true, side: THREE.DoubleSide }),
    );
    escena.add(superficie);

    // Las tres caras del corte (cuartos de círculo con los anillos de colores)
    // Luz de cada cara: plano z = 0, plano x = 0 y plano y = 0 (el de arriba, más iluminado)
    const materiales = [0.84, 0.68, 1.0].map((luz) => {
      const m = new THREE.ShaderMaterial({ ...sombreadorCorte, uniforms: THREE.UniformsUtils.clone(sombreadorCorte.uniforms), side: THREE.DoubleSide });
      m.uniforms.luz.value = luz;
      return m;
    });
    const materialCorte = materiales[0];
    const caras = [0, 1, 2].map((k) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(R, 96, 0, Math.PI / 2), materiales[k]);
      if (k === 1) m.rotation.y = -Math.PI / 2; // cara en el plano x = 0
      if (k === 2) m.rotation.x = Math.PI / 2; // cara en el plano y = 0
      escena.add(m);
      return m;
    });

    // Atmósfera
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaLienzo(256, 256, (c, w) => {
        const g = c.createRadialGradient(w / 2, w / 2, w * 0.36, w / 2, w / 2, w / 2);
        g.addColorStop(0, 'rgba(120,190,255,0.5)'); g.addColorStop(1, 'rgba(120,190,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, w);
      }),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    halo.scale.setScalar(R * 2.75);
    halo.renderOrder = -1;
    escena.add(halo);

    const sol = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sol.position.set(20, 30, 25);
    escena.add(sol, new THREE.AmbientLight(0x8090b0, 0.9));

    const rayo = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let tiempo = 0;
    let anterior = null;
    let fichaAnterior = null;

    function queHayBajo(x, y) {
      ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
      rayo.setFromCamera(ndc, camara);
      const golpes = rayo.intersectObjects([...caras, superficie], false)
        .filter((g) => g.object !== superficie || !(g.point.x > 0.01 && g.point.y > 0.01 && g.point.z > 0.01));
      if (!golpes.length) return null;
      const g = golpes[0];
      if (g.object === superficie) return { tipo: 'superficie', punto: g.point };
      const radio = g.point.length() / R;
      return { tipo: 'capa', indice: capaEn(radio), radio, punto: g.point };
    }

    return {
      actualizar(dt, manos) {
        tiempo += dt;
        superficie.rotation.y += dt * 0.05;
        for (const m of materiales) m.uniforms.tiempo.value = tiempo;

        let elegido = null;
        for (const m of manos) {
          const q = queHayBajo(m.x, m.y);
          if (q && (!elegido || q.tipo === 'capa')) elegido = { ...q, mano: m };
        }
        for (const m of materiales) m.uniforms.resaltado.value = elegido?.tipo === 'capa' ? elegido.indice : -1;
        const clave = elegido ? (elegido.tipo === 'capa' ? 'capa' + elegido.indice : 'superficie') : null;
        if (clave && clave !== anterior) sonido.tocar();
        anterior = clave;

        render.render(escena, camara);

        const ctx = etiquetas.ctx;
        const L = minLado();
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        // Lista de capas a la izquierda, de la superficie al centro, con una
        // línea hasta su lugar en la cara izquierda del corte.
        const centro = aPantalla(new THREE.Vector3(0, 0, 0), camara);
        const radioGlobo = (R / (2 * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) * camara.position.length())) * innerHeight;
        const tam = Math.round(L * 0.026);
        ctx.font = `700 ${tam}px "Avenir Next", sans-serif`;
        const masAncho = Math.max(...CAPAS.map((c) => ctx.measureText(c.ficha.titulo).width));
        const xLista = Math.max(L * 0.04, centro.x - radioGlobo * 1.08 - L * 0.07 - masAncho);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const resaltado = materialCorte.uniforms.resaltado.value;
        [...CAPAS].reverse().forEach((c, n) => {
          const i = CAPAS.length - 1 - n;
          const medio = i === 0 ? 0.1 : (c.desde + (CAPAS[i + 1]?.desde ?? 1)) / 2;
          const a = Math.PI / 4;
          const ancla = aPantalla(new THREE.Vector3(0, Math.sin(a) * medio * R, Math.cos(a) * medio * R), camara);
          const y = centro.y - L * 0.24 + n * L * 0.12;
          const ancho = ctx.measureText(c.ficha.titulo).width;
          const activo = resaltado === i;
          ctx.strokeStyle = activo ? '#ffd38a' : 'rgba(255,255,255,0.55)';
          ctx.lineWidth = activo ? 3 : 1.5;
          ctx.beginPath(); ctx.moveTo(xLista + ancho + L * 0.05, y); ctx.lineTo(ancla.x, ancla.y); ctx.stroke();
          ctx.fillStyle = c.color;
          ctx.beginPath(); ctx.arc(ancla.x, ancla.y, L * 0.007, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(xLista + ancho + L * 0.04, y, L * 0.012, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = activo ? '#fff3c4' : 'rgba(255,255,255,0.9)';
          ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 5;
          ctx.fillText(c.ficha.titulo, xLista, y);
          ctx.shadowBlur = 0;
        });
        ctx.textBaseline = 'alphabetic';

        if (elegido) {
          const m = elegido.mano;
          const info = elegido.tipo === 'capa' ? CAPAS[elegido.indice].ficha : SUPERFICIE;
          const centro = aPantalla(new THREE.Vector3(0, 0, 0), camara);
          // Cada capa tiene su propia ficha: al cambiar de capa se quita la anterior
          const claveFicha = elegido.tipo === 'capa' ? CAPAS[elegido.indice].id : 'superficie';
          if (fichaAnterior && fichaAnterior !== claveFicha) fichas.ocultar(fichaAnterior);
          fichaAnterior = claveFicha;
          fichas.mostrar(claveFicha, info, centro.x, centro.y, L * 0.42);
          if (elegido.tipo === 'capa') {
            const km = profundidadKm(elegido.radio);
            const texto = km < 1 ? 'En la superficie' : `${Math.round(km).toLocaleString('es-MX')} km bajo tus pies`;
            ctx.font = `700 ${Math.round(L * 0.026)}px "Avenir Next", sans-serif`;
            const w = ctx.measureText(texto).width + L * 0.04;
            ctx.fillStyle = 'rgba(10, 12, 20, 0.85)';
            ctx.beginPath(); ctx.roundRect(m.x - w / 2, m.y - L * 0.11, w, L * 0.05, L * 0.02); ctx.fill();
            ctx.fillStyle = '#ffd38a'; ctx.textAlign = 'center';
            ctx.fillText(texto, m.x, m.y - L * 0.077);
          }
        }
      },
      redimensionar: encuadrar,
      // Para pruebas: punto de pantalla (0..1) sobre la mitad de cada capa en la cara frontal
      posiciones() {
        return Object.fromEntries(CAPAS.map((c, i) => {
          const medio = (c.desde + (CAPAS[i + 1]?.desde ?? 1)) / 2;
          const p = aPantalla(new THREE.Vector3(Math.cos(0.8) * medio * R, Math.sin(0.8) * medio * R, 0), camara);
          return [c.id, { x: p.x / innerWidth, y: p.y / innerHeight }];
        }));
      },
      destruir() {
        liberar(escena);
        render.dispose();
      },
    };
  },
};
