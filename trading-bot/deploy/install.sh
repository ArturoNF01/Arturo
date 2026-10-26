#!/usr/bin/env bash
# Instala o actualiza el bot en un servidor Ubuntu/Debian. Ejecutar como root.
# Seguro de repetir: conserva .env y data/ (estado y operaciones).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ArturoNF01/Arturo.git}"
BRANCH="${BRANCH:-claude/gracious-mayer-3ikbtj}"
DIR=/opt/arturo
BOT="$DIR/trading-bot"

if [ "$(id -u)" -ne 0 ]; then echo "Ejecuta como root"; exit 1; fi

apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-venv git ufw

id tradingbot >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin tradingbot

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH"
  git -C "$DIR" checkout "$BRANCH"
  git -C "$DIR" reset --hard "origin/$BRANCH"   # no toca .env ni data/ (estan en .gitignore)
else
  git clone --branch "$BRANCH" "$REPO_URL" "$DIR"
fi

python3 -m venv "$BOT/.venv"
"$BOT/.venv/bin/pip" install -q -r "$BOT/requirements.txt"

if [ ! -f "$BOT/.env" ]; then cp "$BOT/.env.example" "$BOT/.env"; fi
mkdir -p "$BOT/data"
chmod 600 "$BOT/.env"
chown -R tradingbot:tradingbot "$DIR"

cat > /etc/systemd/system/tradingbot.service <<EOF
[Unit]
Description=Trading bot
After=network-online.target
Wants=network-online.target

[Service]
User=tradingbot
WorkingDirectory=$BOT
ExecStart=$BOT/.venv/bin/python -m bot.main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable tradingbot
systemctl restart tradingbot

ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null

echo
echo "Listo. El bot corre en modo: $(grep -E '^MODE=' "$BOT/.env")"
echo "Ver logs:     journalctl -u tradingbot -f"
echo "Editar config: nano $BOT/.env   y luego: systemctl restart tradingbot"
