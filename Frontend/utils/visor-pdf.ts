// ─── PDF del servidor en una pestaña, con su nombre ──────────────────────────────────────
// Solo DOM (sin React Native ni @/src/shared): lo usa la web del POS para el libro diario.

type VentanaConGlobales = Window & typeof globalThis;

const esc = (valor: string) =>
  valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Abre un PDF que genera el servidor (libro diario) en una pestaña con su NOMBRE: título de la pestaña, «Descargar»
 * (guarda `nombreArchivo`, p. ej. libro-diario-2026-10-18.pdf) e «Imprimir». El visor del navegador va sin su barra:
 * su botón de descarga guardaba el PDF con el identificador aleatorio de la URL blob, no con la fecha.
 * La pestaña se abre YA (en el clic): si se abriera al llegar la respuesta, el navegador la bloquearía como ventana
 * emergente. Si la bloquea igual, o el navegador no muestra PDF (Chrome en Android), el PDF se descarga con su
 * nombre. Si falla la carga, cierra la pestaña y relanza el error.
 */
export async function abrirPdfDelServidor(cargar: () => Promise<Blob>, nombreArchivo: string, espera = 'Generando el PDF…') {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return;
  const ventana = navigator.pdfViewerEnabled === false ? null : window.open('', '_blank');
  if (ventana) escribir(ventana, paginaVisor(nombreArchivo, espera));
  try {
    const blob = await cargar();
    const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    if (ventana && !ventana.closed) mostrarPdf(ventana as VentanaConGlobales, pdf, nombreArchivo);
    else descargar(pdf, nombreArchivo);
  } catch (error) {
    ventana?.close();
    throw error;
  }
}

function escribir(ventana: Window, html: string) {
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}

function mostrarPdf(ventana: VentanaConGlobales, pdf: Blob, nombre: string) {
  escribir(ventana, paginaVisor(nombre));
  // La URL se crea en la pestaña: vive mientras ella esté abierta, aunque el POS se recargue o se cierre.
  const url = ventana.URL.createObjectURL(pdf);
  ventana.document.getElementById('descargar')?.setAttribute('href', url);
  ventana.document.getElementById('pdf')?.setAttribute('src', `${url}#toolbar=0&navpanes=0`);
}

function descargar(pdf: Blob, nombre: string) {
  const url = URL.createObjectURL(pdf);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** La página de la pestaña: barra con el nombre, «Imprimir» y «Descargar», y el PDF debajo (o el aviso de espera). */
function paginaVisor(nombre: string, espera?: string): string {
  const n = esc(nombre);
  const cuerpo = espera
    ? `<p class="espera">${esc(espera)}</p>`
    : `<header>
  <span class="nombre" title="${n}">${n}</span>
  <button class="boton secundario" id="imprimir" type="button">Imprimir</button>
  <a class="boton primario" id="descargar" download="${n}">Descargar</a>
</header>
<iframe id="pdf" title="${n}"></iframe>
<script>
  document.getElementById('imprimir').addEventListener('click', function () {
    var marco = document.getElementById('pdf');
    try {
      marco.contentWindow.focus();
      marco.contentWindow.print();
    } catch (e) {
      location.href = marco.getAttribute('src').split('#')[0];
    }
  });
</script>`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${n}</title>
<style>
  html, body { margin: 0; height: 100%; background: #0C0F1A; color: #F1F5F9; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  body { display: flex; flex-direction: column; }
  header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,.07); }
  .nombre { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .boton { display: inline-flex; align-items: center; min-height: 36px; box-sizing: border-box; padding: 0 14px; border-radius: 8px; border: 0; cursor: pointer; text-decoration: none; font: 600 13px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .primario { background: #F5A524; color: #0C0F1A; }
  .secundario { background: rgba(255,255,255,.06); color: #F1F5F9; border: 1px solid rgba(255,255,255,.1); }
  iframe { flex: 1; width: 100%; border: 0; background: #525659; }
  .espera { margin: 0; padding: 24px; font-size: 14px; color: #CBD5E1; }
</style></head>
<body>
${cuerpo}
</body></html>`;
}
