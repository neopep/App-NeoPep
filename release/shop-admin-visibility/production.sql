-- Apply with psql -X -v ON_ERROR_STOP=1 only after the production preflight.
-- The caller must confirm the target, backup and migration ledger separately.
begin;
set local lock_timeout='5s';

do $verify$
declare
 installed oid:=to_regprocedure('public.neo_shop(text,jsonb)');
 source_hash text;
begin
 select md5(btrim(prosrc,E'\n\r\t ')) into source_hash
 from pg_proc where oid=installed and prosecdef and prorettype='jsonb'::regtype;
 if source_hash is distinct from '846ef5399a44241e2ee5d09060f4decd' and source_hash is distinct from '43eb7707b5a58cdb0a5368b8bb80ae30' then
  raise exception 'Unreviewed neo_shop contract (%). Compare the installed definition before continuing.',source_hash;
 end if;
 if not has_function_privilege('authenticated',installed,'EXECUTE')
    or has_function_privilege('anon',installed,'EXECUTE')
    or to_regprocedure('neo_private.shop_before_member_visibility(text,jsonb)') is null
    or to_regprocedure('neo_private.shop_product_blocked(uuid,uuid)') is null then
  raise exception 'Shop dependencies or grants differ from the reviewed contract.';
 end if;
 if source_hash='846ef5399a44241e2ee5d09060f4decd' then
  execute $ddl$create or replace function public.neo_shop(p_action text default 'catalog',p_payload jsonb default '{}')
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

 if p_action in ('product_detail','cart','quote','discount_options','order') then
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
  -- Administrators keep the full set for Gerenciar, but the storefront must
  -- respect each product's membership visibility for the current admin.
  result:=jsonb_set(result,'{products}',coalesce((
   select jsonb_agg(i.item||jsonb_build_object('shop_store_hidden',
    neo_private.shop_product_blocked(actor,(i.item->>'id')::uuid)) order by i.pos)
   from jsonb_array_elements(result->'products') with ordinality i(item,pos)
  ),'[]'::jsonb));
  result:=jsonb_set(result,'{cart}',neo_private.shop_visibility_cart(actor,result->'cart'));
 end if;
 if p_action='featured' or (not admin and p_action='catalog') then
  result:=jsonb_set(result,'{products}',coalesce((select jsonb_agg(i.item order by i.pos)
    from jsonb_array_elements(result->'products') with ordinality i(item,pos)
    where not neo_private.shop_product_blocked(actor,(i.item->>'id')::uuid)),'[]'));
  if p_action='catalog' then
   result:=jsonb_set(result,'{cart}',neo_private.shop_visibility_cart(actor,result->'cart'));
  end if;
 end if;
 return result;
end $$;$ddl$;
 end if;
end
$verify$;

notify pgrst,'reload schema';
commit;
