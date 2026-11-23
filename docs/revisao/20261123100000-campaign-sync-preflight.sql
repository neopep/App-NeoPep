-- Run with an authenticated operator connection to the verified Test project.
begin transaction isolation level repeatable read read only;
set local search_path=pg_catalog;
set local statement_timeout='10s';

select relation,to_regclass(relation) is not null as present
from unnest(array[
 'neo_private.connect_wa_connections','neo_private.connect_wa_selected_groups',
 'neo_private.connect_devices','neo_private.connect_group_accounts','neo_private.connect_tasks',
 'neo_private.campaigns','neo_private.campaign_wa_groups','neo_private.campaign_wa_publications'
]) as r(relation);

select signature,proc.oid is not null as present,proc.prosecdef as security_definer,
 encode(sha256(convert_to(proc.prosrc,'UTF8')),'hex') as body_sha256,
 has_function_privilege('anon',proc.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',proc.oid,'EXECUTE') as authenticated_execute
from unnest(array[
 'public.neo_campaign_admin(text,uuid,jsonb)','public.neo_campaign_wa(text,uuid,jsonb)',
 'public.neo_connect_wa_list_connections()','public.neo_connect_wa_list_groups(uuid,text,integer)',
 'public.neo_campaign_wa_sync(text,uuid,jsonb)'
]) as r(signature)
left join pg_proc proc on proc.oid=to_regprocedure(r.signature);
rollback;
