-- Read-only per-destination receipt summaries. Preserve owner authorization and existing dispatch behavior.
begin;
set local lock_timeout='5s';
do $patch$
declare def text; anchor text:=$a$       'message_count',(select count(*) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor),$a$; addition text:=$a$       'group_results',coalesce((select jsonb_agg(to_jsonb(gr) order by gr.first_sequence) from (
         select coalesce(max(nullif(s.display_name,'')),max(nullif(g.name,'')),'Grupo sem nome registrado') as name,
          min(m.sequence) as first_sequence,jsonb_agg(m.state order by m.sequence) as states,count(*) as message_count,
          sum(m.attempts) as attempt_count,
          count(*) filter(where m.state='accepted' and m.server_ack_at is not null) as server_ack_count,
          count(*) filter(where m.state='accepted' and m.delivery_ack_at is not null) as delivery_count,
          count(*) filter(where m.state='accepted' and m.send_error_at is not null and m.delivery_ack_at is null) as send_error_count,
          coalesce(jsonb_agg(distinct m.send_error_code) filter(where m.state='accepted' and m.send_error_at is not null and m.delivery_ack_at is null and m.send_error_code is not null),'[]'::jsonb) as send_error_codes,
          max(m.delivery_ack_at) filter(where m.state='accepted') as delivered_at,
          max(m.send_error_at) filter(where m.state='accepted' and m.delivery_ack_at is null) as failed_at
         from neo_private.campaign_wa_rich_messages m
         left join neo_private.connect_wa_connections c on c.id=m.connection_id and c.owner_id=actor
         left join neo_private.connect_wa_selected_groups s on s.connection_id=c.id and s.group_jid=m.group_jid
         left join lateral (select gg.name from neo_private.campaign_wa_sync_targets t join neo_private.campaign_wa_groups gg on gg.id=t.group_id
          where t.owner_id=actor and t.connection_id=m.connection_id and t.group_jid=m.group_jid limit 1) g on true
         where m.batch_id=b.id and m.owner_id=actor group by m.connection_id,m.group_jid
        ) gr),'[]'::jsonb),
$a$;
begin
 def:=pg_get_functiondef('public.neo_campaign_central_v1(text,jsonb)'::regprocedure);
 if strpos(def,'''group_results''')>0 or strpos(def,anchor)=0 or (length(def)-length(replace(def,anchor,'')))<>length(anchor) then raise exception 'group_results_contract_mismatch';end if;
 execute replace(def,anchor,addition||anchor);
end;$patch$;
commit;
