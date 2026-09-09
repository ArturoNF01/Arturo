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
- **Almacenamiento sincronizado**: Supabase como base principal y Google Sheets
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
- **Roles**: superadministrador, organizador, científico de datos y lector.
- **Cumplimiento normativo**: aviso de privacidad y consentimiento conforme a la
  LFPDPPP (México), la LGPD (Brasil) y el RGPD (Unión Europea).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y llenar los valores
npm run dev
```

### 1. Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Ejecutar en el editor SQL, en orden:
   - `supabase/migrations/0001_esquema_inicial.sql`
   - `supabase/migrations/0002_plantillas_y_sql_lectura.sql`
3. Copiar a `.env.local` la URL del proyecto, la clave anónima y la clave de
   servicio (`SUPABASE_SERVICE_ROLE_KEY`, sólo del lado del servidor).
4. Crear las cuentas del panel en **Authentication → Users** y darles de alta en
   la tabla `usuarios_panel` con el rol que corresponda:

```sql
insert into usuarios_panel (id, correo, nombre, rol)
values ('<uuid del usuario de auth>', 'persona@ciess.org', 'Nombre', 'superadmin');
```

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

### 4. Despliegue en Vercel

Importar el repositorio, cargar las mismas variables de entorno y fijar
`NEXT_PUBLIC_URL_SITIO` al dominio definitivo.

## Comandos

```bash
npm run dev         # servidor de desarrollo
npm run build       # compilación de producción
npm run typecheck   # comprobación de tipos
npm run lint        # análisis estático
npm test            # pruebas de la lógica crítica
npm run sembrar 120 # 120 registros de demostración en Supabase
npm run sembrar -- --borrar   # elimina sólo los registros de demostración
```

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
                          paleta de gráficas y clientes de Supabase y Google
supabase/migrations/      Esquema, políticas RLS, auditoría y plantillas
pruebas/                  Pruebas de la lógica crítica
guiones/                  Sembrado de datos de demostración
```

## Operación

- **Si falla la réplica en Google Sheets**, el registro no se pierde: queda en
  Supabase con el error asentado y aparece en **Panel → Cupos y configuración →
  Réplica en Google Sheets**, desde donde se puede reintentar uno a uno o en
  lote.
- **Auditoría**: toda alta, modificación o baja de registros, plantillas y
  configuración queda asentada con usuario, rol, fecha y campos modificados.
- **Cupos**: al llenarse los lugares presenciales, los registros nuevos pasan
  automáticamente a lista de espera y reciben la plantilla correspondiente.

## Todo el contenido se edita desde el panel

El sistema arranca con **propuestas** del equipo de desarrollo para que nada
quede bloqueado esperando información. Todas se sustituyen desde el panel, sin
tocar el código ni volver a desplegar.

| Qué | Dónde se edita | Propuesta inicial |
|---|---|---|
| Nombre, sede y fechas del congreso | Panel → Cupos y configuración | CIESS, Ciudad de México · 3, 4 y 5 de junio de 2026 |
| Límites de semblanza, resumen y fotografía | Panel → Cupos y configuración | 60 palabras · 2 000 caracteres · 10 MB |
| Cupos, fecha límite, agenda y correo de contacto | Panel → Cupos y configuración | 300 presenciales · en línea sin límite |
| Ejes temáticos | Panel → Contenido del sitio | 6 ejes propuestos, en los tres idiomas |
| Preguntas frecuentes | Panel → Contenido del sitio | 20 preguntas, en los tres idiomas |
| Aviso de privacidad | Panel → Contenido del sitio (superadmin) | 10 apartados conforme a LFPDPPP, LGPD y RGPD |
| Plantillas de correo | Panel → Plantillas de correo | 3 plantillas × 3 idiomas |
| Perfiles de participación | Tabla `perfiles` de Supabase | 7 perfiles |

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
