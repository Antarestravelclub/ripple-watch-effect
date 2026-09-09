"""
Ripple Effect -> MetaTrader 5 DEMO bridge (helper v2).

Runs on the Windows machine where your MetaTrader 5 DEMO terminal is logged in.

Two loops:
  Phase A (always on)  reports account state, open positions and closed deals.
  Phase B (opt-in)     picks up mirror instructions and places them on the demo
                       account, then reports every outcome back.

HARD RULES
  * Trades only the account number in ALLOWED_ACCOUNT, and only in demo mode.
  * Executes exactly the broker symbol the site sends - never invents or
    transforms symbols.
  * Every attempted instruction is written to a local ledger on disk BEFORE the
    order is sent, so a restart can never double-fill.
  * Market orders only. No pending orders, no SL/TP edits, no partial closes.

Setup (Windows, Python 3.10+):
    pip install MetaTrader5 requests
    set SITE_BASE_URL=https://ripple-watch-effect.lovable.app
    set BRIDGE_SECRET=<the bridge key you saved in the app>
    set ALLOWED_ACCOUNT=<your demo account number>
    set EXECUTION_ENABLED=false
    python mt5_bridge.py

Optional environment variables:
    MAX_LOTS_PER_ORDER      local ceiling, default 10
    REPORT_SECONDS          account/positions cycle, default 30
    DEALS_SECONDS           closed-deal cycle, default 60
    INSTRUCTION_SECONDS     instruction poll, default 12
    STATE_DIR               where the ledger and log are written, default .
"""

import json
import logging
import os
import time
from logging.handlers import RotatingFileHandler
from datetime import datetime, timedelta, timezone

import requests
import MetaTrader5 as mt5

VERSION = "2.0.0"

BASE_URL = (os.environ.get("SITE_BASE_URL") or os.environ.get("RIPPLE_BASE_URL", "")).rstrip("/")
BRIDGE_SECRET = os.environ.get("BRIDGE_SECRET") or os.environ.get("RIPPLE_BRIDGE_KEY", "")
ALLOWED_ACCOUNT = (os.environ.get("ALLOWED_ACCOUNT") or "").strip()
EXECUTION_ENABLED = (os.environ.get("EXECUTION_ENABLED", "false").strip().lower()
                     in ("1", "true", "yes", "on"))
MAX_LOTS_PER_ORDER = float(os.environ.get("MAX_LOTS_PER_ORDER", "10"))
REPORT_SECONDS = int(os.environ.get("REPORT_SECONDS", "30"))
DEALS_SECONDS = int(os.environ.get("DEALS_SECONDS", "60"))
INSTRUCTION_SECONDS = int(os.environ.get("INSTRUCTION_SECONDS", "12"))
STATE_DIR = os.environ.get("STATE_DIR", os.path.dirname(os.path.abspath(__file__)))

if not BASE_URL or not BRIDGE_SECRET:
    raise SystemExit(
        "Missing settings. Set SITE_BASE_URL to your app address and BRIDGE_SECRET "
        "to the bridge key saved in the app, then run again."
    )
if not ALLOWED_ACCOUNT:
    raise SystemExit(
        "Missing ALLOWED_ACCOUNT. Set it to your MetaTrader 5 DEMO account number - "
        "the helper refuses to trade any other account."
    )

HEADERS = {"x-bridge-key": BRIDGE_SECRET, "content-type": "application/json"}
LEDGER_PATH = os.path.join(STATE_DIR, "ripple_ledger.json")
HIGHWATER_PATH = os.path.join(STATE_DIR, "ripple_deals_highwater.json")

# ----------------------------------------------------------------- logging ---
log = logging.getLogger("ripple-bridge")
log.setLevel(logging.INFO)
_fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
_file = RotatingFileHandler(
    os.path.join(STATE_DIR, "ripple_bridge.log"), maxBytes=2_000_000, backupCount=5
)
_file.setFormatter(_fmt)
log.addHandler(_file)
_console = logging.StreamHandler()
_console.setFormatter(_fmt)
log.addHandler(_console)


# ------------------------------------------------------------------ ledger ---
def load_json(path, fallback):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return fallback


def save_json(path, value):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(value, fh)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


LEDGER = load_json(LEDGER_PATH, {})


def ledger_remember(instruction_id, entry):
    LEDGER[instruction_id] = entry
    save_json(LEDGER_PATH, LEDGER)


# -------------------------------------------------------------------- http ---
def post(path, payload, attempts=3):
    for i in range(attempts):
        try:
            res = requests.post(f"{BASE_URL}{path}", headers=HEADERS, json=payload, timeout=30)
            if res.status_code == 200:
                return res.json()
            if res.status_code in (401, 403):
                log.error(
                    "%s rejected [%s]: the bridge key is missing or wrong - check BRIDGE_SECRET.",
                    path, res.status_code,
                )
                return None
            log.warning("%s failed [%s]: %s", path, res.status_code, res.text[:300])
        except Exception as exc:
            log.warning("%s error: %s", path, exc)
        time.sleep(2 ** i)
    return None


def get(path, attempts=3):
    for i in range(attempts):
        try:
            res = requests.get(f"{BASE_URL}{path}", headers=HEADERS, timeout=30)
            if res.status_code == 200:
                return res.json()
            if res.status_code in (401, 403):
                log.error("%s rejected [%s]: check BRIDGE_SECRET.", path, res.status_code)
                return None
            log.warning("%s failed [%s]: %s", path, res.status_code, res.text[:300])
        except Exception as exc:
            log.warning("%s error: %s", path, exc)
        time.sleep(2 ** i)
    return None


# ------------------------------------------------------------------ MT5 IO ---
def account_state():
    info = mt5.account_info()
    if info is None:
        return None
    return {
        "info": info,
        "number": str(info.login),
        "mode": "demo" if info.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO else "live",
    }


def account_payload(state):
    info = state["info"]
    return {
        "account_number": state["number"],
        "account_mode": state["mode"],
        "currency": info.currency,
        "balance": float(info.balance),
        "equity": float(info.equity),
        "margin": float(info.margin),
        "free_margin": float(info.margin_free),
    }


def positions_payload():
    out = []
    for p in mt5.positions_get() or []:
        out.append({
            "ticket": int(p.ticket),
            "symbol": p.symbol,
            "direction": "long" if p.type == mt5.POSITION_TYPE_BUY else "short",
            "lots": float(p.volume),
            "open_price": float(p.price_open),
            "sl": float(p.sl) or None,
            "tp": float(p.tp) or None,
            "current_price": float(p.price_current),
            "profit": float(p.profit),
            "open_time": int(p.time),
        })
    return out


def deals_payload(since_epoch):
    frm = datetime.fromtimestamp(since_epoch, tz=timezone.utc) - timedelta(minutes=5)
    deals = mt5.history_deals_get(frm, datetime.now(timezone.utc) + timedelta(minutes=1)) or []
    out = []
    for d in deals:
        if d.entry not in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_OUT_BY):
            continue
        out.append({
            "deal_id": int(d.ticket),
            "ticket": int(d.position_id),
            "symbol": d.symbol,
            "direction": "short" if d.type == mt5.DEAL_TYPE_SELL else "long",
            "lots": float(d.volume),
            "open_price": None,
            "close_price": float(d.price),
            "profit": float(d.profit),
            "commission": float(d.commission),
            "swap": float(d.swap),
            "open_time": None,
            "close_time": int(d.time),
        })
    return out


def startup_check():
    if not mt5.initialize():
        raise SystemExit(f"Could not attach to MetaTrader 5: {mt5.last_error()}")
    state = account_state()
    if state is None:
        raise SystemExit("No account is logged in inside the terminal.")

    info = state["info"]
    log.info(
        "Startup: account %s on %s | mode %s | equity %.2f %s | helper %s | execution %s",
        state["number"], info.server, state["mode"], info.equity, info.currency, VERSION,
        "ENABLED" if EXECUTION_ENABLED else "disabled",
    )

    safe = state["mode"] == "demo" and state["number"] == ALLOWED_ACCOUNT
    if not safe:
        log.error(
            "SAFETY REFUSAL: connected account %s (%s) does not match the allowed DEMO "
            "account %s. Reporting only - no orders will ever be placed.",
            state["number"], state["mode"], ALLOWED_ACCOUNT,
        )
        # Tell the site the truth so it can show its red banner.
        post("/api/public/bridge/account", account_payload(state))
    return safe


# ------------------------------------------------------------- instructions ---
def volume_for(symbol_info, lots):
    step = symbol_info.volume_step or 0.01
    v = round(round(lots / step) * step, 8)
    if v < symbol_info.volume_min:
        return None, f"below broker minimum volume {symbol_info.volume_min}"
    if v > symbol_info.volume_max:
        v = symbol_info.volume_max
    if v > MAX_LOTS_PER_ORDER:
        return None, f"above local ceiling MAX_LOTS_PER_ORDER={MAX_LOTS_PER_ORDER}"
    return v, None


def report(instruction_id, payload):
    result = post(f"/api/public/bridge/instructions/{instruction_id}/result", payload)
    if result is None:
        log.error("Could not report instruction %s - will retry next cycle.", instruction_id)
        return False
    log.info("Reported %s: %s", instruction_id, payload.get("status"))
    return True


def reject(instruction_id, reason):
    log.warning("Rejecting %s: %s", instruction_id, reason)
    entry = {"status": "rejected", "detail": reason}
    ledger_remember(instruction_id, entry)
    report(instruction_id, entry)


def close_by_ticket(instruction, symbol):
    ticket = instruction.get("ticket")
    positions = [p for p in (mt5.positions_get(symbol=symbol) or []) if int(p.ticket) == int(ticket)]
    if not positions:
        # The server-side stop or target got there first; report the real close.
        deals = mt5.history_deals_get(
            datetime.now(timezone.utc) - timedelta(days=14), datetime.now(timezone.utc)
        ) or []
        exits = [
            d for d in deals
            if int(d.position_id) == int(ticket)
            and d.entry in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_OUT_BY)
        ]
        if exits:
            last = exits[-1]
            return {
                "status": "filled",
                "fill_price": float(last.price),
                "fill_time": datetime.fromtimestamp(last.time, tz=timezone.utc).isoformat(),
                "ticket": int(ticket),
                "detail": "Position had already closed on the broker's own stop or target.",
            }
        return {"status": "rejected", "detail": "position_not_found"}

    pos = positions[0]
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return {"status": "rejected", "detail": "no_quote_for_symbol"}
    req = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": pos.volume,
        "type": mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY,
        "position": pos.ticket,
        "price": tick.bid if pos.type == mt5.POSITION_TYPE_BUY else tick.ask,
        "deviation": 30,
        "comment": f"ripple:{instruction['id'][:8]}",
    }
    res = mt5.order_send(req)
    if res is None or res.retcode != mt5.TRADE_RETCODE_DONE:
        return {
            "status": "rejected",
            "detail": f"retcode {getattr(res, 'retcode', 'none')}: "
                      f"{getattr(res, 'comment', mt5.last_error())}",
        }
    return {
        "status": "filled",
        "fill_price": float(res.price),
        "fill_time": datetime.now(timezone.utc).isoformat(),
        "ticket": int(pos.ticket),
    }


def open_position(instruction, symbol, volume):
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return {"status": "rejected", "detail": "no_quote_for_symbol"}
    is_buy = instruction["direction"] == "long"
    req = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": mt5.ORDER_TYPE_BUY if is_buy else mt5.ORDER_TYPE_SELL,
        "price": tick.ask if is_buy else tick.bid,
        "deviation": 30,
        "comment": f"ripple:{instruction['id'][:8]}",
    }
    if instruction.get("sl"):
        req["sl"] = float(instruction["sl"])
    if instruction.get("tp"):
        req["tp"] = float(instruction["tp"])

    res = mt5.order_send(req)
    if res is None or res.retcode != mt5.TRADE_RETCODE_DONE:
        return {
            "status": "rejected",
            "detail": f"retcode {getattr(res, 'retcode', 'none')}: "
                      f"{getattr(res, 'comment', mt5.last_error())}",
        }
    ticket = int(res.order)
    for p in mt5.positions_get(symbol=symbol) or []:
        if p.comment == req["comment"]:
            ticket = int(p.ticket)
            break
    return {
        "status": "filled",
        "fill_price": float(res.price),
        "fill_time": datetime.now(timezone.utc).isoformat(),
        "ticket": ticket,
    }


def handle_instruction(instruction):
    iid = instruction["id"]
    log.info(
        "Instruction %s: %s %s %s lots %s",
        iid, instruction["action"], instruction["direction"],
        instruction["broker_symbol"], instruction.get("lots"),
    )

    # Idempotency: never place the same instruction twice, even after a restart.
    known = LEDGER.get(iid)
    if known:
        log.info("Instruction %s already attempted - re-posting the stored result.", iid)
        report(iid, known)
        return

    state = account_state()
    if state is None or state["mode"] != "demo" or state["number"] != ALLOWED_ACCOUNT:
        reject(iid, "account_mismatch")
        return

    symbol = instruction["broker_symbol"]
    info = mt5.symbol_info(symbol)
    if info is None or not mt5.symbol_select(symbol, True):
        reject(iid, "symbol_not_found")
        return

    if instruction["action"] == "open":
        volume, problem = volume_for(mt5.symbol_info(symbol), float(instruction.get("lots") or 0))
        if volume is None:
            reject(iid, f"volume_rejected: {problem}")
            return
        ledger_remember(iid, {"status": "rejected", "detail": "attempted, awaiting result"})
        outcome = open_position(instruction, symbol, volume)
    else:
        ledger_remember(iid, {"status": "rejected", "detail": "attempted, awaiting result"})
        outcome = close_by_ticket(instruction, symbol)

    ledger_remember(iid, outcome)
    report(iid, outcome)


# ------------------------------------------------------------------- loops ---
def main():
    execution_allowed = startup_check() and EXECUTION_ENABLED
    if EXECUTION_ENABLED and not execution_allowed:
        log.error("EXECUTION_ENABLED was true but the safety check failed - reporting only.")
    log.info(
        "Reporting to %s. Execution loop %s.",
        BASE_URL, "running" if execution_allowed else "off",
    )

    highwater = load_json(HIGHWATER_PATH, {"epoch": int(time.time()) - 86400})
    next_report = 0.0
    next_deals = 0.0
    next_instructions = 0.0

    while True:
        now = time.time()
        try:
            if now >= next_report:
                state = account_state()
                if state is None:
                    log.warning("Terminal reports no logged-in account.")
                else:
                    post("/api/public/bridge/account", account_payload(state))
                    post("/api/public/bridge/positions", {"positions": positions_payload()})
                next_report = now + REPORT_SECONDS

            if now >= next_deals:
                deals = deals_payload(highwater["epoch"])
                if deals:
                    if post("/api/public/bridge/deals", {"deals": deals}) is not None:
                        highwater = {"epoch": max(d["close_time"] for d in deals)}
                        save_json(HIGHWATER_PATH, highwater)
                        log.info("Reported %d closed deal(s).", len(deals))
                next_deals = now + DEALS_SECONDS

            if execution_allowed and now >= next_instructions:
                payload = get("/api/public/bridge/instructions?status=pending&limit=10")
                for instruction in (payload or {}).get("instructions", []):
                    handle_instruction(instruction)
                next_instructions = now + INSTRUCTION_SECONDS
        except Exception as exc:  # keep the loops alive whatever happens
            log.exception("loop error: %s", exc)

        time.sleep(2)


if __name__ == "__main__":
    main()
