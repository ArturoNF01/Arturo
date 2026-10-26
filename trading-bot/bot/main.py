import logging
import time
from datetime import datetime, timezone

import ccxt
import requests

from . import notify, state as st
from .broker import CcxtBroker, PaperBroker
from .config import Config, load_config
from .data import fetch_closed_candles, make_exchange
from .risk import (daily_limit_hit, position_size_usdt, stop_price,
                   take_profit_price)
from .strategy import signal

log = logging.getLogger("bot")


class Bot:
    def __init__(self, cfg: Config, broker, data_ex, state: dict):
        self.cfg, self.broker, self.data_ex, self.state = cfg, broker, data_ex, state

    def say(self, text: str) -> None:
        notify.send(self.cfg.telegram_token, self.cfg.telegram_chat_id,
                    f"[{self.cfg.mode}] {text}")

    def equity(self, price: float) -> float:
        pos = self.state["position"]
        return self.broker.usdt_balance() + (pos["qty"] * price if pos else 0.0)

    def open_position(self, price: float, equity: float) -> None:
        c = self.cfg
        size = position_size_usdt(equity, c.risk_per_trade_pct, c.stop_loss_pct, c.max_position_pct)
        size = min(size, self.broker.usdt_balance())
        min_cost = getattr(self.broker, "min_cost", lambda: 0.0)()
        if size < max(min_cost, 1.0):
            self.say(f"Senal de compra ignorada: tamano {size:.2f} USDT por debajo del minimo")
            return
        fill = self.broker.buy(size)
        self.state["position"] = {
            "entry": fill.price, "qty": fill.qty,
            "stop": stop_price(fill.price, c.stop_loss_pct),
            "tp": take_profit_price(fill.price, c.take_profit_pct),
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        st.log_trade("buy", fill.price, fill.qty, "signal", equity)
        self.say(f"COMPRA {fill.qty:.6f} {c.symbol} @ {fill.price:.2f} "
                 f"(stop {self.state['position']['stop']:.2f}, tp {self.state['position']['tp']:.2f})")

    def close_position(self, reason: str) -> None:
        pos = self.state["position"]
        fill = self.broker.sell(pos["qty"])
        pnl_pct = (fill.price / pos["entry"] - 1) * 100
        self.state["position"] = None
        st.log_trade("sell", fill.price, fill.qty, reason, self.broker.usdt_balance())
        self.say(f"VENTA ({reason}) @ {fill.price:.2f} | resultado aprox {pnl_pct:+.2f}% "
                 f"| USDT {self.broker.usdt_balance():.2f}")

    def step(self) -> None:
        c, s = self.cfg, self.state
        price = self.broker.price()
        equity = self.equity(price)

        today = datetime.now(timezone.utc).date().isoformat()
        if s["day"] != today:
            s.update(day=today, day_start_equity=equity, halted=False)
            self.say(f"Nuevo dia. Capital: {equity:.2f} USDT")

        if s["halted"]:
            return

        if daily_limit_hit(s["day_start_equity"], equity, c.daily_loss_limit_pct):
            if s["position"]:
                self.close_position("limite diario")
            s["halted"] = True
            self.say(f"LIMITE DIARIO ALCANZADO ({c.daily_loss_limit_pct}%). "
                     f"Bot en pausa hasta manana (UTC).")
            return

        pos = s["position"]
        if pos and price <= pos["stop"]:
            self.close_position("stop-loss")
            return
        if pos and price >= pos["tp"]:
            self.close_position("take-profit")
            return

        candles = fetch_closed_candles(self.data_ex, c.symbol, c.timeframe, c.sma_slow + 50)
        last_ts = int(candles.iloc[-1]["ts"])
        if last_ts == s["last_candle_ts"]:
            return  # ya procesada esta vela
        s["last_candle_ts"] = last_ts

        sig = signal(candles, c.sma_fast, c.sma_slow)
        log.info("vela %s cierre %.2f senal=%s", last_ts, candles.iloc[-1]["close"], sig)
        if sig == "buy" and not s["position"] and not s["paused"]:
            self.open_position(price, equity)
        elif sig == "sell" and s["position"]:
            self.close_position("cruce bajista")

    # ---------- control remoto por Telegram ----------
    def handle(self, cmd: str) -> str:
        s = self.state
        if cmd == "/status":
            price = self.broker.price()
            pos = s["position"]
            lines = [f"Modo: {self.cfg.mode} | {self.cfg.symbol} @ {price:.2f}",
                     f"Capital: {self.equity(price):.2f} USDT (inicio del dia {s['day_start_equity']:.2f})",
                     f"Estado: {'LIMITE DIARIO' if s['halted'] else 'PAUSADO' if s['paused'] else 'activo'}"]
            if pos:
                pnl = (price / pos["entry"] - 1) * 100
                lines.append(f"Posicion: {pos['qty']:.6f} @ {pos['entry']:.2f} ({pnl:+.2f}%), "
                             f"stop {pos['stop']:.2f}, tp {pos['tp']:.2f}")
            else:
                lines.append("Posicion: ninguna")
            return "\n".join(lines)
        if cmd == "/pause":
            s["paused"] = True
            return "Pausado: no abrira compras nuevas (la posicion abierta sigue protegida por su stop)."
        if cmd == "/resume":
            s["paused"] = False
            return "Reanudado."
        if cmd == "/close":
            if not s["position"]:
                return "No hay posicion abierta."
            self.close_position("manual")
            return ""
        return "Comandos: /status /pause /resume /close"

    def process_commands(self) -> None:
        c, s = self.cfg, self.state
        if not (c.telegram_token and c.telegram_chat_id):
            return
        if s["tg_offset"] is None:
            # primer arranque: ignorar mensajes viejos para no ejecutar ordenes atrasadas
            pending = notify.get_updates(c.telegram_token, -1)
            s["tg_offset"] = pending[-1]["update_id"] + 1 if pending else 0
            return
        for u in notify.get_updates(c.telegram_token, s["tg_offset"]):
            s["tg_offset"] = u["update_id"] + 1
            msg = u.get("message") or {}
            if str(msg.get("chat", {}).get("id")) != str(c.telegram_chat_id):
                continue  # solo obedece a tu chat
            text = (msg.get("text") or "").strip().lower()
            if text.startswith("/"):
                reply = self.handle(text.split()[0].split("@")[0])
                if reply:
                    self.say(reply)


def build(cfg: Config) -> Bot:
    s = st.load()
    data_ex = make_exchange(cfg.exchange, sandbox=(cfg.mode == "testnet"))
    if cfg.mode == "paper":
        p = s["paper"] or {}
        broker = PaperBroker(data_ex, cfg.symbol, cfg.fee_pct, cfg.paper_start_usdt,
                             usdt=p.get("usdt"), base=p.get("base", 0.0))
    else:
        broker = CcxtBroker(cfg.exchange, cfg.symbol, cfg.api_key, cfg.api_secret,
                            sandbox=(cfg.mode == "testnet"))
        data_ex = broker.ex
    return Bot(cfg, broker, data_ex, s)


class RedactingFormatter(logging.Formatter):
    """Nunca escribe secretos en los logs (las URLs de error de Telegram llevan el token)."""

    def __init__(self, fmt: str, secrets: list[str]):
        super().__init__(fmt)
        self.secrets = [s for s in secrets if s]

    def format(self, record: logging.LogRecord) -> str:
        out = super().format(record)
        for s in self.secrets:
            out = out.replace(s, "***")
        return out


def main() -> None:
    cfg = load_config()
    logging.basicConfig(level=logging.INFO)
    for h in logging.getLogger().handlers:
        h.setFormatter(RedactingFormatter("%(asctime)s %(levelname)s %(message)s",
                                          [cfg.telegram_token, cfg.api_key, cfg.api_secret]))
    bot = build(cfg)
    bot.say(f"Bot iniciado: {cfg.symbol} {cfg.timeframe} SMA {cfg.sma_fast}/{cfg.sma_slow}. "
            f"Comandos: /status /pause /resume /close")
    next_step = next_cmd = 0.0
    while True:
        try:
            if time.time() >= next_step:
                next_step = time.time() + cfg.poll_seconds
                bot.step()
        except (ccxt.NetworkError, ccxt.ExchangeNotAvailable, requests.RequestException) as e:
            log.warning("Error de red, reintento: %s", e)
        except Exception as e:  # noqa: BLE001 - el bot nunca debe morir en silencio
            log.exception("Error inesperado")
            bot.say(f"ERROR: {type(e).__name__}")
        try:
            if time.time() >= next_cmd:
                bot.process_commands()
        except requests.RequestException as e:
            log.warning("Telegram no responde, reintento en 60 s: %s", e)
            next_cmd = time.time() + 60
        try:
            if cfg.mode == "paper":
                bot.state["paper"] = bot.broker.snapshot()
            st.save(bot.state)
        except OSError as e:
            log.error("No se pudo guardar el estado: %s", e)
        time.sleep(3)  # revisa comandos de Telegram cada 3 s; el precio cada POLL_SECONDS


if __name__ == "__main__":
    main()
