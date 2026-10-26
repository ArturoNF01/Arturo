#!/usr/bin/env bash
# Instala o actualiza el bot en un servidor Ubuntu/Debian. Ejecutar como root.
#
# Pensado para convivir con otras aplicaciones del mismo servidor:
#  - Verifica TODO antes de cambiar nada; si algo no cuadra, aborta sin tocar el sistema.
#  - Solo escribe en /opt/tradingbot, /etc/systemd/system/tradingbot.service y el usuario "tradingbot".
#  - Se niega a usar una carpeta o servicio existente que no sea suyo.
#  - No usa puertos, no toca firewall, nginx, otros servicios ni paquetes ya instalados.
#  - El servicio corre sin privilegios, con tope de memoria/CPU y filesystem de solo lectura.
# Repetirlo es seguro: actualiza el codigo y conserva .env y data/.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ArturoNF01/Arturo.git}"
BRANCH="${BRANCH:-claude/gracious-mayer-3ikbtj}"
DIR=/opt/tradingbot
SRC="$DIR/src"
BOT="$SRC/trading-bot"
MARKER="$DIR/.tradingbot-managed"
UNIT=/etc/systemd/system/tradingbot.service
UNIT_TAG="# managed-by: tradingbot-installer"
MIN_MEM_MB="${MIN_MEM_MB:-250}"
# Fuente de precios. Binance bloquea IPs de EE.UU.; en ese caso usa EXCHANGE=kraken (solo paper).
EXCHANGE="${EXCHANGE:-binance}"
case "$EXCHANGE" in
  binance) PING_URL=https://api.binance.com/api/v3/ping ;;
  kraken)  PING_URL=https://api.kraken.com/0/public/Time ;;
  *) echo "ABORTADO (no se cambio nada): EXCHANGE debe ser binance o kraken" >&2; exit 1 ;;
esac

die() { echo "ABORTADO (no se cambio nada): $*" >&2; exit 1; }

# ---------- 1. Verificaciones previas (no modifican nada) ----------
[ "$(id -u)" -eq 0 ] || die "ejecuta como root"
. /etc/os-release
case "${ID:-}" in ubuntu|debian) ;; *) die "solo Ubuntu/Debian (este es: ${ID:-desconocido})" ;; esac
command -v systemctl >/dev/null || die "este servidor no usa systemd"
command -v curl >/dev/null || die "falta curl"

if [ -e "$DIR" ] && [ ! -f "$MARKER" ]; then
  die "$DIR ya existe y no fue creado por este instalador"
fi
if [ -e "$UNIT" ] && ! grep -q "$UNIT_TAG" "$UNIT"; then
  die "$UNIT ya existe y no es de este instalador"
fi
if id tradingbot >/dev/null 2>&1 && [ ! -f "$MARKER" ]; then
  die "el usuario 'tradingbot' ya existe y no es de este instalador"
fi

avail_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
[ "$avail_mb" -ge "$MIN_MEM_MB" ] || die "memoria disponible ${avail_mb} MB (minimo ${MIN_MEM_MB} MB); no se arriesga a tus apps"

if [ "${SKIP_NET_CHECK:-0}" != "1" ]; then
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$PING_URL" || true)
  [ "$code" = "200" ] || die "$EXCHANGE no responde 200 desde este servidor (codigo $code). 451 = region bloqueada (EE.UU.): prueba EXCHANGE=kraken"
fi

# ---------- 2. Instalacion ----------
# --no-upgrade: si python3/git ya estan instalados, NO se actualizan (otras apps pueden depender de ellos).
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-upgrade python3 python3-venv git

mkdir -p "$DIR"
touch "$MARKER"
id tradingbot >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin tradingbot

# Solo se descarga la carpeta trading-bot (no el resto del repositorio)
if [ -d "$SRC/.git" ]; then
  git -C "$SRC" fetch --depth 1 origin "$BRANCH"
  git -C "$SRC" reset --hard FETCH_HEAD   # no toca .env, data/ ni .venv (estan en .gitignore)
else
  git clone --depth 1 --filter=blob:none --sparse --branch "$BRANCH" "$REPO_URL" "$SRC"
  git -C "$SRC" sparse-checkout set trading-bot
fi

python3 -m venv "$BOT/.venv"
nice -n 19 "$BOT/.venv/bin/pip" install -q --no-cache-dir -r "$BOT/requirements.txt"

if [ ! -f "$BOT/.env" ]; then
  cp "$BOT/.env.example" "$BOT/.env"
  sed -i "s/^EXCHANGE=.*/EXCHANGE=$EXCHANGE/" "$BOT/.env"
fi
mkdir -p "$BOT/data"
chmod 600 "$BOT/.env"
chown -R tradingbot:tradingbot "$DIR"   # solo nuestra carpeta

cat > "$UNIT" <<EOF
$UNIT_TAG
[Unit]
Description=Trading bot
After=network-online.target
Wants=network-online.target

[Service]
User=tradingbot
WorkingDirectory=$BOT
ExecStart=$BOT/.venv/bin/python -m bot.main
Environment=PYTHONDONTWRITEBYTECODE=1
Restart=always
RestartSec=10
# Tope de recursos: si el bot falla, solo el bot se ve afectado
Nice=10
MemoryMax=350M
CPUQuota=50%
# Aislamiento: solo puede escribir en su carpeta data/
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$BOT/data

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable tradingbot
systemctl restart tradingbot

echo
echo "Listo. El bot corre en modo: $(grep -E '^MODE=' "$BOT/.env")"
echo "Ver logs:      journalctl -u tradingbot -f"
echo "Editar config: nano $BOT/.env   y luego: systemctl restart tradingbot"
echo "Desinstalar:   bash $BOT/deploy/uninstall.sh"
