-- Automatic entry uses the account's own saved profile. No health records are shared.
begin;
create or replace function public.neo_community_enter() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();first_name text;existing_alias text;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 if not public.neo_has_consent('terms') then raise exception 'complete onboarding first';end if;
 select alias into existing_alias from neo_private.community_members where user_id=u;
 if existing_alias is not null then return jsonb_build_object('member',true,'alias',existing_alias);end if;
 select left((regexp_split_to_array(btrim(data->'profile'->>'name'),'\s+'))[1],40) into first_name from public.neo_profiles where user_id=u;
 if first_name is null or length(first_name)<2 then raise exception 'edit your profile name before entering community';end if;
 perform neo_private.take_limit('community_join',10,3600);
 insert into neo_private.community_members(user_id,alias,rules_version) values(u,first_name,'2026-11-direct-entry') on conflict(user_id) do nothing;
 select alias into existing_alias from neo_private.community_members where user_id=u;
 return jsonb_build_object('member',true,'alias',existing_alias);
end $$;
revoke all on function public.neo_community_enter() from public,anon;
grant execute on function public.neo_community_enter() to authenticated;
create or replace function neo_private.community_auto_approve() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 -- Uses the protected server role table, never user-editable metadata or payload.
 if new.user_id=auth.uid() and exists(select 1 from neo_private.admin_members where user_id=auth.uid()) then new.status:='published';end if;
 return new;
end $$;
revoke all on function neo_private.community_auto_approve() from public,anon,authenticated;
drop trigger if exists neo_community_00_auto_approve on neo_private.community_posts;
-- Alphabetic ordering places this before the publication-event trigger (007).
create trigger neo_community_00_auto_approve before insert on neo_private.community_posts for each row execute function neo_private.community_auto_approve();
commit;
