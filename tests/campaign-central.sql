do $$
declare
 actor constant text:='00000000-0000-0000-0000-000000000001';
 parent jsonb;
 publication uuid:=gen_random_uuid();
 request_id uuid:=gen_random_uuid();
 args jsonb;
 saved jsonb;
 copy_id uuid;
 desired text;
 item jsonb;
 intent jsonb;
 scheduled jsonb;
 scheduled_ids uuid[]:='{}';
 connection constant uuid:='00000000-0000-0000-0000-000000000011';
 device constant uuid:='00000000-0000-0000-0000-000000000010';
begin
 assert not has_function_privilege('anon','public.neo_campaign_central_v1(text,jsonb)','execute');
 assert not has_table_privilege('authenticated','neo_private.campaign_central_publications','select,insert,update');
 perform set_config('request.jwt.claim.sub',actor,true);
 perform set_config('request.jwt.claims','{"iss":"https://qnuluspqfazdppciermw.supabase.co/auth/v1"}',true);
 assert (public.neo_campaign_central_v1('list')->0->>'publications')::int=1;
 args:=jsonb_build_object('title','Minha campanha','request_id',request_id);
 parent:=public.neo_campaign_central_v1('create',args);
 assert parent=public.neo_campaign_central_v1('create',args);
 assert public.neo_campaign_central_v1('get',parent)->'publications'='[]'::jsonb;
 perform public.neo_campaign_central_v1('rename',parent||'{"title":"Renomeada"}'::jsonb);
 assert public.neo_campaign_central_v1('get',parent)->>'title'='Renomeada';
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 begin
  perform public.neo_campaign_central_v1('get',parent);
  raise exception 'cross-account access accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',actor,true);
 args:=parent||jsonb_build_object('publication_id',publication,'request_id',gen_random_uuid(),'revision',0,
  'draft',jsonb_build_object('title','Primeira','blocks',jsonb_build_array(jsonb_build_object('type','text','text','Teste')),
  'groups',jsonb_build_array(connection::text||':1@g.us'),'timezone','America/Sao_Paulo','audience','all',
  'planned_local',to_char((now()+interval '3 days') at time zone 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI')));
 saved:=public.neo_campaign_central_v1('save',args);
 assert saved=public.neo_campaign_central_v1('save',args);
 begin
  perform public.neo_campaign_central_v1('save',args||jsonb_build_object('request_id',gen_random_uuid()));
  raise exception 'stale revision accepted';
 exception when serialization_failure then null; end;
 for i in 1..2 loop
  desired:=to_char((now()+i*interval '1 day') at time zone 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI');
  copy_id:=gen_random_uuid();
  args:=parent||jsonb_build_object('publication_id',publication,'request_id',copy_id,'planned_local',desired);
  assert public.neo_campaign_central_v1('duplicate',args)=public.neo_campaign_central_v1('duplicate',args);
  assert public.neo_campaign_central_v1('load',parent||jsonb_build_object('publication_id',copy_id))->'draft'->>'planned_local'=desired;
 end loop;
 assert jsonb_array_length(public.neo_campaign_central_v1('get',parent)->'publications')=3;
 assert (select count(*) from neo_private.campaign_wa_rich_batches)=0;
 assert (select count(*) from neo_private.campaign_dispatch_batch)=0;
 begin
  perform public.neo_campaign_central_v1('schedule',parent||jsonb_build_object('publication_id',copy_id,'request_id',gen_random_uuid(),'revision',1,'local_time',desired));
  raise exception 'confirmation was ignored';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.neo_campaign_central_v1('schedule',parent||jsonb_build_object('publication_id',copy_id,'request_id',gen_random_uuid(),'revision',1,'local_time',desired,'confirmed',true));
  raise exception 'offline delivery was allowed';
 exception when insufficient_privilege then null; end;
 assert (select count(*) from neo_private.campaign_wa_rich_batches)=0;
 insert into neo_private.connect_devices(id,owner_id,label,secret_hash,state,last_seen,version)
  values(device,actor::uuid,'Isolado',sha256(convert_to(repeat('a',64),'UTF8')),'approved',now(),'0.2.12');
 insert into neo_private.connect_wa_connections(id,owner_id,device_id,label,status,last_seen_at,last_synced_at)
  values(connection,actor::uuid,device,'Isolada','connected',now(),now());
 insert into neo_private.connect_wa_selected_groups(connection_id,group_jid,display_name) values(connection,'1@g.us','Isolado');
 update neo_private.connect_config set paused=false;
 insert into neo_private.campaign_dispatch_presence(device_id,connection_id,bridge_version,session_ready)
  values(device,connection,'wa-text-v1',true);
 update neo_private.campaign_wa_test_config set enabled=true,owner_id=actor::uuid,connection_id=connection,group_jid='1@g.us';
 update neo_private.campaign_wa_rich_control set enabled=true;
 for item in select value from jsonb_array_elements(public.neo_campaign_central_v1('get',parent)->'publications') loop
  intent:=parent||jsonb_build_object('publication_id',item->>'id','request_id',gen_random_uuid(),
   'revision',item->'revision','local_time',item->>'planned_local','confirmed',true);
  scheduled:=public.neo_campaign_central_v1('schedule',intent);
  scheduled_ids:=array_append(scheduled_ids,(scheduled->>'batch_id')::uuid);
  assert scheduled->>'batch_id'=public.neo_campaign_central_v1('schedule',intent)->>'batch_id';
  begin
   perform public.neo_campaign_central_v1('schedule',intent||jsonb_build_object('request_id',gen_random_uuid()));
   raise exception 'duplicate dispatch accepted';
  exception when object_not_in_prerequisite_state then null; end;
 end loop;
 assert (select count(*) from neo_private.campaign_wa_rich_batches)=3;
 assert (select count(*) from neo_private.campaign_wa_rich_messages where state='waiting')=3;
 update neo_private.campaign_wa_rich_messages set state='accepted',receipt_id='simulated' where batch_id=scheduled_ids[3];
 for item in select value from jsonb_array_elements(public.neo_campaign_central_v1('get',parent)->'publications') loop
  intent:=parent||jsonb_build_object('publication_id',item->>'id','batch_id',item->'batches'->0->>'id');
  perform public.neo_campaign_central_v1('cancel',intent);
  perform public.neo_campaign_central_v1('cancel',intent);
 end loop;
 assert (select count(*) from neo_private.campaign_wa_rich_messages where state='accepted')=1;
 assert (select count(*) from neo_private.campaign_wa_rich_messages where state='cancelled')=2;
 perform public.neo_campaign_central_v1('archive',parent);
 assert public.neo_campaign_central_v1('get',parent)->>'archived_at' is not null;
end;
$$;
