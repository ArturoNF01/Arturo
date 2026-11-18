#!/usr/bin/env bash
# =====================================================================
# Limpieza de «Asistencia por persona»: repetidos sin registro y nombres todo en mayúsculas.
#
#   sudo bash /opt/congreso/guiones/servidor/limpiar-repetidos.sh              # mira: dice qué haría; no cambia nada
#   sudo bash /opt/congreso/guiones/servidor/limpiar-repetidos.sh --aplicar    # lo hace
#
# Las asistencias «sin registro» que repiten a alguien registrado se ligan a su registro (como «Ligar a un registro» del panel: no
# se pierde ningún día) y los nombres todo en mayúsculas pasan a altas y bajas. No borra ningún registro.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

[ "$(id -u)" -eq 0 ] || { printf '\033[31mEjecute con sudo: sudo bash %s\033[0m\n' "$0" >&2; exit 1; }

cd "$RAIZ"
sudo -u "$USUARIO" env $(grep '^DATABASE_URL=' "$RAIZ/.env") npm run --silent limpiar-repetidos -- "$@"
