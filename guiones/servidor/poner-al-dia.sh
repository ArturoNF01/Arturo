#!/usr/bin/env bash
# =====================================================================
# Pone el servidor al día de una sola vez: trae los cambios, aplica los
# datos acordados, conecta Google si hay llave y siembra los registros
# de demostración si se pide.
#
#   sudo bash poner-al-dia.sh                    # código y datos
#   sudo bash poner-al-dia.sh --demostracion     # además, 100 registros
#
# Para conectar Google, deje el archivo de llave en /tmp/llave.json antes
# de ejecutar; si no está, ese paso se salta sin ruido.
#
# Se para en el primer paso que falle, para no seguir encima de un error.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
HOJA="${HOJA:-1aP24U0UPZgSp0Vd1iguMROm2QFRhynFfdHr_VKRB8pQ}"
LLAVE="${LLAVE:-/tmp/llave.json}"

# El despliegue reescribe este mismo archivo con «git reset». Bash lee los
# guiones a trozos, según los va necesitando, así que cambiarlo mientras
# corre lo corrompe a media ejecución. Por eso lo primero es trabajar desde
# una copia, fuera del repositorio.
if [ "${COPIA_PROPIA:-}" != "sí" ]; then
  copia=$(mktemp /tmp/poner-al-dia.XXXXXX.sh)
  cp "$0" "$copia"
  chmod +x "$copia"
  COPIA_PROPIA=sí exec bash "$copia" "$@"
fi

paso()  { printf '\n\033[1m══ %s\033[0m\n' "$1"; }
aviso() { printf '   %s\n' "$1"; }
morir() { printf '\n\033[31mAlto en «%s». No se siguió adelante.\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || morir "hacen falta permisos de administrador: use sudo"
cd /

demostracion=no
[ "${1:-}" = "--demostracion" ] && demostracion=sí

entorno() { sudo -u "$USUARIO" env $(grep '^DATABASE_URL=' "$RAIZ/.env") "$@"; }

# ---------------------------------------------------------------------
paso "1 de 4 · Traer los cambios"
bash "$RAIZ/guiones/servidor/desplegar.sh" || morir "traer los cambios"

# ---------------------------------------------------------------------
paso "2 de 4 · Datos y contenido acordados"
set -a; . "$RAIZ/.env"; set +a
sudo -u "$USUARIO" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -f "$RAIZ/basedatos/actualizar-convocatoria.sql" > /dev/null || morir "aplicar los datos"
aviso "Fechas, sede, correos y aviso de privacidad al día."

# ---------------------------------------------------------------------
paso "3 de 4 · Google Sheets"
if [ -f "$LLAVE" ]; then
  bash "$RAIZ/guiones/servidor/conectar-google.sh" "$LLAVE" "$HOJA" || morir "conectar Google"
elif grep -q '^GOOGLE_PRIVATE_KEY=' "$RAIZ/.env"; then
  aviso "Ya estaba conectado; no hay llave nueva que cargar."
else
  aviso "Sin llave en $LLAVE: este paso se salta. Deje ahí el archivo y vuelva a ejecutar."
fi

# ---------------------------------------------------------------------
paso "4 de 4 · Registros de demostración"
if [ "$demostracion" = "sí" ]; then
  cd "$RAIZ"
  entorno npm run sembrar || morir "sembrar los registros"
else
  aviso "No se pidieron. Para añadirlos: sudo bash $0 --demostracion"
fi

# ---------------------------------------------------------------------
cd /
cuantos=$(sudo -u "$USUARIO" psql "$DATABASE_URL" -tAc 'select count(*) from registros' 2>/dev/null || echo '?')
pendientes=$(sudo -u "$USUARIO" psql "$DATABASE_URL" -tAc \
  'select count(*) from registros where sheets_sincronizado_en is null' 2>/dev/null || echo '?')

printf '\n\033[1m══ Listo\033[0m\n'
aviso "Registros en la base: $cuantos"
aviso "Pendientes de copiar a la hoja: $pendientes"
printf '\n'
if [ "$pendientes" != "0" ] && [ "$pendientes" != "?" ]; then
  aviso "Para volcarlos: entre al panel, «Cupos y configuración», al final."
fi
aviso "El sitio: https://congreso-dss.ciess.org"
printf '\n'
