#!/usr/bin/env bash
# =====================================================================
# Un guion que hace «git reset» sobre el repositorio donde vive se
# reescribe a sí mismo a media ejecución. Bash lo va leyendo por donde
# va, así que sigue por un desplazamiento que en el archivo nuevo cae
# en cualquier sitio: se ejecuta un trozo de otra línea, o ninguna, y
# sin un solo mensaje de error.
#
# Le pasó a desplegar.sh: la actualización decía haber terminado y el
# servicio se reiniciaba sin haber compilado. El sitio quedó en
# «Internal Server Error».
#
#   bash pruebas/servidor/guion-que-se-reescribe.sh
# =====================================================================
set -Eeuo pipefail

TALLER=$(mktemp -d)
trap 'rm -rf "$TALLER"' EXIT

fallos=0
comprobar() {  # $1 = qué, $2 = esperado, $3 = obtenido
  if [ "$2" = "$3" ]; then
    printf '  ok    %s\n' "$1"
  else
    printf '  FALLA %s\n        esperado: %s\n        obtenido: %s\n' "$1" "$2" "$3"
    fallos=$((fallos + 1))
  fi
}

# La versión nueva es más larga, que es el caso real: se le añadieron
# líneas al guion. Los desplazamientos dejan de cuadrar.
nueva_version() {
  cat > "$1" <<'NUEVA'
#!/usr/bin/env bash
# Comentario nuevo que alarga el archivo y descoloca todo lo que venga
# detrás, exactamente igual que un commit que añade un paso al guion.
# Otra línea más, para que el desplazamiento quede bien lejos.
echo "version: nueva"
echo "paso: compilar"
echo "paso: reiniciar"
NUEVA
}

# --- Sin protección: se reescribe y se pierde ------------------------
sin=$TALLER/sin.sh
cat > "$sin" <<SINPROT
#!/usr/bin/env bash
set -Eeuo pipefail
echo "paso: traer los cambios"
$(declare -f nueva_version)
nueva_version "$sin"
echo "paso: compilar"
echo "paso: reiniciar"
SINPROT

salida_sin=$(bash "$sin" 2>&1 || true)
compilo=$(printf '%s\n' "$salida_sin" | grep -c '^paso: compilar' || true)
comprobar "sin protección, el guion pierde pasos por el camino" "0" "$compilo"

# --- Con protección: la copia de /tmp no la toca nadie ---------------
con=$TALLER/con.sh
cat > "$con" <<CONPROT
#!/usr/bin/env bash
set -Eeuo pipefail
if [ "\${COPIA_PROPIA:-}" != "sí" ]; then
  copia=\$(mktemp /tmp/prueba-desplegar.XXXXXX.sh)
  cp "\$0" "\$copia"; chmod +x "\$copia"
  COPIA_PROPIA=sí exec bash "\$copia" "\$@"
fi
echo "paso: traer los cambios"
$(declare -f nueva_version)
nueva_version "$con"
echo "paso: compilar"
echo "paso: reiniciar"
CONPROT

salida_con=$(bash "$con" 2>&1 || true)
comprobar "con protección, compila" "1" "$(printf '%s\n' "$salida_con" | grep -c '^paso: compilar' || true)"
comprobar "con protección, reinicia" "1" "$(printf '%s\n' "$salida_con" | grep -c '^paso: reiniciar' || true)"
comprobar "y no se cuela la versión nueva a media ejecución" "0" \
  "$(printf '%s\n' "$salida_con" | grep -c '^version: nueva' || true)"

echo
if [ "$fallos" -eq 0 ]; then echo "Todo en orden."; else echo "$fallos comprobaciones fallaron."; exit 1; fi
