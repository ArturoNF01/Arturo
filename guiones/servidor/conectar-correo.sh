#!/usr/bin/env bash
# =====================================================================
# Conecta el envío de correo, para que salgan los acuses de registro.
#
#   sudo bash /opt/congreso/guiones/servidor/conectar-correo.sh
#
# Antes de ejecutarlo hacen falta dos cosas, y las dos se hacen en
# resend.com, que es gratis hasta 3.000 correos al mes.
#
# --- 1. Verificar el dominio ------------------------------------------
#
#   Domains → Add Domain → ciess.org
#
#   Resend devuelve tres registros que hay que dar de alta donde viva el
#   DNS de ciess.org —en nuestro caso, DigitalOcean, la misma cuenta del
#   droplet—:
#
#     TXT    resend._domainkey   p=MIGfMA…        (DKIM, la firma)
#     CNAME  rsend               rsend.…mta.net   (SPF)
#     CNAME  send                send.…mta.net    (SPF)
#
#   Se AÑADEN; no se sustituye ningún registro existente. Ninguno de los
#   tres toca el MX del dominio, así que el correo que ya recibe ciess.org
#   sigue igual. «Enable Receiving» se deja apagado: este sistema sólo
#   envía.
#
#   Luego, «I've already added the records». Tarda de unos minutos a unas
#   horas en propagarse, hasta que el dominio queda en «Verified».
#
#   Sin este paso los correos salen rechazados: es lo que impide que
#   cualquiera escriba en nombre del dominio.
#
# --- 2. Crear la clave ------------------------------------------------
#
#   API Keys → Create API Key
#     Name       · algo que se reconozca, «congreso-dss»
#     Permission · Sending access   (no hace falta Full access)
#     Domain     · ciess.org, para que sólo sirva para este dominio
#
#   La clave se enseña UNA sola vez, al crearla. Si se cierra esa
#   ventana sin copiarla, no se puede volver a ver: se crea otra.
#
#   Es una credencial: no se manda por WhatsApp ni por correo. Este
#   guion la pide sin mostrarla en pantalla.
#
# El guion pide la clave sin mostrarla, la guarda en el .env, reinicia
# el servicio y manda un correo de prueba para comprobar que sale.
#
# Si después de todo esto los acuses siguen sin llegar:
#
#   cd /opt/congreso && sudo -u congreso npm run revisar-correo
#
# recorre los cinco eslabones —clave, dominio verificado, remitente,
# plantillas y envío— y dice en cuál se rompe.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"

# Se trabaja desde una copia: si alguien despliega mientras esto corre, el
# archivo cambiaría debajo a media ejecución.
if [ "${COPIA_PROPIA:-}" != "sí" ]; then
  copia=$(mktemp /tmp/conectar-correo.XXXXXX.sh)
  cp "$0" "$copia"; chmod +x "$copia"
  COPIA_PROPIA=sí exec bash "$copia" "$@"
fi

paso()  { printf '\n\033[1m══ %s\033[0m\n' "$1"; }
aviso() { printf '   %s\n' "$1"; }
bien()  { printf '   \033[32m%s\033[0m\n' "$1"; }
mal()   { printf '   \033[31m%s\033[0m\n' "$1"; }
morir() { printf '\n\033[31mAlto: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || morir "ejecute con sudo: sudo bash $0"
cd /

# ---------------------------------------------------------------------
paso "La clave de Resend"
aviso "Se pega y no se ve en pantalla. Empieza por «re_»."
printf '   Clave: '
read -rs CLAVE
printf '\n'

[ -n "$CLAVE" ] || morir "no se escribió ninguna clave"
case "$CLAVE" in
  re_*) ;;
  *) morir "eso no parece una clave de Resend: debe empezar por «re_»" ;;
esac

# ---------------------------------------------------------------------
paso "La dirección del remitente"
aviso "Tiene que ser del dominio verificado en Resend."
aviso "Por ejemplo: Congreso CIESS <congreso@ciess.org>"
printf '   Remitente: '
read -r REMITENTE
[ -n "$REMITENTE" ] || morir "hace falta una dirección de remitente"

# ---------------------------------------------------------------------
paso "Guardar en el .env"
# Se quitan las líneas anteriores antes de escribir las nuevas: dos valores
# para la misma variable dejan al servicio usando el que no es.
sed -i '/^RESEND_API_KEY=/d;/^CORREO_REMITENTE=/d' "$RAIZ/.env"
printf 'RESEND_API_KEY=%s\nCORREO_REMITENTE=%s\n' "$CLAVE" "$REMITENTE" >> "$RAIZ/.env"
chown "$USUARIO:$USUARIO" "$RAIZ/.env"
chmod 600 "$RAIZ/.env"
bien "Guardado. El archivo sólo lo puede leer el usuario del servicio."

# ---------------------------------------------------------------------
paso "Reiniciar el servicio"
systemctl restart congreso
for _ in $(seq 1 15); do
  curl -fsS --max-time 3 http://localhost:3000/ >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS --max-time 5 http://localhost:3000/ >/dev/null 2>&1 \
  || morir "el sitio no volvió a responder; revise: journalctl -u congreso -n 40"
bien "El sitio responde."

# ---------------------------------------------------------------------
paso "Correo de prueba"
printf '   ¿A qué dirección lo mandamos? '
read -r DESTINO

if [ -z "$DESTINO" ]; then
  aviso "Sin dirección: se salta la prueba."
else
  cd "$RAIZ"
  # La prueba se hace con el mismo código que usa el sitio, no con curl a
  # Resend: lo que interesa saber es si el servicio puede enviar, no si la
  # clave existe.
  sudo -u "$USUARIO" env \
    $(grep -E '^(RESEND_API_KEY|CORREO_REMITENTE|DATABASE_URL)=' "$RAIZ/.env" | tr '\n' ' ') \
    npx tsx --conditions=react-server guiones/probar-correo.ts "$DESTINO" \
    && bien "Enviado. Revise la bandeja —y la carpeta de no deseados." \
    || mal "No salió. El motivo está arriba."
  cd /
fi

# ---------------------------------------------------------------------
printf '\n\033[1m══ Listo\033[0m\n'
aviso "Los acuses de registro salen desde ahora."
aviso "Si alguno falla, el panel lo avisa con el motivo."
printf '\n'
