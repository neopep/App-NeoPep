-- Candidate: respect the contracted Storage limit. No bucket/global setting or plan change.
begin;
set local lock_timeout='5s';
do $guard$ begin
 if not exists(select 1 from storage.buckets where id='neo-library' and not public and file_size_limit>0) then raise exception 'library_bucket_contract_changed';end if;
 if not exists(select 1 from pg_constraint where conrelid='neo_private.library_uploads'::regclass and conname='library_uploads_media_check' and pg_get_constraintdef(oid) like '%52428800%' and pg_get_constraintdef(oid) like '%10485760%') then raise exception 'library_upload_limit_contract_changed';end if;
end$guard$;
alter table neo_private.library_uploads drop constraint library_uploads_media_check;
alter table neo_private.library_uploads add constraint library_uploads_media_check check(
 mime in ('image/jpeg','application/pdf','text/plain','video/mp4','video/webm','video/quicktime')
 and size between 1 and case when mime in ('application/pdf','video/mp4','video/webm','video/quicktime') then 209715200 else 10485760 end
) not valid;
alter table neo_private.library_uploads validate constraint library_uploads_media_check;
create function neo_private.library_upload_limits() returns jsonb
language sql stable security definer set search_path='' as $f$
 select jsonb_build_object('video',least(209715200,cap),'pdf',least(209715200,cap),'image',least(10485760,cap),'text',least(10485760,cap))
 from (select coalesce((select greatest(0,file_size_limit) from storage.buckets where id='neo-library' and not public),0) cap) s
$f$;
revoke all on function neo_private.library_upload_limits() from public,anon,authenticated;
create function public.neo_library_upload_limits_v1() returns jsonb
language plpgsql stable security definer set search_path='' as $f$
begin
 if auth.uid() is null or not public.neo_admin_access() then raise exception 'library_upload_unauthorized' using errcode='42501';end if;
 return neo_private.library_upload_limits();
end$f$;
revoke all on function public.neo_library_upload_limits_v1() from public,anon;
grant execute on function public.neo_library_upload_limits_v1() to authenticated;
create function neo_private.library_upload_limit_guard() returns trigger
language plpgsql security definer set search_path='' as $f$
declare cap bigint; k text;
begin
 if tg_op='UPDATE' then if new.size=old.size and new.mime=old.mime then return new;end if;end if;
 k:=case when new.mime like 'video/%' then 'video' when new.mime='application/pdf' then 'pdf' when new.mime='text/plain' then 'text' else 'image' end;
 cap:=(neo_private.library_upload_limits()->>k)::bigint;
 if new.size is null or new.size<1 or new.size>cap then raise exception 'library_file_above_current_limit' using errcode='22023';end if;
 return new;
end$f$;
revoke all on function neo_private.library_upload_limit_guard() from public,anon,authenticated;
create trigger neo_library_upload_limit_guard before insert or update of size,mime on neo_private.library_uploads
for each row execute function neo_private.library_upload_limit_guard();
commit;
