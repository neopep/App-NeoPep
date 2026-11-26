-- Candidate only. Private, pre-generated small JPEGs. No changes to original objects or dispatch gates.
begin;
set local lock_timeout='5s';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('neo-campaign-thumbnails','neo-campaign-thumbnails',false,65536,array['image/jpeg']);
create function public.neo_campaign_thumbnail_allowed(p_name text) returns boolean
language sql stable security definer set search_path='' as $allow$
 select coalesce(auth.uid() is not null and public.neo_admin_access()
 and p_name ~ '^(shop|library)/[a-f0-9-]{36}/[a-f0-9-]{36}[.][a-z0-9]{1,12}[.]jpg$'
 and case when split_part(p_name,'/',1)='shop' then
  public.neo_shop_photo(substring(p_name from 6 for length(p_name)-9),false)
  and exists(select 1 from neo_private.shop_products p where p.active and p.deleted_at is null
     and (p.photo_path=substring(p_name from 6 for length(p_name)-9) or substring(p_name from 6 for length(p_name)-9)=any(p.photo_paths))
     and not exists(select 1 from neo_private.shop_product_visibility v where v.product_id=p.id and v.mode<>'public'))
  and exists(select 1 from storage.objects o where o.bucket_id='neo-shop-products' and o.name=substring(p_name from 6 for length(p_name)-9))
 else
  public.neo_library_media_access(substring(p_name from 9 for length(p_name)-12),false)
  and exists(select 1 from neo_private.library_uploads f where f.path=substring(p_name from 9 for length(p_name)-12) and f.material_id is not null)
  and exists(select 1 from storage.objects o where o.bucket_id='neo-library' and o.name=substring(p_name from 9 for length(p_name)-12))
 end,false)
$allow$;
revoke all on function public.neo_campaign_thumbnail_allowed(text) from public,anon;
grant execute on function public.neo_campaign_thumbnail_allowed(text) to authenticated;
create function public.neo_campaign_thumbnail_ready() returns boolean
language sql stable security definer set search_path='' as $ready$
 select coalesce(auth.uid() is not null and public.neo_admin_access()
 and exists(select 1 from storage.buckets b where b.id='neo-campaign-thumbnails' and not b.public and b.file_size_limit=65536),false)
$ready$;
revoke all on function public.neo_campaign_thumbnail_ready() from public,anon;
grant execute on function public.neo_campaign_thumbnail_ready() to authenticated;
create policy neo_campaign_thumbnail_read on storage.objects for select to authenticated
 using(bucket_id='neo-campaign-thumbnails' and (select public.neo_campaign_thumbnail_allowed(name)));
create policy neo_campaign_thumbnail_insert on storage.objects for insert to authenticated
 with check(bucket_id='neo-campaign-thumbnails' and (select public.neo_campaign_thumbnail_allowed(name)));
-- Deliberately no UPDATE or DELETE policy: source paths are immutable; duplicate creation does not overwrite.
commit;
