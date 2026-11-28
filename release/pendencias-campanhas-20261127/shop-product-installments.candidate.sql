-- Candidate: product-specific interest-free installments. Apply after the exact-quote cache and payment renewal candidates.
-- Activation requires separate sandbox verification; no account-level Mercado Pago settings are changed.
begin;
create table neo_private.shop_product_installment_v1(
 product_id uuid primary key references neo_private.shop_products(id) on delete cascade,
 policy text not null check(policy in ('default','buyer','seller')),
 free_installments int not null default 1 check(free_installments between 1 and 12),
 check((policy='seller' and free_installments>=2) or (policy<>'seller' and free_installments=1)),
 updated_at timestamptz not null default now()
);
create table neo_private.shop_interest_free_gate_v1(
 environment text primary key check(environment in ('test','production')),
 verified_revision text,
 verified_max int not null default 1 check(verified_max between 1 and 12),
 enabled boolean not null default false
);
insert into neo_private.shop_interest_free_gate_v1(environment) values ('test'),('production');
alter table neo_private.shop_product_installment_v1 enable row level security;
alter table neo_private.shop_interest_free_gate_v1 enable row level security;
revoke all on neo_private.shop_product_installment_v1,neo_private.shop_interest_free_gate_v1 from public,anon,authenticated,service_role;
alter table neo_private.shop_orders add column installment_policy_v1 jsonb;
create function neo_private.shop_interest_free_effective_v1(p_environment text,p_items jsonb)
returns jsonb language plpgsql stable set search_path=pg_catalog as $$
declare g neo_private.shop_interest_free_gate_v1; n int; seller_count int; buyer_count int; max_free int; rev text;
begin
 select * into g from neo_private.shop_interest_free_gate_v1 where environment=p_environment;
 rev:=neo_private.shop_installment_revision_v1(p_environment);
 if not coalesce(g.enabled,false) or rev is null or g.verified_revision is distinct from rev then return '{"mode":"default","free":1,"enabled":false}'::jsonb;end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then return '{"mode":"default","free":1,"enabled":true}'::jsonb;end if;
 select count(*),count(*) filter(where x.policy='seller'),count(*) filter(where x.policy='buyer'),min(x.free_installments)
 into n,seller_count,buyer_count,max_free
 from jsonb_array_elements(p_items) i left join neo_private.shop_product_installment_v1 x on x.product_id=(i->>'product_id')::uuid;
 if seller_count=n and max_free>=2 then
  if max_free>g.verified_max then raise exception 'Condição sem juros ainda não homologada.';end if;
  return jsonb_build_object('mode','seller','free',max_free,'enabled',true,'revision',rev);
 end if;
 if seller_count>0 or buyer_count>0 then return jsonb_build_object('mode','buyer','free',1,'enabled',true,'mixed',seller_count>0,'revision',rev);end if;
 return '{"mode":"default","free":1,"enabled":true}'::jsonb;
end $$;
revoke all on function neo_private.shop_interest_free_effective_v1(text,jsonb) from public,anon,authenticated,service_role;
create function public.neo_shop_product_installments_v1(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); pid uuid; pol text; n int; env text; result jsonb; cost numeric; price bigint; g neo_private.shop_interest_free_gate_v1;
begin
 if u is null then raise exception 'Entre na conta.' using errcode='42501';end if;
 select payment_environment into env from neo_private.shop_settings where singleton and payments_ready;
 select * into g from neo_private.shop_interest_free_gate_v1 where environment=env;
 if p_action='read' then
  if jsonb_typeof(p_payload->'product_ids') is distinct from 'array' or jsonb_array_length(p_payload->'product_ids')>100 then raise exception 'Produtos inválidos.';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'policy',neo_private.shop_interest_free_effective_v1(env,jsonb_build_array(jsonb_build_object('product_id',p.id)))-'revision')),'[]') into result
  from neo_private.shop_products p where p.active and p.deleted_at is null and p.stock>0 and not neo_private.shop_product_blocked(u,p.id)
  and p.id in (select value::uuid from jsonb_array_elements_text(p_payload->'product_ids') where value ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$');
  return jsonb_build_object('products',result);
 elsif p_action='cart' then
  return neo_private.shop_interest_free_effective_v1(env,(select items from neo_private.shop_carts where user_id=u))-'revision';
 end if;
 if not exists(select 1 from neo_private.admin_members where user_id=u) then raise exception 'Acesso administrativo obrigatório.' using errcode='42501';end if;
 pid:=(p_payload->>'product_id')::uuid;
 if p_action='save' then
  perform pg_advisory_xact_lock(642917200);
  select price_cents into price from neo_private.shop_products where id=pid and deleted_at is null for update;
  if not found then raise exception 'Produto indisponível.';end if;
  pol:=p_payload->>'policy';n:=(p_payload->>'free_installments')::int;
  if pol is null or pol not in ('default','buyer','seller') or n is null or (pol='seller' and n not between 2 and 12) or (pol<>'seller' and n<>1) then raise exception 'Condição inválida.';end if;
  insert into neo_private.shop_product_installment_v1(product_id,policy,free_installments) values(pid,pol,n)
  on conflict(product_id) do update set policy=excluded.policy,free_installments=excluded.free_installments,updated_at=now();
 elsif p_action<>'admin_read' then raise exception 'Operação inválida.';end if;
 select price_cents into price from neo_private.shop_products where id=pid and deleted_at is null;
 if not found then raise exception 'Produto indisponível.';end if;
 select policy,free_installments into pol,n from neo_private.shop_product_installment_v1 where product_id=pid;
 select unit_cost_brl_cents into cost from neo_private.shop_acquisition_costs where product_id=pid order by recorded_at desc,id desc limit 1;
 return jsonb_build_object('product_id',pid,'policy',coalesce(pol,'default'),'free_installments',coalesce(n,1),'price_cents',price,'unit_cost_cents',cost,'enabled',coalesce(g.enabled and g.verified_revision=neo_private.shop_installment_revision_v1(env),false),'verified_max',coalesce(g.verified_max,1));
end $$;
revoke all on function public.neo_shop_product_installments_v1(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_product_installments_v1(text,jsonb) to authenticated;
create function neo_private.shop_snapshot_installments_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare pol jsonb;
begin
 pol:=neo_private.shop_interest_free_effective_v1(new.environment,new.items);
 if pol->>'mode'<>'default' then new.installment_policy_v1:=pol;end if;
 return new;
end $$;
revoke all on function neo_private.shop_snapshot_installments_v1() from public,anon,authenticated,service_role;
create trigger zz_shop_installment_snapshot_v1 before insert on neo_private.shop_orders for each row execute function neo_private.shop_snapshot_installments_v1();
create function public.neo_shop_order_installments_v1(p_order uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o neo_private.shop_orders;g neo_private.shop_interest_free_gate_v1;rev text;
begin
 select * into o from neo_private.shop_orders where id=p_order and user_id=p_user;
 if not found then raise exception 'Pedido indisponível.' using errcode='42501';end if;
 if o.installment_policy_v1 is null then return '{"mode":"default","free":1}'::jsonb;end if;
 select * into g from neo_private.shop_interest_free_gate_v1 where environment=o.environment;
 rev:=neo_private.shop_installment_revision_v1(o.environment);
 if not coalesce(g.enabled,false) or rev is null or g.verified_revision is distinct from rev or o.installment_policy_v1->>'revision' is distinct from rev or (o.installment_policy_v1->>'free')::int>g.verified_max then raise exception 'Condição de parcelamento precisa ser conferida pela loja.';end if;
 return o.installment_policy_v1-'revision';
end $$;
revoke all on function public.neo_shop_order_installments_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_order_installments_v1(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
