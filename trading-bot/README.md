# Trading bot (cripto, Binance Spot)

Bot 24/7 de una sola posicion (solo compra, sin apalancamiento). Estrategia: cruce de medias moviles (SMA 20/50, velas de 1h) con stop-loss, take-profit, tamano de posicion por riesgo y limite de perdida diaria.

> **Aviso:** ninguna estrategia garantiza ganancias. Usa solo dinero que puedas perder.

## Modos

| MODE | Dinero | API key | Para que |
|---|---|---|---|
| `paper` | simulado, precios reales | no | **empieza aqui** |
| `testnet` | simulado en Binance Testnet | si (testnet) | probar ordenes reales |
| `live` | **real** | si | solo despues de semanas en paper/testnet |

## Inicio rapido

```bash
cd trading-bot
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # MODE=paper por defecto

python -m pytest              # verifica que todo funciona
python -m bot.backtest --days 365   # historial real (necesita acceso a Binance)
python -m bot.main            # arranca el bot
```

Salida: logs en consola, operaciones en `data/trades.csv`, estado en `data/state.json` (si reinicias, retoma donde iba).

## Pasar a testnet / live

1. **Testnet:** crea claves en <https://testnet.binance.vision>, ponlas en `.env` y `MODE=testnet`.
2. **Live:** cuenta Binance verificada; fondea con USDT (en Mexico: compra en MXN por P2P o transfiere desde Bitso). Crea una API key **solo con "Enable Spot Trading"**, **sin retiros**, y limitada a la IP de tu servidor. Pon `MODE=live` e `I_UNDERSTAND_REAL_MONEY=yes`.
3. Binance exige un minimo de ~5-10 USDT por orden. Con capital muy pequeno el bot ignora senales por debajo de ese minimo.

## Dejarlo 24/7

En un VPS pequeno (DigitalOcean $4-6/mes):

```bash
sudo tee /etc/systemd/system/tradingbot.service <<'EOF'
[Unit]
Description=Trading bot
After=network-online.target

[Service]
WorkingDirectory=/opt/trading-bot
ExecStart=/opt/trading-bot/.venv/bin/python -m bot.main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now tradingbot
journalctl -u tradingbot -f      # ver logs
```

Alertas: crea un bot con @BotFather en Telegram y pon `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID`.

## Riesgo (leer)

- Stop-loss y take-profit son **del bot** (revisa el precio cada `POLL_SECONDS`). Si el bot o el servidor se caen con una posicion abierta, no hay stop hasta que vuelva.
- `RISK_PER_TRADE_PCT=1` y `STOP_LOSS_PCT=3` => cada operacion arriesga ~1% del capital.
- `DAILY_LOSS_LIMIT_PCT=5` => si el dia pierde 5%, cierra todo y se pausa hasta el siguiente dia UTC.
- Una estrategia de cruce de medias suele perder en mercados laterales y por comisiones. Revisa el backtest y el paper trading antes de arriesgar dinero.

## Estructura

```
bot/strategy.py   senales (cruce de SMA)
bot/risk.py       tamano de posicion, stop, limite diario
bot/broker.py     PaperBroker (simulado) y CcxtBroker (testnet/live)
bot/main.py       ciclo 24/7
bot/backtest.py   backtest con las mismas reglas
tests/            pruebas automaticas
```
