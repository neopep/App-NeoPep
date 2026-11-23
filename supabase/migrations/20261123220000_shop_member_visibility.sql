-- Private product/member restrictions. Existing orders and payment RPCs keep their contracts.
begin;
set local lock_timeout = '5s';

create table if not exists neo_private.shop_product_visibility (
 product_id uuid primary key references neo_private.shop_products(id) on delete cascade,
 mode text not null check(mode in ('public','blocklist','allowlist'))
);
create table if not exists neo_private.shop_product_visibility_members (
 product_id uuid not null references neo_private.shop_products(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 list text not null check(list in ('blocklist','allowlist')),
 primary key(product_id,list,user_id)
);
create index if not exists shop_product_visibility_user_idx on neo_private.shop_product_visibility_members(user_id,product_id,list);
alter table neo_private.shop_product_visibility enable row level security;
alter table neo_private.shop_product_visibility_members enable row level security;
revoke all on neo_private.shop_product_visibility,neo_private.shop_product_visibility_members from public,anon,authenticated,service_role;

create table if not exists neo_private.shop_product_copy_requests (
 actor_id uuid not null references auth.users(id) on delete cascade,
 request_key uuid not null,
 source_id uuid not null references neo_private.shop_products(id) on delete cascade,
 copy_id uuid not null references neo_private.shop_products(id) on delete cascade,
 primary key(actor_id,request_key)
);
alter table neo_private.shop_product_copy_requests enable row level security;
revoke all on neo_private.shop_product_copy_requests from public,anon,authenticated,service_role;

-- A revision signals a change without exposing IDs, identity, mode or selections.
create table if not exists public.neo_shop_visibility_events (
 singleton boolean primary key default true check(singleton),
 revision bigint not null default 0
);
insert into public.neo_shop_visibility_events(singleton) values(true) on conflict do nothing;
alter table public.neo_shop_visibility_events enable row level security;
revoke all on public.neo_shop_visibility_events from public,anon,authenticated;
grant select on public.neo_shop_visibility_events to authenticated;
drop policy if exists neo_shop_visibility_signal on public.neo_shop_visibility_events;
create policy neo_shop_visibility_signal on public.neo_shop_visibility_events for select to authenticated using(auth.uid() is not null);
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables)
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='neo_shop_visibility_events') then
  alter publication supabase_realtime add table public.neo_shop_visibility_events;
 end if;
end $$;

create or replace function neo_private.shop_product_blocked(p_user uuid,p_product uuid)
returns boolean language sql stable set search_path=pg_catalog as $$
 select coalesce((select case v.mode
  when 'blocklist' then exists(select 1 from neo_private.shop_product_visibility_members m
   where m.product_id=v.product_id and m.user_id=p_user and m.list='blocklist')
  when 'allowlist' then not exists(select 1 from neo_private.shop_product_visibility_members m
   where m.product_id=v.product_id and m.user_id=p_user and m.list='allowlist')
  else false end from neo_private.shop_product_visibility v where v.product_id=p_product),false)
$$;
revoke all on function neo_private.shop_product_blocked(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function neo_private.shop_visibility_cart(p_user uuid,p_items jsonb)
returns jsonb language sql stable set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(i.item order by i.pos),'[]')
 from jsonb_array_elements(coalesce(p_items,'[]')) with ordinality i(item,pos)
 where not neo_private.shop_product_blocked(p_user,(i.item->>'product_id')::uuid)
$$;
revoke all on function neo_private.shop_visibility_cart(uuid,jsonb) from public,anon,authenticated,service_role;

-- Keep the installed chain and its OIDs. Only the authenticated public entry point gains a wrapper.
do $$
begin
 if to_regprocedure('neo_private.shop_before_member_visibility(text,jsonb)') is null then
  if to_regprocedure('public.neo_shop_v36(text,jsonb)') is null
     or not exists(select 1 from pg_proc where oid=to_regprocedure('public.neo_shop(text,jsonb)') and prosecdef) then
   raise exception 'Contrato da Loja não verificado. Confira neo_shop e neo_shop_v36.';
  end if;
  alter function public.neo_shop(text,jsonb) set schema neo_private;
  alter function neo_private.neo_shop(text,jsonb) rename to shop_before_member_visibility;
 end if;
end $$;
revoke all on function neo_private.shop_before_member_visibility(text,jsonb) from public,anon,authenticated,service_role;

create or replace function public.neo_shop(p_action text default 'catalog',p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 actor uuid:=auth.uid();
 admin boolean;
 product uuid;
 member uuid;
 after_id uuid;
 term text;
 listed boolean;
 list_mode text;
 active_mode text;
 result jsonb;
 changed integer;
 copy_key uuid;
 copy_request neo_private.shop_product_copy_requests;
 duplicate_id uuid;
begin
 if actor is null then raise exception 'Entre na conta para acessar a loja.' using errcode='42501';end if;
 admin:=public.neo_admin_access() is true;
 if p_action='duplicate_product' then
  if not admin then raise exception 'Autorização administrativa obrigatória.' using errcode='42501';end if;
  product:=(p_payload->>'id')::uuid;
  copy_key:=(p_payload->>'request_key')::uuid;
  if product is null or copy_key is null then raise exception 'Solicitação de cópia inválida.';end if;
  perform pg_advisory_xact_lock(762911001);
  select * into copy_request from neo_private.shop_product_copy_requests r where r.actor_id=actor and r.request_key=copy_key;
  if found then
   if copy_request.source_id<>product then raise exception 'A solicitação já pertence a outro produto.';end if;
   if not exists(select 1 from neo_private.shop_products p where p.id=copy_request.copy_id and p.deleted_at is null) then
    raise exception 'A cópia foi excluída.';
   end if;
   return (select to_jsonb(p) from neo_private.shop_products p where p.id=copy_request.copy_id);
  end if;
  perform neo_private.take_limit('shop_manage',120,3600);
  perform 1 from neo_private.shop_products p where p.id=product and p.deleted_at is null for share;
  if not found then raise exception 'Produto indisponível.';end if;
  if exists(select 1 from neo_private.shop_products p
   cross join lateral unnest(array_append(p.photo_paths,p.photo_path)) as paths(path)
   where p.id=product and paths.path is not null and not exists(
    select 1 from storage.objects o where o.bucket_id='neo-shop-products' and o.name=paths.path)) then
   raise exception 'A galeria contém uma foto indisponível. Corrija o original antes de duplicar.';
  end if;
  insert into neo_private.shop_products(name,description,category,price_cents,stock,active,featured,payment_name,photo_path,photo_paths)
  select rtrim(left(btrim(p.name),112))||' (Cópia)',p.description,p.category,p.price_cents,p.stock,
   false,p.featured,p.payment_name,p.photo_path,p.photo_paths
  from neo_private.shop_products p where p.id=product returning id into duplicate_id;
  insert into neo_private.shop_product_visibility(product_id,mode)
  select duplicate_id,v.mode from neo_private.shop_product_visibility v where v.product_id=product;
  insert into neo_private.shop_product_visibility_members(product_id,user_id,list)
  select duplicate_id,m.user_id,m.list from neo_private.shop_product_visibility_members m where m.product_id=product;
  insert into neo_private.shop_product_copy_requests(actor_id,request_key,source_id,copy_id)
  values(actor,copy_key,product,duplicate_id);
  return (select to_jsonb(p) from neo_private.shop_products p where p.id=duplicate_id);
 end if;
 if p_action in ('visibility_members','visibility_set','visibility_mode') then
  if not admin then raise exception 'Autorização administrativa obrigatória.' using errcode='42501';end if;
  perform neo_private.take_limit('shop_visibility_admin',180,60);
  product:=(p_payload->>'product_id')::uuid;
  if not exists(select 1 from neo_private.shop_products p where p.id=product and p.deleted_at is null) then
   raise exception 'Produto indisponível.';
  end if;
  if p_action='visibility_members' then
   select coalesce((select v.mode from neo_private.shop_product_visibility v where v.product_id=product),'public') into active_mode;
   list_mode:=coalesce(nullif(p_payload->>'list',''),nullif(active_mode,'public'));
   if list_mode is not null and list_mode not in ('blocklist','allowlist') then raise exception 'Lista inválida.';end if;
   term:=lower(left(btrim(coalesce(p_payload->>'search','')),120));
   after_id:=nullif(p_payload->>'after','')::uuid;
   select jsonb_build_object('mode',active_mode,'selected_count',(
    select count(*) from neo_private.shop_product_visibility_members selected
    where selected.product_id=product and selected.list=list_mode),
    'members',coalesce(jsonb_agg(to_jsonb(row_info) order by row_info.id),'[]')) into result
   from (
    select u.id,name_info.display_name,a.path as avatar_path,(m.user_id is not null) as selected
    from auth.users u
    left join public.neo_profiles p on p.user_id=u.id
    left join neo_private.community_avatars a on a.user_id=u.id
    left join neo_private.shop_product_visibility_members m on m.user_id=u.id and m.product_id=product and m.list=list_mode
    cross join lateral (select coalesce(nullif(btrim(p.data->'profile'->>'name'),''),
     nullif(btrim(u.raw_user_meta_data->>'full_name'),''),nullif(btrim(u.raw_user_meta_data->>'name'),''),'Nome não informado') as display_name) name_info
    where list_mode is not null and (after_id is null or u.id>after_id) and u.deleted_at is null
     and not coalesce(u.is_anonymous,false)
     and (term='' or position(term in lower(name_info.display_name))>0
      or position(term in lower(coalesce(u.email,'')))>0)
    order by u.id limit 30
   ) row_info;
   return result;
  end if;
  perform pg_advisory_xact_lock(762911001);
  if p_action='visibility_mode' then
   active_mode:=p_payload->>'mode';
   if active_mode is null or active_mode not in ('public','blocklist','allowlist') then
    raise exception 'Modo de visibilidade inválido.';
   end if;
   insert into neo_private.shop_product_visibility(product_id,mode) values(product,active_mode)
   on conflict(product_id) do update set mode=excluded.mode where shop_product_visibility.mode<>excluded.mode;
  else
   list_mode:=p_payload->>'list';
   member:=(p_payload->>'user_id')::uuid;
   if list_mode is null or list_mode not in ('blocklist','allowlist') or member is null
    or jsonb_typeof(p_payload->'selected') is distinct from 'boolean'
    or not exists(select 1 from auth.users u where u.id=member and u.deleted_at is null
      and not coalesce(u.is_anonymous,false)) then
    raise exception 'Membro, lista ou estado inválido.';
   end if;
   listed:=(p_payload->>'selected')::boolean;
   if listed then
    insert into neo_private.shop_product_visibility_members(product_id,user_id,list)
    values(product,member,list_mode) on conflict do nothing;
   else
    delete from neo_private.shop_product_visibility_members m
    where m.product_id=product and m.user_id=member and m.list=list_mode;
   end if;
  end if;
  get diagnostics changed=row_count;
  if changed>0 then update public.neo_shop_visibility_events set revision=revision+1 where singleton;end if;
  return jsonb_build_object('mode',active_mode,'selected',listed,'selected_count',(
   select count(*) from neo_private.shop_product_visibility_members m
   where m.product_id=product and m.list=list_mode));
 end if;

 if not admin then
  if p_action in ('cart','quote','discount_options','order') then
   perform pg_advisory_xact_lock_shared(762911001);
  end if;
  if p_action='product_detail' and neo_private.shop_product_blocked(actor,(p_payload->>'id')::uuid) then
   return jsonb_build_object('product',null);
  end if;
  if p_action='cart' and jsonb_typeof(p_payload->'items')='array'
    and exists(select 1 from jsonb_array_elements(p_payload->'items') i
     where neo_private.shop_product_blocked(actor,(i->>'product_id')::uuid)
      or not exists(select 1 from neo_private.shop_products p where p.id=(i->>'product_id')::uuid
       and p.active and p.deleted_at is null)) then
   raise exception 'Produto indisponível. Atualize o carrinho.' using errcode='42501';
  end if;
  if p_action in ('quote','discount_options','order')
    and not (p_action='order' and exists(select 1 from neo_private.shop_orders o
      where o.user_id=actor and o.request_key=(p_payload->>'request_key')::uuid)) then
   update neo_private.shop_carts c
   set items=neo_private.shop_visibility_cart(actor,c.items),updated_at=now()
   where c.user_id=actor and c.items is distinct from neo_private.shop_visibility_cart(actor,c.items);
  end if;
 end if;
 result:=neo_private.shop_before_member_visibility(p_action,p_payload);
 if admin and p_action='catalog' then
  result:=jsonb_set(result,'{shop_extensions}',coalesce(result->'shop_extensions','{}')||
   '{"member_visibility":true,"duplicate_product":true}'::jsonb);
 end if;
 if not admin and p_action in ('catalog','featured') then
  result:=jsonb_set(result,'{products}',coalesce((select jsonb_agg(i.item order by i.pos)
    from jsonb_array_elements(result->'products') with ordinality i(item,pos)
    where not neo_private.shop_product_blocked(actor,(i.item->>'id')::uuid)),'[]'));
  if p_action='catalog' then
   result:=jsonb_set(result,'{cart}',neo_private.shop_visibility_cart(actor,result->'cart'));
  end if;
 end if;
 return result;
end $$;
revoke all on function public.neo_shop(text,jsonb) from public,anon,authenticated;
grant execute on function public.neo_shop(text,jsonb) to authenticated;

-- Existing private bucket policies already call this predicate when signing new URLs.
create or replace function public.neo_shop_photo(p_path text,p_upload boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and
 case when p_upload then public.neo_is_moderator() and exists(select 1 from neo_private.shop_photos
  where path=p_path and user_id=auth.uid() and created_at>now()-interval '1 hour')
 else public.neo_admin_access() or exists(select 1 from neo_private.shop_products p
  where (p.photo_path=p_path or p_path=any(p.photo_paths))
    and (p.active and p.deleted_at is null or public.neo_is_moderator())
    and not neo_private.shop_product_blocked(auth.uid(),p.id))
  or (public.neo_is_moderator() and exists(select 1 from neo_private.shop_photos
    where path=p_path and user_id=auth.uid()) and not exists(select 1 from neo_private.shop_products p
    where (p.photo_path=p_path or p_path=any(p.photo_paths)) and neo_private.shop_product_blocked(auth.uid(),p.id))) end
$$;
revoke all on function public.neo_shop_photo(text,boolean) from public,anon;
grant execute on function public.neo_shop_photo(text,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
