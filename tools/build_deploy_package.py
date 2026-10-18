"""Build or verify the archive consumed by the existing Render service."""

from __future__ import annotations

import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "nexus-finance-deploy.zip"
SHELL_FILES = (
    "app.js",
    "dashboard-charts.js",
    "finance-analytics.js",
    "index.html",
    "manifest.json",
    "offline.html",
    "service-worker.js",
    "simulation.js",
    "site-structure.js",
    "styles.css",
)
TEXT_SUFFIXES = {".css", ".html", ".js", ".json", ".md", ".py", ".sql", ".txt"}


def source_files() -> dict[str, Path]:
    files = {name: ROOT / name for name in SHELL_FILES}
    for directory in ("backend", "icons"):
        for path in (ROOT / directory).rglob("*"):
            if path.is_file() and "__pycache__" not in path.parts and path.suffix not in (".pyc", ".pyo"):
                files[path.relative_to(ROOT).as_posix()] = path
    missing = [name for name, path in files.items() if not path.is_file()]
    if missing:
        raise SystemExit(f"Missing package sources: {missing}")
    return dict(sorted(files.items()))


def package_bytes(path: Path) -> bytes:
    content = path.read_bytes()
    if path.suffix in TEXT_SUFFIXES:
        return content.replace(b"\r\n", b"\n")
    return content


def verify(files: dict[str, Path]) -> None:
    with ZipFile(ARCHIVE) as archive:
        names = archive.namelist()
        if set(names) != set(files) or len(names) != len(files):
            missing = sorted(set(files) - set(names))
            extra = sorted(set(names) - set(files))
            raise SystemExit(f"Package entries differ: missing={missing}, extra={extra}")
        changed = [name for name, path in files.items() if archive.read(name) != package_bytes(path)]
        if changed:
            raise SystemExit(f"Package contents differ: {changed}")
    print(f"Verified {len(files)} deployment files in {ARCHIVE.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify archive matches the source tree")
    args = parser.parse_args()
    files = source_files()
    if not args.check:
        with ZipFile(ARCHIVE, "w", ZIP_DEFLATED, compresslevel=9) as archive:
            for name, path in files.items():
                archive.writestr(name, package_bytes(path))
    verify(files)


if __name__ == "__main__":
    main()
