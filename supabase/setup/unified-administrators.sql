-- One effective administrator role. Existing memberships stay intact.
begin;
do $$begin if to_regclass('neo_private.community_moderators') is null or to_regprocedure('public.neo_community_members_legacy(text,jsonb)') is null then raise exception 'Execute antes as configurações de conversas ao vivo e de membros/destaques.';end if;end $$;
create or replace function public.neo_admin_access() returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and (exists(select 1 from neo_private.admin_members where user_id=auth.uid()) or exists(select 1 from neo_private.community_moderators where user_id=auth.uid()))
$$;
-- Retain the old API identifier only for compatibility with deployed clients.
create or replace function public.neo_is_moderator() returns boolean language sql stable security definer set search_path=pg_catalog as $$select public.neo_admin_access()$$;
create or replace function public.neo_community_members_legacy(p_action text default 'list',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();target uuid;
begin
 perform pg_advisory_xact_lock(642917127);
 if u is null or not public.neo_admin_access() then raise exception 'administrator required' using errcode='42501';end if;
 if p_action not in ('promote','demote') then raise exception 'invalid role action';end if;
 target:=nullif(p_payload->>'user_id','')::uuid;
 if target is null or target=u or not exists(select 1 from neo_private.community_members where user_id=target) then raise exception 'invalid role target';end if;
 perform neo_private.take_limit('community_roles',30,3600);
 if p_action='promote' then insert into neo_private.admin_members(user_id) values(target) on conflict do nothing;
 else
  delete from neo_private.admin_members where user_id=target;
  delete from neo_private.community_moderators where user_id=target;
  update neo_private.support_threads set assigned_to=null,claimed_at=null where assigned_to=target;
 end if;
 perform neo_private.message_signal(array[target,u],'group');
 return jsonb_build_object('ok',true);
end $$;
-- Both existing membership sources are displayed as admin, never as distinct roles.
do $names$ declare r record;def text;begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','neo_private') and (p.proname like 'neo_community%' or p.proname='neo_support' or p.proname='community_auto_approve') loop
  def:=pg_get_functiondef(r.oid);
  def:=replace(def,'then ''moderator''','then ''admin''');
  def:=replace(def,'moderator required','administrator required');
  def:=replace(def,'outro mediador','outro administrador');
  execute def;
 end loop;
end $names$;
revoke all on function public.neo_community_members_legacy(text,jsonb) from public,anon,authenticated;
revoke all on function public.neo_admin_access(),public.neo_is_moderator() from public,anon;
grant execute on function public.neo_admin_access(),public.neo_is_moderator() to authenticated;
notify pgrst,'reload schema';
commit;
