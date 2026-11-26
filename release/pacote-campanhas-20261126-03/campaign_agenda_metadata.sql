-- Add read-only metadata to existing owner-scoped RPCs; no dispatch/data changes.
begin;
set local lock_timeout='5s';
do $patch$
declare d text; a text;
begin
 d:=pg_get_functiondef('public.neo_campaign_central_v1(text,jsonb)'::regprocedure);
 a:=$a$'id',b.id,'revision',b.revision,'due_at',b.due_at,$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'agenda_batch_anchor';end if;
 d:=replace(d,a,$b$'id',b.id,'revision',b.revision,'due_at',b.due_at,
       'configured_at',b.created_at,
       'origin',case when exists(select 1 from neo_private.campaign_weekly_occurrences o join neo_private.campaign_weekly_series s on s.id=o.series_id
         where o.batch_id=b.id and o.publication_id=pub.id and s.owner_id=actor and s.campaign_id=campaign_key) then 'recurring'
        else (select case when count(distinct e.event)=1 then min(e.event) else null end from neo_private.campaign_central_events e
         where e.campaign_id=campaign_key and e.publication_id=pub.id and e.actor_id=actor and e.revision=b.revision
          and e.recorded_at=b.created_at and e.event in ('publish','schedule')) end,
       'sent_at',(select max(m.sent_at) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor and m.state='accepted'),$b$);
 execute d;
 d:=pg_get_functiondef('public.neo_campaign_weekly_v1(text,jsonb)'::regprocedure);
 a:=$a$'rule',s.rule,'dates',$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'agenda_series_anchor';end if;
 d:=replace(d,a,$b$'rule',s.rule,'configured_at',s.created_at,
   'occurrences',coalesce((select jsonb_agg(jsonb_build_object('publication_id',o.publication_id,'batch_id',o.batch_id,'local_time',o.local_time) order by o.local_time)
     from neo_private.campaign_weekly_occurrences o where o.series_id=s.id),'[]'::jsonb),'dates',$b$);
 execute d;
end;$patch$;
commit;
