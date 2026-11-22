#!/usr/bin/env python3
"""Compare two production catalog snapshots after an approved incremental batch."""
import argparse
from pathlib import Path
from runpy import run_path

read_catalog = run_path(str(Path(__file__).with_name("compare-catalog.py")))["read_catalog"]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("antes", type=Path)
    p.add_argument("depois", type=Path)
    args = p.parse_args()
    before, after = read_catalog(args.antes), read_catalog(args.depois)
    problems = []
    job = ("cron", "neo-push-dispatch")
    expected_job = before.get(job)
    if not expected_job or not expected_job["active"] or expected_job["schedule"] != "* * * * *":
        problems.append("O inventário inicial não confirma neo-push-dispatch ativo a cada minuto.")
    for key in before.keys() | after.keys():
        kind, name = key
        old, new = before.get(key), after.get(key)
        if old == new:
            continue
        preserve = (
            kind == "cron"
            or kind == "extension"
            or kind == "bucket" and old is not None
            or name.startswith("auth.")
            or kind == "column" and name == "neo_private.community_preferences.push_enabled"
        )
        if preserve:
            problems.append(f"{kind}/{name} divergiu do inventário de produção.")
        elif kind == "bucket" and (name not in {"neo-campaign-images", "neo-connect-releases"} or new.get("public") is not False):
            problems.append(f"Bucket inesperado ou público: {name}.")
        elif old is not None and new is None and kind in {"relation", "column"}:
            problems.append(f"{kind}/{name} removido.")
    if problems:
        p.exit(1, "\n".join(sorted(problems)) + "\n")
    print("Invariantes de cron, Auth, extensões, Storage e preferência padrão preservadas.")


if __name__ == "__main__":
    main()
