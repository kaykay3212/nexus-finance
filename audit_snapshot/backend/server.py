"""Small PostgreSQL-backed HTTP API for Nexus Finance."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import date
from decimal import Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import parse_qs, urlparse


TRANSACTION_DEFAULTS = {
    "type": "Saída",
    "description": "",
    "category": "Outros",
    "subcategory": "",
    "purpose": "Registrado pelo Nexus Finance",
    "classification": "Controlável",
    "amount": Decimal("0"),
    "status": "Realizado",
    "note": "",
    "mode": "Movimentação",
    "installments": 0,
    "currentInstallment": 0,
    "dueDay": 0,
    "recurrence": "Único",
    "priority": "",
    "paidAt": None,
}
TRANSACTION_FIELDS = tuple(TRANSACTION_DEFAULTS)
GOAL_FIELDS = ("name", "target", "current", "date")
MONTHS_PT = (
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
)
PASSWORD_ITERATIONS = 600_000
PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_LENGTH = 1024
SESSION_COOKIE = "nexus_session"
SESSION_TOKEN_BYTES = 32
AUTH_WINDOW_SECONDS = 15 * 60
AUTH_MAX_ATTEMPTS = 8
_AUTH_ATTEMPTS = defaultdict(deque)
_AUTH_LOCK = threading.Lock()
EMAIL_PATTERN = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,63}$")
PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATIC_ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/site-structure.js": ("site-structure.js", "text/javascript; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/manifest.json": ("manifest.json", "application/manifest+json; charset=utf-8"),
}
DUMMY_PASSWORD_HASH = (
    "pbkdf2_sha256$600000$Zml4ZWQtZHVtbXktc2FsdA==$"
    + base64.urlsafe_b64encode(
        hashlib.pbkdf2_hmac("sha256", b"dummy-password", b"fixed-dummy-salt", PASSWORD_ITERATIONS)
    ).decode("ascii")
)


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str | None = None):
        super().__init__(message or code)
        self.status = status
        self.code = code
        self.message = message or code


def database_url() -> str:
    value = os.environ.get("DATABASE_URL", "").strip()
    if not value:
        raise RuntimeError("DATABASE_URL must be configured")
    return value


def connect():
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as exc:
        raise RuntimeError("Install backend dependencies with: pip install -r backend/requirements.txt") from exc
    return psycopg.connect(database_url(), row_factory=dict_row)


def normalize_email(value) -> str:
    if not isinstance(value, str):
        raise ApiError(400, "invalid_email", "A valid email address is required")
    email = value.strip().lower()
    if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
        raise ApiError(400, "invalid_email", "A valid email address is required")
    try:
        if len(email.encode("utf-8")) > 254:
            raise ApiError(400, "invalid_email", "A valid email address is required")
    except UnicodeEncodeError as exc:
        raise ApiError(400, "invalid_email", "A valid email address is required") from exc
    return email


def hash_password(password: str, salt: bytes | None = None, iterations: int = PASSWORD_ITERATIONS) -> str:
    salt = salt or secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256${}${}${}".format(
        iterations,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(derived).decode("ascii"),
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = encoded.split("$", 3)
        iterations = int(iterations_text)
        if algorithm != "pbkdf2_sha256" or not 100_000 <= iterations <= 2_000_000:
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode("ascii"))
        expected = base64.urlsafe_b64decode(digest_text.encode("ascii"))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, UnicodeError):
        return False


def session_digest(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def validate_password(value) -> str:
    if not isinstance(value, str) or not PASSWORD_MIN_LENGTH <= len(value) <= PASSWORD_MAX_LENGTH:
        raise ApiError(
            400,
            "invalid_password",
            f"Password must contain {PASSWORD_MIN_LENGTH}-{PASSWORD_MAX_LENGTH} characters",
        )
    try:
        if len(value.encode("utf-8")) > PASSWORD_MAX_LENGTH:
            raise ApiError(400, "invalid_password", "Password is too long when encoded")
    except UnicodeEncodeError as exc:
        raise ApiError(400, "invalid_password", "Password contains invalid Unicode") from exc
    return value


def _iso_date(value, field: str, optional: bool = False):
    if value in (None, "") and optional:
        return None
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ApiError(400, "invalid_field", f"{field} must be an ISO date (YYYY-MM-DD)")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ApiError(400, "invalid_field", f"{field} must be an ISO date (YYYY-MM-DD)") from exc


def _number(value, field: str, *, integer: bool = False, minimum=0):
    if isinstance(value, bool):
        raise ApiError(400, "invalid_field", f"{field} must be a number")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ApiError(400, "invalid_field", f"{field} must be a number") from exc
    if not number.is_finite() or number < minimum:
        raise ApiError(400, "invalid_field", f"{field} must be at least {minimum}")
    if integer and number != number.to_integral_value():
        raise ApiError(400, "invalid_field", f"{field} must be an integer")
    if integer:
        if number > 2_147_483_647:
            raise ApiError(400, "invalid_field", f"{field} exceeds the supported integer range")
        return int(number)
    if number >= Decimal("1000000000000"):
        raise ApiError(400, "invalid_field", f"{field} exceeds the supported amount range")
    if number.as_tuple().exponent < -2:
        raise ApiError(400, "invalid_field", f"{field} supports at most two decimal places")
    return number


def validate_transaction(payload: dict, *, partial: bool = False) -> dict:
    if not isinstance(payload, dict):
        raise ApiError(400, "invalid_json", "JSON body must be an object")
    fields = TRANSACTION_FIELDS
    if not partial and not payload.get("date"):
        raise ApiError(400, "invalid_field", "date is required (YYYY-MM-DD)")
    values = {}
    if not partial:
        values.update(TRANSACTION_DEFAULTS)
        values["date"] = date.today()
    for field in fields:
        if field in payload:
            values[field] = payload[field]
        elif not partial:
            values[field] = TRANSACTION_DEFAULTS[field]
    if "date" in payload:
        values["date"] = _iso_date(payload["date"], "date")
    if "paidAt" in payload or not partial:
        values["paidAt"] = _iso_date(values.get("paidAt"), "paidAt", optional=True)
    if "amount" in values:
        values["amount"] = _number(values["amount"], "amount")
    for field in ("installments", "currentInstallment", "dueDay"):
        if field in values:
            values[field] = _number(values[field], field, integer=True)
    for field in ("type", "description", "category", "subcategory", "purpose",
                  "classification", "status", "note", "mode", "recurrence", "priority"):
        if field in values:
            if not isinstance(values[field], str):
                raise ApiError(400, "invalid_field", f"{field} must be a string")
            values[field] = values[field].strip()
            try:
                values[field].encode("utf-8")
            except UnicodeEncodeError as exc:
                raise ApiError(400, "invalid_field", f"{field} contains invalid Unicode") from exc
            max_length = 5000 if field in {"description", "note", "purpose"} else 200
            if len(values[field]) > max_length:
                raise ApiError(400, "invalid_field", f"{field} must be at most {max_length} characters")
    if ("description" in values and not values["description"].strip()) or (
        not partial and not values.get("description", "").strip()
    ):
        raise ApiError(400, "invalid_field", "description is required")
    if (not partial or "amount" in values) and values["amount"] <= 0:
        raise ApiError(400, "invalid_field", "amount must be greater than zero")
    if "dueDay" in values and values["dueDay"] > 31:
        raise ApiError(400, "invalid_field", "dueDay must be between 0 and 31")
    return values


def validate_goal(payload: dict, *, partial: bool = False) -> dict:
    if not isinstance(payload, dict):
        raise ApiError(400, "invalid_json", "JSON body must be an object")
    values = {}
    if not partial:
        values = {"name": "", "target": Decimal(0), "current": Decimal(0), "date": None}
    for field in GOAL_FIELDS:
        if field in payload:
            values[field] = payload[field]
    if not partial or "name" in values:
        if not isinstance(values.get("name"), str) or not values["name"].strip():
            raise ApiError(400, "invalid_field", "name is required")
        values["name"] = values["name"].strip()
        try:
            values["name"].encode("utf-8")
        except UnicodeEncodeError as exc:
            raise ApiError(400, "invalid_field", "name contains invalid Unicode") from exc
        if len(values["name"]) > 200:
            raise ApiError(400, "invalid_field", "name must be at most 200 characters")
    for field in ("target", "current"):
        if field in values:
            values[field] = _number(values[field], field)
    if not partial and values["target"] <= 0:
        raise ApiError(400, "invalid_field", "target must be greater than zero")
    if "date" in values:
        values["date"] = _iso_date(values["date"], "date", optional=True)
    return values


def transaction_json(row: dict) -> dict:
    transaction_date = row["date"]
    return {
        "id": row["id"],
        "date": transaction_date.isoformat(),
        "type": row["type"],
        "description": row["description"],
        "category": row["category"],
        "subcategory": row["subcategory"],
        "purpose": row["purpose"],
        "classification": row["classification"],
        "amount": float(row["amount"]),
        "month": MONTHS_PT[transaction_date.month - 1],
        "year": transaction_date.year,
        "status": row["status"],
        "note": row["note"],
        "mode": row["mode"],
        "installments": int(row["installments"]),
        "currentInstallment": int(row["current_installment"]),
        "dueDay": int(row["due_day"]),
        "recurrence": row["recurrence"],
        "priority": row["priority"],
        "paidAt": row["paid_at"].isoformat() if row.get("paid_at") else "",
    }


def goal_json(row: dict) -> dict:
    result = dict(row)
    result["target"] = float(result["target"])
    result["current"] = float(result["current"])
    result["date"] = result["date"].isoformat() if result.get("date") else ""
    return result


def _allowed_origins():
    configured = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    origins = {origin.strip() for origin in configured.split(",") if origin.strip()}
    render_origin = os.environ.get("RENDER_EXTERNAL_URL", "").strip()
    if render_origin:
        origins.add(render_origin)
    for origin in origins:
        parsed = urlparse(origin)
        if (parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path
                or parsed.params or parsed.query or parsed.fragment or origin.endswith("/")):
            raise RuntimeError("CORS_ALLOWED_ORIGINS must contain exact origins without paths")
    return origins


class NexusHandler(BaseHTTPRequestHandler):
    server_version = "NexusFinance/1.0"
    sys_version = ""

    def _security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")

    def _send(self, status: int, payload: dict | list, origin: str | None = None,
              set_cookie: str | None = None, clear_cookie: bool = False):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self._security_headers()
        if origin and self._origin_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")
        if set_cookie:
            self.send_header("Set-Cookie", set_cookie)
        if clear_cookie:
            self.send_header("Set-Cookie", self._cookie_header("", max_age=0))
        self.end_headers()
        self.wfile.write(encoded)

    def _serve_static(self, path: str, *, head_only: bool = False):
        asset = STATIC_ASSETS.get(path)
        if asset is None:
            return False
        filename, content_type = asset
        try:
            body = (PROJECT_ROOT / filename).read_bytes()
        except OSError:
            self.send_error(500, "Static asset is unavailable")
            return True
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self._security_headers()
        self.end_headers()
        if not head_only:
            self.wfile.write(body)
        return True

    @staticmethod
    def _origin_allowed(origin: str) -> bool:
        return origin in _allowed_origins()

    def _error(self, error: ApiError):
        self._send(error.status, {"error": error.code, "message": error.message}, self.headers.get("Origin"))

    @staticmethod
    def _cookie_header(value: str, max_age: int | None = None) -> str:
        secure = os.environ.get("SESSION_COOKIE_SECURE", "true").strip().lower() in {"1", "true", "yes"}
        fields = [f"{SESSION_COOKIE}={value}", "Path=/", "HttpOnly"]
        if secure:
            fields.append("Secure")
        fields.append("SameSite=Strict")
        if max_age is not None:
            fields.append(f"Max-Age={max_age}")
        return "; ".join(fields)

    def _session_cookie(self) -> str | None:
        jar = SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
            value = jar.get(SESSION_COOKIE)
            return value.value if value else None
        except Exception:
            return None

    def _authenticate(self) -> dict | None:
        token = self._session_cookie()
        if not token or not re.fullmatch(r"[A-Za-z0-9_-]{40,64}", token):
            return None
        digest = session_digest(token)
        with connect() as conn:
            return conn.execute(
                "SELECT users.id, users.email FROM sessions "
                "JOIN users ON users.id = sessions.user_id "
                "WHERE sessions.token_hash = %s AND sessions.expires_at > now()",
                (digest,),
            ).fetchone()

    def _create_session(self, user: dict) -> tuple[dict, str]:
        try:
            days = int(os.environ.get("SESSION_TTL_DAYS", "7"))
        except ValueError as exc:
            raise RuntimeError("SESSION_TTL_DAYS must be an integer") from exc
        if not 1 <= days <= 365:
            raise RuntimeError("SESSION_TTL_DAYS must be between 1 and 365")
        token = secrets.token_urlsafe(SESSION_TOKEN_BYTES)
        with connect() as conn:
            conn.execute("DELETE FROM sessions WHERE expires_at <= now()")
            conn.execute(
                "DELETE FROM sessions WHERE user_id = %s AND id NOT IN ("
                "SELECT id FROM sessions WHERE user_id = %s ORDER BY created_at DESC LIMIT 4"
                ")",
                (user["id"], user["id"]),
            )
            session = conn.execute(
                "INSERT INTO sessions (user_id, token_hash, expires_at) "
                "VALUES (%s, %s, now() + (%s * interval '1 day')) RETURNING expires_at",
                (user["id"], session_digest(token), days),
            ).fetchone()
        user_json = {"id": user["id"], "email": user["email"]}
        cookie = self._cookie_header(token, max_age=days * 86400)
        return {"ok": True, "user": user_json, "expiresAt": session["expires_at"].isoformat()}, cookie

    def _body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 1_000_000:
                raise ApiError(400, "invalid_json", "Request body must be between 1 byte and 1 MB")
            parsed = json.loads(self.rfile.read(length))
        except ApiError:
            raise
        except (ValueError, json.JSONDecodeError) as exc:
            raise ApiError(400, "invalid_json", "Request body must contain valid JSON") from exc
        if not isinstance(parsed, dict):
            raise ApiError(400, "invalid_json", "JSON body must be an object")
        return parsed

    def _client_key(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For", "")
        address = forwarded.split(",", 1)[0].strip() if forwarded else self.client_address[0]
        return address[:128]

    def _check_auth_rate_limit(self):
        key = self._client_key()
        now = time.monotonic()
        with _AUTH_LOCK:
            attempts = _AUTH_ATTEMPTS[key]
            while attempts and now - attempts[0] > AUTH_WINDOW_SECONDS:
                attempts.popleft()
            if len(attempts) >= AUTH_MAX_ATTEMPTS:
                raise ApiError(429, "too_many_attempts", "Too many authentication attempts. Try again later.")
            attempts.append(now)

    def _route(self):
        parsed = urlparse(self.path)
        return parsed.path.rstrip("/") or "/", parse_qs(parsed.query)

    def _run(self, method: str):
        try:
            path, query = self._route()
            if method in {"GET", "HEAD"} and self._serve_static(path, head_only=method == "HEAD"):
                return
            origin = self.headers.get("Origin")
            if origin and not self._origin_allowed(origin):
                raise ApiError(403, "origin_not_allowed")
            if method == "OPTIONS":
                self._preflight(origin)
                return
            if path == "/api/health" and method == "GET":
                self._send(200, {"ok": True}, origin)
                return
            payload = (
                self._body()
                if method in {"POST", "PUT", "PATCH"} and not (path == "/api/auth/logout" and method == "POST")
                else {}
            )
            if path == "/api/auth/register" and method == "POST":
                self._register(payload)
                return
            if path == "/api/auth/login" and method == "POST":
                self._login(payload)
                return
            user = self._authenticate()
            if path == "/api/auth/me" and method == "GET":
                if user is None:
                    raise ApiError(401, "unauthorized")
                self._send(200, {"ok": True, "user": user}, origin)
                return
            if path == "/api/auth/logout" and method == "POST":
                self._logout()
                return
            if user is None:
                raise ApiError(401, "unauthorized")
            self._dispatch(method, path, query, payload, user["id"])
        except ApiError as error:
            self._error(error)
        except RuntimeError:
            self.log_error("Server configuration error")
            self._send(500, {"error": "server_configuration_error", "message": "The server is temporarily unavailable"}, self.headers.get("Origin"))
        except Exception:
            self.log_error("Request failed")
            self._send(500, {"error": "internal_error", "message": "The request could not be completed"}, self.headers.get("Origin"))

    def _register(self, payload: dict):
        self._check_auth_rate_limit()
        email = normalize_email(payload.get("email"))
        password = validate_password(payload.get("password"))
        password_hash = hash_password(password)
        try:
            with connect() as conn:
                user = conn.execute(
                    "INSERT INTO users (email, password_hash) VALUES (%s, %s) "
                    "RETURNING id, email",
                    (email, password_hash),
                ).fetchone()
        except Exception as exc:
            if getattr(exc, "sqlstate", None) == "23505":
                raise ApiError(409, "account_exists", "An account with this email already exists") from exc
            raise
        response, cookie = self._create_session(user)
        self._send(201, response, self.headers.get("Origin"), set_cookie=cookie)

    def _login(self, payload: dict):
        self._check_auth_rate_limit()
        email = normalize_email(payload.get("email"))
        password = payload.get("password")
        if not isinstance(password, str) or len(password) > PASSWORD_MAX_LENGTH:
            raise ApiError(401, "invalid_credentials", "Email or password is incorrect")
        with connect() as conn:
            user = conn.execute(
                "SELECT id, email, password_hash FROM users WHERE email = %s", (email,)
            ).fetchone()
        password_hash = user["password_hash"] if user is not None else DUMMY_PASSWORD_HASH
        password_matches = verify_password(password, password_hash)
        if user is None or not password_matches:
            raise ApiError(401, "invalid_credentials", "Email or password is incorrect")
        response, cookie = self._create_session(user)
        self._send(200, response, self.headers.get("Origin"), set_cookie=cookie)

    def _logout(self):
        token = self._session_cookie()
        if token and re.fullmatch(r"[A-Za-z0-9_-]{40,64}", token):
            with connect() as conn:
                conn.execute("DELETE FROM sessions WHERE token_hash = %s", (session_digest(token),))
        self._send(200, {"ok": True}, self.headers.get("Origin"), clear_cookie=True)

    def _preflight(self, origin: str | None):
        if origin is None:
            self.send_response(204)
        else:
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _dispatch(self, method: str, path: str, query: dict, payload: dict, user_id: int):
        if method == "GET" and path == "/api/transactions":
            self._list_transactions(query, user_id)
            return
        if method == "GET" and path == "/api/goals":
            with connect() as conn:
                rows = conn.execute(
                    "SELECT id, name, target, current, date FROM goals WHERE user_id = %s ORDER BY id",
                    (user_id,),
                ).fetchall()
            self._send(200, {"ok": True, "goals": [goal_json(row) for row in rows]}, self.headers.get("Origin"))
            return

        parts = path.strip("/").split("/")
        if len(parts) == 2 and parts[0] == "api" and parts[1] == "transactions":
            if method == "POST":
                self._create_transaction(payload, user_id)
                return
            raise ApiError(405, "method_not_allowed")
        if len(parts) == 3 and parts[:2] == ["api", "transactions"]:
            identifier = self._parse_id(parts[2])
            if method == "GET":
                with connect() as conn:
                    row = conn.execute(
                        "SELECT * FROM transactions WHERE id = %s AND user_id = %s",
                        (identifier, user_id),
                    ).fetchone()
                if row is None:
                    raise ApiError(404, "not_found")
                self._send(200, {"ok": True, "transaction": transaction_json(row)}, self.headers.get("Origin"))
                return
            if method in ("PUT", "PATCH"):
                self._update_transaction(identifier, payload, user_id, partial=method == "PATCH")
                return
            if method == "DELETE":
                with connect() as conn:
                    row = conn.execute(
                        "DELETE FROM transactions WHERE id = %s AND user_id = %s RETURNING id",
                        (identifier, user_id),
                    ).fetchone()
                if row is None:
                    raise ApiError(404, "not_found")
                self._send(200, {"ok": True, "id": row["id"]}, self.headers.get("Origin"))
                return
            raise ApiError(405, "method_not_allowed")
        if len(parts) == 4 and parts[:2] == ["api", "transactions"] and parts[3] == "pay" and method == "PATCH":
            self._mark_paid(parts[2], user_id)
            return
        if len(parts) == 2 and parts[:1] == ["api"] and parts[1] == "goals":
            if method == "POST":
                self._create_goal(payload, user_id)
                return
            raise ApiError(405, "method_not_allowed")
        if len(parts) == 3 and parts[:2] == ["api", "goals"]:
            identifier = self._parse_id(parts[2])
            if method in ("PUT", "PATCH"):
                self._update_goal(identifier, payload, user_id, partial=method == "PATCH")
                return
            if method == "DELETE":
                with connect() as conn:
                    row = conn.execute(
                        "DELETE FROM goals WHERE id = %s AND user_id = %s RETURNING id",
                        (identifier, user_id),
                    ).fetchone()
                if row is None:
                    raise ApiError(404, "not_found")
                self._send(200, {"ok": True, "id": row["id"]}, self.headers.get("Origin"))
                return
            raise ApiError(405, "method_not_allowed")
        raise ApiError(404, "not_found")

    @staticmethod
    def _parse_id(value) -> int:
        try:
            identifier = int(value)
            if identifier < 1:
                raise ValueError()
            return identifier
        except (TypeError, ValueError) as exc:
            raise ApiError(400, "invalid_id") from exc

    def _list_transactions(self, query: dict, user_id: int):
        try:
            limit = int(query.get("limit", ["1000"])[0])
            offset = int(query.get("offset", ["0"])[0])
            if not 1 <= limit <= 5000 or offset < 0:
                raise ValueError()
        except ValueError as exc:
            raise ApiError(400, "invalid_pagination", "limit must be 1-5000 and offset must be non-negative") from exc
        with connect() as conn:
            rows = conn.execute(
                "SELECT * FROM transactions WHERE user_id = %s "
                "ORDER BY date DESC, id DESC LIMIT %s OFFSET %s",
                (user_id, limit, offset),
            ).fetchall()
        self._send(200, {"ok": True, "transactions": [transaction_json(row) for row in rows]}, self.headers.get("Origin"))

    def _create_transaction(self, payload: dict, user_id: int):
        values = validate_transaction(payload)
        columns = ("user_id", "date") + TRANSACTION_FIELDS
        placeholders = ", ".join(["%s"] * len(columns))
        query = f"INSERT INTO transactions ({', '.join('user_id' if f == 'user_id' else _db_field(f) for f in columns)}) VALUES ({placeholders}) RETURNING *"
        with connect() as conn:
            row = conn.execute(query, (user_id, *[values[field] for field in columns[1:]])).fetchone()
        self._send(201, {"ok": True, "transaction": transaction_json(row)}, self.headers.get("Origin"))

    def _update_transaction(self, identifier: int, payload: dict, user_id: int, partial: bool):
        values = validate_transaction(payload, partial=partial)
        if not values:
            raise ApiError(400, "empty_update")
        assignments = ", ".join(f"{_db_field(field)} = %s" for field in values)
        with connect() as conn:
            row = conn.execute(
                f"UPDATE transactions SET {assignments} WHERE id = %s AND user_id = %s RETURNING *",
                (*values.values(), identifier, user_id),
            ).fetchone()
        if row is None:
            raise ApiError(404, "not_found")
        self._send(200, {"ok": True, "transaction": transaction_json(row)}, self.headers.get("Origin"))

    def _mark_paid(self, identifier, user_id: int):
        transaction_id = self._parse_id(identifier)
        with connect() as conn:
            row = conn.execute(
                "UPDATE transactions SET status = %s, paid_at = CURRENT_DATE "
                "WHERE id = %s AND user_id = %s RETURNING id, status, paid_at",
                ("Pago", transaction_id, user_id),
            ).fetchone()
        if row is None:
            raise ApiError(404, "not_found")
        self._send(200, {"ok": True, "id": row["id"], "status": row["status"],
                         "paidAt": row["paid_at"].isoformat()}, self.headers.get("Origin"))

    def _create_goal(self, payload: dict, user_id: int):
        values = validate_goal(payload)
        with connect() as conn:
            row = conn.execute(
                "INSERT INTO goals (user_id, name, target, current, date) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id, name, target, current, date",
                (user_id, *[values[field] for field in GOAL_FIELDS]),
            ).fetchone()
        self._send(201, {"ok": True, "goal": goal_json(row)}, self.headers.get("Origin"))

    def _update_goal(self, identifier: int, payload: dict, user_id: int, partial: bool):
        values = validate_goal(payload, partial=partial)
        if not values:
            raise ApiError(400, "empty_update")
        with connect() as conn:
            row = conn.execute(
                "UPDATE goals SET " + ", ".join(f"{field} = %s" for field in values)
                + " WHERE id = %s AND user_id = %s RETURNING id, name, target, current, date",
                (*values.values(), identifier, user_id),
            ).fetchone()
        if row is None:
            raise ApiError(404, "not_found")
        self._send(200, {"ok": True, "goal": goal_json(row)}, self.headers.get("Origin"))

    def do_OPTIONS(self):
        origin = self.headers.get("Origin")
        if origin and not self._origin_allowed(origin):
            self._send(403, {"error": "origin_not_allowed", "message": "Origin is not allowed"})
            return
        self._preflight(origin)

    def do_GET(self):
        self._run("GET")

    def do_HEAD(self):
        self._run("HEAD")

    def do_POST(self):
        self._run("POST")

    def do_PUT(self):
        self._run("PUT")

    def do_PATCH(self):
        self._run("PATCH")

    def do_DELETE(self):
        self._run("DELETE")

    def log_message(self, format, *args):
        # Avoid logging request targets, which can contain session or other secrets.
        super().log_message("%s", self.command)


def _db_field(field: str) -> str:
    return {"currentInstallment": "current_installment", "dueDay": "due_day",
            "paidAt": "paid_at"}.get(field, _snake_case(field))


def _snake_case(field: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", field).lower()


def main():
    missing = [name for name in ("DATABASE_URL",) if not os.environ.get(name)]
    if missing:
        raise SystemExit("Required environment variables are missing: " + ", ".join(missing))
    try:
        if not _allowed_origins():
            raise SystemExit("Configure CORS_ALLOWED_ORIGINS or deploy with RENDER_EXTERNAL_URL")
    except RuntimeError as exc:
        raise SystemExit(str(exc)) from exc
    host = os.environ.get("HOST", "0.0.0.0")
    try:
        port = int(os.environ.get("PORT", "8000"))
    except ValueError as exc:
        raise SystemExit("PORT must be an integer") from exc
    server = ThreadingHTTPServer((host, port), NexusHandler)
    print(f"Nexus Finance API listening on {host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
