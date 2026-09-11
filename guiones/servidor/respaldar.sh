#!/usr/bin/env bash
# =====================================================================
# Respaldo de la base de datos del congreso.
#
# Lo instala instalar.sh como /usr/local/bin/respaldar-congreso y lo
# ejecuta solo cada noche a las 03:15. También se puede correr a mano:
#
#   sudo respaldar-congreso
#
# Guarda un archivo comprimido por día en /var/respaldos/congreso y
# borra los que pasen de 30 días. Un respaldo que nunca se probó no es
# un respaldo, así que al final verifica que el archivo se pueda leer.
#
# PARA RESTAURAR (esto borra los datos actuales y deja los del respaldo):
#
#   systemctl stop congreso
#   sudo -u postgres dropdb congreso
#   sudo -u postgres createdb -O congreso congreso
#   gunzip -c /var/respaldos/congreso/congreso-AAAA-MM-DD-HHMM.sql.gz \
#     | sudo -u postgres psql -d congreso
#   systemctl start congreso
# =====================================================================
set -euo pipefail

BASE="${BASE:-congreso}"
DESTINO="${DESTINO:-/var/respaldos/congreso}"
DIAS="${DIAS:-30}"

# pg_dump se conecta por el socket local como superusuario de PostgreSQL:
# así el respaldo no necesita ninguna contraseña guardada en ningún lado.
if [ "$(id -un)" != "postgres" ]; then
  [ "$(id -u)" -eq 0 ] || { echo "Ejecute con sudo: sudo respaldar-congreso" >&2; exit 1; }
  exec sudo -u postgres BASE="$BASE" DESTINO="$DESTINO" DIAS="$DIAS" "$0" "$@"
fi

# Se corre desde la raíz porque «sudo» conserva el directorio actual, y este
# guion suele invocarse desde /root —el despliegue va como root—, donde el
# usuario postgres no puede entrar. Con el directorio actual prohibido, find
# se queja al terminar y tumba el respaldo entero.
cd /

mkdir -p "$DESTINO"

marca=$(date +%Y-%m-%d-%H%M)
archivo="$DESTINO/$BASE-$marca.sql.gz"
parcial="$archivo.parcial"

# Se escribe con otro nombre y se renombra al final: si el proceso se
# corta a la mitad, no queda un archivo incompleto haciéndose pasar por
# un respaldo bueno.
pg_dump --no-owner --no-privileges "$BASE" | gzip -9 > "$parcial"

# Comprobación: el archivo se descomprime entero y trae la tabla que
# importa. Un volcado truncado falla aquí y no llega a renombrarse.
gzip -t "$parcial"
# Sin «-q» a propósito: grep -q cierra la tubería en cuanto encuentra lo que
# busca, gunzip muere con la tubería rota y pipefail lo lee como un fallo.
# Es decir, con -q la comprobación fallaba justo cuando el respaldo estaba
# bien. Con -c lee el volcado entero y responde por lo que de verdad hay.
gunzip -c "$parcial" | grep -c 'CREATE TABLE public.registros' > /dev/null \
  || { rm -f "$parcial"; echo "El respaldo salió incompleto: no contiene la tabla de registros." >&2; exit 1; }

mv "$parcial" "$archivo"
chmod 640 "$archivo"

# Se borran los viejos sólo después de que el nuevo quedó bien.
find "$DESTINO" -name "$BASE-*.sql.gz" -type f -mtime "+$DIAS" -delete
find "$DESTINO" -name "$BASE-*.sql.gz.parcial" -type f -mtime +1 -delete

tamano=$(du -h "$archivo" | cut -f1)
cuantos=$(find "$DESTINO" -name "$BASE-*.sql.gz" -type f | wc -l)
echo "$(date '+%Y-%m-%d %H:%M') · respaldo $archivo ($tamano) · $cuantos en total"
