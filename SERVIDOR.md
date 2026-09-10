# El servidor, explicado

Guía para poner el sistema del congreso a funcionar en un servidor propio
de DigitalOcean (un *droplet*), sin depender de servicios de pago
adicionales. Todo —la aplicación y la base de datos— vive en esa misma
máquina.

Está escrita para quien nunca ha administrado un servidor. No hace falta
saber Linux: se copian y pegan órdenes, y cada una dice qué hace.

---

## Qué vamos a montar

```
                 Internet
                     │
                     ▼
        ┌────────────────────────┐
        │  congreso-dss.ciess.org │   ← el dominio
        └────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Caddy (puertos 80/443) │   ← pone el candado (HTTPS) solo
        └────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  La aplicación (:3000)  │   ← corre como servicio del sistema
        └────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  PostgreSQL (local)     │   ← la base, sólo accesible desde aquí
        └────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Respaldo cada noche    │   ← 30 días de historial
        └────────────────────────┘
```

**Costo adicional: cero.** El droplet ya está pagado; la base de datos va
dentro de él, no en un servicio aparte.

---

## Vocabulario mínimo

| Palabra | Qué es |
|---|---|
| **Droplet** | Una computadora rentada en un centro de datos. Está prendida siempre y tiene una dirección IP pública. |
| **Consola** | La ventana negra donde se escriben órdenes. En DigitalOcean se abre desde el navegador: no hace falta instalar nada. |
| **`sudo`** | «Hazlo con permisos de administrador». Va delante de las órdenes que cambian el sistema. |
| **Servicio** | Un programa que el sistema mantiene encendido solo, y que vuelve a arrancar si se cae o si se reinicia el servidor. |
| **Registro A** | La línea en la configuración del dominio que dice «`congreso-dss.ciess.org` es esta dirección IP». |
| **Certificado** | Lo que hace que salga `https://` y el candado. Aquí se pide y se renueva solo. |

---

## Antes de empezar

Hacen falta tres cosas:

1. Un droplet con **Ubuntu 22.04 o más nuevo**, al menos **2 GB de
   memoria** y **5 GB libres**.
2. Que ese droplet **no esté sirviendo ya otro sitio web**. Si algo está
   usando los puertos 80 o 443, la instalación se detiene sola y avisa,
   en lugar de tumbar lo que ya funciona.
3. Poder editar el dominio `ciess.org` para agregarle un subdominio.

---

## Paso 1 · Ver en qué estado está el servidor

Antes de instalar nada hay que mirar. Instalar a ciegas es como se tira
un sitio que ya estaba funcionando.

1. En DigitalOcean, entre a **Droplets** y haga clic en el droplet.
2. Arriba a la derecha, botón **Console** (o **Launch Droplet Console**).
   Se abre una ventana negra dentro del navegador.
3. Copie y pegue esto, completo, y presione Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/desarrollos-ciess/congreso-dss/master/guiones/servidor/revisar.sh | bash
```

> Si el repositorio es privado y esa orden falla, abra el archivo
> `guiones/servidor/revisar.sh` en GitHub, presione **Raw**, copie todo el
> texto y péguelo en la consola precedido de `bash <<'FIN'` y cerrado con
> `FIN`. También sirve subir el archivo por SFTP.

4. **Pegue toda la respuesta en la conversación.** Ahí se ve si el
   servidor está libre o si ya sirve otra cosa.

No modifica nada: sólo lee y reporta.

---

## Paso 2 · Apuntar el subdominio al servidor

Esto puede hacerse mientras tanto; el certificado no se emite hasta que
el dominio ya apunta bien.

1. Anote la **IP pública** del droplet (aparece en su página, algo como
   `164.92.xxx.xxx`).
2. En DigitalOcean: **Networking → Domains → ciess.org**.
3. Cree un registro:

   | Campo | Valor |
   |---|---|
   | Tipo | **A** |
   | Hostname | `congreso-dss` |
   | Will direct to | la IP del droplet |
   | TTL | 3600 |

4. Espere unos minutos y compruebe desde la consola del droplet:

```bash
dig +short congreso-dss.ciess.org
```

Debe responder la IP del droplet. Si no responde nada, todavía no se ha
propagado: espere y repita.

> Si el dominio `ciess.org` **no** está administrado en DigitalOcean sino
> en otro proveedor, el registro A se crea allá, con esos mismos valores.

---

## Paso 3 · Instalar

Una sola orden. Tarda entre cinco y diez minutos y va diciendo qué hace.

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/desarrollos-ciess/congreso-dss/master/guiones/servidor/instalar.sh)"
```

Deja funcionando, en este orden:

1. **PostgreSQL**, con una contraseña generada al momento que queda sólo
   en el archivo de entorno del servidor.
2. **El esquema de la base**: todas las tablas, los seis ejes temáticos,
   las 27 plantillas de correo y la configuración inicial.
3. **Node.js 22** y la aplicación compilada en `/opt/congreso`.
4. **El servicio `congreso`**, que arranca solo con el servidor.
5. **Caddy**, que pide el certificado y sirve el sitio en HTTPS.
6. **El cortafuegos**: abiertos sólo 22 (administración), 80 y 443. La
   base de datos **no** queda expuesta a internet.
7. **El respaldo nocturno**, a las 03:15, con 30 días de historial.

Si algo no cuadra —poca memoria, sistema que no es Ubuntu, otro sitio ya
en el puerto 80— se detiene y lo dice antes de tocar nada.

---

## Paso 4 · Crear su cuenta del panel

La instalación no crea usuarios: nadie más debe conocer esa contraseña.
Al terminar imprime la orden exacta. Es esta, cambiando el correo y el
nombre:

```bash
cd /opt/congreso
sudo -u congreso env $(grep DATABASE_URL .env) npm run crear-usuario -- \
  arturo@ciess.org "Arturo Nava" superadmin
```

Pide una contraseña y la guarda cifrada. Los papeles posibles:

| Papel | Puede |
|---|---|
| `superadmin` | Todo, incluido crear usuarios y cambiar la configuración |
| `admin` | Ver y gestionar registros, dictaminar, exportar |
| `cientifico` | Dictaminar ponencias |
| `lector` | Sólo mirar y exportar |

---

## Paso 5 · Comprobar

Abra **https://congreso-dss.ciess.org/diagnostico**.

Es una página que revisa el despliegue y dice, en español, qué falta:
la base, el correo, las fechas del congreso, las variables de entorno.
Lo que aparezca en rojo es lo que hay que atender.

Después: entre al panel, registre una prueba, expórtela y bórrela.

---

## El día a día

Todo esto se hace desde la consola del droplet.

**Actualizar el sitio** cuando haya cambios nuevos en GitHub:

```bash
sudo bash /opt/congreso/guiones/servidor/desplegar.sh
```

Respalda la base, trae los cambios, aplica el esquema, recompila y
reinicia. Si algo falla o el sitio no responde, **vuelve solo a la
versión anterior**: una actualización mal salida no deja el sitio caído.

**Ver si algo va mal:**

```bash
systemctl status congreso        # ¿está corriendo?
journalctl -u congreso -n 50     # las últimas 50 líneas del registro
journalctl -u congreso -f        # ver en vivo (Ctrl+C para salir)
```

**Reiniciar la aplicación:**

```bash
sudo systemctl restart congreso
```

**Cambiar una clave de correo o de Google:**

```bash
sudo nano /opt/congreso/.env      # editar; Ctrl+O guarda, Ctrl+X sale
sudo systemctl restart congreso   # sin esto, el cambio no surte efecto
```

**Respaldar a mano** (además del automático de cada noche):

```bash
sudo respaldar-congreso
ls -lh /var/respaldos/congreso/
```

**Bajar un respaldo a su computadora** (desde *su* máquina, no desde el
droplet):

```bash
scp root@LA_IP:/var/respaldos/congreso/congreso-*.sql.gz ~/Descargas/
```

---

## Restaurar la base

Sólo si hubo pérdida de datos. **Esto borra lo que haya ahora** y deja lo
que había en el respaldo.

```bash
sudo systemctl stop congreso
sudo -u postgres dropdb congreso
sudo -u postgres createdb -O congreso congreso
gunzip -c /var/respaldos/congreso/congreso-2026-06-01-0315.sql.gz \
  | sudo -u postgres psql -d congreso
sudo systemctl start congreso
```

(Cambie la fecha del archivo por la del respaldo que quiera recuperar;
`ls /var/respaldos/congreso/` los lista.)

---

## Cuando algo no funciona

| Lo que ve | Qué pasa | Qué hacer |
|---|---|---|
| El sitio no abre y el navegador dice que no encuentra el servidor | El dominio no apunta al droplet | `dig +short congreso-dss.ciess.org` debe dar la IP. Revise el registro A. |
| Sale «no es seguro» o falla el candado | Caddy no consiguió el certificado | `sudo journalctl -u caddy -n 30`. Casi siempre es que el dominio aún no apuntaba cuando se instaló: `sudo systemctl restart caddy`. |
| Error 502 | La aplicación no está corriendo | `sudo systemctl restart congreso`; si sigue, `journalctl -u congreso -n 50`. |
| La instalación se detuvo diciendo que el puerto 80 está ocupado | Ese droplet ya sirve otro sitio | Use otro droplet, o avísenos para adaptar la instalación a lo que ya hay. |
| El formulario da error al guardar | Casi siempre la base | Abra `/diagnostico`. |
| Se acabó el espacio en disco | Registros o respaldos acumulados | `df -h` y `du -sh /var/respaldos/congreso/`. Los respaldos se borran solos a los 30 días. |

---

## Qué NO hacer

- **No borre `/opt/congreso/.env`.** Ahí están la contraseña de la base y
  los secretos. Sin él, la aplicación no arranca y los enlaces de edición
  que ya se enviaron dejan de servir.
- **No abra el puerto 5432 al mundo.** La base sólo necesita hablar con
  la aplicación, y ambas están en la misma máquina.
- **No edite archivos dentro de `/opt/congreso`** para cambiar el sitio:
  la siguiente actualización los sobrescribe. Los cambios van al
  repositorio, y de ahí bajan con `desplegar.sh`. El contenido editable
  (textos, plantillas de correo, cupos, fechas) se cambia desde el panel,
  no tocando archivos.
- **No corra la aplicación como `root`.** El instalador crea el usuario
  `congreso` justamente para eso.

---

## Dónde queda cada cosa

| Ruta | Qué es |
|---|---|
| `/opt/congreso` | El código |
| `/opt/congreso/.env` | Contraseñas y secretos (sólo lo lee el usuario `congreso`) |
| `/etc/systemd/system/congreso.service` | Cómo arranca la aplicación |
| `/etc/caddy/Caddyfile` | Cómo se sirve el dominio |
| `/etc/cron.d/congreso` | El horario del respaldo |
| `/var/respaldos/congreso/` | Los respaldos |
| `/var/log/caddy/congreso.log` | Quién ha visitado el sitio |
| `/var/log/respaldo-congreso.log` | Cómo fue cada respaldo |
