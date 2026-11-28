begin;
create table neo_private.shop_seller_tariffs_v1(singleton boolean primary key default true check(singleton),rates jsonb not null,updated_at timestamptz not null default now(),source text not null);
insert into neo_private.shop_seller_tariffs_v1(rates,source) values('{"credit_buyer":498,"credit_single":498,"credit_seller_2_6":299,"credit_seller_7_18":309,"pix":99,"balance":499,"prepaid":499,"mercado_parcelado":499,"open_finance":0,"boleto_cents":349,"financing":[452,661,868,1065,1195,1313,1439,1562,1682,1801,1917,2051,2169,2268,2396,2505,2617]}'::jsonb,'Painel Mercado Pago, 28/11/2026 · referência manual; crédito comprador até 4,98%');
alter table neo_private.shop_seller_tariffs_v1 enable row level security;
revoke all on neo_private.shop_seller_tariffs_v1 from public,anon,authenticated,service_role;
create function public.neo_shop_seller_tariffs_v1(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); r jsonb; k text; p jsonb; t neo_private.shop_seller_tariffs_v1;
begin
 if u is null or not exists(select 1 from neo_private.admin_members where user_id=u) then raise exception 'Acesso administrativo obrigatório.' using errcode='42501';end if;
 if p_action='save' then
  r:=p_payload->'rates';
  if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>11 or not(r ?& array['credit_buyer','credit_single','credit_seller_2_6','credit_seller_7_18','pix','balance','prepaid','mercado_parcelado','open_finance','boleto_cents','financing']) then raise exception 'Tarifas inválidas.';end if;
  for k in select jsonb_object_keys(r) loop
   if k='financing' then
    if jsonb_typeof(r->k) is distinct from 'array' or jsonb_array_length(r->k)<>17 or exists(select 1 from jsonb_array_elements(r->k) v where jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]{1,4}$' or (v::text)::int>9000) then raise exception 'Parcelamento inválido.';end if;
   elsif jsonb_typeof(r->k) is distinct from 'number' or (r->>k) !~ '^[0-9]{1,5}$' or (r->>k)::int>10000 then raise exception 'Tarifa inválida.';end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(r->'financing') with ordinality as a(v,i) where (v::text)::int+(case when i<=5 then (r->>'credit_seller_2_6')::int else (r->>'credit_seller_7_18')::int end)>10000) then raise exception 'Taxa total inválida.';end if;
  update neo_private.shop_seller_tariffs_v1 set rates=r,updated_at=now(),source='Revisão manual do administrador' where singleton;
 elsif p_action<>'status' then raise exception 'Operação inválida.';end if;
 select * into t from neo_private.shop_seller_tariffs_v1 where singleton;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into p from (select id,name,price_cents,(select round(c.unit_cost_brl_cents)::bigint from neo_private.shop_acquisition_costs c where c.product_id=s.id order by c.recorded_at desc,c.id desc limit 1) as cost_cents from neo_private.shop_products s where deleted_at is null order by name limit 200) x;
 return jsonb_build_object('rates',t.rates,'updated_at',t.updated_at,'source',t.source,'products',p);
end $$;
revoke all on function public.neo_shop_seller_tariffs_v1(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_seller_tariffs_v1(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;