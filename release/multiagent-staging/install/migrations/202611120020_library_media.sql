begin;
do $$begin if to_regprocedure('public.neo_library(text,jsonb)') is null then raise exception 'Instale antes os destaques da Biblioteca.';end if;end $$;
create table if not exists neo_private.library_uploads(path text primary key,user_id uuid references auth.users(id) on delete set null,material_id uuid references neo_private.community_materials(id) on delete cascade,name text not null check(length(name) between 1 and 120 and name !~ '[/\\[:cntrl:]]'),mime text not null check(mime in ('image/jpeg','application/pdf','text/plain')),size int not null check(size between 1 and 10485760),created_at timestamptz not null default now());
alter table neo_private.library_uploads enable row level security;
revoke all on neo_private.library_uploads from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('neo-library','neo-library',false,10485760,array['image/jpeg','application/pdf','text/plain']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.neo_library_media_access(p_path text,p_upload boolean default false) returns boolean language sql stable security definer set search_path=pg_catalog as $$select auth.uid() is not null and exists(select 1 from neo_private.library_uploads f where f.path=p_path and case when p_upload then public.neo_admin_access() and f.user_id=auth.uid() and f.material_id is null and f.created_at>now()-interval '1 hour' else (f.material_id is not null and public.neo_has_consent('terms')) or (f.user_id=auth.uid() and public.neo_admin_access()) end)$$;
drop policy if exists neo_library_media_read on storage.objects;
create policy neo_library_media_read on storage.objects for select to authenticated using(bucket_id='neo-library' and public.neo_library_media_access(name,false));
drop policy if exists neo_library_media_insert on storage.objects;
create policy neo_library_media_insert on storage.objects for insert to authenticated with check(bucket_id='neo-library' and public.neo_library_media_access(name,true));
do $$begin if to_regprocedure('public.neo_library_text(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_text;end if;end $$;
revoke all on function public.neo_library_text(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;paths jsonb;upload_row neo_private.library_uploads;v_path text;pid uuid;
begin
 if auth.uid() is null or not public.neo_has_consent('terms') then raise exception 'Entre na sua conta e conclua o cadastro.' using errcode='42501';end if;
 if p_action='reserve' then
  if not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  perform neo_private.take_limit('library_upload',60,3600);
  v_path:=auth.uid()::text||'/'||gen_random_uuid()::text||case p_payload->>'mime' when 'image/jpeg' then '.jpg' when 'application/pdf' then '.pdf' else '.txt' end;
  insert into neo_private.library_uploads(path,user_id,name,mime,size) values(v_path,auth.uid(),p_payload->>'name',p_payload->>'mime',(p_payload->>'size')::int);
  return jsonb_build_object('path',v_path);
 elsif p_action='create' then
  if not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  paths:=coalesce(p_payload->'attachments','[]');
  if jsonb_typeof(paths) is distinct from 'array' or jsonb_array_length(paths)>6 or (select count(distinct value) from jsonb_array_elements(paths))<>jsonb_array_length(paths) then raise exception 'Use até 6 anexos diferentes.';end if;
  if jsonb_array_length(paths)>0 then
   for upload_row in select * from neo_private.library_uploads where path in(select jsonb_array_elements_text(paths)) for update loop
    if upload_row.user_id<>auth.uid() or upload_row.material_id is not null or not exists(select 1 from storage.objects where bucket_id='neo-library' and name=upload_row.path) then raise exception 'Anexo inválido.';end if;
   end loop;
   if (select count(*) from neo_private.library_uploads where path in(select jsonb_array_elements_text(paths)))<>jsonb_array_length(paths) then raise exception 'Anexo inválido.';end if;
  end if;
  result:=public.neo_library_text('create',p_payload);pid:=(result->>'id')::uuid;
  update neo_private.library_uploads set material_id=pid where path in(select jsonb_array_elements_text(paths));return result;
 end if;
 result:=public.neo_library_text(p_action,p_payload);
 if p_action='read' then
  result:=result||jsonb_build_object('media_ready',true,'materials',coalesce((select jsonb_agg(m.value||jsonb_build_object('attachments',coalesce((select jsonb_agg(jsonb_build_object('path',f.path,'name',f.name,'mime',f.mime,'size',f.size) order by f.created_at,f.path) from neo_private.library_uploads f where f.material_id=(m.value->>'id')::uuid),'[]')) order by m.ordinality) from jsonb_array_elements(result->'materials') with ordinality m),'[]'));
 elsif p_action='get' and result->'material'<>'null'::jsonb then
  result:=jsonb_build_object('material',(result->'material')||jsonb_build_object('attachments',coalesce((select jsonb_agg(jsonb_build_object('path',f.path,'name',f.name,'mime',f.mime,'size',f.size)) from neo_private.library_uploads f where f.material_id=(result->'material'->>'id')::uuid),'[]')));
 end if;
 return result;
end $$;
revoke all on function public.neo_library(text,jsonb),public.neo_library_media_access(text,boolean) from public,anon;
grant execute on function public.neo_library(text,jsonb),public.neo_library_media_access(text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
