-- Repair private media access after avatar/community identity rollout.
begin;

create or replace function public.neo_community_member()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null
   and exists(select 1 from neo_private.community_members where user_id=auth.uid())
$$;
revoke all on function public.neo_community_member() from public,anon;
grant execute on function public.neo_community_member() to authenticated;

create or replace function public.neo_community_avatar_access(p_path text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select public.neo_community_member()
   and (split_part(p_path,'/',1)=auth.uid()::text
        or exists(select 1 from neo_private.community_avatars where path=p_path))
$$;
revoke all on function public.neo_community_avatar_access(text) from public,anon;
grant execute on function public.neo_community_avatar_access(text) to authenticated;

drop policy if exists neo_community_avatar_read on storage.objects;
create policy neo_community_avatar_read on storage.objects for select to authenticated
using(bucket_id='neo-community-avatars'
 and public.neo_community_avatar_access(name));

create or replace function public.neo_community_avatar(p_path text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();
begin
 if u is null or not public.neo_community_member() then
  raise exception 'Participação na comunidade obrigatória.' using errcode='42501';
 end if;
 if p_path is distinct from u::text||'/avatar.jpg'
    or not exists(select 1 from storage.objects where bucket_id='neo-community-avatars' and name=p_path) then
  raise exception 'Foto de perfil inválida.';
 end if;
 insert into neo_private.community_avatars(user_id,path) values(u,p_path)
 on conflict(user_id) do update set path=excluded.path,updated_at=now();
 return jsonb_build_object('ok',true,'path',p_path);
end $$;
revoke all on function public.neo_community_avatar(text) from public,anon;
grant execute on function public.neo_community_avatar(text) to authenticated;

-- Recreate the media policies so older environments receive the current safe functions.
drop policy if exists neo_support_media_read on storage.objects;
create policy neo_support_media_read on storage.objects for select to authenticated
using(bucket_id='neo-support' and public.neo_support_attachment_access(name,false));
drop policy if exists neo_support_media_insert on storage.objects;
create policy neo_support_media_insert on storage.objects for insert to authenticated
with check(bucket_id='neo-support' and public.neo_support_attachment_access(name,true));

drop policy if exists neo_community_file_read on storage.objects;
create policy neo_community_file_read on storage.objects for select to authenticated
using(bucket_id='neo-community-files'
 and (split_part(name,'/',1)=auth.uid()::text
      or public.neo_community_file_access(name,false)));
drop policy if exists neo_community_file_insert on storage.objects;
create policy neo_community_file_insert on storage.objects for insert to authenticated
with check(bucket_id='neo-community-files' and public.neo_community_file_access(name,true));

drop policy if exists neo_shop_photo_read on storage.objects;
create policy neo_shop_photo_read on storage.objects for select to authenticated
using(bucket_id='neo-shop-products' and public.neo_shop_photo(name,false));
drop policy if exists neo_shop_photo_insert on storage.objects;
create policy neo_shop_photo_insert on storage.objects for insert to authenticated
with check(bucket_id='neo-shop-products' and public.neo_shop_photo(name,true));

notify pgrst,'reload schema';
commit;
