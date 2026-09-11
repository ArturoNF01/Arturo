#!/usr/bin/env bash
# =====================================================================
# Instala el sistema del congreso en un servidor propio.
#
#   sudo bash instalar.sh
#
# Deja funcionando: PostgreSQL con el esquema cargado, la aplicación como
# servicio del sistema, un servidor web con certificado automático y un
# respaldo nocturno de la base.
#
# Es idempotente: se puede volver a ejecutar sin romper nada. Y no toca
# nada que ya esté corriendo: si el puerto 80 está ocupado, se detiene y
# lo dice, en lugar de pelearse con lo que haya.
# =====================================================================
set -euo pipefail

DOMINIO="${DOMINIO:-congreso-dss.ciess.org}"
REPOSITORIO="${REPOSITORIO:-https://github.com/desarrollos-ciess/congreso-dss.git}"
RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
BASE="${BASE:-congreso}"
PUERTO="${PUERTO:-3000}"
# De dónde se toma el código. Se pueden cambiar al invocar, por ejemplo:
#   sudo REPOSITORIO=https://github.com/otra/cuenta.git RAMA=master bash instalar.sh
RAMA="${RAMA:-master}"

paso()  { printf '\n\033[1m── %s\033[0m\n' "$1"; }
aviso() { printf '   %s\n' "$1"; }
morir() { printf '\n\033[31mAlto: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || morir "Ejecute con sudo: sudo bash instalar.sh"

# ---------------------------------------------------------------------
paso "Comprobaciones previas"

. /etc/os-release
case "${ID:-}" in
  ubuntu|debian) aviso "Sistema: $PRETTY_NAME" ;;
  *) morir "Este guion está hecho para Ubuntu o Debian; aquí hay ${PRETTY_NAME:-un sistema desconocido}." ;;
esac

memoria=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
[ "$memoria" -ge 1800 ] || morir "Hacen falta al menos 2 GB de memoria; hay ${memoria} MB."

libre=$(df --output=avail -m / | tail -1)
[ "$libre" -ge 5000 ] || morir "Hacen falta al menos 5 GB libres; hay ${libre} MB."

# Nadie debe estar usando el 80 y el 443, salvo que sea nuestro propio Caddy.
if ss -lnt 2>/dev/null | awk '{print $4}' | grep -qE ':(80|443)$'; then
  if ! systemctl is-active --quiet caddy 2>/dev/null; then
    morir "Algo ya escucha en el puerto 80 o 443. Este servidor sirve otro sitio: elija otro servidor, o dígamelo y adaptamos la instalación a lo que ya hay."
  fi
  aviso "El puerto 80 lo tiene Caddy, que es nuestro. Seguimos."
fi

aviso "Dominio: $DOMINIO"
aviso "Repositorio: $REPOSITORIO (rama $RAMA)"

# ---------------------------------------------------------------------
paso "Paquetes del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git ufw >/dev/null
aviso "Listo."

# ---------------------------------------------------------------------
paso "PostgreSQL"
if ! command -v psql >/dev/null; then
  apt-get install -y -qq postgresql postgresql-contrib >/dev/null
  aviso "Instalado."
else
  aviso "Ya estaba instalado: $(psql --version)."
fi
systemctl enable --now postgresql >/dev/null 2>&1 || true

# La contraseña se genera aquí y se guarda sólo en el archivo de entorno,
# que es legible únicamente por el usuario del servicio.
if [ -f "$RAIZ/.env" ] && grep -q '^DATABASE_URL=' "$RAIZ/.env"; then
  aviso "La base ya estaba configurada; se conserva su contraseña."
  CLAVE_BD=$(grep '^DATABASE_URL=' "$RAIZ/.env" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
else
  CLAVE_BD=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = '$BASE') then
    create role $BASE login password '$CLAVE_BD';
  else
    alter role $BASE password '$CLAVE_BD';
  end if;
end \$\$;
SQL

if ! sudo -u postgres psql -lqt | cut -d'|' -f1 | grep -qw "$BASE"; then
  sudo -u postgres createdb -O "$BASE" "$BASE"
  aviso "Base «$BASE» creada."
else
  aviso "La base «$BASE» ya existía."
fi

# ---------------------------------------------------------------------
paso "Node.js"
version_node=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo 0)
if [ "${version_node:-0}" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
  aviso "Instalado: $(node --version)."
else
  aviso "Ya estaba: $(node --version)."
fi

# ---------------------------------------------------------------------
paso "Usuario del servicio"
if ! id "$USUARIO" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/$USUARIO" --shell /usr/sbin/nologin "$USUARIO"
  aviso "Usuario «$USUARIO» creado. La aplicación no corre como root."
else
  aviso "El usuario «$USUARIO» ya existía."
fi

# ---------------------------------------------------------------------
paso "Código de la aplicación"
mkdir -p "$RAIZ"
if [ -d "$RAIZ/.git" ]; then
  aviso "Actualizando lo que ya estaba…"
  git -C "$RAIZ" remote set-url origin "$REPOSITORIO"
  git -C "$RAIZ" fetch --quiet origin "$RAMA"
  git -C "$RAIZ" reset --hard --quiet "origin/$RAMA"
else
  aviso "Clonando…"
  git clone --quiet --branch "$RAMA" "$REPOSITORIO" "$RAIZ"
fi
chown -R "$USUARIO:$USUARIO" "$RAIZ"
aviso "En $RAIZ · $(git -C "$RAIZ" log --oneline -1)"

# ---------------------------------------------------------------------
paso "Variables de entorno"
if [ ! -f "$RAIZ/.env" ]; then
  cat > "$RAIZ/.env" <<ENV
# Generado por instalar.sh. Las credenciales de correo y de Google se
# añaden aquí cuando estén listas; después: systemctl restart congreso
DATABASE_URL=postgresql://$BASE:$CLAVE_BD@localhost:5432/$BASE?sslmode=disable
NEXT_PUBLIC_URL_SITIO=https://$DOMINIO
PORT=$PUERTO
NODE_ENV=production
CRON_SECRET=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
ANTIABUSO_SAL=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)

# RESEND_API_KEY=
# CORREO_REMITENTE=Congreso CIESS <congreso@ciess.org>
# CORREO_CONTACTO=congreso@ciess.org
# GOOGLE_SERVICE_ACCOUNT_EMAIL=
# GOOGLE_PRIVATE_KEY=
# GOOGLE_SHEETS_ID=
# GOOGLE_DRIVE_FOLDER_ID=
ENV
  aviso "Creado $RAIZ/.env con la contraseña de la base y los secretos."
else
  aviso "Se conserva el $RAIZ/.env que ya existía."
fi
chown "$USUARIO:$USUARIO" "$RAIZ/.env"
chmod 600 "$RAIZ/.env"

# ---------------------------------------------------------------------
paso "Esquema de la base"
set -a; . "$RAIZ/.env"; set +a
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$BASE" -f "$RAIZ/basedatos/esquema.sql"
sudo -u postgres psql -q -d "$BASE" -c "grant all on all tables in schema public to $BASE;
  grant all on all sequences in schema public to $BASE;
  grant all on schema public to $BASE;" >/dev/null
aviso "Cargado."

# ---------------------------------------------------------------------
paso "Compilación"
cd "$RAIZ"
sudo -u "$USUARIO" env HOME="/home/$USUARIO" npm ci --silent
sudo -u "$USUARIO" env HOME="/home/$USUARIO" NODE_ENV=production npm run build --silent
aviso "Compilada."

# ---------------------------------------------------------------------
paso "Servicio del sistema"
cat > /etc/systemd/system/congreso.service <<UNIDAD
[Unit]
Description=Registro del 1er Congreso · CIESS
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$USUARIO
WorkingDirectory=$RAIZ
EnvironmentFile=$RAIZ/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

# La aplicación no necesita nada fuera de su carpeta.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$RAIZ

[Install]
WantedBy=multi-user.target
UNIDAD

systemctl daemon-reload
systemctl enable --now congreso >/dev/null
sleep 4
systemctl is-active --quiet congreso || { journalctl -u congreso -n 30 --no-pager; morir "El servicio no arrancó. Arriba está el registro."; }
aviso "Corriendo en el puerto $PUERTO."

# ---------------------------------------------------------------------
paso "Servidor web con certificado"
if ! command -v caddy >/dev/null; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
  aviso "Caddy instalado."
fi

# Cada sitio en su propio archivo, y el principal sólo los incluye. Así
# este servidor puede alojar varios proyectos sin que la instalación de
# uno borre la configuración de los demás.
mkdir -p /etc/caddy/sitios
if ! grep -q 'import /etc/caddy/sitios/' /etc/caddy/Caddyfile 2>/dev/null; then
  # Se conserva lo que hubiera antes; sólo se le añade la línea que incluye.
  printf '\n# Cada proyecto alojado aquí tiene su archivo en esta carpeta.\nimport /etc/caddy/sitios/*.caddy\n' >> /etc/caddy/Caddyfile
  aviso "El servidor web ahora puede alojar varios sitios."
fi

cat > /etc/caddy/sitios/congreso.caddy <<CADDY
# El certificado se pide y se renueva solo.
$DOMINIO {
    reverse_proxy localhost:$PUERTO
    encode gzip zstd
    log {
        output file /var/log/caddy/congreso.log
        format console
    }
}
CADDY

# Si la configuración tiene un error, Caddy sigue sirviendo la anterior:
# mejor eso que dejar todos los sitios del servidor caídos.
if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  rm -f /etc/caddy/sitios/congreso.caddy
  morir "La configuración del servidor web quedó mal y se deshizo. Los sitios que ya había siguen en pie."
fi

systemctl reload caddy 2>/dev/null || systemctl restart caddy
aviso "Sirviendo $DOMINIO."

# ---------------------------------------------------------------------
paso "Cortafuegos"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true
aviso "Abiertos 22, 80 y 443. PostgreSQL queda sólo en local."

# ---------------------------------------------------------------------
paso "Respaldo nocturno"
# La carpeta es de postgres porque es quien corre el respaldo desde cron.
install -o postgres -g postgres -m 750 -d /var/respaldos/congreso
cp "$RAIZ/guiones/servidor/respaldar.sh" /usr/local/bin/respaldar-congreso
chmod 755 /usr/local/bin/respaldar-congreso

cat > /etc/cron.d/congreso <<CRON
# Respaldo de la base, todas las noches a las 03:15
15 3 * * * postgres /usr/local/bin/respaldar-congreso >> /var/log/respaldo-congreso.log 2>&1
CRON
aviso "Cada noche a las 03:15, con 30 días de historial en /var/respaldos/congreso."

# ---------------------------------------------------------------------
paso "Listo"
cat <<FIN

   El sitio: https://$DOMINIO
   Diagnóstico: https://$DOMINIO/diagnostico

   Falta una sola cosa: crear su cuenta del panel.

     cd $RAIZ
     sudo -u $USUARIO env \$(grep DATABASE_URL .env) npm run crear-usuario -- \\
       persona@ciess.org "Su Nombre" superadmin

   Para actualizar el sitio en el futuro:  sudo bash $RAIZ/guiones/servidor/desplegar.sh
   Para ver si algo falla:                 journalctl -u congreso -f

FIN
