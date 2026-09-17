#!/usr/bin/env bash
# =====================================================================
# Deja el congreso sin registros: borra los de la base y vacía la hoja.
#
#   sudo bash /opt/congreso/guiones/servidor/limpiar-registros.sh
#
# Es para el momento de abrir el registro de verdad, cuando lo que hay
# son pruebas y datos de demostración.
#
# NO SE PUEDE DESHACER desde aquí. Antes de borrar nada hace un respaldo
# completo de la base y dice dónde queda: de ahí sí se recupera.
#
# Lo que NO toca: las cuentas del panel, la configuración, el contenido
# del sitio, ni los archivos que ya estén en Drive.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"

# Se trabaja desde una copia, fuera del repositorio: si alguien despliega
# mientras esto corre, el archivo cambiaría debajo a media ejecución.
if [ "${COPIA_PROPIA:-}" != "sí" ]; then
  copia=$(mktemp /tmp/limpiar-registros.XXXXXX.sh)
  cp "$0" "$copia"
  chmod +x "$copia"
  COPIA_PROPIA=sí exec bash "$copia" "$@"
fi

paso()  { printf '\n\033[1m══ %s\033[0m\n' "$1"; }
aviso() { printf '   %s\n' "$1"; }
bien()  { printf '   \033[32m%s\033[0m\n' "$1"; }
mal()   { printf '   \033[31m%s\033[0m\n' "$1"; }
morir() { printf '\n\033[31mAlto: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || morir "ejecute con sudo: sudo bash $0"
cd /

set -a; . "$RAIZ/.env"; set +a
consulta() { sudo -u "$USUARIO" psql "$DATABASE_URL" -tAc "$1"; }

# ---------------------------------------------------------------------
paso "Qué se va a borrar"
total=$(consulta 'select count(*) from registros')
demo=$(consulta "select count(*) from registros where folio like 'REG-DEMO-%'")
reales=$((total - demo))

aviso "Registros en la base: $total"
aviso "  de demostración:    $demo"
aviso "  reales:             $reales"

if [ "$total" -eq 0 ]; then
  bien "No hay nada que borrar."
  exit 0
fi

# Los reales son los que duelen. Se enseñan para que quien lo ejecute vea
# qué está a punto de perder, no un número.
if [ "$reales" -gt 0 ]; then
  printf '\n'
  aviso "Los registros reales que se perderán:"
  sudo -u "$USUARIO" psql "$DATABASE_URL" -c \
    "select folio, apellidos || ', ' || nombres as persona, correo,
            to_char(creado_en, 'DD/MM/YYYY') as fecha
       from registros
      where folio not like 'REG-DEMO-%'
      order by creado_en desc
      limit 25"
  [ "$reales" -gt 25 ] && aviso "…y $((reales - 25)) más."
fi

# ---------------------------------------------------------------------
paso "Respaldo antes de tocar nada"
if [ -x /usr/local/bin/respaldar-congreso ]; then
  /usr/local/bin/respaldar-congreso
else
  bash "$RAIZ/guiones/servidor/respaldar.sh"
fi
ultimo=$(ls -t /var/respaldos/congreso/*.sql.gz 2>/dev/null | head -1 || true)
[ -n "$ultimo" ] || morir "no se pudo respaldar; no se borra nada"
bien "Respaldo: $ultimo"

# ---------------------------------------------------------------------
paso "Confirmación"
# Escribir la palabra completa, no una tecla: nadie borra cien registros
# por pulsar «s» sin leer.
printf '   Esto borra \033[1m%s registros\033[0m y vacía la hoja de Google.\n' "$total"
printf '   Para continuar, escriba BORRAR y pulse Enter: '
read -r respuesta
if [ "$respuesta" != "BORRAR" ]; then
  printf '\n'
  bien "No se borró nada."
  exit 0
fi

# ---------------------------------------------------------------------
paso "1 de 2 · La base"
# `delete` y no `truncate`: los disparadores dejan constancia en la
# auditoría de quién borró qué y cuándo, y eso es lo que permite explicar
# después por qué la tabla está vacía.
borrados=$(consulta 'with fuera as (delete from registros returning 1) select count(*) from fuera')
bien "Borrados $borrados registros."
aviso "Los archivos que ya estén en Drive siguen ahí: eso se limpia a mano."

# ---------------------------------------------------------------------
paso "2 de 2 · La hoja de Google"
hoja=vaciada
if grep -q '^GOOGLE_PRIVATE_KEY=' "$RAIZ/.env"; then
  cd "$RAIZ"
  sudo -u "$USUARIO" env $(grep '^DATABASE_URL=' "$RAIZ/.env") \
    npm run sincronizar -- --vaciar || hoja=fallo
  cd /
else
  hoja=sin_google
  aviso "Google no está conectado: no hay hoja que vaciar."
fi

# ---------------------------------------------------------------------
printf '\n\033[1m══ Listo\033[0m\n'
aviso "Registros en la base: $(consulta 'select count(*) from registros')"
case "$hoja" in
  vaciada)    aviso "La hoja quedó con sus encabezados y nada más." ;;
  sin_google) aviso "No se tocó ninguna hoja: Google no está conectado." ;;
  fallo)
    mal "La hoja NO se pudo vaciar; el motivo está más arriba."
    aviso "Para reintentarlo: cd $RAIZ && sudo -u $USUARIO npm run sincronizar -- --vaciar"
    ;;
esac
printf '\n'
aviso "Si esto fue un error, el respaldo está en:"
aviso "  $ultimo"
aviso "Se restaura con: gunzip -c ARCHIVO | sudo -u postgres psql congreso"
printf '\n'
