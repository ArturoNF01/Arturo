# Anteproyecto · Sistema de registro del congreso

El PDF que se entrega está en `documentos/Anteproyecto-Registro-Congreso-CIESS.pdf`.
Esto es lo que hace falta para volver a generarlo.

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `anteproyecto.html` | El documento entero, en una sola página. |
| `estilo.css` | La línea gráfica: fondo oscuro, texto crema, acento dorado. |
| `capturas/` | Las 28 capturas: 24 del sistema y 4 de los correos, a doble resolución. |
| `correos/` | Los correos compuestos en HTML, paso previo a capturarlos. No se versiona: se rehace. |

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

### Las del sistema

Se toman a mano, con el sitio corriendo en `localhost:3000`, una base con datos
y una cuenta de panel: son 24 pantallas que dependen de en qué estado esté cada
una, y automatizarlas costaba más que rehacerlas cuando cambian.

### Las de los correos

Estas sí salen solas, y no hace falta ni servidor ni clave de Resend —sólo la
base, de donde salen las plantillas:

```bash
npm run vista-correos            # compone los correos en correos/*.html
node guiones/capturar-correos.mjs # y los convierte en imágenes
```

El primero usa las mismas funciones que el envío real y se detiene justo antes
de entregarle el correo a Resend: lo que se ve en la captura es lo que llega al
buzón, no una maqueta parecida. Para que los enlaces salgan con el dominio de
verdad y no con `localhost`:

```bash
NEXT_PUBLIC_URL_SITIO=https://congreso-dss.ciess.org npm run vista-correos
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
