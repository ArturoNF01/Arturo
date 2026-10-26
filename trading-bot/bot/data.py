import ccxt
import pandas as pd


def make_exchange(name: str, api_key: str = "", api_secret: str = "", sandbox: bool = False):
    params = {"enableRateLimit": True}
    if api_key:
        params.update({"apiKey": api_key, "secret": api_secret})
    ex = getattr(ccxt, name)(params)
    if sandbox:
        ex.set_sandbox_mode(True)
    return ex


def to_dataframe(ohlcv: list) -> pd.DataFrame:
    df = pd.DataFrame(ohlcv, columns=["ts", "open", "high", "low", "close", "volume"])
    return df.drop_duplicates("ts").reset_index(drop=True)


def fetch_closed_candles(ex, symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
    """Ultimas `limit` velas CERRADAS (descarta la vela en curso)."""
    df = to_dataframe(ex.fetch_ohlcv(symbol, timeframe, limit=limit + 1))
    return df.iloc[:-1].reset_index(drop=True)


def fetch_history(ex, symbol: str, timeframe: str, days: int) -> pd.DataFrame:
    """Historial paginado para backtest."""
    ms_per_candle = ex.parse_timeframe(timeframe) * 1000
    since = ex.milliseconds() - days * 24 * 3600 * 1000
    rows: list = []
    while True:
        batch = ex.fetch_ohlcv(symbol, timeframe, since=since, limit=1000)
        if not batch:
            break
        rows.extend(batch)
        since = batch[-1][0] + ms_per_candle
        if len(batch) < 1000:
            break
    return to_dataframe(rows).iloc[:-1].reset_index(drop=True)
