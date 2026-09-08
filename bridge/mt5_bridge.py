"""
Ripple Effect -> MetaTrader 5 DEMO bridge.

Runs on the Windows machine where your MetaTrader 5 DEMO terminal is logged in.
It polls the app for queued orders, places them on the demo account with stop
and target attached, and reports the result back.

HARD RULE: if the connected account is not a demo account, this script exits.

Setup (Windows, Python 3.10+):
    pip install MetaTrader5 requests
    set RIPPLE_BASE_URL=https://ripple-watch-effect.lovable.app
    set RIPPLE_BRIDGE_KEY=<the bridge key you saved in the app>
    python mt5_bridge.py

Optional environment variables:
    RIPPLE_POLL_SECONDS   default 30
    RIPPLE_LOT            fixed lot size per order, default 0.10
    RIPPLE_SYMBOL_SUFFIX  broker symbol suffix, e.g. ".cash" or "-CFD"
    RIPPLE_MAX_ORDERS     orders claimed per poll, default 10
"""

import os
import time
import requests
import MetaTrader5 as mt5

VERSION = "1.0.0"

BASE_URL = os.environ.get("RIPPLE_BASE_URL", "").rstrip("/")
BRIDGE_KEY = os.environ.get("RIPPLE_BRIDGE_KEY", "")
POLL_SECONDS = int(os.environ.get("RIPPLE_POLL_SECONDS", "30"))
LOT = float(os.environ.get("RIPPLE_LOT", "0.10"))
SUFFIX = os.environ.get("RIPPLE_SYMBOL_SUFFIX", "")
MAX_ORDERS = int(os.environ.get("RIPPLE_MAX_ORDERS", "10"))

if not BASE_URL or not BRIDGE_KEY:
    raise SystemExit("Set RIPPLE_BASE_URL and RIPPLE_BRIDGE_KEY first.")

HEADERS = {"x-bridge-key": BRIDGE_KEY, "content-type": "application/json"}


def connect():
    if not mt5.initialize():
        raise SystemExit(f"Could not attach to MetaTrader 5: {mt5.last_error()}")
    info = mt5.account_info()
    if info is None:
        raise SystemExit("No account is logged in inside the terminal.")
    is_demo = info.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO
    if not is_demo:
        mt5.shutdown()
        raise SystemExit(
            "Refusing to run: this terminal is not logged into a DEMO account."
        )
    print(f"Attached to DEMO account {info.login} on {info.server}")
    return info


def heartbeat(info):
    positions = mt5.positions_total() or 0
    return {
        "bridge_version": VERSION,
        "account_login": str(info.login),
        "account_server": info.server,
        "account_is_demo": True,
        "balance": float(info.balance),
        "equity": float(info.equity),
        "currency": info.currency,
        "open_positions": int(positions),
        "note": f"lot {LOT}{' suffix ' + SUFFIX if SUFFIX else ''}",
    }


def resolve_symbol(ticker: str):
    """Find a tradeable symbol on this broker for the app's ticker."""
    for candidate in (ticker + SUFFIX, ticker):
        if mt5.symbol_info(candidate) is not None and mt5.symbol_select(candidate, True):
            return candidate
    return None


def place(order):
    symbol = resolve_symbol(order["ticker"])
    if symbol is None:
        return {
            "id": order["id"],
            "status": "skipped",
            "error": "symbol not available on this broker",
        }

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return {"id": order["id"], "status": "skipped", "error": "no quote for symbol"}

    is_buy = order["side"] == "buy"

    # Closing intent: flatten any position this bridge opened on that symbol.
    if order["intent"] == "close":
        closed = []
        for pos in mt5.positions_get(symbol=symbol) or []:
            req = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": pos.volume,
                "type": mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY,
                "position": pos.ticket,
                "price": tick.bid if pos.type == mt5.POSITION_TYPE_BUY else tick.ask,
                "deviation": 30,
                "comment": "ripple close",
            }
            res = mt5.order_send(req)
            if res and res.retcode == mt5.TRADE_RETCODE_DONE:
                closed.append(res)
        if not closed:
            return {"id": order["id"], "status": "skipped", "error": "no open position"}
        last = closed[-1]
        return {
            "id": order["id"],
            "status": "filled",
            "broker_symbol": symbol,
            "broker_ticket": str(last.order),
            "filled_price": float(last.price),
            "filled_volume": float(last.volume),
        }

    price = tick.ask if is_buy else tick.bid
    req = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": LOT,
        "type": mt5.ORDER_TYPE_BUY if is_buy else mt5.ORDER_TYPE_SELL,
        "price": price,
        "deviation": 30,
        "comment": "ripple open",
    }
    if order.get("stop_price"):
        req["sl"] = float(order["stop_price"])
    if order.get("target_price"):
        req["tp"] = float(order["target_price"])

    res = mt5.order_send(req)
    if res is None or res.retcode != mt5.TRADE_RETCODE_DONE:
        return {
            "id": order["id"],
            "status": "rejected",
            "broker_symbol": symbol,
            "error": f"retcode {getattr(res, 'retcode', 'none')}: {getattr(res, 'comment', mt5.last_error())}",
        }
    return {
        "id": order["id"],
        "status": "filled",
        "broker_symbol": symbol,
        "broker_ticket": str(res.order),
        "filled_price": float(res.price),
        "filled_volume": float(res.volume),
    }


def main():
    info = connect()
    while True:
        try:
            poll = requests.post(
                f"{BASE_URL}/api/public/bridge/orders",
                headers=HEADERS,
                json={"limit": MAX_ORDERS, "heartbeat": heartbeat(mt5.account_info() or info)},
                timeout=30,
            )
            if poll.status_code != 200:
                print(f"poll failed [{poll.status_code}]: {poll.text[:300]}")
                time.sleep(POLL_SECONDS)
                continue

            orders = poll.json().get("orders", [])
            if orders:
                reports = [place(o) for o in orders]
                for r in reports:
                    print(f"  {r['status']}: {r.get('broker_symbol', '')} {r.get('error', '')}")
                send = requests.post(
                    f"{BASE_URL}/api/public/bridge/fills",
                    headers=HEADERS,
                    json={"reports": reports},
                    timeout=30,
                )
                if send.status_code != 200:
                    print(f"report failed [{send.status_code}]: {send.text[:300]}")
            else:
                print("nothing queued")
        except Exception as exc:  # keep the loop alive
            print(f"error: {exc}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
