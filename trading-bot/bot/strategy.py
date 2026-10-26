import pandas as pd


def add_indicators(df: pd.DataFrame, fast: int, slow: int) -> pd.DataFrame:
    out = df.copy()
    out["sma_fast"] = out["close"].rolling(fast).mean()
    out["sma_slow"] = out["close"].rolling(slow).mean()
    return out


def signal(df: pd.DataFrame, fast: int, slow: int) -> str:
    """Senal sobre la ultima vela CERRADA del dataframe.

    'buy'  : la media rapida cruza por encima de la lenta
    'sell' : la media rapida cruza por debajo de la lenta
    'hold' : sin cruce
    """
    ind = add_indicators(df, fast, slow).dropna()
    if len(ind) < 2:
        return "hold"
    prev, last = ind.iloc[-2], ind.iloc[-1]
    if prev["sma_fast"] <= prev["sma_slow"] and last["sma_fast"] > last["sma_slow"]:
        return "buy"
    if prev["sma_fast"] >= prev["sma_slow"] and last["sma_fast"] < last["sma_slow"]:
        return "sell"
    return "hold"
