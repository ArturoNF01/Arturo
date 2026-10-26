import csv
import json
import os
from datetime import datetime, timezone

DATA_DIR = os.getenv("BOT_DATA_DIR", "data")
STATE_FILE = os.path.join(DATA_DIR, "state.json")
TRADES_FILE = os.path.join(DATA_DIR, "trades.csv")

EMPTY = {
    "position": None,        # {"entry", "qty", "stop", "tp", "ts"}
    "day": None,
    "day_start_equity": 0.0,
    "halted": False,
    "paused": False,         # pausa manual por Telegram: no abre compras nuevas
    "tg_offset": None,       # ultimo update de Telegram procesado
    "last_candle_ts": None,
    "paper": None,           # {"usdt", "base"} solo en modo paper
}


def load() -> dict:
    try:
        with open(STATE_FILE) as f:
            return {**EMPTY, **json.load(f)}
    except FileNotFoundError:
        return dict(EMPTY)


def save(state: dict) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp, STATE_FILE)


def log_trade(side: str, price: float, qty: float, reason: str, equity: float) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    new = not os.path.exists(TRADES_FILE)
    with open(TRADES_FILE, "a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["utc", "side", "price", "qty", "reason", "equity"])
        w.writerow([datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    side, f"{price:.2f}", f"{qty:.8f}", reason, f"{equity:.2f}"])
