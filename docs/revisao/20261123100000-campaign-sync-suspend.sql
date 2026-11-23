-- Operational rollback after commit. Preserves campaign selections, scoped history and simulation guard.
begin;
revoke execute on function public.neo_campaign_wa_sync(text,uuid,jsonb) from public,anon,authenticated,service_role;
commit;
