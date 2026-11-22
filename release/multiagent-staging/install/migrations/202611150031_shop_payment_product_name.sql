-- Nome comercial separado do nome enviado ao provedor de pagamento.
begin;
alter table neo_private.shop_products add column if not exists payment_name text;
update neo_private.shop_products set payment_name=name where payment_name is null or btrim(payment_name)='';
alter table neo_private.shop_products alter column payment_name set not null;
alter table neo_private.shop_products alter column payment_name set default 'Produto';
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='neo_private.shop_products'::regclass and conname='neo_shop_payment_name_length') then
  alter table neo_private.shop_products add constraint neo_shop_payment_name_length check(length(btrim(payment_name)) between 2 and 120);
 end if;
end$$;

do $$begin
 if to_regprocedure('public.neo_shop_v31(text,jsonb)') is null then
  alter function public.neo_shop(text,jsonb) rename to neo_shop_v31;
 end if;
end$$;
revoke all on function public.neo_shop_v31(text,jsonb) from public,anon,authenticated;

create or replace function public.neo_shop(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;pid uuid;
begin
 if p_action='product' then
  if length(btrim(coalesce(p_payload->>'payment_name',''))) not between 2 and 120 then
   raise exception 'Informe o nome que sera exibido no pagamento.';
  end if;
  result:=public.neo_shop_v31(p_action,p_payload);
  pid:=(result->>'id')::uuid;
  update neo_private.shop_products set payment_name=btrim(p_payload->>'payment_name'),updated_at=now() where id=pid;
  return result;
 elsif p_action='order' then
  result:=public.neo_shop_v31(p_action,p_payload);
  update neo_private.shop_orders o
  set items=coalesce((
   select jsonb_agg(i.value||jsonb_build_object('payment_name',p.payment_name) order by i.ordinality)
   from jsonb_array_elements(o.items) with ordinality i
   join neo_private.shop_products p on p.id=(i.value->>'product_id')::uuid
  ),o.items)
  where o.id=(result->>'id')::uuid;
  return result;
 end if;
 return public.neo_shop_v31(p_action,p_payload);
end$$;

revoke all on function public.neo_shop(text,jsonb) from public,anon;
grant execute on function public.neo_shop(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
