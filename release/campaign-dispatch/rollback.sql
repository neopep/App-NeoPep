-- Do not erase campaign/publication history or recycle an uncertain attempt.
begin;
update neo_private.campaign_dispatch_config set whatsapp_enabled=false,app_enabled=false;
with paused_app as (
 update neo_private.campaigns c set status='paused',updated_at=now()
 from neo_private.campaign_editor_versions v join neo_private.campaign_dispatch_batch b
   on b.editor_id=v.editor_id and b.revision=v.revision and b.manifest->>'action'='publish_app'
 where c.id=v.campaign_id and v.channel='app' and c.status='active'
 returning b.id
)
update neo_private.campaign_dispatch_batch b set cancelled_at=coalesce(cancelled_at,now())
from paused_app where b.id=paused_app.id;
with stopped as (
 update neo_private.campaign_wa_publications set dispatch_state='uncertain'
 where dispatch_state='started' returning id,dispatch_device,dispatch_fence
)
insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event)
select id,dispatch_device,dispatch_fence,'rollback_uncertain' from stopped;
revoke execute on function public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb),
 public.neo_campaign_dispatch_admin_v1(text,jsonb) from authenticated;
notify pgrst,'reload schema';
commit;
