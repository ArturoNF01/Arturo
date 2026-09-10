# Arranque en las cuentas institucionales

Plan para rehacer el despliegue en las cuentas institucionales del CIESS, con
el dominio `ciess.org`. Escrito para retomarlo en frío.

---

## 1 · Qué se conserva y qué se rehace

| | |
|---|---|
| **Se conserva** | El código. Es lo único que hay que llevarse: nada del sistema depende de la cuenta desde la que se desplegó. |
| **Se rehace** | Repositorio, aplicación, base, Resend y la cuenta de servicio de Google. Son minutos, no horas. |
| **No hay que rescatar nada** | El panel nunca llegó a conectarse, así que no quedaron registros reales en ninguna base. Se empieza con la base vacía, que es lo que se quiere. |

Del despliegue anterior **no hace falta exportar nada**. Si quedó algún registro
de prueba, se descarta.

---

## 2 · Orden del día

Cada paso depende del anterior. En un rato tranquilo son unos 45 minutos.

### 2.1 · Repositorio institucional

1. Crear el repositorio en la organización del CIESS. Vacío, sin README.
2. Copiar el código:

   ```bash
   git clone https://github.com/ArturoNF01/Arturo.git congreso
   cd congreso
   git remote set-url origin https://github.com/desarrollos-ciess/congreso-dss.git
   git push -u origin master
   ```

   Así viaja todo el historial. Si se prefiere empezar sin historial, basta
   copiar los archivos a un repositorio nuevo y hacer un primer commit.

3. Dar acceso al equipo que vaya a mantenerlo.

### 2.2 · La base

1. **Create → Databases**, PostgreSQL 16, región NYC, el plan más pequeño.
2. Copiar la cadena de *Connection Details*.
3. Cargar el esquema: `psql "LA_CADENA" -f basedatos/esquema.sql`.

### 2.3 · La aplicación

1. **Create → Apps**, origen GitHub, el repositorio nuevo, rama `master`.
2. Variables de entorno:

   ```
   DATABASE_URL          (la cadena del paso anterior)
   NEXT_PUBLIC_URL_SITIO
   CRON_SECRET           (cadena larga al azar)
   ANTIABUSO_SAL         (otra cadena larga al azar)
   ```

3. **Create Resources.** Sale una URL `…ondigitalocean.app` que ya sirve.
4. Abrir `/diagnostico`: dirá qué falta.
5. Dar de alta la primera cuenta del panel:

   ```bash
   DATABASE_URL="LA_CADENA" npm run crear-usuario -- \
     persona@ciess.org "Nombre" superadmin
   ```

### 2.4 · Correo

1. Cuenta de Resend con el correo institucional.
2. **Domains → Add domain** → `ciess.org`.
3. Resend da tres registros DNS (DKIM, SPF y uno de seguimiento). Se añaden
   donde esté el DNS del dominio. La verificación tarda de minutos a unas horas.
4. En App Platform:

   ```
   RESEND_API_KEY
   CORREO_REMITENTE=Congreso CIESS <congreso@ciess.org>
   CORREO_CONTACTO=congreso@ciess.org
   ```

   El correo de contacto también se edita desde el panel, así que se puede
   cambiar después sin volver a desplegar.

### 2.5 · Google Sheets y Drive

Con la cuenta institucional de Google:

1. Google Cloud → proyecto nuevo → habilitar **Google Sheets API** y **Google
   Drive API**.
2. Crear una **cuenta de servicio** y descargar su clave JSON.
3. Crear la hoja y la carpeta de Drive en la unidad del CIESS, y **compartirlas
   como editor con el correo de la cuenta de servicio**. Sin esto no funciona.
4. En App Platform: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (con los
   saltos de línea escapados como `\n`), `GOOGLE_SHEETS_ID`,
   `GOOGLE_DRIVE_FOLDER_ID`.

### 2.6 · Dominio del sitio

El sitio vive en `congreso-dss.ciess.org`. En App Platform, *Settings →
Domains → Add Domain*. Como el DNS de `ciess.org` ya está en esta cuenta de
DigitalOcean, el registro se crea solo y el certificado se emite sin
intervención.

Después, poner `NEXT_PUBLIC_URL_SITIO` con esa dirección para que los enlaces
de los correos apunten bien.

---

## 3 · Qué cuesta cada cosa

Esto es lo que conviene llevar a quien aprueba el presupuesto. Precios de
lista, por mes.

| Servicio | Qué es | Costo |
|---|---|---|
| **App Platform** | La aplicación. El contenedor más pequeño sobra. | ~5 USD |
| **PostgreSQL gestionado** | La base, con respaldos automáticos y sin pausas. | ~15 USD |
| **Spaces** | Sólo si el video se sirve desde aquí. | 5 USD |
| **Resend** | 3 000 correos al mes y **100 al día** gratis. El límite diario es
  el que estorba: confirmar a 300 personas o mandarles un recordatorio el mismo
  día pasa de 100. | 0 o 20 USD |
| **Google Workspace** | Ya lo tiene el CIESS. | 0 |

**Unos 20 USD al mes**, sobre la cuenta de DigitalOcean que el CIESS ya paga, y
25 si hace falta el plan de correo. Es menos de la mitad de lo que costaría
repartirlo entre un proveedor de aplicación y otro de base, y todo queda en
una sola factura.

Si el presupuesto de correo no sale, los recordatorios se pueden repartir en
varios días: el sistema ya envía por lotes y basta ajustar el tamaño para
respetar los 100 diarios.

---

## 4 · Qué hay que decidir antes de empezar

Nada de esto bloquea el despliegue —el sistema arranca con propuestas y todo se
edita después desde el panel— pero conviene traerlo resuelto:

1. ~~Organización y nombre del repositorio~~ · resuelto:
   `desarrollos-ciess/congreso-dss`.
2. ~~Dirección del sitio~~ · resuelto: `congreso-dss.ciess.org`.
3. **Buzón del congreso**: ¿`congreso@ciess.org`? Es el que verán los
   participantes como remitente y como contacto.
4. **Quién entra al panel** y con qué rol: superadministrador, organizador,
   científico de datos, lector.
5. **Dónde vivirá el video de fondo**. El actual está en `home.ciess.org` y
   conviene moverlo a un lugar del que no dependa: un Space de DigitalOcean, o
   la carpeta `public/` del proyecto si pesa poco.

---

## 5 · Lo que sigue pendiente del congreso

Independiente de la migración, y todo editable desde el panel:

- Sede y fechas definitivas (hoy hay una propuesta).
- Ejes temáticos contra la convocatoria oficial.
- Validación jurídica del aviso de privacidad.
- Las FAQs marcadas como **provisionales** en el editor.
- La agenda definitiva, que sustituirá al PDF de la convocatoria.
- Cupo presencial real y fecha límite de registro.
