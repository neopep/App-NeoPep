do $$
declare
 actor constant text:='00000000-0000-0000-0000-000000000001';
 connection constant uuid:='00000000-0000-0000-0000-000000000011';
 editor constant uuid:='00000000-0000-0000-0000-000000000301';
 later constant uuid:='00000000-0000-0000-0000-000000000302';
 other constant uuid:='00000000-0000-0000-0000-000000000303';
 immediate uuid:=gen_random_uuid();
 future uuid:=gen_random_uuid();
 draft jsonb:='{"title":"WhatsApp de homologação","blocks":[{"type":"text","text":"Teste de homologação NeoPep."}],"groups":["00000000-0000-0000-0000-000000000011:1@g.us"],"timezone":"America/Sao_Paulo","audience":"all"}';
 intent jsonb;
 scheduled jsonb;
 lease jsonb;
 job jsonb;
 gate jsonb;
 diagnostic jsonb;
begin
 perform set_config('request.jwt.claim.sub',actor,true);
 perform set_config('request.jwt.claims','{"iss":"https://qnuluspqfazdppciermw.supabase.co/auth/v1"}',true);
 update neo_private.campaign_dispatch_config set whatsapp_enabled=false,app_enabled=false;
 update neo_private.connect_config set paused=true;
 update neo_private.connect_devices set last_seen=now() where owner_id=actor::uuid;
 update neo_private.connect_wa_connections set status='connected',last_seen_at=now(),last_synced_at=now() where id=connection;
 insert into neo_private.connect_wa_selected_groups(connection_id,group_jid,display_name)
 values(connection,'1@g.us','Grupo um'),(connection,'2@g.us','Grupo dois') on conflict do nothing;
 for i in 1..3 loop
  perform public.neo_campaign_editor_v1('save',jsonb_build_object('editor_id',(array[editor,later,other])[i],
   'request_id',gen_random_uuid(),'revision',0,'channel','whatsapp','draft',
   case when i=3 then jsonb_set(draft,'{groups}',jsonb_build_array(connection::text||':2@g.us')) else draft end));
 end loop;
 intent:=jsonb_build_object('editor_id',editor,'revision',1,'request_id',immediate,'homologation',true,'confirmed',true);
 scheduled:=intent||jsonb_build_object('editor_id',later,'request_id',future,'local_time',
  to_char((now()+interval '1 day') at time zone 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI'));
 assert (public.neo_campaign_dispatch_admin_v1('diagnostics','{}')->'whatsapp_test')='null'::jsonb;
 update neo_private.campaign_wa_test_config set enabled=true,owner_id=actor::uuid,connection_id=connection,group_jid='1@g.us';
 gate:=fixture_dispatch('heartbeat',jsonb_build_object('connection_id',connection,'bridge_version','wa-text-v1','session_ready',true));
 assert gate @> '{"enabled":false}';
 begin
   perform public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',intent);
   raise exception 'paused dispatch accepted';
 exception when insufficient_privilege then null;
 end;
 update neo_private.connect_config set paused=false;
 update neo_private.campaign_dispatch_presence set session_ready=false;
 begin
   perform public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',intent);
   raise exception 'unready session accepted';
 exception when insufficient_privilege then null;
 end;
 assert fixture_dispatch('heartbeat',jsonb_build_object('connection_id',connection,'bridge_version','wa-text-v1','session_ready',true)) @> '{"enabled":true}';
 diagnostic:=public.neo_campaign_dispatch_admin_v1('diagnostics','{}');
 assert diagnostic @> '{"whatsapp_enabled":false,"whatsapp_test":{"ready":true,"schedule_ready":false}}';
 begin
   perform public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',intent-'confirmed');
   raise exception 'missing confirmation accepted';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',intent||jsonb_build_object('editor_id',other,'request_id',gen_random_uuid()));
   raise exception 'other group accepted';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claims','{"iss":"https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1"}',true);
 begin
  perform public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',intent);
  raise exception 'production issuer accepted';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claims','{"iss":"https://qnuluspqfazdppciermw.supabase.co/auth/v1"}',true);
 update neo_private.campaign_wa_test_config set schedule_enabled=true;
 begin
  perform public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',scheduled);
  raise exception 'schedule allowed before receipt';
 exception when insufficient_privilege then null;
 end;
 assert public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',intent)=public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',intent);
 assert (select count(*) from neo_private.campaign_wa_publications where dispatch_batch=immediate)=1;
 begin
  perform public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',intent||jsonb_build_object('request_id',gen_random_uuid()));
  raise exception 'duplicate revision accepted';
 exception when serialization_failure or unique_violation then null;
 end;
 -- Suppress old synthetic rhythm records only in this disposable database.
 update neo_private.campaign_dispatch_audit set recorded_at=now()-interval '5 minutes' where event='started';
 lease:=fixture_dispatch('claim');
 assert lease is not null;
 assert (select dispatch_batch=immediate from neo_private.campaign_wa_publications where id=(lease->>'id')::uuid);
 update neo_private.connect_config set paused=true;
 assert fixture_dispatch('start',lease) is null;
 update neo_private.connect_config set paused=false;
 delete from neo_private.connect_wa_selected_groups where connection_id=connection and group_jid='1@g.us';
 assert fixture_dispatch('start',lease) is null;
 insert into neo_private.connect_wa_selected_groups(connection_id,group_jid,display_name) values(connection,'1@g.us','Grupo um');
 job:=fixture_dispatch('start',lease);
 assert job @> '{"group_jid":"1@g.us","text":"Teste de homologação NeoPep."}';
 assert fixture_dispatch('finish',lease||'{"outcome":"accepted","receipt_id":"fixture-ack"}')='{"state":"accepted"}';
 assert public.neo_campaign_dispatch_admin_v1('diagnostics','{}') @> '{"whatsapp_test":{"schedule_ready":true}}';
 assert public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',scheduled) @> jsonb_build_object('batch_id',future);
 assert (select dispatch_due>now() from neo_private.campaign_wa_publications where dispatch_batch=future);
 perform public.neo_campaign_dispatch_admin_v1('cancel',jsonb_build_object('batch_id',future));
 assert (select dispatch_state='cancelled' from neo_private.campaign_wa_publications where dispatch_batch=future);
 assert not (select whatsapp_enabled from neo_private.campaign_dispatch_config);
end $$;
