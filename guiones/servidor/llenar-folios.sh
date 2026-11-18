#!/usr/bin/env bash
# =====================================================================
# Llena la columna «Folio» de «Asistencia por persona».
#
#   sudo bash /opt/congreso/guiones/servidor/llenar-folios.sh              # mira: dice qué folios pondría; no escribe nada
#   sudo bash /opt/congreso/guiones/servidor/llenar-folios.sh --aplicar    # los escribe, sólo en las celdas vacías
#
# Público general: CONG-EISS-RIUSS-A01, A02…  Ponentes: CONG-EISS-RIUSS-P01, P02…  De uno en uno, en el orden de las filas.
# Nunca pisa un folio que ya esté. Primero se corre sin nada y se revisa; antes de --aplicar, resolver los repetidos.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

[ "$(id -u)" -eq 0 ] || { printf '\033[31mEjecute con sudo: sudo bash %s\033[0m\n' "$0" >&2; exit 1; }

cd "$RAIZ"
sudo -u "$USUARIO" env $(grep '^DATABASE_URL=' "$RAIZ/.env") npm run --silent llenar-folios -- "$@"
