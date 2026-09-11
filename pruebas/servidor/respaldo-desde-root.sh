#!/usr/bin/env bash
# =====================================================================
# El respaldo corre como «postgres», pero lo invoca el despliegue desde
# /root, donde ese usuario no puede entrar. Esta prueba reproduce esa
# combinación, que es la que tumbó el despliegue en producción: probar
# desde un directorio legible no la habría encontrado nunca.
#
#   sudo bash pruebas/servidor/respaldo-desde-root.sh
# =====================================================================
set -uo pipefail

RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
USUARIO=pruebarespaldo
DESTINO=/var/tmp/prueba-respaldo-$$
fallos=0

comprobar() {
  if [ "$2" = "$3" ]; then printf '  ✓ %s\n' "$1"
  else printf '  ✗ %s (esperaba «%s», obtuvo «%s»)\n' "$1" "$3" "$2"; fallos=$((fallos+1)); fi
}

id "$USUARIO" >/dev/null 2>&1 || useradd -M -s /bin/bash "$USUARIO"
install -d -o "$USUARIO" -g "$USUARIO" -m 750 "$DESTINO"
printf 'CREATE TABLE public.registros (id int);\n' > "$DESTINO/simulado.sql"

# Se aísla el tramo que borra lo viejo, que es donde estaba el fallo.
cat > "$DESTINO/tramo.sh" <<'TRAMO'
set -euo pipefail
cd /
find "$1" -name '*.sql.gz' -type f -mtime +30 -delete
echo LIMPIEZA_OK
TRAMO
cat > "$DESTINO/tramo-sin-cd.sh" <<'TRAMO'
set -euo pipefail
find "$1" -name '*.sql.gz' -type f -mtime +30 -delete
echo LIMPIEZA_OK
TRAMO
chmod 755 "$DESTINO"/tramo*.sh

echo "Respaldo invocado desde un directorio que el usuario no puede leer:"
salida=$(cd /root && su "$USUARIO" -s /bin/bash -c "bash $DESTINO/tramo-sin-cd.sh $DESTINO" 2>&1)
comprobar "sin cd / falla, como en producción" "$(echo "$salida" | grep -c 'Failed to restore')" "1"

salida=$(cd /root && su "$USUARIO" -s /bin/bash -c "bash $DESTINO/tramo.sh $DESTINO" 2>&1)
comprobar "con cd / termina limpio" "$(echo "$salida" | tail -1)" "LIMPIEZA_OK"

comprobar "el guion real lleva el cd /" \
  "$(grep -c '^cd /$' "$RAIZ/guiones/servidor/respaldar.sh")" "1"

rm -rf "$DESTINO"; userdel "$USUARIO" 2>/dev/null
[ "$fallos" -eq 0 ] && echo "Todo bien." || { echo "$fallos fallo(s)."; exit 1; }
