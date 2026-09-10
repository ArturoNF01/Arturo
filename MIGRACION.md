# Arranque en las cuentas institucionales

Plan para rehacer el despliegue en las cuentas institucionales del CIESS, con
el dominio `ciess.org`. Escrito para retomarlo en frío.

---

## 1 · Qué se conserva y qué se rehace

| | |
|---|---|
| **Se conserva** | El código. Es lo único que hay que llevarse: nada del sistema depende de la cuenta desde la que se desplegó. |
| **Se rehace** | Repositorio, Vercel, Supabase, Resend y la cuenta de servicio de Google. Son minutos, no horas. |
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
   git remote set-url origin https://github.com/<ORGANIZACION>/<REPO>.git
   git push -u origin master
   ```

   Así viaja todo el historial. Si se prefiere empezar sin historial, basta
   copiar los archivos a un repositorio nuevo y hacer un primer commit.

3. Dar acceso al equipo que vaya a mantenerlo.

### 2.2 · Vercel

1. Entrar a Vercel con la **cuenta institucional** y crear un equipo del CIESS.
2. **Add New → Project → Import** el repositorio nuevo.
3. Framework **Next.js** (lo detecta solo), sin variables de entorno todavía.
4. **Deploy.** Sale una URL `…vercel.app` que ya sirve para probar.

### 2.3 · Supabase

1. Nueva organización con la cuenta institucional. Proyecto `congreso-ciess`.
2. **SQL Editor → New query**, pegar entero `supabase/todas-las-migraciones.sql`
   y **Run**. Son las siete migraciones en orden; se puede repetir sin romper
   nada.
3. **Settings → API** → copiar *Project URL*, *anon public* y *service_role*.
4. En Vercel, *Settings → Environment Variables*:

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_URL_SITIO
   CRON_SECRET          (cadena larga al azar)
   ANTIABUSO_SAL        (otra cadena larga al azar)
   ```

5. Redesplegar y abrir `/diagnostico`: dirá qué falta.
6. Crear la cuenta del panel en **Authentication → Users** (con *Auto Confirm
   User*), copiar su UUID y darla de alta:

   ```sql
   insert into usuarios_panel (id, correo, nombre, rol)
   values ('<uuid>', '<persona>@ciess.org', '<Nombre>', 'superadmin');
   ```

### 2.4 · Correo

1. Cuenta de Resend con el correo institucional.
2. **Domains → Add domain** → `ciess.org`.
3. Resend da tres registros DNS (DKIM, SPF y uno de seguimiento). Se añaden
   donde esté el DNS del dominio. La verificación tarda de minutos a unas horas.
4. En Vercel:

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
4. En Vercel: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (con los
   saltos de línea escapados como `\n`), `GOOGLE_SHEETS_ID`,
   `GOOGLE_DRIVE_FOLDER_ID`.

### 2.6 · Dominio del sitio

Decidir bajo qué dirección vivirá el registro: por ejemplo
`congreso.ciess.org`. En Vercel, *Settings → Domains → Add*, y crear en
el DNS el registro que pida. Si el DNS está en Cloudflare, la nube va en
**gris** (*DNS only*): en naranja choca con el certificado de Vercel.

Después, poner `NEXT_PUBLIC_URL_SITIO` con esa dirección para que los enlaces
de los correos apunten bien.

---

## 3 · Qué cuesta cada cosa

Esto es lo que conviene llevar a quien aprueba el presupuesto. Precios de
lista, por mes.

| Servicio | Gratis alcanza para | Cuándo hay que pagar | Costo |
|---|---|---|---|
| **Vercel** | Probar | El plan Hobby es **sólo para uso no comercial**. Un sitio institucional necesita **Pro**. | 20 USD por persona |
| **Supabase** | 500 MB y 2 proyectos | El plan gratuito **pausa el proyecto tras una semana sin uso** y no trae respaldos diarios. Para un registro en marcha, **Pro**. | 25 USD |
| **Resend** | 3 000 correos al mes, **100 al día** | El límite diario es el que estorba: confirmar a 300 personas o mandarles un recordatorio el mismo día pasa de 100. | 20 USD |
| **Cloudflare** | DNS, y 10 GB en R2 para el video | Sólo si el video pesa mucho más | 0 |
| **Google Workspace** | Ya lo tiene el CIESS | — | 0 |

**Total si se paga todo: unos 65 USD al mes**, mientras dure el registro del
congreso. Se puede bajar:

- Sin Supabase Pro, hay que entrar al panel al menos una vez por semana para
  que el proyecto no se pause. Arriesgado en un registro abierto al público.
- Sin Resend Pro, los recordatorios hay que repartirlos en varios días. El
  sistema ya envía por lotes; se puede ajustar el tamaño para respetar los 100
  diarios —dígamelo y lo dejo configurado.

---

## 4 · Qué hay que decidir antes de empezar

Nada de esto bloquea el despliegue —el sistema arranca con propuestas y todo se
edita después desde el panel— pero conviene traerlo resuelto:

1. **Organización y nombre del repositorio** en GitHub.
2. **Dirección del sitio**: ¿`congreso.ciess.org`? ¿otra?
3. **Buzón del congreso**: ¿`congreso@ciess.org`? Es el que verán los
   participantes como remitente y como contacto.
4. **Quién entra al panel** y con qué rol: superadministrador, organizador,
   científico de datos, lector.
5. **Dónde vivirá el video de fondo**. El actual está en `home.ciess.org` y
   conviene moverlo a un lugar del que no dependa: Cloudflare R2, o la carpeta
   `public/` del proyecto si pesa poco.

---

## 5 · Lo que sigue pendiente del congreso

Independiente de la migración, y todo editable desde el panel:

- Sede y fechas definitivas (hoy hay una propuesta).
- Ejes temáticos contra la convocatoria oficial.
- Validación jurídica del aviso de privacidad.
- Las FAQs marcadas como **provisionales** en el editor.
- La agenda definitiva, que sustituirá al PDF de la convocatoria.
- Cupo presencial real y fecha límite de registro.
