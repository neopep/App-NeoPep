create table neo_private.connect_config (
 singleton boolean primary key default true check(singleton),
 paused boolean not null default true
);
insert into neo_private.connect_config default values;
create table neo_private.connect_devices (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 label text not null check(length(label) between 1 and 100),
 secret_hash bytea not null,
 state text not null default 'pending' check(state in ('pending','approved','revoked')),
 priority integer not null default 0 check(priority between 0 and 100),
 last_seen timestamptz,
 version text,
 working_set_mb integer check(working_set_mb between 0 and 100000)
);
create table neo_private.connect_accounts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 identity text not null check(identity ~ '^fixture-[A-Za-z0-9_-]{1,40}$'),
 enabled boolean not null default true,
 unique(owner_id,identity)
);
create table neo_private.connect_sessions (
 device_id uuid references neo_private.connect_devices(id) on delete cascade,
 account_id uuid references neo_private.connect_accounts(id) on delete cascade,
 connected boolean not null default false,
 last_seen timestamptz not null default now(),
 linked_at timestamptz not null default now(),
 primary key(device_id,account_id)
);
create table neo_private.connect_group_accounts (
 group_id uuid references neo_private.campaign_wa_groups(id),
 account_id uuid references neo_private.connect_accounts(id) on delete cascade,
 verified boolean not null default false,
 may_publish boolean not null default false,
 priority integer not null default 0 check(priority between 0 and 100),
 primary key(group_id,account_id)
);
create table neo_private.connect_tasks (
 id uuid primary key default gen_random_uuid(),
 publication_id uuid not null references neo_private.campaign_wa_publications(id),
 occurrence timestamptz not null,
 mode text not null check(mode in ('fixed','fallback','linked')),
 preferred_account uuid not null references neo_private.connect_accounts(id),
 state text not null default 'queued' check(state in ('queued','leased','started','simulated','uncertain','cancelled')),
 lease_until timestamptz,
 fence uuid,
 device_id uuid references neo_private.connect_devices(id) on delete set null,
 account_id uuid references neo_private.connect_accounts(id) on delete set null,
 unique(publication_id,occurrence)
);
create index connect_tasks_queue_idx on neo_private.connect_tasks(occurrence,id) where state in ('queued','leased','started');
create table neo_private.connect_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 event text not null,
 subject uuid,
 account_id uuid,
 device_id uuid,
 fence uuid,
 created_at timestamptz not null default now()
);
create index connect_audit_device_lease_idx on neo_private.connect_audit(device_id,id desc) where event='leased';
create table neo_private.connect_releases (
 version text primary key check(version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
 path text not null unique check(path ~ '^[0-9.]+/NeoPepConnectSetup[.]exe$'),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 bytes bigint not null check(bytes > 0),
 approved_at timestamptz not null default now()
);

do $guard$
declare name text;
begin
 foreach name in array array['connect_config','connect_devices','connect_accounts','connect_sessions','connect_group_accounts','connect_tasks','connect_audit','connect_releases'] loop
  execute format('alter table neo_private.%I enable row level security',name);
  execute format('revoke all on neo_private.%I from public,anon,authenticated',name);
 end loop;
end $guard$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('neo-connect-releases','neo-connect-releases',false,52428800,array['application/octet-stream','application/vnd.microsoft.portable-executable']);

create function public.neo_connect_release_allowed(p_path text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select neo_private.campaign_admin_allowed() and exists(select 1 from neo_private.connect_releases where path=p_path)
$$;
revoke all on function public.neo_connect_release_allowed(text) from public,anon,authenticated;
grant execute on function public.neo_connect_release_allowed(text) to authenticated;
create policy connect_release_download on storage.objects for select to authenticated
 using(bucket_id='neo-connect-releases' and public.neo_connect_release_allowed(name));

create function neo_private.connect_mark_uncertain() returns void
language sql set search_path=pg_catalog as $$
  with expired as (
   update neo_private.connect_tasks set state='uncertain' where state='started' and lease_until<=now()
   returning id,device_id,account_id,fence
  ) insert into neo_private.connect_audit(event,subject,device_id,account_id,fence)
   select 'uncertain',id,device_id,account_id,fence from expired;
$$;
revoke all on function neo_private.connect_mark_uncertain() from public,anon,authenticated;

create function public.neo_connect_admin(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare target uuid; account uuid; group_id_value uuid; task uuid;
begin
 if not neo_private.campaign_admin_allowed() then raise exception 'Administrador obrigatório.' using errcode='42501';end if;
 target:=(p_data->>'id')::uuid;
 if p_action='snapshot' then
  perform neo_private.connect_mark_uncertain();
  return jsonb_build_object('paused',(select paused from neo_private.connect_config),
   'devices',(select coalesce(jsonb_agg(to_jsonb(d)-'secret_hash'),'[]') from (select * from neo_private.connect_devices order by priority desc,last_seen desc nulls last limit 100)d),
   'accounts',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select * from neo_private.connect_accounts order by identity limit 100)a),
   'sessions',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select * from neo_private.connect_sessions order by last_seen desc limit 100)s),
   'groups',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from (select * from neo_private.connect_group_accounts order by group_id,priority desc limit 100)g),
   'tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select * from neo_private.connect_tasks order by occurrence desc limit 100)t),
   'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select * from neo_private.connect_audit order by id desc limit 100)a),
   'releases',(select coalesce(jsonb_agg(to_jsonb(r) order by approved_at desc),'[]') from neo_private.connect_releases r));
 elsif p_action='pause' then
  if (p_data->>'paused')::boolean is null then raise exception 'Estado obrigatório.';end if;
  update neo_private.connect_config set paused=(p_data->>'paused')::boolean;
 elsif p_action in ('approve','revoke','priority') then
  if p_action='approve' then
   update neo_private.connect_devices set state='approved' where id=target and state='pending';
  elsif p_action='revoke' then
   update neo_private.connect_devices set state='revoked' where id=target;
  else
   update neo_private.connect_devices set priority=(p_data->>'priority')::int where id=target;
  end if;
  if not found then raise exception 'Computador indisponível.';end if;
 elsif p_action='create_account' then
  insert into neo_private.connect_accounts(owner_id,identity) values(auth.uid(),p_data->>'identity') returning id into target;
 elsif p_action='disable_account' then
  update neo_private.connect_accounts set enabled=false where id=target and owner_id=auth.uid();
  if not found then raise exception 'Conta indisponível.'; end if;
 elsif p_action='associate' then
  account:=(p_data->>'account')::uuid;group_id_value:=(p_data->>'group')::uuid;
  if not exists(select 1 from neo_private.connect_accounts where id=account and enabled) then raise exception 'Conta indisponível.';end if;
  insert into neo_private.connect_group_accounts(group_id,account_id,verified,may_publish,priority)
   values(group_id_value,account,coalesce((p_data->>'verified')::boolean,false),coalesce((p_data->>'may_publish')::boolean,false),coalesce((p_data->>'priority')::int,0))
   on conflict(group_id,account_id) do update set verified=excluded.verified,may_publish=excluded.may_publish,priority=excluded.priority;
  target:=group_id_value;
 elsif p_action='queue' then
  account:=(p_data->>'account')::uuid;
  insert into neo_private.connect_tasks(publication_id,occurrence,mode,preferred_account)
   select p.id,p.scheduled_at,p_data->>'mode',account
   from neo_private.campaign_wa_publications p join neo_private.campaigns c on c.id=p.campaign_id
   join neo_private.campaign_wa_groups g on g.id=p.group_id and g.active
   join neo_private.connect_group_accounts a on a.group_id=g.id and a.account_id=account and a.verified and a.may_publish
   join neo_private.connect_accounts n on n.id=a.account_id and n.enabled
   where p.id=target and p.status='pending' and p.scheduled_at is not null and c.status='active' and c.whatsapp_enabled
   on conflict(publication_id,occurrence) do nothing returning id into task;
  if task is null then raise exception 'Ocorrência indisponível ou já enfileirada.';end if;
  target:=task;
 else raise exception 'Operação inválida.';
 end if;
 insert into neo_private.connect_audit(actor_id,event,subject) values(auth.uid(),p_action,target);
 return jsonb_build_object('id',target);
end $$;

create function neo_private.connect_candidates(t neo_private.connect_tasks)
returns table(device uuid,account uuid) language sql stable set search_path=pg_catalog as $$
 select d.id,a.id
 from neo_private.campaign_wa_publications p
 join neo_private.campaigns c on c.id=p.campaign_id and c.status='active' and c.whatsapp_enabled
 join neo_private.campaign_wa_groups g on g.id=p.group_id and g.active
 join neo_private.connect_group_accounts ga on ga.group_id=g.id and ga.verified and ga.may_publish
 join neo_private.connect_accounts a on a.id=ga.account_id and a.enabled
 join neo_private.connect_sessions s on s.account_id=a.id and s.connected and s.last_seen>now()-interval '70 seconds'
 join neo_private.connect_devices d on d.id=s.device_id and d.owner_id=a.owner_id and d.state='approved' and d.last_seen>now()-interval '70 seconds'
 where p.id=t.publication_id and p.status='pending' and p.scheduled_at=t.occurrence
  and t.occurrence<=now() and neo_private.campaign_display_state(c,now())='active'
  and (a.id=t.preferred_account or t.mode='fallback')
 order by (a.id=t.preferred_account) desc,ga.priority desc,
  case when t.mode='linked' then coalesce((select max(h.id) from neo_private.connect_audit h where h.device_id=d.id and h.event='leased'),0) else 0 end,
  d.priority desc,d.id,a.id
$$;
revoke all on function neo_private.connect_candidates(neo_private.connect_tasks) from public,anon,authenticated;

create function public.neo_connect_device(p_action text,p_device uuid,p_secret text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare d neo_private.connect_devices; t neo_private.connect_tasks; a uuid; chosen uuid; key_hash bytea; task_id uuid;
begin
 if not neo_private.campaign_admin_allowed() or p_secret is null or p_secret !~ '^[0-9a-f]{64}$'
 then raise exception 'Autorização inválida.' using errcode='42501';end if;
 key_hash:=sha256(convert_to(p_secret,'UTF8'));
 if p_action='register' then
  insert into neo_private.connect_devices(owner_id,label,secret_hash) values(auth.uid(),p_data->>'label',key_hash) returning * into d;
  insert into neo_private.connect_audit(actor_id,event,device_id) values(auth.uid(),'register',d.id);
  return jsonb_build_object('id',d.id,'state',d.state);
 end if;
 select * into d from neo_private.connect_devices where id=p_device and owner_id=auth.uid() and secret_hash=key_hash for share;
 if not found or d.state='revoked' then raise exception 'Computador não autorizado.' using errcode='42501';end if;
 if p_action='heartbeat' then
  update neo_private.connect_devices set last_seen=now(),version=left(p_data->>'version',32),
   working_set_mb=(p_data->>'working_set_mb')::int where id=d.id;
  if d.state='approved' then
   a:=(p_data->>'account')::uuid;
   update neo_private.connect_sessions set connected=false where device_id=d.id and account_id is distinct from a and connected;
   if a is not null and exists(select 1 from neo_private.connect_accounts where id=a and owner_id=auth.uid() and enabled) then
    insert into neo_private.connect_sessions(device_id,account_id,connected) values(d.id,a,true)
    on conflict(device_id,account_id) do update set connected=true,last_seen=now();
   end if;
  end if;
  return jsonb_build_object('state',d.state,'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'identity',identity))
    from neo_private.connect_accounts where owner_id=auth.uid() and enabled),'[]'));
 end if;
 if d.state<>'approved' then raise exception 'Aprovação pendente.' using errcode='42501';end if;
 if p_action='reminders' then
  return jsonb_build_object('items',public.neo_campaign_wa('reminders'));
 end if;
 if p_action='claim' then
  perform neo_private.connect_mark_uncertain();
  if (select paused from neo_private.connect_config) then return null;end if;
  select job.id,pick.account into task_id,chosen
  from neo_private.connect_tasks job
  cross join lateral (select * from neo_private.connect_candidates(job) limit 1) pick
  where (job.state='queued' or (job.state='leased' and job.lease_until<=now())) and pick.device=d.id
  order by job.occurrence,job.id limit 1 for update of job skip locked;
  if not found then return null;end if;
  update neo_private.connect_tasks set state='leased',lease_until=now()+interval '45 seconds',fence=gen_random_uuid(),device_id=d.id,account_id=chosen
   where id=task_id returning * into t;
 elsif p_action in ('start','finish') then
  select * into t from neo_private.connect_tasks where id=(p_data->>'task')::uuid and device_id=d.id
   and fence=(p_data->>'fence')::uuid and lease_until>now() for update;
  if not found then raise exception 'Lease inválido.' using errcode='42501';end if;
  if p_action='start' then
   if t.state<>'leased' or (select paused from neo_private.connect_config) or not exists(
    select 1 from neo_private.connect_candidates(t) where device=d.id and account=t.account_id)
    then raise exception 'Tarefa indisponível.' using errcode='42501';end if;
   update neo_private.connect_tasks set state='started' where id=t.id returning * into t;
  else
   if t.state<>'started' or p_data->>'outcome' not in ('simulated','uncertain') or p_data->>'outcome' is null
    then raise exception 'Resultado inválido.';end if;
   update neo_private.connect_tasks set state=p_data->>'outcome' where id=t.id returning * into t;
  end if;
 else raise exception 'Operação inválida.';
 end if;
 insert into neo_private.connect_audit(actor_id,event,subject,account_id,device_id,fence)
 values(auth.uid(),t.state,t.id,t.account_id,d.id,t.fence);
 return jsonb_build_object('id',t.id,'fence',t.fence,'account',t.account_id,'state',t.state);
end $$;
revoke all on function public.neo_connect_admin(text,jsonb),public.neo_connect_device(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.neo_connect_admin(text,jsonb),public.neo_connect_device(text,uuid,text,jsonb) to authenticated;
