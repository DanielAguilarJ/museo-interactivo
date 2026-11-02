// Pantalla de Ajustes (para el encargado, con ratón): elegir y mover la
// cámara, encuadrarla, calibrar cámara <-> proyector y afinar con el dedo.

import { invertir, aplicar } from './homografia.js';
import { listarCamaras } from './camara.js';
import { escapar } from './fichas.js';
import { construirControlesCamara } from './ajustes-camara.js';
import { calibrar, encuadrar } from './calibracion/asistente.js';
import { ajustarCalibracion, crearMapeo, evaluarCorreccion, calificar } from './calibracion/modelo.js';
import { SALAS } from './salas/registro.js';

const ESQUINAS = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }];

export class Ajustes {
  constructor(ui, app) {
    this.app = app;
    this.manual = null;
    this.ocupado = false;
    this.el = document.createElement('div');
    this.el.className = 'ajustes';
    this.el.innerHTML = `
      <div class="vista"><canvas class="marcas"></canvas></div>
      <div class="panel">
        <h2>Ajustes del museo</h2>
        <div class="estado" data-e="camara">Buscando cámara…</div>
        <div class="estado" data-e="control">Revisando control de la cámara…</div>
        <div class="estado" data-e="manos">Cargando detector de manos…</div>
        <div class="estado" data-e="calib"></div>

        <h3>1 · Apuntar la cámara</h3>
        <select data-a="lista"></select>
        <button class="principal" data-a="encuadrar">🎯 Encuadrar la cámara automáticamente</button>
        <p>Mueve la cámara sola hasta ver toda la imagen del proyector, centrada y lo más grande posible. También puedes moverla a mano:</p>
        <div data-a="ptz"></div>
        <button data-a="hid" hidden>🔌 Conectar el control de la cámara (solo la primera vez)</button>
        <button data-a="fijar">📌 Dejar la cámara fija (modo museo)</button>

        <h3>2 · Calibrar</h3>
        <p>Apaga luces fuertes, quita objetos brillantes y no toques la mesa durante unos 40 segundos.</p>
        <button class="principal" data-a="auto">✨ Calibrar automáticamente (25 puntos)</button>
        <div class="resultado" data-a="resultado" hidden></div>
        <button data-a="manual">🖱️ Calibrar a mano (4 clics), si la automática no puede</button>

        <h3>3 · Afinar y probar</h3>
        <button data-a="afinar">☝️ Afinar con el dedo (9 toques)</button>
        <p>La cámara ve la uña desde arriba, no la yema que toca la mesa. Al tocar 9 miras, el museo aprende ese pequeño desvío.</p>
        <button data-a="probar">✋ Probar: pon la mano en la mesa</button>
        <label class="casilla"><input type="checkbox" data-a="verificar"> Revisar la calibración cada vez que se enciende el museo (y repetirla sola si se movió algo)</label>

        <h3>4 · Proyector</h3>
        <button data-a="completa">🖥️ Pantalla completa en el proyector</button>
        <div class="deslizador"><label>Volumen</label><input type="range" min="0" max="1" step="0.05" data-a="volumen"><span data-v="volumen"></span></div>
        <label class="casilla"><input type="checkbox" data-a="voz"> Leer en voz alta las fichas (para los niños que aún no leen)</label>
        <label class="casilla"><input type="checkbox" data-a="retos"> Mostrar retos en cada sala («Encuentra…»)</label>

        <h3>5 · Esta computadora</h3>
        <div class="estado" data-e="version">Versión…</div>
        <button data-a="actualizar">🔄 Buscar actualización ahora</button>
        <h3>Uso de las salas en esta sede</h3>
        <div data-a="uso"></div>
        <p>El museo se actualiza solo: cuando hay una versión nueva, la descarga y se reinicia en cuanto nadie está usando la mesa. Funciona sin internet con la última versión descargada. La calibración es de esta computadora y no se borra al actualizar.</p>

        <button class="principal" data-a="salir">🏛️ Volver al museo</button>
        <p>Atajos: <kbd>A</kbd> ajustes · <kbd>Esc</kbd> vestíbulo · <kbd>F</kbd> pantalla completa · <kbd>1</kbd>–<kbd>9</kbd> ir a una sala</p>
      </div>`;
    ui.appendChild(this.el);

    this.vista = this.el.querySelector('.vista');
    this.lienzo = this.el.querySelector('canvas.marcas');
    this.ctx = this.lienzo.getContext('2d');
    if (app.cam) this.vista.prepend(app.cam.video);

    const $ = (a) => this.el.querySelector(`[data-a="${a}"]`);
    this.$ = $;
    $('fijar').onclick = () => this.fijarCamara();
    $('encuadrar').onclick = () => this.encuadrarAuto();
    $('auto').onclick = () => this.calibrarAuto();
    $('manual').onclick = () => this.empezarManual();
    $('afinar').onclick = () => this.app.probarCalibracion(true);
    $('probar').onclick = () => this.app.probarCalibracion(false);
    $('completa').onclick = () => pantallaCompleta();
    $('salir').onclick = () => this.app.irVestibulo();
    $('lista').onchange = (e) => this.app.cambiarCamara(e.target.value);
    $('hid').onclick = () => this.conectarHID();
    $('voz').checked = app.config.voz !== false;
    $('voz').onchange = (e) => { app.config.voz = e.target.checked; app.guardar(); };
    $('retos').checked = app.config.retos !== false;
    $('retos').onchange = (e) => { app.config.retos = e.target.checked; app.guardar(); };
    $('actualizar').onclick = async () => {
      this.estado('version', 'Buscando actualización…');
      const r = await app.actualizaciones?.buscar(true);
      this.mostrarVersion(r);
    };
    this.mostrarVersion();
    this.mostrarUso();
    $('verificar').checked = app.config.verificarAlEncender !== false;
    $('verificar').onchange = (e) => { app.config.verificarAlEncender = e.target.checked; app.guardar(); };
    const vol = $('volumen');
    vol.value = app.config.volumen;
    this.el.querySelector('[data-v="volumen"]').textContent = Math.round(app.config.volumen * 100) + '%';
    vol.oninput = () => {
      this.app.ponerVolumen(+vol.value);
      this.el.querySelector('[data-v="volumen"]').textContent = Math.round(vol.value * 100) + '%';
    };
    this.lienzo.addEventListener('click', (e) => this.clicManual(e));

    this.refrescarEstado();
    this.llenarCamaras();
    this.construirPTZ();
    this.mostrarResultado(app.config.calibracion);
  }

  estado(clave, texto, ok) {
    const el = this.el.querySelector(`[data-e="${clave}"]`);
    el.textContent = texto;
    el.className = 'estado ' + (ok === true ? 'ok' : ok === false ? 'mal' : '');
  }

  construirPTZ() {
    construirControlesCamara(this.$('ptz'), this.app, (t, ok) => this.estado('control', t, ok));
  }

  async refrescarEstado() {
    const { cam, detector, config } = this.app;
    if (cam) this.estado('camara', `Cámara: ${cam.etiqueta} · ${cam.video.videoWidth}×${cam.video.videoHeight}`, cam.esPixy);
    else this.estado('camara', 'No hay cámara abierta. Revisa el cable USB y el permiso de cámara de Chrome.', false);
    if (detector?.detector) this.estado('manos', `Detector de manos listo (${detector.motor}${detector.msPromedio ? ` · ${detector.msPromedio.toFixed(0)} ms por imagen` : ''})`, true);
    else this.estado('manos', 'Detector de manos cargando…');
    const c = config.calibracion;
    if (c) {
      const extra = config.mapa?.dedo ? ' · afinada con el dedo' : '';
      // Calibraciones de la versión anterior no traen nota: se califica con su desvío
      const nota = c.nota || (c.error != null ? calificar({ medio: c.error }).nota : 'sin medir');
      const ok = c.ok !== false && (c.error ?? 0) < 0.025;
      this.estado('calib', `Calibrada el ${new Date(c.fecha).toLocaleString('es-MX')} · ${nota}${extra}${ok ? '' : ' · pulsa «Calibrar automáticamente»'}`, ok);
    } else this.estado('calib', 'Sin calibrar: las manos no caerán en su sitio hasta calibrar.', false);
    const ctl = this.app.control;
    const boton = this.$('hid');
    boton.hidden = !(ctl?.puedeHID && !ctl.hid && cam?.esPixy);
    if (!ctl) this.estado('control', 'Revisando el control de la cámara…');
    else if (ctl.hid || ctl.agente) this.estado('control', ctl.descripcion() + ' La cámara no se mueve sola.', true);
    else if (ctl.puedeHID && cam?.esPixy) this.estado('control', 'Pulsa «Conectar el control de la cámara» y elige EMEET PIXY: así la cámara deja de seguir a las personas.', false);
    else this.estado('control', (ctl.descripcion() || 'Sin control de la cámara desde aquí.') + ' Si se mueve sola, apaga el seguimiento con EMEET Studio.', !!ctl.ptz);
  }

  async conectarHID() {
    try {
      const ok = await this.app.control?.conectarHID();
      if (!ok) { this.estado('control', 'No se eligió la cámara. Vuelve a pulsar el botón y elige EMEET PIXY.', false); return; }
      const r = await this.app.control.fijar();
      this.estado('control', r.ok ? 'Listo: control de la PIXY conectado. Ya no sigue a las personas ni baja la lente. No hace falta repetirlo.' : 'Conectada, pero la cámara no contestó. Desconecta y conecta el cable USB y prueba otra vez.', r.ok);
      this.refrescarEstado();
    } catch (e) {
      this.estado('control', 'No pude conectar el control: ' + e.message, false);
    }
  }

  mostrarUso() {
    const caja = this.$('uso');
    const filas = this.app.estadisticas.resumen(SALAS);
    const desde = this.app.estadisticas.datos.desde;
    if (!filas.some((f) => f.visitas)) { caja.innerHTML = '<p>Todavía nadie ha entrado a una sala en esta computadora.</p>'; return; }
    caja.innerHTML = `<table class="uso"><tr><th>Sala</th><th>Visitas</th><th>Min. por visita</th><th>Retos</th></tr>${filas.map((f) =>
      `<tr><td>${escapar(f.icono)} ${escapar(f.titulo)}</td><td>${f.visitas}</td><td>${f.minutosPromedio.toFixed(1)}</td><td>${f.retos}</td></tr>`).join('')}</table>
      <p>Desde ${desde ? new Date(desde).toLocaleDateString('es-MX') : 'hoy'}. Solo se cuentan visitas: no se guardan imágenes ni datos de los niños.</p>`;
  }

  mostrarVersion(r) {
    const a = this.app.actualizaciones;
    if (!a) { this.estado('version', 'Versión local (sin actualizaciones automáticas).'); return; }
    const base = `Versión ${a.version || 'local'}`;
    if (!r) this.estado('version', `${base}${a.publicado ? '' : ' · modo local'}`, true);
    else if (r.error) this.estado('version', `${base} · no pude revisar: ${r.error}`, false);
    else if (r.nueva) this.estado('version', `${base} · hay una versión nueva (${r.nueva}): se instala sola en cuanto la mesa esté libre.`, true);
    else this.estado('version', `${base} · es la más reciente.`, true);
  }

  async llenarCamaras() {
    const sel = this.$('lista');
    try {
      const lista = await listarCamaras();
      sel.innerHTML = lista.map((d) => `<option value="${escapar(d.deviceId)}">${escapar(d.label || 'Cámara')}</option>`).join('');
      if (this.app.cam) sel.value = this.app.cam.deviceId;
    } catch (e) {
      sel.innerHTML = '<option>Sin permiso de cámara</option>';
    }
  }

  async fijarCamara() {
    this.estado('control', 'Enviando órdenes a la cámara…');
    const r = await this.app.control?.fijar();
    if (r?.ok) this.estado('control', 'Listo: la cámara ya no se mueve sola (sin seguimiento, sin gestos, sin privacidad automática).', true);
    else if (this.app.control?.puedeHID) this.estado('control', 'Primero pulsa «Conectar el control de la cámara» y elige EMEET PIXY.', false);
    else this.estado('control', 'Este navegador no puede dar órdenes a la cámara. Usa Chrome o Edge.', false);
  }

  // ---------- Encuadre automático
  async encuadrarAuto() {
    if (this.ocupado || !this.app.cam) return;
    this.ocupado = true;
    this.estado('calib', 'Encuadrando…');
    try {
      const r = await encuadrar(this.app, { alMensaje: (t) => this.estado('calib', t) });
      this.app.config.posicionCamara = r.posicion;
      this.app.guardar();
      const z = r.zona;
      const cortes = Object.entries(z.cortado).filter(([, v]) => v).map(([k]) => k);
      this.estado('calib', cortes.length
        ? `La cámara aún no ve el lado: ${cortes.join(', ')}. Sube la cámara o aléjala de la mesa.`
        : `Encuadre listo: la imagen del proyector ocupa el ${Math.round(z.area * 100)} % de la vista. Ahora calibra.`, !cortes.length);
      this.construirPTZ();
    } catch (e) {
      this.estado('calib', e.message, false);
    }
    this.ocupado = false;
  }

  // ---------- Calibración automática
  async calibrarAuto() {
    if (this.ocupado || !this.app.cam) return;
    this.ocupado = true;
    try {
      const r = await calibrar(this.app, { alMensaje: (t) => this.estado('calib', t) });
      const aviso = !r.zona.completa ? ' La cámara no ve toda la imagen: usa «Encuadrar» para cubrir las orillas.' : '';
      this.guardarCalibracion(r.mapa, {
        tipo: 'automática', error: r.error?.medio ?? null, maximo: r.error?.maximo ?? null, nota: r.nota.nota, ok: r.nota.ok,
        px: r.nota.px, vistos: r.vistos, total: r.total, descartados: r.descartados, controles: r.controles, latencia: r.latencia, aviso,
      });
    } catch (e) {
      this.estado('calib', e.message, false);
    }
    this.ocupado = false;
  }

  guardarCalibracion(mapa, datos) {
    this.app.config.mapa = mapa;
    this.app.config.homografia = mapa.h;
    this.app.config.calibracion = { fecha: new Date().toISOString(), ...datos };
    this.app.actualizarMapeo();
    this.app.guardar();
    this.refrescarEstado();
    this.mostrarResultado(this.app.config.calibracion);
  }

  mostrarResultado(c) {
    const caja = this.$('resultado');
    if (!c) { caja.hidden = true; return; }
    caja.hidden = false;
    caja.className = 'resultado ' + (c.ok === false ? 'mal' : 'ok');
    const filas = [];
    if (c.px != null) filas.push(`Acierto medido: se corre unos <b>${Math.max(1, Math.round(c.px))} px</b> en promedio (máximo ${Math.round((c.maximo ?? 0) * innerWidth)} px).`);
    if (c.vistos != null) filas.push(`Puntos vistos: ${c.vistos} de ${c.total}${c.descartados ? ` · ${c.descartados} descartados por reflejos` : ''} · ${c.controles} de control.`);
    if (c.tipo === 'manual') filas.push('Hecha a mano con 4 puntos: sin corrección del lente.');
    if (c.aviso) filas.push(escapar(c.aviso));
    caja.innerHTML = `<strong>${escapar(c.nota || 'Calibrada')}</strong>${filas.map((f) => `<p>${f}</p>`).join('')}`;
  }

  // ---------- Calibración a mano: el encargado hace clic en 4 círculos
  empezarManual() {
    if (this.ocupado) return;
    this.manual = { puntos: [], marcas: document.createElement('div') };
    this.manual.marcas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30';
    this.manual.marcas.innerHTML = ESQUINAS.map((p, i) =>
      `<div class="esquina-manual" style="left:${p.x * 100}%;top:${p.y * 100}%">${i + 1}</div>`).join('');
    document.getElementById('ui').appendChild(this.manual.marcas);
    this.estado('calib', 'En la vista de la cámara, haz clic sobre el centro del círculo 1 que se ve en la mesa.');
  }

  clicManual(e) {
    if (!this.manual) return;
    const p = this.aCamara(e.clientX, e.clientY);
    if (!p) return;
    this.manual.puntos.push(p);
    const n = this.manual.puntos.length;
    if (n < 4) { this.estado('calib', `Bien. Ahora haz clic sobre el círculo ${n + 1}.`); return; }
    this.manual.marcas.remove();
    const puntos = this.manual.puntos;
    this.manual = null;
    try {
      const r = ajustarCalibracion(puntos.map((c, i) => ({ camara: c, pantalla: ESQUINAS[i] })));
      this.guardarCalibracion({ h: r.h, malla: null, dedo: null }, { tipo: 'manual', nota: 'Calibrada a mano', ok: true, error: null });
    } catch (err) {
      this.estado('calib', 'No pude calibrar: ' + err.message, false);
    }
  }

  // Rectángulo donde se ve el video dentro de la vista (object-fit: contain)
  rectVideo() {
    const video = this.app.cam?.video;
    if (!video?.videoWidth) return null;
    const r = this.vista.getBoundingClientRect();
    const s = Math.min(r.width / video.videoWidth, r.height / video.videoHeight);
    const w = video.videoWidth * s, h = video.videoHeight * s;
    return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h, vista: r };
  }

  aCamara(cx, cy) {
    const r = this.rectVideo();
    if (!r) return null;
    const x = (cx - r.x) / r.w, y = (cy - r.y) / r.h;
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
  }

  actualizar() {
    const r = this.rectVideo();
    const dpr = devicePixelRatio || 1;
    if (!r) return;
    const W = r.vista.width, H = r.vista.height;
    if (this.lienzo.width !== Math.round(W * dpr)) { this.lienzo.width = Math.round(W * dpr); this.lienzo.height = Math.round(H * dpr); }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const ox = r.x - r.vista.left, oy = r.y - r.vista.top;
    const enVista = (p) => ({ x: ox + p.x * r.w, y: oy + p.y * r.h });

    // Contorno de la imagen del proyector, tal como lo ve la cámara
    const inv = invertir(this.app.config.mapa?.h || this.app.config.homografia);
    if (inv && this.app.config.calibracion) {
      ctx.strokeStyle = '#ffc861';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      const borde = [];
      for (let t = 0; t <= 1; t += 0.125) borde.push([t, 0]);
      for (let t = 0; t <= 1; t += 0.125) borde.push([1, t]);
      for (let t = 1; t >= 0; t -= 0.125) borde.push([t, 1]);
      for (let t = 1; t >= 0; t -= 0.125) borde.push([0, t]);
      const malla = this.app.config.mapa?.malla;
      borde.forEach(([x, y], i) => {
        // Deshacer también la corrección del lente (unas vueltas bastan: es pequeña)
        let t = { x, y };
        for (let k = 0; k < 5; k++) { const c = evaluarCorreccion(malla, t.x, t.y); t = { x: x - c.x, y: y - c.y }; }
        const q = enVista(aplicar(inv, t.x, t.y));
        i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Manos que ve la cámara
    ctx.fillStyle = '#6fe0ff';
    for (const lm of this.app.ultimosPuntos || []) {
      for (const p of lm) { const q = enVista(p); ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); ctx.fill(); }
    }
    // Clics de la calibración a mano
    if (this.manual) {
      ctx.fillStyle = '#ff7a6b';
      ctx.font = 'bold 18px sans-serif';
      this.manual.puntos.forEach((p, i) => {
        const q = enVista(p);
        ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(String(i + 1), q.x + 10, q.y - 10);
      });
    }
  }

  destruir() {
    this.manual?.marcas.remove();
    // Sacar un video del documento lo pausa: lo devolvemos a su sitio oculto.
    this.app.devolverVideo();
    this.el.remove();
  }
}

export { crearMapeo };

export async function pantallaCompleta() {
  try {
    if ('getScreenDetails' in window) {
      const d = await window.getScreenDetails();
      const otra = d.screens.find((s) => s !== d.currentScreen && !s.isPrimary) || d.screens.find((s) => s !== d.currentScreen);
      if (otra) { await document.documentElement.requestFullscreen({ screen: otra }); return; }
    }
  } catch (e) { /* sin permiso para otras pantallas */ }
  try { await document.documentElement.requestFullscreen(); } catch (e) { /* ya estaba */ }
}
