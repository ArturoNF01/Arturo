#!/usr/bin/env bash
# =====================================================================
# Elimina las filas «sin registro» de «Asistencia por persona»: quien escaneó sin que se hallara su registro.
#
#   sudo bash /opt/congreso/guiones/servidor/eliminar-sin-registro.sh              # mira: cuántas son y cuáles; no borra nada
#   sudo bash /opt/congreso/guiones/servidor/eliminar-sin-registro.sh --aplicar    # las borra, tras guardar una copia en un CSV
#
# Antes de borrar guarda una copia de cada asistencia en /home/congreso/respaldos (sólo el usuario del sitio la puede leer).
# No toca ningún registro. Conviene correr antes limpiar-repetidos.sh: lo que repite a alguien registrado se liga y no pierde su día.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
DESTINO_DE_RESPALDOS="${DESTINO_DE_RESPALDOS:-/home/$USUARIO/respaldos}"
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

[ "$(id -u)" -eq 0 ] || { printf '\033[31mEjecute con sudo: sudo bash %s\033[0m\n' "$0" >&2; exit 1; }

# La carpeta de las copias: del usuario del sitio y de nadie más (hay nombres y correos).
install -d -m 700 -o "$USUARIO" -g "$USUARIO" "$DESTINO_DE_RESPALDOS"

cd "$RAIZ"
sudo -u "$USUARIO" env $(grep '^DATABASE_URL=' "$RAIZ/.env") DESTINO_DE_RESPALDOS="$DESTINO_DE_RESPALDOS" npm run --silent eliminar-sin-registro -- "$@"
