"""Idempotent build-time hardening for Nexus Finance.

The Render service still extracts nexus-finance-deploy.zip. This script is run by
GitHub Actions while rebuilding that archive. Every patch is idempotent: already
hardened code is accepted, while unexpected backend drift fails the workflow.
"""
from pathlib import Path

path = Path("backend/server.py")
source = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global source
    if new in source:
        return
    if old not in source:
        raise SystemExit(f"Security hardening aborted ({label}): expected backend snippet not found")
    source = source.replace(old, new, 1)


replace_once(
    "AUTH_MAX_ATTEMPTS = 8",
    "AUTH_MAX_ATTEMPTS = 6",
    "auth attempt limit",
)

replace_once(
    'server_version = "NexusFinance/1.0"',
    'server_version = "Nexus"',
    "server banner",
)

replace_once(
    '        self.send_header("Cross-Origin-Resource-Policy", "same-origin")',
    '        self.send_header("Cross-Origin-Resource-Policy", "same-origin")\n'
    '        self.send_header("X-Permitted-Cross-Domain-Policies", "none")\n'
    '        self.send_header("Content-Security-Policy", "default-src \'self\'; base-uri \'self\'; object-src \'none\'; frame-ancestors \'none\'; form-action \'self\'; script-src \'self\' https://cdn.jsdelivr.net; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:; connect-src \'self\' https://api.coingecko.com https://min-api.cryptocompare.com https://api.alternative.me https://cryptocurrency.cv; manifest-src \'self\'; worker-src \'self\' blob:; upgrade-insecure-requests")',
    "browser security policy",
)

replace_once(
    "ORDER BY created_at DESC LIMIT 4",
    "ORDER BY created_at DESC LIMIT 3",
    "maximum active sessions",
)

replace_once(
    '            if origin and not self._origin_allowed(origin):\n'
    '                raise ApiError(403, "origin_not_allowed")\n'
    '            if method == "OPTIONS":',
    '            if origin and not self._origin_allowed(origin):\n'
    '                raise ApiError(403, "origin_not_allowed")\n'
    '            if method in {"POST", "PUT", "PATCH", "DELETE"} and path.startswith("/api/") and not origin:\n'
    '                raise ApiError(403, "origin_required", "A same-origin request is required")\n'
    '            if method == "OPTIONS":',
    "same-origin write enforcement",
)

replace_once(
    "length > 1_000_000",
    "length > 262_144",
    "request body limit",
)
replace_once(
    "between 1 byte and 1 MB",
    "between 1 byte and 256 KB",
    "request body message",
)

replace_once(
    'query.get("limit", ["1000"])[0]',
    'query.get("limit", ["250"])[0]',
    "pagination default",
)
replace_once(
    "1 <= limit <= 5000",
    "1 <= limit <= 500",
    "pagination ceiling",
)
replace_once(
    "limit must be 1-5000",
    "limit must be 1-500",
    "pagination message",
)

replace_once(
    '            max_length = 5000 if field in {"description", "note", "purpose"} else 200',
    '            max_length = {"description": 160, "note": 2000, "purpose": 300}.get(field, 120)',
    "text field limits",
)

enum_anchor = '    if ("description" in values and not values["description"].strip()) or ('
enum_block = '''    enums = {
        "type": {"Entrada", "Saída"},
        "status": {"Realizado", "Previsto", "Pendente", "Pago", "Atrasado"},
        "mode": {"Movimentação", "Compromisso", "Renda Fixa", "Assinatura"},
        "recurrence": {"Único", "Mensal", "Semanal", "Anual"},
        "priority": {"", "Baixa", "Média", "Alta"},
    }
    for field, allowed in enums.items():
        if field in values and values[field] not in allowed:
            raise ApiError(400, "invalid_field", f"{field} contains an unsupported value")
'''
if enum_block not in source:
    if enum_anchor not in source:
        raise SystemExit("Security hardening aborted (enum validation): anchor not found")
    source = source.replace(enum_anchor, enum_block + enum_anchor, 1)

# Strong ownership invariants: every mutable/read-by-ID financial query must
# remain scoped to the authenticated user.
required_ownership = [
    "SELECT * FROM transactions WHERE id = %s AND user_id = %s",
    "DELETE FROM transactions WHERE id = %s AND user_id = %s RETURNING id",
    "WHERE id = %s AND user_id = %s RETURNING *",
    "WHERE id = %s AND user_id = %s RETURNING id, status, paid_at",
    "SELECT id, name, target, current, date FROM goals WHERE user_id = %s",
    "DELETE FROM goals WHERE id = %s AND user_id = %s RETURNING id",
    "WHERE id = %s AND user_id = %s RETURNING id, name, target, current, date",
]
for invariant in required_ownership:
    if invariant not in source:
        raise SystemExit(f"Security hardening aborted: ownership invariant missing: {invariant}")

path.write_text(source, encoding="utf-8")
print("Applied Nexus Finance security hardening.")
