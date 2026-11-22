alter table neo_private.connect_releases
 add column distribution_state text not null default 'legacy' check(distribution_state in ('legacy','draft','approved','blocked')),
 add column profile text not null default 'staging' check(profile='staging'),
 add column channel text not null default 'stable' check(channel='stable'),
 add column artifact text check(artifact ~ '^[A-Za-z0-9._-]{1,120}$'),
 add column release_signature text check(length(release_signature) between 344 and 1024 and release_signature ~ '^[A-Za-z0-9+/]+={0,2}$'),
 add column notes text not null default '' check(length(notes)<=4000),
 add column required boolean not null default false,
 add constraint connect_approved_signed check(distribution_state<>'approved' or (artifact is not null and release_signature is not null));
create index connect_update_release_idx on neo_private.connect_releases(distribution_state,profile,channel);

create or replace function public.neo_connect_release_allowed(p_path text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select neo_private.campaign_admin_allowed() and exists(
  select 1 from neo_private.connect_releases where path=p_path and distribution_state in ('approved','legacy')
 )
$$;

create table neo_private.connect_update_events(
 id bigint generated always as identity primary key,
 device_id uuid not null references neo_private.connect_devices(id) on delete cascade,
 version text not null check(version ~ '^[0-9]{1,8}[.][0-9]{1,8}[.][0-9]{1,8}$'),
 outcome text not null check(outcome in ('installed','failed','rollback')),
 created_at timestamptz not null default now()
);
alter table neo_private.connect_update_events enable row level security;
revoke all on neo_private.connect_update_events from public,anon,authenticated;
create index connect_update_events_device_idx on neo_private.connect_update_events(device_id,created_at desc);

create function public.neo_connect_update(p_action text,p_device uuid,p_secret text,p_version text default null,p_outcome text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if auth.uid() is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$' or not exists(
  select 1 from neo_private.connect_devices d where d.id=p_device and d.owner_id=auth.uid() and d.state='approved'
   and d.secret_hash=sha256(convert_to(p_secret,'UTF8'))
 ) then raise exception 'Computador não autorizado.' using errcode='42501';end if;
 if p_action='report' and p_outcome in ('installed','failed','rollback') then
  insert into neo_private.connect_update_events(device_id,version,outcome) values(p_device,p_version,p_outcome);
  return jsonb_build_object('ok',true);
 end if;
 if p_action not in ('check','download') or p_action is null then raise exception 'Operação inválida.';end if;
 select jsonb_build_object('version',r.version,'profile',r.profile,'channel',r.channel,'bytes',r.bytes,
  'sha256',r.sha256,'artifact',r.artifact,'signature',r.release_signature,'notes',r.notes,'required',r.required,'path',r.path)
 into result from neo_private.connect_releases r
 where r.distribution_state='approved' and r.profile='staging' and r.channel='stable'
 and (p_action='check' or r.version=p_version)
 order by string_to_array(r.version,'.')::int[] desc limit 1;
 return result;
end $$;

create function public.neo_connect_update_admin(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v text:=p_data->>'version';
begin
 if not neo_private.campaign_admin_allowed() then raise exception 'Administrador obrigatório.' using errcode='42501';end if;
 if p_action='list' then
  return jsonb_build_object('releases',(select coalesce(jsonb_agg(to_jsonb(r) order by r.approved_at desc),'[]') from neo_private.connect_releases r),
   'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') from (
    select * from neo_private.connect_update_events order by created_at desc,id desc limit 100
   ) e));
 elsif p_action='register' then
  if v is null or v !~ '^[0-9]{1,8}[.][0-9]{1,8}[.][0-9]{1,8}$' then raise exception 'Versão inválida.';end if;
  if nullif(p_data->>'artifact','') is null or nullif(p_data->>'signature','') is null then raise exception 'Artefato e assinatura obrigatórios.';end if;
  insert into neo_private.connect_releases(version,path,sha256,bytes,artifact,release_signature,notes,distribution_state)
  values(v,v||'/NeoPepConnectSetup.exe',p_data->>'sha256',(p_data->>'bytes')::bigint,p_data->>'artifact',p_data->>'signature',coalesce(p_data->>'notes',''),'draft');
 elsif p_action='approve' then
  update neo_private.connect_releases r set distribution_state='approved',approved_at=now(),required=coalesce((p_data->>'required')::boolean,false)
  where r.version=v and r.artifact is not null and r.release_signature is not null and exists(
   select 1 from storage.objects o where o.bucket_id='neo-connect-releases' and o.name=r.path
   and o.metadata->>'size'=r.bytes::text
  );
  if not found then raise exception 'Confira o objeto privado, tamanho e manifesto assinado.';end if;
 elsif p_action='block' then
  update neo_private.connect_releases set distribution_state='blocked',required=false where version=v;
  if not found then raise exception 'Versão inexistente.';end if;
 else raise exception 'Operação inválida.';
 end if;
 insert into neo_private.connect_audit(actor_id,event) values(auth.uid(),'update_'||p_action);
 return jsonb_build_object('ok',true);
end $$;

revoke all on function public.neo_connect_update(text,uuid,text,text,text),public.neo_connect_update_admin(text,jsonb) from public,anon,authenticated;
grant execute on function public.neo_connect_update(text,uuid,text,text,text),public.neo_connect_update_admin(text,jsonb) to authenticated;
