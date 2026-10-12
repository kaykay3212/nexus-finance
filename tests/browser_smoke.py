"""Real Chromium smoke test using a local fake API, temporary profile and no financial data.

Usage: python tests/browser_smoke.py --browser /path/to/chrome
The chart CDN is excluded: this verifies the existing chart-unavailable fallback.
"""
import argparse
import html
import json
import re
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", required=True)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--screenshot")
    args = parser.parse_args()
    state = {"transactions": [], "goals": [], "authenticated": False}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def send(self, payload, mime="application/json", status=200):
            data = json.dumps(payload).encode() if mime == "application/json" else payload
            self.send_response(status)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
            if self.path == "/api/auth/logout":
                state["authenticated"] = False
                return self.send({"ok": True})
            if self.path == "/api/auth/login":
                state["authenticated"] = True
                return self.send({"ok": True})
            if not state["authenticated"]:
                return self.send({"error": "unauthorized"}, status=401)
            for route, key, singular in [("/api/transactions", "transactions", "transaction"), ("/api/goals", "goals", "goal")]:
                if self.path == route:
                    body["id"] = len(state[key]) + 1
                    state[key].append(body)
                    return self.send({singular: body})
            self.send({"error": "not_found"}, status=404)

        def do_GET(self):
            route = urlparse(self.path).path
            if route == "/api/version":
                return self.send({"version": "smoke"})
            if route == "/api/auth/me":
                return self.send({"user": {"id": 1, "email": "test@example.com"}})
            if route in ("/api/transactions", "/api/goals"):
                key = route.split("/")[-1]
                return self.send({key: state[key]})
            if route == "/":
                page = (ROOT / "index.html").read_text(encoding="utf-8")
                page = re.sub(r'<script[^>]+https://cdn[^>]+></script>', '', page)
                page = page.replace('<script defer src="site-structure.js', '<script defer src="tests/browser-smoke.js"></script>\n<script defer src="site-structure.js')
                return self.send(page.encode(), "text/html; charset=utf-8")
            candidate = (ROOT / route.lstrip("/")).resolve()
            allowed = {"app.js", "site-structure.js", "dashboard-charts.js", "finance-analytics.js", "styles.css", "manifest.json", "offline.html", "tests/browser-smoke.js"}
            if candidate.is_relative_to(ROOT) and (route.lstrip("/") in allowed or route.startswith("/icons/")) and candidate.is_file():
                mime = {".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json"}.get(candidate.suffix, "text/html")
                # JSON files are returned as bytes, not serialized again.
                return self.send(candidate.read_bytes(), mime + "; charset=utf-8" if mime != "image/png" else mime)
            self.send({"error": "not_found"}, status=404)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with tempfile.TemporaryDirectory(prefix="nexus-browser-", ignore_cleanup_errors=True) as profile:
            command = [
                args.browser, "--headless", "--disable-gpu", "--no-first-run", "--disable-extensions",
                "--disable-background-networking", "--no-default-browser-check", "--log-level=3",
                "--user-data-dir=" + profile, "--dump-dom", "--virtual-time-budget=15000",
                f"--window-size={args.width},900", "--force-device-scale-factor=1",
                f"http://127.0.0.1:{server.server_port}/",
            ]
            if args.screenshot:
                command.insert(-1, "--screenshot=" + str(Path(args.screenshot).resolve()))
            completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=50)
            match = re.search(r'<pre id="smoke-result">(.*?)</pre>', completed.stdout, re.S)
            if not match or not match.group(1).strip():
                raise SystemExit("Browser did not finish smoke checks: " + completed.stderr[-1200:])
            result = json.loads(html.unescape(match.group(1)))
            print(json.dumps(result, ensure_ascii=True, indent=2))
            if not result.get("ok"):
                raise SystemExit(1)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
