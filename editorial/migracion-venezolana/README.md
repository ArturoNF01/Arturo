# ¿Cómo es el acceso a seguridad social de la población migrante venezolana en las principales ciudades de Colombia?

Maquetación editorial del libro CISS · CIESS · CODESS. Hereda la línea gráfica de
*De un sistema de pensiones a un sistema integral de protección a la población
mayor* (CISS-CIESS-CODESS, 2025): formato, tipografía, colores, tablas, cornisas,
folios y portada. Por ahora contiene la portada, los preliminares, el índice y el
**capítulo 1**; el resto de capítulos se suman con el mismo sistema.

## Resultado

> El repositorio es público: el texto del capítulo, sus datos, las figuras y los
> PDF (`contenido/10-capitulo-1.html`, `contenido/cuadros/`, `datos/capitulo-1.json`,
> `figuras/svg/`, `salida/`) **no se versionan** hasta que CISS/CIESS/CODESS
> autoricen su publicación. Se regeneran con los guiones a partir de `insumos/`.

| Archivo | Uso |
| --- | --- |
| `salida/acceso-seguridad-social-migrantes-venezolanos.pdf` | Edición digital: portada + interiores |
| `salida/portada.pdf` | Portada sola (propuesta) |
| `salida/interiores.pdf` | Interiores para imprenta, p. 1 = portadilla |
| `salida/figuras-pdf/*.pdf` | Cada gráfica, mapa y diagrama en PDF vectorial (para InDesign/Illustrator) |
| `figuras/svg/*.svg` | Las mismas figuras en SVG editable |

## Especificaciones heredadas del libro de referencia

- **Formato:** 130 × 210 mm. Caja de 100 mm; márgenes laterales de 15 mm.
- **Texto:** 12/14 pt, justificado con división silábica en español, sangría de 5 mm,
  cifras de estilo antiguo; notas a 8/10 pt con filete azul a la izquierda.
- **Títulos:** capítulo en 17 pt negrita gris (#6d6e71) centrado; secciones en 13 pt
  seminegra con viñeta de medio círculo azul; capitular levantada de 70 pt en azul.
- **Cornisas:** título del libro (par) y del capítulo (impar) en azul, 9 pt negrita.
  Folio en caja azul de 10 × 12 mm al corte.
- **Tablas:** encabezado #1e6ea6 con texto blanco, filas alternas #e0e5f1 / #b2c3de,
  filetes azules de 0.25 pt, texto gris #58595b.
- **Paleta:** #1e6ea6, #00427a, #0e2050, #5082b5, #89a6cc, #b2c3de, #e0e5f1, grises #6d6e71 y #58595b.
- **Tipografías:** el original usa Adobe Caslon Pro y Rotis II Sans Pro (comerciales).
  Aquí se usan equivalentes libres (licencia OFL) con métricas ajustadas:
  **Crimson Pro** (texto) y **Source Sans 3** (títulos, tablas y gráficas); la portada
  usa **Cinzel**, igual que el original. Con las licencias originales basta cambiar
  `--texto` y `--sans` en `plantilla/libro.css`.

## Estructura

```
contenido/        HTML por pieza: 00-portada, 01-preliminares, 02-indice, 10-capitulo-1
contenido/cuadros Cuadros 1-9 generados desde los datos
plantilla/        libro.css: toda la línea gráfica
figuras/          Generador de figuras (Node + D3): graficas.mjs, mapas.mjs, portada.mjs (mapa de la portada)
datos/            capitulo-1.json (datos de cuadros y gráficas) y geo/ (Natural Earth)
fuentes/          Tipografías OFL
logos/            CISS y CIESS en vector (del .ai oficial) y CODESS (imagen: falta el original vectorial)
guiones/          Extracción, construcción y herramientas de revisión
insumos/          Archivos originales del capítulo (no se versionan)
```

## Construir

Requisitos: Python 3.11+ con `weasyprint pyphen pypdf pymupdf openpyxl python-docx lxml`
y Node 20+.

```bash
npm install                                   # D3, topojson, world-atlas, opentype.js
python guiones/datos_cap1.py                  # insumos/ -> datos/capitulo-1.json
python guiones/cuadros_cap1.py                # datos -> contenido/cuadros/*.html
npm run figuras                               # datos -> figuras/svg/*.svg
python guiones/construir.py --figuras         # -> salida/
```

Portada: fotografía a sangre virada en los azules del libro, con el mapa de las
rutas de Venezuela a las principales ciudades de Colombia encima (`figuras/portada.mjs`).
La foto va en `insumos/fotos/portada.jpg` (licencia de Adobe Stock: no se versiona);
recorte, foco y tema en `figuras/foto-portada.json`. `construir.py` la prepara sola
(`guiones/fotos_portada.py`); mientras falte, deja un fondo provisional.

Logotipos: `python guiones/extraer_logos.py` convierte `insumos/Logos CISS - CIESS.ai`
en `logos/{ciss,ciess}-{color,sobre-oscuro,blanco,gris}.svg`.

### Paginación (colocación de figuras)

WeasyPrint no hace «flotar» figuras: si una no cabe, salta de página y deja un
hueco. Estos guiones hacen el trabajo de ajuste que en InDesign se hace a mano:

| Guion | Qué hace |
| --- | --- |
| `guiones/huecos.py salida/interiores.pdf` | Lista páginas con espacio vacío (descuenta notas al pie) |
| `guiones/colocar_figuras.py … --seguras` | Adelanta el párrafo siguiente cuando una figura deja hueco |
| `guiones/probar_orden.py …` | Compone varias ordenaciones de una sección y aplica la de menos huecos |
| `guiones/rellenar_huecos.py …` | Parte el párrafo que sigue a la figura para llenar la página (texto intacto) |
| `guiones/optimizar_paginas.py …` | Prueba mover, partir o anticipar figuras en cada hueco |
| `figuras/ajustes.json` y `style="--aire: …"` en un `<figure>` | Alto de gráficas y aire de tablas para llenar la página exacta |

Revisión visual: `guiones/hojas_contacto.py salida/interiores.pdf prefijo`.

## Sumar un capítulo

1. `python guiones/extraer_docx.py insumos/CapN.docx contenido/capitulo-N.base.html`
2. Copiar la estructura de `contenido/10-capitulo-1.html` (apertura, `h2` con `id`,
   figuras con `<figure id="…">`, bibliografía) en `contenido/NN-capitulo-N.html`.
3. Añadirlo a `PIEZAS` en `guiones/construir.py` y sus entradas en `02-indice.html`
   (los folios del índice se calculan solos).
