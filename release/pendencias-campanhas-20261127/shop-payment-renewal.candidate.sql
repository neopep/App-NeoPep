-- Candidate: one-hour provider checkout and idempotent renewal of expired orders.
-- Do not apply until mercadopago-create is tested with sandbox credentials.
begin;
alter table neo_private.shop_orders
 add column payment_reopened_from uuid references neo_private.shop_orders(id),
 add column payment_create_key uuid,
 add column payment_create_started boolean,
 add column payment_create_seconds integer check(payment_create_seconds between 1 and 3600);
alter table neo_private.shop_orders alter column payment_create_key set default gen_random_uuid(),
 alter column payment_create_started set default false,
 alter column expires_at set default (now()+interval '1 hour');
create unique index shop_one_renewal_per_order on neo_private.shop_orders(payment_reopened_from) where payment_reopened_from is not null;
create unique index shop_payment_create_key_unique on neo_private.shop_orders(payment_create_key) where payment_create_key is not null;

create function public.neo_shop_payment_snapshot_v1(p_order uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o neo_private.shop_orders; child neo_private.shop_orders;
begin
 perform pg_advisory_xact_lock(642917200);
 perform neo_private.shop_expire();
 select * into o from neo_private.shop_orders where id=p_order and user_id=p_user;
 if not found then raise exception 'Pedido não encontrado.' using errcode='42501';end if;
 select * into child from neo_private.shop_orders where payment_reopened_from=o.id and user_id=p_user;
 return jsonb_build_object('id',o.id,'status',o.status,'environment',o.environment,
  'total_cents',o.total_cents,'preference_id',o.preference_id,'expires_at',o.expires_at,
  'never_created',o.payment_create_started is false and o.preference_id is null and o.payment_id is null,
  'child_id',child.id,'child_status',child.status,'child_expires_at',child.expires_at);
end $$;

CREATE FUNCTION neo_private.shop_renewal_quote_v1(u uuid,p_quote jsonb,p_coupon text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare q jsonb;c neo_private.shop_carts;r neo_private.shop_promotions;eligible jsonb:='[]';combined jsonb:='[]';best jsonb:='{"discount_cents":0,"discounts":[]}';plan jsonb;rule jsonb;units bigint;eligible_amount bigint;uses bigint;own_uses bigint;coupon uuid;coupon_ok boolean:=false;selection text;token text;
begin
 q:=p_quote;c.coupon_code:=p_coupon;c.payment_method:='any';select discount_mode into selection from neo_private.shop_settings where singleton;
 for r in select * from neo_private.shop_promotions where active and (code is null or code=nullif(c.coupon_code,'')) and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) order by created_at,id loop
  if r.restricted_to_user and r.restricted_user_id is distinct from u then continue;end if;
  if r.payment_method<>'any' and r.payment_method<>coalesce(c.payment_method,'any') then continue;end if;
  select coalesce(sum((i->>'quantity')::int),0),coalesce(sum((i->>'quantity')::int*(i->>'unit_price_cents')::bigint),0) into units,eligible_amount from jsonb_array_elements(q->'items') i where cardinality(r.product_ids)=0 or (i->>'product_id')::uuid=any(r.product_ids);
  if units<r.min_quantity or eligible_amount<r.min_subtotal_cents then continue;end if;
  -- Pending orders reserve a use until expires_at; failed/expired orders release it.
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
end $function$
;
revoke all on function neo_private.shop_renewal_quote_v1(uuid,jsonb,text) from public,anon,authenticated,service_role;

create function public.neo_shop_payment_renew_v1(p_order uuid,p_user uuid,p_preference text,p_proof text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o neo_private.shop_orders; child neo_private.shop_orders; cfg neo_private.shop_settings; p neo_private.shop_products; q jsonb; i jsonb; shipping integer;
begin
 perform pg_advisory_xact_lock(642917200);
 perform neo_private.shop_expire();
 select * into o from neo_private.shop_orders where id=p_order and user_id=p_user for update;
 if not found then raise exception 'Pedido não encontrado.' using errcode='42501';end if;
 select * into child from neo_private.shop_orders where payment_reopened_from=o.id and user_id=p_user for update;
 if found then
  if child.status in ('awaiting_payment','pending') and child.expires_at>now() and not child.stock_released then return jsonb_build_object('id',child.id);end if;
  raise exception 'Este pedido já foi retomado. Consulte o pedido mais recente.';
 end if;
 if o.status<>'expired' or not o.stock_released or o.expires_at>now() or o.cancellation_status<>'none' or o.fulfillment<>'processing'
  or o.payment_lease>now() or o.preference_id is distinct from p_preference
  or exists(select 1 from neo_private.shop_payments where order_id=o.id and status in ('approved','authorized','refunded','charged_back','partially_refunded','in_mediation'))
  then raise exception 'O pedido não pode ser retomado. Confira a situação do pagamento.';end if;
 if ((p_proof='closed' and o.preference_id ~ '^ORD[A-Z0-9]{10,60}$')
   or (p_proof='never_created' and o.preference_id is null and o.payment_id is null and o.payment_create_started is false)) is not true
  then raise exception 'Pagamento anterior ainda precisa de conferência.';end if;
 select * into cfg from neo_private.shop_settings where singleton for update;
 if not cfg.payments_ready or not cfg.shipping_ready or cfg.payment_environment<>o.environment then raise exception 'Pagamento indisponível neste ambiente.';end if;
 if o.billing_document_number is null or o.payment_method<>'any' then raise exception 'Confira novamente seus dados e a forma de pagamento em uma nova compra.';end if;
 if jsonb_typeof(o.items) is distinct from 'array' or jsonb_array_length(o.items) not between 1 and 30 then raise exception 'Itens inválidos.';end if;
 -- Lock all products in deterministic order; visibility, quantity, and unchanged price.
 for i in select value from jsonb_array_elements(o.items) order by value->>'product_id' loop
  select * into p from neo_private.shop_products where id=(i->>'product_id')::uuid for update;
  if not found or not p.active or p.deleted_at is not null or neo_private.shop_product_blocked(p_user,p.id) then raise exception 'Um produto do pedido não está disponível.';end if;
  if (i->>'quantity')::int not between 1 and 20 or p.stock<(i->>'quantity')::int then raise exception 'Estoque insuficiente para retomar este pedido.';end if;
  if p.price_cents<>(i->>'unit_price_cents')::bigint then raise exception 'O preço mudou. Refaça a compra para conferir os valores atuais.';end if;
 end loop;
 if (select count(distinct value->>'product_id') from jsonb_array_elements(o.items))<>jsonb_array_length(o.items) then raise exception 'Itens inválidos.';end if;
 shipping:=neo_private.shop_shipping_for_state(o.address->>'state');
 if shipping is distinct from o.shipping_cents then raise exception 'O frete mudou. Refaça a compra para conferir o valor atual.';end if;
 -- Re-evaluate the exact current promotion rules without modifying the customer's cart.
 q:=neo_private.shop_renewal_quote_v1(p_user,jsonb_build_object('items',o.items,'subtotal_cents',o.subtotal_cents,'shipping_cents',shipping,'shipping_ready',true),o.coupon_code);
 if (q->>'subtotal_cents')::bigint is distinct from o.subtotal_cents
  or (q->>'discount_cents')::bigint is distinct from o.discount_cents
  or q->'discounts' is distinct from o.discounts or (q->>'coupon_id')::uuid is distinct from o.coupon_id
  or o.subtotal_cents+shipping-o.discount_cents<>o.total_cents
  then raise exception 'Os descontos ou cupons mudaram. Refaça a compra para confirmar os valores.';end if;
 for i in select value from jsonb_array_elements(o.items) order by value->>'product_id' loop
  update neo_private.shop_products set stock=stock-(i->>'quantity')::int where id=(i->>'product_id')::uuid;
 end loop;
 insert into neo_private.shop_orders(user_id,request_key,items,address,subtotal_cents,shipping_cents,total_cents,
  discount_cents,discounts,coupon_id,coupon_code,coupon_source,referrer_user_id,payment_method,billing_document_type,billing_document_number,shipping_state,payment_reopened_from)
 values(o.user_id,gen_random_uuid(),o.items,o.address,o.subtotal_cents,o.shipping_cents,o.total_cents,
  o.discount_cents,o.discounts,o.coupon_id,o.coupon_code,o.coupon_source,o.referrer_user_id,'any',o.billing_document_type,o.billing_document_number,o.shipping_state,o.id) returning * into child;
 return jsonb_build_object('id',child.id);
end $$;

create function public.neo_shop_payment_claim_v60(p_order uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare r jsonb; o neo_private.shop_orders; seconds integer;
begin
 perform pg_advisory_xact_lock(642917200);
 r:=public.neo_shop_payment_claim_v2(p_order,p_user);
 select * into o from neo_private.shop_orders where id=p_order and user_id=p_user for update;
 if o.init_point is not null then return r;end if;
 -- Legacy rows with unknown creation history need reconciliation; never invent a new idempotency key.
 if o.payment_create_key is null or o.payment_create_started is null then raise exception 'A tentativa anterior precisa de conferência.';end if;
 seconds:=coalesce(o.payment_create_seconds,least(3600,floor(extract(epoch from o.expires_at-now()))::int));
 if seconds<1 then raise exception 'Pedido expirado.';end if;
 update neo_private.shop_orders set payment_create_started=true,payment_create_seconds=seconds where id=o.id;
 return r||jsonb_build_object('create_key',o.payment_create_key,'expiration_seconds',seconds);
end $$;
revoke all on function public.neo_shop_payment_snapshot_v1(uuid,uuid),public.neo_shop_payment_renew_v1(uuid,uuid,text,text),public.neo_shop_payment_claim_v60(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_payment_snapshot_v1(uuid,uuid),public.neo_shop_payment_renew_v1(uuid,uuid,text,text),public.neo_shop_payment_claim_v60(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
