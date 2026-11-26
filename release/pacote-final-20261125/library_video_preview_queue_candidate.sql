-- Candidate: isolated preview queue. Never modifies original media or campaign dispatch.
begin;
set local lock_timeout='5s';
create table neo_private.library_video_preview_control(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into neo_private.library_video_preview_control default values;
create table neo_private.library_video_previews(
 id uuid primary key default gen_random_uuid(),
 source_path text not null references neo_private.library_uploads(path) on delete cascade,
 material_id uuid not null references neo_private.community_materials(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 source_object uuid not null,source_updated_at timestamptz not null,
 algorithm text not null default 'h264-480-6s-v1' check(algorithm='h264-480-6s-v1'),
 state text not null default 'pending' check(state in ('pending','processing','ready','failed')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 device_id uuid references neo_private.connect_devices(id) on delete set null,
 fence uuid, lease_until timestamptz,output_path text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(source_path,material_id,source_object,source_updated_at,algorithm)
);
create index library_video_previews_queue on neo_private.library_video_previews(owner_id,state,created_at);
alter table neo_private.library_video_previews enable row level security;
alter table neo_private.library_video_preview_control enable row level security;
revoke all on neo_private.library_video_previews,neo_private.library_video_preview_control from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('neo-library-video-previews','neo-library-video-previews',false,512000,array['video/mp4']);
-- A current source must still be attached to this material and refer to the same Storage object revision.
create function neo_private.library_video_preview_current(j neo_private.library_video_previews) returns boolean
 language sql stable security definer set search_path='' as $f$
 select exists(select 1 from neo_private.library_uploads f join storage.objects o on o.bucket_id='neo-library' and o.name=f.path
 where f.path=j.source_path and f.material_id=j.material_id and f.user_id=j.owner_id
 and f.mime in ('video/mp4','video/webm','video/quicktime') and f.size between 1 and 52428800
 and o.id=j.source_object and coalesce(o.updated_at,o.created_at)=j.source_updated_at)
$f$;
revoke all on function neo_private.library_video_preview_current(neo_private.library_video_previews) from public,anon,authenticated;
-- Reconcile on attachment and on claim; backfill only inserts metadata, no media access or processing.
create function neo_private.library_video_preview_enqueue(p_owner uuid,p_path text default null) returns void
 language sql security definer set search_path='' as $f$
 insert into neo_private.library_video_previews(source_path,material_id,owner_id,source_object,source_updated_at)
 select f.path,f.material_id,f.user_id,o.id,coalesce(o.updated_at,o.created_at)
 from neo_private.library_uploads f join storage.objects o on o.bucket_id='neo-library' and o.name=f.path
 where f.user_id=p_owner and f.material_id is not null and f.mime in ('video/mp4','video/webm','video/quicktime')
 and f.size between 1 and 52428800 and f.path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.][a-z0-9]{1,12}$'
 and (p_path is null or f.path=p_path)
 on conflict(source_path,material_id,source_object,source_updated_at,algorithm) do nothing
$f$;
revoke all on function neo_private.library_video_preview_enqueue(uuid,text) from public,anon,authenticated;
create function neo_private.library_video_preview_on_attachment() returns trigger
 language plpgsql security definer set search_path='' as $f$
 begin
 if new.material_id is not null and new.user_id is not null and new.mime like 'video/%' then
  perform neo_private.library_video_preview_enqueue(new.user_id,new.path);
 end if;return new;
 end$f$;
revoke all on function neo_private.library_video_preview_on_attachment() from public,anon,authenticated;
create trigger neo_library_video_preview_enqueue after insert or update of material_id,mime,user_id on neo_private.library_uploads
 for each row execute function neo_private.library_video_preview_on_attachment();
-- One-time metadata backfill, including videos uploaded before this migration.
do $b$ declare u uuid;begin
 for u in select distinct user_id from neo_private.library_uploads where material_id is not null and mime like 'video/%' and user_id is not null loop
  perform neo_private.library_video_preview_enqueue(u,null);
 end loop;
end$b$;
-- Output is per attempt; a stale worker cannot overwrite a ready result.
create function public.neo_library_video_preview_storage(p_path text,p_write boolean) returns boolean
 language sql stable security definer set search_path='' as $f$
 select coalesce(auth.uid() is not null and public.neo_admin_access() and exists(
 select 1 from neo_private.library_video_previews j
 where j.owner_id=auth.uid() and j.output_path=p_path
 and neo_private.library_video_preview_current(j) and public.neo_library_media_access(j.source_path,false)
 and (case when p_write then j.state='processing' and j.lease_until>now()
  and exists(select 1 from neo_private.connect_devices d where d.id=j.device_id and d.owner_id=auth.uid() and d.state='approved')
  and (select enabled from neo_private.library_video_preview_control where singleton)
 else j.state='ready' end)),false)
$f$;
revoke all on function public.neo_library_video_preview_storage(text,boolean) from public,anon;
grant execute on function public.neo_library_video_preview_storage(text,boolean) to authenticated;
create policy neo_library_video_preview_read on storage.objects for select to authenticated
 using(bucket_id='neo-library-video-previews' and (select public.neo_library_video_preview_storage(name,false)));
create policy neo_library_video_preview_write on storage.objects for insert to authenticated
 with check(bucket_id='neo-library-video-previews' and (select public.neo_library_video_preview_storage(name,true)));
-- Same authenticated device pattern as existing Connect; separate disabled-by-default capability.
create function public.neo_library_video_preview_device(p_action text,p_device uuid,p_secret text,p_data jsonb default '{}'::jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $f$
 declare actor uuid:=auth.uid(); j neo_private.library_video_previews%rowtype; f uuid; n bigint;
 begin
 if actor is null or not public.neo_admin_access()
 or p_secret is null or p_secret !~ '^[0-9a-f]{64}$'
 or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss','')<>'https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1'
 or not exists(select 1 from neo_private.connect_devices d where d.id=p_device and d.owner_id=actor and d.state='approved'
 and d.last_seen>now()-interval '90 seconds' and d.secret_hash=sha256(convert_to(p_secret,'UTF8')))
 then raise exception 'preview_device_unauthorized' using errcode='42501';end if;
 if not (select enabled from neo_private.library_video_preview_control where singleton) then return null;end if;
 if p_data->'video_preview_v1' is distinct from 'true'::jsonb then return null;end if;
 if p_action='claim' then
  perform neo_private.library_video_preview_enqueue(actor,null);
  update neo_private.library_video_previews set state='failed',lease_until=null,updated_at=now()
   where owner_id=actor and state='processing' and lease_until<=now() and attempts>=3;
  select * into j from neo_private.library_video_previews q where q.owner_id=actor and q.attempts<3
   and (q.state='pending' or(q.state='processing' and q.lease_until<=now()))
   and neo_private.library_video_preview_current(q) and public.neo_library_media_access(q.source_path,false)
   order by q.created_at,q.id limit 1 for update skip locked;
  if not found then return null;end if;
  f:=gen_random_uuid();
  update neo_private.library_video_previews set state='processing',attempts=attempts+1,device_id=p_device,fence=f,lease_until=now()+interval '15 minutes',
   output_path=actor::text||'/'||j.id::text||'/'||f::text||'.mp4',updated_at=now() where id=j.id returning * into j;
  return jsonb_build_object('id',j.id,'fence',j.fence,'source_path',j.source_path,'output_path',j.output_path);
 elsif p_action in ('finish','fail') then
  select * into j from neo_private.library_video_previews q where q.id=(p_data->>'id')::uuid and q.fence=(p_data->>'fence')::uuid
   and q.owner_id=actor and q.device_id=p_device and q.state='processing' and q.lease_until>now()
   and neo_private.library_video_preview_current(q) and public.neo_library_media_access(q.source_path,false) for update;
  if not found then raise exception 'preview_lease_invalid' using errcode='42501';end if;
  if p_action='finish' then
   select case when (o.metadata->>'size') ~ '^[0-9]{1,9}$' then (o.metadata->>'size')::bigint else 0 end into n
   from storage.objects o where o.bucket_id='neo-library-video-previews' and o.name=j.output_path and o.metadata->>'mimetype'='video/mp4';
   if coalesce(n,0) not between 1 and 512000 then raise exception 'preview_output_invalid';end if;
   update neo_private.library_video_previews set state='ready',lease_until=null,updated_at=now() where id=j.id;
  else
   update neo_private.library_video_previews set state=case when attempts>=3 then 'failed' else 'pending' end,lease_until=null,updated_at=now() where id=j.id;
  end if;
  return jsonb_build_object('id',j.id,'state',case when p_action='finish' then 'ready' when j.attempts>=3 then 'failed' else 'pending' end);
 else raise exception 'preview_action_invalid';end if;
 end$f$;
revoke all on function public.neo_library_video_preview_device(text,uuid,text,jsonb) from public,anon;
grant execute on function public.neo_library_video_preview_device(text,uuid,text,jsonb) to authenticated;
-- Owner-only status; no original path, credentials or signed URL returned.
create function public.neo_library_video_preview_status(p_material uuid,p_source_path text) returns jsonb
 language sql stable security definer set search_path='' as $f$
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'state',j.state,'output_path',case when j.state='ready' then j.output_path end) order by j.created_at),'[]'::jsonb)
 from neo_private.library_video_previews j where auth.uid() is not null and public.neo_admin_access()
 and j.owner_id=auth.uid() and j.material_id=p_material and j.source_path=p_source_path and neo_private.library_video_preview_current(j)
 and public.neo_library_media_access(j.source_path,false)
$f$;
revoke all on function public.neo_library_video_preview_status(uuid,text) from public,anon;
grant execute on function public.neo_library_video_preview_status(uuid,text) to authenticated;
commit;
