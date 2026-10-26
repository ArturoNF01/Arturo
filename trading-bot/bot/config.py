import os
from dataclasses import dataclass

from dotenv import load_dotenv


def _f(name: str, default: str) -> float:
    return float(os.getenv(name, default))


@dataclass(frozen=True)
class Config:
    mode: str
    exchange: str
    symbol: str
    timeframe: str
    api_key: str
    api_secret: str
    paper_start_usdt: float
    sma_fast: int
    sma_slow: int
    risk_per_trade_pct: float
    stop_loss_pct: float
    take_profit_pct: float
    max_position_pct: float
    daily_loss_limit_pct: float
    fee_pct: float
    poll_seconds: int
    telegram_token: str
    telegram_chat_id: str
    live_confirmed: bool


def load_config() -> Config:
    load_dotenv()
    cfg = Config(
        mode=os.getenv("MODE", "paper").lower(),
        exchange=os.getenv("EXCHANGE", "binance").lower(),
        symbol=os.getenv("SYMBOL", "BTC/USDT"),
        timeframe=os.getenv("TIMEFRAME", "1h"),
        api_key=os.getenv("API_KEY", ""),
        api_secret=os.getenv("API_SECRET", ""),
        paper_start_usdt=_f("PAPER_START_USDT", "100"),
        sma_fast=int(_f("SMA_FAST", "20")),
        sma_slow=int(_f("SMA_SLOW", "50")),
        risk_per_trade_pct=_f("RISK_PER_TRADE_PCT", "1.0"),
        stop_loss_pct=_f("STOP_LOSS_PCT", "3.0"),
        take_profit_pct=_f("TAKE_PROFIT_PCT", "6.0"),
        max_position_pct=_f("MAX_POSITION_PCT", "95"),
        daily_loss_limit_pct=_f("DAILY_LOSS_LIMIT_PCT", "5.0"),
        fee_pct=_f("FEE_PCT", "0.1"),
        poll_seconds=int(_f("POLL_SECONDS", "60")),
        telegram_token=os.getenv("TELEGRAM_TOKEN", "").strip().removeprefix("bot"),  # un token real empieza con digitos
        telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID", ""),
        live_confirmed=os.getenv("I_UNDERSTAND_REAL_MONEY", "no") == "yes",
    )
    validate(cfg)
    return cfg


def validate(cfg: Config) -> None:
    if cfg.mode not in ("paper", "testnet", "live"):
        raise ValueError("MODE debe ser paper, testnet o live")
    if cfg.sma_fast >= cfg.sma_slow:
        raise ValueError("SMA_FAST debe ser menor que SMA_SLOW")
    if cfg.stop_loss_pct <= 0:
        raise ValueError("STOP_LOSS_PCT debe ser mayor que 0")
    if cfg.mode in ("testnet", "live") and not (cfg.api_key and cfg.api_secret):
        raise ValueError(f"MODE={cfg.mode} requiere API_KEY y API_SECRET")
    if cfg.mode == "live" and not cfg.live_confirmed:
        raise ValueError("MODE=live requiere I_UNDERSTAND_REAL_MONEY=yes")
