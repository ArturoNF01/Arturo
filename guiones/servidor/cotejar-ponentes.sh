#!/usr/bin/env bash
# =====================================================================
# Cotejo de los ponentes de la agenda con los registros.
#
#   sudo bash /opt/congreso/guiones/servidor/cotejar-ponentes.sh              # mira, cuenta y llena la pestaña; no cambia nada
#   sudo bash /opt/congreso/guiones/servidor/cotejar-ponentes.sh --aplicar    # además pasa a ponente a quien se registró como público general
#
# Primero se corre sin nada, se revisa la pestaña «Cotejo de ponentes» de la hoja, y después con --aplicar.
# Lo dudoso nunca se cambia solo: se enseña para que lo decida una persona.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

[ "$(id -u)" -eq 0 ] || { printf '\033[31mEjecute con sudo: sudo bash %s\033[0m\n' "$0" >&2; exit 1; }

cd "$RAIZ"
sudo -u "$USUARIO" env $(grep '^DATABASE_URL=' "$RAIZ/.env") npm run --silent cotejar-ponentes -- "$@"
