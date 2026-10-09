"""Read-only Binance Spot balances. Credentials must be Render environment variables.

No trading, withdrawals, browser-side credentials, or persistence.
Use a dedicated Binance API key with ONLY read permissions.
"""
import hashlib
import hmac
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class BinanceUnavailable(Exception):
    pass


def configured():
    return bool(os.getenv("BINANCE_API_KEY") and os.getenv("BINANCE_API_SECRET")
                and os.getenv("BINANCE_ALLOWED_USER_EMAIL"))


def account_balances():
    key = os.getenv("BINANCE_API_KEY", "")
    secret = os.getenv("BINANCE_API_SECRET", "")
    if not key or not secret:
        raise BinanceUnavailable("not_configured")

    # Fixed official hostname and path: never accept a user-provided URL.
    params = urlencode({"timestamp": int(time.time() * 1000), "recvWindow": 5000})
    signature = hmac.new(secret.encode("utf-8"), params.encode("utf-8"), hashlib.sha256).hexdigest()
    url = "https://api.binance.com/api/v3/account?" + params + "&signature=" + signature
    request = Request(url, headers={"X-MBX-APIKEY": key, "User-Agent": "NexusFinance/1.0"})
    try:
        with urlopen(request, timeout=8) as response:
            data = json.loads(response.read(131072))
    except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
        # Never propagate response bodies or headers; they can expose sensitive metadata.
        raise BinanceUnavailable("upstream_unavailable") from exc

    if not isinstance(data, dict) or not isinstance(data.get("balances"), list):
        raise BinanceUnavailable("unexpected_response")

    result = []
    for item in data["balances"]:
        try:
            free = float(item["free"])
            locked = float(item["locked"])
            asset = str(item["asset"])
        except (KeyError, ValueError, TypeError):
            continue
        if free + locked > 0 and 1 <= len(asset) <= 16:
            result.append({"asset": asset, "free": item["free"], "locked": item["locked"]})
    return result[:300]
