-- Candidata: cards, edição de agendamento e evidências de entrega.
-- Não executar até aprovação do Connect 0.2.18, verificação de compatibilidade e CI.
begin;
set local lock_timeout='5s';
alter table neo_private.campaign_wa_rich_messages add column if not exists server_ack_at timestamptz,add column if not exists delivery_ack_at timestamptz,add column if not exists send_error_at timestamptz,add column if not exists send_error_code text;
do $patch$
declare d text;a text;b text;fn regprocedure;
begin
 fn:='public.neo_campaign_central_v1(text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(fn);
 a:=$a$'revision',v.revision,'title',v.draft->>'title','planned_local',v.draft->>'planned_local',$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'central_get_contract_changed';end if;
 b:=$b$
     'draft_group_count',jsonb_array_length(v.draft->'groups'),
     'draft_group_names',(select coalesce(jsonb_agg(distinct s.display_name) filter(where nullif(s.display_name,'') is not null),'[]'::jsonb)
       from neo_private.connect_wa_selected_groups s join neo_private.connect_wa_connections c on c.id=s.connection_id and c.owner_id=actor
       where (c.id::text||':'||s.group_jid) in (select jsonb_array_elements_text(v.draft->'groups'))),
     'edit_pending',exists(select 1 from neo_private.campaign_central_events e where e.publication_id=pub.id and e.campaign_id=campaign_key and e.actor_id=actor and e.event='edit_scheduled'
       and e.recorded_at>=coalesce((select max(b.created_at) from neo_private.campaign_wa_rich_batches b where b.editor_id=pub.editor_id and b.owner_id=actor),'-infinity'::timestamptz)),
 $b$;
 d:=replace(d,a,a||b);
 a:=$a$'sent_at',(select max(m.sent_at) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor and m.state='accepted'),$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'central_batch_contract_changed';end if;
 b:=$b$
       'server_ack_count',(select count(*) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor and m.state='accepted' and m.server_ack_at is not null),
       'delivery_count',(select count(*) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor and m.state='accepted' and m.delivery_ack_at is not null),
       'send_error_count',(select count(*) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor and m.state='accepted' and m.send_error_at is not null and m.delivery_ack_at is null),
       'send_error_codes',(select coalesce(jsonb_agg(distinct m.send_error_code) filter(where m.send_error_code is not null),'[]'::jsonb) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor and m.state='accepted' and m.send_error_at is not null and m.delivery_ack_at is null),
 $b$;
 if strpos(d,$a$'group_names'$a$)=0 then b:=b||$b$
       'message_count',(select count(*) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor),
       'group_count',(select count(distinct (m.connection_id,m.group_jid)) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor),
       'group_names',(select coalesce(jsonb_agg(distinct s.display_name) filter(where nullif(s.display_name,'') is not null),'[]'::jsonb)
          from neo_private.campaign_wa_rich_messages m join neo_private.connect_wa_connections c on c.id=m.connection_id and c.owner_id=actor
          left join neo_private.connect_wa_selected_groups s on s.connection_id=c.id and s.group_jid=m.group_jid
          where m.batch_id=b.id and m.owner_id=actor),
 $b$;end if;
 d:=replace(d,a,a||b);
 a:=$a$ elsif p_action='cancel' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'central_cancel_contract_changed';end if;
 b:=$b$ elsif p_action='edit_scheduled' then
  if p_data->'confirmed' is distinct from 'true'::jsonb or latest.revision is distinct from (p_data->>'revision')::int then
   raise exception 'campaign_edit_confirmation_or_revision' using errcode='40001';end if;
  -- Lock order: parent/publication already locked. Serialize with the owner's worker claim.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('campaign-rich-owner:'||actor::text,0));
  select b.id into previous_batch from neo_private.campaign_wa_rich_batches b
   where b.id=(p_data->>'batch_id')::uuid and b.editor_id=publication.editor_id and b.owner_id=actor and b.cancelled_at is null
     and b.revision=latest.revision and b.due_at>now() for update;
  if not found then raise exception 'campaign_edit_already_started' using errcode='55000';end if;
  if exists(select 1 from neo_private.campaign_weekly_occurrences o where o.batch_id=previous_batch)
     or not exists(select 1 from neo_private.campaign_central_events e where e.campaign_id=campaign_key and e.publication_id=publication.id and e.actor_id=actor and e.revision=latest.revision and e.event='schedule')
     or exists(select 1 from neo_private.campaign_dispatch_batch l where l.editor_id=publication.editor_id and l.owner_id=actor)
     or exists(select 1 from neo_private.campaign_wa_rich_batches b where b.editor_id=publication.editor_id and b.owner_id=actor and b.id<>previous_batch and (b.cancelled_at is null or exists(select 1 from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.state<>'cancelled'))) then
   raise exception 'campaign_edit_not_single_pending_schedule' using errcode='55000';end if;
  perform 1 from neo_private.campaign_wa_rich_messages m where m.batch_id=previous_batch and m.owner_id=actor order by m.sequence for update;
  if not found or exists(select 1 from neo_private.campaign_wa_rich_messages m where m.batch_id=previous_batch and (m.state<>'waiting' or m.attempts<>0)) then
   raise exception 'campaign_edit_already_started' using errcode='55000';end if;
  result:=public.neo_campaign_rich_admin_v1('cancel',jsonb_build_object('batch_id',previous_batch));
  event_name:='edit_scheduled';
 $b$;
 d:=replace(d,a,b||a);
 execute d;
 -- Extend existing version allowlists, preserve existing gates. Actual release requires signed/approved 0.2.18.
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname,p.proname) in (('public','neo_campaign_rich_admin_v1'),('public','neo_campaign_rich_device_v1'),('public','neo_campaign_dispatch_device_v1'),('neo_private','campaign_wa_auto_rebind')) and p.prokind='f'
 loop
  d:=pg_get_functiondef(fn);
  d:=replace(d,$a$'0.2.16','0.2.17'$a$,$a$'0.2.16','0.2.17','0.2.18'$a$);
  d:=replace(d,$a$d.version='0.2.17'$a$,$a$d.version in ('0.2.17','0.2.18')$a$);
  execute d;
 end loop;
 fn:='public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(fn);
 a:=$a$ if p_action='claim' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'receipt_claim_contract_changed';end if;
 b:=$b$ if p_action='delivery_receipt' then
  -- No recipient IDs, content or phone numbers persisted. Match only the authenticated device's own dispatch.
  if d.version<>'0.2.18' or coalesce(p_data->>'status','') not in ('server_ack','delivery_ack','send_error')
    or coalesce(length(p_data->>'message_id'),0) not between 1 and 160
    or coalesce(p_data->>'group_jid','') !~ '^[0-9-]{1,64}@g[.]us$' then
    raise exception 'campaign_delivery_receipt_invalid' using errcode='22023';end if;
  update neo_private.campaign_wa_rich_messages m set
    server_ack_at=case when p_data->>'status' in ('server_ack','delivery_ack') then coalesce(m.server_ack_at,now()) else m.server_ack_at end,
    delivery_ack_at=case when p_data->>'status'='delivery_ack' then coalesce(m.delivery_ack_at,now()) else m.delivery_ack_at end,
    send_error_at=case when p_data->>'status'='send_error' then coalesce(m.send_error_at,now()) else m.send_error_at end,
    send_error_code=case when p_data->>'status'='send_error' then case when coalesce(p_data->>'error_code','') ~ '^[0-9]{1,5}
   where m.owner_id=actor and m.device_id=p_device and m.connection_id=t.connection_id
    and m.state='accepted' and m.receipt_id=p_data->>'message_id' and m.group_jid=p_data->>'group_jid'
    and m.sent_at>now()-interval '7 days';
  return jsonb_build_object('ok',found);
 end if;
 $b$;
 d:=replace(d,a,b||a);
 execute d;
end;$patch$;
commit;
 then p_data->>'error_code' else 'unknown' end else m.send_error_code end
   where m.owner_id=actor and m.device_id=p_device and m.connection_id=t.connection_id
    and m.state='accepted' and m.receipt_id=p_data->>'message_id' and m.group_jid=p_data->>'group_jid'
    and m.sent_at>now()-interval '7 days';
  return jsonb_build_object('ok',found);
 end if;
 $b$;
 d:=replace(d,a,b||a);
 execute d;
end;$patch$;
commit;
