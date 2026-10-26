"""Backtest de la estrategia con las mismas reglas de riesgo del bot.

Uso:
    python -m bot.backtest --days 365
    python -m bot.backtest --csv data/btc_1h.csv
"""
import argparse

import pandas as pd

from .config import Config, load_config
from .data import fetch_history, make_exchange
from .risk import position_size_usdt, stop_price, take_profit_price
from .strategy import add_indicators

SLIPPAGE_PCT = 0.05


def run_backtest(df: pd.DataFrame, cfg: Config, start_equity: float = 100.0) -> dict:
    ind = add_indicators(df, cfg.sma_fast, cfg.sma_slow)
    f, s = ind["sma_fast"], ind["sma_slow"]
    cross_up = ((f.shift(1) <= s.shift(1)) & (f > s)).fillna(False)
    cross_dn = ((f.shift(1) >= s.shift(1)) & (f < s)).fillna(False)

    fee, slip = cfg.fee_pct / 100, SLIPPAGE_PCT / 100
    cash, pos = start_equity, None
    equity_curve, trades = [], []

    def close(price: float, i: int) -> None:
        nonlocal cash, pos
        proceeds = pos["qty"] * price * (1 - fee)
        trades.append(proceeds - pos["cost"])
        cash += proceeds
        pos = None

    start = max(cfg.sma_slow, 1)
    for i in range(start, len(ind)):
        row = ind.iloc[i]
        # 1) la vela i ya ocurrio: revisar stop / take-profit (el stop manda si ambos tocan)
        if pos is not None:
            if row["low"] <= pos["stop"]:
                close(min(pos["stop"], row["open"]) * (1 - slip), i)
            elif row["high"] >= pos["tp"]:
                close(max(pos["tp"], row["open"]) * (1 - slip), i)
        # 2) senal de la vela i anterior -> se ejecuta al open de esta vela (sin mirar el futuro)
        if i > start:
            if cross_dn.iloc[i - 1] and pos is not None:
                close(row["open"] * (1 - slip), i)
            elif cross_up.iloc[i - 1] and pos is None:
                size = position_size_usdt(cash, cfg.risk_per_trade_pct,
                                          cfg.stop_loss_pct, cfg.max_position_pct)
                if size > 0:
                    entry = row["open"] * (1 + slip)
                    pos = {"qty": size * (1 - fee) / entry, "cost": size,
                           "stop": stop_price(entry, cfg.stop_loss_pct),
                           "tp": take_profit_price(entry, cfg.take_profit_pct)}
                    cash -= size
        mark = cash + (pos["qty"] * row["close"] if pos else 0.0)
        equity_curve.append(mark)

    if pos is not None:
        close(ind.iloc[-1]["close"] * (1 - slip), len(ind) - 1)
        equity_curve[-1] = cash

    eq = pd.Series(equity_curve)
    max_dd = ((eq / eq.cummax()) - 1).min() * 100 if len(eq) else 0.0
    first, last = ind.iloc[start]["close"], ind.iloc[-1]["close"]
    wins = sum(1 for t in trades if t > 0)
    return {
        "velas": len(ind) - start,
        "operaciones": len(trades),
        "ganadoras_%": round(wins / len(trades) * 100, 1) if trades else 0.0,
        "capital_final": round(cash, 2),
        "retorno_%": round((cash / start_equity - 1) * 100, 2),
        "comprar_y_mantener_%": round((last / first - 1) * 100, 2),
        "max_caida_%": round(max_dd, 2),
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--days", type=int, default=365)
    p.add_argument("--csv", help="CSV con columnas ts,open,high,low,close,volume")
    args = p.parse_args()
    cfg = load_config()
    if args.csv:
        df = pd.read_csv(args.csv)
    else:
        ex = make_exchange(cfg.exchange)
        df = fetch_history(ex, cfg.symbol, cfg.timeframe, args.days)
    print(f"{cfg.symbol} {cfg.timeframe} SMA {cfg.sma_fast}/{cfg.sma_slow} "
          f"SL {cfg.stop_loss_pct}% TP {cfg.take_profit_pct}%")
    for k, v in run_backtest(df, cfg).items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
