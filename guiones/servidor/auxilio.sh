#!/usr/bin/env bash
# =====================================================================
# El sitio no responde. Este guion dice por qué y, si puede, lo levanta.
#
#   sudo bash /opt/congreso/guiones/servidor/auxilio.sh
#
# Primero mira —servicio, disco, memoria, compilación, registro— y lo
# enseña todo. Después, sólo si el sitio sigue sin responder, intenta
# recuperarlo: recompila desde cero y reinicia. No toca la base de datos
# ni el código: no revierte nada ni trae nada nuevo.
# =====================================================================
set -uo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
PUERTO="${PUERTO:-3000}"

titulo() { printf '\n\033[1m══ %s\033[0m\n' "$1"; }
aviso()  { printf '   %s\n' "$1"; }
bien()   { printf '   \033[32m%s\033[0m\n' "$1"; }
mal()    { printf '   \033[31m%s\033[0m\n' "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "Ejecute con sudo: sudo bash $0" >&2; exit 1; }
cd /

como_usuario() { sudo -u "$USUARIO" env HOME="/home/$USUARIO" "$@"; }

responde() {
  curl -fsS --max-time 5 "http://localhost:$PUERTO/" >/dev/null 2>&1
}

# ---------------------------------------------------------------------
titulo "El sitio, desde dentro del servidor"
codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://localhost:$PUERTO/" 2>/dev/null || echo 000)
case "$codigo" in
  200|30[0-9]) bien "Responde $codigo. El problema no está en el servicio." ;;
  000)         mal  "No responde: nada escuchando en el puerto $PUERTO." ;;
  *)           mal  "Responde $codigo." ;;
esac

titulo "Servicio"
systemctl is-active congreso >/dev/null 2>&1 && bien "activo" || mal "$(systemctl is-active congreso 2>&1)"
systemctl show congreso -p NRestarts --value 2>/dev/null | sed 's/^/   reinicios desde el arranque: /'

titulo "Disco"
# Un despliegue que se queda sin disco deja la compilación a medias, y esa
# es la avería más común y la que menos se parece a lo que uno cree.
df -h "$RAIZ" | awk 'NR<=2'
libre=$(df -Pk "$RAIZ" | awk 'NR==2 {print $4}')
[ "${libre:-0}" -lt 1048576 ] && mal "Queda menos de 1 GB libre: no alcanza para compilar." || true

titulo "Memoria"
free -h | awk 'NR<=2'
if journalctl -u congreso --since '-2 days' 2>/dev/null | grep -qi 'out of memory\|Killed process'; then
  mal "El sistema mató un proceso por falta de memoria en los últimos dos días."
fi

titulo "Compilación"
for carpeta in .next .next-nuevo .next-anterior; do
  if [ -d "$RAIZ/$carpeta" ]; then
    entera=no; [ -f "$RAIZ/$carpeta/BUILD_ID" ] && entera=sí
    printf '   %-16s existe · entera: %s · %s\n' "$carpeta" "$entera" "$(du -sh "$RAIZ/$carpeta" 2>/dev/null | cut -f1)"
  else
    printf '   %-16s no existe\n' "$carpeta"
  fi
done
[ -d "$RAIZ/node_modules" ] && aviso "node_modules: $(du -sh "$RAIZ/node_modules" 2>/dev/null | cut -f1)" \
                            || mal "node_modules NO existe: faltan las dependencias."

titulo "Versión instalada"
git -C "$RAIZ" -c safe.directory="$RAIZ" log --oneline -1 2>/dev/null || aviso "no se pudo leer"

titulo "Últimos errores del servicio"
journalctl -u congreso -n 30 --no-pager 2>/dev/null | tail -30

# ---------------------------------------------------------------------
if responde; then
  titulo "Nada que reparar"
  aviso "El sitio responde desde dentro. Si desde fuera no, mire Caddy:"
  aviso "  systemctl status caddy   ·   journalctl -u caddy -n 30"
  exit 0
fi

titulo "Recuperación"
aviso "Se vuelve a compilar desde cero con el código que ya está instalado."
aviso "No se revierte nada ni se trae nada nuevo."

cd "$RAIZ"
rm -rf "$RAIZ/.next-nuevo"

if [ ! -d "$RAIZ/node_modules" ] || [ ! -d "$RAIZ/node_modules/next" ]; then
  aviso "Reinstalando dependencias…"
  como_usuario npm ci --silent || { mal "No se pudieron reinstalar. El registro de arriba dice por qué."; exit 1; }
fi

aviso "Compilando…"
if como_usuario env NODE_ENV=production NEXT_DIST_DIR=.next-nuevo npm run build --silent \
   && [ -f "$RAIZ/.next-nuevo/BUILD_ID" ]; then
  rm -rf "$RAIZ/.next"
  mv "$RAIZ/.next-nuevo" "$RAIZ/.next"
  chown -R "$USUARIO:$USUARIO" "$RAIZ/.next"
  bien "Compilada."
elif [ -f "$RAIZ/.next-anterior/BUILD_ID" ]; then
  mal "La compilación falló. Se recupera la anterior, que sí estaba entera."
  rm -rf "$RAIZ/.next"
  mv "$RAIZ/.next-anterior" "$RAIZ/.next"
else
  mal "La compilación falló y no hay ninguna anterior que recuperar."
  mal "Lo de arriba dice por qué: casi siempre es el disco o la memoria."
  exit 1
fi

systemctl restart congreso
for _ in $(seq 1 15); do responde && break; sleep 2; done

if responde; then
  titulo "Listo"
  bien "El sitio volvió a responder."
  aviso "https://congreso-dss.ciess.org"
else
  titulo "Sigue caído"
  mal "Compiló, pero el servicio no levanta. Lo que dice el registro ahora:"
  journalctl -u congreso -n 40 --no-pager 2>/dev/null | tail -40
  exit 1
fi
