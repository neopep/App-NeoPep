"""Create the portable candidate package without contacting external services."""
import json
from pathlib import Path
import sys
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

here = Path(__file__).resolve().parent
root = here.parents[1]
plugin = here / "plugin"
manifest = json.loads((plugin / "plugin.json").read_text(encoding="utf-8"))
output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(f"{manifest['name']}-{manifest['version']}.zip")
files = {
    name: plugin / name for name in (
        "plugin.json", "mcp.json", "README.md", "skills/neopep-campanhas/SKILL.md",
    )
}
files["assets/logo.png"] = root / "dist/assets/logo-neopep.png"
files["assets/icon.png"] = root / "dist/assets/icon-192.png"
with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
    for name, path in sorted(files.items()):
        entry = ZipInfo(name, (2026, 11, 26, 0, 0, 0))
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, path.read_bytes(), compress_type=ZIP_DEFLATED)
print(output)
