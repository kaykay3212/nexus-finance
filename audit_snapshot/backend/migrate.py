"""Apply the checked-in PostgreSQL SQL migrations once."""

from pathlib import Path

from backend.server import connect


MIGRATIONS = Path(__file__).parent / "migrations"


def main():
    migration_files = sorted(MIGRATIONS.glob("[0-9][0-9][0-9]_*.sql"))
    with connect() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
        )
        for migration in migration_files:
            version = migration.name.split("_", 1)[0]
            already_applied = conn.execute(
                "SELECT 1 FROM schema_migrations WHERE version = %s", (version,)
            ).fetchone()
            if already_applied:
                print(f"Skipping migration {migration.name} (already applied)")
                continue
            conn.execute(migration.read_text(encoding="utf-8"), prepare=False)
            conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (version,))
            print(f"Applied migration {migration.name}")


if __name__ == "__main__":
    main()
