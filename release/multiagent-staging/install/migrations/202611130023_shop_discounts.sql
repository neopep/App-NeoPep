-- Discounts are computed exclusively from server prices. No health data is consulted.
begin;
do $$begin if to_regprocedure('public.neo_shop_v17(text,jsonb)') is null then raise exception 'Instale antes a atualização de galeria da loja (018).';end if;end $$;
alter table neo_private.shop_settings add column if not exists discount_mode text not null default 'best' check(discount_mode in ('best','combine'));
alter table neo_private.shop_carts add column if not exists coupon_code text not null default '';
alter table neo_private.shop_carts add column if not exists payment_method text not null default 'any' check(payment_method in ('any','pix','credit_card','boleto'));
create table if not exists neo_private.shop_promotions(
 id uuid primary key default gen_random_uuid(),name text not null check(length(btrim(name)) between 2 and 100),code text unique check(code is null or code ~ '^[A-Z0-9_-]{3,32}$'),
 active boolean not null default true,kind text not null check(kind in ('percent','fixed','tracking')),value int not null default 0,
 min_quantity int not null default 1 check(min_quantity between 1 and 600),min_subtotal_cents bigint not null default 0 check(min_subtotal_cents between 0 and 100000000),
 product_ids uuid[] not null default '{}',payment_method text not null default 'any' check(payment_method in ('any','pix','credit_card','boleto')),
 stackable boolean not null default false,max_discount_cents int check(max_discount_cents between 1 and 100000000),starts_at timestamptz,ends_at timestamptz,
 max_uses int check(max_uses between 1 and 1000000),per_user_limit int check(per_user_limit between 1 and 1000000),
 source text not null default '' check(length(source)<=100),referrer_user_id uuid references auth.users(id) on delete set null,restricted_user_id uuid references auth.users(id) on delete set null,restricted_to_user boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(cardinality(product_ids)<=100),check(ends_at is null or starts_at is null or ends_at>starts_at),
 check((kind='percent' and value between 1 and 10000) or (kind='fixed' and value between 1 and 100000000) or (kind='tracking' and value=0 and code is not null))
);
alter table neo_private.shop_promotions enable row level security;
revoke all on neo_private.shop_promotions from public,anon,authenticated;
alter table neo_private.shop_orders add column if not exists discount_cents bigint not null default 0 check(discount_cents>=0);
alter table neo_private.shop_orders add column if not exists discounts jsonb not null default '[]';
alter table neo_private.shop_orders add column if not exists coupon_id uuid references neo_private.shop_promotions(id);
alter table neo_private.shop_orders add column if not exists coupon_code text not null default '';
alter table neo_private.shop_orders add column if not exists coupon_source text not null default '';
alter table neo_private.shop_orders add column if not exists referrer_user_id uuid references auth.users(id) on delete set null;
alter table neo_private.shop_orders add column if not exists payment_method text not null default 'any' check(payment_method in ('any','pix','credit_card','boleto'));
create index if not exists neo_shop_coupon_orders on neo_private.shop_orders(coupon_id,user_id);
-- Apply a sequence to remaining eligible line amounts. Rounding is always down in cents.
create or replace function neo_private.shop_discount_plan(p_items jsonb,p_rules jsonb) returns jsonb language plpgsql stable set search_path=pg_catalog as $$
declare amounts bigint[]:='{}';original bigint:=0;remaining bigint;rule jsonb;i jsonb;idx int;base bigint;cut bigint;part bigint;left_cut bigint;left_base bigint;applied jsonb:='[]';total bigint:=0;
begin
 for i in select value from jsonb_array_elements(p_items) loop remaining:=(i->>'unit_price_cents')::bigint*(i->>'quantity')::int;amounts:=array_append(amounts,remaining);original:=original+remaining;end loop;
 for rule in select value from jsonb_array_elements(p_rules) loop
  base:=0;idx:=0;for i in select value from jsonb_array_elements(p_items) loop idx:=idx+1;if jsonb_array_length(rule->'product_ids')=0 or rule->'product_ids' @> jsonb_build_array(i->>'product_id') then base:=base+amounts[idx];end if;end loop;
  cut:=case rule->>'kind' when 'percent' then base*(rule->>'value')::int/10000 when 'fixed' then (rule->>'value')::bigint else 0 end;
  cut:=greatest(0,least(cut,base,original-total-1,coalesce((rule->>'max_discount_cents')::bigint,100000000)));
  if cut>0 then
   left_cut:=cut;left_base:=base;idx:=0;
   for i in select value from jsonb_array_elements(p_items) loop idx:=idx+1;if amounts[idx]>0 and (jsonb_array_length(rule->'product_ids')=0 or rule->'product_ids' @> jsonb_build_array(i->>'product_id')) then
    part:=case when left_base=amounts[idx] then left_cut else left_cut*amounts[idx]/left_base end;left_base:=left_base-amounts[idx];amounts[idx]:=amounts[idx]-part;left_cut:=left_cut-part;
   end if;end loop;
   total:=total+cut;applied:=applied||jsonb_build_array(jsonb_build_object('id',rule->>'id','name',rule->>'name','code',rule->>'code','amount_cents',cut));
  end if;
 end loop;
 return jsonb_build_object('discount_cents',total,'discounts',applied);
end $$;
create or replace function neo_private.shop_promo_quote(u uuid) returns jsonb language plpgsql stable set search_path=pg_catalog as $$
declare q jsonb;c neo_private.shop_carts;r neo_private.shop_promotions;eligible jsonb:='[]';combined jsonb:='[]';best jsonb:='{"discount_cents":0,"discounts":[]}';plan jsonb;rule jsonb;units bigint;eligible_amount bigint;uses bigint;own_uses bigint;coupon uuid;coupon_ok boolean:=false;selection text;token text;
begin
 q:=neo_private.shop_quote(u);select * into c from neo_private.shop_carts where user_id=u;select discount_mode into selection from neo_private.shop_settings where singleton;
 for r in select * from neo_private.shop_promotions where active and (code is null or code=nullif(c.coupon_code,'')) and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) order by created_at,id loop
  if r.restricted_to_user and r.restricted_user_id is distinct from u then continue;end if;
  if r.payment_method<>'any' and r.payment_method<>coalesce(c.payment_method,'any') then continue;end if;
  select coalesce(sum((i->>'quantity')::int),0),coalesce(sum((i->>'quantity')::int*(i->>'unit_price_cents')::bigint),0) into units,eligible_amount from jsonb_array_elements(q->'items') i where cardinality(r.product_ids)=0 or (i->>'product_id')::uuid=any(r.product_ids);
  if units<r.min_quantity or eligible_amount<r.min_subtotal_cents then continue;end if;
  -- Pending orders reserve a use for 30 min; failed/expired orders release it.
  select count(*),count(*) filter(where user_id=u) into uses,own_uses from neo_private.shop_orders o where ((o.discounts @> jsonb_build_array(jsonb_build_object('id',r.id::text))) or o.coupon_id=r.id) and o.environment=(select payment_environment from neo_private.shop_settings where singleton) and (o.status not in ('expired','rejected','cancelled','awaiting_payment','pending') or (o.status in ('awaiting_payment','pending') and o.expires_at>now()));
  if (r.max_uses is not null and uses>=r.max_uses) or (r.per_user_limit is not null and own_uses>=r.per_user_limit) then continue;end if;
  if r.code is not null then coupon:=r.id;coupon_ok:=true;end if;
  rule:=jsonb_build_object('id',r.id,'name',r.name,'code',r.code,'kind',r.kind,'value',r.value,'product_ids',to_jsonb(r.product_ids),'max_discount_cents',r.max_discount_cents);
  eligible:=eligible||jsonb_build_array(rule);
  plan:=neo_private.shop_discount_plan(q->'items',jsonb_build_array(rule));if (plan->>'discount_cents')::bigint>(best->>'discount_cents')::bigint then best:=plan;end if;
  if r.stackable then combined:=combined||jsonb_build_array(rule);end if;
 end loop;
 if selection='combine' then plan:=neo_private.shop_discount_plan(q->'items',combined);if (plan->>'discount_cents')::bigint>(best->>'discount_cents')::bigint then best:=plan;end if;end if;
 q:=q||best||jsonb_build_object('promotions_ready',true,'discount_mode',selection,'payment_method',coalesce(c.payment_method,'any'),'coupon_code',coalesce(c.coupon_code,''),'coupon_valid',coupon_ok,'coupon_id',coupon,'coupon_message',case when coalesce(c.coupon_code,'')='' then '' when not coupon_ok then 'Cupom indisponível ou requisitos não atingidos.' when exists(select 1 from neo_private.shop_promotions where id=coupon and kind='tracking') then 'Origem do cupom registrada.' when best->'discounts' @> jsonb_build_array(jsonb_build_object('code',c.coupon_code)) then 'Cupom aplicado.' else 'Cupom registrado. Mantivemos o desconto mais vantajoso disponível.' end,'total_cents',case when (q->>'shipping_ready')::boolean then (q->>'subtotal_cents')::bigint+(q->>'shipping_cents')::bigint-(best->>'discount_cents')::bigint else null end);
 token:=md5(q::text);return q||jsonb_build_object('quote_token',token);
end $$;
-- Public application entrypoint: administration and server-validated checkout.
do $$begin if to_regprocedure('public.neo_shop_v22(text,jsonb)') is null then alter function public.neo_shop(text,jsonb) rename to neo_shop_v22;end if;end $$;
revoke all on function public.neo_shop_v22(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_shop(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();a boolean;result jsonb;q jsonb;base jsonb;existing neo_private.shop_orders;r neo_private.shop_promotions;pid uuid;v_code text;v_ids uuid[];v_ref uuid;v_user uuid;v_key uuid;v_method text;
begin
 if u is null then raise exception 'Entre na conta para acessar a loja.' using errcode='42501';end if;a:=public.neo_admin_access();
 if p_action in ('promotions','promotion_save','promotion_toggle','discount_settings') then
  if not a then raise exception 'Autorização da loja obrigatória.' using errcode='42501';end if;
  if p_action='promotions' then
   return jsonb_build_object('mode',(select discount_mode from neo_private.shop_settings where singleton),'rules',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('referrer_email',(select email from auth.users where id=p.referrer_user_id),'restricted_email',(select email from auth.users where id=p.restricted_user_id),'reserved_uses',(select count(*) from neo_private.shop_orders o where (o.coupon_id=p.id or o.discounts @> jsonb_build_array(jsonb_build_object('id',p.id::text))) and o.status in ('awaiting_payment','pending') and o.expires_at>now()),'paid_orders',(select count(*) from neo_private.shop_orders o where (o.coupon_id=p.id or o.discounts @> jsonb_build_array(jsonb_build_object('id',p.id::text))) and o.status='paid'),'paid_total_cents',(select coalesce(sum(total_cents),0) from neo_private.shop_orders o where o.coupon_id=p.id and o.status='paid')) order by p.created_at desc) from neo_private.shop_promotions p),'[]'));
  end if;
  perform pg_advisory_xact_lock(642917200);perform neo_private.take_limit('shop_manage',120,3600);
  if p_action='discount_settings' then
   if coalesce(p_payload->>'mode','') not in ('best','combine') then raise exception 'Modo de desconto inválido.';end if;
   update neo_private.shop_settings set discount_mode=p_payload->>'mode' where singleton;return '{"ok":true}';
  elsif p_action='promotion_toggle' then
   if p_payload->'active'='true'::jsonb and exists(select 1 from neo_private.shop_promotions where id=(p_payload->>'id')::uuid and code is null) and (select count(*) from neo_private.shop_promotions where id<>(p_payload->>'id')::uuid and code is null and active)>=50 then raise exception 'Limite de 50 promoções automáticas ativas.';end if;
   update neo_private.shop_promotions set active=(p_payload->>'active')::boolean,updated_at=now() where id=(p_payload->>'id')::uuid;if not found then raise exception 'Regra não encontrada.';end if;return '{"ok":true}';
  end if;
  pid:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());v_code:=nullif(upper(btrim(p_payload->>'code')),'');
  if not exists(select 1 from neo_private.shop_promotions where id=pid) and (select count(*) from neo_private.shop_promotions)>=500 then raise exception 'Limite de 500 regras. Reutilize uma regra existente.';end if;
  if v_code is null and (p_payload->>'active')::boolean and (select count(*) from neo_private.shop_promotions where id<>pid and active and code is null)>=50 then raise exception 'Limite de 50 promoções automáticas ativas.';end if;
  if jsonb_typeof(p_payload->'product_ids') is distinct from 'array' or jsonb_array_length(p_payload->'product_ids')>100 then raise exception 'Produtos inválidos.';end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_ids from jsonb_array_elements_text(p_payload->'product_ids');
  if exists(select 1 from unnest(v_ids) p where not exists(select 1 from neo_private.shop_products where id=p and deleted_at is null)) then raise exception 'Produto indisponível.';end if;
  if nullif(btrim(p_payload->>'referrer_email'),'') is not null then select id into v_ref from auth.users where lower(email)=lower(btrim(p_payload->>'referrer_email'));if v_ref is null then raise exception 'Usuário de origem não encontrado.';end if;end if;
  if nullif(btrim(p_payload->>'restricted_email'),'') is not null then select id into v_user from auth.users where lower(email)=lower(btrim(p_payload->>'restricted_email'));if v_user is null then raise exception 'Usuário beneficiário não encontrado.';end if;end if;
  insert into neo_private.shop_promotions(id,name,code,active,kind,value,min_quantity,min_subtotal_cents,product_ids,payment_method,stackable,max_discount_cents,starts_at,ends_at,max_uses,per_user_limit,source,referrer_user_id,restricted_user_id,restricted_to_user)
  values(pid,btrim(p_payload->>'name'),v_code,coalesce((p_payload->>'active')::boolean,true),p_payload->>'kind',(p_payload->>'value')::int,(p_payload->>'min_quantity')::int,(p_payload->>'min_subtotal_cents')::bigint,v_ids,p_payload->>'payment_method',coalesce((p_payload->>'stackable')::boolean,false),nullif(p_payload->>'max_discount_cents','')::int,nullif(p_payload->>'starts_at','')::timestamptz,nullif(p_payload->>'ends_at','')::timestamptz,nullif(p_payload->>'max_uses','')::int,nullif(p_payload->>'per_user_limit','')::int,coalesce(btrim(p_payload->>'source'),''),v_ref,v_user,v_user is not null)
  on conflict(id) do update set name=excluded.name,code=excluded.code,active=excluded.active,kind=excluded.kind,value=excluded.value,min_quantity=excluded.min_quantity,min_subtotal_cents=excluded.min_subtotal_cents,product_ids=excluded.product_ids,payment_method=excluded.payment_method,stackable=excluded.stackable,max_discount_cents=excluded.max_discount_cents,starts_at=excluded.starts_at,ends_at=excluded.ends_at,max_uses=excluded.max_uses,per_user_limit=excluded.per_user_limit,source=excluded.source,referrer_user_id=excluded.referrer_user_id,restricted_user_id=excluded.restricted_user_id,restricted_to_user=excluded.restricted_to_user,updated_at=now();return jsonb_build_object('id',pid);
 elsif p_action='discount_options' then
  v_code:=upper(btrim(coalesce(p_payload->>'coupon_code','')));v_method:=coalesce(p_payload->>'payment_method','any');
  if (v_code<>'' and v_code!~'^[A-Z0-9_-]{3,32}$') or v_method not in ('any','pix','credit_card','boleto') then raise exception 'Confira o cupom e a forma de pagamento.';end if;
  perform neo_private.take_limit('shop_coupon',60,60);
  insert into neo_private.shop_carts(user_id,coupon_code,payment_method) values(u,v_code,v_method) on conflict(user_id) do update set coupon_code=excluded.coupon_code,payment_method=excluded.payment_method,updated_at=now();
  return neo_private.shop_promo_quote(u);
 elsif p_action='quote' then return neo_private.shop_promo_quote(u);
 elsif p_action='order' then
  perform pg_advisory_xact_lock(642917200);perform neo_private.shop_expire();v_key:=(p_payload->>'request_key')::uuid;
  select * into existing from neo_private.shop_orders where user_id=u and request_key=v_key;
  if found then if existing.address<>p_payload->'address' then raise exception 'O pedido já foi criado com outro endereço.';end if;return jsonb_build_object('id',existing.id,'status',existing.status);end if;
  perform 1 from neo_private.shop_settings where singleton for update;perform 1 from neo_private.shop_carts where user_id=u for update;
  q:=neo_private.shop_promo_quote(u);
  if (p_payload->>'expected_total_cents')::bigint is distinct from (q->>'total_cents')::bigint or ((q->>'discount_cents')::bigint>0 and p_payload->>'quote_token' is distinct from q->>'quote_token') then raise exception 'Os valores ou descontos mudaram. Atualize e confira o carrinho novamente.';end if;
  base:=neo_private.shop_quote(u);result:=public.neo_shop_v22('order',p_payload||jsonb_build_object('expected_total_cents',base->'total_cents'));
  select * into r from neo_private.shop_promotions where id=(q->>'coupon_id')::uuid;
  update neo_private.shop_orders set total_cents=(q->>'total_cents')::bigint,discount_cents=(q->>'discount_cents')::bigint,discounts=q->'discounts',coupon_id=r.id,coupon_code=coalesce(r.code,''),coupon_source=coalesce(r.source,''),referrer_user_id=r.referrer_user_id,payment_method=q->>'payment_method' where id=(result->>'id')::uuid;
  return result;
 end if;
 result:=public.neo_shop_v22(p_action,p_payload);
 if p_action='catalog' then result:=result||jsonb_build_object('promotions_ready',true,'coupon_code',coalesce((select coupon_code from neo_private.shop_carts where user_id=u),''),'payment_method',coalesce((select payment_method from neo_private.shop_carts where user_id=u),'any'));
 elsif p_action in ('orders','manage_orders') then
  result:=coalesce((select jsonb_agg(i.value||jsonb_build_object('discount_cents',o.discount_cents,'discounts',o.discounts,'coupon_code',o.coupon_code,'payment_method',o.payment_method)||case when p_action='manage_orders' then jsonb_build_object('coupon_source',o.coupon_source,'referrer_user_id',o.referrer_user_id) else '{}' end order by i.ordinality) from jsonb_array_elements(result) with ordinality i join neo_private.shop_orders o on o.id=(i.value->>'id')::uuid),'[]');
 end if;return result;
end $$;
-- Legacy payment functions refuse promotional orders until the Edge functions are upgraded.
do $$begin if to_regprocedure('public.neo_shop_payment_claim_v22(uuid,uuid)') is null then alter function public.neo_shop_payment_claim(uuid,uuid) rename to neo_shop_payment_claim_v22;end if;end $$;
create or replace function public.neo_shop_payment_claim(p_order uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin
 if exists(select 1 from neo_private.shop_orders where id=p_order and (discount_cents>0 or payment_method<>'any')) then raise exception 'Atualize as funções de pagamento da loja para usar promoções.';end if;return public.neo_shop_payment_claim_v22(p_order,p_user);end $$;
create or replace function public.neo_shop_payment_claim_v2(p_order uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare result jsonb;o neo_private.shop_orders;begin
 result:=public.neo_shop_payment_claim_v22(p_order,p_user);select * into o from neo_private.shop_orders where id=p_order and user_id=p_user;
 return result||jsonb_build_object('discount_cents',o.discount_cents,'payment_method',o.payment_method,'payment_revision',2);
end $$;
do $$begin if to_regprocedure('public.neo_shop_payment_event_v22(uuid,text,text,bigint,text)') is null then alter function public.neo_shop_payment_event(uuid,text,text,bigint,text) rename to neo_shop_payment_event_v22;end if;end $$;
create or replace function public.neo_shop_payment_event(p_order uuid,p_payment text,p_status text,p_amount bigint,p_environment text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin
 if exists(select 1 from neo_private.shop_orders where id=p_order and (discount_cents>0 or payment_method<>'any')) then raise exception 'Atualize o webhook da loja para usar promoções.';end if;return public.neo_shop_payment_event_v22(p_order,p_payment,p_status,p_amount,p_environment);end $$;
create or replace function public.neo_shop_payment_event_v2(p_order uuid,p_payment text,p_status text,p_amount bigint,p_environment text,p_method text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare m text;begin
 perform pg_advisory_xact_lock(642917200);select payment_method into m from neo_private.shop_orders where id=p_order for update;
 if m<>'any' and m is distinct from p_method and p_status in ('approved','pending','in_process','authorized') then return public.neo_shop_payment_event_v22(p_order,p_payment,'in_mediation',p_amount,p_environment);end if;
 return public.neo_shop_payment_event_v22(p_order,p_payment,p_status,p_amount,p_environment);
end $$;
do $$begin if to_regprocedure('public.neo_shop_export_v22()') is null then alter function public.neo_shop_export() rename to neo_shop_export_v22;end if;end $$;
revoke all on function public.neo_shop_export_v22() from public,anon,authenticated;
create or replace function public.neo_shop_export() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare result jsonb;begin
 result:=public.neo_shop_export_v22();return coalesce((select jsonb_agg(i.value||jsonb_build_object('discount_cents',o.discount_cents,'discounts',o.discounts,'coupon_code',o.coupon_code,'payment_method',o.payment_method)) from jsonb_array_elements(result) i join neo_private.shop_orders o on o.id=(i.value->>'id')::uuid and o.user_id=auth.uid()),'[]');
end $$;
revoke all on function public.neo_shop_export() from public,anon;grant execute on function public.neo_shop_export() to authenticated;
revoke all on function neo_private.shop_discount_plan(jsonb,jsonb),neo_private.shop_promo_quote(uuid) from public,anon,authenticated;
revoke all on function public.neo_shop(text,jsonb) from public,anon;grant execute on function public.neo_shop(text,jsonb) to authenticated;
revoke all on function public.neo_shop_payment_claim_v22(uuid,uuid),public.neo_shop_payment_event_v22(uuid,text,text,bigint,text) from public,anon,authenticated;
revoke all on function public.neo_shop_payment_claim(uuid,uuid),public.neo_shop_payment_claim_v2(uuid,uuid),public.neo_shop_payment_event(uuid,text,text,bigint,text),public.neo_shop_payment_event_v2(uuid,text,text,bigint,text,text) from public,anon,authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then
 execute 'revoke all on function public.neo_shop_payment_claim_v22(uuid,uuid),public.neo_shop_payment_event_v22(uuid,text,text,bigint,text) from service_role';
 execute 'grant execute on function public.neo_shop_payment_claim(uuid,uuid),public.neo_shop_payment_claim_v2(uuid,uuid),public.neo_shop_payment_event(uuid,text,text,bigint,text),public.neo_shop_payment_event_v2(uuid,text,text,bigint,text,text) to service_role';
end if;end $$;
notify pgrst,'reload schema';
commit;
