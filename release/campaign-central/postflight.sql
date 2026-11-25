select (select count(*) from neo_private.campaigns where whatsapp_enabled) as legacy,
       (select count(*) from neo_private.campaign_central_groups) as grouped,
       (select count(*) from neo_private.campaign_central_publications) as publications,
       (select count(*) from neo_private.campaign_editor_versions) as revisions,
       (select count(*) from neo_private.campaign_wa_rich_batches) as batches,
       (select count(*) from neo_private.campaign_wa_rich_messages) as messages,
       not has_function_privilege('anon','public.neo_campaign_central_v1(text,jsonb)','EXECUTE')
         and has_function_privilege('authenticated','public.neo_campaign_central_v1(text,jsonb)','EXECUTE') as rpc_grants;
