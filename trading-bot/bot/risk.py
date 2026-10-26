def position_size_usdt(
    equity: float, risk_pct: float, stop_pct: float, max_position_pct: float
) -> float:
    """Cuanto USDT invertir para que, si salta el stop, pierdas ~risk_pct del capital.

    Ej: capital 100, riesgo 1%, stop 3% -> invierte 33.3 USDT (perdida maxima ~1 USDT).
    """
    if equity <= 0 or stop_pct <= 0:
        return 0.0
    size = equity * (risk_pct / 100) / (stop_pct / 100)
    return min(size, equity * max_position_pct / 100)


def stop_price(entry: float, stop_pct: float) -> float:
    return entry * (1 - stop_pct / 100)


def take_profit_price(entry: float, tp_pct: float) -> float:
    return entry * (1 + tp_pct / 100)


def daily_limit_hit(day_start_equity: float, equity: float, limit_pct: float) -> bool:
    if day_start_equity <= 0:
        return False
    loss_pct = (day_start_equity - equity) / day_start_equity * 100
    return loss_pct >= limit_pct
