-- Candidate, exclusively Teste. Apply after 001–003.
-- Existing grants remain read-only; no permission update API.
do $guard$
begin
 if not exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw') then
  raise exception 'connect_ai_wrong_environment';
 end if;
end $guard$;
alter table neo_private.connect_ai_connections add column scopes text[] not null default array['campaigns:read']::text[]
 check(scopes in (array['campaigns:read']::text[],array['campaigns:read','campaigns:drafts']::text[]));
grant select(scopes) on neo_private.connect_ai_connections to neo_connect_ai_broker;
do $patch$
declare d text:=pg_get_functiondef('public.neo_connect_ai_connections(text,uuid,text,text)'::regprocedure);
 needle text:=$a$elsif p_action='register' then
  insert into neo_private.connect_ai_connections(owner_id,client_id,label)
  values(actor,p_client,btrim(p_label)) returning * into item;$a$;
begin
 if position(needle in d)=0 then raise exception 'registration_shape_mismatch';end if;
 d:=replace(d,needle,needle||$a$
 elsif p_action='register_drafts' then
  insert into neo_private.connect_ai_connections(owner_id,client_id,label,scopes)
  values(actor,p_client,btrim(p_label),array['campaigns:read','campaigns:drafts']::text[]) returning * into item;$a$);
 if position($a$'scopes',jsonb_build_array('campaigns:read')$a$ in d)=0 then raise exception 'scope_shape_mismatch';end if;
 execute replace(d,$a$'scopes',jsonb_build_array('campaigns:read')$a$,$a$'scopes',to_jsonb(item.scopes)$a$);
end $patch$;
