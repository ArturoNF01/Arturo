#!/usr/bin/env bash
# =====================================================================
# Actualiza el sitio con la última versión del repositorio.
#
#   sudo bash /opt/congreso/guiones/servidor/desplegar.sh
#
# Antes de tocar nada respalda la base y anota en qué versión estábamos.
# Si la compilación falla, o si el sitio no responde después de
# reiniciar, vuelve solo a la versión anterior: nunca deja el sitio
# caído por una actualización que salió mal.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
PUERTO="${PUERTO:-3000}"

paso()  { printf '\n\033[1m── %s\033[0m\n' "$1"; }
aviso() { printf '   %s\n' "$1"; }
morir() { printf '\n\033[31mAlto: %s\033[0m\n' "$1" >&2; exit 1; }

como_usuario() { sudo -u "$USUARIO" env HOME="/home/$USUARIO" "$@"; }

# El repositorio es del usuario del servicio, pero estas órdenes corren como
# root, y git se niega a operar sobre un repositorio ajeno: es su defensa
# contra que alguien sin privilegios le cuele configuración a root. Se
# declara la excepción aquí, para este repositorio y esta invocación, en vez
# de tocar la configuración global del servidor.
en_repo() { git -C "$RAIZ" -c safe.directory="$RAIZ" "$@"; }

[ "$(id -u)" -eq 0 ] || morir "Ejecute con sudo: sudo bash $RAIZ/guiones/servidor/desplegar.sh"
[ -d "$RAIZ/.git" ] || morir "No encuentro la instalación en $RAIZ. ¿Corrió antes instalar.sh?"

# Todo el despliegue corre desde la carpeta del proyecto. Se suele invocar
# desde /root, y varios pasos cambian a otro usuario —postgres, el del
# servicio— que no puede entrar ahí: basta con eso para que una orden tan
# inocente como «find» se queje y tumbe el despliegue entero.
cd "$RAIZ"

# Se actualiza desde la misma rama que se instaló, no desde una fija: si
# el servidor quedó en una rama de pruebas, traerle master lo cambiaría
# por debajo sin avisar.
RAMA="${RAMA:-$(en_repo rev-parse --abbrev-ref HEAD)}"
[ "$RAMA" != "HEAD" ] || morir "La instalación no está en ninguna rama. Indique cuál: sudo RAMA=master bash $0"

# ¿Responde el sitio? Se le dan hasta 30 segundos para arrancar.
responde() {
  for _ in $(seq 1 15); do
    if curl -fsS --max-time 3 "http://localhost:$PUERTO/api/salud" >/dev/null 2>&1 \
    || curl -fsS --max-time 3 "http://localhost:$PUERTO/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# ---------------------------------------------------------------------
paso "Respaldo previo"
if [ -x "$RAIZ/guiones/servidor/respaldar.sh" ]; then
  # Se usa la copia del repositorio, no la instalada en /usr/local/bin: así
  # las dos no se separan con el tiempo y una corrección llega enseguida.
  bash "$RAIZ/guiones/servidor/respaldar.sh"
else
  aviso "No encuentro el guion de respaldo; se continúa sin respaldar."
fi

# ---------------------------------------------------------------------
paso "Versión actual"
ANTERIOR=$(en_repo rev-parse HEAD)
aviso "$(en_repo log --oneline -1)"

volver_atras() {
  printf '\n\033[33mAlgo falló. Volviendo a la versión anterior…\033[0m\n'
  en_repo reset --hard --quiet "$ANTERIOR"
  chown -R "$USUARIO:$USUARIO" "$RAIZ"
  cd "$RAIZ"
  como_usuario npm ci --silent || true
  como_usuario env NODE_ENV=production npm run build --silent || true
  systemctl restart congreso
  if responde; then
    morir "La actualización no sirvió, pero el sitio volvió a la versión anterior y sigue en línea."
  fi
  morir "La actualización falló y la versión anterior tampoco arranca. Revise: journalctl -u congreso -n 50"
}

# ---------------------------------------------------------------------
paso "Traer los cambios"
en_repo fetch --quiet origin "$RAMA"
NUEVO=$(en_repo rev-parse "origin/$RAMA")

if [ "$ANTERIOR" = "$NUEVO" ]; then
  aviso "Ya estaba en la última versión. No hay nada que actualizar."
  exit 0
fi

en_repo reset --hard --quiet "origin/$RAMA"
chown -R "$USUARIO:$USUARIO" "$RAIZ"
aviso "Ahora en: $(en_repo log --oneline -1)"
aviso "Cambios: $(en_repo log --oneline "$ANTERIOR..$NUEVO" | wc -l) commit(s)."

# A partir de aquí, cualquier tropiezo nos regresa a donde estábamos.
trap volver_atras ERR

# ---------------------------------------------------------------------
paso "Guiones del sistema"
# El respaldo nocturno corre desde /usr/local/bin, así que sin esto una
# corrección al respaldo no llegaría nunca a la tarea de cada noche.
if [ -f "$RAIZ/guiones/servidor/respaldar.sh" ]; then
  install -m 755 "$RAIZ/guiones/servidor/respaldar.sh" /usr/local/bin/respaldar-congreso
  aviso "Respaldo nocturno al día."
fi
if [ -f "$RAIZ/guiones/servidor/sincronizar.sh" ]; then
  install -m 755 "$RAIZ/guiones/servidor/sincronizar.sh" /usr/local/bin/sincronizar-congreso
  install -o "$USUARIO" -g "$USUARIO" -m 750 -d /var/log/congreso
  # Los servidores instalados antes de que existiera esta tarea no la
  # tienen en su cron: se añade aquí, y sólo si falta, para no duplicarla
  # en cada despliegue.
  if [ -f /etc/cron.d/congreso ] && ! grep -q 'sincronizar-congreso' /etc/cron.d/congreso; then
    printf '%s\n%s\n' \
      '# Rezagados de la hoja de Google: lo normal es que no haya ninguno' \
      "*/10 * * * * $USUARIO /usr/local/bin/sincronizar-congreso >> /var/log/congreso/hoja.log 2>&1" \
      >> /etc/cron.d/congreso
    aviso "Añadida la recogida de rezagados de la hoja, cada diez minutos."
  fi
  aviso "Copia a la hoja de Google al día."
fi

# ---------------------------------------------------------------------
paso "Esquema de la base"
# El esquema se puede volver a aplicar entero sin romper nada, así que
# se ejecuta siempre: es lo que trae las tablas o columnas nuevas.
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d congreso -f "$RAIZ/basedatos/esquema.sql"
sudo -u postgres psql -q -d congreso -c "grant all on all tables in schema public to congreso;
  grant all on all sequences in schema public to congreso;" >/dev/null
aviso "Al día."

# ---------------------------------------------------------------------
paso "Compilación"
cd "$RAIZ"
como_usuario npm ci --silent
como_usuario env NODE_ENV=production npm run build --silent
aviso "Compilada."

# ---------------------------------------------------------------------
paso "Reinicio"
systemctl restart congreso
responde || volver_atras
trap - ERR
aviso "El sitio responde."

# ---------------------------------------------------------------------
paso "Listo"
cat <<FIN

   Actualizado a: $(en_repo log --oneline -1)
   Comprobación:  https://$(grep -m1 '^NEXT_PUBLIC_URL_SITIO=' "$RAIZ/.env" | sed 's|.*//||')/diagnostico

FIN
