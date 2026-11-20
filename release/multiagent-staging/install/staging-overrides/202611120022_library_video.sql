-- Only for neopep-staging (qnuluspqfazdppciermw).
begin;
alter table neo_private.library_uploads drop constraint if exists library_uploads_mime_check;
alter table neo_private.library_uploads drop constraint if exists library_uploads_size_check;
alter table neo_private.library_uploads drop constraint if exists library_uploads_media_check;
alter table neo_private.library_uploads add constraint library_uploads_media_check check(mime in ('image/jpeg','application/pdf','text/plain','video/mp4','video/webm','video/quicktime') and size between 1 and case when mime like 'video/%' then 52428800 else 10485760 end);
update storage.buckets set public=false,file_size_limit=52428800,allowed_mime_types=array['image/jpeg','application/pdf','text/plain','video/mp4','video/webm','video/quicktime'] where id='neo-library';
do $$begin if to_regprocedure('public.neo_library_media_v21(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_media_v21;end if;end $$;
revoke all on function public.neo_library_media_v21(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;v_path text;
begin
 if auth.uid() is null or not public.neo_has_consent('terms') then raise exception 'Entre na sua conta e conclua o cadastro.' using errcode='42501';end if;
 if p_action='reserve' and p_payload->>'mime' like 'video/%' then
  if not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  perform neo_private.take_limit('library_upload',60,3600);
  v_path:=auth.uid()::text||'/'||gen_random_uuid()::text||case p_payload->>'mime' when 'video/mp4' then '.mp4' when 'video/webm' then '.webm' when 'video/quicktime' then '.mov' else '.invalid' end;
  insert into neo_private.library_uploads(path,user_id,name,mime,size) values(v_path,auth.uid(),p_payload->>'name',p_payload->>'mime',(p_payload->>'size')::int);
  return jsonb_build_object('path',v_path);
 end if;
 result:=public.neo_library_media_v21(p_action,p_payload);
 if p_action='read' then result:=result||jsonb_build_object('video_ready',true);end if;
 return result;
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;
grant execute on function public.neo_library(text,jsonb) to authenticated;
-- Staging: community push defaults to off.
alter table neo_private.community_preferences alter column push_enabled set default false;
insert into neo_private.community_preferences(user_id,push_enabled,activated_after) select user_id,false,(select coalesce(max(published_seq),0) from neo_private.community_posts) from neo_private.community_members on conflict(user_id) do nothing;
notify pgrst,'reload schema';
commit;
