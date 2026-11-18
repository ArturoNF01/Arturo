#!/usr/bin/env bash
# =====================================================================
# Revisión de los repetidos de «Asistencia por persona»: quién sale más de una vez, con el mismo nombre o el mismo correo.
#
#   sudo bash /opt/congreso/guiones/servidor/revisar-repetidos.sh
#
# Cuenta, dice qué hacer con cada caso y llena la pestaña «Repetidos por revisar» de la hoja. No cambia ningún registro ni ninguna
# asistencia: eso se hace en el panel (ligar una asistencia suelta a su registro, cancelar el registro que sobra). Se vuelve a correr
# para ver cuántos quedan antes de emitir las constancias.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

[ "$(id -u)" -eq 0 ] || { printf '\033[31mEjecute con sudo: sudo bash %s\033[0m\n' "$0" >&2; exit 1; }

cd "$RAIZ"
sudo -u "$USUARIO" env $(grep '^DATABASE_URL=' "$RAIZ/.env") npm run --silent revisar-repetidos -- "$@"
