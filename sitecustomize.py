"""Runtime security hardening for Nexus Finance.

Loaded automatically by Python before backend modules. Kept outside the deploy ZIP
so protections remain active even while the current Render service still extracts
nexus-finance-deploy.zip during builds.
"""
from __future__ import annotations

import json
import os
import threading
import time
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler

_ALLOWED_ORIGIN = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "https://nexus-finance-zgk5.onrender.com",
).rstrip("/")

_AUTH_PATH_SUFFIXES = ("/login", "/register")
_AUTH_WINDOW_SECONDS = 15 * 60
_AUTH_MAX_ATTEMPTS = 8
_MAX_BODY_BYTES = 512 * 1024

_attempts: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()

_original_parse_request = BaseHTTPRequestHandler.parse_request
_original_end_headers = BaseHTTPRequestHandler.end_headers
_original_send_header = BaseHTTPRequestHandler.send_header


def _client_ip(handler: BaseHTTPRequestHandler) -> str:
    # Render supplies X-Forwarded-For. Only the first hop is the original client.
    forwarded = handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:128]
    try:
        return str(handler.client_address[0])[:128]
    except Exception:
        return "unknown"


def _reject(handler: BaseHTTPRequestHandler, status: int, code: str, message: str) -> bool:
    body = json.dumps({"error": code, "message": message}).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    if handler.command != "HEAD":
        try:
            handler.wfile.write(body)
        except Exception:
            pass
    return False


def _parse_request(self: BaseHTTPRequestHandler) -> bool:
    if not _original_parse_request(self):
        return False

    path = self.path.split("?", 1)[0]
    method = self.command.upper()

    # Reject oversized API write bodies before application code reads them.
    if method in {"POST", "PUT", "PATCH"} and path.startswith("/api/"):
        try:
            content_length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            return _reject(self, 400, "invalid_content_length", "Invalid request")
        if content_length > _MAX_BODY_BYTES:
            return _reject(self, 413, "payload_too_large", "Request body is too large")

    # Same-origin enforcement for state-changing API calls.
    if method in {"POST", "PUT", "PATCH", "DELETE"} and path.startswith("/api/"):
        origin = (self.headers.get("Origin") or "").rstrip("/")
        fetch_site = (self.headers.get("Sec-Fetch-Site") or "").lower()
        if fetch_site == "cross-site":
            return _reject(self, 403, "cross_site_request_blocked", "Cross-site request blocked")
        if origin and origin != _ALLOWED_ORIGIN:
            return _reject(self, 403, "origin_not_allowed", "Origin not allowed")

    # Lightweight brute-force protection for auth endpoints.
    if method == "POST" and path.startswith("/api/") and path.endswith(_AUTH_PATH_SUFFIXES):
        key = _client_ip(self)
        now = time.monotonic()
        with _lock:
            bucket = _attempts[key]
            while bucket and now - bucket[0] > _AUTH_WINDOW_SECONDS:
                bucket.popleft()
            if len(bucket) >= _AUTH_MAX_ATTEMPTS:
                return _reject(
                    self,
                    429,
                    "too_many_attempts",
                    "Too many authentication attempts. Try again later.",
                )
            bucket.append(now)

    return True


def _send_header(self: BaseHTTPRequestHandler, keyword: str, value: str) -> None:
    # Strengthen all session cookies emitted by the backend.
    if keyword.lower() == "set-cookie":
        if "samesite=" in value.lower():
            parts = [
                "SameSite=Strict" if p.strip().lower().startswith("samesite=") else p
                for p in value.split(";")
            ]
            value = ";".join(parts)
        else:
            value += "; SameSite=Strict"
        if "httponly" not in value.lower():
            value += "; HttpOnly"
        if os.environ.get("SESSION_COOKIE_SECURE", "true").lower() == "true" and "secure" not in value.lower():
            value += "; Secure"
    return _original_send_header(self, keyword, value)


def _end_headers(self: BaseHTTPRequestHandler) -> None:
    # Defense-in-depth browser headers.
    _original_send_header(self, "X-Content-Type-Options", "nosniff")
    _original_send_header(self, "X-Frame-Options", "DENY")
    _original_send_header(self, "Referrer-Policy", "strict-origin-when-cross-origin")
    _original_send_header(self, "Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    _original_send_header(self, "Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
    _original_send_header(self, "Cross-Origin-Opener-Policy", "same-origin")
    _original_send_header(self, "Cross-Origin-Resource-Policy", "same-origin")
    _original_send_header(self, "X-Permitted-Cross-Domain-Policies", "none")
    _original_send_header(
        self,
        "Content-Security-Policy",
        "default-src 'self'; "
        "base-uri 'self'; "
        "object-src 'none'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://api.coingecko.com https://min-api.cryptocompare.com "
        "https://api.alternative.me https://cryptocurrency.cv "
        "https://script.google.com https://script.googleusercontent.com; "
        "manifest-src 'self'; worker-src 'self' blob:; upgrade-insecure-requests",
    )
    return _original_end_headers(self)


# 7 days is a safer default than the original 30-day session.
os.environ.setdefault("SESSION_TTL_DAYS", "7")
os.environ.setdefault("SESSION_COOKIE_SECURE", "true")

BaseHTTPRequestHandler.parse_request = _parse_request
BaseHTTPRequestHandler.send_header = _send_header
BaseHTTPRequestHandler.end_headers = _end_headers


import atexit as _nexus_atexit

def _nexus_apply_overlay_at_exit():
    from pathlib import Path as _NexusPath
    if _NexusPath('backend/server.py').exists() and _NexusPath('nexus-finance-deploy.zip').exists():
        from nexus2_build import apply as _nexus_apply_v2
        _nexus_apply_v2()

_nexus_atexit.register(_nexus_apply_overlay_at_exit)
