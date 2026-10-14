import hashlib
import json
import struct
import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

from backend.server import (
    ApiError,
    NexusHandler,
    STATIC_ASSETS,
    hash_password,
    normalize_email,
    PROJECT_ROOT,
    session_digest,
    transaction_json,
    validate_goal,
    validate_password,
    validate_transaction,
    verify_password,
)


class ValidationTests(unittest.TestCase):
    def test_transaction_uses_app_fields_and_defaults(self):
        values = validate_transaction({
            "date": "2026-10-07",
            "description": "Conta de luz",
            "amount": "128.90",
            "currentInstallment": 2,
            "paidAt": "",
        })
        self.assertEqual(values["date"], date(2026, 10, 7))
        self.assertEqual(values["amount"], Decimal("128.90"))
        self.assertEqual(values["type"], "Saída")
        self.assertEqual(values["currentInstallment"], 2)
        self.assertIsNone(values["paidAt"])

    def test_partial_update_allows_independent_fields(self):
        self.assertEqual(validate_transaction({"status": "Pago"}, partial=True), {"status": "Pago"})

    def test_rejects_invalid_amount_and_date(self):
        for body in (
            {"date": "2026-10-07", "description": "Conta", "amount": -2},
            {"date": "not-a-date", "description": "Conta", "amount": 10},
            {"date": "20261007", "description": "Conta", "amount": 10},
            {"date": "2026-10-07", "description": "Conta", "amount": 2.345},
        ):
            with self.subTest(body=body), self.assertRaises(ApiError):
                validate_transaction(body)

    def test_transaction_response_matches_apps_script_shape(self):
        data = {
            "id": 12, "date": date(2026, 10, 7), "type": "Saída", "description": "Conta",
            "category": "Casa", "subcategory": "", "purpose": "", "classification": "Controlável",
            "amount": Decimal("12.50"), "status": "Pago", "note": "", "mode": "Compromisso",
            "installments": 1, "current_installment": 1, "due_day": 7, "recurrence": "Mensal",
            "priority": "", "paid_at": date(2026, 10, 7),
        }
        result = transaction_json(data)
        self.assertEqual(result["month"], "Outubro")
        self.assertEqual(result["year"], 2026)
        self.assertEqual(result["currentInstallment"], 1)
        self.assertEqual(result["paidAt"], "2026-10-07")

    def test_goal_fields_match_existing_form(self):
        values = validate_goal({"name": "Reserva", "target": 1000, "current": "50", "date": ""})
        self.assertEqual(values["name"], "Reserva")
        self.assertEqual(values["target"], Decimal("1000"))
        self.assertIsNone(values["date"])
        with self.assertRaises(ApiError):
            validate_goal({"name": "Reserva", "target": 0})

    def test_passwords_are_salted_hashed_and_verifiable(self):
        first = hash_password("a-long-enough-passphrase", salt=b"0123456789abcdef", iterations=100_000)
        second = hash_password("a-long-enough-passphrase", salt=b"fedcba9876543210", iterations=100_000)
        self.assertNotEqual(first, second)
        self.assertTrue(verify_password("a-long-enough-passphrase", first))
        self.assertFalse(verify_password("wrong-password", first))
        self.assertNotIn("a-long-enough-passphrase", first)

    def test_account_input_normalization_and_bounds(self):
        self.assertEqual(normalize_email("  Example@Mail.com "), "example@mail.com")
        with self.assertRaises(ApiError):
            normalize_email("not-an-email")
        self.assertEqual(validate_password("123456"), "123456")
        for password in ("12345", "x" * 1025):
            with self.subTest(password_length=len(password)), self.assertRaises(ApiError):
                validate_password(password)

    def test_session_cookie_tokens_are_stored_as_digests(self):
        raw = "random-opaque-cookie-token"
        digest = session_digest(raw)
        self.assertNotEqual(raw, digest)
        self.assertEqual(len(digest), 64)

    def test_cors_requires_explicit_exact_origins(self):
        with patch.dict("os.environ", {"CORS_ALLOWED_ORIGINS": "https://finance.example"}):
            self.assertTrue(NexusHandler._origin_allowed("https://finance.example"))
            self.assertFalse(NexusHandler._origin_allowed("https://finance.example.attacker.test"))
            self.assertFalse(NexusHandler._origin_allowed("https://owner.github.io"))

    def test_cookie_is_http_only_secure_and_same_site_by_default(self):
        with patch.dict("os.environ", {"SESSION_COOKIE_SECURE": "true"}):
            cookie = NexusHandler._cookie_header("opaque-token", max_age=3600)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("SameSite=Strict", cookie)
        self.assertNotIn("SameSite=None", cookie)
        self.assertIn("Max-Age=3600", cookie)

    def test_legacy_import_inserts_records_and_reports_counts(self):
        handler = NexusHandler.__new__(NexusHandler)
        handler.headers = {}
        handler._send = MagicMock()
        conn = MagicMock()
        conn.__enter__.return_value = conn
        conn.execute.return_value.fetchone.return_value = {
            "payload_hash": "f" * 64,
            "transaction_count": 1,
            "goal_count": 1,
        }
        payload = {
            "importId": str(uuid4()),
            "transactions": [{"date": "2026-10-07", "description": "Conta", "amount": 12.5}],
            "goals": [{"name": "Reserva", "target": 500}],
        }
        with patch("backend.server.connect", return_value=conn):
            handler._import_local_data(payload, user_id=5)
        self.assertEqual(conn.execute.call_count, 3)
        response = handler._send.call_args.args[1]
        self.assertEqual(response["imported"], {"transactions": 1, "goals": 1})

    def test_legacy_import_rejects_reusing_import_id_with_changed_data(self):
        handler = NexusHandler.__new__(NexusHandler)
        handler.headers = {}
        handler._send = MagicMock()
        conn = MagicMock()
        conn.__enter__.return_value = conn
        conn.execute.side_effect = [
            MagicMock(fetchone=MagicMock(return_value=None)),
            MagicMock(fetchone=MagicMock(return_value={
                "payload_hash": "0" * 64,
                "transaction_count": 1,
                "goal_count": 0,
            })),
        ]
        payload = {
            "importId": str(uuid4()),
            "transactions": [{"date": "2026-10-07", "description": "Conta", "amount": 12.5}],
        }
        with patch("backend.server.connect", return_value=conn):
            with self.assertRaises(ApiError) as raised:
                handler._import_local_data(payload, user_id=5)
        self.assertEqual(raised.exception.status, 409)
        self.assertEqual(conn.execute.call_count, 2)

    def test_legacy_import_replay_is_idempotent(self):
        handler = NexusHandler.__new__(NexusHandler)
        handler.headers = {}
        handler._send = MagicMock()
        conn = MagicMock()
        conn.__enter__.return_value = conn
        payload = {
            "importId": str(uuid4()),
            "transactions": [{"date": "2026-10-07", "description": "Conta", "amount": 12.5}],
            "goals": [],
        }
        canonical = json.dumps(
            {"transactions": payload["transactions"], "goals": []},
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        saved = MagicMock(fetchone=MagicMock(return_value=None))
        existing = MagicMock(fetchone=MagicMock(return_value={
            "payload_hash": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
            "transaction_count": 1,
            "goal_count": 0,
        }))
        conn.execute.side_effect = [saved, existing]
        with patch("backend.server.connect", return_value=conn):
            handler._import_local_data(payload, user_id=5)
        self.assertEqual(conn.execute.call_count, 2)
        self.assertTrue(handler._send.call_args.args[1]["alreadyImported"])

    def test_render_external_url_is_a_single_exact_allowed_origin(self):
        with patch.dict("os.environ", {"RENDER_EXTERNAL_URL": "https://nexus-finance.onrender.com",
                                       "CORS_ALLOWED_ORIGINS": ""}):
            self.assertTrue(NexusHandler._origin_allowed("https://nexus-finance.onrender.com"))
            self.assertFalse(NexusHandler._origin_allowed("https://attacker.onrender.com"))

    def test_only_allowlisted_static_assets_are_exposed(self):
        self.assertIn("/", STATIC_ASSETS)
        self.assertNotIn("/backend/server.py", STATIC_ASSETS)
        self.assertIn("/service-worker.js", STATIC_ASSETS)
        self.assertIn("/offline.html", STATIC_ASSETS)
        self.assertIn("/manifest.json", STATIC_ASSETS)
        self.assertIn("/icons/apple-touch-icon.png", STATIC_ASSETS)
        self.assertIn("/icons/favicon-32.png", STATIC_ASSETS)
        self.assertNotIn("/api/transactions", STATIC_ASSETS)

    def test_pwa_manifest_icons_and_offline_fallback_are_complete(self):
        manifest = json.loads((PROJECT_ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["name"], "Nexus Finance")
        self.assertEqual(manifest["lang"], "pt-BR")
        self.assertEqual(manifest["display"], "standalone")
        self.assertEqual(manifest["scope"], "/")
        for icon in manifest["icons"]:
            path = PROJECT_ROOT / icon["src"].lstrip("/")
            content = path.read_bytes()
            self.assertEqual(content[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual(struct.unpack(">II", content[16:24]), tuple(map(int, icon["sizes"].split("x"))))
        self.assertTrue((PROJECT_ROOT / "offline.html").is_file())
        self.assertTrue((PROJECT_ROOT / "service-worker.js").is_file())

    def test_default_persistent_session_lasts_30_days(self):
        handler = NexusHandler.__new__(NexusHandler)
        conn = MagicMock()
        conn.__enter__.return_value = conn
        conn.execute.return_value.fetchone.return_value = {
            "expires_at": datetime.now(timezone.utc),
        }
        with patch.dict("os.environ", {}, clear=True), patch("backend.server.connect", return_value=conn):
            _, cookie = handler._create_session({"id": 9, "email": "owner@example.com"})
        self.assertEqual(conn.execute.call_args.args[1][2], 30)
        self.assertIn("Max-Age=2592000", cookie)

    def test_public_registration_is_disabled_by_default(self):
        handler = NexusHandler.__new__(NexusHandler)
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(ApiError) as raised:
                handler._register({})
        self.assertEqual(raised.exception.status, 403)
        self.assertEqual(raised.exception.code, "registration_disabled")

    def test_enabled_public_registration_accepts_any_valid_email(self):
        handler = NexusHandler.__new__(NexusHandler)
        handler.headers = {}
        handler._send = MagicMock()
        handler._create_session = MagicMock(return_value=({"ok": True, "user": {"id": 7, "email": "other@example.com"}}, "cookie"))
        conn = MagicMock()
        conn.__enter__.return_value = conn
        conn.execute.return_value.fetchone.return_value = {"id": 7, "email": "other@example.com"}
        env = {"ALLOW_PUBLIC_REGISTRATION": "true"}
        with patch.dict("os.environ", env, clear=True), patch.object(handler, "_check_auth_rate_limit"), patch("backend.server.connect", return_value=conn):
            handler._register({"email": "other@example.com", "password": "123456"})
        handler._send.assert_called_once()
        self.assertEqual(handler._send.call_args.args[0], 201)

    def test_transaction_pay_endpoint_uses_patch_route_and_account_scope(self):
        handler = NexusHandler.__new__(NexusHandler)
        with patch.object(handler, "_mark_paid") as mark_paid:
            handler._dispatch("PATCH", "/api/transactions/31/pay", {}, {"atomicPayment": True}, user_id=8)
        mark_paid.assert_called_once_with("31", 8)

    def test_previous_mark_paid_route_is_not_exposed(self):
        handler = NexusHandler.__new__(NexusHandler)
        with self.assertRaises(ApiError) as raised:
            handler._dispatch("POST", "/api/transactions/31/mark-paid", {}, {}, user_id=8)
        self.assertEqual(raised.exception.status, 404)


if __name__ == "__main__":
    unittest.main()
