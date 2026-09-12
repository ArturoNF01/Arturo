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

## Un droplet para varios desarrollos

Este mismo servidor puede alojar otros proyectos además del congreso, cada
uno con su dominio y su base, sin estorbarse. Es lo razonable: un solo
servidor que administrar, una sola factura, y los sitios que ya están en
producción en otros droplets no corren ningún riesgo.

Funciona así:

- **El servidor web** guarda cada sitio en su propio archivo dentro de
  `/etc/caddy/sitios/`. El archivo principal sólo los incluye. Instalar un
  proyecto nuevo agrega un archivo; **no borra los de los demás**. Antes
  de recargar, la configuración se valida: si quedó mal, se deshace y los
  sitios que ya estaban siguen en pie.
- **La base de datos** es un solo PostgreSQL, pero cada proyecto tiene su
  base y su usuario, con su propia contraseña. Uno no puede leer los datos
  del otro.
- **Cada aplicación** es un servicio aparte y escucha en su propio puerto
  interno (el congreso usa el 3000; el siguiente usaría el 3001). Si uno
  se cae, los demás siguen.
- **Los respaldos** son por base, en archivos separados.

### Qué tamaño conviene

| Proyectos | Memoria | Por qué |
|---|---|---|
| 1 | 2 GB | Es el mínimo. La compilación es lo que más memoria pide y con 2 GB va justa. |
| 2 a 4 | **4 GB** | Lo recomendable. Holgura para compilar sin tumbar lo que está sirviendo. |
| 5 o más | 8 GB | O separar en dos droplets. |

Con **Ubuntu 24.04 LTS**, y en la misma región que los demás droplets del
CIESS, para que la administración quede junta.

> Un detalle que muerde: compilar una aplicación mientras otra está
> sirviendo puede agotar la memoria y hacer que el sistema mate procesos
> al azar —incluido un sitio en producción—. Con 4 GB no pasa. Con 2 GB y
> dos proyectos, conviene agregar memoria de intercambio:
>
> ```bash
> sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
> sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

### Al crear el droplet

- **Ubuntu 24.04 LTS**, plan **Basic / Regular**.
- **Autenticación por llave SSH**, no por contraseña. DigitalOcean guía
  para crearla; si se complica, la contraseña sirve, pero la llave es
  mejor.
- **Backups semanales** (cuestan un 20% extra): son del disco entero, y
  complementan al respaldo de la base que hace este sistema. Uno salva de
  un borrado; el otro, de un servidor perdido.
- **Monitoring** activado: es gratis y avisa si se llena el disco.
- Nombre que se entienda dentro de un año: `desarrollos-ciess`.

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
2. Que ese droplet **no esté sirviendo ya otro sitio con un servidor web
   distinto** (nginx, Apache, Plesk). Si algo ajeno está usando los
   puertos 80 o 443, la instalación se detiene sola y avisa, en lugar de
   tumbar lo que ya funciona. Si el que está es Caddy —porque aquí ya se
   instaló otro proyecto igual—, no hay problema: ver *Un droplet para
   varios desarrollos*, más abajo.
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

Si el código está en otro repositorio o en otra rama, se le indica al
invocarlo, sin editar nada:

```bash
sudo REPOSITORIO=https://github.com/otra/cuenta.git RAMA=master bash -c "$(curl -fsSL ...)"
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

**Ponerlo todo al día de una vez** —código, datos acordados, Google y, si
se pide, los registros de demostración—:

```bash
sudo bash /opt/congreso/guiones/servidor/poner-al-dia.sh
sudo bash /opt/congreso/guiones/servidor/poner-al-dia.sh --demostracion
```

Se para en el primer paso que falle, para no seguir encima de un error. Lo
primero que hace es trabajar desde una copia de sí mismo: el despliegue
reescribe ese mismo archivo, y bash lee los guiones a trozos, así que
cambiarlo a media ejecución lo dejaría a medias sin decir nada.

**Actualizar el sitio** cuando haya cambios nuevos en GitHub:

```bash
sudo bash /opt/congreso/guiones/servidor/desplegar.sh
```

Respalda la base, trae los cambios, aplica el esquema, recompila y
reinicia. Si algo falla o el sitio no responde, **vuelve solo a la
versión anterior**: una actualización mal salida no deja el sitio caído.

**Ver quién ha visitado el sitio:**

```bash
sudo journalctl -u caddy -f      # en vivo (Ctrl+C para salir)
```

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

**Conectar con Google Sheets:** descargue la llave de la cuenta de servicio
desde la consola de Google, cree el archivo en el servidor y ejecute:

```bash
cat > /tmp/llave.json      # pegue el contenido y cierre con Ctrl+D
sudo bash /opt/congreso/guiones/servidor/conectar-google.sh /tmp/llave.json ID_DE_LA_HOJA
```

Se hace con un guion y no editando el archivo de entorno a mano porque la
llave lleva saltos de línea que al pegarlos en un editor se parten, y el
fallo que eso produce no dice lo que pasó. El guion la guarda como debe,
borra el archivo y reinicia el servicio.

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
gunzip -c /var/respaldos/congreso/congreso-2026-11-01-0315.sql.gz \
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
| «Rechazó la conexión» (ERR_CONNECTION_REFUSED) | Nada escucha: el servidor web no arrancó | `sudo journalctl -u caddy -n 30` dice por qué. Casi siempre es un error en `/etc/caddy/sitios/`: un fallo ahí no deja arrancar a Caddy y tumba **todos** los sitios del servidor, no sólo el del error. |
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
- **No edite `/etc/caddy/Caddyfile` para agregar otro sitio.** Cada
  proyecto va en su propio archivo dentro de `/etc/caddy/sitios/`; así uno
  no se lleva entre las patas al otro.

---

## Dónde queda cada cosa

| Ruta | Qué es |
|---|---|
| `/opt/congreso` | El código |
| `/opt/congreso/.env` | Contraseñas y secretos (sólo lo lee el usuario `congreso`) |
| `/etc/systemd/system/congreso.service` | Cómo arranca la aplicación |
| `/etc/caddy/Caddyfile` | El archivo principal del servidor web; sólo incluye los de abajo |
| `/etc/caddy/sitios/congreso.caddy` | Cómo se sirve este dominio en concreto |
| `/etc/cron.d/congreso` | El horario del respaldo |
| `/var/respaldos/congreso/` | Los respaldos |
| `/var/respaldos/congreso/respaldo.log` | Cómo fue cada respaldo |
