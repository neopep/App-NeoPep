-- NeoPeptídeos: edição completa e acessos somente para administradores.
-- Inclui 025 e 026; exige os controles de arquivos 024. Não exclui materiais.
begin;
-- 202611130025_library_discovery.sql
-- Library discovery: newest-first, filtering and authenticated daily views.
do $$begin if to_regprocedure('public.neo_library_v23(text,jsonb)') is null or not exists(select 1 from information_schema.columns where table_schema='neo_private' and table_name='library_uploads' and column_name='allow_download') then raise exception 'Instale antes os controles de arquivos da Biblioteca (024).';end if;end $$;
alter table neo_private.community_materials add column if not exists view_count bigint not null default 0 check(view_count>=0);
create table if not exists neo_private.library_visits(material_id uuid not null references neo_private.community_materials(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,view_day date not null,created_at timestamptz not null default now(),primary key(material_id,user_id,view_day));
alter table neo_private.library_visits enable row level security;
revoke all on neo_private.library_visits from public,anon,authenticated;
create index if not exists neo_library_recent on neo_private.community_materials(created_at desc,id desc);
create index if not exists neo_library_popular on neo_private.community_materials(view_count desc,created_at desc,id desc);
do $$begin if to_regprocedure('public.neo_library_v24(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_v24;end if;end $$;
revoke all on function public.neo_library_v24(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();pid uuid;v_sort text:=coalesce(p_payload->>'sort','recent');v_type text:=coalesce(p_payload->>'type','all');q text:=lower(left(btrim(coalesce(p_payload->>'search','')),100));v_featured boolean:=p_payload->'featured_only'='true'::jsonb;changed int;total bigint;
begin
 if u is null or not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=u) then raise exception 'Entre na sua conta e conclua o cadastro.' using errcode='42501';end if;
 if p_action='view' then
  pid:=(p_payload->>'id')::uuid;perform 1 from neo_private.community_materials where id=pid;if not found then raise exception 'Material não encontrado.';end if;
  perform neo_private.take_limit('library_views',120,60);
  insert into neo_private.library_visits(material_id,user_id,view_day) values(pid,u,(now() at time zone 'America/Sao_Paulo')::date) on conflict do nothing;
  get diagnostics changed=row_count;
  if changed>0 then update neo_private.community_materials set view_count=view_count+1 where id=pid;end if;
  select view_count into total from neo_private.community_materials where id=pid;
  return jsonb_build_object('id',pid,'view_count',total,'counted',changed>0);
 elsif p_action='read' then
  if v_sort not in ('recent','oldest','popular') or v_type not in ('all','pdf','text','image','video','link') then raise exception 'Filtro da Biblioteca inválido.';end if;
  return jsonb_build_object('media_ready',true,'video_ready',true,'file_controls_ready',true,'views_ready',true,'can_manage',public.neo_admin_access(),'materials',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('attachments',neo_private.library_file_list(m.id)) order by case when v_sort='popular' then m.view_count end desc,case when v_sort='oldest' then m.created_at end asc,case when v_sort<>'oldest' then m.created_at end desc,m.id desc) from(select p.* from neo_private.community_materials p where (q='' or position(q in lower(p.title||' '||p.body))>0) and (not coalesce(v_featured,false) or p.featured) and (v_type='all' or (v_type='link' and p.url<>'') or (v_type='text' and p.url='' and not exists(select 1 from neo_private.library_uploads where material_id=p.id)) or exists(select 1 from neo_private.library_uploads f where f.material_id=p.id and ((v_type='pdf' and f.mime='application/pdf') or (v_type='text' and f.mime='text/plain') or (v_type='image' and f.mime like 'image/%') or (v_type='video' and f.mime like 'video/%')))) order by case when v_sort='popular' then p.view_count end desc,case when v_sort='oldest' then p.created_at end asc,case when v_sort<>'oldest' then p.created_at end desc,p.id desc limit 100)m),'[]'));
 end if;
 return public.neo_library_v24(p_action,p_payload);
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;grant execute on function public.neo_library(text,jsonb) to authenticated;
notify pgrst,'reload schema';
-- 202611130026_library_editor.sql
-- Full administrator editing and administrator-only view counts.
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
