"""Build the versioned archive and optional local marketplace directory."""
import argparse
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

here = Path(__file__).resolve().parent
root = here.parents[1]
plugin = here / "plugin"
parser = argparse.ArgumentParser()
parser.add_argument("output", nargs="?", type=Path)
parser.add_argument("--environment", choices=("test", "production"), default="test")
parser.add_argument("--marketplace-tree", action="store_true")
args = parser.parse_args()
manifest = json.loads((plugin / "plugin.json").read_text(encoding="utf-8"))
config = json.loads((plugin / "mcp.json").read_text(encoding="utf-8"))
if args.environment == "test":
    manifest["name"] += "-teste"
    manifest["extensions"]["com.openai"]["interface"]["displayName"] += " Teste"
else:
    config["mcpServers"]["neopep"]["url"] = "https://connect.neopep.com.br/mcp"

def json_bytes(data):
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

files = {
    "plugin.json": json_bytes(manifest),
    "mcp.json": json_bytes(config),
    "README.md": (plugin / "README.md").read_bytes(),
    "skills/neopep-campanhas/SKILL.md": (plugin / "skills/neopep-campanhas/SKILL.md").read_bytes(),
    "assets/logo.png": (root / "dist/assets/logo-neopep.png").read_bytes(),
    "assets/icon.png": (root / "dist/assets/icon-192.png").read_bytes(),
}
output = args.output or Path(f"{manifest['name']}-{manifest['version']}.zip")
with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
    for name, content in sorted(files.items()):
        entry = ZipInfo(name, (2026, 11, 26, 0, 0, 0))
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, content, compress_type=ZIP_DEFLATED)
if args.marketplace_tree:
    tree = here / "generated" / args.environment
    for name, content in sorted(files.items()):
        path = tree / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
print(output)
