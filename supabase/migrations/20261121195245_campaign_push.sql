create table neo_private.campaign_push_opt_in (
 user_id uuid primary key references auth.users(id) on delete cascade,
 granted_at timestamptz not null default now()
);
create table neo_private.campaign_push_delivery (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references neo_private.campaigns(id),
 device_id uuid not null references neo_private.push_devices(id) on delete cascade,
 expires_at timestamptz not null,
 lease_until timestamptz,
 attempts integer not null default 0,
 outcome text check (outcome in ('sent','gone','failed')),
 unique(campaign_id,device_id)
);
create index campaign_push_delivery_device_idx on neo_private.campaign_push_delivery(device_id);
alter table neo_private.campaign_push_opt_in enable row level security;
alter table neo_private.campaign_push_delivery enable row level security;
revoke all on neo_private.campaign_push_opt_in,neo_private.campaign_push_delivery from public,anon,authenticated;

create function public.neo_campaign_push_preference(p_enabled boolean default null) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare account uuid:=auth.uid();
begin
 if account is null then raise exception 'Sessão obrigatória.' using errcode='42501';end if;
 if p_enabled is true then
  if not public.neo_has_consent('terms') then raise exception 'Consentimento obrigatório.' using errcode='42501';end if;
  insert into neo_private.campaign_push_opt_in(user_id) values(account) on conflict do nothing;
 elsif p_enabled is false then
  delete from neo_private.campaign_push_opt_in where user_id=account;
  update neo_private.campaign_push_delivery j set outcome='failed' from neo_private.push_devices d
   where j.device_id=d.id and d.user_id=account and j.outcome is null;
 end if;
 return exists(select 1 from neo_private.campaign_push_opt_in where user_id=account);
end $$;

create function neo_private.campaign_push_on_display() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 insert into neo_private.campaign_push_delivery(campaign_id,device_id,expires_at)
 select c.id,d.id,least(now()+interval '1 hour',c.ends_at)
 from neo_private.campaigns c,neo_private.push_devices d
 where c.id=new.campaign_id and c.push_requested and c.status='active' and d.user_id=new.user_id
  and exists(select 1 from neo_private.campaign_push_opt_in o where o.user_id=new.user_id)
 on conflict(campaign_id,device_id) do nothing;
 return new;
end $$;
create trigger neo_campaign_push_after_display after update of displayed_at on neo_private.campaign_impressions
 for each row when (old.displayed_at is null and new.displayed_at is not null)
 execute function neo_private.campaign_push_on_display();

create function public.neo_campaign_push_claim() returns jsonb
language sql security definer set search_path=pg_catalog as $$
 with picked as (
  select j.id from neo_private.campaign_push_delivery j join neo_private.push_devices d on d.id=j.device_id
  join neo_private.campaigns c on c.id=j.campaign_id
  join neo_private.campaign_push_opt_in o on o.user_id=d.user_id
  where current_setting('request.jwt.claims',true)::jsonb->>'role'='service_role'
   and c.status='active' and c.push_requested and coalesce(c.ends_at,'infinity')>now()
   and j.outcome is null and j.attempts<3 and j.expires_at>now() and coalesce(j.lease_until,'-infinity')<now()
   and exists(select 1 from public.neo_consents x where x.user_id=d.user_id and x.purpose='terms' and x.version='2026-11-v1' and x.granted)
  order by j.expires_at,j.id limit 20 for update of j skip locked
 ), claimed as (
  update neo_private.campaign_push_delivery j set lease_until=now()+interval '5 minutes',attempts=j.attempts+1
  from picked where j.id=picked.id returning j.id,j.device_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'endpoint',d.endpoint,'keys',d.keys,'kind','campaign')),'[]')
 from claimed j join neo_private.push_devices d on d.id=j.device_id
$$;

create function public.neo_campaign_push_finish(p_id uuid,p_outcome text) returns void
language sql security definer set search_path=pg_catalog as $$
 update neo_private.campaign_push_delivery set outcome=case when p_outcome='retry' then null else p_outcome end
 where id=p_id and outcome is null and p_outcome in ('sent','gone','retry')
 and current_setting('request.jwt.claims',true)::jsonb->>'role'='service_role'
$$;
revoke all on function public.neo_campaign_push_preference(boolean),public.neo_campaign_push_claim(),public.neo_campaign_push_finish(uuid,text),neo_private.campaign_push_on_display() from public,anon,authenticated;
grant execute on function public.neo_campaign_push_preference(boolean) to authenticated;
grant execute on function public.neo_campaign_push_claim(),public.neo_campaign_push_finish(uuid,text) to service_role;
