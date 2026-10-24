"""Checks inexpensive frontend contracts before packaging Nexus Finance.

The checks are intentionally conservative: they catch broken IDs, bad module paths
and mismatched dashboard panels, but do not claim to test Safari rendering.
"""
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent

class Markup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.attrs = []
    def handle_starttag(self, tag, attrs):
        info = dict(attrs)
        if info.get("id"):
            self.ids.append(info["id"])
        self.attrs.append((tag, info))

html = (ROOT / "index.html").read_text(encoding="utf8")
parser = Markup()
parser.feed(html)
assert len(parser.ids) == len(set(parser.ids)), "Duplicate IDs in index.html"

required = {
    "home", "dashboardSummary", "dashboardCharts", "dashboardFollowup",
    "dashboardAssistant", "movements", "simulation", "simFlowChart",
    "simBalanceChart", "simMonths", "simInitial", "simUseActual",
    "advisorTitle", "advisorNext", "goals", "investments", "stats",
}
missing = required - set(parser.ids)
assert not missing, f"Missing component IDs: {sorted(missing)}"
assert "dashboardTabAssistant" not in parser.ids, "Assistant must live in Resumo"
for tag, info in parser.attrs:
    if tag == "script" and info.get("src"):
        asset = info["src"].split("?", 1)[0].lstrip("/")
        assert (ROOT / asset).is_file(), f"Missing script: {asset}"

app = (ROOT / "app.js").read_text(encoding="utf8")
simulation = (ROOT / "simulation.js").read_text(encoding="utf8")
assert 'function go(page)' in app, "Navigation contract missing"
assert 'window.NEXUS_SIMULATION' in simulation, "Simulation public API missing"
assert 'fetch(' not in simulation and 'apiRequest(' not in simulation, "Simulation must not call backend"
assert not re.search(r'addEventListener\s*\(\s*["\']touchmove["\'].*preventDefault', app), "Do not block mobile scroll"
print("Frontend structure contracts: OK")
