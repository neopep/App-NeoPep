-- Candidate after originals and shared queue patches. Existing jobs remain unchanged.
begin;
set local lock_timeout='5s';
create table neo_private.campaign_wa_review(
 batch_id uuid primary key references neo_private.campaign_wa_rich_batches(id),
 owner_id uuid not null references auth.users(id), state text not null default 'pending' check(state in ('pending','approved','rejected')),
 requested_at timestamptz not null default now(), reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 check((state='pending' and reviewed_by is null and reviewed_at is null) or (state<>'pending' and reviewed_by is not null and reviewed_by<>owner_id and reviewed_at is not null))
);
alter table neo_private.campaign_wa_review enable row level security;
revoke all on neo_private.campaign_wa_review from public,anon,authenticated;
create function neo_private.campaign_wa_review_allows(p_batch uuid) returns boolean
language sql stable security invoker set search_path='' as $allow$
 select not exists(select 1 from neo_private.campaign_wa_review r where r.batch_id=p_batch
  and (r.state<>'approved' or not exists(select 1 from neo_private.admin_members a where a.user_id=r.reviewed_by)))
$allow$;
revoke all on function neo_private.campaign_wa_review_allows(uuid) from public,anon,authenticated;
create function neo_private.campaign_wa_review_action(p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $review$
declare actor uuid:=auth.uid(); cid uuid:=(p_data->>'campaign_id')::uuid; pid uuid:=(p_data->>'publication_id')::uuid;
 req uuid:=(p_data->>'request_id')::uuid; bid uuid:=(p_data->>'batch_id')::uuid; v neo_private.campaign_editor_versions; rev neo_private.campaign_wa_review; batch neo_private.campaign_wa_rich_batches; result jsonb;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false) then raise exception 'review_admin_required' using errcode='42501';end if;
 if p_action='review_capabilities' then return jsonb_build_object('enabled',true,'text_links_only',true,'other_admins',exists(select 1 from neo_private.admin_members where user_id<>actor));end if;
 if p_action='review_list' then
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.requested_at desc) from (
   select r.batch_id,r.state,r.requested_at,r.reviewed_at,r.owner_id=actor as own,r.owner_id<>actor and r.state='pending' and b.cancelled_at is null as can_review,
    b.due_at,b.cancelled_at,ev.draft->>'title' as title,
    (select coalesce(jsonb_agg(distinct g.name order by g.name),'[]'::jsonb) from neo_private.campaign_wa_rich_messages m join neo_private.campaign_wa_sync_targets t on t.owner_id=b.owner_id and t.connection_id=m.connection_id and t.group_jid=m.group_jid join neo_private.campaign_wa_groups g on g.id=t.group_id where m.batch_id=b.id) as groups,
    (select coalesce(jsonb_agg(jsonb_build_object('type',x->>'type','text',x->>'text','url',x->>'url') order by n),'[]'::jsonb) from jsonb_array_elements(ev.draft->'blocks') with ordinality a(x,n)) as blocks
   from neo_private.campaign_wa_review r join neo_private.campaign_wa_rich_batches b on b.id=r.batch_id
   join neo_private.campaign_editor_versions ev on ev.editor_id=b.editor_id and ev.revision=b.revision and ev.owner_id=b.owner_id
   where r.owner_id=actor or (r.state='pending' and b.cancelled_at is null)
   order by r.requested_at desc limit 100) q),'[]'::jsonb);
 end if;
 if p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'review_confirmation_required' using errcode='22023';end if;
 if p_action in ('review_schedule','review_publish') then
  if req is null or cid is null or pid is null or not exists(select 1 from neo_private.admin_members where user_id<>actor) then raise exception 'review_other_admin_required' using errcode='22023';end if;
  perform 1 from neo_private.campaign_central_groups where campaign_id=cid and owner_id=actor and deleted_at is null and archived_at is null for update;
  if not found then raise exception 'review_owner_required' using errcode='42501';end if;
  select e.* into v from neo_private.campaign_central_publications p join neo_private.campaign_editor_versions e on e.editor_id=p.editor_id and e.owner_id=actor and e.channel='whatsapp' where p.id=pid and p.campaign_id=cid and p.deleted_at is null order by e.revision desc limit 1;
  if not found or v.revision is distinct from (p_data->>'revision')::int or exists(select 1 from jsonb_array_elements(v.draft->'blocks') x where x->>'type' not in ('text','link')) then raise exception 'review_requires_saved_text_links' using errcode='22023';end if;
  select * into batch from neo_private.campaign_wa_rich_batches where id=req;
  if found then
   if batch.owner_id=actor and batch.editor_id=v.editor_id and batch.revision=v.revision and exists(select 1 from neo_private.campaign_wa_review r where r.batch_id=req and r.owner_id=actor) then return jsonb_build_object('batch_id',req,'reused',true);end if;
   raise exception 'review_request_conflict' using errcode='23505';
  end if;
  result:=public.neo_campaign_central_v1(case when p_action='review_schedule' then 'schedule' else 'publish' end,p_data);
  if (result->>'batch_id')::uuid is distinct from req or result->'reused'='true'::jsonb then raise exception 'review_batch_not_new';end if;
  -- In the same transaction as job creation. No worker can see the batch before this hold exists.
  insert into neo_private.campaign_wa_review(batch_id,owner_id) values(req,actor);
  return result||'{"review_pending":true}'::jsonb;
 end if;
 if p_action not in ('review_approve','review_reject') or bid is null then raise exception 'review_action_invalid' using errcode='22023';end if;
 select * into rev from neo_private.campaign_wa_review where batch_id=bid for update;
 if not found or rev.owner_id=actor then raise exception 'review_independent_admin_required' using errcode='42501';end if;
 if rev.state=(case when p_action='review_approve' then 'approved' else 'rejected' end) then return jsonb_build_object('state',rev.state,'reused',true);end if;
 if rev.state<>'pending' or not exists(select 1 from neo_private.admin_members where user_id=rev.owner_id) or not exists(select 1 from neo_private.campaign_wa_rich_batches where id=bid and cancelled_at is null) or exists(select 1 from neo_private.campaign_wa_rich_messages where batch_id=bid and state<>'waiting') then raise exception 'review_no_longer_pending' using errcode='55000';end if;
 if p_action='review_approve' and (not exists(select 1 from neo_private.campaign_wa_rich_messages where batch_id=bid)
  or exists(select 1 from neo_private.campaign_wa_rich_messages m where m.batch_id=bid and not exists(select 1 from neo_private.campaign_wa_sync_targets t join neo_private.campaign_wa_groups g on g.id=t.group_id where t.owner_id=rev.owner_id and t.connection_id=m.connection_id and t.group_jid=m.group_jid and g.active)))
 then raise exception 'review_destinations_unavailable' using errcode='55000';end if;
 update neo_private.campaign_wa_review set state=case when p_action='review_approve' then 'approved' else 'rejected' end,reviewed_by=actor,reviewed_at=now() where batch_id=bid returning * into rev;
 return jsonb_build_object('state',rev.state);
end;$review$;
revoke all on function neo_private.campaign_wa_review_action(text,jsonb) from public,anon,authenticated;
do $patch$
declare d text:=pg_get_functiondef('public.neo_campaign_central_v1(text,jsonb)'::regprocedure);
 a constant text:=$a$ if p_action='legacy_states' then$a$;
begin
 if cardinality(string_to_array(d,a))<>2 then raise exception 'review_central_contract_changed';end if;
 execute replace(d,a,$a$ if p_action in ('review_capabilities','review_list','review_schedule','review_publish','review_approve','review_reject') then
  return neo_private.campaign_wa_review_action(p_action,p_data);
 end if;
$a$||a);
end;$patch$;
do $patch$
declare d text:=pg_get_functiondef('public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure);
 a constant text:=$a$and b.cancelled_at is null and job.state='waiting' and job.due_at<=now()$a$;
 b constant text:=$b$ if p_action='start' then$b$;
begin
 if cardinality(string_to_array(d,a))<>2 or cardinality(string_to_array(d,b))<>2 then raise exception 'review_worker_contract_changed';end if;
 d:=replace(d,a,a||' and neo_private.campaign_wa_review_allows(job.batch_id)');
 d:=replace(d,b,b||$b$
  if not neo_private.campaign_wa_review_allows(m.batch_id) then raise exception 'review_required' using errcode='42501';end if;$b$);
 execute d;
end;$patch$;
do $queue_patch$
declare d text:=pg_get_functiondef('neo_private.campaign_shared_queue(jsonb)'::regprocedure);
 a constant text:=$a$     when bool_or(m.state='waiting') then case when b.due_at>now() then 'scheduled' else 'waiting' end$a$;
begin
 if cardinality(string_to_array(d,a))<>2 then raise exception 'review_queue_contract_changed';end if;
 execute replace(d,a,$a$     when bool_or(m.state='waiting') and exists(select 1 from neo_private.campaign_wa_review r where r.batch_id=b.id and r.state='rejected') then 'review_rejected'
     when bool_or(m.state='waiting') and not neo_private.campaign_wa_review_allows(b.id) then 'review_pending'
$a$||a);
end;$queue_patch$;
commit;
