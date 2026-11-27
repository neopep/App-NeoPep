-- Teste only. Database-side interlock, independent of Worker flags.
do $guard$ begin
 if not exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw') then raise exception 'connect_ai_wrong_environment';end if;
end $guard$;
alter table neo_private.connect_ai_environment add column drafts_enabled boolean not null default false;
do $patch$
declare d text:=pg_get_functiondef('public.neo_connect_ai_connections(text,uuid,text,text)'::regprocedure);
 needle text:=$a$elsif p_action='register_drafts' then$a$;
begin
 if (length(d)-length(replace(d,needle,'')))<>length(needle) then raise exception 'draft_scope_gate_marker_mismatch';end if;
 execute replace(d,needle,needle||$a$
  if not exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw' and drafts_enabled) then
   raise exception 'connect_ai_drafts_disabled' using errcode='42501';
  end if;$a$);
end $patch$;
create or replace function neo_private.connect_ai_job_check(p_connection uuid,p_owner uuid)
returns boolean language sql security definer set search_path=pg_catalog as $$
 select exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw' and drafts_enabled)
 and exists(select 1 from neo_private.connect_ai_connections c where c.id=p_connection and c.owner_id=p_owner and c.revoked_at is null and c.expires_at>clock_timestamp() and c.scopes@>array['campaigns:read','campaigns:drafts']::text[])
$$;
revoke all on function neo_private.connect_ai_job_check(uuid,uuid) from public,anon,authenticated;
-- Keep FALSE until isolated Worker, OAuth, ACL, and real draft tests are approved.
