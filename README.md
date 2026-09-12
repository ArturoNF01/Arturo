# Sistema de registro · 1er Congreso Desafíos de la seguridad social en las Américas

Registro web trilingüe y panel de control en tiempo real para el congreso
convocado por el **CIESS** y la **CISS**.

## Qué incluye

- **Formulario dinámico** que muestra u oculta secciones y campos según el perfil
  de participación y la modalidad elegida. Respeta todos los campos del script
  de Google Apps Script de referencia, con sus límites de semblanza y resumen.
- **Siete perfiles**: funcionario del CIESS, funcionario de la CISS y espectador
  en vivo (internos); espectador en línea, participante de otra institución,
  panelista y conferencista (externos).
- **Almacenamiento sincronizado**: PostgreSQL como base principal y Google Sheets
  como réplica en las pestañas normalizadas `REG`, `PAR`, `ALO`, `TRA`, `PSE` y
  `ALI`. Las fotografías se guardan en una carpeta de Google Drive.
- **Trilingüe** (español por defecto, inglés y portugués) y **modo oscuro** activo
  por defecto, con alternancia a modo claro.
- **Correos de confirmación** en el idioma del participante, con plantillas
  editables desde el panel.
- **Cupos por modalidad** con número de lugares presenciales configurable y paso
  automático a lista de espera.
- **Panel de control** con dashboard en tiempo real, notificaciones push al caer
  cada registro, filtros dinámicos, exportación en CSV, Excel y JSON, consola SQL
  de sólo lectura, heatmap de actividad, proyección por regresión lineal simple,
  mapa geográfico, gestión de cupos y plantillas, y registro de auditoría.
- **Dictamen de ponencias** por el comité científico, con comentarios que viajan
  en el correo a la persona autora y en su idioma.
- **Formulario protegido**: un correo, un registro vigente; señuelo y tiempo
  mínimo de llenado contra envíos automatizados; y un tope de registros por red
  en 24 horas, editable desde el panel.
- **Recordatorios automáticos** 30, 7 y 1 día antes del congreso.
- **Roles**: superadministrador, organizador, científico de datos y lector.
- **Cumplimiento normativo**: aviso de privacidad y consentimiento conforme a la
  LFPDPPP (México), la LGPD (Brasil) y el RGPD (Unión Europea).

> Para desplegar paso a paso —base, aplicación, correo, Google, el trabajo
> programado y el video de fondo— está **[DESPLIEGUE.md](DESPLIEGUE.md)**.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y llenar los valores
npm run dev
```

### 1. Base de datos

1. Crear una base **PostgreSQL 16**. En DigitalOcean: *Create → Databases*.
2. Copiar su cadena de conexión a `DATABASE_URL`.
3. Cargar el esquema: `npm run esquema`, o
   `psql "$DATABASE_URL" -f basedatos/esquema.sql`. Se puede ejecutar más de
   una vez sin romper nada.
4. Dar de alta la primera cuenta del panel, que es la única que no se puede
   crear desde el propio panel:

```bash
npm run crear-usuario -- persona@ciess.org "Nombre Apellido" superadmin
```

Pide la contraseña por teclado. Si se deja vacía, la persona entra pidiendo un
enlace de acceso desde `/login`. Las demás cuentas se dan de alta en
**Panel → Usuarios del panel**.

### 2. Google Sheets y Drive

1. Crear una cuenta de servicio en Google Cloud y habilitar las API de
   **Google Sheets** y **Google Drive**.
2. Descargar la clave JSON y pasar `client_email` y `private_key` a
   `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY` (con los saltos de línea
   escapados como `\n`).
3. Crear la hoja de cálculo y la carpeta de Drive, **compartirlas como editor con
   el correo de la cuenta de servicio**, y copiar sus identificadores a
   `GOOGLE_SHEETS_ID` y `GOOGLE_DRIVE_FOLDER_ID`.

Las pestañas normalizadas se crean solas en el primer registro.

### 3. Correo (Resend)

1. Crear una cuenta en [resend.com](https://resend.com) y verificar el dominio
   del congreso.
2. Poner la clave en `RESEND_API_KEY` y el remitente en `CORREO_REMITENTE`.

Resend envía tres cosas: el acuse de registro, los enlaces de acceso al panel y
los recordatorios. Sin él, los registros se guardan igual, pero nadie recibe
aviso y sólo se puede entrar al panel con contraseña.

### 4. Despliegue

**El sitio público no necesita ninguna credencial para desplegarse.** El
formulario, las FAQs y el aviso de privacidad funcionan con las propuestas que
trae el código, y el video institucional de fondo se ve en cuanto hay un
dominio público. Sin base de datos, el panel avisa que todavía no está
conectado en lugar de fallar.

`.do/app.yaml` describe la aplicación completa para DigitalOcean App Platform,
incluidos la base y el trabajo programado de los recordatorios.
**[DESPLIEGUE.md](DESPLIEGUE.md)** lo lleva paso a paso.

### 5. Recordatorios automáticos

Un trabajo programado llama a diario a `/api/recordatorios` con `CRON_SECRET`
en la cabecera. Sin ese secreto el endpoint responde 503 en lugar de escribir a
nadie, y el panel lo avisa en **Cupos y configuración**.

## Comandos

```bash
npm run dev         # servidor de desarrollo
npm run build       # compilación de producción
npm run typecheck   # comprobación de tipos
npm run lint        # análisis estático
npm test            # pruebas de la lógica crítica
npm run sembrar 120 # 120 registros de demostración
npm run sembrar -- --borrar   # elimina sólo los registros de demostración

npx tsx guiones/generar-vista-previa.ts   # vista previa del formulario en un HTML
```

`generar-vista-previa.ts` produce `vista-previa-formulario.html`, un archivo
autocontenido que recorre el formulario con sus siete perfiles y sus tres
idiomas, sin base de datos ni servidor. Las etiquetas, las ayudas, las opciones
y la lógica de pasos salen de los módulos reales del proyecto, así que la
redacción no se desvía; sirve para que el comité revise campos y textos antes
de desplegar. No guarda datos ni envía correos.

Las pruebas cubren la normalización hacia las pestañas de Google Sheets
(incluido el cálculo de la hora de presentación del vehículo), la validación
del formulario, la correspondencia entre valores canónicos y etiquetas en los
tres idiomas, la normalización de países del mapa, la regresión de la
proyección y la sustitución de variables en las plantillas de correo.

## Estructura

```
src/
  app/                    Rutas: registro, confirmación, FAQs, aviso, login, panel y API
  componentes/            Formulario, campos, controles y componentes del panel
  i18n/                   Diccionarios es/en/pt, aviso de privacidad y FAQs
  lib/                    Configuración, perfiles, validación, opciones canónicas,
                          paleta de gráficas, conexión a PostgreSQL y Google
basedatos/esquema.sql     Esquema completo: tablas, vistas, auditoría y plantillas
pruebas/                  Pruebas de la lógica crítica
guiones/                  Sembrado de datos de demostración
```

## Operación

- **Si falla la réplica en Google Sheets**, el registro no se pierde: queda en
  la base con el error asentado y aparece en **Panel → Cupos y configuración →
  Réplica en Google Sheets**, desde donde se puede reintentar uno a uno o en
  lote.
- **Auditoría**: toda alta, modificación o baja de registros, plantillas y
  configuración queda asentada con usuario, rol, fecha y campos modificados.
- **Cupos y lista de espera**: al llenarse los lugares presenciales, los
  registros nuevos pasan automáticamente a lista de espera y reciben la
  plantilla correspondiente. Cuando se libera un lugar —porque alguien canceló
  o porque se amplió el aforo— la lista aparece en **Panel → Cupos y
  configuración** en orden de llegada, y desde ahí se confirma a la siguiente
  persona. El servidor vuelve a comprobar el cupo antes de asignar el lugar, de
  modo que dos organizadores no puedan confirmar al mismo tiempo por encima del
  aforo.
- **Estados**: cada registro es *en proceso*, *confirmado*, *en lista de espera*
  o *cancelado*. Sólo se ofrecen las transiciones que tienen sentido, y cada
  cambio puede avisar al participante por correo en su idioma con la plantilla
  correspondiente. Todo queda asentado en la auditoría.

- **Dictamen de ponencias**: en **Panel → Dictamen de ponencias** aparecen sólo
  los registros que traen propuesta, en orden de llegada y con el resumen a la
  vista. Cada propuesta puede quedar *sin dictamen*, *en revisión*, *aceptada*,
  *aceptada con cambios* o *no aceptada*; las dos últimas exigen comentarios,
  que son lo que la persona autora recibe por correo. El dictamen es
  independiente del registro: no aceptar una ponencia no cancela la
  inscripción.
- **Protección del formulario público**: un correo sólo puede tener un registro
  vigente —cancelar lo libera—, un campo señuelo invisible y un tiempo mínimo de
  llenado descartan los envíos automatizados, y un tope por red (20 en 24 h por
  omisión, editable en **Cupos y configuración**) frena los flujos masivos sin
  estorbar a una institución que inscribe a todo su equipo desde la misma red.
  De la dirección de origen se guarda sólo una huella irreversible, durante 24
  horas, y así se declara en el aviso de privacidad. Conviene fijar
  `ANTIABUSO_SAL` en el despliegue.
- **Recordatorios**: un cron diario envía el recordatorio que corresponde al día
  —30, 7 o 1 día antes, ajustable desde el panel— a quien tenga el registro
  vigente. La ventana admite un día de retraso para que una ejecución fallida no
  se pierda, y cada envío queda asentado, de modo que nadie recibe dos veces el
  mismo aviso.

## Todo el contenido se edita desde el panel

El sistema arranca con **propuestas** del equipo de desarrollo para que nada
quede bloqueado esperando información. Todas se sustituyen desde el panel, sin
tocar el código ni volver a desplegar.

| Qué | Dónde se edita | Propuesta inicial |
|---|---|---|
| Nombre, sede y fechas del congreso | Panel → Cupos y configuración | CIESS, Ciudad de México · 11, 12 y 13 de noviembre de 2026 |
| Límites de semblanza, resumen y fotografía | Panel → Cupos y configuración | 60 palabras · 2 000 caracteres · 10 MB |
| Cupos, fecha límite, agenda y correo de contacto | Panel → Cupos y configuración | 300 presenciales · en línea sin límite |
| Video de fondo del login y del formulario | Panel → Cupos y configuración | Video institucional del congreso, al 15 % |
| Ejes temáticos | Panel → Contenido del sitio | 6 ejes propuestos, en los tres idiomas |
| Preguntas frecuentes | Panel → Contenido del sitio | 20 preguntas, en los tres idiomas |
| Aviso de privacidad | Panel → Contenido del sitio (superadmin) | 10 apartados conforme a LFPDPPP, LGPD y RGPD |
| Plantillas de correo | Panel → Plantillas de correo | 3 plantillas × 3 idiomas |
| Perfiles de participación | Tabla `perfiles` | 7 perfiles |

**Cómo funciona el respaldo.** Las propuestas viven en el código
(`src/lib/contenido.ts`, `src/i18n/faqs.ts`, `src/i18n/aviso-privacidad.ts`) y se
usan mientras las tablas estén vacías, de modo que el sitio funciona desde el
primer arranque. En **Panel → Contenido del sitio**, el botón
**Sembrar propuestas** las copia a la base y a partir de ahí quedan editables.
La operación es idempotente: no pisa lo que ya se haya editado.

En el editor, una pestaña de idioma en ámbar señala que ese idioma todavía no
está traducido.

## Sigue pendiente de confirmación

Nada bloquea el desarrollo, pero conviene revisar antes de abrir el registro:

- Sede y fechas definitivas (hoy es una propuesta).
- Ejes temáticos definitivos contra la convocatoria oficial.
- Validación jurídica del aviso de privacidad.
- Respuestas de FAQs marcadas como **provisionales** en el editor.
- Agenda final, que sustituirá al PDF de la convocatoria.
