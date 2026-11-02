#!/bin/zsh
# Doble clic para abrir el Museo Interactivo.
# 1) Prepara lo necesario la primera vez.
# 2) Enciende el servidor local y pone la cámara EMEET PIXY en modo museo.
# 3) Abre el museo en Chrome, en pantalla completa y sin barras.

cd "$(dirname "$0")" || exit 1
PUERTO=8777
URL="http://127.0.0.1:$PUERTO/"
# El museo publicado: se actualiza solo y funciona sin internet tras la primera vez.
PUBLICADO="https://danielaguilarj.github.io/museo-interactivo/"
# «local»: el servidor entrega solo la copia de esta carpeta (para probar cambios)
[ "$1" = "local" ] && export MUSEO_ESPEJO=0

echo "🏛️  Museo Interactivo"

if [ ! -x .venv/bin/python ]; then
  echo "Preparando por primera vez (un minuto)…"
  python3 -m venv .venv && .venv/bin/pip install -q hidapi || {
    echo "No pude preparar Python. Instala Python 3 desde python.org y vuelve a intentar."
    read -k1 "?Pulsa una tecla para cerrar…"
    exit 1
  }
fi

# Programa que gira, inclina y hace zoom con la cámara (se compila una sola vez)
if [ ! -x camara/ptz-pixy ] && xcrun --find clang > /dev/null 2>&1; then
  echo "Preparando el control de giro y zoom de la cámara…"
  xcrun clang -O2 -o camara/ptz-pixy camara/ptz-pixy.c -framework IOKit -framework CoreFoundation
fi

if ! curl -s --max-time 1 "$URL"api/salud > /dev/null; then
  echo "Encendiendo el servidor del museo…"
  PYTHONUNBUFFERED=1 nohup .venv/bin/python servidor.py "$PUERTO" > servidor.log 2>&1 &
  for i in {1..20}; do
    sleep 0.3
    curl -s --max-time 1 "$URL"api/salud > /dev/null && break
  done
else
  echo "El servidor ya estaba encendido; pongo la cámara en modo museo."
  curl -s -X POST "$URL"api/camara/fijar > /dev/null
fi

if ! curl -s --max-time 1 "$URL"api/salud > /dev/null; then
  echo "El servidor no arrancó. Detalles en servidor.log:"
  tail -20 servidor.log
  read -k1 "?Pulsa una tecla para cerrar…"
  exit 1
fi
head -3 servidor.log 2>/dev/null

if [ ! -d "/Applications/Google Chrome.app" ]; then
  echo "Falta Google Chrome. Instálalo desde google.com/chrome y vuelve a abrir este archivo."
  read -k1 "?Pulsa una tecla para cerrar…"
  exit 1
fi

# El servidor local entrega la última versión publicada (con internet) o la
# copia de esta carpeta (sin internet). «?sw» guarda el museo en la Mac y
# revisa actualizaciones cada 15 minutos, igual que en las sedes con Windows.
# «Iniciar Museo.command local» usa solo la copia de esta carpeta (para probar cambios).
DESTINO="${URL}?sw"
[ "$1" = "local" ] && DESTINO="$URL"
if curl -s --max-time 4 "${PUBLICADO}version.json" > /dev/null; then
  echo "Con internet: el museo se mantiene al día solo."
else
  echo "Sin internet: uso la última versión guardada en esta Mac."
fi
echo "Abriendo $DESTINO"

# Perfil de Chrome solo para el museo (no toca tu Chrome normal).
# --use-fake-ui-for-media-stream: acepta la cámara sin preguntar (solo en este perfil).
open -na "Google Chrome" --args \
  --user-data-dir="$PWD/.perfil-chrome" \
  --app="$DESTINO" \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --no-first-run --no-default-browser-check --disable-translate

echo "Listo. En el museo: tecla A = ajustes, Esc = vestíbulo, F = pantalla completa."
echo "Para apagarlo: cierra Chrome (Cmd+Q) y abre «Detener Museo»."
