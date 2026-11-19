-- Full community names and deliberately shared profile avatars.
begin;

create table if not exists neo_private.community_avatars(
 user_id uuid primary key references auth.users(id) on delete cascade,
 path text not null unique,
 updated_at timestamptz not null default now(),
 check(path=user_id::text||'/avatar.jpg')
);
alter table neo_private.community_avatars enable row level security;
revoke all on neo_private.community_avatars from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('neo-community-avatars','neo-community-avatars',false,5242880,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists neo_community_avatar_read on storage.objects;
create policy neo_community_avatar_read on storage.objects for select to authenticated
using(bucket_id='neo-community-avatars'
 and exists(select 1 from neo_private.community_members where user_id=auth.uid())
 and exists(select 1 from neo_private.community_avatars where path=name));
drop policy if exists neo_community_avatar_insert on storage.objects;
create policy neo_community_avatar_insert on storage.objects for insert to authenticated
with check(bucket_id='neo-community-avatars' and split_part(name,'/',1)=auth.uid()::text and name=auth.uid()::text||'/avatar.jpg');
drop policy if exists neo_community_avatar_update on storage.objects;
create policy neo_community_avatar_update on storage.objects for update to authenticated
using(bucket_id='neo-community-avatars' and split_part(name,'/',1)=auth.uid()::text)
with check(bucket_id='neo-community-avatars' and name=auth.uid()::text||'/avatar.jpg');
drop policy if exists neo_community_avatar_delete on storage.objects;
create policy neo_community_avatar_delete on storage.objects for delete to authenticated
using(bucket_id='neo-community-avatars' and split_part(name,'/',1)=auth.uid()::text);

create or replace function public.neo_community_avatar(p_path text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from neo_private.community_members where user_id=u) then raise exception 'Participação na comunidade obrigatória.' using errcode='42501';end if;
 if p_path is distinct from u::text||'/avatar.jpg' or not exists(select 1 from storage.objects where bucket_id='neo-community-avatars' and name=p_path and owner_id=u::text) then raise exception 'Foto de perfil inválida.';end if;
 insert into neo_private.community_avatars(user_id,path) values(u,p_path)
 on conflict(user_id) do update set path=excluded.path,updated_at=now();
 return jsonb_build_object('ok',true,'path',p_path);
end $$;
revoke all on function public.neo_community_avatar(text) from public,anon;
grant execute on function public.neo_community_avatar(text) to authenticated;

do $$begin
 if to_regprocedure('public.neo_community_members_v50(text,jsonb)') is null then
  alter function public.neo_community_members(text,jsonb) rename to neo_community_members_v50;
 end if;
end $$;
revoke all on function public.neo_community_members_v50(text,jsonb) from public,anon,authenticated;

create or replace function public.neo_community_members(p_action text default 'list',p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 result:=public.neo_community_members_v50(p_action,p_payload);
 if p_action in ('list','profile') then
  result:=jsonb_set(result,'{members}',coalesce((select jsonb_agg(x.value||jsonb_build_object(
   'full_name',coalesce(nullif(btrim(p.data->'profile'->>'name'),''),x.value->>'alias'),
   'avatar_path',a.path
  )) from jsonb_array_elements(coalesce(result->'members','[]')) x(value)
  left join public.neo_profiles p on p.user_id=(x.value->>'user_id')::uuid
  left join neo_private.community_avatars a on a.user_id=(x.value->>'user_id')::uuid),'[]'));
 end if;
 return result;
end $$;
revoke all on function public.neo_community_members(text,jsonb) from public,anon;
grant execute on function public.neo_community_members(text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
