-- Desativa a Central oficial e os despachos ricos, preservando revisões, lotes e recibos.
begin;
set local lock_timeout='5s';
update neo_private.campaign_wa_rich_control set enabled=false;
update neo_private.campaign_wa_official_config set enabled=false,schedule_enabled=false;
revoke execute on function public.neo_campaign_central_v1(text,jsonb) from authenticated;
notify pgrst,'reload schema';
commit;
