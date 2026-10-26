import numpy as np
import pandas as pd
import pytest

from bot import state as st
from bot.backtest import run_backtest
from bot.broker import Fill
from bot.config import Config, validate
from bot.main import Bot
from bot.risk import daily_limit_hit, position_size_usdt, stop_price
from bot.strategy import signal


def make_cfg(**kw) -> Config:
    base = dict(
        mode="paper", exchange="binance", symbol="BTC/USDT", timeframe="1h",
        api_key="", api_secret="", paper_start_usdt=100, sma_fast=5, sma_slow=10,
        risk_per_trade_pct=1.0, stop_loss_pct=3.0, take_profit_pct=6.0,
        max_position_pct=95, daily_loss_limit_pct=5.0, fee_pct=0.1, poll_seconds=1,
        telegram_token="", telegram_chat_id="", live_confirmed=False,
    )
    base.update(kw)
    return Config(**base)


def candles(closes) -> pd.DataFrame:
    c = np.array(closes, dtype=float)
    return pd.DataFrame({"ts": np.arange(len(c)) * 3_600_000, "open": c, "high": c * 1.001,
                         "low": c * 0.999, "close": c, "volume": 1.0})


# ---------- riesgo ----------
def test_position_size_risks_one_percent():
    assert position_size_usdt(100, 1, 3, 95) == pytest.approx(33.333, rel=1e-3)


def test_position_size_capped():
    assert position_size_usdt(100, 5, 1, 95) == 95


def test_daily_limit():
    assert daily_limit_hit(100, 94, 5)
    assert not daily_limit_hit(100, 96, 5)


# ---------- estrategia ----------
def test_signal_buy_on_cross_up():
    closes = [100] * 12 + [99, 98, 97, 96, 100, 110, 120]
    # buscamos la primera vela con cruce alcista
    sigs = [signal(candles(closes[: i + 1]), 3, 6) for i in range(8, len(closes))]
    assert "buy" in sigs


def test_signal_hold_when_flat():
    assert signal(candles([100] * 30), 5, 10) == "hold"


# ---------- backtest ----------
def test_backtest_runs_and_is_consistent():
    rng = np.random.default_rng(1)
    closes = 100 * np.exp(np.cumsum(rng.normal(0, 0.01, 2000)))
    res = run_backtest(candles(closes), make_cfg())
    assert res["capital_final"] > 0
    assert res["max_caida_%"] <= 0
    assert res["operaciones"] >= 0


def test_backtest_uptrend_profits():
    closes = 100 * np.exp(np.linspace(0, 1.5, 1500) + np.sin(np.arange(1500) / 20) * 0.05)
    res = run_backtest(candles(closes), make_cfg(take_profit_pct=50))
    assert res["retorno_%"] > 0


# ---------- bot (broker falso) ----------
class FakeBroker:
    def __init__(self, price=100.0, usdt=100.0):
        self._price, self.usdt, self.base = price, usdt, 0.0

    def price(self): return self._price
    def usdt_balance(self): return self.usdt

    def buy(self, usdt):
        qty = usdt / self._price
        self.usdt -= usdt
        self.base += qty
        return Fill(self._price, qty)

    def sell(self, qty):
        self.usdt += qty * self._price
        self.base -= qty
        return Fill(self._price, qty)


class FakeData:
    def __init__(self, closes): self.closes = closes

    def fetch_ohlcv(self, symbol, tf, limit=None):
        df = candles(self.closes)
        rows = df[["ts", "open", "high", "low", "close", "volume"]].values.tolist()
        return rows + [rows[-1]]  # la ultima es la vela "en curso"


@pytest.fixture(autouse=True)
def tmp_data(tmp_path, monkeypatch):
    monkeypatch.setattr(st, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(st, "STATE_FILE", str(tmp_path / "state.json"))
    monkeypatch.setattr(st, "TRADES_FILE", str(tmp_path / "trades.csv"))


def new_bot(closes, price=100.0, **cfg):
    broker = FakeBroker(price)
    return Bot(make_cfg(**cfg), broker, FakeData(closes), dict(st.EMPTY)), broker


def test_bot_buys_on_signal_and_sizes_by_risk():
    closes = [100] * 12 + [99, 98, 97, 96, 100, 110, 120]
    for n in range(14, len(closes) + 1):
        bot, broker = new_bot(closes[:n], sma_fast=3, sma_slow=6)
        bot.step()
        if bot.state["position"]:
            break
    pos = bot.state["position"]
    assert pos is not None
    assert pos["qty"] * 100 == pytest.approx(33.333, rel=1e-3)
    assert pos["stop"] == pytest.approx(stop_price(100, 3))


def test_bot_stop_loss_closes_position():
    bot, broker = new_bot([100] * 60)
    bot.state["position"] = {"entry": 100.0, "qty": 0.3, "stop": 97.0, "tp": 106.0, "ts": "x"}
    broker.base, broker.usdt = 0.3, 70.0
    broker._price = 96.0
    bot.step()
    assert bot.state["position"] is None


def test_bot_daily_loss_limit_halts():
    bot, broker = new_bot([100] * 60, price=100.0)
    bot.step()  # inicializa el dia con capital 100
    broker.usdt = 90.0  # perdida del 10%
    bot.step()
    assert bot.state["halted"] is True


# ---------- configuracion ----------
def test_live_requires_confirmation():
    with pytest.raises(ValueError):
        validate(make_cfg(mode="live", api_key="a", api_secret="b"))


def test_testnet_requires_keys():
    with pytest.raises(ValueError):
        validate(make_cfg(mode="testnet"))


# ---------- control por Telegram ----------
def test_pause_blocks_new_buys():
    closes = [100] * 12 + [99, 98, 97, 96, 100, 110, 120]
    for n in range(14, len(closes) + 1):
        bot, _ = new_bot(closes[:n], sma_fast=3, sma_slow=6)
        bot.state["paused"] = True
        bot.step()
        assert bot.state["position"] is None


def test_close_command_sells_position():
    bot, broker = new_bot([100] * 60)
    bot.state["position"] = {"entry": 100.0, "qty": 0.3, "stop": 97.0, "tp": 106.0, "ts": "x"}
    broker.base, broker.usdt = 0.3, 70.0
    assert bot.handle("/close") == ""
    assert bot.state["position"] is None and broker.usdt == pytest.approx(100.0)
    assert "No hay posicion" in bot.handle("/close")


def test_status_and_pause_resume():
    bot, _ = new_bot([100] * 60)
    assert "activo" in bot.handle("/status")
    bot.handle("/pause")
    assert "PAUSADO" in bot.handle("/status")
    bot.handle("/resume")
    assert "activo" in bot.handle("/status")


def test_telegram_ignores_old_and_foreign_messages(monkeypatch):
    from bot import notify
    bot, _ = new_bot([100] * 60, telegram_token="t", telegram_chat_id="42")
    sent = []
    monkeypatch.setattr(notify, "send", lambda t, c, text: sent.append(text))
    msgs = {-1: [{"update_id": 5, "message": {"chat": {"id": 42}, "text": "/pause"}}]}
    monkeypatch.setattr(notify, "get_updates", lambda tok, off: msgs.get(off, []))
    bot.process_commands()                       # primer arranque: descarta lo viejo
    assert bot.state["tg_offset"] == 6 and not bot.state["paused"]
    msgs[6] = [
        {"update_id": 6, "message": {"chat": {"id": 999}, "text": "/pause"}},   # chat ajeno
        {"update_id": 7, "message": {"chat": {"id": 42}, "text": "/pause"}},
    ]
    bot.process_commands()
    assert bot.state["paused"] is True and bot.state["tg_offset"] == 8
    assert len(sent) == 1


# ---------- secretos ----------
def test_token_bot_prefix_is_stripped(monkeypatch):
    from bot.config import load_config
    monkeypatch.setenv("MODE", "paper")
    monkeypatch.setenv("TELEGRAM_TOKEN", " bot123456:AAHxyz ")
    assert load_config().telegram_token == "123456:AAHxyz"


def test_logs_never_contain_token():
    import logging
    from bot.main import RedactingFormatter
    fmt = RedactingFormatter("%(message)s", ["123456:AAHxyz"])
    rec = logging.LogRecord("bot", logging.WARNING, "", 0,
                            "404 for url: https://api.telegram.org/bot123456:AAHxyz/getUpdates", (), None)
    out = fmt.format(rec)
    assert "AAHxyz" not in out and "***" in out
