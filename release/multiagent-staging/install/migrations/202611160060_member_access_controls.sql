-- Administrator controls for group, library and application access.
begin;

create table if not exists neo_private.member_access_controls(
 user_id uuid primary key references auth.users(id) on delete cascade,
 group_blocked boolean not null default false,
 library_blocked boolean not null default false,
 app_blocked boolean not null default false,
 changed_at timestamptz not null default now(),
 changed_by uuid references auth.users(id)
);
alter table neo_private.member_access_controls enable row level security;
revoke all on neo_private.member_access_controls from public,anon,authenticated;

do $$begin
 if to_regprocedure('public.neo_community_members_v60(text,jsonb)') is null then
  alter function public.neo_community_members(text,jsonb) rename to neo_community_members_v60;
 end if;
end $$;
revoke all on function public.neo_community_members_v60(text,jsonb) from public,anon,authenticated;

create or replace function public.neo_community_members(p_action text default 'list',p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();target uuid:=nullif(p_payload->>'user_id','')::uuid;result jsonb;area text;blocking boolean;
begin
 if p_action in ('block_group','unblock_group','block_library','unblock_library','block_app','unblock_app') then
  if u is null or not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  if target is null or target=u or not exists(select 1 from neo_private.community_members where user_id=target)
   or exists(select 1 from neo_private.admin_members where user_id=target)
   or exists(select 1 from neo_private.community_moderators where user_id=target)
  then raise exception 'Este participante não pode ser bloqueado.';end if;
  perform neo_private.take_limit('member_access_control',80,3600);
  area:=case when p_action like '%group' then 'group' when p_action like '%library' then 'library' else 'app' end;
  blocking:=p_action like 'block_%';
  insert into neo_private.member_access_controls(user_id,changed_by) values(target,u) on conflict(user_id) do nothing;
  if area='group' then update neo_private.member_access_controls set group_blocked=blocking,changed_at=now(),changed_by=u where user_id=target;
  elsif area='library' then update neo_private.member_access_controls set library_blocked=blocking,changed_at=now(),changed_by=u where user_id=target;
  else
   update neo_private.member_access_controls set app_blocked=blocking,changed_at=now(),changed_by=u where user_id=target;
   update auth.users set banned_until=case when blocking then 'infinity'::timestamptz else null end where id=target;
   if blocking then delete from auth.sessions where user_id=target;delete from auth.refresh_tokens where user_id=target::text;end if;
  end if;
  perform neo_private.message_signal(array[target,u],'group');
  return jsonb_build_object('ok',true,'area',area,'blocked',blocking);
 end if;
 result:=public.neo_community_members_v60(p_action,p_payload);
 if p_action in ('list','profile') then
  result:=jsonb_set(result,'{members}',coalesce((select jsonb_agg(x.value||jsonb_build_object(
   'group_blocked',coalesce(a.group_blocked,false),'library_blocked',coalesce(a.library_blocked,false),'app_blocked',coalesce(a.app_blocked,false)
  )) from jsonb_array_elements(coalesce(result->'members','[]')) x(value)
  left join neo_private.member_access_controls a on a.user_id=(x.value->>'user_id')::uuid),'[]'));
  result:=result||jsonb_build_object('can_manage_access',public.neo_admin_access());
 end if;
 return result;
end $$;
revoke all on function public.neo_community_members(text,jsonb) from public,anon;
grant execute on function public.neo_community_members(text,jsonb) to authenticated;

do $$begin
 if to_regprocedure('public.neo_community_inbox_v2_v60()') is null then alter function public.neo_community_inbox_v2() rename to neo_community_inbox_v2_v60;end if;
end $$;
revoke all on function public.neo_community_inbox_v2_v60() from public,anon,authenticated;
create or replace function public.neo_community_inbox_v2() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();result jsonb;blocked boolean;admin boolean:=public.neo_admin_access();
begin
 result:=public.neo_community_inbox_v2_v60();
 select coalesce(group_blocked,false) into blocked from neo_private.member_access_controls where user_id=u;
 if blocked then return jsonb_set(jsonb_set(result,'{posts}','[]'),'{pending}','[]')||jsonb_build_object('group_blocked',true);end if;
 if not admin then
  result:=jsonb_set(result,'{posts}',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(coalesce(result->'posts','[]')) x(value) where not exists(select 1 from neo_private.member_access_controls a where a.user_id=(x.value->>'user_id')::uuid and a.group_blocked)),'[]'));
 end if;
 return result||jsonb_build_object('group_blocked',false);
end $$;
revoke all on function public.neo_community_inbox_v2() from public,anon;
grant execute on function public.neo_community_inbox_v2() to authenticated;

do $$begin
 if to_regprocedure('public.neo_community_chat_v60(text,jsonb)') is null then alter function public.neo_community_chat(text,jsonb) rename to neo_community_chat_v60;end if;
end $$;
revoke all on function public.neo_community_chat_v60(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_community_chat(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if exists(select 1 from neo_private.member_access_controls where user_id=auth.uid() and group_blocked) then raise exception 'Seu acesso ao grupo está bloqueado.' using errcode='42501';end if;
 return public.neo_community_chat_v60(p_action,p_payload);
end $$;
revoke all on function public.neo_community_chat(text,jsonb) from public,anon;
grant execute on function public.neo_community_chat(text,jsonb) to authenticated;

do $$begin
 if to_regprocedure('public.neo_library_v60(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_v60;end if;
end $$;
revoke all on function public.neo_library_v60(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_library(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if exists(select 1 from neo_private.member_access_controls where user_id=auth.uid() and library_blocked) then raise exception 'Seu acesso à Biblioteca está bloqueado.' using errcode='42501';end if;
 return public.neo_library_v60(p_action,p_payload);
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;
grant execute on function public.neo_library(text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
