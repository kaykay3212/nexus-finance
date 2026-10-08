"""Build-time hardening for Nexus Finance backend.

This script patches the backend extracted from nexus-finance-deploy.zip.
It intentionally fails the build if the expected backend layout changes,
so security changes are never silently skipped.
"""
from pathlib import Path

path = Path("backend/server.py")
source = path.read_text(encoding="utf-8")

replacements = [
    (
        'import secrets\nfrom datetime import date',
        'import secrets\nimport threading\nimport time\nfrom collections import defaultdict, deque\nfrom datetime import date',
    ),
    (
        'SESSION_TOKEN_BYTES = 32\nEMAIL_PATTERN =',
        'SESSION_TOKEN_BYTES = 32\nAUTH_WINDOW_SECONDS = 15 * 60\nAUTH_MAX_ATTEMPTS = 8\n_AUTH_ATTEMPTS = defaultdict(deque)\n_AUTH_LOCK = threading.Lock()\nEMAIL_PATTERN =',
    ),
    (
        '    def _security_headers(self):\n'
        '        self.send_header("X-Content-Type-Options", "nosniff")\n'
        '        self.send_header("X-Frame-Options", "DENY")\n'
        '        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")',
        '    def _security_headers(self):\n'
        '        self.send_header("X-Content-Type-Options", "nosniff")\n'
        '        self.send_header("X-Frame-Options", "DENY")\n'
        '        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")\n'
        '        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")\n'
        '        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")\n'
        '        self.send_header("Cross-Origin-Opener-Policy", "same-origin")\n'
        '        self.send_header("Cross-Origin-Resource-Policy", "same-origin")',
    ),
    (
        '        fields.append("SameSite=Lax")',
        '        fields.append("SameSite=Strict")',
    ),
    (
        '            days = int(os.environ.get("SESSION_TTL_DAYS", "30"))',
        '            days = int(os.environ.get("SESSION_TTL_DAYS", "7"))',
    ),
    (
        '            conn.execute("DELETE FROM sessions WHERE expires_at <= now()")\n'
        '            session = conn.execute(',
        '            conn.execute("DELETE FROM sessions WHERE expires_at <= now()")\n'
        '            conn.execute(\n'
        '                "DELETE FROM sessions WHERE user_id = %s AND id NOT IN ("\n'
        '                "SELECT id FROM sessions WHERE user_id = %s ORDER BY created_at DESC LIMIT 4"\n'
        '                ")",\n'
        '                (user["id"], user["id"]),\n'
        '            )\n'
        '            session = conn.execute(',
    ),
    (
        '    def _login(self, payload: dict):\n'
        '        email = normalize_email(payload.get("email"))',
        '    def _login(self, payload: dict):\n'
        '        self._check_auth_rate_limit()\n'
        '        email = normalize_email(payload.get("email"))',
    ),
    (
        '    def _register(self, payload: dict):\n'
        '        email = normalize_email(payload.get("email"))',
        '    def _register(self, payload: dict):\n'
        '        self._check_auth_rate_limit()\n'
        '        email = normalize_email(payload.get("email"))',
    ),
    (
        '    def _route(self):\n',
        '    def _client_key(self) -> str:\n'
        '        forwarded = self.headers.get("X-Forwarded-For", "")\n'
        '        address = forwarded.split(",", 1)[0].strip() if forwarded else self.client_address[0]\n'
        '        return address[:128]\n'
        '\n'
        '    def _check_auth_rate_limit(self):\n'
        '        key = self._client_key()\n'
        '        now = time.monotonic()\n'
        '        with _AUTH_LOCK:\n'
        '            attempts = _AUTH_ATTEMPTS[key]\n'
        '            while attempts and now - attempts[0] > AUTH_WINDOW_SECONDS:\n'
        '                attempts.popleft()\n'
        '            if len(attempts) >= AUTH_MAX_ATTEMPTS:\n'
        '                raise ApiError(429, "too_many_attempts", "Too many authentication attempts. Try again later.")\n'
        '            attempts.append(now)\n'
        '\n'
        '    def _route(self):\n',
    ),
    (
        '        except RuntimeError as error:\n'
        '            self._send(500, {"error": "server_configuration_error", "message": str(error)}, self.headers.get("Origin"))',
        '        except RuntimeError:\n'
        '            self.log_error("Server configuration error")\n'
        '            self._send(500, {"error": "server_configuration_error", "message": "The server is temporarily unavailable"}, self.headers.get("Origin"))',
    ),
]

for old, new in replacements:
    if old not in source:
        raise SystemExit(f"Security hardening aborted: expected snippet not found: {old[:80]!r}")
    source = source.replace(old, new, 1)

path.write_text(source, encoding="utf-8")
print("Applied Nexus Finance security hardening.")
