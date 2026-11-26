-- Apply only after the queue base migration. Does not change bucket size or enable worker.
begin;
set local lock_timeout='5s';
do $guard$ begin
 if (select enabled from neo_private.library_video_preview_control where singleton) is distinct from false or exists(select 1 from neo_private.library_video_previews where state='processing') then raise exception 'preview_worker_must_be_inactive';end if;
end$guard$;
create or replace function neo_private.library_video_preview_current(j neo_private.library_video_previews) returns boolean
 language sql stable security definer set search_path='' as $f$
 select exists(select 1 from neo_private.library_uploads f join storage.objects o on o.bucket_id='neo-library' and o.name=f.path
 where f.path=j.source_path and f.material_id=j.material_id and f.user_id=j.owner_id
 and f.mime in ('video/mp4','video/webm','video/quicktime') and f.size between 1 and 209715200
 and o.id=j.source_object and coalesce(o.updated_at,o.created_at)=j.source_updated_at)
$f$;
create or replace function neo_private.library_video_preview_enqueue(p_owner uuid,p_path text default null) returns void
 language sql security definer set search_path='' as $f$
 insert into neo_private.library_video_previews(source_path,material_id,owner_id,source_object,source_updated_at)
 select f.path,f.material_id,f.user_id,o.id,coalesce(o.updated_at,o.created_at)
 from neo_private.library_uploads f join storage.objects o on o.bucket_id='neo-library' and o.name=f.path
 where f.user_id=p_owner and f.material_id is not null and f.mime in ('video/mp4','video/webm','video/quicktime')
 and f.size between 1 and 209715200 and f.path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.][a-z0-9]{1,12}$'
 and (p_path is null or f.path=p_path)
 on conflict(source_path,material_id,source_object,source_updated_at,algorithm) do nothing
$f$;
create or replace function public.neo_library_video_preview_device(p_action text,p_device uuid,p_secret text,p_data jsonb default '{}'::jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $f$
 declare actor uuid:=auth.uid(); j neo_private.library_video_previews%rowtype; f uuid; n bigint;
 begin
 if actor is null or not public.neo_admin_access()
 or p_secret is null or p_secret !~ '^[0-9a-f]{64}$'
 or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss','')<>'https://qnuluspqfazdppciermw.supabase.co/auth/v1'
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
  update neo_private.library_video_previews set state='processing',attempts=attempts+1,device_id=p_device,fence=f,lease_until=now()+interval '25 minutes',
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
commit;
