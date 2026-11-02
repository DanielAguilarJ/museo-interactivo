"""Control de la cámara EMEET PIXY por su canal HID (USB 328f:00c0).

La PIXY tiene dos canales de control:
  1. UVC (estándar): giro, inclinación y zoom. Eso lo maneja Chrome desde la
     pantalla de Ajustes de la cámara.
  2. HID (propio de EMEET): seguimiento automático, gestos y modo privacidad.
     Eso se maneja aquí.

Para el museo la cámara va fija en el techo mirando a la mesa, así que hay que
APAGAR el seguimiento automático (si no, gira buscando caras y se pierde la
calibración), apagar los gestos (un niño con la palma abierta podría activar
algo) y apagar la privacidad automática (si no ve a una persona, baja la lente).

Comandos tomados de la ingeniería inversa publicada en
https://gist.github.com/branzo/de238cfe001fa4a834ca21ac43dca580
Informes de 32 bytes, identificador de informe 0x09.

Uso desde terminal:
  .venv/bin/python pixy.py estado
  .venv/bin/python pixy.py fijar        # modo museo: todo automático apagado
  .venv/bin/python pixy.py seguir       # vuelve a encender el seguimiento
"""

import json
import subprocess
import sys
import time
from pathlib import Path

try:
    import hid  # paquete hidapi
except ImportError:  # el servidor sigue funcionando sin control HID
    hid = None

VENDOR_ID = 0x328F
PRODUCT_ID = 0x00C0
LARGO_INFORME = 32


def _a_bytes(*valores):
    datos = list(valores) + [0] * (LARGO_INFORME - len(valores))
    return bytes(datos[:LARGO_INFORME])


# (comando, confirmación) por cada ajuste
_SEGUIMIENTO = {
    "apagado": 0x00,
    "seguir": 0x01,
    "privacidad": 0x02,
}


def encontrar():
    """Devuelve la ruta HID de la PIXY o None si no está conectada."""
    if hid is None:
        return None
    for d in hid.enumerate(VENDOR_ID, PRODUCT_ID):
        return d["path"]
    return None


def _enviar(dispositivo, *valores):
    dispositivo.write(_a_bytes(*valores))
    time.sleep(0.2)
    respuesta = dispositivo.read(LARGO_INFORME, 300)
    return bytes(respuesta) if respuesta else b""


def _con_dispositivo(funcion):
    ruta = encontrar()
    if ruta is None:
        return {"ok": False, "error": "No encuentro la cámara EMEET PIXY (¿está conectada por USB?)"}
    dispositivo = hid.device()
    try:
        dispositivo.open_path(ruta)
        return funcion(dispositivo)
    except OSError as e:
        return {"ok": False, "error": f"La cámara no aceptó la orden: {e}"}
    finally:
        try:
            dispositivo.close()
        except Exception:
            pass


def poner_seguimiento(modo):
    valor = _SEGUIMIENTO[modo]

    def f(d):
        r1 = _enviar(d, 0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, valor)
        r2 = _enviar(d, 0x09, 0x01, 0x01, 0x01)
        return {"ok": True, "respuestas": [r1.hex(), r2.hex()]}

    return _con_dispositivo(f)


def poner_gestos(encendidos):
    valor = 0x01 if encendidos else 0x00

    def f(d):
        r1 = _enviar(d, 0x09, 0x04, 0x02, 0x00, 0x00, 0x02, 0x00, 0x02, 0x02, valor)
        r2 = _enviar(d, 0x09, 0x04, 0x02, 0x01, 0x00, 0x01, 0x00, 0x01, 0x02)
        return {"ok": True, "respuestas": [r1.hex(), r2.hex()]}

    return _con_dispositivo(f)


def poner_privacidad_automatica(segundos):
    """0 = apagada. Si está encendida, la cámara baja la lente cuando no ve a nadie."""
    valor = max(0, min(255, int(segundos)))

    def f(d):
        r1 = _enviar(d, 0x09, 0x02, 0x01, 0x00, 0x00, 0x04, 0x00, 0x04, valor)
        r2 = _enviar(d, 0x09, 0x02, 0x01, 0x01)
        return {"ok": True, "respuestas": [r1.hex(), r2.hex()]}

    return _con_dispositivo(f)


def modo_museo(antiparpadeo=60):
    """Cámara fija: sin seguimiento, sin gestos y sin privacidad automática.
    Además, imagen automática y antiparpadeo a la frecuencia de la luz (60 Hz en México)."""
    pasos = {
        "seguimiento": poner_seguimiento("apagado"),
        "gestos": poner_gestos(False),
        "privacidad_automatica": poner_privacidad_automatica(0),
    }
    if PTZ.exists():
        pasos["imagen"] = imagen_poner(antiparpadeo=2 if antiparpadeo == 60 else 1, modoExposicion=8, enfoqueAuto=1, balanceAuto=1)
    ok = all(p.get("ok") for p in pasos.values())
    return {"ok": ok, "pasos": pasos}


# ---- Giro, inclinación y zoom (UVC) con el programa camara/ptz-pixy
PTZ = Path(__file__).resolve().parent / "camara" / "ptz-pixy"
LIMITES = {"giro": (-150.0, 150.0), "inclinacion": (-90.0, 90.0), "zoom": (100, 150)}


def _ptz(*args):
    if not PTZ.exists():
        return {"ok": False, "error": "Falta camara/ptz-pixy (ábrelo con «Iniciar Museo» para prepararlo)"}
    try:
        salida = subprocess.run([str(PTZ), *map(str, args)], capture_output=True, text=True, timeout=5)
        return json.loads(salida.stdout.strip() or "{}") or {"ok": False, "error": salida.stderr.strip()}
    except (subprocess.TimeoutExpired, ValueError, OSError) as e:
        return {"ok": False, "error": f"La cámara no respondió: {e}"}


def ptz_leer():
    return _ptz("leer")


def ptz_poner(giro=None, inclinacion=None, zoom=None):
    """Mueve la cámara. Los valores fuera de rango se recortan."""
    def recortar(clave, valor):
        bajo, alto = LIMITES[clave]
        return max(bajo, min(alto, float(valor)))

    resultado = {"ok": True}
    if giro is not None or inclinacion is not None:
        actual = ptz_leer()
        g = recortar("giro", giro if giro is not None else actual.get("giro", 0))
        i = recortar("inclinacion", inclinacion if inclinacion is not None else actual.get("inclinacion", 0))
        resultado = _ptz("mover", f"{g:.1f}", f"{i:.1f}")
    if zoom is not None and resultado.get("ok"):
        resultado = _ptz("zoom", int(recortar("zoom", zoom)))
    return resultado


# ---- Ajustes de imagen (UVC estándar). (unidad, selector, bytes)
# Unidad 1 = terminal de cámara, 3 = unidad de procesamiento (leídas de la PIXY).
AJUSTES = {
    "modoExposicion": (1, 0x02, 1),  # 1 = manual, 8 = automática
    "exposicion": (1, 0x04, 4),      # en décimas de milisegundo
    "enfoqueAuto": (1, 0x08, 1),
    "enfoque": (1, 0x06, 2),
    "antiparpadeo": (3, 0x05, 1),    # 1 = 50 Hz, 2 = 60 Hz (México)
    "balanceAuto": (3, 0x0B, 1),
}


def imagen_leer():
    datos = {}
    for nombre, (u, s, l) in AJUSTES.items():
        r = _ptz("uvc-leer", u, s, l)
        if r.get("ok"):
            datos[nombre] = r["actual"]
    return {"ok": bool(datos), **datos}


def imagen_poner(**valores):
    resultado = {"ok": True}
    for nombre, valor in valores.items():
        if nombre not in AJUSTES:
            continue
        u, s, l = AJUSTES[nombre]
        r = _ptz("uvc-poner", u, s, l, int(valor))
        if not r.get("ok"):
            resultado = {"ok": False, "error": f"{nombre}: {r.get('error')}"}
    return resultado


def bloquear_imagen():
    """Congela exposición, enfoque y balance de blancos en su valor de este
    instante, para que la cámara no cambie de brillo mientras se calibra."""
    actual = imagen_leer()
    if not actual.get("ok"):
        return actual
    r = imagen_poner(modoExposicion=1, exposicion=actual.get("exposicion", 300), enfoqueAuto=0, balanceAuto=0)
    return {**r, "exposicion": actual.get("exposicion")}


def liberar_imagen():
    return imagen_poner(modoExposicion=8, enfoqueAuto=1, balanceAuto=1)


def estado():
    if hid is None:
        return {"conectada": False, "control": False, "error": "Falta el paquete hidapi"}
    return {"conectada": encontrar() is not None, "control": True}


if __name__ == "__main__":
    orden = sys.argv[1] if len(sys.argv) > 1 else "estado"
    if orden == "estado":
        print(estado())
    elif orden == "fijar":
        print(modo_museo())
    elif orden == "seguir":
        print(poner_seguimiento("seguir"))
        print(poner_gestos(True))
    else:
        print(__doc__)
