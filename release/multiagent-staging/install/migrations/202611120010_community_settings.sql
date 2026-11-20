-- Shared settings are protected on the server; no administrative roles are granted.
begin;
create table if not exists neo_private.community_settings(singleton boolean primary key default true check(singleton),require_approval boolean not null default true);
insert into neo_private.community_settings(singleton) values(true) on conflict do nothing;
alter table neo_private.community_settings enable row level security;
revoke all on neo_private.community_settings from public,anon,authenticated;
create or replace function public.neo_community_settings(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare allowed boolean;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 allowed:=public.neo_admin_access();
 if p_action='update' then
  if not allowed then raise exception 'moderator required' using errcode='42501';end if;
  if jsonb_typeof(p_payload->'require_approval') is distinct from 'boolean' then raise exception 'invalid approval setting';end if;
  update neo_private.community_settings set require_approval=(p_payload->>'require_approval')::boolean where singleton;
 elsif p_action<>'read' then raise exception 'invalid settings action';end if;
 if not allowed then return '{"can_moderate":false}';end if;
 return (select jsonb_build_object('can_moderate',true,'require_approval',require_approval) from neo_private.community_settings where singleton);
end $$;
revoke all on function public.neo_community_settings(text,jsonb) from public,anon;
grant execute on function public.neo_community_settings(text,jsonb) to authenticated;
create or replace function neo_private.community_auto_approve() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.user_id=auth.uid() and (exists(select 1 from neo_private.admin_members where user_id=auth.uid()) or exists(select 1 from neo_private.community_settings where singleton and not require_approval)) then new.status:='published';end if;
 return new;
end $$;
revoke all on function neo_private.community_auto_approve() from public,anon,authenticated;
drop trigger if exists neo_community_00_auto_approve on neo_private.community_posts;
create trigger neo_community_00_auto_approve before insert on neo_private.community_posts for each row execute function neo_private.community_auto_approve();
-- Preserve every existing preference, including disabled choices. No old posts are notified.
alter table neo_private.community_preferences alter column push_enabled set default true;
insert into neo_private.community_preferences(user_id,push_enabled,activated_after)
 select user_id,true,(select coalesce(max(published_seq),0) from neo_private.community_posts) from neo_private.community_members on conflict(user_id) do nothing;
create or replace function neo_private.community_default_notices() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into neo_private.community_preferences(user_id,push_enabled,activated_after) values(new.user_id,true,(select coalesce(max(published_seq),0) from neo_private.community_posts)) on conflict(user_id) do nothing;return new;
end $$;
revoke all on function neo_private.community_default_notices() from public,anon,authenticated;
drop trigger if exists neo_community_default_notices on neo_private.community_members;
create trigger neo_community_default_notices after insert on neo_private.community_members for each row execute function neo_private.community_default_notices();
commit;
