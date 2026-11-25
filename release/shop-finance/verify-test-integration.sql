-- Run only on an authenticated connection confirmed as qnuluspqfazdppciermw.
begin read only;

do $$
declare
  required record;
  rpc regprocedure;
  role_name text;
begin
  for required in select * from (values
    ('20261124164148','shop_cost_foundation'),
    ('20261124170927','shop_cost_editor'),
    ('20261124172822','shop_financial_dashboard')
  ) as installed(version,name) loop
    if not exists (
      select 1 from supabase_migrations.schema_migrations m
      where m.version=required.version and m.name=required.name
    ) then
      raise exception 'Migration ledger mismatch: %', required.name;
    end if;
  end loop;

  foreach rpc in array array[
    to_regprocedure('public.neo_shop_costs_v1(text,jsonb)'),
    to_regprocedure('public.neo_shop_financial_dashboard_v1(jsonb)')
  ] loop
    if rpc is null or not exists (
      select 1 from pg_proc where oid=rpc and prosecdef
        and 'search_path=pg_catalog' = any(proconfig)
        and strpos(prosrc,'neo_private.admin_members') > 0
    ) or not has_function_privilege('authenticated', rpc, 'EXECUTE') then
      raise exception 'Financial RPC or administrative contract mismatch: %', rpc;
    end if;
    foreach role_name in array array['anon','service_role'] loop
      if has_function_privilege(role_name,rpc,'EXECUTE') then
        raise exception 'Unexpected EXECUTE access for % on %', role_name, rpc;
      end if;
    end loop;
  end loop;
end $$;

select oid::regprocedure as rpc, md5(pg_get_functiondef(oid)) as definition_fingerprint
from pg_proc where oid in (
  to_regprocedure('public.neo_shop_costs_v1(text,jsonb)'),
  to_regprocedure('public.neo_shop_financial_dashboard_v1(jsonb)')
) order by 1;

commit;
