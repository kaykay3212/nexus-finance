"""Nexus Finance 2.0 build overlay.

Runs immediately after the legacy deployment ZIP is extracted. The overlay is
idempotent and only applies backward-compatible changes for phases 0-4:
security foundation, modular finance helpers, finance-core semantics and
recurring commitment improvements.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent


def replace_all(path: Path, old: str, new: str) -> bool:
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    if old not in text:
        return False
    text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")
    return True


def replace_once(path: Path, old: str, new: str) -> bool:
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    if old not in text:
        return False
    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")
    return True


def write_modules() -> None:
    pkg = ROOT / "backend" / "nexus2"
    pkg.mkdir(parents=True, exist_ok=True)
    (pkg / "__init__.py").write_text(
        '"""Nexus Finance 2.0 domain helpers."""\n', encoding="utf-8"
    )
    (pkg / "finance.py").write_text(
        '''from __future__ import annotations\n\n'
        'REALIZED = {"realizado", "pago", "recebido", "concluído", "concluido"}\n'
        'COMMITMENT_MODES = {"Compromisso", "Assinatura"}\n\n'
        'def is_realized(status: str) -> bool:\n'
        '    return str(status or "").strip().lower() in REALIZED\n\n'
        'def calculate_balances(rows):\n'
        '    done = [r for r in rows if is_realized(r.get("status"))]\n'
        '    income = sum(float(r.get("amount") or 0) for r in done if r.get("type") == "Entrada")\n'
        '    expense = sum(float(r.get("amount") or 0) for r in done if r.get("type") == "Saída")\n'
        '    pending = sum(float(r.get("amount") or 0) for r in rows if r.get("mode") in COMMITMENT_MODES and r.get("status") != "Pago")\n'
        '    actual = income - expense\n'
        '    return {"income": income, "expense": expense, "actual": actual, "pending": pending, "projected": actual - pending}\n'
        ''',
        encoding="utf-8",
    )
    (pkg / "commitments.py").write_text(
        '''from __future__ import annotations\n'
        'from calendar import monthrange\n'
        'from datetime import date, timedelta\n\n'
        'def next_due(current: date, recurrence: str, due_day: int | None = None) -> date | None:\n'
        '    recurrence = str(recurrence or "Único")\n'
        '    if recurrence == "Único": return None\n'
        '    if recurrence == "Semanal": return current + timedelta(days=7)\n'
        '    if recurrence == "Anual":\n'
        '        try: return current.replace(year=current.year + 1)\n'
        '        except ValueError: return current.replace(year=current.year + 1, day=28)\n'
        '    if recurrence == "Mensal":\n'
        '        y, m = current.year, current.month + 1\n'
        '        if m == 13: y, m = y + 1, 1\n'
        '        day = due_day or current.day\n'
        '        return date(y, m, min(day, monthrange(y, m)[1]))\n'
        '    return None\n'
        ''',
        encoding="utf-8",
    )
    (pkg / "validation.py").write_text(
        '''from __future__ import annotations\n\n'
        'MAX_DESCRIPTION = 160\n'
        'MAX_NOTE = 2000\n'
        'MAX_AMOUNT = 1_000_000_000\n'
        'VALID_MODES = {"Movimentação", "Compromisso", "Renda Fixa", "Assinatura"}\n'
        'VALID_TYPES = {"Entrada", "Saída"}\n\n'
        'def clean_text(value, limit):\n'
        '    return str(value or "").strip()[:limit]\n\n'
        'def validate_amount(value):\n'
        '    amount = float(value)\n'
        '    if amount <= 0 or amount > MAX_AMOUNT:\n'
        '        raise ValueError("invalid amount")\n'
        '    return amount\n'
        ''',
        encoding="utf-8",
    )


def write_migration() -> None:
    migration = ROOT / "backend" / "migrations" / "003_nexus_v2_foundation.sql"
    migration.parent.mkdir(parents=True, exist_ok=True)
    migration.write_text(
        '''-- Nexus Finance 2.0 foundation: additive and backward-compatible.\n'
        'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS series_id UUID;\n'
        'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS parent_transaction_id BIGINT;\n'
        'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS next_due_date DATE;\n'
        'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;\n'
        'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;\n'
        'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;\n'
        'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent_hash TEXT;\n'
        'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_hash TEXT;\n'
        'CREATE TABLE IF NOT EXISTS security_events (\n'
        '  id BIGSERIAL PRIMARY KEY,\n'
        '  actor_user_id TEXT,\n'
        '  event_type TEXT NOT NULL,\n'
        '  metadata JSONB NOT NULL DEFAULT \'{}\'::jsonb,\n'
        '  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n'
        ');\n'
        'CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);\n'
        ''',
        encoding="utf-8",
    )


def patch_frontend() -> None:
    app = ROOT / "app.js"
    index = ROOT / "index.html"

    # Finance core: subscriptions are commitments too.
    replace_all(app, 'r.mode==="Compromisso"', '(r.mode==="Compromisso"||r.mode==="Assinatura")')
    replace_once(
        app,
        'if(item.mode!=="Compromisso")return;',
        'if(item.mode!=="Compromisso"&&item.mode!=="Assinatura")return;',
    )

    # Actual vs projected balance.
    replace_once(
        app,
        'return{m,done,income,expense,balance:income-expense,invest,pending,savings,unnecessary,essential,commitments,score};',
        'const balance=income-expense;const projected=balance-pending;return{m,done,income,expense,balance,projected,invest,pending,savings,unnecessary,essential,commitments,score};',
    )
    replace_once(
        app,
        '$(\"#kpiBalance\").textContent=brl(x.balance);',
        '$(\"#kpiBalance\").textContent=brl(x.balance);const projectedEl=$(\"#kpiProjected\");if(projectedEl)projectedEl.textContent=brl(x.projected);',
    )

    # Copy and labels.
    replace_all(index, 'Saldo do mês', 'Saldo atual')
    replace_all(index, 'entradas − saídas', 'somente valores realizados')
    replace_all(index, 'Entrada ou saída?', 'Tipo')
    replace_all(index, 'O que é?', 'Descrição')
    replace_all(index, 'Assinatura / conta', 'Conta recorrente / assinatura')

    balance_card = '<div class="card reveal"><span>Saldo atual</span><strong id="kpiBalance">R$ 0,00</strong><small id="kpiBalanceNote">somente valores realizados</small></div>'
    projected_card = balance_card + '\n    <div class="card reveal"><span>Saldo projetado</span><strong id="kpiProjected">R$ 0,00</strong><small>saldo atual − compromissos pendentes</small></div>'
    replace_once(index, balance_card, projected_card)


def apply() -> None:
    write_modules()
    write_migration()
    patch_frontend()

    # Apply the previously reviewed backend hardening after extraction.
    hardening = ROOT / "security_hardening.py"
    if hardening.exists():
        scope = {"__name__": "__main__", "__file__": str(hardening)}
        exec(compile(hardening.read_text(encoding="utf-8"), str(hardening), "exec"), scope)

    print("Nexus 2.0 phases 0-4 build overlay applied.")


if __name__ == "__main__":
    apply()
