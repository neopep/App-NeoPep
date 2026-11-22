-- Library highlights: independent of the shop update; no personal records copied.
begin;
do $$begin if to_regclass('neo_private.community_materials') is null then raise exception 'Instale antes a configuração da comunidade.';end if;end $$;
alter table neo_private.community_materials add column if not exists featured boolean not null default false;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();pid uuid;flag boolean;
begin
 if u is null then raise exception 'Entre na sua conta para acessar a biblioteca.' using errcode='42501';end if;
 if not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=u) then raise exception 'Conclua seu cadastro antes de acessar a biblioteca.' using errcode='42501';end if;
 if p_action='featured' then
  return jsonb_build_object('materials',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id) from(select id,title,left(body,180) as excerpt,url<>'' as has_link,created_at from neo_private.community_materials where featured order by created_at desc,id limit 12)m),'[]'));
 elsif p_action='read' then
  return jsonb_build_object('materials',coalesce((select jsonb_agg(to_jsonb(m) order by m.featured desc,m.created_at desc,m.id) from(select id,title,body,url,featured,created_at from neo_private.community_materials order by featured desc,created_at desc,id limit 100)m),'[]'),'can_manage',public.neo_admin_access());
 elsif p_action='get' then
  return jsonb_build_object('material',(select to_jsonb(m) from neo_private.community_materials m where id=(p_payload->>'id')::uuid));
 end if;
 if not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
 if p_action not in ('create','set_featured') then raise exception 'Operação da biblioteca inválida.';end if;
 perform neo_private.take_limit('community_material',30,3600);
 if jsonb_typeof(p_payload->'featured') is distinct from 'boolean' then raise exception 'Destaque inválido.';end if;
 flag:=(p_payload->>'featured')::boolean;
 if p_action='create' then
  if p_payload->>'title' is null or p_payload->>'body' is null then raise exception 'Informe título e texto.';end if;
  insert into neo_private.community_materials(title,body,url,featured) values(btrim(p_payload->>'title'),btrim(p_payload->>'body'),coalesce(p_payload->>'url',''),flag) returning id into pid;
 else
  pid:=(p_payload->>'id')::uuid;
  update neo_private.community_materials set featured=flag where id=pid;
  if not found then raise exception 'Material não encontrado.';end if;
 end if;
 return jsonb_build_object('ok',true,'id',pid);
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;
grant execute on function public.neo_library(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
