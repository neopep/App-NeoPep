#!/usr/bin/env python3
"""Compare local JSONL manifests from catalog.sql without contacting either project."""
import argparse
from collections import Counter
import json
from pathlib import Path


def read_catalog(path):
    objects = {}
    for line in path.read_text().splitlines():
        row = json.loads(line)
        key = (row["kind"], row["id"])
        if key in objects:
            raise ValueError(f"Objeto repetido em {path.name}: {key}")
        objects[key] = row["definition"]
    if ("meta", "server") not in objects:
        raise ValueError(f"Inventário incompleto: {path.name}")
    return objects


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("producao", type=Path)
    parser.add_argument("teste", type=Path)
    args = parser.parse_args()
    production, staging = read_catalog(args.producao), read_catalog(args.teste)
    summary = Counter()
    changes = []
    for key in sorted(production.keys() | staging.keys()):
        if key not in production:
            status = "somente_teste"
        elif key not in staging:
            status = "somente_producao"
        elif production[key] != staging[key]:
            status = "diferente"
        else:
            continue
        kind, object_id = key
        summary[f"{kind}:{status}"] += 1
        changes.append({"tipo": kind, "objeto": object_id, "estado": status,
                        "producao": production.get(key), "teste": staging.get(key)})
    print(json.dumps({"resumo": dict(summary), "diferencas": changes}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
