-- Produção candidate, after campaign_official_originals_candidate.sql.
-- Explicit reviewed version allowance, no alteration to authentication, destination,
-- dispatch gates, claim/start/finish or legacy worker enablement.
begin;
set local lock_timeout='5s';
do $patch$
declare
 definition text:=pg_get_functiondef('public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb)'::regprocedure);
 anchor constant text:=$old$where d.id=p_device and d.version='0.2.13'$old$;
 replacement constant text:=$new$where d.id=p_device and d.version in ('0.2.13','0.2.14','0.2.15')$new$;
begin
 if md5(definition) is distinct from '62d9843fac2b58925416672f52e2d2f5' or cardinality(string_to_array(definition,anchor))<>2 then
  raise exception 'dispatch_device_contract_changed';
 end if;
 if md5(pg_get_functiondef('neo_private.campaign_wa_official_ready(uuid,uuid,text)'::regprocedure)) is distinct from '12ecf778c210b178a68e34c3826c420d' then
  raise exception 'dispatch_readiness_contract_changed';
 end if;
 -- Keep the existing safety conditions. The release procedure must first establish
 -- a reviewed, quiescent maintenance window; this migration never pauses anything.
 if exists(select 1 from neo_private.campaign_wa_rich_control where enabled)
 or exists(select 1 from neo_private.campaign_dispatch_config where whatsapp_enabled)
 or exists(select 1 from neo_private.campaign_wa_rich_messages where state in ('leased','started'))
 or exists(select 1 from neo_private.campaign_wa_publications where dispatch_state in ('leased','started')) then
  raise exception 'dispatch_compatibility_requires_quiescence';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='neo_private' and table_name='campaign_wa_rich_control' and column_name='originals_enabled') then
  raise exception 'originals_contract_required';
 end if;
 if exists(select 1 from neo_private.campaign_wa_rich_control where originals_enabled) then
  raise exception 'originals_must_remain_disabled';
 end if;
 execute replace(definition,anchor,replacement);
end$patch$;
commit;
