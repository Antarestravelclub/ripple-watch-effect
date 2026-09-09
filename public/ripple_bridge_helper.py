"""
Ripple Bridge Helper — Demo Sync + Mirror Execution
====================================================

Connects the local MT5 terminal (XM demo account) to The Ripple Effect site.

Phase A (always on): reports account snapshot, open positions, closed deals.
Phase B (EXECUTION_ENABLED=true): polls for mirror instructions and places
demo-only market orders, with a disk-persisted idempotency ledger.

Safety model (defense in depth):
  - Hard account allowlist (ALLOWED_ACCOUNT) checked at startup AND every cycle.
  - Refuses all execution if the terminal reports a non-demo account.
  - Never re-places an instruction id already in the ledger.
  - Executes exactly the broker symbol given, or rejects.

Requires:  pip install MetaTrader5 requests
Run:       python ripple_bridge_helper.py
Config:    bridge_config.json next to this file (see bridge_config.example.json)
"""

import json
import logging
import logging.handlers
import os
import signal
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

try:
    import MetaTrader5 as mt5
except ImportError:
    print("MetaTrader5 package not installed. Run:  pip install MetaTrader5")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "bridge_config.json"
LEDGER_PATH = BASE_DIR / "instruction_ledger.json"
DEALS_MARK_PATH = BASE_DIR / "deals_highwater.json"
LOG_PATH = BASE_DIR / "bridge_helper.log"

# Every site endpoint lives under this prefix.
API_PREFIX = "/api/public/bridge"

DEFAULTS = {
    "SITE_BASE_URL": "",             # e.g. https://ripple-watch-effect.lovable.app
    "BRIDGE_SECRET": "",             # same value stored server-side as BRIDGE_SECRET
    "ALLOWED_ACCOUNT": 0,            # demo account number (int)
    "EXECUTION_ENABLED": False,
    "MAX_LOTS_PER_ORDER": 10.0,
    "ACCOUNT_POST_INTERVAL_S": 45,
    "DEALS_POST_INTERVAL_S": 60,
    "INSTRUCTION_POLL_INTERVAL_S": 12,
    "HTTP_TIMEOUT_S": 15,
    "DEALS_LOOKBACK_DAYS_ON_FIRST_RUN": 7,
    "MAGIC_NUMBER": 774411,          # tags orders placed by this helper
}


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        print(f"Missing config file: {CONFIG_PATH}")
        print("Copy bridge_config.example.json to bridge_config.json and fill it in.")
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        user_cfg = json.load(f)
    cfg = {**DEFAULTS, **user_cfg}
    problems = []
    if not cfg["SITE_BASE_URL"].startswith("http"):
        problems.append("SITE_BASE_URL must be a full https:// URL")
    if not cfg["BRIDGE_SECRET"]:
        problems.append("BRIDGE_SECRET is empty")
    if not int(cfg["ALLOWED_ACCOUNT"]):
        problems.append("ALLOWED_ACCOUNT is not set")
    if problems:
        for p in problems:
            print("CONFIG ERROR:", p)
        sys.exit(1)
    cfg["SITE_BASE_URL"] = cfg["SITE_BASE_URL"].rstrip("/")
    cfg["ALLOWED_ACCOUNT"] = int(cfg["ALLOWED_ACCOUNT"])
    return cfg


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

log = logging.getLogger("bridge")
log.setLevel(logging.INFO)
_handler = logging.handlers.RotatingFileHandler(
    LOG_PATH, maxBytes=5_000_000, backupCount=5, encoding="utf-8"
)
_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
log.addHandler(_handler)
_console = logging.StreamHandler(sys.stdout)
_console.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
log.addHandler(_console)


# ---------------------------------------------------------------------------
# Small persistent stores (idempotency ledger + deals high-water mark)
# ---------------------------------------------------------------------------

def _load_json(path: Path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def _save_json(path: Path, data) -> None:
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
    os.replace(tmp, path)  # atomic on Windows and POSIX


class InstructionLedger:
    """Disk-persisted record of every instruction id we have ATTEMPTED,
    written BEFORE the order is sent, so a crash can never double-place."""

    def __init__(self):
        self.data = _load_json(LEDGER_PATH, {})  # id -> {"result": {...} | None}

    def seen(self, iid: str) -> bool:
        return iid in self.data

    def mark_attempting(self, iid: str, action: str) -> None:
        self.data[iid] = {"action": action, "attempted_at": now_iso(), "result": None}
        _save_json(LEDGER_PATH, self.data)

    def record_result(self, iid: str, result: dict) -> None:
        if iid in self.data:
            self.data[iid]["result"] = result
            _save_json(LEDGER_PATH, self.data)

    def previous_result(self, iid: str):
        return self.data.get(iid, {}).get("result")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Site client
# ---------------------------------------------------------------------------

class SiteClient:
    def __init__(self, cfg: dict):
        self.base = cfg["SITE_BASE_URL"] + API_PREFIX
        self.timeout = cfg["HTTP_TIMEOUT_S"]
        self.session = requests.Session()
        # The site authenticates the helper solely via the x-bridge-key header.
        self.session.headers.update(
            {
                "x-bridge-key": cfg["BRIDGE_SECRET"],
                "Content-Type": "application/json",
            }
        )

    def post(self, path: str, payload: dict) -> bool:
        url = self.base + path
        try:
            r = self.session.post(url, json=payload, timeout=self.timeout)
            if r.status_code >= 400:
                log.error("POST %s -> %s %s", path, r.status_code, r.text[:300])
                return False
            return True
        except requests.RequestException as e:
            log.error("POST %s failed: %s", path, e)
            return False

    def get_pending_instructions(self):
        url = self.base + "/instructions"
        try:
            r = self.session.get(url, params={"status": "pending"}, timeout=self.timeout)
            if r.status_code >= 400:
                log.error("GET /instructions -> %s %s", r.status_code, r.text[:300])
                return []
            body = r.json()
            if isinstance(body, dict):
                return body.get("instructions", [])
            return body if isinstance(body, list) else []
        except (requests.RequestException, ValueError) as e:
            log.error("GET /instructions failed: %s", e)
            return []

    def post_result(self, iid: str, result: dict) -> bool:
        return self.post(f"/instructions/{iid}/result", result)


# ---------------------------------------------------------------------------
# MT5 helpers
# ---------------------------------------------------------------------------

def mt5_connect() -> bool:
    if not mt5.initialize():
        log.error("mt5.initialize() failed: %s", mt5.last_error())
        return False
    return True


def account_ok(cfg: dict):
    """Returns (ok: bool, info, mode: 'demo'|'live').

    Anything that is not a verified demo account is reported to the site as
    'live' — the site's schema only accepts demo|live, and treating contest or
    unknown modes as live is the safe side (it cancels pending instructions).
    """
    info = mt5.account_info()
    if info is None:
        return False, None, "live"
    mode = "demo" if info.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO else "live"
    ok = (info.login == cfg["ALLOWED_ACCOUNT"]) and (mode == "demo")
    return ok, info, mode


def snapshot_payload(info, mode: str) -> dict:
    return {
        "account_number": str(info.login),
        "account_mode": mode,
        "currency": info.currency,
        "balance": info.balance,
        "equity": info.equity,
        "margin": info.margin,
        "free_margin": info.margin_free,
    }


def positions_payload() -> dict:
    positions = mt5.positions_get() or []
    rows = []
    for p in positions:
        rows.append(
            {
                "ticket": p.ticket,
                "symbol": p.symbol,
                "direction": "long" if p.type == mt5.POSITION_TYPE_BUY else "short",
                "lots": p.volume,
                "open_price": p.price_open,
                "sl": p.sl,
                "tp": p.tp,
                "current_price": p.price_current,
                "profit": p.profit,
                "open_time": datetime.fromtimestamp(p.time, tz=timezone.utc).isoformat(),
            }
        )
    return {"positions": rows}


def deals_payload(cfg: dict) -> dict | None:
    """Closed deals since the persisted high-water mark (server dedupes by deal_id)."""
    mark = _load_json(DEALS_MARK_PATH, {})
    since_ts = mark.get("since_ts")
    if since_ts is None:
        since = datetime.now(timezone.utc) - timedelta(
            days=cfg["DEALS_LOOKBACK_DAYS_ON_FIRST_RUN"]
        )
    else:
        # small overlap so nothing is missed; server dedupes
        since = datetime.fromtimestamp(since_ts - 300, tz=timezone.utc)

    deals = mt5.history_deals_get(since, datetime.now(timezone.utc) + timedelta(days=1))
    if deals is None:
        return None

    rows = []
    newest = since_ts or 0
    for d in deals:
        if d.entry != mt5.DEAL_ENTRY_OUT:  # only closing deals carry realized P&L
            continue
        rows.append(
            {
                "deal_id": d.ticket,
                "ticket": d.position_id,
                "symbol": d.symbol,
                "direction": "long" if d.type == mt5.DEAL_TYPE_SELL else "short",
                "lots": d.volume,
                "close_price": d.price,
                "profit": d.profit,
                "commission": d.commission,
                "swap": d.swap,
                "close_time": datetime.fromtimestamp(d.time, tz=timezone.utc).isoformat(),
            }
        )
        newest = max(newest, d.time)

    if newest:
        _save_json(DEALS_MARK_PATH, {"since_ts": newest})
    return {"deals": rows}


# ---------------------------------------------------------------------------
# Execution (Phase B)
# ---------------------------------------------------------------------------

def reject(reason: str, detail: str = "") -> dict:
    # The result endpoint reads "detail" (or "error"); send both names so the
    # reason always lands in status_detail on the site.
    text = f"{reason}: {detail}".strip(": ")
    return {"status": "rejected", "detail": text, "error": text}


def validate_and_prepare(cfg: dict, ins: dict):
    """Local validation. Returns (symbol_info, lots, error_result_or_None)."""
    symbol = ins.get("broker_symbol", "")
    lots = float(ins.get("lots", 0))

    if lots <= 0:
        return None, 0, reject("invalid_lots", str(lots))
    if lots > float(cfg["MAX_LOTS_PER_ORDER"]):
        return None, 0, reject("lots_exceed_local_max",
                               f"{lots} > {cfg['MAX_LOTS_PER_ORDER']}")

    si = mt5.symbol_info(symbol)
    if si is None:
        return None, 0, reject("symbol_not_found", symbol)
    if not si.visible and not mt5.symbol_select(symbol, True):
        return None, 0, reject("symbol_select_failed", symbol)
    si = mt5.symbol_info(symbol)  # refresh after select

    # Round to volume step; refuse below min, cap check against symbol max.
    step = si.volume_step or 0.01
    lots = round(round(lots / step) * step, 8)
    if lots < si.volume_min:
        return None, 0, reject("lots_below_symbol_min",
                               f"{lots} < min {si.volume_min}")
    if si.volume_max and lots > si.volume_max:
        return None, 0, reject("lots_above_symbol_max",
                               f"{lots} > max {si.volume_max}")
    return si, lots, None


def execute_open(cfg: dict, ins: dict) -> dict:
    si, lots, err = validate_and_prepare(cfg, ins)
    if err:
        return err
    symbol = si.name
    direction = ins.get("direction")
    if direction not in ("long", "short"):
        return reject("invalid_direction", str(direction))

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return reject("no_tick_data", symbol)

    order_type = mt5.ORDER_TYPE_BUY if direction == "long" else mt5.ORDER_TYPE_SELL
    price = tick.ask if direction == "long" else tick.bid

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lots,
        "type": order_type,
        "price": price,
        "deviation": 20,
        "magic": cfg["MAGIC_NUMBER"],
        "comment": f"ripple:{str(ins['id'])[:8]}",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    sl = ins.get("sl")
    tp = ins.get("tp")
    if sl:
        request["sl"] = float(sl)
    if tp:
        request["tp"] = float(tp)

    result = mt5.order_send(request)
    if result is None:
        return reject("order_send_none", str(mt5.last_error()))
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return reject(f"mt5_retcode_{result.retcode}", result.comment)

    return {
        "status": "filled",
        "fill_price": result.price,
        "fill_time": now_iso(),
        "ticket": result.order,
    }


def execute_close(cfg: dict, ins: dict) -> dict:
    ticket = ins.get("ticket")
    if not ticket:
        return reject("missing_ticket")
    ticket = int(ticket)

    positions = mt5.positions_get(ticket=ticket)
    if not positions:
        # Already closed (e.g. broker-side SL/TP hit first): report actual close.
        deals = mt5.history_deals_get(position=ticket)
        if deals:
            closing = [d for d in deals if d.entry == mt5.DEAL_ENTRY_OUT]
            if closing:
                d = closing[-1]
                return {
                    "status": "filled",
                    "fill_price": d.price,
                    "fill_time": datetime.fromtimestamp(
                        d.time, tz=timezone.utc
                    ).isoformat(),
                    "ticket": ticket,
                    "detail": "already_closed",
                }
        return reject("position_not_found", str(ticket))

    p = positions[0]
    tick = mt5.symbol_info_tick(p.symbol)
    if tick is None:
        return reject("no_tick_data", p.symbol)

    close_type = (
        mt5.ORDER_TYPE_SELL if p.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
    )
    price = tick.bid if p.type == mt5.POSITION_TYPE_BUY else tick.ask

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": p.symbol,
        "volume": p.volume,
        "type": close_type,
        "position": ticket,
        "price": price,
        "deviation": 20,
        "magic": cfg["MAGIC_NUMBER"],
        "comment": f"ripple-close:{str(ins['id'])[:8]}",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    if result is None:
        return reject("order_send_none", str(mt5.last_error()))
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return reject(f"mt5_retcode_{result.retcode}", result.comment)

    return {
        "status": "filled",
        "fill_price": result.price,
        "fill_time": now_iso(),
        "ticket": ticket,
    }


def process_instructions(cfg: dict, site: SiteClient, ledger: InstructionLedger):
    # Per-cycle safety re-check — never trust the startup check alone.
    ok, info, mode = account_ok(cfg)
    if not ok:
        log.error(
            "SAFETY REFUSAL: connected account %s mode=%s does not match allowlist "
            "%s/demo — skipping execution cycle",
            getattr(info, "login", "?"), mode, cfg["ALLOWED_ACCOUNT"],
        )
        return

    for ins in site.get_pending_instructions():
        iid = str(ins.get("id", ""))
        action = ins.get("action", "")
        if not iid:
            continue

        if ledger.seen(iid):
            prev = ledger.previous_result(iid)
            if prev:
                log.info("Instruction %s already attempted; re-posting prior result", iid)
                site.post_result(iid, prev)
            else:
                # Attempted but crashed before recording a result: do NOT re-place.
                log.error(
                    "Instruction %s in ledger with no recorded result — manual check "
                    "required (look for comment ripple:%s in MT5). Reporting rejected.",
                    iid, iid[:8],
                )
                res = reject("ambiguous_prior_attempt",
                             "helper crashed mid-order; check MT5 manually")
                ledger.record_result(iid, res)
                site.post_result(iid, res)
            continue

        log.info("Instruction %s: %s %s %s lots=%s", iid, action,
                 ins.get("direction"), ins.get("broker_symbol"), ins.get("lots"))

        ledger.mark_attempting(iid, action)  # written to disk BEFORE order_send

        if action == "open":
            res = execute_open(cfg, ins)
        elif action == "close":
            res = execute_close(cfg, ins)
        else:
            res = reject("unknown_action", action)

        ledger.record_result(iid, res)
        log.info("Instruction %s result: %s %s", iid, res.get("status"),
                 res.get("detail", ""))

        if not site.post_result(iid, res):
            log.error("Failed to report result for %s; will retry via ledger replay", iid)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

RUNNING = True


def _stop(*_):
    global RUNNING
    RUNNING = False


def main():
    cfg = load_config()
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    log.info("=== Ripple Bridge Helper starting ===")
    log.info("Site: %s | Allowed account: %s | EXECUTION_ENABLED=%s",
             cfg["SITE_BASE_URL"], cfg["ALLOWED_ACCOUNT"], cfg["EXECUTION_ENABLED"])

    if not mt5_connect():
        sys.exit(1)

    site = SiteClient(cfg)
    ledger = InstructionLedger()

    # Startup safety check
    ok, info, mode = account_ok(cfg)
    if info is None:
        log.error("Cannot read account info from MT5 terminal. Is it running and logged in?")
        sys.exit(1)

    site.post("/account", snapshot_payload(info, mode))  # site shows banner if live

    execution_allowed = ok and bool(cfg["EXECUTION_ENABLED"])
    if not ok:
        log.error(
            "STARTUP SAFETY CHECK FAILED: connected account=%s mode=%s, "
            "allowlist=%s/demo. Reporting will run; EXECUTION IS DISABLED.",
            info.login, mode, cfg["ALLOWED_ACCOUNT"],
        )
    elif not cfg["EXECUTION_ENABLED"]:
        log.info("Startup check passed. EXECUTION_ENABLED=false — Phase A reporting only.")
    else:
        log.info("Startup check passed. Execution ENABLED (demo account %s).", info.login)

    last_account = last_deals = last_poll = 0.0
    while RUNNING:
        now = time.monotonic()
        try:
            if now - last_account >= cfg["ACCOUNT_POST_INTERVAL_S"]:
                ok_now, info_now, mode_now = account_ok(cfg)
                if info_now is not None:
                    site.post("/account", snapshot_payload(info_now, mode_now))
                    site.post("/positions", positions_payload())
                else:
                    log.error("account_info() returned None (terminal disconnected?)")
                last_account = now

            if now - last_deals >= cfg["DEALS_POST_INTERVAL_S"]:
                payload = deals_payload(cfg)
                if payload is not None:
                    if payload["deals"]:
                        log.info("Posting %d closed deal(s)", len(payload["deals"]))
                    site.post("/deals", payload)
                last_deals = now

            if execution_allowed and now - last_poll >= cfg["INSTRUCTION_POLL_INTERVAL_S"]:
                process_instructions(cfg, site, ledger)
                last_poll = now

        except Exception:
            log.exception("Unexpected error in main loop (continuing)")

        time.sleep(1)

    log.info("=== Ripple Bridge Helper stopped ===")
    mt5.shutdown()


if __name__ == "__main__":
    main()
