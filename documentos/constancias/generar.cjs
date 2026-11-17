/**
 * Genera constancias en PDF a partir de constancia.html (el diseño sobre la plantilla del Congreso).
 *
 *   node documentos/constancias/generar.cjs                       # las muestras de datos-muestra.json
 *   node documentos/constancias/generar.cjs datos.json salida/    # las filas de un JSON, un PDF por fila
 *
 * Cada fila es un objeto con los nombres de las columnas de la hoja («Nombre», «Ponencia», «Total de horas», «N° de
 * constancia», «Folio», «Libro», «Foja», «Fecha de registro», «Fecha de elaboración»). Con «Ponencia» sale la constancia
 * de ponente; sin ella, la de asistente. Un campo vacío no deja huecos: la frase que lo lleva se quita.
 *
 * Usa Playwright (con Chromium) para imprimir el HTML a PDF: el texto queda como texto y la plantilla como vector.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const carpeta = __dirname;
const [, , archivoDatos = path.join(carpeta, 'datos-muestra.json'), destino = carpeta] = process.argv;

/**
 * Acomoda los textos largos en su caja. El nombre se queda en una sola línea mientras quepa sin bajar de 22 pt; si no cabe, se
 * parte en dos líneas y baja hasta 17 pt como mucho. La ponencia baja de cuerpo hasta que quepa en seis líneas (11 pt como mínimo).
 */
const ajustar = `
  (() => {
    const lineas = (el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
    const poner = (el, pt) => { el.style.fontSize = pt + 'pt'; };
    for (const el of document.querySelectorAll('[data-ajustar]')) {
      let pt = parseFloat(getComputedStyle(el).fontSize) * 0.75; // de px a pt
      if (el.dataset.ajustar === 'nombre') {
        const inicial = pt;
        while (pt > 22 && lineas(el) > 1) { pt -= 0.5; poner(el, pt); }
        if (lineas(el) > 1) {
          pt = Math.min(inicial, 25);
          poner(el, pt);
          while (pt > 17 && lineas(el) > 2) { pt -= 0.5; poner(el, pt); }
        }
      } else {
        while (pt > 11 && lineas(el) > 6) { pt -= 0.5; poner(el, pt); }
      }
    }
  })();
`;

(async () => {
  const filas = JSON.parse(fs.readFileSync(archivoDatos, 'utf8'));
  fs.mkdirSync(destino, { recursive: true });
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 816, height: 1056 } });
  let n = 0;
  for (const fila of filas) {
    n += 1;
    await pagina.goto('file://' + path.join(carpeta, 'constancia.html'));
    await pagina.evaluate(({ fila }) => {
      const variante = String(fila['Ponencia'] ?? '').trim() ? 'ponente' : 'asistente';
      document.querySelector('.hoja').dataset.variante = variante;
      // Una frase con un campo vacío (data-si) se quita entera.
      for (const el of document.querySelectorAll('[data-si]')) {
        if (!String(fila[el.dataset.si] ?? '').trim()) el.classList.add('vacio');
      }
      // Los campos {{…}} se rellenan como texto: nada de lo que venga de la hoja se interpreta como HTML.
      const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodos = [];
      while (recorrido.nextNode()) nodos.push(recorrido.currentNode);
      for (const nodo of nodos) {
        nodo.textContent = nodo.textContent.replace(/\{\{([^}]+)\}\}/g, (_, campo) => String(fila[campo.trim()] ?? '').trim());
      }
    }, { fila });
    await pagina.evaluate('document.fonts.ready');
    await pagina.evaluate(ajustar);
    const variante = String(fila['Ponencia'] ?? '').trim() ? 'ponente' : 'asistente';
    const nombre = String(fila['archivo'] ?? `constancia-${variante}-${String(n).padStart(3, '0')}`);
    await pagina.pdf({ path: path.join(destino, `${nombre}.pdf`), width: '8.5in', height: '11in', printBackground: true, preferCSSPageSize: true, pageRanges: '1' });
    console.log(`${nombre}.pdf`);
  }
  await navegador.close();
})();
