"""Regression cases found during the October 2026 review; no live database required."""
import json
import unittest
from datetime import date
from unittest.mock import MagicMock, patch

from backend.server import ApiError, NexusHandler, next_payment, validate_goal, validate_transaction, _db_field
from backend.binance_client import account_balances


def payment_row(**overrides):
    values = validate_transaction({
        "date": "2026-01-31", "description": "Conta", "amount": "100.00",
        "mode": "Compromisso", "status": "Pendente", "recurrence": "Mensal",
        "installments": 1, "currentInstallment": 1, "dueDay": 31,
    })
    row = {_db_field(key): value for key, value in values.items()}
    row.update(id=31, user_id=8)
    row.update(overrides)
    return row


class RegressionTests(unittest.TestCase):
    def test_short_month_preserves_original_due_day(self):
        following = next_payment(payment_row())
        self.assertEqual(following["date"], date(2026, 2, 28))
        row = payment_row(date=following["date"])
        self.assertEqual(next_payment(row)["date"], date(2026, 3, 31))

    def test_subscription_generates_next_month(self):
        following = next_payment(payment_row(mode="Assinatura"))
        self.assertEqual(following["date"], date(2026, 2, 28))
        self.assertEqual(following["status"], "Pendente")
        self.assertIsNone(following["paidAt"])

    def test_last_installment_does_not_restart(self):
        self.assertIsNone(next_payment(payment_row(installments=3, current_installment=3)))
        self.assertEqual(next_payment(payment_row(installments=3, current_installment=2))["currentInstallment"], 3)

    def test_one_off_and_weekly_and_leap_year(self):
        self.assertIsNone(next_payment(payment_row(recurrence="Único")))
        self.assertEqual(next_payment(payment_row(recurrence="Semanal"))["date"], date(2026, 2, 7))
        self.assertEqual(next_payment(payment_row(date=date(2024, 2, 29), due_day=29, recurrence="Anual"))["date"], date(2025, 2, 28))

    def test_invalid_goal_patch_and_installment_are_rejected(self):
        with self.assertRaises(ApiError):
            validate_goal({"target": 0}, partial=True)
        with self.assertRaises(ApiError):
            validate_transaction({"installments": 2, "currentInstallment": 3}, partial=True)

    def test_oversized_identifier_is_rejected_before_database(self):
        with self.assertRaises(ApiError):
            NexusHandler._parse_id("9223372036854775808")

    def test_old_frontend_cannot_create_duplicate_recurrence(self):
        handler = NexusHandler.__new__(NexusHandler)
        with self.assertRaises(ApiError) as caught:
            handler._dispatch("PATCH", "/api/transactions/31/pay", {}, {}, 8)
        self.assertEqual(caught.exception.code, "update_required")

    def handler_and_connection(self):
        handler = NexusHandler.__new__(NexusHandler)
        handler.headers = {}
        handler._send = MagicMock()
        conn = MagicMock()
        conn.__enter__.return_value = conn
        return handler, conn

    def test_repeated_payment_does_not_write_or_change_paid_date(self):
        handler, conn = self.handler_and_connection()
        conn.execute.return_value.fetchone.return_value = payment_row(status="Pago", paid_at=date(2026, 1, 31))
        with patch("backend.server.connect", return_value=conn):
            handler._mark_paid("31", 8)
        self.assertEqual(conn.execute.call_count, 1)
        self.assertIn("FOR UPDATE", conn.execute.call_args.args[0])
        self.assertEqual(conn.execute.call_args.args[1], (31, 8))
        self.assertEqual(handler._send.call_args.args[1]["transaction"]["paidAt"], "2026-01-31")
        self.assertIsNone(handler._send.call_args.args[1]["nextTransaction"])

    def test_payment_and_following_installment_share_transaction(self):
        handler, conn = self.handler_and_connection()
        conn.execute.return_value.fetchone.side_effect = [
            payment_row(), payment_row(status="Pago", paid_at=date(2026, 1, 31)),
            payment_row(id=32, date=date(2026, 2, 28)),
        ]
        with patch("backend.server.connect", return_value=conn) as connect:
            handler._mark_paid("31", 8)
        self.assertEqual(connect.call_count, 1)
        self.assertEqual(conn.execute.call_count, 3)
        self.assertIn("America/Sao_Paulo", conn.execute.call_args_list[1].args[0])
        self.assertEqual(handler._send.call_args.args[1]["nextTransaction"]["id"], 32)

    def test_missing_payment_never_writes(self):
        handler, conn = self.handler_and_connection()
        conn.execute.return_value.fetchone.return_value = None
        with patch("backend.server.connect", return_value=conn), self.assertRaises(ApiError):
            handler._mark_paid("31", 8)
        self.assertEqual(conn.execute.call_count, 1)

    def test_next_installment_failure_exits_transaction_with_error(self):
        handler, conn = self.handler_and_connection()
        cursor = MagicMock()
        cursor.fetchone.side_effect = [payment_row(), payment_row(status="Pago", paid_at=date(2026, 1, 31))]
        conn.execute.side_effect = [cursor, cursor, RuntimeError("simulated insert failure")]
        with patch("backend.server.connect", return_value=conn), self.assertRaises(RuntimeError):
            handler._mark_paid("31", 8)
        self.assertIs(conn.__exit__.call_args.args[0], RuntimeError)
        handler._send.assert_not_called()

    def test_non_ascii_password_change(self):
        handler, conn = self.handler_and_connection()
        conn.execute.return_value.fetchone.return_value = {"id": 8, "email": "a@example.com", "password_hash": "mock"}
        handler._create_session = MagicMock(return_value=({"ok": True}, "cookie"))
        with patch("backend.server.connect", return_value=conn), patch("backend.server.verify_password", return_value=True), patch("backend.server.hash_password", return_value="hash"):
            handler._change_password(8, {"currentPassword": "senha-antiga-áé123", "newPassword": "senha-nova-áé1234"})
        self.assertEqual(handler._send.call_args.args[0], 200)

    def test_binance_skips_nonfinite_and_negative_balances(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = json.dumps({"balances": [
            {"asset": "BTC", "free": "0.00000001", "locked": "0"},
            {"asset": "BAD", "free": "Infinity", "locked": "0"},
            {"asset": "BAD", "free": "NaN", "locked": "0"},
            {"asset": "BAD", "free": "-1", "locked": "2"},
            None,
        ]}).encode()
        with patch.dict("os.environ", {"BINANCE_API_KEY": "test", "BINANCE_API_SECRET": "test"}), patch("backend.binance_client.urlopen", return_value=response):
            balances = account_balances()
        self.assertEqual(len(balances), 1)
        self.assertEqual(balances[0]["asset"], "BTC")


if __name__ == "__main__":
    unittest.main()
