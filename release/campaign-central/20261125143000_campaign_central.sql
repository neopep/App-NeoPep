begin;
set local lock_timeout='5s';

create table neo_private.campaign_central_groups (
 campaign_id uuid primary key references neo_private.campaigns(id),
 owner_id uuid not null,
 request_id uuid not null,
 created_at timestamptz not null default now(),
 archived_at timestamptz,
 default_destination text,
 unique(owner_id,request_id)
);

create table neo_private.campaign_central_publications (
 id uuid primary key,
 campaign_id uuid not null references neo_private.campaign_central_groups(campaign_id),
 editor_id uuid not null unique,
 source_id uuid,
 created_at timestamptz not null default now()
);
create index campaign_central_publications_group on neo_private.campaign_central_publications(campaign_id);

create table neo_private.campaign_central_events (
 id bigint generated always as identity primary key,
 campaign_id uuid not null references neo_private.campaign_central_groups(campaign_id),
 publication_id uuid references neo_private.campaign_central_publications(id),
 actor_id uuid not null,
 event text not null,
 revision integer,
 recorded_at timestamptz not null default now()
);
create index campaign_central_events_group on neo_private.campaign_central_events(campaign_id, id desc);

alter table neo_private.campaign_central_groups enable row level security;
alter table neo_private.campaign_central_publications enable row level security;
alter table neo_private.campaign_central_events enable row level security;
revoke all on neo_private.campaign_central_groups,neo_private.campaign_central_publications,neo_private.campaign_central_events from public,anon,authenticated;

-- Adopt structured WhatsApp drafts only. Leave manual campaigns, revisions and dispatches in place.
insert into neo_private.campaign_central_groups(campaign_id,owner_id,request_id)
 select distinct on (v.campaign_id) v.campaign_id,v.owner_id,v.campaign_id
 from neo_private.campaign_editor_versions v join neo_private.campaigns c on c.id=v.campaign_id
 where v.channel='whatsapp' and c.structured_review_only
 order by v.campaign_id,v.created_at desc;

insert into neo_private.campaign_central_publications(id,campaign_id,editor_id,source_id)
 select distinct on (v.editor_id) v.editor_id,v.campaign_id,v.editor_id,v.source_id
 from neo_private.campaign_editor_versions v join neo_private.campaign_central_groups g on g.campaign_id=v.campaign_id
 where v.channel='whatsapp' and v.owner_id=g.owner_id
 order by v.editor_id,v.revision desc;

-- Serialize editorial and delivery mutations even when an older client calls a legacy RPC.
create function neo_private.campaign_central_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare linked neo_private.campaign_central_publications;
begin
 select * into linked from neo_private.campaign_central_publications where editor_id=new.editor_id for update;
 if not found then return new; end if;
 if tg_table_name='campaign_dispatch_batch' then
  raise exception 'campaign_central_requires_rich_dispatch' using errcode='55000';
 end if;
 if exists(select 1 from neo_private.campaign_central_groups where campaign_id=linked.campaign_id and archived_at is not null)
   or exists(select 1 from neo_private.campaign_wa_rich_batches b where b.editor_id=linked.editor_id
      and (b.cancelled_at is null or exists(select 1 from neo_private.campaign_wa_rich_messages m
        where m.batch_id=b.id and m.state<>'cancelled'))) then
  raise exception 'campaign_central_publication_locked' using errcode='55000';
 end if;
 if tg_table_name='campaign_wa_rich_batches' and exists(select 1 from neo_private.campaign_editor_versions v
    where v.editor_id=linked.editor_id and v.revision>new.revision) then
  raise exception 'campaign_central_revision_changed' using errcode='40001';
 end if;
 return new;
end;
$$;
revoke all on function neo_private.campaign_central_guard() from public,anon,authenticated;
create trigger campaign_central_guard_revision before insert on neo_private.campaign_editor_versions
 for each row execute function neo_private.campaign_central_guard();
create trigger campaign_central_guard_rich before insert on neo_private.campaign_wa_rich_batches
 for each row execute function neo_private.campaign_central_guard();
create trigger campaign_central_guard_legacy before insert on neo_private.campaign_dispatch_batch
 for each row execute function neo_private.campaign_central_guard();

create function public.neo_campaign_central_v1(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
<<rename>>
declare
 actor uuid:=auth.uid();
 parent neo_private.campaign_central_groups;
 publication neo_private.campaign_central_publications;
 latest neo_private.campaign_editor_versions;
 campaign_key uuid;
 publication_key uuid;
 request_key uuid;
 title text;
 args jsonb;
 result jsonb;
 event_name text;
 due text;
 previous_batch uuid;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false)
    or coalesce(auth.jwt()->>'iss','')<>'https://qnuluspqfazdppciermw.supabase.co/auth/v1' then
  raise exception 'campaign_central_admin_required' using errcode='42501';
 end if;
 if jsonb_typeof(p_data) is distinct from 'object' then
  raise exception 'campaign_central_invalid_payload' using errcode='22023';
 end if;

 if p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc,c.campaign_id)
   from (select g.campaign_id,g.created_at,g.archived_at,c.title,
    (select count(*) from neo_private.campaign_central_publications pub where pub.campaign_id=g.campaign_id) as publications,
    (select min(b.due_at) from neo_private.campaign_central_publications pub
      join neo_private.campaign_wa_rich_batches b on b.editor_id=pub.editor_id and b.owner_id=actor
      where pub.campaign_id=g.campaign_id and b.cancelled_at is null and b.due_at>now()) as next_at,
    (select count(distinct pub.id) from neo_private.campaign_central_publications pub
     join neo_private.campaign_wa_rich_batches b on b.editor_id=pub.editor_id and b.owner_id=actor
     join neo_private.campaign_wa_rich_messages m on m.batch_id=b.id
     where pub.campaign_id=g.campaign_id and m.state in ('waiting','leased','started')) as pending,
    (select count(distinct pub.id) from neo_private.campaign_central_publications pub
     join neo_private.campaign_wa_rich_batches b on b.editor_id=pub.editor_id and b.owner_id=actor
     join neo_private.campaign_wa_rich_messages m on m.batch_id=b.id
     where pub.campaign_id=g.campaign_id and m.state in ('uncertain','refused')) as problems,
    (select count(*) from neo_private.campaign_central_publications pub
      where pub.campaign_id=g.campaign_id and not exists
        (select 1 from neo_private.campaign_wa_rich_batches b where b.editor_id=pub.editor_id and b.owner_id=actor)) as drafts
    from neo_private.campaign_central_groups g join neo_private.campaigns c on c.id=g.campaign_id
    where g.owner_id=actor order by g.created_at desc,g.campaign_id
    limit 50 offset greatest(coalesce((p_data->>'offset')::integer,0),0)) c),'[]'::jsonb);
 end if;

 campaign_key:=(p_data->>'campaign_id')::uuid;
 request_key:=(p_data->>'request_id')::uuid;
 if p_action='adopt' then
  select * into latest from neo_private.campaign_editor_versions v where v.campaign_id=campaign_key
   and v.owner_id=actor and v.channel='whatsapp' order by v.revision desc limit 1;
  if not found or not exists(select 1 from neo_private.campaigns where id=campaign_key and structured_review_only) then
   raise exception 'campaign_central_adoption_unavailable' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('campaign-central-adopt:'||latest.editor_id::text,0));
  select pub.campaign_id into campaign_key from neo_private.campaign_central_publications pub
   where pub.editor_id=latest.editor_id;
  if found then return jsonb_build_object('campaign_id',campaign_key); end if;
  campaign_key:=latest.campaign_id;
  insert into neo_private.campaign_central_groups(campaign_id,owner_id,request_id) values(campaign_key,actor,campaign_key);
  insert into neo_private.campaign_central_publications(id,campaign_id,editor_id,source_id)
   values(latest.editor_id,campaign_key,latest.editor_id,latest.source_id);
  return jsonb_build_object('campaign_id',campaign_key);
 end if;
 if p_action='create' then
  title:=btrim(p_data->>'title');
  if request_key is null or title is null or length(title) not between 1 and 120 then
   raise exception 'campaign_central_invalid_title' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('campaign-central:'||actor::text||':'||request_key::text,0));
  select * into parent from neo_private.campaign_central_groups where owner_id=actor and request_id=request_key;
  if found then return jsonb_build_object('campaign_id',parent.campaign_id); end if;
  due:=nullif(p_data->>'destination','');
  if due is not null and not exists(select 1 from neo_private.campaign_wa_test_config t
   where t.owner_id=actor and t.enabled and due=t.connection_id::text||':'||t.group_jid) then
   raise exception 'campaign_central_destination_unavailable' using errcode='42501';
  end if;
  result:=public.neo_campaign_admin('save',null,jsonb_build_object('title',title,'body','',
    'structured_review_only',true,'whatsapp_enabled',false,'popup_enabled',false,'push_requested',false));
  campaign_key:=(result->>'id')::uuid;
  insert into neo_private.campaign_central_groups(campaign_id,owner_id,request_id,default_destination) values(campaign_key,actor,request_key,due);
  insert into neo_private.campaign_central_events(campaign_id,actor_id,event) values(campaign_key,actor,'created');
  return jsonb_build_object('campaign_id',campaign_key);
 end if;

 select * into parent from neo_private.campaign_central_groups
 where campaign_id=campaign_key and owner_id=actor for update;
 if not found then raise exception 'campaign_central_owner_required' using errcode='42501'; end if;

 if p_action='get' then
  return jsonb_build_object('campaign_id',campaign_key,'title',(select c.title from neo_private.campaigns c where id=campaign_key),
   'archived_at',parent.archived_at,'default_destination',parent.default_destination,
   'publications',coalesce((select jsonb_agg(jsonb_build_object('id',pub.id,'editor_id',pub.editor_id,
     'revision',v.revision,'title',v.draft->>'title','planned_local',v.draft->>'planned_local',
     'kinds', (select jsonb_agg(item->>'type') from jsonb_array_elements(v.draft->'blocks') item),
     'batches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'revision',b.revision,'due_at',b.due_at,
       'cancelled_at',b.cancelled_at,'states',(select jsonb_agg(m.state order by m.sequence)
       from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id)) order by b.created_at desc)
       from neo_private.campaign_wa_rich_batches b where b.editor_id=pub.editor_id and b.owner_id=actor),'[]'::jsonb))
     order by pub.created_at,pub.id)
     from neo_private.campaign_central_publications pub join lateral (
       select ev.revision,ev.draft from neo_private.campaign_editor_versions ev where ev.editor_id=pub.editor_id
       and ev.owner_id=actor order by ev.revision desc limit 1
     ) v on true where pub.campaign_id=campaign_key),'[]'::jsonb),
   'events',coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from
     (select id,publication_id,event,revision,recorded_at from neo_private.campaign_central_events
      where campaign_id=campaign_key order by id desc limit 100) a),'[]'::jsonb));
 end if;

 if p_action='rename' then
  title:=btrim(p_data->>'title');
  if parent.archived_at is not null or title is null or length(title) not between 1 and 120 then
   raise exception 'campaign_central_invalid_title' using errcode='22023';
  end if;
  update neo_private.campaigns set title=rename.title,updated_at=now()
   where id=campaign_key and neo_private.campaigns.title is distinct from rename.title;
  if found then insert into neo_private.campaign_central_events(campaign_id,actor_id,event) values(campaign_key,actor,'renamed'); end if;
  return '{}'::jsonb;
 end if;
 if p_action='archive' then
  perform 1 from neo_private.campaign_central_publications where campaign_id=campaign_key for update;
  if exists(select 1 from neo_private.campaign_central_publications pub
   join neo_private.campaign_wa_rich_batches b on b.editor_id=pub.editor_id
   join neo_private.campaign_wa_rich_messages m on m.batch_id=b.id
   where pub.campaign_id=campaign_key and m.state in ('waiting','leased','started')) then
   raise exception 'campaign_central_dispatch_pending' using errcode='55000';
  end if;
  if parent.archived_at is null then
   update neo_private.campaign_central_groups set archived_at=now() where campaign_id=campaign_key;
   insert into neo_private.campaign_central_events(campaign_id,actor_id,event) values(campaign_key,actor,'archived');
  end if;
  return '{}'::jsonb;
 end if;

 publication_key:=(p_data->>'publication_id')::uuid;
 select * into publication from neo_private.campaign_central_publications
 where id=publication_key and campaign_id=campaign_key for update;
 if found then
  select * into latest from neo_private.campaign_editor_versions where editor_id=publication.editor_id and owner_id=actor
   order by revision desc limit 1;
 end if;
 if p_action='load' then
  return case when latest.editor_id is not null then to_jsonb(latest)-'owner_id'-'request_id' end;
 end if;
 if parent.archived_at is not null then raise exception 'campaign_central_archived' using errcode='55000'; end if;

 if p_action='save' or p_action='duplicate' then
  if request_key is null or publication_key is null then raise exception 'campaign_central_invalid_request' using errcode='22023'; end if;
  if exists(select 1 from neo_private.campaign_wa_rich_batches b where b.editor_id=publication.editor_id
   and (b.cancelled_at is null or exists(select 1 from neo_private.campaign_wa_rich_messages m
    where m.batch_id=b.id and m.state<>'cancelled'))) and p_action='save' then
   raise exception 'campaign_central_revision_locked' using errcode='55000';
  end if;
  if p_action='duplicate' then
   if latest.editor_id is null then raise exception 'campaign_central_publication_unavailable' using errcode='42501'; end if;
   args:=jsonb_build_object('revision',0,'draft',latest.draft||jsonb_build_object(
     'title',left(latest.draft->>'title',111)||' (Cópia)','planned_local',coalesce(p_data->>'planned_local','')));
   publication_key:=request_key;
   select * into publication from neo_private.campaign_central_publications where id=publication_key and campaign_id=campaign_key;
  else
   args:=p_data;
  end if;
  if publication.id is null then
   insert into neo_private.campaign_central_publications(id,campaign_id,editor_id,source_id)
    values(publication_key,campaign_key,publication_key,campaign_key) returning * into publication;
  end if;
  due:=nullif(args->'draft'->>'planned_local','');
  if due is not null then perform neo_private.campaign_wall_time(due,'America/Sao_Paulo'); end if;
  select to_jsonb(v)-'owner_id'-'request_id' into result from neo_private.campaign_editor_versions v
   where v.editor_id=publication.editor_id and v.owner_id=actor and v.request_id=request_key;
  if found and p_action='duplicate' then return result; end if;
  if latest.campaign_id=campaign_key then select c.title into title from neo_private.campaigns c where c.id=campaign_key for update; end if;
  result:=public.neo_campaign_editor_v1('save',jsonb_build_object('channel','whatsapp',
   'editor_id',publication.editor_id,'request_id',request_key,'revision',args->'revision',
   'source_id',publication.source_id,'draft',args->'draft'));
  if title is not null then update neo_private.campaigns set title=rename.title where id=campaign_key; end if;
  if not exists(select 1 from neo_private.campaign_central_events e where e.publication_id=publication.id
     and e.revision=(result->>'revision')::integer and e.event in ('save','duplicate')) then
   insert into neo_private.campaign_central_events(campaign_id,publication_id,actor_id,event,revision)
    values(campaign_key,publication.id,actor,p_action,(result->>'revision')::integer);
  end if;
  return result;
 end if;

 if latest.editor_id is null then raise exception 'campaign_central_publication_unavailable' using errcode='42501'; end if;
 if p_action in ('schedule','publish') then
  if p_data->'confirmed' is distinct from 'true'::jsonb or request_key is null
     or latest.revision is distinct from (p_data->>'revision')::integer then
   raise exception 'campaign_central_confirmation_required' using errcode='22023';
  end if;
  if exists(select 1 from neo_private.campaign_dispatch_batch b where b.editor_id=publication.editor_id) then
   raise exception 'campaign_central_legacy_occurrence' using errcode='55000';
  end if;
  due:=nullif(p_data->>'local_time','');
  if p_action='schedule' and (due is null or due is distinct from nullif(latest.draft->>'planned_local','')) then
   raise exception 'campaign_central_time_changed' using errcode='22023';
  end if;
  select b.id into previous_batch from neo_private.campaign_wa_rich_batches b
   where b.editor_id=publication.editor_id and b.owner_id=actor
    and (b.cancelled_at is null or exists(select 1 from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.state<>'cancelled'))
   order by b.created_at desc limit 1;
  if previous_batch is not null then
   if previous_batch=request_key then return jsonb_build_object('batch_id',previous_batch,'reused',true); end if;
   raise exception 'campaign_central_already_dispatched' using errcode='55000';
  end if;
  result:=public.neo_campaign_rich_admin_v1('publish',jsonb_build_object('editor_id',publication.editor_id,
   'request_id',request_key,'revision',latest.revision,'confirmed',true,'local_time',case when p_action='schedule' then due end));
  event_name:=p_action;
 elsif p_action='cancel' then
  select b.id into previous_batch from neo_private.campaign_wa_rich_batches b
   where b.id=(p_data->>'batch_id')::uuid and b.editor_id=publication.editor_id and b.owner_id=actor for update;
  if not found then raise exception 'campaign_central_batch_unavailable' using errcode='42501'; end if;
  if exists(select 1 from neo_private.campaign_wa_rich_batches b where b.id=previous_batch and b.cancelled_at is not null)
   then return '{}'::jsonb; end if;
  perform 1 from neo_private.campaign_wa_rich_messages where batch_id=previous_batch and state='waiting' for update;
  result:=public.neo_campaign_rich_admin_v1('cancel',jsonb_build_object('batch_id',previous_batch));
  event_name:='cancel';
 else
  raise exception 'campaign_central_unknown_action' using errcode='22023';
 end if;

 insert into neo_private.campaign_central_events(campaign_id,publication_id,actor_id,event,revision)
 values(campaign_key,publication.id,actor,event_name,latest.revision);
 return result;
end;
$$;
revoke all on function public.neo_campaign_central_v1(text,jsonb) from public,anon;
grant execute on function public.neo_campaign_central_v1(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
