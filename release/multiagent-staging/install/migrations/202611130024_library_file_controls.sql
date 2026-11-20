-- Additive file controls. Existing materials and attachments remain intact.
begin;
do $$begin if to_regclass('neo_private.library_uploads') is null or to_regprocedure('public.neo_library_media_v21(text,jsonb)') is null then raise exception 'Instale antes a atualização de anexos da Biblioteca (020 a 022).';end if;end $$;
alter table neo_private.library_uploads add column if not exists allow_download boolean not null default true;
do $$begin if to_regprocedure('public.neo_library_v23(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_v23;end if;end $$;
revoke all on function public.neo_library_v23(text,jsonb) from public,anon,authenticated;
create or replace function neo_private.library_file_list(p_material uuid) returns jsonb language sql stable set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('path',path,'name',name,'mime',mime,'size',size,'allow_download',allow_download) order by created_at,path),'[]') from neo_private.library_uploads where material_id=p_material
$$;
revoke all on function neo_private.library_file_list(uuid) from public,anon,authenticated;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;files jsonb;paths jsonb:='[]';item jsonb;path_value text;flag boolean;pid uuid;f neo_private.library_uploads;seen text[]:='{}';n int;
begin
 if auth.uid() is null or not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=auth.uid()) then raise exception 'Entre na sua conta e conclua o cadastro.' using errcode='42501';end if;
 if p_action='read' then
  return jsonb_build_object('media_ready',true,'video_ready',true,'file_controls_ready',true,'can_manage',public.neo_admin_access(),'materials',coalesce((select jsonb_agg(m.value||jsonb_build_object('attachments',neo_private.library_file_list((m.value->>'id')::uuid)) order by m.featured desc,m.created_at desc,m.id) from(select to_jsonb(p) value,p.featured,p.created_at,p.id from neo_private.community_materials p order by p.featured desc,p.created_at desc,p.id limit 100)m),'[]'));
 elsif p_action='get' then
  pid:=(p_payload->>'id')::uuid;return jsonb_build_object('material',(select to_jsonb(m)||jsonb_build_object('attachments',neo_private.library_file_list(m.id)) from neo_private.community_materials m where m.id=pid));
 elsif p_action='media_access' then
  path_value:=p_payload->>'path';select * into f from neo_private.library_uploads where path=path_value;
  if not found or not public.neo_library_media_access(path_value,false) then raise exception 'Anexo indisponível.' using errcode='42501';end if;
  if p_payload->'download'='true'::jsonb and not f.allow_download then raise exception 'O administrador não disponibilizou o download deste arquivo.' using errcode='42501';end if;
  return jsonb_build_object('path',f.path,'name',f.name,'mime',f.mime,'size',f.size,'allow_download',f.allow_download);
 end if;
 if p_action in ('set_download','attach_files','create','reserve') then
  if not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  if p_action='set_download' then
   if jsonb_typeof(p_payload->'allow_download') is distinct from 'boolean' then raise exception 'Informe se o download é permitido.';end if;
   perform neo_private.take_limit('library_controls',120,3600);
   update neo_private.library_uploads set allow_download=(p_payload->>'allow_download')::boolean where path=p_payload->>'path' and (material_id is not null or user_id=auth.uid());
   if not found then raise exception 'Anexo não encontrado.';end if;return '{"ok":true}';
  elsif p_action='reserve' then
   if p_payload?'allow_download' and jsonb_typeof(p_payload->'allow_download') is distinct from 'boolean' then raise exception 'Permissão de download inválida.';end if;
   result:=public.neo_library_v23(p_action,p_payload);update neo_private.library_uploads set allow_download=coalesce((p_payload->>'allow_download')::boolean,true) where path=result->>'path';return result;
  end if;
  files:=coalesce(p_payload->'attachments','[]');if jsonb_typeof(files) is distinct from 'array' or jsonb_array_length(files)>6 then raise exception 'Use até 6 anexos.';end if;
  if p_action='attach_files' then
   pid:=(p_payload->>'id')::uuid;perform 1 from neo_private.community_materials where id=pid for update;if not found then raise exception 'Material não encontrado.';end if;
   select count(*) into n from neo_private.library_uploads where material_id=pid;
   if n+jsonb_array_length(files)>6 or jsonb_array_length(files)=0 then raise exception 'O material deve ter no máximo 6 anexos. Selecione pelo menos um arquivo.';end if;
   perform neo_private.take_limit('community_material',30,3600);
  end if;
  for item in select value from jsonb_array_elements(files) loop
   if jsonb_typeof(item)='string' then path_value:=item#>>'{}';flag:=true;
   elsif jsonb_typeof(item)='object' and jsonb_typeof(item->'path')='string' and jsonb_typeof(item->'allow_download')='boolean' then path_value:=item->>'path';flag:=(item->>'allow_download')::boolean;
   else raise exception 'Anexo inválido.';end if;
   if path_value=any(seen) then raise exception 'Anexo duplicado.';end if;seen:=array_append(seen,path_value);
   select * into f from neo_private.library_uploads where path=path_value for update;
   if not found or f.user_id is distinct from auth.uid() or f.material_id is not null or not exists(select 1 from storage.objects where bucket_id='neo-library' and name=path_value) then raise exception 'Anexo inválido, ainda não enviado ou indisponível. Envie novamente.';end if;
   paths:=paths||jsonb_build_array(path_value);update neo_private.library_uploads set allow_download=flag where path=path_value;
  end loop;
  if p_action='create' then result:=public.neo_library_v23('create',p_payload||jsonb_build_object('attachments',paths));pid:=(result->>'id')::uuid;
  else update neo_private.library_uploads set material_id=pid where path=any(seen);result:=jsonb_build_object('ok',true,'id',pid);end if;
  return result;
 end if;
 return public.neo_library_v23(p_action,p_payload);
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;grant execute on function public.neo_library(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
