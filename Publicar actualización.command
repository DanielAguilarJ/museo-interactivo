#!/bin/zsh
# Doble clic para publicar los cambios del museo: todas las sedes los reciben
# solas en menos de 15 minutos (se instalan cuando nadie está usando la mesa).
#
# Qué hace:
#   1. Corre las pruebas de la calibración (si fallan, no publica nada).
#   2. Le pone número a la versión y prepara la lista de archivos.
#   3. Guarda los cambios en git y sube la carpeta web/ a la rama gh-pages.

cd "$(dirname "$0")" || exit 1
RAMA_CODIGO=principal
SITIO="https://danielaguilarj.github.io/museo-interactivo/"

echo "🏛️  Publicar actualización del museo"
if ! node --test pruebas/homografia.test.mjs pruebas/calibracion.test.mjs > /dev/null 2>&1; then
  echo "Las pruebas fallaron: no publiqué nada. Revisa con:"
  echo "  node --test pruebas/homografia.test.mjs pruebas/calibracion.test.mjs"
  read -k1 "?Pulsa una tecla para cerrar…"
  exit 1
fi
node herramientas/publicar.mjs || exit 1
VERSION=$(node -p "require('./web/version.json').version")

git add -A
git commit -q -m "Museo: versión $VERSION" || echo "(sin cambios de código)"
git push -q origin "$RAMA_CODIGO" || { echo "No pude subir el código."; exit 1; }
git branch -D gh-pages > /dev/null 2>&1
git subtree split -q --prefix web -b gh-pages || exit 1
git push -q origin gh-pages || { echo "No pude subir el sitio."; exit 1; }

echo "Subida la versión $VERSION. GitHub tarda 1 o 2 minutos en publicarla en:"
echo "  $SITIO"
echo "Las computadoras de las sedes la instalan solas cuando la mesa está libre."
