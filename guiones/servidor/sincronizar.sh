#!/usr/bin/env bash
# =====================================================================
# Copia a la hoja de Google los registros que quedaron pendientes.
#
# Lo normal es que no haya ninguno: cada registro nuevo se copia en el
# momento de darse de alta. Esto es la red debajo: si Google no responde
# en ese instante —una caída, un límite de peticiones, la llave recién
# rotada— la fila se queda marcada y aquí se recoge unos minutos después,
# sin que nadie tenga que enterarse.
#
# Corre desde cron cada diez minutos, como el usuario del sitio.
# A mano:  sudo -u congreso /usr/local/bin/sincronizar-congreso
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
# cron arranca con un PATH mínimo en el que no está node.
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH

cd "$RAIZ"
exec npm run --silent sincronizar -- --callado
