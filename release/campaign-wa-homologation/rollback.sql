begin;
update neo_private.campaign_wa_test_config set enabled=false,schedule_enabled=false;
do $$
begin
 if exists(select 1 from neo_private.campaign_dispatch_config where whatsapp_enabled) then
  raise exception 'Restauração só permitida com despacho legado desligado';
 end if;
end $$;
-- Preserve receipts and history. Never put a started message back into the queue.
update neo_private.campaign_wa_publications p
set dispatch_cancel_requested=true,
 dispatch_state=case when dispatch_state='started' then 'uncertain' else 'cancelled' end
from neo_private.campaign_dispatch_batch b
where b.id=p.dispatch_batch and b.manifest->'homologation'='true'::jsonb
 and p.dispatch_state in ('waiting','leased','started');
do $$
declare item record;
begin
 for item in select routine,definition,patched_hash from neo_private.campaign_wa_test_baseline order by routine loop
  if item.patched_hash is distinct from md5(pg_get_functiondef(to_regprocedure(
   case item.routine when 'admin' then 'public.neo_campaign_dispatch_admin_v1(text,jsonb)'
    else 'public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb)' end))) then
   raise exception 'Rotina alterada após a migração. Rever a restauração.';
  end if;
  execute item.definition;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
