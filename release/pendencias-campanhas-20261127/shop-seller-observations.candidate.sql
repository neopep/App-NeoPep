-- Candidate: observations of actual Mercado Pago payments, not contracted tariff estimates.
begin;
create table neo_private.shop_seller_observation_v1(
 environment text not null check(environment in ('production','test')), revision text not null,
 order_id uuid not null references neo_private.shop_orders(id) on delete cascade,
 payment_id text not null check(payment_id ~ '^[0-9]{1,30}$'),
 method text not null check(method ~ '^[a-z0-9_]{1,40}$'),
 payment_type text not null check(payment_type ~ '^[a-z0-9_]{1,40}$'),
 installments int not null check(installments between 1 and 24),
 gross_cents bigint not null check(gross_cents>0),
 net_cents bigint not null check(net_cents between 0 and gross_cents),
 buyer_paid_cents bigint not null check(buyer_paid_cents>=gross_cents),
 observed_at timestamptz not null default now(),
 primary key(environment,revision,payment_id)
);
alter table neo_private.shop_seller_observation_v1 enable row level security;
revoke all on neo_private.shop_seller_observation_v1 from public,anon,authenticated,service_role;
create function public.neo_shop_seller_observations_worker_v1(p_action text,p_environment text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare rev text; r jsonb; ord neo_private.shop_orders; pid text;
begin
 if p_environment not in ('test','production') or not exists(select 1 from neo_private.shop_settings where singleton and payments_ready and payment_environment=p_environment) then raise exception 'environment_mismatch';end if;
 rev:=neo_private.shop_installment_revision_v1(p_environment);
 if rev is null then raise exception 'configuration_pending';end if;
 if p_action='candidates' then
  return jsonb_build_object('revision',rev,'orders',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select o.id as order_id,o.payment_id,o.total_cents from neo_private.shop_orders o
   left join neo_private.shop_seller_observation_v1 s on s.environment=p_environment and s.revision=rev and s.payment_id=o.payment_id
   where o.environment=p_environment and o.status=case when p_environment='test' then 'test_paid' else 'paid' end
   and o.cancellation_status='none' and o.payment_id ~ '^[0-9]{1,30}$' and o.created_at>now()-interval '90 days'
   and (s.observed_at is null or s.observed_at<now()-interval '24 hours')
   order by s.observed_at nulls first,o.created_at desc limit 12
  ) x),'[]'::jsonb));
 elsif p_action='record' then
  if p_payload->>'revision' is distinct from rev then raise exception 'revision_changed';end if;
  r:=p_payload->'observation';pid:=r->>'payment_id';
  select * into ord from neo_private.shop_orders where id=(r->>'order_id')::uuid and payment_id=pid and environment=p_environment and status=case when p_environment='test' then 'test_paid' else 'paid' end and cancellation_status='none';
  if not found or ord.total_cents is distinct from (r->>'gross_cents')::bigint then raise exception 'order_mismatch';end if;
  insert into neo_private.shop_seller_observation_v1(environment,revision,order_id,payment_id,method,payment_type,installments,gross_cents,net_cents,buyer_paid_cents)
  values(p_environment,rev,ord.id,pid,r->>'method',r->>'payment_type',(r->>'installments')::int,ord.total_cents,(r->>'net_cents')::bigint,(r->>'buyer_paid_cents')::bigint)
  on conflict(environment,revision,payment_id) do update set method=excluded.method,payment_type=excluded.payment_type,installments=excluded.installments,gross_cents=excluded.gross_cents,net_cents=excluded.net_cents,buyer_paid_cents=excluded.buyer_paid_cents,observed_at=now();
  return '{"ok":true}'::jsonb;
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function public.neo_shop_seller_observations_worker_v1(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_seller_observations_worker_v1(text,text,jsonb) to service_role;
create function public.neo_shop_seller_observations_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare env text; rev text;
begin
 if auth.uid() is null or not public.neo_shop_financial_admin_v1(auth.uid()) then raise exception 'forbidden' using errcode='42501';end if;
 select payment_environment into env from neo_private.shop_settings where singleton and payments_ready;
 rev:=neo_private.shop_installment_revision_v1(env);
 return jsonb_build_object('environment',env,'source','mercado_pago_payment','rows',coalesce((select jsonb_agg(to_jsonb(x)) from (
 select s.method,s.payment_type,s.installments,count(*) samples,sum(s.gross_cents) gross_cents,sum(s.net_cents) net_cents,sum(s.gross_cents-s.net_cents) deductions_cents,
 round(10000*sum(s.gross_cents-s.net_cents)::numeric/nullif(sum(s.gross_cents),0)) deduction_bps,max(s.observed_at) last_observed
 from neo_private.shop_seller_observation_v1 s join neo_private.shop_orders o on o.id=s.order_id and o.payment_id=s.payment_id and o.environment=s.environment
 where s.environment=env and s.revision=rev and s.observed_at>now()-interval '7 days' and o.cancellation_status='none' and o.status=case when env='test' then 'test_paid' else 'paid' end
 group by s.method,s.payment_type,s.installments order by s.payment_type,s.method,s.installments
 ) x),'[]'::jsonb));
end $$;
revoke all on function public.neo_shop_seller_observations_v1() from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_seller_observations_v1() to authenticated;
notify pgrst,'reload schema';
commit;
