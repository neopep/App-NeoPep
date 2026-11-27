"""Check the local marketplace contract and archive reproducibility offline."""
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from zipfile import ZipFile

here = Path(__file__).resolve().parent
catalog = json.loads((here.parents[1] / ".agents/plugins/marketplace.json").read_text())
entries = {item["name"]: item for item in catalog["plugins"]}
with TemporaryDirectory() as directory:
    for env, name, endpoint in (
        ("test", "neopep-connect-ai-teste", "https://connect-teste.neopep.com.br/mcp"),
        ("production", "neopep-connect-ai", "https://connect.neopep.com.br/mcp"),
    ):
        artifacts = [Path(directory) / f"{env}-{index}.zip" for index in range(2)]
        for archive in artifacts:
            subprocess.run([sys.executable, str(here / "build-plugin.py"),
                            "--environment", env, str(archive)], check=True, capture_output=True)
        assert artifacts[0].read_bytes() == artifacts[1].read_bytes()
        with ZipFile(artifacts[0]) as package:
            assert package.testzip() is None
            manifest = json.loads(package.read("plugin.json"))
            server = json.loads(package.read("mcp.json"))["mcpServers"]["neopep"]
            assert manifest["$schema"] == "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
            assert manifest["name"] == name
            assert server["type"] == "streamable-http" and server["url"] == endpoint
            assert server["extensions"]["com.openai"]["auth"] == {"type": "oauth", "baseScopes": ["campaigns:read"]}
            assert entries[name]["source"] == {"source": "local", "path": f"./integrations/campaign-mcp/generated/{env}"}
            for field in ("logo", "composerIcon"):
                assert manifest["extensions"]["com.openai"]["interface"][field][2:] in package.namelist()
print("Catálogo, estrutura e reprodução dos dois pacotes aprovados.")
