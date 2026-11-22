-- Additive catalogue update. Never deletes orders, payment records or health data.
begin;
do $$begin if to_regprocedure('public.neo_shop_base(text,jsonb)') is null then raise exception 'A configuração de loja e destaques (016) precisa estar instalada.';end if;end $$;
alter table neo_private.shop_products add column if not exists photo_paths text[] not null default '{}';
alter table neo_private.shop_products add column if not exists deleted_at timestamptz;
do $$begin if not exists(select 1 from pg_constraint where conrelid='neo_private.shop_products'::regclass and conname='neo_shop_gallery_limit') then alter table neo_private.shop_products add constraint neo_shop_gallery_limit check(cardinality(photo_paths)<=6);end if;end $$;
do $$begin if to_regprocedure('public.neo_shop_v17(text,jsonb)') is null then alter function public.neo_shop(text,jsonb) rename to neo_shop_v17;end if;end $$;
revoke all on function public.neo_shop_v17(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_shop(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();a boolean;pid uuid;paths text[];old neo_private.shop_products;result jsonb;item jsonb;v_path text;
begin
 if u is null then raise exception 'Entre na conta para acessar a loja.' using errcode='42501';end if;
 a:=public.neo_admin_access();
 if p_action='delete_product' then
  if not a then raise exception 'Autorização da loja obrigatória.' using errcode='42501';end if;
  perform pg_advisory_xact_lock(642917200);perform neo_private.take_limit('shop_manage',120,3600);
  pid:=(p_payload->>'id')::uuid;select * into old from neo_private.shop_products where id=pid for update;
  if not found then raise exception 'Produto não encontrado.';end if;
  if old.deleted_at is null then
   update neo_private.shop_products set deleted_at=now(),active=false,featured=false,updated_at=now() where id=pid;
   update neo_private.shop_carts c set items=coalesce((select jsonb_agg(i.value order by i.ordinality) from jsonb_array_elements(c.items) with ordinality i where i.value->>'product_id'<>pid::text),'[]'::jsonb),updated_at=now() where exists(select 1 from jsonb_array_elements(c.items) i where i->>'product_id'=pid::text);
  end if;
  return jsonb_build_object('ok',true,'id',pid);
 elsif p_action='product' then
  if not a then raise exception 'Autorização da loja obrigatória.' using errcode='42501';end if;
  perform pg_advisory_xact_lock(642917200);
  pid:=nullif(p_payload->>'id','')::uuid;select * into old from neo_private.shop_products where id=pid for update;
  if old.deleted_at is not null then raise exception 'Este produto foi excluído.';end if;
  if p_payload?'photo_paths' then
   if jsonb_typeof(p_payload->'photo_paths') is distinct from 'array' then raise exception 'Galeria inválida.';end if;
   if jsonb_array_length(p_payload->'photo_paths')>6 then raise exception 'Use no máximo 6 fotos por produto.';end if;
   paths:='{}';
   for item in select value from jsonb_array_elements(p_payload->'photo_paths') loop
    if jsonb_typeof(item) is distinct from 'string' then raise exception 'Foto inválida.';end if;
    v_path:=item#>>'{}';if v_path='' or length(v_path)>200 or v_path=any(paths) then raise exception 'Foto inválida ou duplicada.';end if;
    paths:=array_append(paths,v_path);
   end loop;
  elsif old.id is not null and nullif(p_payload->>'photo_path','') is not distinct from old.photo_path then
   paths:=case when cardinality(old.photo_paths)>0 then old.photo_paths when old.photo_path is not null then array[old.photo_path] else '{}'::text[] end;
  else paths:=case when nullif(p_payload->>'photo_path','') is not null then array[p_payload->>'photo_path'] else '{}'::text[] end;
  end if;
  foreach v_path in array paths loop
   if not exists(select 1 from neo_private.shop_photos f join storage.objects s on s.name=f.path and s.bucket_id='neo-shop-products' where f.path=v_path) then raise exception 'Envie uma foto válida do produto.';end if;
  end loop;
  result:=public.neo_shop_v17(p_action,p_payload||jsonb_build_object('photo_path',paths[1]));
  update neo_private.shop_products set photo_paths=paths where id=(result->>'id')::uuid;
  return result;
 elsif p_action='product_detail' then
  return jsonb_build_object('product',(select to_jsonb(p) from neo_private.shop_products p where p.id=(p_payload->>'id')::uuid and p.active and p.deleted_at is null));
 elsif p_action='featured' then
  return jsonb_build_object('products',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from neo_private.shop_products p where p.active and p.featured and p.stock>0 and p.deleted_at is null),'[]'));
 elsif p_action='cart' then
  if jsonb_typeof(p_payload->'items')='array' then
   for item in select value from jsonb_array_elements(p_payload->'items') loop
    if exists(select 1 from neo_private.shop_products where id=(item->>'product_id')::uuid and deleted_at is not null) then raise exception 'Produto não está mais disponível.';end if;
   end loop;
  end if;
 end if;
 result:=public.neo_shop_v17(p_action,p_payload);
 if p_action='catalog' then
  result:=result||jsonb_build_object('shop_extensions',jsonb_build_object('gallery',true,'delete_product',true,'max_photos',6),'products',coalesce((select jsonb_agg(to_jsonb(p) order by p.in_cart desc,p.featured desc,p.created_at desc) from(select pr.*,exists(select 1 from neo_private.shop_carts c cross join lateral jsonb_array_elements(c.items) ci where c.user_id=u and ci->>'product_id'=pr.id::text) as in_cart from neo_private.shop_products pr where pr.deleted_at is null and (pr.active or a or exists(select 1 from neo_private.shop_carts c cross join lateral jsonb_array_elements(c.items) ci where c.user_id=u and ci->>'product_id'=pr.id::text)) order by in_cart desc,pr.featured desc,pr.created_at desc limit 230)p),'[]'::jsonb));
 end if;
 return result;
end $$;
create or replace function public.neo_shop_photo(p_path text,p_upload boolean default false) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and (case when p_upload then public.neo_admin_access() and exists(select 1 from neo_private.shop_photos where path=p_path and user_id=auth.uid() and created_at>now()-interval '1 hour') else public.neo_admin_access() or exists(select 1 from neo_private.shop_products where active and deleted_at is null and (photo_path=p_path or p_path=any(photo_paths))) end)
$$;
revoke all on function public.neo_shop(text,jsonb),public.neo_shop_photo(text,boolean) from public,anon;
grant execute on function public.neo_shop(text,jsonb),public.neo_shop_photo(text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
