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
paso "1 de 5 · Traer los cambios"
bash "$RAIZ/guiones/servidor/desplegar.sh" || morir "traer los cambios"

# ---------------------------------------------------------------------
paso "2 de 5 · Datos y contenido acordados"
set -a; . "$RAIZ/.env"; set +a
sudo -u "$USUARIO" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -f "$RAIZ/basedatos/actualizar-convocatoria.sql" > /dev/null || morir "aplicar los datos"
aviso "Fechas, sede, correos y aviso de privacidad al día."

# ---------------------------------------------------------------------
paso "3 de 5 · Conexión con Google"
# Este paso no detiene al resto. La hoja es una copia de consulta: que falte
# no es razón para dejar el servidor sin sus registros ni sin sus datos, que
# es lo que pasaba cuando cualquier tropiezo aquí cortaba la secuencia.
fallo_google=no
if [ -f "$LLAVE" ]; then
  bash "$RAIZ/guiones/servidor/conectar-google.sh" "$LLAVE" "$HOJA" || fallo_google=sí
elif grep -q '^GOOGLE_PRIVATE_KEY=' "$RAIZ/.env"; then
  aviso "Ya estaba conectado; no hay llave nueva que cargar."
else
  aviso "Sin llave en $LLAVE: este paso se salta. Deje ahí el archivo y vuelva a ejecutar."
fi

# ---------------------------------------------------------------------
paso "4 de 5 · Registros de demostración"
if [ "$demostracion" = "sí" ]; then
  cd "$RAIZ"
  entorno npm run sembrar || morir "sembrar los registros"
else
  aviso "No se pidieron. Para añadirlos: sudo bash $0 --demostracion"
fi

# ---------------------------------------------------------------------
# Este paso lo hacía el botón del panel. Dejarlo ahí era pedirle a alguien
# que abriera el navegador, iniciara sesión y encontrara el botón para que
# la hoja dejara de estar vacía; y si el panel no abría, la hoja se quedaba
# vacía sin explicación. Desde aquí el fallo se ve, con folio y motivo.
paso "5 de 5 · Copiar los registros a la hoja"
fallo_copia=no
if [ "$fallo_google" = "sí" ]; then
  aviso "Se salta: Google no quedó conectado en el paso 3."
elif ! grep -q '^GOOGLE_PRIVATE_KEY=' "$RAIZ/.env"; then
  aviso "Se salta: Google no está conectado todavía."
else
  cd "$RAIZ"
  entorno npm run sincronizar || fallo_copia=sí
fi

# ---------------------------------------------------------------------
cd /
cuantos=$(sudo -u "$USUARIO" psql "$DATABASE_URL" -tAc 'select count(*) from registros' 2>/dev/null || echo '?')
pendientes=$(sudo -u "$USUARIO" psql "$DATABASE_URL" -tAc \
  'select count(*) from registros where sheets_sincronizado_en is null' 2>/dev/null || echo '?')

printf '\n\033[1m══ Listo\033[0m\n'
if [ "$fallo_google" = "sí" ]; then
  printf '   \033[33mGoogle Sheets no quedó conectado; lo de arriba dice por qué.\033[0m\n'
  aviso "El resto sí se completó. Se puede reintentar sólo ese paso cuando quiera."
fi
aviso "Registros en la base: $cuantos"
aviso "Pendientes de copiar a la hoja: $pendientes"
printf '\n'
if [ "$fallo_copia" = "sí" ]; then
  printf '   \033[33mLa copia a la hoja falló; el motivo está unas líneas más arriba.\033[0m\n'
  aviso "Lo más común: la cuenta de servicio no es Editora de la hoja, o el"
  aviso "GOOGLE_SHEETS_ID del .env no es el de la hoja que está mirando."
  aviso "Para reintentar sólo esto: cd $RAIZ && sudo -u $USUARIO npm run sincronizar"
elif [ "$pendientes" = "0" ]; then
  aviso "La hoja está al día."
fi
aviso "El sitio: https://congreso-dss.ciess.org"
printf '\n'
