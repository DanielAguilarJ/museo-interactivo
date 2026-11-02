# Museo Interactivo WorldBrain

Una mesa donde los niños aprenden tocando. El proyector dibuja la experiencia
sobre la mesa y la cámara EMEET PIXY, desde el techo, sigue sus manos.

**Dirección del museo:** https://danielaguilarj.github.io/museo-interactivo/

Funciona en **Windows 10/11 y Mac**, con Google Chrome o Microsoft Edge. Es una
app web instalable: la primera vez se descarga entera (unos 39 MB) y después
funciona **sin internet**. Cuando se publica una versión nueva, todas las sedes
la reciben solas en menos de 15 minutos y la instalan cuando nadie está usando
la mesa. La calibración de cada sede se queda en su computadora y no se borra
al actualizar.

## Las salas

| Sala | Qué hacen los niños |
|---|---|
| 🪐 El Sistema Solar (3D) | Tocan un planeta: se detiene, crece y sale su ficha. |
| 🦖 El valle de los dinosaurios (3D) | Los dinosaurios caminan y dejan huellas. Al tocar uno se detiene (el T. rex ruge). Con la mano rápida huyen los herbívoros. En el meteorito cae el de Chicxulub. |
| 🐢 El Océano | Con la mano rápida los peces huyen; quietos, se acercan. El pulpo cambia de color. |
| 🦴 Excavación de fósiles | Frotan la arena y aparecen 5 fósiles. |
| 🌋 Viaje al centro de la Tierra (3D) | Tocan el corte del planeta y cada capa dice a cuántos km está. |
| 🫀 El cuerpo humano | La mano es unos rayos X. Botones para órganos y huesos. El corazón late y se oye. |

En todas las salas:

- **Retos**: arriba aparece una misión («Encuentra el planeta más grande»). Al
  resolverla hay confeti, sonido y una explicación. Se eligen 4 al azar cada vez.
- **Voz**: cada ficha se lee en voz alta (título y primera frase), para los niños
  que aún no leen. Usa las voces de español de Windows o Mac.
- Para entrar a una sala se deja la mano encima de su tarjeta. Para volver, sobre
  el botón 🏛️ «Salas». Si nadie toca la mesa en 2 minutos, vuelve solo al vestíbulo.

## Instalar en una sede

### Montaje

1. **Cámara** EMEET PIXY en el techo, junto al proyector, mirando a la mesa, por USB.
2. **Proyector** apuntando a la mesa. Lo más sencillo: la computadora **duplica**
   su pantalla en el proyector.
3. **Mesa** clara y mate; luz del cuarto tenue.

### Windows

1. Instala Google Chrome (o usa Microsoft Edge, que ya viene).
2. Abre en el navegador
   https://danielaguilarj.github.io/museo-interactivo/instalar/windows.ps1 ,
   o en PowerShell pega:
   `irm https://danielaguilarj.github.io/museo-interactivo/instalar/windows.ps1 | iex`
   No pide permisos de administrador. Crea el acceso directo «Museo WorldBrain»
   en el Escritorio y en el menú Inicio, hace que se abra solo al prender la
   computadora y evita que la pantalla se apague.
3. La primera vez el navegador pregunta por la cámara: **Permitir**.

### Mac

Doble clic en **«Iniciar Museo»** (en esta carpeta). Abre el museo publicado y
enciende un pequeño programa local que, en Mac, permite girar, inclinar y hacer
zoom con la cámara y fijar su exposición al calibrar. Si la primera vez no hay
internet, abre la copia local. Para apagar: Cmd+Q y doble clic en «Detener Museo».

### Primera calibración (en cada sede, una sola vez)

Pulsa la tecla **A** para abrir los Ajustes y sigue los pasos en orden:

1. **🔌 Conectar el control de la cámara** (solo la primera vez): elige «EMEET
   PIXY» en la ventanita del navegador. Así la cámara deja de seguir a las
   personas, no responde a gestos y no baja la lente. Se repite sola al encender.
2. **🎯 Encuadrar la cámara automáticamente**: la cámara se mueve sola hasta ver
   toda la imagen del proyector. Donde el sistema no deja mover la cámara desde
   el navegador (en Windows suele permitir solo el zoom), apúntala a mano o con
   EMEET Studio.
3. **✨ Calibrar automáticamente** (unos 40 segundos, sin tocar la mesa). El
   proyector enciende 20 puntos para calcular y 5 de examen para medir el
   acierto. Corrige posición, giro, perspectiva y la curvatura del lente. Si el
   cuarto tiene mucha luz, usa puntos más grandes y más fotos; si sale mal, lo
   repite solo una vez y se queda con el mejor intento.
4. **☝️ Afinar con el dedo**: tocas 9 miras con la yema del índice (la cámara ve
   la uña desde arriba, no la yema).
5. **✋ Probar**: cada mira dice cuántos píxeles se corre.

Cada vez que se enciende, el museo revisa la calibración en unos segundos y,
si algo se movió, la repite solo.

Atajos: **A** ajustes · **Esc** vestíbulo · **F** pantalla completa · **1**–**9**
ir a una sala. El ratón también sirve como una mano.

## Uso por sede y privacidad

En Ajustes → «Uso de las salas en esta sede» aparecen las visitas, los minutos
por visita y los retos resueltos de cada sala. Solo se guardan números en esa
computadora. El museo **nunca graba ni envía video ni fotos**: la imagen de la
cámara se usa en el momento para ver las manos y se descarta.

## Publicar una actualización

1. Cambia lo que haga falta en `web/` (cada sala es un archivo en `web/js/salas/`;
   los retos están en `web/js/salas/retos-salas.js`).
2. Doble clic en **«Publicar actualización»**. Corre las pruebas, le pone número
   a la versión y la sube. En 1–2 minutos queda en internet y en menos de 15
   llega a todas las sedes.

Para ver qué versión tiene una sede: Ajustes → «Esta computadora».

## Si algo falla

- **«No pude abrir la cámara»**: revisa el cable USB y que el navegador tenga
  permiso de cámara (Windows: Configuración → Privacidad → Cámara; Mac: Ajustes
  del Sistema → Privacidad → Cámara).
- **La cámara se mueve sola**: Ajustes → «Conectar el control de la cámara» o
  «Dejar la cámara fija».
- **Las manos no caen en su sitio**: Ajustes → Calibrar, y luego Afinar con el dedo.
- **Detecta mal las manos**: baja la luz y evita mangas del color de la piel.

## Para quien programe

```
node --test pruebas/homografia.test.mjs pruebas/calibracion.test.mjs
node pruebas/navegador.mjs "/?sincamara&sala=oceano&manos=0.5,0.5" captura.png
```

- `/?simular`: cámara simulada (girada, con perspectiva, lente curvo, ruido,
  reflejo, retraso y luz del cuarto ajustable) para probar encuadre y
  calibración sin proyector. No guarda nada.
- `/?sw`: activa el modo sin internet y las actualizaciones en una copia local.
- `web/js/control.js`: control de la cámara igual en Windows y Mac (programa
  local en Mac, giro/zoom/exposición del navegador, y WebHID para las órdenes
  propias de la PIXY en `web/js/pixy-hid.js`).
- `web/sw.js` y `web/js/actualizaciones.js`: modo sin internet y actualizaciones.
  `herramientas/publicar.mjs` numera la versión y hace la lista de archivos.
- `servidor.py`, `pixy.py`, `camara/ptz-pixy.c`: programa local de Mac (solo
  acepta pedidos de esta Mac y del museo publicado).
- Órdenes de EMEET según [este gist](https://gist.github.com/branzo/de238cfe001fa4a834ca21ac43dca580);
  giro/zoom por USB en Mac con el método de [GimbalBar](https://github.com/amirmxt/gimbalbar).
- Three.js (MIT) y MediaPipe (Apache 2.0) van incluidos en `web/vendor/`.
