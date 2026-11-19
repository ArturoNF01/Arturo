#!/usr/bin/env bash
# =====================================================================
# Resuelve los registros duplicados de una misma persona (los casos «dos constancias» de revisar-repetidos).
#
#   sudo bash /opt/congreso/guiones/servidor/resolver-duplicados.sh                           # mira: cuál queda y cuáles se cancelarían
#   sudo bash /opt/congreso/guiones/servidor/resolver-duplicados.sh --aplicar                 # lo hace en los casos con decisión
#   sudo bash /opt/congreso/guiones/servidor/resolver-duplicados.sh --mantener correo@x.org   # fija cuál queda (para los empates)
#
# Queda el registro de ponente y, a igualdad, el de más días. Los días del que sobra pasan al que queda y él se cancela en silencio
# (sin correo). No borra ningún registro.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

[ "$(id -u)" -eq 0 ] || { printf '\033[31mEjecute con sudo: sudo bash %s\033[0m\n' "$0" >&2; exit 1; }

cd "$RAIZ"
sudo -u "$USUARIO" env $(grep '^DATABASE_URL=' "$RAIZ/.env") npm run --silent resolver-duplicados -- "$@"
