insert into auth.users(id)
values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into neo_private.admin_members(user_id) values ('00000000-0000-0000-0000-000000000001');
insert into neo_private.connect_devices(id,owner_id,label,secret_hash,state,last_seen)
values ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001',
 'Windows sintético',sha256(convert_to(repeat('a',64),'UTF8')),'approved',now());
insert into neo_private.connect_wa_connections(id,owner_id,device_id,label,status,last_synced_at)
values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000010','Sessão sintética','connected',now());
insert into neo_private.connect_wa_selected_groups(connection_id,group_jid,display_name)
values ('00000000-0000-0000-0000-000000000011','1@g.us','Grupo um'),
 ('00000000-0000-0000-0000-000000000011','2@g.us','Grupo dois');

create function fixture_dispatch(p_action text,p_data jsonb default '{}') returns jsonb language sql as $$
 select public.neo_campaign_dispatch_device_v1(p_action,
  '00000000-0000-0000-0000-000000000010',repeat('a',64),p_data)
$$;

do $$
declare
 admin constant text:='00000000-0000-0000-0000-000000000001';
 member constant text:='00000000-0000-0000-0000-000000000002';
 editor constant uuid:='00000000-0000-0000-0000-000000000020';
 key constant uuid:='00000000-0000-0000-0000-000000000021';
 connection constant uuid:='00000000-0000-0000-0000-000000000011';
 draft jsonb:='{"title":"Revisão","blocks":[{"type":"text","text":"Mensagem sintética"}],
  "groups":["00000000-0000-0000-0000-000000000011:1@g.us","00000000-0000-0000-0000-000000000011:2@g.us"],
  "timezone":"America/Sao_Paulo","audience":"all"}';
 payload jsonb;
 app_payload jsonb;
 job uuid;
 app_job uuid;
begin
 perform set_config('request.jwt.claim.sub',member,true);
 begin
  perform public.neo_campaign_dispatch_admin_v1('status','{}');
  raise exception 'member authorized';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',admin,true);
 payload:=jsonb_build_object('editor_id',editor,'request_id',key,'revision',1,'weekly_count',2);
 perform public.neo_campaign_editor_v1('save',payload||jsonb_build_object('revision',0,'channel','whatsapp','draft',draft));
 begin
  perform public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',payload);
  raise exception 'dispatch enabled by default';
 exception when insufficient_privilege then null;
 end;
 assert fixture_dispatch('heartbeat',jsonb_build_object('connection_id',connection,'bridge_version','wa-text-v1','session_ready',true))
   @> '{"enabled":false,"capabilities":["text"]}';
 update neo_private.campaign_dispatch_config set whatsapp_enabled=true,app_enabled=true;
 update neo_private.connect_config set paused=false;
 assert public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',payload)
   = public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',payload);
 assert (select count(*) from neo_private.campaign_wa_publications)=4;
 assert (select count(*) from neo_private.campaign_wa_publications where group_id is null and not remind and status='cancelled')=4;
 assert public.neo_campaign_wa('queue') = '[]';
 select id into job from neo_private.campaign_wa_publications where dispatch_due>now() order by id limit 1;
 perform public.neo_campaign_dispatch_admin_v1('reschedule',jsonb_build_object('batch_id',key,'publication_id',job,
   'local_time',to_char((now() at time zone 'America/Sao_Paulo')+interval '3 days','YYYY-MM-DD"T"HH24:MI')));
 assert (select count(*) from neo_private.campaign_dispatch_audit where publication_id=job and event='rescheduled')=1;

 -- Lost authorization is rejected before any row can enter the transport lane.
 insert into neo_private.shop_products(id,name,description,category,price_cents,stock,active)
 values ('00000000-0000-0000-0000-000000000030','Produto sintético','','Fixture',1000,1,true);
 app_payload:=public.neo_campaign_editor_v1('save',jsonb_build_object('editor_id',gen_random_uuid(),'request_id',gen_random_uuid(),
  'revision',0,'channel','whatsapp','draft',draft||'{"blocks":[{"type":"product","ref":"00000000-0000-0000-0000-000000000030"}]}'));
 update neo_private.shop_products set active=false where id='00000000-0000-0000-0000-000000000030';
 begin
  perform public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',jsonb_build_object(
    'editor_id',app_payload->>'editor_id','revision',1,'request_id',gen_random_uuid()));
  raise exception 'product reference entered transport despite revoke';
 exception when invalid_parameter_value then null;
 end;
 app_payload:=public.neo_campaign_editor_v1('save',jsonb_build_object('editor_id',gen_random_uuid(),'request_id',gen_random_uuid(),
  'revision',0,'channel','whatsapp','draft',draft||'{"blocks":[{"type":"file","name":"restrito.pdf"}]}'));
 begin
  perform public.neo_campaign_dispatch_admin_v1('schedule_whatsapp',jsonb_build_object(
    'editor_id',app_payload->>'editor_id','revision',1,'request_id',gen_random_uuid()));
  raise exception 'unsupported file dispatched';
 exception when invalid_parameter_value then null;
 end;

 app_payload:=public.neo_campaign_editor_v1('save',jsonb_build_object('editor_id',gen_random_uuid(),'request_id',gen_random_uuid(),
   'revision',0,'channel','app','draft',draft||'{"groups":[],"blocks":[{"type":"text","text":"App independente"}],"audience":"premium"}'));
 app_job:=(app_payload->>'campaign_id')::uuid;
 app_payload:=jsonb_build_object('editor_id',app_payload->>'editor_id','revision',1,'request_id',gen_random_uuid(),'push',false,
   'local_time',to_char((now() at time zone 'America/Sao_Paulo')+interval '1 day','YYYY-MM-DD"T"HH24:MI'));
 assert public.neo_campaign_dispatch_admin_v1('publish_app',app_payload)
   = public.neo_campaign_dispatch_admin_v1('publish_app',app_payload);
 assert exists(select 1 from neo_private.campaigns where id=app_job and status='active' and starts_at>now() and targets='{premium}' and not push_requested);
 perform public.neo_campaign_dispatch_admin_v1('reschedule_app',jsonb_build_object('batch_id',app_payload->>'request_id',
  'local_time',to_char((now() at time zone 'America/Sao_Paulo')+interval '2 days','YYYY-MM-DD"T"HH24:MI')));
 assert exists(select 1 from neo_private.campaigns where id=app_job and starts_at>now()+interval '1 day');
 perform public.neo_campaign_dispatch_admin_v1('cancel_app',jsonb_build_object('batch_id',app_payload->>'request_id'));
 assert exists(select 1 from neo_private.campaigns where id=app_job and status='paused');
 assert jsonb_array_length(public.neo_campaign_dispatch_admin_v1('status',jsonb_build_object('batch_id',key)))=4;
 update neo_private.connect_wa_connections set status='disconnected';
 assert fixture_dispatch('claim') is null;
 update neo_private.connect_wa_connections set status='connected',last_seen_at=now()-interval '2 minutes';
 assert fixture_dispatch('claim') is null;
 update neo_private.connect_wa_connections set last_seen_at=now();
 update neo_private.connect_devices set state='revoked';
 begin
   perform fixture_dispatch('claim');
   raise exception 'revoked device authorized';
 exception when insufficient_privilege then null;
 end;
 update neo_private.connect_devices set state='approved',last_seen=now();
end $$;
