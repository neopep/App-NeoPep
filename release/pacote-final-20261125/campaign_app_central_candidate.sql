-- Candidata exclusiva de homologação; não aplicar em produção sem reconciliar contratos.
begin;
set local lock_timeout='5s';
create table neo_private.campaign_app_groups(
 campaign_id uuid primary key references neo_private.campaigns(id),
 owner_id uuid not null references auth.users(id),
 request_id uuid not null, created_at timestamptz not null default now(),
 archived_at timestamptz, deleted_at timestamptz, unique(owner_id,request_id)
);
create table neo_private.campaign_app_publications(
 id uuid primary key, campaign_id uuid not null references neo_private.campaign_app_groups(campaign_id),
 created_at timestamptz not null default now(), deleted_at timestamptz
);
create table neo_private.campaign_channel_copies(
 owner_id uuid not null references auth.users(id), request_id uuid not null,
 source_id uuid not null references neo_private.campaigns(id),
 target_id uuid not null references neo_private.campaigns(id),
 source_channel text not null check(source_channel in ('app','whatsapp')),
 created_at timestamptz not null default now(), primary key(owner_id,request_id),unique(target_id)
);
alter table neo_private.campaign_app_groups enable row level security;
alter table neo_private.campaign_app_publications enable row level security;
alter table neo_private.campaign_channel_copies enable row level security;
revoke all on neo_private.campaign_app_groups,neo_private.campaign_app_publications,neo_private.campaign_channel_copies from public,anon,authenticated;

create function neo_private.campaign_app_central(p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $app$
declare
 actor uuid:=auth.uid(); parent neo_private.campaign_app_groups;
 pub neo_private.campaign_app_publications; latest neo_private.campaign_editor_versions;
 campaign_key uuid:=(p_data->>'campaign_id')::uuid;
 publication_key uuid:=(p_data->>'publication_id')::uuid;
 request_key uuid:=(p_data->>'request_id')::uuid;
 title_text text; result jsonb; draft_data jsonb;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false)
 or coalesce(auth.jwt()->>'iss','')<>'https://qnuluspqfazdppciermw.supabase.co/auth/v1'
 then raise exception 'campaign_app_admin_required' using errcode='42501';end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc,q.campaign_id) from (
   select g.campaign_id,g.created_at,g.archived_at,c.title,
   (select count(*) from neo_private.campaign_app_publications p where p.campaign_id=g.campaign_id and p.deleted_at is null) publications,
   (select count(*) from neo_private.campaign_app_publications p where p.campaign_id=g.campaign_id and p.deleted_at is null and not exists(select 1 from neo_private.campaign_test_batches b where b.editor_id=p.id)) drafts,
   (select min(b.starts_at) from neo_private.campaign_app_publications p join neo_private.campaign_test_batches b on b.editor_id=p.id and b.owner_id=actor where p.campaign_id=g.campaign_id and p.deleted_at is null and b.cancelled_at is null and b.starts_at>now()) next_at,
   (select count(*) from neo_private.campaign_app_publications p join neo_private.campaign_test_batches b on b.editor_id=p.id and b.owner_id=actor where p.campaign_id=g.campaign_id and p.deleted_at is null and b.cancelled_at is null and b.starts_at+interval '24 hours'>now()) pending,
   0 as problems,(select source_channel from neo_private.campaign_channel_copies x where x.target_id=g.campaign_id and x.owner_id=actor) origin_channel
   from neo_private.campaign_app_groups g join neo_private.campaigns c on c.id=g.campaign_id
   where g.owner_id=actor and g.deleted_at is null order by g.created_at desc,g.campaign_id
   limit 50 offset greatest(coalesce((p_data->>'offset')::integer,0),0)) q),'[]'::jsonb);
 end if;
 if p_action='create' then
  title_text:=btrim(p_data->>'title');
  if request_key is null or coalesce(length(title_text),0) not between 1 and 120 then raise exception 'campaign_app_invalid_title' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended('campaign-app-create:'||actor::text||':'||request_key::text,0));
  select * into parent from neo_private.campaign_app_groups where owner_id=actor and request_id=request_key;
  if found then return jsonb_build_object('campaign_id',parent.campaign_id);end if;
  result:=public.neo_campaign_admin('save',null,jsonb_build_object('title',title_text,'body','','structured_review_only',true,'whatsapp_enabled',false,'popup_enabled',false,'push_requested',false));
  campaign_key:=(result->>'id')::uuid;
  insert into neo_private.campaign_app_groups(campaign_id,owner_id,request_id) values(campaign_key,actor,request_key);
  return jsonb_build_object('campaign_id',campaign_key);
 end if;
 select * into parent from neo_private.campaign_app_groups where campaign_id=campaign_key and owner_id=actor for update;
 if not found or parent.deleted_at is not null then raise exception 'campaign_app_owner_required' using errcode='42501';end if;
 if p_action='get' then
  return jsonb_build_object('campaign_id',campaign_key,'title',(select c.title from neo_private.campaigns c where c.id=campaign_key),'archived_at',parent.archived_at,
   'origin_channel',(select source_channel from neo_private.campaign_channel_copies x where x.target_id=campaign_key and x.owner_id=actor),
   'events','[]'::jsonb,'publications',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'editor_id',p.id,'deleted_at',p.deleted_at,'revision',v.revision,
    'title',v.draft->>'title','planned_local',v.draft->>'planned_local',
    'kinds',(select jsonb_agg(b->>'type') from jsonb_array_elements(v.draft->'blocks') b),
    'batches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'due_at',b.starts_at,'cancelled_at',b.cancelled_at,
     'states',jsonb_build_array(case when exists(select 1 from neo_private.campaign_test_recipients r where r.batch_id=b.id and r.displayed_at is not null) then 'accepted'
      when b.cancelled_at is not null then 'cancelled' when b.starts_at+interval '24 hours'<=now() then 'cancelled' else 'waiting' end))
     order by b.created_at desc) from neo_private.campaign_test_batches b where b.editor_id=p.id and b.owner_id=actor),'[]'::jsonb)) order by p.created_at,p.id)
    from neo_private.campaign_app_publications p join lateral(select revision,draft from neo_private.campaign_editor_versions ev where ev.editor_id=p.id and ev.owner_id=actor and ev.channel='app' order by revision desc limit 1)v on true where p.campaign_id=campaign_key),'[]'::jsonb));
 end if;
 if p_action in ('archive','delete') then
  if p_action='delete' and p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'campaign_app_confirmation_required' using errcode='22023';end if;
  if exists(select 1 from neo_private.campaign_app_publications p join neo_private.campaign_test_batches b on b.editor_id=p.id where p.campaign_id=campaign_key and b.cancelled_at is null and b.starts_at+interval '24 hours'>now())
  then raise exception 'campaign_app_pending_batches' using errcode='55000';end if;
  update neo_private.campaign_app_groups set archived_at=coalesce(archived_at,now()),deleted_at=case when p_action='delete' then now() else deleted_at end where campaign_id=campaign_key;
  return '{}'::jsonb;
 end if;
 if p_action='rename' then
  title_text:=btrim(p_data->>'title');
  if parent.archived_at is not null or coalesce(length(title_text),0) not between 1 and 120 then raise exception 'campaign_app_invalid_title' using errcode='22023';end if;
  update neo_private.campaigns set title=title_text,updated_at=now() where id=campaign_key;return '{}'::jsonb;
 end if;
 select * into pub from neo_private.campaign_app_publications where id=publication_key and campaign_id=campaign_key for update;
 if found then select * into latest from neo_private.campaign_editor_versions where editor_id=pub.id and owner_id=actor and channel='app' order by revision desc limit 1;end if;
 if p_action='load' then return case when latest.editor_id is not null then to_jsonb(latest)-'owner_id'-'request_id' end;end if;
 if parent.archived_at is not null or pub.deleted_at is not null then raise exception 'campaign_app_archived' using errcode='55000';end if;
 if p_action='delete_publication' then
  if pub.id is null or p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'campaign_app_confirmation_required' using errcode='22023';end if;
  if exists(select 1 from neo_private.campaign_test_batches b where b.editor_id=pub.id and b.cancelled_at is null and b.starts_at+interval '24 hours'>now()) then raise exception 'campaign_app_pending_batches' using errcode='55000';end if;
  update neo_private.campaign_app_publications set deleted_at=now() where id=pub.id;return '{}'::jsonb;
 end if;
 if p_action in ('save','duplicate') then
  if publication_key is null or request_key is null then raise exception 'campaign_app_invalid_request' using errcode='22023';end if;
  if p_action='duplicate' then
   if latest.editor_id is null then raise exception 'campaign_app_publication_unavailable' using errcode='42501';end if;
   draft_data:=latest.draft||jsonb_build_object('title',left(latest.draft->>'title',111)||' (Cópia)','planned_local',coalesce(p_data->>'planned_local',''));
   publication_key:=request_key;
   select * into pub from neo_private.campaign_app_publications where id=publication_key and campaign_id=campaign_key;
  else
   if exists(select 1 from neo_private.campaign_test_batches where editor_id=publication_key) then raise exception 'campaign_app_revision_locked' using errcode='55000';end if;
   draft_data:=p_data->'draft';
  end if;
  if pub.id is null then insert into neo_private.campaign_app_publications(id,campaign_id) values(publication_key,campaign_key);end if;
  return public.neo_campaign_editor_v1('save',jsonb_build_object('channel','app','editor_id',publication_key,'request_id',request_key,
   'revision',case when p_action='duplicate' then 0 else (p_data->>'revision')::int end,'source_id',campaign_key,'draft',draft_data));
 end if;
 if latest.editor_id is null then raise exception 'campaign_app_publication_unavailable' using errcode='42501';end if;
 if p_action in ('schedule','publish') then
  if latest.revision is distinct from (p_data->>'revision')::int or p_data->'confirmed' is distinct from 'true'::jsonb or request_key is null then raise exception 'campaign_app_confirmation_required' using errcode='22023';end if;
  if p_action='schedule' and (nullif(p_data->>'local_time','') is null or p_data->>'local_time' is distinct from latest.draft->>'planned_local') then raise exception 'campaign_app_time_changed' using errcode='22023';end if;
  return public.neo_campaign_test_admin_v1('publish',jsonb_build_object('editor_id',pub.id,'revision',latest.revision,'request_id',request_key,'confirmed',true,
   'local_time',case when p_action='schedule' then p_data->>'local_time' end,'destination_count',p_data->'destination_count','audience_key',p_data->'audience_key'));
 end if;
 if p_action='cancel' then
  if not exists(select 1 from neo_private.campaign_test_batches b where b.editor_id=pub.id and b.id=(p_data->>'batch_id')::uuid and b.owner_id=actor) then raise exception 'campaign_app_batch_unavailable' using errcode='42501';end if;
  return public.neo_campaign_test_admin_v1('cancel',jsonb_build_object('batch_id',p_data->>'batch_id'));
 end if;
 raise exception 'campaign_app_unknown_action' using errcode='22023';
end;$app$;
revoke all on function neo_private.campaign_app_central(text,jsonb) from public,anon,authenticated;

-- Preserve the existing WhatsApp RPC and its authorization; add a distinct route.
do $patch$
declare definition text:=pg_get_functiondef('public.neo_campaign_central_v1(text,jsonb)'::regprocedure);
 anchor constant text:=$a$ if p_action='legacy_states' then$a$;
begin
 if cardinality(string_to_array(definition,anchor))<>2 then raise exception 'campaign_central_unexpected_definition';end if;
 execute replace(definition,anchor,$b$ if left(p_action,4)='app_' then
  return neo_private.campaign_app_central(substr(p_action,5),p_data);
 end if;
$b$||anchor);
end;$patch$;
commit;
