# Anteproyecto · Sistema de registro del congreso

El PDF que se entrega está en `documentos/Anteproyecto-Registro-Congreso-CIESS.pdf`.
Esto es lo que hace falta para volver a generarlo.

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `anteproyecto.html` | El documento entero, en una sola página. |
| `estilo.css` | La línea gráfica: fondo oscuro, texto crema, acento dorado. |
| `capturas/` | Las 24 capturas del sistema, en modo oscuro y a doble resolución. |

Las tipografías van incrustadas en `fuentes.css` como base64. Es deliberado: el
documento debe verse igual dentro de diez años, sin depender de que un servidor
de tipografías siga en pie. Ese archivo no se versiona por su tamaño; se
reconstruye con el guion de abajo.

## Regenerar el PDF

```bash
node guiones/generar-anteproyecto.mjs
```

Compone el HTML y lo imprime a PDF con el Chromium que ya usa el proyecto para
las pruebas de navegador. El resultado queda en `documentos/`.

## Volver a tomar las capturas

Hacen falta el sitio corriendo y una base con datos. Con el sistema en
`localhost:3000` y una cuenta de panel:

```bash
node guiones/capturar-pantallas.mjs
```

## El logotipo

El documento lleva un logotipo **tipográfico** —las palabras CIESS y RIUSS— y no
el institucional: al generarlo no se podía alcanzar el archivo original. Para
sustituirlo basta cambiar el bloque `<div class="marca">` de la portada por:

```html
<img src="logo-ciess-riuss.png" height="46" alt="CIESS · RIUSS">
```

Lo mismo vale para las capturas: se tomaron con un sustituto del logotipo
porque el servidor de imágenes no era alcanzable desde donde se generaron.
