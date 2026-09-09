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

## Estructura

```
src/
  app/                    Rutas: registro, confirmación, FAQs, aviso, login, panel y API
  componentes/            Formulario, campos, controles y componentes del panel
  i18n/                   Diccionarios es/en/pt, aviso de privacidad y FAQs
  lib/                    Configuración, perfiles, validación, opciones canónicas,
                          paleta de gráficas y clientes de Supabase y Google
supabase/migrations/      Esquema, políticas RLS, auditoría y plantillas
```

## Pendiente de confirmar con el comité organizador

Los siguientes valores están marcados como provisionales en el código:

- Sede y fechas exactas del congreso (`src/lib/config.ts`).
- Ejes temáticos definitivos (`src/lib/config.ts`).
- Agenda final, que sustituirá al PDF de la convocatoria (editable desde
  **Panel → Cupos y configuración**).
- Validación jurídica del aviso de privacidad (`src/i18n/aviso-privacidad.ts`).
- Respuestas de FAQs marcadas como provisionales (`src/i18n/faqs.ts`).
