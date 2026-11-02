#!/bin/zsh
# Doble clic para apagar el servidor del Museo Interactivo.
cd "$(dirname "$0")" || exit 1
PIDS=$(lsof -ti tcp:8777 -sTCP:LISTEN)
if [ -n "$PIDS" ]; then
  kill $PIDS && echo "Servidor del museo apagado."
else
  echo "El servidor del museo ya estaba apagado."
fi
