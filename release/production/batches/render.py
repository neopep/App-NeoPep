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
    for column in plan.get("new_columns", {}):
        schema, table, name = column.split(".")
        statements.append(
            f"if exists(select 1 from pg_attribute where attrelid=to_regclass({quote(schema+'.'+table)}) "
            f"and attname={quote(name)} and not attisdropped) then raise exception {quote('Coluna existente: '+column)}; end if;"
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
        source = migration.get("path", "supabase/migrations/" + migration["name"])
        raw = (ROOT / source).read_bytes()
        if hashlib.sha256(raw).hexdigest() != migration["sha256"]:
            raise ValueError(f"Checksum alterado: {source}")
        sql = raw.decode()
        if "start" in migration:
            anchor = migration["start"]
            if sql.count(anchor) != 1:
                raise ValueError(f"Início ambíguo: {source}")
            sql = sql[sql.index(anchor):]
        if "stop" in migration:
            anchor = migration["stop"]
            if sql.count(anchor) != 1:
                raise ValueError(f"Fim ambíguo: {source}")
            sql = sql[:sql.index(anchor)]
        for original, replacement in migration.get("replace", []):
            if sql.count(original) != 1:
                raise ValueError(f"Substituição ambígua: {source}")
            sql = sql.replace(original, replacement)
        sql = re.sub(r"(?im)^begin;[ \t]*$","",sql,count=1)
        sql = re.sub(r"(?is)commit;\s*$","",sql)
        sources.append(sql.strip())
    post = []
    for table in plan["tables"]:
        post.append(
            f"if not (select relrowsecurity from pg_class where oid={quote(table)}::regclass) "
            f"or has_table_privilege('anon',{quote(table)},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') "
            f"or has_table_privilege('authenticated',{quote(table)},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') "
            f"then raise exception {quote('RLS/ACL incompatível: ' + table)}; end if;"
        )
    for column, expected in plan.get("new_columns", {}).items():
        schema, table, name = column.split(".")
        post.append(
            f"if not exists(select 1 from pg_attribute where attrelid={quote(schema+'.'+table)}::regclass "
            f"and attname={quote(name)} and not attisdropped and format_type(atttypid,null)={quote(expected)}) "
            f"then raise exception {quote('Coluna ausente ou inválida: '+column)}; end if;"
        )
    for routine in plan["routines"]:
        post.append(
            f"if has_function_privilege('anon',{quote(routine)},'EXECUTE') "
            f"or not has_function_privilege('authenticated',{quote(routine)},'EXECUTE') "
            f"then raise exception {quote('ACL incompatível: ' + routine)}; end if;"
        )
    allowed = plan.get("changed_routines", [])
    required_routines = [
        f"if to_regprocedure({quote(routine)}) is null then raise exception 'Rotina oficial ausente'; end if;"
        for routine in allowed
    ]
    exclusion = "" if not allowed else "and p.oid not in (" + ",".join(
        f"to_regprocedure({quote(routine)})" for routine in allowed
    ) + ")"
    snapshot = f"""
create temp table release_existing_routines on commit drop as
 select p.oid,md5(pg_get_functiondef(p.oid)) as hash,p.proowner,p.proacl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','neo_private','auth','storage') and p.prokind in ('f','p','w') {exclusion};
create temp table release_existing_acl on commit drop as
 select c.oid,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.relowner
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','neo_private','auth','storage') and c.relkind in ('r','p','v','m');
create temp table release_existing_policies on commit drop as
 select p.oid,md5(p::text) as hash from pg_policy p;
create temp table release_push_default on commit drop as
 select d.oid, pg_get_expr(d.adbin,d.adrelid) as expression
 from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
 where d.adrelid=to_regclass('neo_private.community_preferences') and a.attname='push_enabled';
"""
    post.extend([
        "if exists(select 1 from pg_temp.release_push_default b left join pg_attrdef d using(oid) "
        "where d.oid is null or b.expression is distinct from pg_get_expr(d.adbin,d.adrelid)) "
        "then raise exception 'Default oficial de push alterado';end if;",
        "if exists(select 1 from pg_temp.release_existing_routines b left join pg_proc p using(oid) "
        "where p.oid is null or b.hash is distinct from md5(pg_get_functiondef(p.oid)) "
        "or b.proowner is distinct from p.proowner or b.proacl is distinct from p.proacl) "
        "then raise exception 'Rotina instalada ou privilégio alterado';end if;",
        "if exists(select 1 from pg_temp.release_existing_acl b left join pg_class c using(oid) "
        "where c.oid is null or (b.relacl,b.relrowsecurity,b.relforcerowsecurity,b.relowner) "
        "is distinct from (c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.relowner)) "
        "then raise exception 'ACL, RLS ou proprietário instalado alterado';end if;",
        "if exists(select 1 from pg_temp.release_existing_policies b left join pg_policy p using(oid) "
        "where p.oid is null or b.hash is distinct from md5(p::text)) then raise exception 'Política existente alterada';end if;",
    ])
    return "\n".join([
        f"-- Lote {lot}; destino permitido: {TARGET}.",
        "begin;", "set local lock_timeout='3s';", "set local statement_timeout='45s';",
        "set local search_path=pg_catalog;",
        "do $$ begin", *checks(plan), *required_routines, "end $$;",
        snapshot,*sources, "do $$ begin", *post, "end $$;",
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
