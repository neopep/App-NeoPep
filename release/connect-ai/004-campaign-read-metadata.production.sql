do $patch$
declare
 d text:=pg_get_functiondef('public.neo_campaign_central_v1(text,jsonb)'::regprocedure);
 marker constant text:=$a$'cancelled_at',b.cancelled_at,'states',(select jsonb_agg(m.state order by m.sequence)$a$;
 extra constant text:=$b$'message_count',(select count(*) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor),
       'receipt_count',(select count(*) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor and m.state='accepted' and m.sent_at is not null and nullif(m.receipt_id,'') is not null),
       'group_count',(select count(distinct (m.connection_id,m.group_jid)) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor),
       'group_names',(select coalesce(jsonb_agg(distinct coalesce(nullif(s.display_name,''),nullif(g.name,''))) filter (where coalesce(nullif(s.display_name,''),nullif(g.name,'')) is not null),'[]'::jsonb)
          from neo_private.campaign_wa_rich_messages m
          left join neo_private.connect_wa_connections c on c.id=m.connection_id and c.owner_id=actor
          left join neo_private.connect_wa_selected_groups s on s.connection_id=c.id and s.group_jid=m.group_jid
          left join neo_private.campaign_wa_sync_targets t on t.owner_id=actor and t.connection_id=m.connection_id and t.group_jid=m.group_jid
          left join neo_private.campaign_wa_groups g on g.id=t.group_id
          where m.batch_id=b.id and m.owner_id=actor),
       $b$;
begin
 if position(marker in d)=0 or (length(d)-length(replace(d,marker,'')))<>length(marker) then
  raise exception 'connect_ai_campaign_metadata_marker_mismatch';
 end if;
 if position('''receipt_count''' in d)>0 then raise exception 'connect_ai_campaign_metadata_already_present'; end if;
 execute replace(d,marker,extra||marker);
end
$patch$;
