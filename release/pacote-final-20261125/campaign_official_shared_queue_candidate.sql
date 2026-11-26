-- Read-only consolidated queue for authenticated administrative staff in Produção. Candidate only.
-- No group JIDs, private media, credentials or message bodies are returned.
begin;
create function neo_private.campaign_shared_queue(p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $queue$
declare actor uuid:=auth.uid();
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false)
 or coalesce(auth.jwt()->>'iss','')<>'https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1'
 then raise exception 'campaign_queue_admin_required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.due_at desc nulls last,q.id) from (
  select 'connect'::text as channel,b.id,coalesce(v.draft->>'title','Publicação') as title,b.due_at,
    b.owner_id=actor as own,
    case when bool_or(m.state='uncertain') then 'uncertain'
     when bool_or(m.state in ('started','leased')) then 'in_progress'
     when bool_or(m.state='refused') then 'refused'
     when bool_or(m.state='waiting') then case when b.due_at>now() then 'scheduled' else 'waiting' end
     when bool_or(m.state='accepted') then 'accepted' else 'cancelled' end as state,
    count(m.id)::int as messages
  from neo_private.campaign_wa_rich_batches b
  join neo_private.campaign_wa_rich_messages m on m.batch_id=b.id
  left join neo_private.campaign_editor_versions v on v.editor_id=b.editor_id and v.revision=b.revision and v.owner_id=b.owner_id
  where b.due_at>=now()-interval '30 days'
  group by b.id,v.draft
  union all
  select 'manual',p.id,c.title,coalesce(p.dispatch_due,p.scheduled_at),
    coalesce(t.owner_id=actor,false),
    case when p.dispatch_state='uncertain' then 'uncertain'
     when p.dispatch_state in ('leased','started') then 'in_progress'
     when p.dispatch_state='accepted' then 'accepted'
     when p.dispatch_state='waiting' then case when coalesce(p.dispatch_due,p.scheduled_at)>now() then 'scheduled' else 'waiting' end
     when p.status='done' then 'manual_done'
     when p.status='cancelled' then 'cancelled'
     when p.scheduled_at>now() then 'scheduled' else 'waiting' end,
    1
  from neo_private.campaign_wa_publications p join neo_private.campaigns c on c.id=p.campaign_id
  left join neo_private.campaign_wa_sync_targets t on t.group_id=p.group_id
  where coalesce(p.dispatch_due,p.scheduled_at)>=now()-interval '30 days'
    or (p.scheduled_at is null and p.dispatch_due is null and p.status='pending')
  order by due_at desc nulls last,id limit 200
 ) q),'[]'::jsonb);
end;$queue$;
revoke all on function neo_private.campaign_shared_queue(jsonb) from public,anon,authenticated;
do $patch$
declare definition text:=pg_get_functiondef('public.neo_campaign_central_v1(text,jsonb)'::regprocedure);
 anchor constant text:=$a$ if p_action='legacy_states' then$a$;
begin
 if cardinality(string_to_array(definition,anchor))<>2 then raise exception 'campaign_queue_unexpected_definition';end if;
 execute replace(definition,anchor,$b$ if p_action='shared_queue' then
  return neo_private.campaign_shared_queue(p_data);
 end if;
$b$||anchor);
end;$patch$;
commit;
