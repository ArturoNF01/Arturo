# Cómo poner el sitio en línea

El sistema vive entero en DigitalOcean: la aplicación en **App Platform** y la
base en **PostgreSQL gestionado**. No hace falta administrar ningún servidor.

---

## Antes de empezar: qué necesita cada cosa

| Para que funcione | Hace falta |
|---|---|
| Formulario, FAQs, aviso de privacidad, video de fondo | **nada** |
| Guardar registros, panel de control, acceso | PostgreSQL |
| Correos de confirmación, acceso y recordatorio | Resend |
| Réplica en Google Sheets y fotos en Drive | cuenta de servicio de Google |
| Recordatorios automáticos | `CRON_SECRET` + el trabajo programado |

El sitio **se despliega y se ve completo sin ninguna credencial**: el formulario
funciona con las propuestas del código y el panel avisa que todavía no está
conectado, en lugar de fallar. Las piezas se añaden después, en cualquier orden.

En cualquier momento, **`/diagnostico`** dice qué falta y cuál es el siguiente
paso.

---

## Paso 1 · La base de datos

1. En DigitalOcean: **Create → Databases**.
2. Motor **PostgreSQL 16**. Región **NYC** (la misma que la aplicación).
3. Plan: el más pequeño —1 vCPU y 1 GB— sostiene de sobra un congreso. Se puede
   subir después sin tiempo de inactividad.
4. Nombre: `congreso-bd`. **Create**.
5. Cuando termine, en **Connection Details** elegir *Connection string* y
   copiarla. Tiene esta forma:

   ```
   postgresql://doadmin:CLAVE@congreso-bd-do-user-….db.ondigitalocean.com:25060/defaultdb?sslmode=require
   ```

6. Cargar el esquema. Desde una terminal con `psql` instalado:

   ```bash
   psql "LA_CADENA_DE_CONEXION" -v ON_ERROR_STOP=1 -f basedatos/esquema.sql
   ```

   Si no hay `psql` a mano, sirve la consola que trae el propio panel de la base
   (**Console**): pegar ahí el contenido de `basedatos/esquema.sql`. El archivo
   se puede ejecutar más de una vez sin romper nada.

---

## Paso 2 · La aplicación

1. **Create → Apps**.
2. Origen **GitHub**, elegir el repositorio y la rama `master`. Autorizar el
   acceso si es la primera vez.
3. App Platform reconoce Next.js solo. No hay que tocar los comandos.
4. En **Environment Variables**, añadir:

   ```
   DATABASE_URL          = la cadena del paso 1
   NEXT_PUBLIC_URL_SITIO = https://congreso-dss.ciess.org
   CRON_SECRET           = una cadena larga al azar
   ANTIABUSO_SAL         = otra cadena larga al azar
   ```

   `DATABASE_URL` conviene marcarla como **encrypted**.

5. Plan **Basic**, el contenedor más pequeño. **Create Resources**.
6. En unos minutos hay una URL `…ondigitalocean.app`. Abrir `/registro`: el
   formulario funciona. El dominio definitivo se conecta en el paso 7.

> El archivo `.do/app.yaml` describe esta misma aplicación, incluido el trabajo
> programado de los recordatorios. Se puede importar en lugar de configurarlo a
> mano: **Create App → … → Edit App Spec**, o `doctl apps create --spec
> .do/app.yaml`. Antes hay que sustituir `ORGANIZACION/REPOSITORIO`.

---

## Paso 3 · La primera cuenta del panel

Sin ninguna cuenta no hay con quién entrar, y las demás se crean desde el panel.
La primera se da de alta desde la terminal, con el repositorio clonado:

```bash
npm install
DATABASE_URL="LA_CADENA_DE_CONEXION" npm run crear-usuario -- \
  persona@ciess.org "Nombre Apellido" superadmin
```

Pide la contraseña por teclado —no queda en el historial— y admite dejarla
vacía: entonces la persona entra pidiendo un enlace de acceso desde `/login`,
lo que requiere tener el correo ya configurado (paso 4).

Con esa cuenta, en **Panel → Usuarios del panel** se dan de alta las demás sin
volver a tocar la terminal.

---

## Paso 4 · Correo

1. Cuenta en [resend.com](https://resend.com) con el correo institucional.
2. **Domains → Add domain** → `ciess.org`.
3. Resend da tres registros DNS. Se añaden donde esté el DNS del dominio —en
   DigitalOcean, **Networking → Domains → ciess.org**—. La verificación tarda
   de minutos a unas horas.
4. En App Platform, añadir:

   ```
   RESEND_API_KEY   = re_…
   CORREO_REMITENTE = Congreso CIESS <congreso@ciess.org>
   CORREO_CONTACTO  = congreso@ciess.org
   ```

---

## Paso 5 · Google Sheets y Drive

1. Google Cloud → proyecto nuevo → habilitar **Google Sheets API** y **Google
   Drive API**.
2. Crear una **cuenta de servicio** y descargar su clave JSON.
3. Crear la hoja y la carpeta de Drive, y **compartirlas como editor con el
   correo de la cuenta de servicio** (el que termina en
   `.iam.gserviceaccount.com`). Sin este paso nada funciona.
4. En App Platform:

   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL = …@….iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY           = con los saltos de línea escapados como \n
   GOOGLE_SHEETS_ID             = el tramo largo de la URL de la hoja
   GOOGLE_DRIVE_FOLDER_ID       = el tramo final de la URL de la carpeta
   ```

Las pestañas normalizadas (`REG`, `PAR`, `ALO`, `TRA`, `PSE`, `ALI`) se crean
solas con el primer registro.

---

## Paso 6 · Los recordatorios

Si la aplicación se creó desde `.do/app.yaml`, el trabajo programado ya está.
Si se configuró a mano:

1. En la aplicación: **Create → Job**, del mismo repositorio.
2. Tipo **Scheduled**, con la expresión `0 8 * * *` y zona horaria
   `America/Mexico_City`.
3. Comando:

   ```bash
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/recordatorios"
   ```

4. Darle las variables `CRON_SECRET` y `APP_URL`.

Desde **Panel → Cupos y configuración** se ajusta la antelación de cada
recordatorio, se desactivan y se puede disparar uno a mano.

---

## Paso 7 · El dominio

El sitio vive en **`congreso-dss.ciess.org`**.

1. En App Platform: **Settings → Domains → Add Domain**.
2. Escribir `congreso-dss.ciess.org` y elegir **We manage your domain**: el DNS
   de `ciess.org` ya está en esta misma cuenta de DigitalOcean, así que el
   registro se crea solo.
3. El certificado se emite sin intervención. Tarda unos minutos.
4. Comprobar que `NEXT_PUBLIC_URL_SITIO` vale `https://congreso-dss.ciess.org`.

Si se importó `.do/app.yaml`, el dominio ya viene descrito ahí y este paso
está hecho.

---

## Paso 8 · El video de fondo

El video se muestra al 15 % en el acceso y en el formulario, y su dirección se
edita desde **Panel → Cupos y configuración**, donde además hay un botón
**Probar el video** que lo carga y dice si el navegador pudo reproducirlo.

Si no se ve, casi siempre es una de estas tres:

1. **El servidor del archivo bloquea enlaces externos.** Muchos WordPress lo
   hacen. Se comprueba abriendo la dirección del `.mp4` en una pestaña nueva.
2. **La dirección cambió** o el archivo no está publicado.
3. Se está mirando una vista previa que bloquea el multimedia externo.

Lo seguro es servirlo desde infraestructura propia: **DigitalOcean Spaces**
(crear un Space, subir el `.mp4`, marcarlo público y pegar su URL) o la carpeta
`public/` del proyecto si el archivo es pequeño.

Formato: **MP4 con H.264 y AAC**. Como es un fondo silenciado, se puede
comprimir sin piedad: 1280 px de ancho basta.

---

## Comprobación final

1. `https://congreso-dss.ciess.org/registro` carga y el video se ve de fondo.
2. Registrarse de prueba: llega el correo y aparece el folio.
3. Entrar al panel: el registro está ahí.
4. La fila también está en la hoja de Google.
5. `/diagnostico` no reporta nada pendiente.
6. En **Cupos y configuración**, sustituir las propuestas por los datos
   definitivos del congreso.
7. Borrar los registros de prueba antes de abrir el registro al público.
