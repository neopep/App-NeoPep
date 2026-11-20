-- Only verified server functions may create payment links or confirm payment.
begin;
alter table neo_private.shop_settings add column if not exists payment_environment text not null default 'test' check(payment_environment in ('test','production'));
alter table neo_private.shop_orders add column if not exists environment text not null default 'test' check(environment in ('test','production'));
alter table neo_private.shop_orders drop constraint if exists shop_orders_status_check;
alter table neo_private.shop_orders add constraint shop_orders_status_check check(status in ('awaiting_payment','pending','paid','test_paid','paid_review','expired','rejected','cancelled','refunded','charged_back'));
create table if not exists neo_private.shop_payments(payment_id text primary key,order_id uuid not null references neo_private.shop_orders(id),status text not null,amount_cents bigint not null,updated_at timestamptz not null default now());
alter table neo_private.shop_payments enable row level security;
revoke all on neo_private.shop_payments from public,anon,authenticated;
create or replace function neo_private.shop_order_environment() returns trigger language plpgsql set search_path=pg_catalog as $$
begin select payment_environment into new.environment from neo_private.shop_settings where singleton;return new;end $$;
drop trigger if exists neo_shop_environment on neo_private.shop_orders;
create trigger neo_shop_environment before insert on neo_private.shop_orders for each row execute function neo_private.shop_order_environment();
create or replace function public.neo_shop_payment_claim(p_order uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o neo_private.shop_orders;
begin
 select * into o from neo_private.shop_orders where id=p_order and user_id=p_user for update;
 if not found then raise exception 'Pedido não encontrado.';end if;
 if not exists(select 1 from neo_private.shop_settings where singleton and payments_ready) then raise exception 'Pagamento ainda não ativado.';end if;
 if o.status not in ('awaiting_payment','pending') or o.expires_at<now() then raise exception 'Pedido encerrado ou expirado.';end if;
 if o.init_point is not null then return jsonb_build_object('id',o.id,'payment_url',o.init_point,'environment',o.environment);end if;
 if o.payment_lease>now() then raise exception 'Pagamento sendo preparado. Aguarde e tente novamente.';end if;
 update neo_private.shop_orders set payment_lease=now()+interval '2 minutes' where id=o.id;
 return jsonb_build_object('id',o.id,'items',o.items,'total_cents',o.total_cents,'shipping_cents',o.shipping_cents,'email',o.address->>'email','expires_at',o.expires_at,'environment',o.environment);
end $$;
create or replace function public.neo_shop_payment_link(p_order uuid,p_preference text,p_url text) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_url !~ '^https://(www\.|sandbox\.)?mercadopago\.com(\.br)?/' or length(p_url)>4000 or length(p_preference) not between 1 and 200 then raise exception 'Link de pagamento inválido.';end if;
 update neo_private.shop_orders set preference_id=p_preference,init_point=p_url,payment_lease=null where id=p_order and init_point is null and status in ('awaiting_payment','pending');
end $$;
create or replace function public.neo_shop_payment_event(p_order uuid,p_payment text,p_status text,p_amount bigint,p_environment text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o neo_private.shop_orders;i jsonb;available boolean:=true;new_status text;
begin
 perform pg_advisory_xact_lock(642917200);
 select * into o from neo_private.shop_orders where id=p_order for update;
 if not found or o.total_cents<>p_amount or o.environment<>p_environment or p_payment !~ '^[0-9]{1,30}$' then raise exception 'Confirmação de pagamento incompatível com o pedido.';end if;
 if o.status='paid_review' and p_status='approved' then return '{"review":true}';end if;
 if o.status in ('refunded','charged_back') and p_status not in ('refunded','charged_back') then return '{"ignored":true}';end if;
 if p_status not in ('approved','pending','in_process','authorized','rejected','cancelled','refunded','charged_back','in_mediation','partially_refunded') then raise exception 'Estado de pagamento desconhecido.';end if;
 if exists(select 1 from neo_private.shop_payments where payment_id=p_payment and order_id<>p_order) then raise exception 'Pagamento já associado a outro pedido.';end if;
 insert into neo_private.shop_payments(payment_id,order_id,status,amount_cents) values(p_payment,p_order,p_status,p_amount) on conflict(payment_id) do update set status=excluded.status,updated_at=now();
 if o.status in ('paid','test_paid','paid_review') and o.payment_id is not null and o.payment_id<>p_payment and p_status='approved' then update neo_private.shop_orders set status='paid_review' where id=o.id;return '{"review":true,"reason":"multiple_payments"}';end if;
 if o.payment_id is not null and o.payment_id<>p_payment and p_status<>'approved' then return '{"ignored":true}';end if;
 if o.status in ('paid','test_paid','paid_review','refunded','charged_back') and p_status not in ('approved','refunded','charged_back','in_mediation','partially_refunded') then return '{"ignored":true}';end if;
 if p_status='approved' then
  new_status:=case when p_environment='test' then 'test_paid' else 'paid' end;
  if o.stock_released and p_environment='production' then
   for i in select value from jsonb_array_elements(o.items) loop if not exists(select 1 from neo_private.shop_products where id=(i->>'product_id')::uuid and stock>=(i->>'quantity')::int) then available:=false;end if;end loop;
   if available then for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock-(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;else new_status:='paid_review';end if;
  end if;
  if p_environment='test' and not o.stock_released then for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock+(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;end if;
  update neo_private.shop_orders set status=new_status,payment_id=p_payment,stock_released=case when p_environment='test' then true when available then false else true end where id=o.id;
 elsif p_status in ('rejected','cancelled') then
  if not o.stock_released then for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock+(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;end if;
  update neo_private.shop_orders set status=p_status,payment_id=p_payment,stock_released=true where id=o.id;
 elsif p_status in ('refunded','charged_back','in_mediation','partially_refunded') then
  if p_status='refunded' and o.fulfillment='processing' and not o.stock_released then for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock+(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;update neo_private.shop_orders set stock_released=true where id=o.id;end if;
  update neo_private.shop_orders set status=case when p_status in ('in_mediation','partially_refunded') then 'paid_review' else p_status end,payment_id=p_payment where id=o.id;
 else update neo_private.shop_orders set status='pending',payment_id=p_payment where id=o.id and status not in ('expired','cancelled');end if;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.neo_shop_export() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'items',items,'address',address,'status',status,'total_cents',total_cents,'fulfillment',fulfillment,'tracking',tracking,'created_at',created_at) order by created_at) from neo_private.shop_orders where user_id=auth.uid()),'[]'::jsonb);
end $$;
create or replace function public.neo_shop_deletion_check(p_user uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform neo_private.shop_expire();
 return jsonb_build_object('allowed',not exists(select 1 from neo_private.shop_orders where user_id=p_user and (status in ('awaiting_payment','pending','paid_review') or (status='paid' and fulfillment<>'delivered'))));
end $$;
create or replace function neo_private.shop_account_delete() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if exists(select 1 from neo_private.shop_orders where user_id=old.id and (status in ('awaiting_payment','pending','paid_review') or (status='paid' and fulfillment<>'delivered'))) then raise exception 'Conclua o atendimento dos pedidos em aberto antes de excluir a conta.';end if;
 update neo_private.shop_orders set user_id=null,address='{}'::jsonb where user_id=old.id;return old;
end $$;
drop trigger if exists neo_shop_account_delete on auth.users;
create trigger neo_shop_account_delete before delete on auth.users for each row execute function neo_private.shop_account_delete();
revoke all on function neo_private.shop_order_environment(),neo_private.shop_account_delete() from public,anon,authenticated;
revoke all on function public.neo_shop_payment_claim(uuid,uuid),public.neo_shop_payment_link(uuid,text,text),public.neo_shop_payment_event(uuid,text,text,bigint,text),public.neo_shop_deletion_check(uuid) from public,anon,authenticated;
revoke all on function public.neo_shop_export() from public,anon;
grant execute on function public.neo_shop_export() to authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.neo_shop_payment_claim(uuid,uuid),public.neo_shop_payment_link(uuid,text,text),public.neo_shop_payment_event(uuid,text,text,bigint,text),public.neo_shop_deletion_check(uuid) to service_role';end if;end $$;
commit;
