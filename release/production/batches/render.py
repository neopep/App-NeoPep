#!/usr/bin/env python3
"""Render a transaction for the isolated rehearsal database. Never connects to a service."""
import argparse
import hashlib
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MANIFEST = json.loads((HERE / "manifest.json").read_text())
TARGET = "neopep_release_rehearsal"


def quote(value):
    return "'" + value.replace("'", "''") + "'"


def checks(plan):
    statements = [
        f"if current_database() <> {quote(TARGET)} then raise exception 'Banco fora do ensaio'; end if;",
        "if to_regprocedure('auth.uid()') is null or to_regprocedure('public.neo_admin_access()') is null "
        "then raise exception 'Dependência de Auth ou administração ausente'; end if;",
        "if pg_get_function_result(to_regprocedure('auth.uid()')) <> 'uuid' or "
        "pg_get_function_result(to_regprocedure('public.neo_admin_access()')) <> 'boolean' "
        "then raise exception 'Contrato de Auth ou administração divergente'; end if;",
        "if not has_function_privilege('authenticated','public.neo_admin_access()','EXECUTE') "
        "then raise exception 'Administração indisponível para sessão autenticada'; end if;",
        "if not exists (select 1 from pg_constraint where conrelid=to_regclass('auth.users') "
        "and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (id)') "
        "then raise exception 'Chave primária de Auth divergente'; end if;",
    ]
    for entry in plan["columns"]:
        column, expected = entry.split(":")
        schema, table, name = column.split(".")
        types = [expected, "text"] if column == "auth.users.email" else [expected]
        statements.append(
            "if not exists (select 1 from pg_attribute a "
            f"where a.attrelid=to_regclass({quote(schema + '.' + table)}) and a.attname={quote(name)} "
            "and a.attnum>0 and not a.attisdropped "
            f"and format_type(a.atttypid,null) in ({','.join(map(quote, types))})) "
            f"then raise exception {quote('Coluna incompatível: ' + column)}; end if;"
        )
    for table in plan["tables"]:
        statements.append(f"if to_regclass({quote(table)}) is not null then raise exception {quote('Objeto existente: ' + table)}; end if;")
    for routine in plan["routines"]:
        statements.append(f"if to_regprocedure({quote(routine)}) is not null then raise exception {quote('Rotina existente: ' + routine)}; end if;")
    return statements


def render(lot, *, rollback=False):
    plan = MANIFEST[lot]
    sources = []
    for migration in plan["files"]:
        raw = (ROOT / "supabase" / "migrations" / migration["name"]).read_bytes()
        if hashlib.sha256(raw).hexdigest() != migration["sha256"]:
            raise ValueError(f"Checksum alterado: {migration['name']}")
        wrapper = re.fullmatch(r"\s*begin;\s*(.*?)\s*commit;\s*", raw.decode(), re.S | re.I)
        if not wrapper:
            raise ValueError(f"Transação de origem inesperada: {migration['name']}")
        sources.append(wrapper[1])
    post = []
    for table in plan["tables"]:
        post.append(
            f"if not (select relrowsecurity from pg_class where oid={quote(table)}::regclass) "
            f"or has_table_privilege('anon',{quote(table)},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') "
            f"or has_table_privilege('authenticated',{quote(table)},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') "
            f"then raise exception {quote('RLS/ACL incompatível: ' + table)}; end if;"
        )
    for routine in plan["routines"]:
        post.append(
            f"if has_function_privilege('anon',{quote(routine)},'EXECUTE') "
            f"or not has_function_privilege('authenticated',{quote(routine)},'EXECUTE') "
            f"then raise exception {quote('ACL incompatível: ' + routine)}; end if;"
        )
    return "\n".join([
        f"-- Lote {lot}; destino permitido: {TARGET}.",
        "begin;", "set local lock_timeout='3s';", "set local statement_timeout='45s';",
        "set local search_path=pg_catalog;",
        "do $$ begin", *checks(plan), "end $$;",
        *sources, "do $$ begin", *post, "end $$;",
        "rollback;" if rollback else "commit;", "",
    ])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lote", choices=MANIFEST)
    parser.add_argument("--rollback", action="store_true", help="Ensaiar o lote e descartar as alterações")
    args = parser.parse_args()
    print(render(args.lote, rollback=args.rollback), end="")


if __name__ == "__main__":
    main()
