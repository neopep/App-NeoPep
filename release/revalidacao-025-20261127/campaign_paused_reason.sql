-- Apply only after successful 0.2.25 Windows build. Local pre-transmission block, not remote rejection.
do $patch$
declare f regprocedure; d text; a text; b text;
begin
 perform set_config('lock_timeout','5s',true);
 alter table neo_private.campaign_wa_rich_messages add column if not exists blocked_reason text check (blocked_reason is null or blocked_reason='previous_421');
 f:='public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);
 a:=$a$   sent_at=now(),lease_until=null where id=m.id;$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'finish_contract_changed';end if;
 b:=$b$   sent_at=now(),lease_until=null,
   blocked_reason=case when outcome='refused' and d.version='0.2.25' and p_data->>'blocked_reason'='previous_421' and receipt is null then 'previous_421' else null end
   where id=m.id;$b$;
 execute replace(d,a,b);
 f:='public.neo_campaign_rich_admin_v1(text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);
 a:=$a$     case when m.state='accepted' then
       case when m.delivery_ack_at is not null then 'delivered'$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'delivery_projection_changed';end if;
 b:=$b$     case when m.state='refused' and m.blocked_reason='previous_421' then 'paused_previous_421'
     when m.state='accepted' then
       case when m.delivery_ack_at is not null then 'delivered'$b$;
 d:=replace(d,a,b);
 a:=$a$     m.server_ack_at,m.delivery_ack_at,m.send_error_at,m.send_error_code,$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'admin_status_contract_changed';end if;
 execute replace(d,a,a||'m.blocked_reason,');
 f:='public.neo_campaign_central_v1(text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);
 a:=$a$       'delivery_count',(select count(*) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor and m.state='accepted' and m.delivery_ack_at is not null),$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'central_delivery_contract_changed';end if;
 b:=$b$
       'blocked_count',(select count(*) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor and m.state='refused' and m.blocked_reason='previous_421'),
       'blocked_reason','previous_421',$b$;
 d:=replace(d,a,a||b);
 a:=$a$          count(*) filter(where m.state='accepted' and m.delivery_ack_at is not null) as delivery_count,$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'central_group_contract_changed';end if;
 b:=$b$
          count(*) filter(where m.state='refused' and m.blocked_reason='previous_421') as blocked_count,$b$;
 execute replace(d,a,a||b);
end;$patch$;
