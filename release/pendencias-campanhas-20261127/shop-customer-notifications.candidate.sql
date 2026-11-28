-- Candidate: customer payment notifications; reuse current event_push_jobs and dispatch schedule.
-- No changes to Mercado Pago, stock reservation, or existing payment status trigger.
begin;
create table neo_private.shop_notice_settings_v1(
 singleton boolean primary key default true check(singleton),
 reminders_enabled boolean not null default true
);
insert into neo_private.shop_notice_settings_v1(singleton) values(true);
create table neo_private.shop_customer_notices_v1(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references neo_private.shop_orders(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('paid','reminder1','reminder2')),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(order_id,kind)
);
create index shop_customer_notices_user_v1 on neo_private.shop_customer_notices_v1(user_id,created_at desc);
alter table neo_private.shop_notice_settings_v1 enable row level security;
alter table neo_private.shop_customer_notices_v1 enable row level security;
revoke all on neo_private.shop_notice_settings_v1,neo_private.shop_customer_notices_v1 from public,anon,authenticated,service_role;
create function neo_private.shop_reminder_eligible_v1(o neo_private.shop_orders)
returns boolean language sql stable set search_path=pg_catalog as $$
 select coalesce(o.user_id is not null and o.status='awaiting_payment' and o.cancellation_status='none' and not o.stock_released
  and o.expires_at>now() and o.payment_id is null
  and (o.payment_lease is null or o.payment_lease<=now())
  and not exists(select 1 from neo_private.shop_payments p where p.order_id=o.id and p.status not in ('rejected','cancelled','canceled','expired','failed'))
  and (select reminders_enabled from neo_private.shop_notice_settings_v1 where singleton),false)
$$;
revoke all on function neo_private.shop_reminder_eligible_v1(neo_private.shop_orders) from public,anon,authenticated,service_role;
create function neo_private.shop_customer_paid_notice_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if new.user_id is not null and new.status in ('paid','test_paid') and new.status is distinct from old.status then
  insert into neo_private.shop_customer_notices_v1(order_id,user_id,kind) values(new.id,new.user_id,'paid') on conflict(order_id,kind) do nothing;
 end if;
 return new;
end $$;
revoke all on function neo_private.shop_customer_paid_notice_v1() from public,anon,authenticated,service_role;
create trigger neo_shop_customer_paid_notice_v1 after update of status on neo_private.shop_orders for each row execute function neo_private.shop_customer_paid_notice_v1();
create function neo_private.shop_enqueue_reminder_v1(p_order uuid,p_manual boolean)
returns boolean language plpgsql set search_path=pg_catalog as $$
declare o neo_private.shop_orders; n int; last_at timestamptz; k text; nid uuid;
begin
 select * into o from neo_private.shop_orders where id=p_order for update skip locked;
 if not found or not neo_private.shop_reminder_eligible_v1(o) or o.expires_at<=now()+interval '2 minutes' then return false;end if;
 select count(*),max(created_at) into n,last_at from neo_private.shop_customer_notices_v1 where order_id=o.id and kind in ('reminder1','reminder2');
 if n>=2 or last_at>now()-interval '15 minutes' then return false;end if;
 if p_manual then
  if o.created_at>now()-interval '5 minutes' then return false;end if;
 elsif n=0 and o.created_at>now()-interval '15 minutes' then return false;
 elsif n=1 and o.expires_at>now()+interval '15 minutes' then return false;
 end if;
 -- If cron was unavailable until near expiry, send only the final slot; never replay both.
 if n=0 and o.expires_at<=now()+interval '15 minutes' then k:='reminder2';
 elsif n=0 then k:='reminder1';else k:='reminder2';end if;
 insert into neo_private.shop_customer_notices_v1(order_id,user_id,kind) values(o.id,o.user_id,k) on conflict(order_id,kind) do nothing returning id into nid;
 if nid is null then return false;end if;
 insert into neo_private.event_push_jobs(device_id,event_key,kind,title,body)
 select d.id,'shop:'||o.id||':payment_reminder:'||k,'shop','Pagamento pendente','Você tem uma compra aguardando pagamento. Abra o NeoPep para conferir o prazo.'
 from neo_private.push_devices d where d.user_id=o.user_id on conflict(device_id,event_key) do nothing;
 return true;
end $$;
revoke all on function neo_private.shop_enqueue_reminder_v1(uuid,boolean) from public,anon,authenticated,service_role;
create function public.neo_shop_notice_sweep_v1()
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare oid uuid; n integer:=0;
begin
 if not (select reminders_enabled from neo_private.shop_notice_settings_v1 where singleton) then return 0;end if;
 -- Bound work per existing dispatcher invocation; do not delay other notifications.
 for oid in select o.id from neo_private.shop_orders o
 where o.status='awaiting_payment' and o.expires_at>now()+interval '2 minutes' and o.created_at<=now()-interval '15 minutes'
 and neo_private.shop_reminder_eligible_v1(o)
 and not exists(select 1 from neo_private.shop_customer_notices_v1 x where x.order_id=o.id and x.kind='reminder2')
 and (not exists(select 1 from neo_private.shop_customer_notices_v1 x where x.order_id=o.id and x.kind='reminder1')
 or (o.expires_at<=now()+interval '15 minutes' and not exists(select 1 from neo_private.shop_customer_notices_v1 x where x.order_id=o.id and x.kind='reminder1' and x.created_at>now()-interval '15 minutes')))
 order by o.expires_at limit 50
 loop if neo_private.shop_enqueue_reminder_v1(oid,false) then n:=n+1;end if;end loop;
 return n;
end $$;
revoke all on function public.neo_shop_notice_sweep_v1() from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_notice_sweep_v1() to service_role;
-- Revalidate immediately before push transmission. Existing non-reminder shop events are preserved.
create function public.neo_shop_notice_push_check_v1(p_id uuid)
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
revoke all on function public.neo_shop_notice_push_check_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_notice_push_check_v1(uuid) to service_role;
create function public.neo_shop_customer_notices_v1(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();r jsonb;ok boolean;
begin
 if u is null then raise exception 'Entre na conta.' using errcode='42501';end if;
 if p_action='read' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into r from (
   select n.id,n.order_id,n.kind,n.created_at,n.read_at,o.expires_at
   from neo_private.shop_customer_notices_v1 n join neo_private.shop_orders o on o.id=n.order_id and o.user_id=n.user_id
   where n.user_id=u and (n.kind='paid' or neo_private.shop_reminder_eligible_v1(o))
   order by n.created_at desc limit 50
  ) x;
  return r;
 elsif p_action='seen' then
  update neo_private.shop_customer_notices_v1 set read_at=coalesce(read_at,now()) where user_id=u and id=(p_payload->>'id')::uuid;
  return '{"ok":true}'::jsonb;
 end if;
 if not exists(select 1 from neo_private.admin_members where user_id=u) then raise exception 'Acesso administrativo obrigatório.' using errcode='42501';end if;
 if p_action='save' then
  if jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception 'Configuração inválida.';end if;
  update neo_private.shop_notice_settings_v1 set reminders_enabled=(p_payload->>'enabled')::boolean where singleton;
 elsif p_action='remind' then
  ok:=neo_private.shop_enqueue_reminder_v1((p_payload->>'order_id')::uuid,true);
  if ok then perform neo_private.push_dispatch_wake();end if;
  return jsonb_build_object('queued',ok);
 elsif p_action<>'settings' then raise exception 'Operação inválida.';end if;
 return (select jsonb_build_object('enabled',reminders_enabled) from neo_private.shop_notice_settings_v1 where singleton);
end $$;
revoke all on function public.neo_shop_customer_notices_v1(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_customer_notices_v1(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
