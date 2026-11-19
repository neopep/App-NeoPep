-- Private document attachments and a precise prior-read marker. Requires 005/007.
begin;
do $check$ begin if to_regclass('neo_private.community_preferences') is null or to_regprocedure('public.neo_community_chat(text,jsonb)') is null then raise exception 'Execute antes as atualizações da conversa (005) e dos avisos (007).';end if;end $check$;
create table if not exists neo_private.community_files(path text primary key,user_id uuid not null references auth.users(id) on delete cascade,post_id uuid unique references neo_private.community_posts(id) on delete cascade,name text not null check(length(name) between 1 and 120 and name !~ '[/\\[:cntrl:]]'),mime text not null check(mime in ('application/pdf','text/plain')),size int not null check(size between 1 and 5242880),created_at timestamptz not null default now());
alter table neo_private.community_files enable row level security;
revoke all on neo_private.community_files from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('neo-community-files','neo-community-files',false,5242880,array['application/pdf','text/plain']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.neo_community_file(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();f neo_private.community_files;v_path text;pid uuid;result jsonb;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 if p_action='live_paths' then return coalesce((select jsonb_agg(path) from neo_private.community_files where user_id=u and post_id is not null),'[]'::jsonb);end if;
 if not exists(select 1 from neo_private.community_members where user_id=u) then raise exception 'community membership required';end if;
 if p_action='reserve' then
  if p_payload->>'share' is distinct from 'on' then raise exception 'file sharing consent required';end if;
  perform neo_private.take_limit('community_file',20,3600);
  v_path:=u::text||'/'||gen_random_uuid()::text||case when p_payload->>'mime'='application/pdf' then '.pdf' else '.txt' end;
  insert into neo_private.community_files(path,user_id,name,mime,size) values(v_path,u,p_payload->>'name',p_payload->>'mime',(p_payload->>'size')::int);
  return jsonb_build_object('path',v_path);
 elsif p_action='post' then
  pid:=(p_payload->>'id')::uuid;
  select * into f from neo_private.community_files where path=p_payload->>'file_path' and user_id=u for update;
  if not found or pid is null or (f.post_id is not null and f.post_id<>pid) then raise exception 'invalid file attachment';end if;
  if not exists(select 1 from storage.objects where bucket_id='neo-community-files' and name=f.path) then raise exception 'file upload not confirmed';end if;
  result:=public.neo_community_chat('post',case when btrim(coalesce(p_payload->>'body',''))='' and nullif(p_payload->'snapshot','null'::jsonb) is null and nullif(p_payload->>'photo_path','') is null then p_payload||'{"body":"Arquivo compartilhado"}'::jsonb else p_payload end);
  update neo_private.community_files set post_id=pid where path=f.path;
  return result;
 else raise exception 'invalid file action';end if;
end $$;
create or replace function public.neo_community_file_access(p_path text,p_upload boolean default false) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and exists(select 1 from neo_private.community_files f left join neo_private.community_posts p on p.id=f.post_id where f.path=p_path and (
  (f.user_id=auth.uid() and (not p_upload or (f.post_id is null and f.created_at>now()-interval '1 hour' and exists(select 1 from neo_private.community_members where user_id=auth.uid()))))
  or (not p_upload and f.post_id is not null and (public.neo_admin_access() or (p.status='published' and exists(select 1 from neo_private.community_members where user_id=auth.uid()))))))
$$;
drop policy if exists neo_community_file_read on storage.objects;
create policy neo_community_file_read on storage.objects for select to authenticated using(bucket_id='neo-community-files' and (split_part(name,'/',1)=auth.uid()::text or public.neo_community_file_access(name,false)));
drop policy if exists neo_community_file_insert on storage.objects;
create policy neo_community_file_insert on storage.objects for insert to authenticated with check(bucket_id='neo-community-files' and public.neo_community_file_access(name,true));
drop policy if exists neo_community_file_delete on storage.objects;
create policy neo_community_file_delete on storage.objects for delete to authenticated using(bucket_id='neo-community-files' and split_part(name,'/',1)=auth.uid()::text);
create or replace function public.neo_community_inbox_v2() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();feed jsonb;seen bigint;section text;enriched jsonb;item jsonb;extra jsonb;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 select last_seen into seen from neo_private.community_preferences where user_id=u;
 feed:=public.neo_community_inbox();
 foreach section in array array['posts','pending'] loop
  enriched:='[]';
  for item in select value from jsonb_array_elements(coalesce(feed->section,'[]'::jsonb)) loop
   select jsonb_build_object('published_seq',p.published_seq,'file',case when f.path is null then null else jsonb_build_object('path',f.path,'name',f.name,'mime',f.mime,'size',f.size) end) into extra from neo_private.community_posts p left join neo_private.community_files f on f.post_id=p.id where p.id=(item->>'id')::uuid;
   enriched:=enriched||jsonb_build_array(item||extra);
  end loop;
  feed:=jsonb_set(feed,array[section],enriched);
 end loop;
 return feed||jsonb_build_object('files_ready',true,'read_through',coalesce(seen,0));
end $$;
revoke all on function public.neo_community_file(text,jsonb),public.neo_community_file_access(text,boolean),public.neo_community_inbox_v2() from public,anon;
grant execute on function public.neo_community_file(text,jsonb),public.neo_community_file_access(text,boolean),public.neo_community_inbox_v2() to authenticated;
commit;
