#!/usr/bin/env bash
# =====================================================================
# Congela la pestaña «Asistencia por persona»: el sistema deja de escribirla y lo que está en la hoja es lo que vale.
#
#   sudo bash /opt/congreso/guiones/servidor/congelar-hoja.sh                  # la congela
#   sudo bash /opt/congreso/guiones/servidor/congelar-hoja.sh --descongelar    # vuelve a ser una copia de la base
#   sudo bash /opt/congreso/guiones/servidor/congelar-hoja.sh --estado         # sólo dice cómo está
#
# Es el mismo interruptor del panel (Asistencia). Nace congelada al desplegar.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

[ "$(id -u)" -eq 0 ] || { printf '\033[31mEjecute con sudo: sudo bash %s\033[0m\n' "$0" >&2; exit 1; }

cd "$RAIZ"
sudo -u "$USUARIO" env $(grep '^DATABASE_URL=' "$RAIZ/.env") npm run --silent congelar-hoja -- "$@"
