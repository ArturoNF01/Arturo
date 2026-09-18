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

# Lo que se pega en una consola web no llega limpio: el terminal envuelve
# el texto en marcas de «bracketed paste» —ESC[200~ delante, ESC[201~
# detrás— y `read` las guarda como si fueran parte de la clave. La clave
# entra entera, pero con basura pegada, y la comprobación la rechazaba sin
# decir por qué. Se quitan esas marcas, los retornos de carro y los
# espacios antes de mirar nada.
# Quita sólo el envoltorio del pegado; los espacios se conservan, que es lo
# que separa una cosa de otra dentro del texto.
desenvolver() {
  printf '%s' "$1" | sed -e $'s/\033\\[20[01]~//g' -e 's/\[20[01]~//g' -e 's/\r//g'
}

limpiar() { printf '%s' "$1" | tr -d '[:space:]'; }

# Resend enseña la clave junto a un ejemplo de `curl` que la lleva dentro,
# y el botón de copiar de ese ejemplo está al lado del de la clave. Quien
# se equivoca de botón pega trescientos caracteres que empiezan por «curl»
# —con la clave buena dentro— y el guion los rechazaba enteros. Si dentro
# de lo pegado hay una sola cosa con forma de clave, se usa esa y se dice.
rescatar() {
  printf '%s' "$1" | grep -oE 're_[A-Za-z0-9_-]{16,}' | sort -u
}

# ---------------------------------------------------------------------
paso "La clave de Resend"
aviso "Se pega y no se ve en pantalla: es normal que no aparezca nada."
aviso "Empieza por «re_». Al pegarla, pulse Enter."

intento=0
while :; do
  intento=$((intento + 1))
  printf '   Clave: '
  read -rs CLAVE
  printf '\n'
  PEGADO=$(desenvolver "${CLAVE:-}")
  CLAVE=$(limpiar "$PEGADO")

  case "$CLAVE" in
    re_*)
      # Se confirma que llegó algo, sin enseñarla: a ciegas no hay manera
      # de saber si el pegado funcionó o si se pulsa Enter sobre nada.
      bien "Recibida: empieza por re_ y tiene $(printf '%s' "$CLAVE" | wc -c | tr -d ' ') caracteres."
      break
      ;;
    '')
      mal "No llegó nada."
      aviso "En la consola del navegador, pegar con Cmd+V a veces no entra."
      aviso "Pruebe con el menú del navegador, o con clic derecho → Pegar."
      ;;
    *)
      # Se busca sobre el pegado con sus espacios: sin ellos, dos claves
      # seguidas se leen como una sola, larga y falsa.
      dentro=$(rescatar "$PEGADO")
      if [ "$(printf '%s\n' "$dentro" | grep -c .)" = "1" ]; then
        CLAVE="$dentro"
        bien "Dentro de lo que pegó había una clave: se usa esa."
        aviso "Empieza por re_ y tiene $(printf '%s' "$CLAVE" | wc -c | tr -d ' ') caracteres."
        break
      fi
      mal "Eso no es una clave de Resend: no empieza por «re_»."
      aviso "Llegaron $(printf '%s' "$CLAVE" | wc -c | tr -d ' ') caracteres, y el primero es «$(printf '%.1s' "$CLAVE")»."
      if [ -n "$dentro" ]; then
        aviso "Y dentro hay más de una cosa con forma de clave: copíela sola."
      else
        aviso "En Resend, el botón de copiar de la clave, no el del ejemplo de curl."
      fi
      ;;
  esac

  [ "$intento" -lt 3 ] || morir "tres intentos sin una clave válida"
  aviso "Inténtelo otra vez."
done

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

salio=sin_probar
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
    && { salio=sí; bien "Enviado. Revise la bandeja —y la carpeta de no deseados."; } \
    || { salio=no; mal "No salió. El motivo está arriba."; }
  cd /
fi

# ---------------------------------------------------------------------
# El final se escribe según lo que pasó, no según lo que se esperaba. Daba
# por hecho que los acuses ya salían aunque la prueba acabara de fallar
# delante, y quien lo lee se va convencido de que terminó y vuelve dos días
# después a preguntar por qué nadie recibe nada.
case "$salio" in
  sí)
    printf '\n\033[1m══ Listo\033[0m\n'
    aviso "Los acuses de registro salen desde ahora."
    aviso "Si alguno falla, el panel lo avisa con el motivo."
    aviso "Los registros que ya estaban sin acuse: púlselos en el panel,"
    aviso "en el aviso rojo, con el botón «Reenviarlos ahora»."
    ;;
  no)
    printf '\n\033[1;31m══ Falta algo\033[0m\n'
    aviso "La clave quedó guardada, pero el envío no funciona todavía."
    aviso "El motivo está unas líneas más arriba, con las palabras de Resend."
    aviso "Lo más común: el dominio sin verificar. En resend.com → Domains,"
    aviso "tiene que decir «Verified»; si dice otra cosa, pulse Verify."
    aviso "Cuando lo arregle, para volver a probar sin repetir todo esto:"
    aviso "  cd $RAIZ && sudo -u $USUARIO npm run revisar-correo -- $DESTINO"
    ;;
  *)
    printf '\n\033[1;33m══ A medias\033[0m\n'
    aviso "La clave quedó guardada, pero no se probó ningún envío."
    aviso "Para comprobarlo de verdad:"
    aviso "  cd $RAIZ && sudo -u $USUARIO npm run revisar-correo -- alguien@ejemplo.org"
    ;;
esac
printf '\n'
