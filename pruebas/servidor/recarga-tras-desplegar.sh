#!/usr/bin/env bash
# =====================================================================
# Comprueba que poner-al-dia.sh se recarga cuando el despliegue trae una
# versión nueva de sí mismo.
#
# Pasó en el servidor: el despliegue decía «Actualizado a 2edb655», con el
# paso 5 ya en el repositorio, y a continuación corrían los pasos de la
# versión anterior —«4 de 4»— porque la copia de /tmp se hace antes. La
# hoja se quedó vacía y el guion mandaba al panel, que era lo que se
# acababa de quitar.
#
#   bash pruebas/servidor/recarga-tras-desplegar.sh
# =====================================================================
set -Eeuo pipefail

TALLER=$(mktemp -d)
trap 'rm -rf "$TALLER"' EXIT

# --- El repositorio simulado, con su guion «viejo» -------------------
mkdir -p "$TALLER/repo"
GUION="$TALLER/repo/poner-al-dia.sh"

nuevo_guion() {  # $1 = etiqueta de versión
  cat > "$GUION" <<GUION
#!/usr/bin/env bash
set -Eeuo pipefail
ORIGEN="\${ORIGEN:-\$(readlink -f "\$0")}"
export ORIGEN
if [ "\${COPIA_PROPIA:-}" != "sí" ]; then
  copia=\$(mktemp /tmp/prueba-recarga.XXXXXX.sh)
  cp "\$0" "\$copia"; chmod +x "\$copia"
  COPIA_PROPIA=sí exec bash "\$copia" "\$@"
fi
if [ "\${YA_DESPLEGADO:-}" = "sí" ]; then
  echo "despliegue: omitido"
else
  bash "$TALLER/desplegar.sh"
  if [ -f "\$ORIGEN" ] && ! cmp -s "\$ORIGEN" "\$0"; then
    nueva=\$(mktemp /tmp/prueba-recarga.XXXXXX.sh)
    cp "\$ORIGEN" "\$nueva"; chmod +x "\$nueva"
    COPIA_PROPIA=sí YA_DESPLEGADO=sí exec bash "\$nueva" "\$@"
  fi
fi
echo "version: $1"
GUION
  chmod +x "$GUION"
}

nuevo_guion viejo

# --- El «despliegue»: reescribe el guion, como hace git reset --------
cat > "$TALLER/desplegar.sh" <<DESPLIEGUE
#!/usr/bin/env bash
echo "despliegue: hecho"
DESPLIEGUE
chmod +x "$TALLER/desplegar.sh"

fallos=0
comprobar() {  # $1 = qué, $2 = esperado, $3 = obtenido
  if [ "$2" = "$3" ]; then
    printf '  ok   %s\n' "$1"
  else
    printf '  FALLA %s\n       esperado: %s\n       obtenido: %s\n' "$1" "$2" "$3"
    fallos=$((fallos + 1))
  fi
}

# --- 1. El despliegue trae una versión nueva -------------------------
cat >> "$TALLER/desplegar.sh" <<DESPLIEGUE
cat > "$GUION" <<'NUEVO'
#!/usr/bin/env bash
set -Eeuo pipefail
echo "version: nueva"
NUEVO
DESPLIEGUE

salida=$(bash "$GUION" 2>&1)
comprobar "corre la versión que acaba de traer el despliegue" \
  "nueva" "$(printf '%s' "$salida" | sed -n 's/^version: //p')"
comprobar "no repite el despliegue al recargarse" \
  "1" "$(printf '%s\n' "$salida" | grep -c '^despliegue: hecho')"

# --- 2. Sin cambios, no se recarga ni se salta nada ------------------
nuevo_guion estable
cat > "$TALLER/desplegar.sh" <<DESPLIEGUE
#!/usr/bin/env bash
echo "despliegue: hecho"
DESPLIEGUE
chmod +x "$TALLER/desplegar.sh"

salida=$(bash "$GUION" 2>&1)
comprobar "sin cambios sigue de largo" \
  "estable" "$(printf '%s' "$salida" | sed -n 's/^version: //p')"
comprobar "sin cambios no se recarga" \
  "0" "$(printf '%s\n' "$salida" | grep -c '^despliegue: omitido')"

# --- 3. Los argumentos sobreviven a la recarga -----------------------
nuevo_guion viejo
cat > "$TALLER/desplegar.sh" <<DESPLIEGUE
#!/usr/bin/env bash
echo "despliegue: hecho"
cat > "$GUION" <<'NUEVO'
#!/usr/bin/env bash
set -Eeuo pipefail
echo "version: nueva"
echo "argumento: \${1:-ninguno}"
NUEVO
DESPLIEGUE
chmod +x "$TALLER/desplegar.sh"

salida=$(bash "$GUION" --demostracion 2>&1)
comprobar "--demostracion llega a la versión nueva" \
  "--demostracion" "$(printf '%s' "$salida" | sed -n 's/^argumento: //p')"

echo
if [ "$fallos" -eq 0 ]; then
  echo "Todo en orden."
else
  echo "$fallos comprobaciones fallaron."
  exit 1
fi
