#!/usr/bin/env bash
# =====================================================================
# Por qué el formulario rechaza un alta.
#
#   bash /opt/congreso/g*/s*/revisar-registro.sh
#
# Mira lo que hay y, al final, intenta un alta de verdad contra el propio
# servidor con un correo recién inventado. Si el alta pasa, el problema no
# está donde se creía; si no pasa, enseña la respuesta entera en vez del
# mensaje recortado que se ve en pantalla.
#
# El registro de prueba se borra solo al terminar.
# =====================================================================
set -uo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"

paso()  { printf '\n\033[1m══ %s\033[0m\n' "$1"; }
aviso() { printf '   %s\n' "$1"; }
bien()  { printf '   \033[32m%s\033[0m\n' "$1"; }
mal()   { printf '   \033[31m%s\033[0m\n' "$1"; }

set -a; . "$RAIZ/.env" 2>/dev/null; set +a
consulta() { sudo -u "$USUARIO" psql "$DATABASE_URL" -tAc "$1" 2>/dev/null; }

# ---------------------------------------------------------------------
paso "Qué versión está puesta"
cd "$RAIZ" 2>/dev/null && git log --oneline -1 2>/dev/null || aviso "no se pudo leer el repositorio"

# ---------------------------------------------------------------------
paso "Registros en la base"
total=$(consulta 'select count(*) from registros')
aviso "Total: ${total:-?}"
if [ "${total:-0}" != "0" ]; then
  sudo -u "$USUARIO" psql "$DATABASE_URL" -c \
    "select folio, estado, coalesce(nullif(correo,''),'(vacío)') as correo,
            length(folio) - 13 as caracteres_del_folio
       from registros order by creado_en desc limit 10" 2>/dev/null
  # Un correo vacío o repetido en la base es lo que haría que cualquier
  # alta nueva pareciera un duplicado.
  vacios=$(consulta "select count(*) from registros where coalesce(correo,'') = '' and estado <> 'cancelado'")
  [ "${vacios:-0}" != "0" ] && mal "Hay ${vacios} registro(s) vigentes con el correo vacío."
fi

# ---------------------------------------------------------------------
paso "El índice que decide si un correo está repetido"
consulta "select indexdef from pg_indexes where indexname = 'registros_correo_vigente_idx'" \
  | sed 's/^/   /' || aviso "no se encontró el índice"

# ---------------------------------------------------------------------
paso "El folio"
largo=$(consulta "select coalesce(max(length(folio)) - 13, 0) from registros")
if [ "${largo:-0}" -ge 6 ]; then
  bien "Los folios más recientes traen ${largo} caracteres: la corrección está puesta."
elif [ "${largo:-0}" = "0" ]; then
  aviso "Todavía no hay folios que mirar."
else
  mal "Folios de ${largo} caracteres: falta desplegar la corrección."
fi

# ---------------------------------------------------------------------
paso "Un alta de verdad, ahora mismo"
correo="prueba.$(date +%s)@ejemplo-de-prueba.org"
aviso "Correo inventado: $correo"

respuesta=$(curl -s -o /tmp/alta.json -w '%{http_code}' \
  -X POST http://localhost:3000/api/registros \
  -H 'content-type: application/json' \
  -d "{\"perfil\":\"publico_general\",\"modalidad\":\"en_linea\",\"idioma\":\"es\",
       \"apellidos\":\"Prueba\",\"nombres\":\"Diagn\\u00f3stico\",\"correo\":\"$correo\",
       \"consentimiento_datos\":true,\"abierto_en\":$(( ($(date +%s) - 60) * 1000 ))}")

printf '   HTTP %s\n' "$respuesta"
printf '   '; cat /tmp/alta.json 2>/dev/null; printf '\n'

case "$respuesta" in
  201) bien "El alta pasa. El formulario también debería." ;;
  409) mal "Rechazada por duplicado. Si el correo de arriba no está en la lista de la base, el problema no es el correo." ;;
  429) mal "Rechazada por límite de envíos desde esta dirección." 
       aviso "Intentos en 24 h desde este servidor: $(consulta "select count(*) from intentos_registro where creado_en > now() - interval '24 hours'")"
       aviso "Límite configurado: $(consulta "select valor::text from configuracion where clave='limite_registros_por_huella'")" ;;
  422) mal "Rechazada por validación. Los campos están arriba." ;;
  *)   mal "Respuesta inesperada." ;;
esac

# El de prueba no se queda: taparía el correo para un alta futura.
borrados=$(consulta "with fuera as (delete from registros where correo = '$correo' returning 1) select count(*) from fuera")
[ "${borrados:-0}" != "0" ] && aviso "Registro de prueba borrado."
rm -f /tmp/alta.json

printf '\n'
