// Mueve la cámara EMEET PIXY (giro, inclinación y zoom) en macOS.
//
// Chrome en Mac no expone estos controles y libusb no puede usarlos porque el
// controlador de video del sistema es dueño de la interfaz. IOKit sí deja
// mandar la petición UVC estándar por el canal de control del dispositivo
// (método de github.com/amirmxt/gimbalbar, licencia MIT).
//
// Compilar: clang -O2 -o ptz-pixy ptz-pixy.c -framework IOKit -framework CoreFoundation
// Uso:
//   ptz-pixy leer                 -> JSON con posición y límites
//   ptz-pixy mover <giro> <incl>  -> grados
//   ptz-pixy zoom <valor>         -> 100 = sin zoom

#include <CoreFoundation/CoreFoundation.h>
#include <IOKit/IOKitLib.h>
#include <IOKit/IOCFPlugIn.h>
#include <IOKit/usb/IOUSBLib.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define VID 0x328f
#define PID 0x00c0
#define CT_ZOOM_ABS 0x0B
#define CT_PANTILT_ABS 0x0D
#define WINDEX ((1 << 8) | 0) // terminal de cámara 1, interfaz VideoControl 0
#define SET_CUR 0x01
#define GET_CUR 0x81
#define GET_MIN 0x82
#define GET_MAX 0x83

static IOUSBDeviceInterface **abrir(void) {
  CFMutableDictionaryRef filtro = IOServiceMatching("IOUSBHostDevice");
  int vid = VID, pid = PID;
  CFNumberRef v = CFNumberCreate(NULL, kCFNumberIntType, &vid);
  CFNumberRef p = CFNumberCreate(NULL, kCFNumberIntType, &pid);
  CFDictionarySetValue(filtro, CFSTR("idVendor"), v);
  CFDictionarySetValue(filtro, CFSTR("idProduct"), p);
  CFRelease(v);
  CFRelease(p);
  io_service_t servicio = IOServiceGetMatchingService(kIOMainPortDefault, filtro);
  if (!servicio) return NULL;
  IOCFPlugInInterface **plug = NULL;
  SInt32 puntaje;
  kern_return_t kr = IOCreatePlugInInterfaceForService(servicio, kIOUSBDeviceUserClientTypeID,
                                                       kIOCFPlugInInterfaceID, &plug, &puntaje);
  IOObjectRelease(servicio);
  if (kr || !plug) return NULL;
  IOUSBDeviceInterface **dev = NULL;
  (*plug)->QueryInterface(plug, CFUUIDGetUUIDBytes(kIOUSBDeviceInterfaceID), (LPVOID *)&dev);
  IODestroyPlugInInterface(plug);
  return dev;
}

static int peticionUnidad(IOUSBDeviceInterface **dev, UInt8 tipo, UInt8 req, UInt8 unidad, UInt8 selector, void *datos, UInt16 largo) {
  IOUSBDevRequest r = {
      .bmRequestType = tipo, .bRequest = req, .wValue = selector << 8,
      .wIndex = (unidad << 8) | 0, .wLength = largo, .pData = datos,
  };
  return (*dev)->DeviceRequest(dev, &r) == kIOReturnSuccess ? 0 : -1;
}

static int peticion(IOUSBDeviceInterface **dev, UInt8 tipo, UInt8 req, UInt8 selector, void *datos, UInt16 largo) {
  return peticionUnidad(dev, tipo, req, WINDEX >> 8, selector, datos, largo);
}

// Lee un control UVC cualquiera (1, 2 o 4 bytes) como número con signo.
static int leerUvc(IOUSBDeviceInterface **dev, UInt8 req, UInt8 unidad, UInt8 selector, int largo, long *valor) {
  unsigned char b[4] = {0, 0, 0, 0};
  if (peticionUnidad(dev, 0xA1, req, unidad, selector, b, largo)) return -1;
  if (largo == 1) *valor = b[0];
  else if (largo == 2) *valor = (int16_t)(b[0] | (b[1] << 8));
  else *valor = (int32_t)(b[0] | (b[1] << 8) | (b[2] << 16) | ((uint32_t)b[3] << 24));
  return 0;
}

static int par(IOUSBDeviceInterface **dev, UInt8 req, double *giro, double *incl) {
  int32_t v[2] = {0, 0};
  if (peticion(dev, 0xA1, req, CT_PANTILT_ABS, v, 8)) return -1;
  *giro = v[0] / 3600.0; // la UVC usa segundos de arco
  *incl = v[1] / 3600.0;
  return 0;
}

static int zoom(IOUSBDeviceInterface **dev, UInt8 req, int *valor) {
  uint16_t z = 0;
  if (peticion(dev, 0xA1, req, CT_ZOOM_ABS, &z, 2)) return -1;
  *valor = z;
  return 0;
}

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "uso: ptz-pixy leer | mover <giro> <incl> | zoom <valor>\n");
    return 2;
  }
  IOUSBDeviceInterface **dev = abrir();
  if (!dev) {
    printf("{\"ok\":false,\"error\":\"No encuentro la EMEET PIXY por USB\"}\n");
    return 1;
  }
  int rc = 0;
  if (!strcmp(argv[1], "leer")) {
    double g = 0, i = 0, gmin = 0, imin = 0, gmax = 0, imax = 0;
    int z = 0, zmin = 0, zmax = 0;
    int a = par(dev, GET_CUR, &g, &i) | par(dev, GET_MIN, &gmin, &imin) | par(dev, GET_MAX, &gmax, &imax);
    int b = zoom(dev, GET_CUR, &z) | zoom(dev, GET_MIN, &zmin) | zoom(dev, GET_MAX, &zmax);
    if (a && b) {
      printf("{\"ok\":false,\"error\":\"La cámara no respondió\"}\n");
      rc = 1;
    } else {
      printf("{\"ok\":true,\"giro\":%.1f,\"inclinacion\":%.1f,\"zoom\":%d,"
             "\"giroMin\":%.1f,\"giroMax\":%.1f,\"inclinacionMin\":%.1f,\"inclinacionMax\":%.1f,"
             "\"zoomMin\":%d,\"zoomMax\":%d,\"conGiro\":%s,\"conZoom\":%s}\n",
             g, i, z, gmin, gmax, imin, imax, zmin, zmax, a ? "false" : "true", b ? "false" : "true");
    }
  } else if (!strcmp(argv[1], "mover") && argc >= 4) {
    int32_t v[2] = {(int32_t)(atof(argv[2]) * 3600), (int32_t)(atof(argv[3]) * 3600)};
    rc = peticion(dev, 0x21, SET_CUR, CT_PANTILT_ABS, v, 8) ? 1 : 0;
    printf(rc ? "{\"ok\":false,\"error\":\"La cámara no aceptó el movimiento\"}\n" : "{\"ok\":true}\n");
  } else if (!strcmp(argv[1], "uvc-leer") && argc >= 5) {
    // uvc-leer <unidad> <selector> <largo>: valor actual, mínimo, máximo y de fábrica
    UInt8 u = atoi(argv[2]), s = atoi(argv[3]);
    int l = atoi(argv[4]);
    long cur = 0, mn = 0, mx = 0, def = 0;
    if (l != 1 && l != 2 && l != 4) l = 2;
    if (leerUvc(dev, GET_CUR, u, s, l, &cur)) {
      printf("{\"ok\":false,\"error\":\"La cámara no tiene ese ajuste\"}\n");
      rc = 1;
    } else {
      int hayMin = !leerUvc(dev, GET_MIN, u, s, l, &mn), hayMax = !leerUvc(dev, GET_MAX, u, s, l, &mx);
      int hayDef = !leerUvc(dev, 0x87, u, s, l, &def);
      printf("{\"ok\":true,\"actual\":%ld", cur);
      if (hayMin) printf(",\"min\":%ld", mn);
      if (hayMax) printf(",\"max\":%ld", mx);
      if (hayDef) printf(",\"fabrica\":%ld", def);
      printf("}\n");
    }
  } else if (!strcmp(argv[1], "uvc-poner") && argc >= 6) {
    // uvc-poner <unidad> <selector> <largo> <valor>
    UInt8 u = atoi(argv[2]), s = atoi(argv[3]);
    int l = atoi(argv[4]);
    long v = atol(argv[5]);
    unsigned char b[4] = {v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255};
    if (l != 1 && l != 2 && l != 4) l = 2;
    rc = peticionUnidad(dev, 0x21, SET_CUR, u, s, b, l) ? 1 : 0;
    printf(rc ? "{\"ok\":false,\"error\":\"La cámara no aceptó el ajuste\"}\n" : "{\"ok\":true}\n");
  } else if (!strcmp(argv[1], "zoom") && argc >= 3) {
    uint16_t z = (uint16_t)atoi(argv[2]);
    rc = peticion(dev, 0x21, SET_CUR, CT_ZOOM_ABS, &z, 2) ? 1 : 0;
    printf(rc ? "{\"ok\":false,\"error\":\"La cámara no aceptó el zoom\"}\n" : "{\"ok\":true}\n");
  } else {
    fprintf(stderr, "orden desconocida\n");
    rc = 2;
  }
  (*dev)->Release(dev);
  return rc;
}
