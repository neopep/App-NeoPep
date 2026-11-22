-- Directory pages have no total cap; only publicly visible names/roles are returned.
begin;
do $$begin if to_regprocedure('public.neo_is_moderator()') is null or to_regclass('neo_private.shop_products') is null then raise exception 'Execute antes a configuração de conversas ao vivo e da loja.';end if;end $$;
do $$begin if to_regprocedure('public.neo_community_members_legacy(text,jsonb)') is null then alter function public.neo_community_members(text,jsonb) rename to neo_community_members_legacy;end if;end $$;
revoke all on function public.neo_community_members_legacy(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_community_members(p_action text default 'list',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();target uuid;result jsonb;term text:=left(coalesce(p_payload->>'search',''),40);after_name text:=p_payload->>'after_alias';after_id uuid:=nullif(p_payload->>'after_id','')::uuid;page_size int:=least(100,greatest(1,coalesce((p_payload->>'page_size')::int,100)));more boolean;last_row jsonb;
begin
 if u is null or not exists(select 1 from neo_private.community_members where user_id=u) then raise exception 'community membership required' using errcode='42501';end if;
 if p_action not in ('list','profile') then return public.neo_community_members_legacy(p_action,p_payload);end if;
 target:=nullif(p_payload->>'user_id','')::uuid;
 with directory as(select a.id as user_id,coalesce(m.alias,nullif(left((regexp_split_to_array(btrim(coalesce(p.data->'profile'->>'name',a.raw_user_meta_data->>'full_name',a.raw_user_meta_data->>'name','')),'\s+'))[1],40),''),'Participante') as alias,coalesce(m.joined_at,a.created_at) as joined_at,case when exists(select 1 from neo_private.admin_members ad where ad.user_id=a.id) then 'admin' when exists(select 1 from neo_private.community_moderators md where md.user_id=a.id) then 'moderator' else 'member' end as role, m.user_id is not null as in_group from auth.users a left join public.neo_profiles p on p.user_id=a.id left join neo_private.community_members m on m.user_id=a.id),page as(select * from directory where (p_action<>'profile' or user_id=target) and (term='' or strpos(lower(alias),lower(term))>0) and (after_name is null or (lower(alias),user_id)>(after_name,after_id)) order by lower(alias),user_id limit page_size+1)
 select coalesce(jsonb_agg((to_jsonb(page)-'joined_at')||case when public.neo_is_moderator() then jsonb_build_object('joined_at',joined_at) else '{}'::jsonb end order by lower(alias),user_id),'[]') into result from page;
 more:=jsonb_array_length(result)>page_size;if more then result:=result-(jsonb_array_length(result)-1);end if;last_row:=result->(jsonb_array_length(result)-1);
 return jsonb_build_object('members',result,'can_manage_roles',public.neo_admin_access(),'can_contact',public.neo_is_moderator(),'has_more',more,'next_cursor',case when more then jsonb_build_object('after_alias',lower(last_row->>'alias'),'after_id',last_row->>'user_id') else null end);
end $$;
revoke all on function public.neo_community_members(text,jsonb) from public,anon;
grant execute on function public.neo_community_members(text,jsonb) to authenticated;

alter table neo_private.shop_products add column if not exists featured boolean not null default false;
-- Product editors may be moderators. Order data, settings and fulfillment remain admin-only.
do $$declare def text;begin
 if to_regprocedure('public.neo_shop_base(text,jsonb)') is null then alter function public.neo_shop(text,jsonb) rename to neo_shop_base;end if;
 def:=pg_get_functiondef('public.neo_shop_base(text,jsonb)'::regprocedure);
 def:=replace(def,'a:=public.neo_admin_access();', 'a:=public.neo_admin_access() or (p_action in (''catalog'',''product'',''reserve_photo'') and public.neo_is_moderator());');
 def:=replace(def,'desc,pr.created_at desc limit 230','desc,pr.featured desc,pr.created_at desc limit 230');
 execute def;
 def:=pg_get_functiondef('public.neo_shop_photo(text,boolean)'::regprocedure);execute replace(def,'public.neo_admin_access()','public.neo_is_moderator()');
end $$;
revoke all on function public.neo_shop_base(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_shop(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare result jsonb;begin
 if auth.uid() is null then raise exception 'Entre na conta para acessar a loja.' using errcode='42501';end if;
 if p_action='product_detail' then return jsonb_build_object('product',(select to_jsonb(p) from neo_private.shop_products p where p.id=(p_payload->>'id')::uuid and p.active));end if;
 if p_action='featured' then return jsonb_build_object('products',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from neo_private.shop_products p where p.active and p.featured and p.stock>0),'[]'));end if;
 if p_action='product' and p_payload?'featured' and jsonb_typeof(p_payload->'featured') is distinct from 'boolean' then raise exception 'Destaque inválido.';end if;
 result:=public.neo_shop_base(p_action,p_payload);
 if p_action='product' and p_payload?'featured' then update neo_private.shop_products set featured=(p_payload->>'featured')::boolean where id=(result->>'id')::uuid;
 elsif p_action='catalog' then result:=result||jsonb_build_object('can_manage_orders',public.neo_admin_access());end if;
 return result;
end $$;
revoke all on function public.neo_shop(text,jsonb) from public,anon;
grant execute on function public.neo_shop(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
