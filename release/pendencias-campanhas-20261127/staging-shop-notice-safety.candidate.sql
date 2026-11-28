-- STAGING ONLY. Follow-up for already installed customer notice functions.
-- Restrict reminders to explicitly authorized sandbox accounts.
begin;
create or replace function neo_private.shop_reminder_eligible_v1(o neo_private.shop_orders)
returns boolean language sql stable set search_path=pg_catalog as $$
 select coalesce(o.user_id is not null and o.environment='test' and exists(select 1 from neo_private.staging_checkout_users_v1 where user_id=o.user_id) and o.status='awaiting_payment' and o.cancellation_status='none' and not o.stock_released
  and o.expires_at>now() and o.payment_id is null
  and (o.payment_lease is null or o.payment_lease<=now())
  and not exists(select 1 from neo_private.shop_payments p where p.order_id=o.id and p.status not in ('rejected','cancelled','canceled','expired','failed'))
  and (select reminders_enabled from neo_private.shop_notice_settings_v1 where singleton),false)
$$;
create or replace function neo_private.shop_customer_paid_notice_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if new.user_id is not null and new.status in ('paid','test_paid') and new.status is distinct from old.status then
  insert into neo_private.shop_customer_notices_v1(order_id,user_id,kind) values(new.id,new.user_id,'paid') on conflict(order_id,kind) do nothing;
 end if;
 return new;
end $$;
create or replace function public.neo_shop_notice_push_check_v1(p_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j neo_private.event_push_jobs;o neo_private.shop_orders;oid uuid;device_user uuid;ttl int;
begin
 select * into j from neo_private.event_push_jobs where id=p_id and kind='shop' and not sent;
 if not found then return '{"send":false}'::jsonb;end if;
 if j.event_key ~ '^shop:[0-9a-f-]{36}:payment_reminder:reminder[12]$' then
  oid:=split_part(j.event_key,':',2)::uuid;
  select * into o from neo_private.shop_orders where id=oid;
  select user_id into device_user from neo_private.push_devices where id=j.device_id;
  if o.id is null or device_user is distinct from o.user_id or not neo_private.shop_reminder_eligible_v1(o) then return '{"send":false}'::jsonb;end if;
  ttl:=least(60,floor(extract(epoch from o.expires_at-clock_timestamp()))::int);
  if ttl<1 then return '{"send":false}'::jsonb;end if;
  return jsonb_build_object('send',true,'notice','payment_pending','ttl',ttl);
 elsif j.event_key ~ '^shop:[0-9a-f-]{36}:status:(paid|test_paid)$' then
  oid:=split_part(j.event_key,':',2)::uuid;
  select * into o from neo_private.shop_orders where id=oid;
  select user_id into device_user from neo_private.push_devices where id=j.device_id;
  if o.id is null or o.user_id is null or device_user is distinct from o.user_id or o.status not in ('paid','test_paid') then return '{"send":false}'::jsonb;end if;
  return '{"send":true,"notice":"payment_confirmed","ttl":300}'::jsonb;
 end if;
 return '{"send":true,"ttl":300}'::jsonb;
end $$;
commit;
