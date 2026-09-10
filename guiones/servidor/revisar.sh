#!/usr/bin/env bash
# =====================================================================
# Reconocimiento del servidor. NO instala ni cambia nada: sólo mira.
#
#   bash revisar.sh
#
# Sirve para decidir si este servidor es buen candidato y qué instalar,
# sin tocar lo que ya esté corriendo.
# =====================================================================
set -uo pipefail

titulo() { printf '\n──── %s\n' "$1"; }

titulo "Sistema"
. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || echo "sistema desconocido"
echo "Arquitectura: $(uname -m) · Núcleo: $(uname -r)"

titulo "Memoria y disco"
free -h 2>/dev/null | awk 'NR<=2'
df -h / 2>/dev/null | awk 'NR<=2'

titulo "Puertos ocupados (los que importan)"
if command -v ss >/dev/null; then
  ss -lntp 2>/dev/null | awk 'NR==1 || $4 ~ /:(80|443|3000|5432|8080)$/'
else
  netstat -lntp 2>/dev/null | awk 'NR<=2 || $4 ~ /:(80|443|3000|5432|8080)$/'
fi

titulo "Servicios web y bases ya instalados"
for programa in nginx apache2 httpd caddy postgres psql mysql node npm git docker plesk; do
  ruta=$(command -v "$programa" 2>/dev/null)
  if [ -n "$ruta" ]; then
    version=$("$programa" --version 2>/dev/null | head -1)
    printf '  %-10s sí   %s\n' "$programa" "${version:-$ruta}"
  else
    printf '  %-10s no\n' "$programa"
  fi
done

titulo "Servicios activos"
if command -v systemctl >/dev/null; then
  systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null \
    | awk '{print "  " $1}' | head -25
fi

titulo "Sitios servidos (si hay nginx o apache)"
ls /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/  nginx: /'
ls /etc/apache2/sites-enabled/ 2>/dev/null | sed 's/^/  apache: /'

titulo "Resumen"
echo "Pega TODO este texto en la conversación."
