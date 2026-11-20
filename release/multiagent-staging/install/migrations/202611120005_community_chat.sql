-- Additive chat attachments. Existing posts and moderation remain intact.
begin;
alter table neo_private.community_posts add column if not exists snapshot jsonb;
alter table neo_private.community_posts add column if not exists photo_path text;
alter table neo_private.community_posts drop constraint if exists community_posts_body_check;
alter table neo_private.community_posts add constraint community_posts_body_check check(length(body) between 1 and 2000);
create table if not exists neo_private.community_uploads(path text primary key,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table neo_private.community_uploads enable row level security;
revoke all on neo_private.community_uploads from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('neo-community','neo-community',false,5242880,array['image/jpeg']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function neo_private.community_snapshot(u uuid,fields jsonb) returns jsonb language plpgsql stable set search_path=pg_catalog as $$
declare p jsonb; current_weight numeric; initial_weight numeric; first_day date; result jsonb; f text;
begin
 if jsonb_typeof(fields) is distinct from 'array' or jsonb_array_length(fields)<1 or jsonb_array_length(fields)>4 then raise exception 'choose summary fields';end if;
 if not exists(select 1 from public.neo_consents where user_id=u and purpose='health' and granted) then raise exception 'health consent required';end if;
 select data->'profile' into p from public.neo_profiles where user_id=u;
 select (data->>'value')::numeric into current_weight from public.neo_records where user_id=u and kind='weights' order by data->>'date' desc,id desc limit 1;
 select min((data->>'date')::date) into first_day from public.neo_records where user_id=u and kind='weights';
 initial_weight:=(p->>'initialWeight')::numeric;
 result:=jsonb_build_object('as_of',current_date);
 for f in select jsonb_array_elements_text(fields) loop
  if f='change' then result:=result||jsonb_build_object('change_kg',case when current_weight is not null and initial_weight is not null then round(current_weight-initial_weight,2) else null end);
  elsif f='current' then result:=result||jsonb_build_object('current_kg',current_weight);
  elsif f='goal' then result:=result||jsonb_build_object('goal_kg',(p->>'goal')::numeric);
  elsif f='days' then result:=result||jsonb_build_object('days',case when first_day is not null then greatest(1,current_date-first_day+1) else null end);
  else raise exception 'invalid summary field';end if;
 end loop;
 return result;
end $$;
revoke all on function neo_private.community_snapshot(uuid,jsonb) from public,anon,authenticated;
create or replace function public.neo_community_chat(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); a boolean; result jsonb; section text; enriched jsonb; item jsonb; r record; pid uuid; upload_path text; s jsonb; b text; previous neo_private.community_posts;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 if p_action='attachments' then return coalesce((select jsonb_agg(photo_path) from neo_private.community_posts where user_id=u and photo_path is not null),'[]'::jsonb);end if;
 if not exists(select 1 from neo_private.community_members where user_id=u) then
  if p_action='read' then return jsonb_build_object('member',false,'chat_ready',true);end if;
  raise exception 'community membership required' using errcode='42501';
 end if;
 a:=public.neo_admin_access();
 if p_action='read' then
  result:=public.neo_community('read');
  foreach section in array array['posts','pending'] loop
   enriched:='[]';
   for item in select value from jsonb_array_elements(result->section) loop
    select snapshot,photo_path into r from neo_private.community_posts where id=(item->>'id')::uuid;
    enriched:=enriched||jsonb_build_array(item||jsonb_build_object('snapshot',r.snapshot,'photo_path',r.photo_path));
   end loop;
   result:=jsonb_set(result,array[section],enriched);
  end loop;
  return result||'{"chat_ready":true}'::jsonb;
 elsif p_action='preview' then return neo_private.community_snapshot(u,p_payload->'fields');
 elsif p_action='reserve_photo' then
  if p_payload->>'photo_share' is distinct from 'on' then raise exception 'photo sharing consent required';end if;
  perform neo_private.take_limit('community_photo',20,3600);
  upload_path:=u::text||'/'||gen_random_uuid()::text||'.jpg';
  insert into neo_private.community_uploads(path,user_id) values(upload_path,u);
  return jsonb_build_object('path',upload_path);
 elsif p_action='post' then
  if p_payload->>'share' is distinct from 'on' then raise exception 'publication consent required';end if;
  pid:=(p_payload->>'id')::uuid;if pid is null then raise exception 'message id required';end if;
  upload_path:=nullif(p_payload->>'photo_path','');s:=nullif(p_payload->'snapshot','null'::jsonb);
  b:=trim(coalesce(p_payload->>'body',''));
  if s is not null then
   if p_payload->>'summary_share' is distinct from 'on' then raise exception 'summary sharing consent required';end if;
   if s<>neo_private.community_snapshot(u,p_payload->'fields') then raise exception 'summary changed; refresh preview before sending';end if;
  end if;
  if upload_path is not null then
   if p_payload->>'photo_share' is distinct from 'on' then raise exception 'photo sharing consent required';end if;
   if not exists(select 1 from neo_private.community_uploads v join storage.objects o on o.name=v.path and o.bucket_id='neo-community' where v.path=upload_path and v.user_id=u) then raise exception 'invalid community photo';end if;
  end if;
  if b='' then b:=case when s is not null then 'Meu resumo de evolução' when upload_path is not null then 'Foto compartilhada' else '' end;end if;
  -- Stable ID makes retry after lost response safe without overwriting a message.
  select * into previous from neo_private.community_posts where id=pid;
  if found then
   if previous.user_id=u and previous.body=b and previous.snapshot is not distinct from s and previous.photo_path is not distinct from upload_path then return jsonb_build_object('ok',true,'id',pid);end if;
   raise exception 'message conflict';
  end if;
  perform neo_private.take_limit('community_post',10,3600);
  insert into neo_private.community_posts(id,user_id,body,snapshot,photo_path) values(pid,u,b,s,upload_path);
  return jsonb_build_object('ok',true,'id',pid);
 else raise exception 'invalid chat action';end if;
end $$;
revoke all on function public.neo_community_chat(text,jsonb) from public,anon;
grant execute on function public.neo_community_chat(text,jsonb) to authenticated;
-- Policies are explicitly limited to this bucket; private health photos are unchanged.
create or replace function public.neo_community_photo_access(p_path text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and (
  split_part(p_path,'/',1)=auth.uid()::text or
  exists(select 1 from neo_private.community_posts p where p.photo_path=p_path and (public.neo_admin_access() or (p.status='published' and exists(select 1 from neo_private.community_members where user_id=auth.uid()))))
 )
$$;
revoke all on function public.neo_community_photo_access(text) from public,anon;
grant execute on function public.neo_community_photo_access(text) to authenticated;
drop policy if exists neo_community_photo_read on storage.objects;
create policy neo_community_photo_read on storage.objects for select to authenticated using(bucket_id='neo-community' and public.neo_community_photo_access(name));
create or replace function public.neo_community_photo_upload(p_path text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from neo_private.community_uploads v join neo_private.community_members m on m.user_id=v.user_id where v.path=p_path and v.user_id=auth.uid() and v.created_at>now()-interval '1 hour')
$$;
revoke all on function public.neo_community_photo_upload(text) from public,anon;
grant execute on function public.neo_community_photo_upload(text) to authenticated;
drop policy if exists neo_community_photo_insert on storage.objects;
create policy neo_community_photo_insert on storage.objects for insert to authenticated with check(bucket_id='neo-community' and public.neo_community_photo_upload(name));
drop policy if exists neo_community_photo_delete on storage.objects;
create policy neo_community_photo_delete on storage.objects for delete to authenticated using(bucket_id='neo-community' and split_part(name,'/',1)=auth.uid()::text);
commit;
