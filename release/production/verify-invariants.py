#!/usr/bin/env python3
"""Compare approved release snapshots, preserving every installed object by default."""
import argparse
from pathlib import Path
from runpy import run_path

read_catalog = run_path(str(Path(__file__).with_name("compare-catalog.py")))["read_catalog"]

FINANCE_ROUTINE = "public.neo_shop_v36(p_action text, p_payload jsonb)"
PRIVATE_BUCKETS = {"neo-campaign-images", "neo-connect-releases"}
ADDITIVE_KINDS = {"relation", "column", "routine", "constraint", "index", "trigger", "policy", "bucket"}


def check(before, after, allow_finance_change=False):
    problems = []
    job = ("cron", "neo-push-dispatch")
    scheduled = before.get(job)
    if not scheduled or not scheduled.get("active") or scheduled.get("schedule") != "* * * * *":
        problems.append("O inventário inicial não confirma neo-push-dispatch ativo a cada minuto.")

    for key in sorted(before.keys() | after.keys()):
        kind, name = key
        old, new = before.get(key), after.get(key)
        if old is None:
            if kind == "bucket":
                if name not in PRIVATE_BUCKETS or new.get("public") is not False:
                    problems.append(f"Bucket inesperado ou público: {name}.")
            elif kind not in ADDITIVE_KINDS:
                problems.append(f"Novo objeto não autorizado: {kind}/{name}.")
            continue

        if new is None:
            problems.append(f"Objeto instalado removido: {kind}/{name}.")
            continue
        if old == new:
            continue

        # Exceção controlada: somente o CORPO da rotina financeira pode mudar
        # após autorização explícita do lote 07. ACL, owner e demais atributos
        # permanecem protegidos mesmo com a flag habilitada.
        if kind == "routine" and name == FINANCE_ROUTINE and allow_finance_change:
            changed = {field for field in old.keys() | new.keys() if old.get(field) != new.get(field)}
            if changed == {"body_hash"}:
                continue
        problems.append(f"Objeto instalado alterado: {kind}/{name}.")

    return problems


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("antes", type=Path)
    p.add_argument("depois", type=Path)
    p.add_argument(
        "--allow-finance-routine-change", action="store_true",
        help="Somente após aprovação do lote 07: permitir alteração do body_hash da neo_shop_v36.",
    )
    args = p.parse_args()
    before, after = read_catalog(args.antes), read_catalog(args.depois)
    problems = check(before, after, args.allow_finance_routine_change)
    if problems:
        p.exit(1, "\n".join(problems) + "\n")
    print("Objetos instalados, ACL, RLS, cron, Auth e Storage preservados; deltas aditivos verificados.")


if __name__ == "__main__":
    main()
