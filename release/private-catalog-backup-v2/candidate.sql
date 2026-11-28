-- Candidate only. Read-only private catalog archive, no restore and no checkout changes.
begin;
create or replace function neo_private.shop_catalog_backup_v2()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare snapshot jsonb;
begin
 if auth.uid() is null or public.neo_admin_access() is distinct from true then
  raise exception 'Autorização administrativa obrigatória.' using errcode='42501';
 end if;
 with products as (
  select id,name,description,category,price_cents,stock,active,photo_path,photo_paths,created_at,updated_at,featured,payment_name
  from neo_private.shop_products where deleted_at is null
 ), paths as (
  select distinct path from products p cross join lateral unnest(array_append(p.photo_paths,p.photo_path)) u(path)
  where path is not null and path<>''
 ), acquisitions as (
  select a.id,a.product_id,a.quantity,a.currency,a.unit_cost_minor,a.fx_rate_id,a.acquired_at,a.recorded_at,a.entry_kind
  from neo_private.shop_acquisitions a join products p on p.id=a.product_id
 ), costs as (
  select a.id,a.product_id,a.quantity,a.currency,a.unit_cost_minor,a.fx_rate_id,a.acquired_at,a.recorded_at,a.unit_cost_brl_cents
  from neo_private.shop_acquisition_costs a join products p on p.id=a.product_id
 )
 select jsonb_build_object(
  'records',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from products p),'[]'::jsonb),
  'visibility_rules',coalesce((select jsonb_agg(jsonb_build_object('product_id',p.id,'mode',coalesce(v.mode,'public')) order by p.id)
   from products p left join neo_private.shop_product_visibility v on v.product_id=p.id),'[]'::jsonb),
  'visibility_members',coalesce((select jsonb_agg(to_jsonb(m) order by m.product_id,m.list,m.user_id)
   from neo_private.shop_product_visibility_members m join products p on p.id=m.product_id),'[]'::jsonb),
  'promotions',coalesce((select jsonb_agg(to_jsonb(q) order by q.id) from
   (select id,name,code,active,kind,value,min_quantity,min_subtotal_cents,product_ids,payment_method,stackable,max_discount_cents,starts_at,ends_at,max_uses,per_user_limit,source,referrer_user_id,restricted_user_id,restricted_to_user,created_at,updated_at from neo_private.shop_promotions where deleted_at is null) q),'[]'::jsonb),
  'discount_mode',(select discount_mode from neo_private.shop_settings where singleton),
  'acquisitions',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from acquisitions a),'[]'::jsonb),
  'costs',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from costs a),'[]'::jsonb),
  'fx_rates',coalesce((select jsonb_agg(to_jsonb(f) order by f.id) from
   (select id,brl_per_usd,quoted_at,source,recorded_at from neo_private.shop_fx_rates where id in
    (select fx_rate_id from acquisitions union select fx_rate_id from costs)) f),'[]'::jsonb),
  'files',coalesce((select jsonb_agg(jsonb_build_object('path',p.path,'exists',o.id is not null,'version',o.version,'updated_at',o.updated_at,'size',o.metadata->>'size') order by p.path)
   from paths p left join storage.objects o on o.bucket_id='neo-shop-products' and o.name=p.path),'[]'::jsonb)
 ) into snapshot;
 return snapshot;
end $$;
revoke all on function neo_private.shop_catalog_backup_v2() from public,anon,authenticated,service_role;
grant execute on function neo_private.shop_catalog_backup_v2() to authenticated;
-- Parsed SQL body binds the private function at definition time; no schema-wide USAGE grant.
create or replace function public.neo_shop_catalog_backup_v2()
returns jsonb language sql stable security invoker set search_path=pg_catalog
begin atomic
 select neo_private.shop_catalog_backup_v2();
end;
revoke all on function public.neo_shop_catalog_backup_v2() from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_catalog_backup_v2() to authenticated;
commit;
