from dataclasses import dataclass

from .data import make_exchange


@dataclass
class Fill:
    price: float
    qty: float  # cantidad de la moneda base (ej. BTC) neta de comision


class PaperBroker:
    """Dinero simulado con precios reales. No necesita API key."""

    def __init__(self, ex, symbol: str, fee_pct: float, start_usdt: float,
                 usdt: float | None = None, base: float = 0.0):
        self.ex, self.symbol, self.fee = ex, symbol, fee_pct / 100
        self.usdt = start_usdt if usdt is None else usdt
        self.base = base

    def price(self) -> float:
        return float(self.ex.fetch_ticker(self.symbol)["last"])

    def usdt_balance(self) -> float:
        return self.usdt

    def buy(self, usdt: float) -> Fill:
        usdt = min(usdt, self.usdt)
        p = self.price()
        qty = usdt * (1 - self.fee) / p
        self.usdt -= usdt
        self.base += qty
        return Fill(p, qty)

    def sell(self, qty: float) -> Fill:
        qty = min(qty, self.base)
        p = self.price()
        self.base -= qty
        self.usdt += qty * p * (1 - self.fee)
        return Fill(p, qty)

    def snapshot(self) -> dict:
        return {"usdt": self.usdt, "base": self.base}


class CcxtBroker:
    """Ordenes reales (testnet o live) por ccxt. Solo ordenes de mercado en spot."""

    def __init__(self, exchange: str, symbol: str, api_key: str, api_secret: str, sandbox: bool):
        self.ex = make_exchange(exchange, api_key, api_secret, sandbox=sandbox)
        self.symbol = symbol
        self.ex.load_markets()
        self.market = self.ex.market(symbol)
        self.base_cur = self.market["base"]
        self.quote_cur = self.market["quote"]

    def price(self) -> float:
        return float(self.ex.fetch_ticker(self.symbol)["last"])

    def usdt_balance(self) -> float:
        return float(self.ex.fetch_balance()["free"].get(self.quote_cur, 0.0))

    def min_cost(self) -> float:
        return float((self.market.get("limits", {}).get("cost", {}) or {}).get("min") or 0.0)

    def buy(self, usdt: float) -> Fill:
        order = self.ex.create_market_buy_order_with_cost(self.symbol, usdt)
        return self._fill(order)

    def sell(self, qty: float) -> Fill:
        free = float(self.ex.fetch_balance()["free"].get(self.base_cur, 0.0))
        qty = float(self.ex.amount_to_precision(self.symbol, min(qty, free)))
        order = self.ex.create_market_sell_order(self.symbol, qty)
        return self._fill(order, sell=True)

    def _fill(self, order: dict, sell: bool = False) -> Fill:
        if not order.get("average") or order.get("filled") is None:
            order = self.ex.fetch_order(order["id"], self.symbol)
        fees = order.get("fees") or ([order["fee"]] if order.get("fee") else [])
        fee_base = sum(f.get("cost") or 0.0 for f in fees if f.get("currency") == self.base_cur)
        filled = float(order["filled"])
        qty = filled if sell else filled - fee_base
        return Fill(float(order["average"]), qty)

    def snapshot(self) -> dict:
        return {}
