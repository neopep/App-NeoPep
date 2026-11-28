-- Candidate; default disabled, no mutation to orders, payments or webhook.
begin;
create table neo_private.shop_fee_observations_v1(
 environment text not null check(environment in ('production','test')),
 order_id uuid not null references neo_private.shop_orders(id) on delete cascade,
 account_revision text not null,
 method text not null check(method ~ '^[a-z0-9_]{1,40}$'),
 installments int not null check(installments between 1 and 24),
 gross_cents bigint not null check(gross_cents>0),
 net_cents bigint not null check(net_cents>=0),
 processing_cents bigint not null check(processing_cents>=0),
 financing_cents bigint not null check(financing_cents>=0),
 buyer_financing_cents bigint not null check(buyer_financing_cents>=0),
 observed_at timestamptz not null default now(),
 primary key(environment,order_id),
 check(gross_cents=net_cents+processing_cents+financing_cents)
);
create table neo_private.shop_fee_sync_v1(
 environment text primary key check(environment in ('production','test')),
 enabled boolean not null default false,
 last_attempt timestamptz,last_success timestamptz,last_result text,
 lease uuid,lease_until timestamptz,revision text,order_ids uuid[]
);
insert into neo_private.shop_fee_sync_v1(environment) values('test'),('production');
alter table neo_private.shop_fee_observations_v1 enable row level security;
alter table neo_private.shop_fee_sync_v1 enable row level security;
revoke all on neo_private.shop_fee_observations_v1,neo_private.shop_fee_sync_v1 from public,anon,authenticated,service_role;
create function public.neo_shop_fee_sync_v1(p_action text,p_environment text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare cfg neo_private.shop_fee_sync_v1; rev text; ids uuid[]; result jsonb; r jsonb; oid uuid; n int:=0;
begin
 if p_environment not in ('test','production') or not exists(select 1 from neo_private.shop_settings where singleton and payment_environment=p_environment and payments_ready) then return '{"status":"disabled"}';end if;
 select * into cfg from neo_private.shop_fee_sync_v1 where environment=p_environment for update;
 rev:=neo_private.shop_installment_revision_v1(p_environment);
 if p_action='status' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.method,t.installments,t.seller_financing),'[]') into result from (
   select o.method,o.installments,(o.financing_cents>0) seller_financing,(o.buyer_financing_cents>0) buyer_financing,count(*) samples,
   sum(o.gross_cents) gross_cents,sum(o.net_cents) net_cents,sum(o.processing_cents) processing_cents,sum(o.financing_cents) financing_cents,max(o.observed_at) observed_at
   from neo_private.shop_fee_observations_v1 o join neo_private.shop_orders s on s.id=o.order_id
   where o.environment=p_environment and o.account_revision=rev and o.observed_at>now()-interval '30 days' and s.environment=p_environment
   and s.status=case when p_environment='test' then 'test_paid' else 'paid' end and s.cancellation_status='none'
   group by 1,2,3,4) t;
  return jsonb_build_object('status',coalesce(cfg.last_result,'not_synced'),'enabled',cfg.enabled,'last_success',cfg.last_success,'rows',result);
 elsif p_action='claim' then
  if not cfg.enabled or rev is null then return '{"status":"disabled"}';end if;
  if cfg.lease_until>now() then return '{"status":"busy"}';end if;
  if cfg.last_attempt>now()-interval '24 hours' then return '{"status":"cooldown"}';end if;
  select array_agg(id) into ids from (select s.id from neo_private.shop_orders s left join neo_private.shop_fee_observations_v1 o on o.environment=s.environment and o.order_id=s.id and o.account_revision=rev
   where s.environment=p_environment and s.status=case when p_environment='test' then 'test_paid' else 'paid' end and s.cancellation_status='none' and s.created_at>now()-interval '90 days'
   order by o.observed_at nulls first,s.created_at desc limit 10) a;
  update neo_private.shop_fee_sync_v1 set last_attempt=now(),lease=gen_random_uuid(),lease_until=now()+interval '4 minutes',revision=rev,order_ids=ids,last_result='running' where environment=p_environment returning * into cfg;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'total_cents',s.total_cents)),'[]') into result from neo_private.shop_orders s where s.id=any(ids);
  return jsonb_build_object('status','claimed','lease',cfg.lease,'orders',result);
 elsif p_action='finish' then
  if not cfg.enabled or cfg.lease is null or cfg.lease_until<=now() or cfg.revision is distinct from rev or cfg.lease::text is distinct from p_payload->>'lease' then raise exception 'fee_sync_lease';end if;
  if jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_array_length(p_payload->'rows')>10 or coalesce(p_payload->>'result','') not in ('success','partial','no_evidence','rate_limited','provider_error') then raise exception 'fee_sync_input';end if;
  for r in select value from jsonb_array_elements(p_payload->'rows') loop
   oid:=(r->>'order_id')::uuid;
   if not coalesce(oid=any(cfg.order_ids),false) or not exists(select 1 from neo_private.shop_orders s where s.id=oid and s.environment=p_environment and s.total_cents=(r->>'gross_cents')::bigint and s.status=case when p_environment='test' then 'test_paid' else 'paid' end and s.cancellation_status='none') then raise exception 'fee_sync_order';end if;
   insert into neo_private.shop_fee_observations_v1(environment,order_id,account_revision,method,installments,gross_cents,net_cents,processing_cents,financing_cents,buyer_financing_cents)
   values(p_environment,oid,rev,r->>'method',(r->>'installments')::int,(r->>'gross_cents')::bigint,(r->>'net_cents')::bigint,(r->>'processing_cents')::bigint,(r->>'financing_cents')::bigint,(r->>'buyer_financing_cents')::bigint)
   on conflict(environment,order_id) do update set account_revision=excluded.account_revision,method=excluded.method,installments=excluded.installments,gross_cents=excluded.gross_cents,net_cents=excluded.net_cents,processing_cents=excluded.processing_cents,financing_cents=excluded.financing_cents,buyer_financing_cents=excluded.buyer_financing_cents,observed_at=now();
   n:=n+1;
  end loop;
  update neo_private.shop_fee_sync_v1 set last_result=p_payload->>'result',last_success=case when n>0 then now() else last_success end,lease=null,lease_until=null,order_ids=null where environment=p_environment;
  return jsonb_build_object('status',p_payload->>'result','observations',n);
 end if;
 raise exception 'fee_sync_action';
end $$;
revoke all on function public.neo_shop_fee_sync_v1(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_fee_sync_v1(text,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
