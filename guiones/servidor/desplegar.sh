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

# Este guion se reescribe a sí mismo: unas líneas más abajo hace «git reset»
# sobre el repositorio donde vive. Y bash no lee los guiones enteros, los va
# leyendo por donde va: cambiarle el archivo debajo lo deja siguiendo por un
# desplazamiento que en el archivo nuevo cae en cualquier sitio. Se ejecuta
# entonces un trozo de otra línea, o ninguna, y sin un solo mensaje de error.
#
# Eso tumbó el sitio: la actualización decía haber terminado y el servicio se
# reiniciaba sin haber compilado. Por eso lo primero es apartarse del
# repositorio y trabajar desde una copia, que ya nadie va a tocar.
if [ "${COPIA_PROPIA:-}" != "sí" ]; then
  copia=$(mktemp /tmp/desplegar.XXXXXX.sh)
  cp "$0" "$copia"
  chmod +x "$copia"
  COPIA_PROPIA=sí exec bash "$copia" "$@"
fi

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
  rm -rf "$RAIZ/.next-nuevo"

  # Lo de antes sigue compilado: se recupera tal cual. Volver a compilar
  # aquí era pedirle al servidor justo lo que acababa de salirle mal, y si
  # la causa seguía ahí —disco lleno, memoria— el sitio se quedaba caído.
  if [ -d "$RAIZ/.next-anterior" ]; then
    rm -rf "$RAIZ/.next"
    mv "$RAIZ/.next-anterior" "$RAIZ/.next"
    aviso "Recuperada la compilación anterior."
  else
    como_usuario npm ci --silent || true
    como_usuario env NODE_ENV=production npm run build --silent || true
  fi
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
paso "Dependencias"
cd "$RAIZ"
# «npm ci» borra node_modules y lo rehace. El sitio está corriendo con esos
# archivos: si la reinstalación se queda a medias —sin disco, sin red— se
# lleva por delante al servidor que estaba en pie. Así que sólo se hace
# cuando de verdad cambiaron las dependencias, que es casi nunca.
if [ -z "$(en_repo diff --name-only "$ANTERIOR" "$NUEVO" -- package.json package-lock.json)" ] \
   && [ -d "$RAIZ/node_modules" ]; then
  aviso "Sin cambios; no hace falta reinstalarlas."
else
  como_usuario npm ci --silent
  aviso "Reinstaladas."
fi

# ---------------------------------------------------------------------
paso "Compilación"
# Se compila en una carpeta aparte y sólo al final se cambia por la buena.
# Compilar encima de la que el sitio está sirviendo lo tumbaba en cuanto
# algo fallaba a mitad: quedaba a medio escribir y ya no arrancaba nada.
rm -rf "$RAIZ/.next-nuevo"
como_usuario env NODE_ENV=production NEXT_DIST_DIR=.next-nuevo npm run build --silent
[ -f "$RAIZ/.next-nuevo/BUILD_ID" ] || morir "la compilación terminó incompleta"
aviso "Compilada."

rm -rf "$RAIZ/.next-anterior"
[ -d "$RAIZ/.next" ] && mv "$RAIZ/.next" "$RAIZ/.next-anterior"
mv "$RAIZ/.next-nuevo" "$RAIZ/.next"

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
