#!/usr/bin/env bash
# Quita el bot del servidor sin tocar nada mas. Guarda una copia de data/ (operaciones y estado).
set -euo pipefail

DIR=/opt/tradingbot
UNIT=/etc/systemd/system/tradingbot.service

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta como root"; exit 1; }
[ -f "$DIR/.tradingbot-managed" ] || { echo "No hay instalacion del bot en $DIR"; exit 1; }

if [ -d "$DIR/src/trading-bot/data" ]; then
  backup="/root/tradingbot-backup-$(date +%Y%m%d-%H%M%S)"
  mkdir -m 700 "$backup"
  cp -a "$DIR/src/trading-bot/data/." "$backup/"
  echo "Copia de operaciones y estado en $backup"
fi

systemctl disable --now tradingbot 2>/dev/null || true
rm -f "$UNIT"
systemctl daemon-reload
rm -rf "$DIR"
id tradingbot >/dev/null 2>&1 && userdel tradingbot || true
echo "Bot desinstalado. No se toco nada mas del servidor."
