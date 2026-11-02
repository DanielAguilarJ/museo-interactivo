// Dibuja el icono de la app en un lienzo y devuelve un data URL PNG.
// Se ejecuta dentro del navegador desde pruebas/navegador.mjs (ver LEEME).
(async (n) => {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(n * 0.5, n * 0.35, n * 0.05, n * 0.5, n * 0.5, n * 0.75);
  g.addColorStop(0, '#2a3a66'); g.addColorStop(1, '#07090f');
  x.fillStyle = g; x.fillRect(0, 0, n, n);
  // Anillo dorado (zona segura de iconos «maskable»: 80 % central)
  x.strokeStyle = '#ffc861'; x.lineWidth = n * 0.03;
  x.beginPath(); x.arc(n / 2, n / 2, n * 0.33, 0, Math.PI * 2); x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `${Math.round(n * 0.36)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  x.fillText('🏛️', n / 2, n * 0.47);
  x.font = `${Math.round(n * 0.15)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  x.fillText('✋', n * 0.66, n * 0.66);
  return c.toDataURL('image/png');
})
