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

create function public.neo_shop_payment_renew_v1(p_order uuid,p_user uuid,p_preference text,p_proof text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o neo_private.shop_orders; child neo_private.shop_orders; c neo_private.shop_carts; cfg neo_private.shop_settings; p neo_private.shop_products; q jsonb; i jsonb; items jsonb; had_cart boolean; shipping integer;
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
 if not ((p_proof='closed' and o.preference_id ~ '^ORD[A-Z0-9]{10,60}$')
   or (p_proof='never_created' and o.preference_id is null and o.payment_id is null and o.payment_create_started is false))
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
 -- Re-evaluate current coupon and automatic promotion policy using a transaction-local cart.
 -- The row lock and rollback on error preserve the user's actual cart.
 select * into c from neo_private.shop_carts where user_id=p_user for update;had_cart:=found;
 items:=(select jsonb_agg(jsonb_build_object('product_id',value->'product_id','quantity',value->'quantity')) from jsonb_array_elements(o.items));
 insert into neo_private.shop_carts(user_id,items,coupon_code,payment_method) values(p_user,items,o.coupon_code,'any')
 on conflict(user_id) do update set items=excluded.items,coupon_code=excluded.coupon_code,payment_method=excluded.payment_method;
 q:=neo_private.shop_promo_quote(p_user);
 if had_cart then update neo_private.shop_carts set items=c.items,coupon_code=c.coupon_code,payment_method=c.payment_method,updated_at=c.updated_at where user_id=p_user;
 else delete from neo_private.shop_carts where user_id=p_user;end if;
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
