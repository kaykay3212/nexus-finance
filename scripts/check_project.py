"""Fast structural validation for Nexus Finance."""
from pathlib import Path
import py_compile

ROOT = Path(__file__).resolve().parent.parent

required = [
    "frontend/index.html",
    "frontend/manifest.json",
    "frontend/css/styles.css",
    "frontend/js/app.js",
    "frontend/js/site-structure.js",
    "backend/server.py",
    "backend/migrate.py",
    "backend/requirements.txt",
    "backend/migrations/001_initial.sql",
    "backend/migrations/002_accounts_sessions_and_ownership.sql",
    "backend/migrations/003_security_constraints.sql",
    "render.yaml",
]
missing = [path for path in required if not (ROOT / path).is_file()]
if missing:
    raise SystemExit("Missing project files: " + ", ".join(missing))

for legacy in ("index.html", "app.js", "styles.css", "site-structure.js", "nexus-finance-deploy.zip"):
    if (ROOT / legacy).exists():
        raise SystemExit(f"Legacy root artifact should not exist: {legacy}")

py_compile.compile(str(ROOT / "backend/server.py"), doraise=True)
py_compile.compile(str(ROOT / "backend/migrate.py"), doraise=True)
print("Nexus project structure OK")
