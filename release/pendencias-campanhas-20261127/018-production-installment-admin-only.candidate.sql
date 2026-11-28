-- Candidate: real provider installment quotes, separated by account and exact BRL amount.
-- No payment or webhook modifications. No automatic calls before worker/cron activation.
begin;
create table neo_private.shop_installment_config_v1(
 environment text primary key check(environment in ('test','production')),
 show_enabled boolean not null default false,
 auto_enabled boolean not null default false,
 frequency_hours int not null default 24 check(frequency_hours in (6,12,24)),
 checkout_verified boolean not null default false,
 verified_revision text,
 last_attempt timestamptz,last_success timestamptz,last_result text not null default 'not_synced',
 retry_after timestamptz,lease_id uuid,lease_until timestamptz,lease_revision text,
 lease_amounts bigint[] not null default '{}'
);
insert into neo_private.shop_installment_config_v1(environment) values ('production');
create table neo_private.shop_installment_queue_v1(
 environment text not null references neo_private.shop_installment_config_v1(environment),
 amount_cents bigint not null check(amount_cents between 1 and 100000000),
 seen_at timestamptz not null default now(),attempted_at timestamptz,
 primary key(environment,amount_cents)
);
create table neo_private.shop_installment_cache_v1(
 environment text not null references neo_private.shop_installment_config_v1(environment),
 amount_cents bigint not null check(amount_cents between 1 and 100000000),
 account_revision text not null,
 rows jsonb not null check(jsonb_typeof(rows)='array' and jsonb_array_length(rows) between 1 and 240),
 observed_at timestamptz not null,
 expires_at timestamptz not null,
 primary key(environment,amount_cents)
);
alter table neo_private.shop_installment_config_v1 enable row level security;
alter table neo_private.shop_installment_queue_v1 enable row level security;
alter table neo_private.shop_installment_cache_v1 enable row level security;
revoke all on neo_private.shop_installment_config_v1,neo_private.shop_installment_queue_v1,neo_private.shop_installment_cache_v1 from public,anon,authenticated,service_role;

create function neo_private.shop_installment_revision_v1(p_env text)
returns text language sql stable set search_path=pg_catalog as $$
 select md5(jsonb_build_array(environment,collector_id,encrypted_access,updated_at,validated_at)::text)
 from neo_private.shop_payment_environments where environment=p_env and encrypted_access is not null and collector_id is not null and validated_at is not null
$$;
revoke all on function neo_private.shop_installment_revision_v1(text) from public,anon,authenticated,service_role;

create function public.neo_shop_installments_v1(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); env text; cfg neo_private.shop_installment_config_v1; rev text; a bigint; p neo_private.shop_products; offer jsonb; pid uuid; amounts bigint[]:='{}'; result jsonb;
begin
 if u is null then raise exception 'Entre na conta.' using errcode='42501';end if;
 -- Production rollout: strictly administrative, no consumer quote advertising.
 if p_action='read' then return '{"enabled":false,"quotes":[]}'::jsonb;end if;
 if not exists(select 1 from neo_private.admin_members where user_id=u) then raise exception 'Acesso administrativo obrigatório.' using errcode='42501';end if;
 env:=p_payload->>'environment';
 if env is distinct from 'production' then raise exception 'Ambiente inválido.';end if;
 rev:=neo_private.shop_installment_revision_v1(env);
 select * into cfg from neo_private.shop_installment_config_v1 where environment=env for update;
 if p_action='save' then
  if coalesce((p_payload->>'frequency_hours')::int,0) not in (6,12,24) or p_payload->'auto_enabled' is distinct from 'false'::jsonb or p_payload->'show_enabled' is distinct from 'false'::jsonb then raise exception 'Homologação pendente. Somente consulta manual está liberada.';end if;
  update neo_private.shop_installment_config_v1 set frequency_hours=(p_payload->>'frequency_hours')::int where environment=env returning * into cfg;
 elsif p_action<>'status' then raise exception 'Operação indisponível antes da homologação.';end if;
 return jsonb_build_object('environment',env,'show_enabled',cfg.show_enabled,'auto_enabled',cfg.auto_enabled,'frequency_hours',cfg.frequency_hours,'last_attempt',cfg.last_attempt,'last_success',cfg.last_success,'last_result',cfg.last_result,'retry_after',cfg.retry_after,'checkout_verified',cfg.checkout_verified and cfg.verified_revision=rev,'configured',rev is not null,'syncing',coalesce(cfg.lease_until>now(),false),
 'quotes',coalesce((select jsonb_agg(jsonb_build_object('amount_cents',c.amount_cents,'rows',c.rows,'observed_at',c.observed_at,'expires_at',c.expires_at) order by c.amount_cents) from neo_private.shop_installment_cache_v1 c where c.environment=env and c.account_revision=rev and c.expires_at>now()),'[]'));
end $$;
revoke all on function public.neo_shop_installments_v1(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_installments_v1(text,jsonb) to authenticated;

create function public.neo_shop_installment_worker_v1(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare env text:=p_payload->>'environment'; cfg neo_private.shop_installment_config_v1; rev text; collector text; amounts bigint[]; row jsonb; lease uuid; a bigint; result text; successes int:=0; retry int;
begin
 if env is distinct from 'production' then raise exception 'invalid_environment';end if;
 perform pg_advisory_xact_lock(642917366);
 select * into cfg from neo_private.shop_installment_config_v1 where environment=env for update;
 rev:=neo_private.shop_installment_revision_v1(env);
 if p_action='claim' then
  if p_payload->'manual' is distinct from 'true'::jsonb then return '{"status":"disabled"}';end if;
  if not exists(select 1 from neo_private.shop_settings where singleton and payment_environment='production' and payments_ready) then return '{"status":"disabled"}';end if;
  if rev is null then return '{"status":"configuration_pending"}';end if;
  if cfg.lease_until>now() then return '{"status":"busy"}';end if;
  if cfg.retry_after>now() then return '{"status":"cooldown"}';end if;
  if p_payload->'manual'='true'::jsonb then
   if cfg.last_attempt>now()-interval '30 minutes' then return '{"status":"cooldown"}';end if;
  else
   if not cfg.auto_enabled or not exists(select 1 from neo_private.shop_settings where singleton and payment_environment=env and payments_ready) then return '{"status":"disabled"}';end if;
   if cfg.last_attempt>now()-make_interval(hours=>cfg.frequency_hours)+interval '5 minutes' then return '{"status":"not_due"}';end if;
  end if;
  select collector_id into collector from neo_private.shop_payment_environments where environment=env;
  delete from neo_private.shop_installment_queue_v1 where environment=env and seen_at<now()-interval '7 days';
  delete from neo_private.shop_installment_cache_v1 where environment=env and (account_revision<>rev or expires_at<now()-interval '7 days');
  insert into neo_private.shop_installment_queue_v1(environment,amount_cents)
   select env,price_cents from (select distinct price_cents from neo_private.shop_products where active and deleted_at is null and stock>0 and price_cents between 1 and 100000000 order by price_cents limit 100) p
   on conflict(environment,amount_cents) do update set seen_at=now();
  select coalesce(array_agg(amount_cents order by priority,attempted_at nulls first,amount_cents),'{}') into amounts from (
   select q.amount_cents,q.attempted_at,case when exists(select 1 from neo_private.shop_products p where p.active and p.deleted_at is null and p.stock>0 and p.price_cents=q.amount_cents) then 0 else 1 end priority from neo_private.shop_installment_queue_v1 q where q.environment=env order by priority,q.attempted_at nulls first,q.amount_cents limit 6
  ) q;
  if cardinality(amounts)=0 then update neo_private.shop_installment_config_v1 set last_attempt=now(),last_result='no_products' where environment=env;return '{"status":"no_products"}';end if;
  lease:=gen_random_uuid();
  update neo_private.shop_installment_config_v1 set last_attempt=now(),last_result='running',lease_id=lease,lease_until=now()+interval '3 minutes',lease_revision=rev,lease_amounts=amounts where environment=env;
  return jsonb_build_object('status','claimed','lease',lease,'revision',rev,'collector',collector,'amounts',amounts,'frequency_hours',cfg.frequency_hours);
 elsif p_action='finish' then
  if cfg.lease_id is null or cfg.lease_id is distinct from (p_payload->>'lease')::uuid or cfg.lease_until<now() then raise exception 'lease_invalid';end if;
  result:=p_payload->>'result';
  if result not in ('success','partial','unsupported','rate_limited','provider_error','configuration_pending','no_options') or result is null then raise exception 'invalid_result';end if;
  if jsonb_typeof(p_payload->'quotes') is distinct from 'array' or jsonb_array_length(p_payload->'quotes')>12 then raise exception 'invalid_quotes';end if;
  if rev is null or cfg.lease_revision is distinct from rev then result:='configuration_pending';
  else
   for row in select value from jsonb_array_elements(p_payload->'quotes') loop
    a:=(row->>'amount_cents')::bigint;
    if a is null or not a=any(cfg.lease_amounts) or jsonb_typeof(row->'rows') is distinct from 'array' or jsonb_array_length(row->'rows') not between 1 and 240 then raise exception 'invalid_quote';end if;
    if exists(select 1 from jsonb_array_elements(row->'rows') r where jsonb_typeof(r)<>'object' or (r->>'installments')::int not between 1 and 24 or (r->>'installment_cents')::bigint<=0 or (r->>'total_cents')::bigint<=0 or (r->>'buyer_rate')::numeric<0 or (r->>'buyer_rate')::numeric>1000 or not (r ?& array['method','issuer','installments','installment_cents','total_cents','buyer_rate'])) then raise exception 'invalid_row';end if;
    insert into neo_private.shop_installment_cache_v1(environment,amount_cents,account_revision,rows,observed_at,expires_at) values(env,a,rev,row->'rows',now(),now()+make_interval(hours=>cfg.frequency_hours))
    on conflict(environment,amount_cents) do update set account_revision=excluded.account_revision,rows=excluded.rows,observed_at=excluded.observed_at,expires_at=excluded.expires_at;
    successes:=successes+1;
   end loop;
   update neo_private.shop_installment_queue_v1 set attempted_at=now() where environment=env and amount_cents=any(cfg.lease_amounts);
   -- A failed attempt must not leave an outdated numeric promise.
   delete from neo_private.shop_installment_cache_v1 c where environment=env and amount_cents=any(cfg.lease_amounts) and not exists(select 1 from jsonb_array_elements(p_payload->'quotes') q where (q->>'amount_cents')::bigint=c.amount_cents);
   if result='unsupported' then
    delete from neo_private.shop_installment_cache_v1 where environment=env;
    cfg.checkout_verified:=false;cfg.verified_revision:=null;
   end if;
  end if;
  retry:=greatest(1800,least(604800,coalesce((p_payload->>'retry_seconds')::int,1800)));
  update neo_private.shop_installment_config_v1 set last_result=result,last_success=case when successes>0 then now() else last_success end,retry_after=case when result='rate_limited' then now()+make_interval(secs=>retry) else null end,checkout_verified=cfg.checkout_verified,verified_revision=cfg.verified_revision,lease_id=null,lease_until=null,lease_revision=null,lease_amounts='{}' where environment=env;
  return jsonb_build_object('status',result,'quotes',successes);
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function public.neo_shop_installment_worker_v1(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_installment_worker_v1(text,jsonb) to service_role;
create function public.neo_shop_installment_active_environment_v1()
returns text language sql stable security definer set search_path=pg_catalog as $$
 select payment_environment from neo_private.shop_settings where singleton and payments_ready
$$;
revoke all on function public.neo_shop_installment_active_environment_v1() from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_installment_active_environment_v1() to service_role;
notify pgrst,'reload schema';
-- Financial permissions are stricter than the community integration admin role.

create function public.neo_shop_financial_admin_v1(p_actor uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select p_actor is not null and exists(select 1 from neo_private.admin_members where user_id=p_actor)
$$;
revoke all on function public.neo_shop_financial_admin_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_financial_admin_v1(uuid) to service_role;
notify pgrst,'reload schema';


commit;
