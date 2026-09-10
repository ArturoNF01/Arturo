# Cómo poner el sitio en línea

Esta guía va paso a paso. Empieza por lo que se puede hacer sin ninguna
credencial y termina con el panel funcionando.

---

## Antes de empezar: qué necesita cada cosa

| Para que funcione | Hace falta |
|---|---|
| Formulario, FAQs, aviso de privacidad, video de fondo | **nada** |
| Guardar registros, panel de control, login | Supabase |
| Correos de confirmación y recordatorio | Resend |
| Réplica en Google Sheets y fotos en Drive | cuenta de servicio de Google |
| Recordatorios automáticos | `CRON_SECRET` + un cron |

El sitio **se despliega y se ve completo sin ninguna credencial**: el formulario
funciona con las propuestas del código y el panel avisa que todavía no está
conectado, en lugar de fallar. Se pueden ir añadiendo las piezas después.

---

## Paso 1 · Publicar el sitio

### Opción A · Vercel (la recomendada)

Es donde el proyecto ya está preparado: `vercel.json` trae programado el cron de
los recordatorios y no hay que adaptar nada.

1. Entrar a [vercel.com/new](https://vercel.com/new) con la cuenta de GitHub.
2. **Import** en el repositorio `ArturoNF01/Arturo`.
3. Vercel reconoce Next.js solo. No tocar la configuración de compilación.
4. Si la rama de trabajo todavía no está fusionada, en *Settings → Git →
   Production Branch* poner `claude/congreso-registration-system-d6r396`.
5. **Deploy.** En un par de minutos hay una URL `…vercel.app` pública.

### Opción B · Cloudflare

Se puede, pero hay que ser claro sobre el costo: Cloudflare no ejecuta Next.js
de forma nativa, hace falta el adaptador **OpenNext**, y la réplica en Google
Sheets usa `googleapis`, una biblioteca pesada pensada para Node que en Workers
hay que sustituir por llamadas directas a la API REST firmadas con Web Crypto.
Es trabajo real, no un cambio de casilla.

Recomendación honesta: **publicar en Vercel y usar Cloudflare para el dominio**
(paso 2). Se obtiene lo mejor de los dos sin reescribir nada. Si aun así se
prefiere alojar en Cloudflare, el camino es:

1. `npm i -D @opennextjs/cloudflare wrangler`
2. Crear `wrangler.jsonc` con `nodejs_compat` en `compatibility_flags` y una
   `compatibility_date` reciente.
3. Sustituir la réplica en Sheets por llamadas REST firmadas (queda pendiente:
   dígamelo y lo hago).
4. Pasar el cron de `vercel.json` a un **Cron Trigger** de Cloudflare que llame
   a `/api/recordatorios` con la cabecera `Authorization: Bearer <CRON_SECRET>`.
5. `npx opennextjs-cloudflare build && npx wrangler deploy`

---

## Paso 2 · El dominio, con Cloudflare

Sirve igual si el sitio está en Vercel.

1. En Cloudflare, **Add a site** y escribir el dominio (por ejemplo
   `congreso.ciss-bienestar.org`). Cloudflare da dos servidores de nombres.
2. Cambiar los servidores de nombres del dominio donde esté registrado, a los
   que dio Cloudflare. Tarda de minutos a unas horas.
3. En Vercel: *Settings → Domains → Add*, escribir el dominio. Vercel dirá qué
   registro hay que crear.
4. En Cloudflare, *DNS → Add record*, con lo que pidió Vercel:
   - dominio raíz → registro **A** a la dirección que indique Vercel;
   - subdominio (`congreso`) → registro **CNAME** a `cname.vercel-dns.com`.
5. **Importante**: poner la nube en **gris** (*DNS only*) en ese registro. En
   naranja, Cloudflare hace de intermediario y choca con el certificado de
   Vercel.
6. Esperar a que Vercel marque el dominio como *Valid*.
7. Poner `NEXT_PUBLIC_URL_SITIO` con el dominio definitivo, para que los enlaces
   de edición de los correos apunten bien.

---

## Paso 3 · Supabase, para encender el panel

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor → New query**, pegar entero el archivo
   [`supabase/todas-las-migraciones.sql`](supabase/todas-las-migraciones.sql) y
   darle **Run**. Son las siete migraciones en orden, en un solo archivo; se
   puede ejecutar más de una vez sin romper nada. (Si se prefiere, también
   están sueltas en `supabase/migrations/`, de la `0001` a la `0007`.)
3. En **Settings → API**, copiar: *Project URL*, *anon public* y
   *service_role*.
4. En Vercel, *Settings → Environment Variables*, añadir:

   ```
   NEXT_PUBLIC_SUPABASE_URL=…
   NEXT_PUBLIC_SUPABASE_ANON_KEY=…
   SUPABASE_SERVICE_ROLE_KEY=…      ← nunca en el navegador
   NEXT_PUBLIC_URL_SITIO=https://…
   ```

5. Crear la cuenta del panel: **Authentication → Users → Add user**, con correo
   y contraseña. Copiar el **UUID** que aparece.
6. En **SQL Editor**, darla de alta con su rol:

   ```sql
   insert into usuarios_panel (id, correo, nombre, rol)
   values ('<uuid del paso anterior>', 'persona@ciss-bienestar.org', 'Nombre', 'superadmin');
   ```

7. Volver a desplegar en Vercel (*Deployments → ⋯ → Redeploy*) para que tome las
   variables.

---

## Paso 4 · Correos

1. Cuenta en [resend.com](https://resend.com) y verificar el dominio del
   congreso (Resend indica los registros DNS; se añaden en Cloudflare igual que
   en el paso 2).
2. Añadir en Vercel:

   ```
   RESEND_API_KEY=…
   CORREO_REMITENTE=Congreso CIESS <congreso@ciss-bienestar.org>
   ```

---

## Paso 5 · Google Sheets y Drive

1. En Google Cloud, crear un proyecto y habilitar **Google Sheets API** y
   **Google Drive API**.
2. Crear una **cuenta de servicio** y descargar su clave JSON.
3. Crear la hoja de cálculo y la carpeta de Drive, y **compartirlas como editor
   con el correo de la cuenta de servicio** (el que termina en
   `.iam.gserviceaccount.com`). Sin este paso nada funciona.
4. Añadir en Vercel:

   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=…
   GOOGLE_PRIVATE_KEY=…          ← con los saltos de línea escapados como \n
   GOOGLE_SHEETS_ID=…            ← el tramo largo de la URL de la hoja
   GOOGLE_DRIVE_FOLDER_ID=…      ← el tramo final de la URL de la carpeta
   ```

Las pestañas normalizadas (`REG`, `PAR`, `ALO`, `TRA`, `PSE`, `ALI`) se crean
solas con el primer registro.

---

## Paso 6 · Recordatorios y protección del formulario

```
CRON_SECRET=<una cadena larga al azar>
ANTIABUSO_SAL=<otra cadena larga al azar>
```

En Vercel el cron ya está programado en `vercel.json` (14:00 UTC, 8:00 en Ciudad
de México). En Cloudflare hay que crear el Cron Trigger a mano, como se explica
en el paso 1B. El panel avisa en **Cupos y configuración** si falta
`CRON_SECRET`.

---

## Paso 7 · El video de fondo

El video se muestra al 15 % en el login y en el formulario, y su dirección se
edita desde **Panel → Cupos y configuración**. Ahí mismo hay un botón
**Probar el video** que lo carga en pequeño y dice si el navegador pudo
reproducirlo.

Si no se ve, casi siempre es una de estas tres:

1. **Se está mirando la vista previa publicada como artefacto.** Ahí nunca se
   verá: esa página bloquea los archivos multimedia externos. Hay que mirar el
   sitio desplegado.
2. **El servidor del archivo bloquea enlaces externos.** Muchos WordPress lo
   hacen. Se comprueba abriendo la dirección del `.mp4` en una pestaña nueva: si
   ahí no se reproduce, tampoco lo hará en el sitio.
3. **La dirección cambió o el archivo no está publicado.**

La forma segura de resolverlo, y la recomendada, es **servir el video desde el
propio sitio**:

- **Con el proyecto**: copiar el archivo a `public/video-congreso.mp4` y poner
  `/video-congreso.mp4` como dirección en el panel. Conviene sólo si el archivo
  pesa poco (menos de ~20 MB); el repositorio crece con él.
- **Cloudflare R2**: crear un bucket, subir el `.mp4`, activar el acceso público
  y pegar la URL que da R2. Es lo mejor para un archivo grande y va incluido en
  el plan gratuito hasta 10 GB.
- **Cloudflare Stream** si se quiere reproducción adaptativa; es de pago.

Formato: **MP4 con H.264 y AAC** es el que reproducen todos los navegadores. Un
`.mov` grande conviene convertirlo. Como es un fondo silenciado, se puede
comprimir sin piedad: 1280 px de ancho y una tasa baja bastan.

---

## Cómo saber qué falta, en cualquier momento

El sitio trae una pantalla de diagnóstico en **`/diagnostico`** que dice, pieza
por pieza, qué está configurado y cuál es el siguiente paso: las variables de
entorno (sólo si están puestas, nunca su valor), qué migraciones se ejecutaron
y si ya hay alguna cuenta dada de alta en el panel.

Mientras Supabase no esté conectado se puede abrir sin sesión —la página de
acceso ya enlaza a ella—; en cuanto hay base de datos, pide sesión de
superadministrador.

## Comprobación final

1. Abrir el sitio: el formulario carga y el video se ve de fondo.
2. Registrarse a modo de prueba: llega el correo y aparece el folio.
3. Entrar al panel: el registro está ahí.
4. Revisar la hoja de Google: la fila también está.
5. En **Cupos y configuración**, sustituir las propuestas por los datos
   definitivos del congreso.
6. Borrar los registros de prueba antes de abrir el registro al público.
