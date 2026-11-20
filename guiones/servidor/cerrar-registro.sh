#!/usr/bin/env bash
# =====================================================================
# Cierra el registro al congreso (el interruptor «Registro abierto» de Cupos en el panel).
#
#   sudo bash /opt/congreso/guiones/servidor/cerrar-registro.sh            # cierra el registro
#   sudo bash /opt/congreso/guiones/servidor/cerrar-registro.sh --abrir    # lo vuelve a abrir
#   sudo bash /opt/congreso/guiones/servidor/cerrar-registro.sh --estado   # sólo dice cómo está
#
# Con el registro cerrado el sitio no recibe registros nuevos. No toca los registros que ya hay ni la asistencia.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

[ "$(id -u)" -eq 0 ] || { printf '\033[31mEjecute con sudo: sudo bash %s\033[0m\n' "$0" >&2; exit 1; }

cd "$RAIZ"
sudo -u "$USUARIO" env $(grep '^DATABASE_URL=' "$RAIZ/.env") npm run --silent cerrar-registro -- "$@"
