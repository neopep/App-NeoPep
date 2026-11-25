begin;
set local lock_timeout='5s';

create table neo_private.campaign_test_config (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into neo_private.campaign_test_config default values;
create table neo_private.campaign_test_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true
);
create table neo_private.campaign_test_batches (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 editor_id uuid not null,
 revision int not null,
 intent jsonb not null,
 title text not null,
 body text not null,
 starts_at timestamptz not null,
 cancelled_at timestamptz,
 created_at timestamptz not null default now(),
 unique(editor_id,revision)
);
create table neo_private.campaign_test_recipients (
 batch_id uuid not null references neo_private.campaign_test_batches(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 offered_at timestamptz,
 displayed_at timestamptz,
 primary key(batch_id,user_id)
);
create index campaign_test_recipient_user on neo_private.campaign_test_recipients(user_id,batch_id);

alter table neo_private.campaign_test_config enable row level security;
alter table neo_private.campaign_test_accounts enable row level security;
alter table neo_private.campaign_test_batches enable row level security;
alter table neo_private.campaign_test_recipients enable row level security;
revoke all on neo_private.campaign_test_config,neo_private.campaign_test_accounts,
 neo_private.campaign_test_batches,neo_private.campaign_test_recipients from public,anon,authenticated;

create function neo_private.campaign_test_session() returns boolean
language sql stable set search_path=pg_catalog as $$
 select auth.uid() is not null and coalesce(
   nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss'
     ='https://qnuluspqfazdppciermw.supabase.co/auth/v1',false);
$$;
revoke all on function neo_private.campaign_test_session() from public,anon,authenticated;

create function public.neo_campaign_test_admin_v1(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 actor uuid:=auth.uid();
 allowed boolean;
 batch neo_private.campaign_test_batches%rowtype;
 version neo_private.campaign_editor_versions%rowtype;
 request_key uuid;
 editor uuid;
 revision_number int;
 start_time timestamptz;
 body_text text;
 destinations uuid[];
begin
 if not neo_private.campaign_test_session() or not coalesce(neo_private.campaign_admin_allowed(),false) then
  raise exception 'campaign_test_admin_required' using errcode='42501';
 end if;
 if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'invalid_payload' using errcode='22023';end if;
 select enabled into strict allowed from neo_private.campaign_test_config for share;
 if p_action='diagnostics' then
  return jsonb_build_object('enabled',allowed,'destinations',(select count(*) from neo_private.campaign_test_accounts where enabled),
   'audience_key',(select md5(coalesce(string_agg(user_id::text,',' order by user_id),'')) from neo_private.campaign_test_accounts where enabled));
 end if;

 if p_action='status' then
  return coalesce((select jsonb_agg(to_jsonb(entry) order by entry.starts_at desc) from (
   select b.id,b.title,b.starts_at,b.cancelled_at,
    (select coalesce(jsonb_agg(jsonb_build_object('account_id',r.user_id,
     'status',case when r.displayed_at is not null then 'displayed'
      when b.cancelled_at is not null then 'cancelled'
      when a.enabled is distinct from true then 'revoked'
      when not allowed then 'paused'
      when b.starts_at>now() then 'scheduled'
      when b.starts_at+interval '24 hours'<=now() then 'expired'
      when r.offered_at is not null then 'offered' else 'available' end,
     'displayed_at',r.displayed_at) order by r.user_id),'[]')
     from neo_private.campaign_test_recipients r left join neo_private.campaign_test_accounts a on a.user_id=r.user_id
     where r.batch_id=b.id) as recipients
   from neo_private.campaign_test_batches b where b.owner_id=actor and b.editor_id=(p_data->>'editor_id')::uuid
   order by b.starts_at desc limit 20
  ) entry),'[]');
 end if;

 if p_action='cancel' then
  select * into batch from neo_private.campaign_test_batches where id=(p_data->>'batch_id')::uuid and owner_id=actor for update;
  if not found then raise exception 'campaign_test_batch_unavailable' using errcode='42501';end if;
  update neo_private.campaign_test_batches set cancelled_at=now() where id=batch.id and cancelled_at is null;
  return jsonb_build_object('ok',true);
 end if;

 if p_action is distinct from 'publish' or p_data->'confirmed' is distinct from 'true'::jsonb
    or (p_data-ARRAY['request_id','editor_id','revision','local_time','confirmed','destination_count','audience_key'])<>'{}'::jsonb then
  raise exception 'campaign_test_confirmation_required' using errcode='22023';
 end if;
 request_key:=(p_data->>'request_id')::uuid;
 editor:=(p_data->>'editor_id')::uuid;
 revision_number:=(p_data->>'revision')::int;
 if request_key is null or editor is null or revision_number is null then raise exception 'campaign_test_invalid_intent' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('neo-campaign-test:'||editor,0));
 select * into batch from neo_private.campaign_test_batches where id=request_key;
 if found then
  if (batch.owner_id,batch.intent) is distinct from (actor,p_data) then raise exception 'campaign_test_request_conflict' using errcode='23505';end if;
  return jsonb_build_object('batch_id',batch.id);
 end if;
 if not allowed then raise exception 'campaign_test_disabled' using errcode='42501';end if;
 select * into version from neo_private.campaign_editor_versions v where v.editor_id=editor and v.owner_id=actor
  order by v.revision desc limit 1;
 if not found or version.revision<>revision_number or version.channel<>'app' then
  raise exception 'campaign_test_revision_unavailable' using errcode='40001';
 end if;
 if exists(select 1 from jsonb_array_elements(version.draft->'blocks') b where b->>'type'<>'text') then
  raise exception 'campaign_test_requires_text' using errcode='22023';
 end if;
 select btrim(string_agg(b->>'text',E'\n\n' order by position)) into body_text
  from jsonb_array_elements(version.draft->'blocks') with ordinality blocks(b,position);
 if coalesce(length(body_text),0) not between 1 and 2000 or body_text ~* '(https?://|www[.]|/storage/v1/|[?&](token|signature|apikey)=)' then
  raise exception 'campaign_test_requires_plain_text' using errcode='22023';
 end if;
 start_time:=coalesce(neo_private.campaign_wall_time(p_data->>'local_time','America/Sao_Paulo'),now());
 if start_time<now()-interval '1 minute' or start_time>now()+interval '90 days' then
  raise exception 'campaign_test_invalid_schedule' using errcode='22023';
 end if;
 select array_agg(a.user_id order by a.user_id) into destinations from (
  select user_id from neo_private.campaign_test_accounts where enabled order by user_id limit 31 for share
 ) a;
 if coalesce(cardinality(destinations),0) not between 1 and 30 then raise exception 'campaign_test_accounts_required' using errcode='22023';end if;
 if (p_data->>'destination_count')::int is distinct from cardinality(destinations)
    or p_data->>'audience_key' is distinct from md5(array_to_string(destinations,',')) then
  raise exception 'campaign_test_accounts_changed' using errcode='40001';
 end if;
 insert into neo_private.campaign_test_batches(id,owner_id,editor_id,revision,intent,title,body,starts_at)
 values(request_key,actor,editor,revision_number,p_data,version.draft->>'title',body_text,start_time);
 insert into neo_private.campaign_test_recipients(batch_id,user_id) select request_key,unnest(destinations);
 return jsonb_build_object('batch_id',request_key);
end $$;

create function public.neo_campaign_test_visit_v1(p_action text,p_batch uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 actor uuid:=auth.uid();
 batch neo_private.campaign_test_batches%rowtype;
begin
 if not neo_private.campaign_test_session() then return null;end if;
 perform 1 from neo_private.campaign_test_config where enabled for share;
 if not found then return null;end if;
 perform 1 from neo_private.campaign_test_accounts where user_id=actor and enabled for share;
 if not found then return null;end if;
 if p_action='next' then
  select b.* into batch from neo_private.campaign_test_batches b
  join neo_private.campaign_test_recipients r on r.batch_id=b.id
  where r.user_id=actor and b.cancelled_at is null and b.starts_at<=now()
   and b.starts_at+interval '24 hours'>now() and r.displayed_at is null
   and (r.offered_at is null or r.offered_at<=now()-interval '60 seconds')
  order by b.starts_at,b.id limit 1 for share of b for update of r skip locked;
  if not found then return null;end if;
  update neo_private.campaign_test_recipients set offered_at=now() where batch_id=batch.id and user_id=actor;
  return jsonb_build_object('id',batch.id,'title',batch.title,'body',batch.body);
 elsif p_action='displayed' then
  perform 1 from neo_private.campaign_test_batches where id=p_batch and cancelled_at is null
   and starts_at<=now() and starts_at+interval '24 hours'>now() for share;
  if not found then return 'false'::jsonb;end if;
  update neo_private.campaign_test_recipients set displayed_at=coalesce(displayed_at,now())
   where batch_id=p_batch and user_id=actor and offered_at is not null;
  return to_jsonb(found);
 end if;
 return null;
end $$;

revoke all on function public.neo_campaign_test_admin_v1(text,jsonb),public.neo_campaign_test_visit_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.neo_campaign_test_admin_v1(text,jsonb),public.neo_campaign_test_visit_v1(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
