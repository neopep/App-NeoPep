-- Refresh shared avatars only when the stored image changes.
begin;

create or replace function public.neo_community_member()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and (
  exists(select 1 from neo_private.community_members where user_id=auth.uid())
  or public.neo_admin_access()
 )
$$;
revoke all on function public.neo_community_member() from public,anon;
grant execute on function public.neo_community_member() to authenticated;

do $$begin
 if to_regprocedure('public.neo_community_members_v72(text,jsonb)') is null then
  alter function public.neo_community_members(text,jsonb) rename to neo_community_members_v72;
 end if;
end $$;
revoke all on function public.neo_community_members_v72(text,jsonb) from public,anon,authenticated;

create or replace function public.neo_community_members(p_action text default 'list',p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 result:=public.neo_community_members_v72(p_action,p_payload);
 if p_action in ('list','profile') then
  result:=jsonb_set(result,'{members}',coalesce((
   select jsonb_agg(x.value||jsonb_build_object('avatar_updated_at',a.updated_at) order by n)
   from jsonb_array_elements(coalesce(result->'members','[]')) with ordinality x(value,n)
   left join neo_private.community_avatars a on a.user_id=(x.value->>'user_id')::uuid
  ),'[]'));
 end if;
 return result;
end $$;
revoke all on function public.neo_community_members(text,jsonb) from public,anon;
grant execute on function public.neo_community_members(text,jsonb) to authenticated;

do $$begin
 if to_regprocedure('public.neo_support_v72(text,jsonb)') is null then
  alter function public.neo_support(text,jsonb) rename to neo_support_v72;
 end if;
end $$;
revoke all on function public.neo_support_v72(text,jsonb) from public,anon,authenticated;

create or replace function public.neo_support(p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 result:=public.neo_support_v72(p_action,p_payload);
 if p_action='list' then
  result:=jsonb_set(result,'{threads}',coalesce((
   select jsonb_agg(x.value||jsonb_build_object('avatar_updated_at',a.updated_at) order by n)
   from jsonb_array_elements(coalesce(result->'threads','[]')) with ordinality x(value,n)
   join neo_private.support_threads t on t.id=(x.value->>'id')::uuid
   left join neo_private.community_avatars a on a.user_id=t.user_id
  ),'[]'));
 elsif p_action='open' then
  result:=result||coalesce((
   select jsonb_build_object('avatar_updated_at',a.updated_at)
   from neo_private.support_threads t
   left join neo_private.community_avatars a on a.user_id=t.user_id
   where t.id=(result->>'thread_id')::uuid
  ),'{}');
  result:=jsonb_set(result,'{messages}',coalesce((
   select jsonb_agg(x.value||jsonb_build_object('avatar_updated_at',a.updated_at) order by n)
   from jsonb_array_elements(coalesce(result->'messages','[]')) with ordinality x(value,n)
   join neo_private.support_messages m on m.id=(x.value->>'id')::uuid
   left join neo_private.community_avatars a on a.user_id=m.sender_id
  ),'[]'));
 end if;
 return result;
end $$;
revoke all on function public.neo_support(text,jsonb) from public,anon;
grant execute on function public.neo_support(text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
