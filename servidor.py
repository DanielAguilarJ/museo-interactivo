"""Servidor local del Museo Interactivo.

- Sirve la carpeta web/ SOLO en 127.0.0.1 (no se ve desde la red).
- Al arrancar pone la cámara EMEET PIXY en modo museo (fija, sin seguimiento).
- Guarda la calibración en config.json para que sobreviva a reinicios.

Uso: .venv/bin/python servidor.py [puerto]
"""

import json
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pixy

RAIZ = Path(__file__).resolve().parent
WEB = RAIZ / "web"
CONFIG = RAIZ / "config.json"
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
MAX_CONFIG = 200_000  # bytes; la calibración ocupa ~2 KB
# Páginas que pueden mover la cámara: la copia local y el museo publicado.
# Para otra dirección: MUSEO_ORIGENES="https://otra.direccion" (separadas por coma).
ORIGENES = {
    f"http://127.0.0.1:{PUERTO}",
    f"http://localhost:{PUERTO}",
    "https://danielaguilarj.github.io",
    *[o.strip() for o in os.environ.get("MUSEO_ORIGENES", "").split(",") if o.strip()],
}
# Espejo del museo publicado: con internet, esta Mac entrega la última versión
# publicada (así se actualiza sola, como las sedes con Windows); sin internet,
# entrega la copia de la carpeta web/. MUSEO_ESPEJO=0 lo apaga.
PUBLICADO = os.environ.get("MUSEO_PUBLICADO", "https://danielaguilarj.github.io/museo-interactivo/")
ESPEJO = os.environ.get("MUSEO_ESPEJO", "1") != "0"


class Manejador(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".task": "application/octet-stream",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def log_message(self, formato, *args):
        if "/api/" in (self.path or ""):
            sys.stderr.write("%s\n" % (formato % args))

    def end_headers(self):
        # Sin caché: cuando se actualiza el museo, el navegador toma lo nuevo.
        if not self.path.startswith("/vendor/") and not self.path.startswith("/modelos/"):
            self.send_header("Cache-Control", "no-store")
        # El museo publicado (https) puede pedirle cosas a este programa local
        origen = self.headers.get("Origin")
        if origen in ORIGENES and (self.path or "").startswith("/api/"):
            self.send_header("Access-Control-Allow-Origin", origen)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        super().end_headers()

    def do_OPTIONS(self):
        # Pregunta previa del navegador antes de un POST desde otra página
        origen = self.headers.get("Origin")
        if origen not in ORIGENES or not (self.path or "").startswith("/api/"):
            self.send_response(403)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _json(self, datos, codigo=200):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def _leer_cuerpo(self):
        largo = int(self.headers.get("Content-Length") or 0)
        if largo <= 0 or largo > MAX_CONFIG:
            return None
        try:
            return json.loads(self.rfile.read(largo).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return None

    def do_GET(self):
        if self.path == "/api/salud":
            return self._json({"ok": True})
        if self.path == "/api/camara":
            return self._json(pixy.estado())
        if self.path == "/api/ptz":
            return self._json(pixy.ptz_leer())
        if self.path == "/api/imagen":
            return self._json(pixy.imagen_leer())
        if self.path == "/api/config":
            if CONFIG.exists():
                try:
                    return self._json(json.loads(CONFIG.read_text("utf-8")))
                except ValueError:
                    return self._json({})
            return self._json({})
        if ESPEJO and not self.path.startswith("/api/") and self._desde_publicado():
            return
        return super().do_GET()

    def _desde_publicado(self):
        """Entrega el archivo pedido desde el museo publicado. False si no hay internet."""
        ruta = (self.path or "/").lstrip("/")
        if ".." in ruta or "\\" in ruta:
            return False
        enviado = False
        try:
            # Siempre la dirección fija del museo: nunca se sigue otra página
            with urllib.request.urlopen(PUBLICADO + ruta, timeout=6) as r:
                self.send_response(200)
                enviado = True
                tipo = r.headers.get("Content-Type") or self.guess_type(ruta.split("?")[0])
                self.send_header("Content-Type", tipo)
                largo = r.headers.get("Content-Length")
                if largo:
                    self.send_header("Content-Length", largo)
                self.end_headers()
                while True:
                    trozo = r.read(256 * 1024)
                    if not trozo:
                        break
                    self.wfile.write(trozo)
            return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                self.send_error(404)
                return True
            return False
        except (urllib.error.URLError, TimeoutError, OSError):
            # Si ya se empezó a mandar, la conexión quedó cortada: no se manda otra respuesta
            return enviado

    def do_POST(self):
        # Solo se aceptan peticiones de la propia página del museo.
        origen = self.headers.get("Origin")
        if origen and origen not in ORIGENES:
            return self._json({"ok": False, "error": "origen no permitido"}, 403)

        if self.path == "/api/camara/fijar":
            return self._json(pixy.modo_museo())
        if self.path == "/api/camara/seguir":
            return self._json(pixy.poner_seguimiento("seguir"))
        # La calibración congela la imagen para que el brillo no cambie entre fotos
        if self.path == "/api/imagen/bloquear":
            return self._json(pixy.bloquear_imagen())
        if self.path == "/api/imagen/liberar":
            return self._json(pixy.liberar_imagen())
        if self.path == "/api/ptz":
            datos = self._leer_cuerpo()
            if not isinstance(datos, dict):
                return self._json({"ok": False, "error": "datos inválidos"}, 400)
            valores = {}
            for clave in ("giro", "inclinacion", "zoom"):
                v = datos.get(clave)
                if v is not None:
                    if not isinstance(v, (int, float)) or isinstance(v, bool):
                        return self._json({"ok": False, "error": f"{clave} debe ser un número"}, 400)
                    valores[clave] = v
            return self._json(pixy.ptz_poner(**valores))
        if self.path == "/api/config":
            datos = self._leer_cuerpo()
            if not isinstance(datos, dict):
                return self._json({"ok": False, "error": "configuración inválida"}, 400)
            temporal = CONFIG.with_suffix(".tmp")
            temporal.write_text(json.dumps(datos, ensure_ascii=False, indent=2), "utf-8")
            os.replace(temporal, CONFIG)
            return self._json({"ok": True})
        return self._json({"ok": False, "error": "ruta desconocida"}, 404)


def main():
    resultado = pixy.modo_museo()
    if resultado.get("ok"):
        print("Cámara EMEET PIXY en modo museo (fija, sin seguimiento ni gestos).", flush=True)
    else:
        print("Aviso: no pude configurar la cámara:", resultado, flush=True)
    # Devolver la cámara a la posición guardada en Ajustes (mirando a la mesa)
    try:
        guardada = json.loads(CONFIG.read_text("utf-8")).get("posicionCamara") if CONFIG.exists() else None
    except ValueError:
        guardada = None
    if isinstance(guardada, dict):
        r = pixy.ptz_poner(**{k: guardada[k] for k in ("giro", "inclinacion", "zoom") if isinstance(guardada.get(k), (int, float))})
        print("Cámara apuntada a la mesa:" if r.get("ok") else "Aviso: no pude apuntar la cámara:", guardada, flush=True)
    servidor = ThreadingHTTPServer(("127.0.0.1", PUERTO), Manejador)
    print(f"Museo listo en http://127.0.0.1:{PUERTO}/", flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
