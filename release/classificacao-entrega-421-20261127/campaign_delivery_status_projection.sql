-- Classificação de entrega independente da máquina de estados da fila.
-- Não altera mensagens, filas, tentativas, recibos, permissões ou allowlists.
do $patch$
declare f regprocedure:='public.neo_campaign_rich_admin_v1(text,jsonb)'::regprocedure;
 d text; a text; b text;
begin
 perform set_config('lock_timeout','5s',true);
 d:=pg_get_functiondef(f);
 a:=$a$   select m.id,m.batch_id,m.sequence,m.kind,m.state as dispatch_state,m.attempts as dispatch_attempts,
     m.due_at as scheduled_at,m.sent_at,m.receipt_id is not null as has_receipt,$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'campaign_status_contract_changed';end if;
 b:=$b$   select m.id,m.batch_id,m.sequence,m.kind,
     case when m.state='accepted' and m.send_error_at is not null and m.delivery_ack_at is null then 'failed' else m.state end as dispatch_state,
     m.state as transport_state,
     case when m.state='accepted' then
       case when m.delivery_ack_at is not null then 'delivered'
            when m.send_error_at is not null then 'rejected'
            when m.server_ack_at is not null then 'server_ack'
            else 'awaiting_confirmation' end
       else m.state end as delivery_state,
     m.attempts as dispatch_attempts,
     m.due_at as scheduled_at,m.sent_at,m.receipt_id is not null as has_receipt,
     m.receipt_id is not null as has_local_receipt,
     m.server_ack_at,m.delivery_ack_at,m.send_error_at,m.send_error_code,$b$;
 if strpos(d,'as delivery_state')>0 then raise exception 'campaign_status_already_patched';end if;
 execute replace(d,a,b);
end;$patch$;
