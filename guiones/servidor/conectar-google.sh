#!/usr/bin/env bash
# =====================================================================
# Conecta el sistema con Google Sheets a partir del archivo de llave
# que descarga la consola de Google.
#
#   sudo bash conectar-google.sh /tmp/llave.json ID_DE_LA_HOJA
#
# Se hace con un guion y no a mano porque la llave privada lleva saltos
# de línea, y al pegarla en un editor se parten o se pierden: es el error
# más común de este trámite y deja un fallo difícil de leer.
#
# El archivo de llave se borra al terminar: una vez dentro del .env no
# tiene por qué quedarse por ahí.
# =====================================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/congreso}"
USUARIO="${USUARIO:-congreso}"
ENTORNO="$RAIZ/.env"

aviso() { printf '   %s\n' "$1"; }
morir() { printf '\n\033[31mAlto: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || morir "Ejecute con sudo."
cd /

LLAVE="${1:-}"
HOJA="${2:-}"
[ -n "$LLAVE" ] && [ -f "$LLAVE" ] || morir "Uso: sudo bash conectar-google.sh <archivo.json> <id-de-la-hoja>"
[ -n "$HOJA" ] || morir "Falta el identificador de la hoja (el trozo largo de su dirección web)."
[ -f "$ENTORNO" ] || morir "No encuentro $ENTORNO. ¿Está instalado el sistema?"

# ---------------------------------------------------------------------
# Crear el archivo con «cat >» y no cerrarlo con Ctrl+D hace que las órdenes
# tecleadas después acaben dentro. Es el tropiezo más común de este trámite,
# y tiene arreglo evidente: quedarse con el JSON y descartar lo que venga
# detrás de su llave de cierre. Se avisa, pero no se detiene por ello.
if ! node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$LLAVE" 2>/dev/null; then
  # El corte se hace contando llaves, no buscando una línea con «}»: según
  # cómo se haya pegado, lo de más puede quedar enganchado a la misma línea.
  if node -e '
    const fs = require("fs");
    const texto = fs.readFileSync(process.argv[1], "utf8");
    let hondo = 0, dentro = false, escapado = false, corte = -1;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (escapado) { escapado = false; continue; }
      if (c === "\\") { escapado = true; continue; }
      if (c === "\"") { dentro = !dentro; continue; }
      if (dentro) continue;
      if (c === "{") hondo++;
      else if (c === "}" && --hondo === 0) { corte = i + 1; break; }
    }
    if (corte < 0) process.exit(1);
    const recortado = texto.slice(0, corte);
    JSON.parse(recortado);              // si no es válido, no se toca nada
    fs.writeFileSync(process.argv[1], recortado + "\n");
  ' "$LLAVE" 2>/dev/null; then
    aviso "El archivo traía texto de más al final; se recortó al JSON."
  fi
fi

# Leer el JSON con node, que ya está instalado: así los saltos de línea
# de la llave se manejan como lo que son y no como texto a trocear.
datos=$(node -e '
  const fs = require("fs");
  const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!j.client_email || !j.private_key) {
    console.error("El archivo no parece una llave de cuenta de servicio: le faltan client_email o private_key.");
    process.exit(1);
  }
  if (j.type !== "service_account") {
    console.error(`El archivo es de tipo "${j.type}", y hace falta uno de tipo "service_account".`);
    process.exit(1);
  }
  // La llave se guarda con los saltos escapados, que es como sabe leerla
  // la aplicación y como sobrevive dentro de un archivo de entorno.
  process.stdout.write(j.client_email + "\n" + JSON.stringify(j.private_key));
' "$LLAVE") || morir "el archivo no sirve como llave; arriba dice por qué.

  Si lo creó con «cat > archivo.json» y pegó el contenido, hay que cerrar
  con Ctrl+D. Sin eso, cat sigue capturando y lo que se teclee después acaba
  dentro del archivo. Ese caso se arregla solo; los demás, no."

CORREO=$(printf '%s' "$datos" | head -1)
CLAVE=$(printf '%s' "$datos" | tail -n +2)

aviso "Cuenta de servicio: $CORREO"
aviso "Hoja de cálculo:    $HOJA"

# ---------------------------------------------------------------------
# Escribir en el .env, reemplazando lo que hubiera (comentado o no).
poner() {
  local nombre="$1" valor="$2"
  # Se quita cualquier línea previa, activa o comentada, y se añade al final.
  sed -i "/^#\? *${nombre}=/d" "$ENTORNO"
  printf '%s=%s\n' "$nombre" "$valor" >> "$ENTORNO"
}

cp "$ENTORNO" "$ENTORNO.antes-de-google"
poner GOOGLE_SERVICE_ACCOUNT_EMAIL "$CORREO"
poner GOOGLE_PRIVATE_KEY "$CLAVE"
poner GOOGLE_SHEETS_ID "$HOJA"

chown "$USUARIO:$USUARIO" "$ENTORNO" "$ENTORNO.antes-de-google"
chmod 600 "$ENTORNO" "$ENTORNO.antes-de-google"
aviso "Credenciales guardadas. Copia del archivo anterior en $ENTORNO.antes-de-google"

# ---------------------------------------------------------------------
shred -u "$LLAVE" 2>/dev/null || rm -f "$LLAVE"
aviso "El archivo de llave se borró del servidor."

systemctl restart congreso
sleep 3
systemctl is-active --quiet congreso || {
  journalctl -u congreso -n 20 --no-pager
  morir "El servicio no volvió a arrancar; arriba está el registro."
}

printf '\n\033[1mListo.\033[0m Falta comprobarlo desde el panel:\n\n'
printf '   1. Comparta la hoja con %s como Editor.\n' "$CORREO"
printf '   2. Entre al panel, abra un registro y pulse «Sincronizar».\n'
printf '   3. O revise https://congreso-dss.ciess.org/diagnostico\n\n'
