-- Gates do lado do banco para o ensaio. Nenhum worker ou cron é instalado.
alter table neo_private.campaigns add constraint release_campaigns_inactive check(status<>'active' and not push_requested);
alter table neo_private.campaign_wa_publications add constraint release_wa_no_reminders check(not remind);
revoke execute on function public.neo_campaign_push_claim(),public.neo_campaign_push_finish(uuid,text)
 from public,anon,authenticated,service_role;
