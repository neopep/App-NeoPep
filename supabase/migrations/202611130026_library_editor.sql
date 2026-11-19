-- Full administrator editing and administrator-only view counts.
begin;
do $$begin if to_regprocedure('public.neo_library_v24(text,jsonb)') is null then raise exception 'Instale antes a organização da Biblioteca (025).';end if;end $$;
alter table neo_private.community_materials add column if not exists revision bigint not null default 1;
alter table neo_private.community_materials add column if not exists updated_at timestamptz not null default now();
do $$begin if to_regprocedure('public.neo_library_v25(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_v25;end if;end $$;
revoke all on function public.neo_library_v25(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a boolean;result jsonb;pid uuid;m neo_private.community_materials;f neo_private.library_uploads;entry jsonb;files jsonb;paths text[]:='{}';path_value text;flag boolean;
begin
 if auth.uid() is null or not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=auth.uid()) then raise exception 'Entre na sua conta e conclua o cadastro.' using errcode='42501';end if;
 a:=public.neo_admin_access();
 if p_action='update' then
  if not a then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  pid:=(p_payload->>'id')::uuid;select * into m from neo_private.community_materials where id=pid for update;
  if not found then raise exception 'Material não encontrado.';end if;
  if (p_payload->>'expected_revision')::bigint is distinct from m.revision then raise exception 'Este material foi alterado por outro administrador. Reabra a edição para conferir a versão atual.';end if;
  if jsonb_typeof(p_payload->'featured') is distinct from 'boolean' then raise exception 'Destaque inválido.';end if;
  if length(btrim(coalesce(p_payload->>'title',''))) not between 1 and 120 or length(btrim(coalesce(p_payload->>'body',''))) not between 1 and 10000 then raise exception 'Confira o título e a descrição do material.';end if;
  files:=p_payload->'attachments';if jsonb_typeof(files) is distinct from 'array' or jsonb_array_length(files)>6 then raise exception 'Use no máximo 6 anexos por material.';end if;
  perform neo_private.take_limit('community_material',30,3600);
  for entry in select value from jsonb_array_elements(files) loop
   if jsonb_typeof(entry->'path') is distinct from 'string' or jsonb_typeof(entry->'allow_download') is distinct from 'boolean' then raise exception 'Anexo inválido.';end if;
   path_value:=entry->>'path';flag:=(entry->>'allow_download')::boolean;
   if path_value=any(paths) then raise exception 'Anexo duplicado.';end if;
   select * into f from neo_private.library_uploads where path=path_value for update;
   if not found or (f.material_id is distinct from pid and (f.material_id is not null or f.user_id is distinct from auth.uid())) or not exists(select 1 from storage.objects where bucket_id='neo-library' and name=path_value) then raise exception 'Anexo não pertence a este material ou ainda não foi enviado.';end if;
   paths:=array_append(paths,path_value);
  end loop;
  -- Removed files cease to be visible in the publication. Previously issued links expire normally.
  update neo_private.library_uploads set material_id=null where material_id=pid and not(path=any(paths));
  for entry in select value from jsonb_array_elements(files) loop
   update neo_private.library_uploads set material_id=pid,allow_download=(entry->>'allow_download')::boolean where path=entry->>'path';
  end loop;
  update neo_private.community_materials set title=btrim(p_payload->>'title'),body=btrim(p_payload->>'body'),url=coalesce(p_payload->>'url',''),featured=(p_payload->>'featured')::boolean,revision=revision+1,updated_at=now() where id=pid;
  return jsonb_build_object('ok',true,'id',pid,'revision',m.revision+1);
 end if;
 result:=public.neo_library_v25(p_action,p_payload);
 if p_action='read' then
  result:=result||jsonb_build_object('edit_ready',true,'can_view_counts',a,'materials',coalesce((select jsonb_agg(case when a then item.value else item.value-'view_count' end order by item.ordinality) from jsonb_array_elements(result->'materials') with ordinality item),'[]'));
 elsif p_action='get' and not a and jsonb_typeof(result->'material')='object' then
  result:=jsonb_set(result,'{material}',(result->'material')-'view_count');
 elsif p_action='view' and not a then result:=result-'view_count';
 elsif p_action in ('set_featured','attach_files','set_download') then
  if p_action='set_download' then select material_id into pid from neo_private.library_uploads where path=p_payload->>'path';else pid:=(p_payload->>'id')::uuid;end if;
  update neo_private.community_materials set revision=revision+1,updated_at=now() where id=pid;
 end if;
 return result;
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;grant execute on function public.neo_library(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
