-- Library discovery: newest-first, filtering and authenticated daily views.
begin;
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
commit;
