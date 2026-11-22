-- Use the current profile identity everywhere without exposing private profile data.
begin;

-- Recover avatar registrations whose upload succeeded before the avatar RPC was repaired.
insert into neo_private.community_avatars(user_id,path)
select u.id,o.name
from storage.objects o
join auth.users u on u.id::text=split_part(o.name,'/',1)
where o.bucket_id='neo-community-avatars'
  and o.name=u.id::text||'/avatar.jpg'
on conflict(user_id) do update set path=excluded.path,updated_at=now();

do $$begin
 if to_regprocedure('public.neo_support_v71(text,jsonb)') is null then
  alter function public.neo_support(text,jsonb) rename to neo_support_v71;
 end if;
end $$;
revoke all on function public.neo_support_v71(text,jsonb) from public,anon,authenticated;

create or replace function public.neo_support(p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;tid uuid;
begin
 result:=public.neo_support_v71(p_action,p_payload);
 if p_action='list' then
  result:=jsonb_set(result,'{threads}',coalesce((
   select jsonb_agg(x.value||jsonb_build_object(
    'alias',coalesce(nullif(btrim(p.data->'profile'->>'name'),''),x.value->>'alias'),
    'avatar_path',a.path
   ) order by n)
   from jsonb_array_elements(coalesce(result->'threads','[]')) with ordinality x(value,n)
   join neo_private.support_threads t on t.id=(x.value->>'id')::uuid
   left join public.neo_profiles p on p.user_id=t.user_id
   left join neo_private.community_avatars a on a.user_id=t.user_id
  ),'[]'));
 elsif p_action='open' then
  tid:=(result->>'thread_id')::uuid;
  result:=result||coalesce((
   select jsonb_build_object(
    'alias',coalesce(nullif(btrim(p.data->'profile'->>'name'),''),result->>'alias'),
    'avatar_path',a.path,
    'handler',coalesce(nullif(btrim(hp.data->'profile'->>'name'),''),result->>'handler')
   )
   from neo_private.support_threads t
   left join public.neo_profiles p on p.user_id=t.user_id
   left join public.neo_profiles hp on hp.user_id=t.assigned_to
   left join neo_private.community_avatars a on a.user_id=t.user_id
   where t.id=tid
  ),'{}');
  result:=jsonb_set(result,'{messages}',coalesce((
   select jsonb_agg(x.value||jsonb_build_object(
    'alias',coalesce(nullif(btrim(p.data->'profile'->>'name'),''),x.value->>'alias'),
    'avatar_path',a.path
   ) order by n)
   from jsonb_array_elements(coalesce(result->'messages','[]')) with ordinality x(value,n)
   join neo_private.support_messages m on m.id=(x.value->>'id')::uuid
   left join public.neo_profiles p on p.user_id=m.sender_id
   left join neo_private.community_avatars a on a.user_id=m.sender_id
  ),'[]'));
 end if;
 return result;
end $$;
revoke all on function public.neo_support(text,jsonb) from public,anon;
grant execute on function public.neo_support(text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
