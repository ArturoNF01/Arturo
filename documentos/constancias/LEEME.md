# Constancias del 1er Congreso

El diseño de la constancia, hecho sobre la plantilla del Congreso (`plantilla-congreso.pdf`, la hoja membretada con los logos, la
marca de agua y la curva de abajo). Hay dos variantes: la de **asistente** y la de **ponente**; sale la de ponente cuando la fila
trae «Ponencia».

| Archivo | Para qué |
| --- | --- |
| `constancia.html` | El diseño. Los campos van entre dobles llaves y se llaman como las columnas de la hoja de Google. |
| `generar.cjs` | Lo imprime a PDF (Node + Playwright con Chromium): `node documentos/constancias/generar.cjs [datos.json] [carpeta]`. |
| `datos-muestra.json` | Dos filas de ejemplo (con nombres de personas inventados). |
| `muestra-asistente.pdf`, `muestra-ponente.pdf` (y `.png`) | Lo que sale con esas filas. |
| `plantilla-congreso.pdf` / `.png` | La plantilla tal cual la mandó el comité, y su copia a 300 ppp que usa el diseño. |
| `fuentes/`, `fuentes.css` | Montserrat (como el membrete) y Cormorant Garamond (título y nombre), de uso libre (SIL OFL). |

## Campos

Nombre, Ponencia, Total de horas, N° de constancia, Folio, Libro, Foja, Fecha de registro y Fecha de elaboración. Un campo vacío no
deja huecos: la frase que lo lleva se quita («Total de horas» vacío quita «con una duración total de … horas»). El nombre baja de
cuerpo, y pasa a dos líneas si hace falta, para que quepa; la ponencia baja hasta seis líneas.

## Pendiente

- Los nombres y cargos de quienes firman (en `constancia.html`, las dos `.firma`): hoy dicen «Nombre de quien firma» y «Cargo».
- La fecha de la constancia sale tal cual venga en «Fecha de elaboración»: conviene que llegue ya escrita («17 de noviembre de 2026»).
