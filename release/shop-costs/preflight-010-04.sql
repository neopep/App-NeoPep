-- Run through a trusted, explicitly verified Teste connection with ON_ERROR_STOP.
begin read only;

do $$
declare
  relation_name text;
  role_name text;
  relation_id regclass;
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20261124164148' and name = 'shop_cost_foundation'
  ) then
    raise exception 'Fundação esperada ausente do ledger de Teste';
  end if;
  if exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20261124180000' or name = 'shop_cost_editor'
  ) or to_regprocedure('public.neo_shop_costs_v1(text,jsonb)') is not null
    or to_regclass('neo_private.shop_acquisitions_history') is not null
    or exists (select 1 from pg_attribute
      where attrelid = to_regclass('neo_private.shop_acquisitions') and attname = 'entry_kind' and not attisdropped)
  then
    raise exception 'Contrato 010.04 já instalado ou parcialmente presente';
  end if;

  foreach relation_name in array array[
    'shop_fx_rates','shop_acquisitions','shop_stock_movements','shop_sale_cost_snapshots','shop_acquisition_costs'
  ] loop
    relation_id := to_regclass('neo_private.' || relation_name);
    if relation_id is null then
      raise exception 'Dependência ausente: %', relation_name;
    end if;
    if not exists (
      select 1 from pg_class where oid = relation_id and
      case when relation_name = 'shop_acquisition_costs' then
        relkind = 'v' and 'security_invoker=true' = any(reloptions)
      else relkind = 'r' and relrowsecurity end
    ) then
      raise exception 'RLS ou invocador incompatível: %', relation_name;
    end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(role_name, relation_id,
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         or has_any_column_privilege(role_name, relation_id, 'SELECT,INSERT,UPDATE,REFERENCES') then
        raise exception 'Acesso direto inesperado: % em %', role_name, relation_name;
      end if;
    end loop;
  end loop;

  if to_regclass('neo_private.admin_members') is null
     or to_regclass('neo_private.shop_products') is null
     or to_regprocedure('auth.uid()') is null then
    raise exception 'Dependência de autorização ou produto ausente';
  end if;
end $$;

select '010.04 preflight OK' as result, current_database() as database, current_user as executor;
commit;
