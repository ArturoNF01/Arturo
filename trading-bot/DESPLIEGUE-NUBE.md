# Bot en la nube (DigitalOcean) + control por Telegram

Todo se hace desde el navegador, sin instalar nada en tu computadora.

## 1. Crear el servidor

En DigitalOcean: **Create → Droplets**

- **Region: Frankfurt, Amsterdam o Singapur. NO uses EE.UU.** Binance bloquea las IPs de EE.UU.
- **Imagen:** Ubuntu 24.04 (LTS)
- **Plan:** Basic, Regular, **1 GB RAM (~$6/mes)**
- **Autenticacion:** contrasena (o llave SSH si sabes usarla)
- **Nombre:** `tradingbot` → Create

## 2. Instalar el bot

En la pagina del droplet pulsa **Console** (terminal dentro del navegador; sirve desde cualquier computadora). Entra como `root` y pega:

```bash
curl -fsSL https://raw.githubusercontent.com/ArturoNF01/Arturo/claude/gracious-mayer-3ikbtj/trading-bot/deploy/install.sh | bash
```

Termina diciendo `Listo. El bot corre en modo: MODE=paper` (dinero simulado). Ver que vive:

```bash
journalctl -u tradingbot -f      # Ctrl+C para salir
```

## 3. Control por Telegram (recomendado)

1. En Telegram habla con **@BotFather** → `/newbot` → copia el **token**.
2. Escribele un mensaje cualquiera a tu bot nuevo.
3. Abre en el navegador `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia el numero de `"chat":{"id":...}`.
4. En la Console:
   ```bash
   nano /opt/arturo/trading-bot/.env
   ```
   Llena `TELEGRAM_TOKEN=` y `TELEGRAM_CHAT_ID=`. Guarda (`Ctrl+O`, Enter, `Ctrl+X`) y reinicia:
   ```bash
   systemctl restart tradingbot
   ```

Desde Telegram (celular o web) mandas:

| Comando | Hace |
|---|---|
| `/status` | capital, precio, posicion abierta |
| `/pause` | no abre compras nuevas |
| `/resume` | reanuda |
| `/close` | vende la posicion ahora |

El bot solo obedece a tu chat y te avisa de cada compra, venta, error y limite diario.

## 4. Pasar a testnet o dinero real

Edita `.env` con `nano` (paso 3) y reinicia con `systemctl restart tradingbot`.

- **testnet:** `MODE=testnet`, `API_KEY` y `API_SECRET` de testnet.binance.vision.
- **live:** `MODE=live`, `I_UNDERSTAND_REAL_MONEY=yes`, API key de Binance con **solo "Spot Trading"** (sin retiros) y restringida a la **IP del droplet** (se ve en su pagina).

## 5. Mantenimiento

```bash
systemctl status tradingbot          # esta corriendo?
systemctl restart tradingbot         # reiniciar
cat /opt/arturo/trading-bot/data/trades.csv   # operaciones
# actualizar a la ultima version (conserva .env y data):
curl -fsSL https://raw.githubusercontent.com/ArturoNF01/Arturo/claude/gracious-mayer-3ikbtj/trading-bot/deploy/install.sh | bash
```

El bot se reinicia solo si falla o si se reinicia el servidor, y retoma su estado.
