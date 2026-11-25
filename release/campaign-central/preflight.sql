do $$
begin
 if to_regprocedure('public.neo_campaign_admin(text,uuid,jsonb)') is null
 or to_regprocedure('public.neo_campaign_editor_v1(text,jsonb)') is null
 or to_regprocedure('public.neo_campaign_rich_admin_v1(text,jsonb)') is null
 or to_regclass('neo_private.campaign_dispatch_batch') is null
 or to_regclass('neo_private.campaign_wa_rich_messages') is null
 or to_regclass('neo_private.campaign_wa_rich_batches') is null then
  raise exception 'campaign_central_missing_dependency';
 end if;
 if exists(select 1 from neo_private.campaign_editor_versions v
   where v.channel='whatsapp' group by campaign_id having count(distinct owner_id)>1) then
  raise exception 'campaign_central_ownership_conflict';
 end if;
end;
$$;
