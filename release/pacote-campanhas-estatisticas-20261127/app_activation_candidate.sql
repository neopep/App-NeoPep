-- Candidate, not applied. Execute only at the authorized consolidated release.
-- This activates the already-installed rich App channel for future admin-confirmed publications.
begin;
set local lock_timeout='5s';
do $gate$
begin
 if position('app_rich_popup' in pg_get_functiondef('public.neo_campaign_dispatch_admin_v1(text,jsonb)'::regprocedure))=0 then raise exception 'rich_app_contract_unavailable';end if;
 if exists(select 1 from neo_private.campaign_app_official_batches where cancelled_at is null and (ends_at is null or ends_at>now())) then raise exception 'review_existing_app_batches_before_activation';end if;
 if (select count(*) from neo_private.campaign_dispatch_config)<>1 then raise exception 'config_changed';end if;
 update neo_private.campaign_dispatch_config set app_enabled=true where singleton and app_enabled=false;
 if not found then raise exception 'app_gate_already_changed';end if;
end;$gate$;
commit;
-- Rollback (if authorized): update neo_private.campaign_dispatch_config set app_enabled=false where singleton;
