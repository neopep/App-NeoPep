begin;

-- Existing campaign rows can represent a quarantined review draft. NULL keeps
-- legacy inserts compatible with the composite used by neo_campaign_admin.
alter table neo_private.campaigns add column structured_review_only boolean;
alter table neo_private.campaigns drop constraint campaign_has_channel;
alter table neo_private.campaigns add constraint campaign_has_channel check (
  case when coalesce(structured_review_only,false)
    then status='draft' and not popup_enabled and not push_requested and not whatsapp_enabled
    else popup_enabled or push_requested or whatsapp_enabled end
);

-- Version history for existing campaign rows. These records are review-only
-- and are never read by dispatch, reminders, claims or push.
create table neo_private.campaign_editor_versions (
  editor_id uuid not null,
  revision int not null check (revision > 0),
  request_id uuid not null unique,
  campaign_id uuid not null references neo_private.campaigns(id),
  source_id uuid references neo_private.campaigns(id),
  owner_id uuid not null,
  channel text not null check(channel in ('app','whatsapp')),
  draft jsonb not null,
  created_at timestamptz not null default now(),
  primary key(editor_id,revision)
);
create index campaign_editor_versions_campaign on neo_private.campaign_editor_versions(campaign_id,revision desc);
alter table neo_private.campaign_editor_versions enable row level security;
revoke all on neo_private.campaign_editor_versions from public,anon,authenticated,service_role;

create function public.neo_campaign_editor_v1(p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  actor uuid:=auth.uid();
  target uuid;
  source_campaign uuid;
  request_key uuid;
  channel_name text;
  payload jsonb;
  previous neo_private.campaign_editor_versions;
  saved neo_private.campaign_editor_versions;
  new_campaign jsonb;
  result jsonb;
  title text;
begin
  if not coalesce(neo_private.campaign_admin_allowed(),false) or actor is null then
    raise exception 'campaign_editor_admin_required' using errcode='42501';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'campaign_editor_invalid_payload' using errcode='22023';
  end if;

  if p_action='catalog' then
    select coalesce(jsonb_agg(to_jsonb(chosen) order by label,id),'[]') into result from (
      select p.id,p.name as label,p.price_cents
      from neo_private.shop_products p left join neo_private.shop_product_visibility v on v.product_id=p.id
      where p_data->>'kind'='product' and p.active and p.deleted_at is null and p.stock>0
        and coalesce(v.mode,'public')='public'
        and strpos(lower(p.name),lower(left(coalesce(p_data->>'search',''),100)))>0
      union all
      select m.id,m.title,null::int from neo_private.community_materials m
      where p_data->>'kind'='document' and strpos(lower(m.title),lower(left(coalesce(p_data->>'search',''),100)))>0
      union all
      select p.id,'Publicação · '||to_char(p.created_at at time zone 'America/Sao_Paulo','DD/MM/YYYY')||' · '||left(p.id::text,8),null::int
      from neo_private.community_posts p
      where p_data->>'kind'='community' and p.status='published'
        and strpos(p.id::text,lower(left(coalesce(p_data->>'search',''),36)))>0
      order by 2,1 limit 30
    ) chosen;
    return result;
  end if;

  if p_action='review' then
    select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at desc),'[]') into result from (
      select e.campaign_id,e.source_id,e.channel,e.revision,e.created_at,c.title,
        jsonb_array_length(e.draft->'groups') as destinations,'blocked'::text as state,
        e.draft->>'planned_local' as planned_local, e.draft->>'timezone' as timezone
      from neo_private.campaign_editor_versions e join neo_private.campaigns c on c.id=e.campaign_id
      where e.owner_id=actor and c.status='draft'
        and not exists(select 1 from neo_private.campaign_editor_versions newer
          where newer.editor_id=e.editor_id and newer.revision>e.revision)
      order by e.created_at desc limit 30
    ) v;
    return result;
  end if;

  if p_action='load' then
    select * into saved from neo_private.campaign_editor_versions
      where campaign_id=(p_data->>'campaign_id')::uuid and owner_id=actor
      order by revision desc limit 1;
    return case when found then to_jsonb(saved)-'owner_id'-'request_id' end;
  end if;
  if p_action is distinct from 'save' then
    raise exception 'campaign_editor_action_unavailable' using errcode='22023';
  end if;

  target:=(p_data->>'editor_id')::uuid;
  request_key:=(p_data->>'request_id')::uuid;
  source_campaign:=nullif(p_data->>'source_id','')::uuid;
  channel_name:=p_data->>'channel';
  payload:=p_data->'draft';
  title:=btrim(payload->>'title');
  if target is null or request_key is null or channel_name is null or channel_name not in ('app','whatsapp')
      or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>60000
      or coalesce(length(title),0) not between 1 and 120
      or jsonb_typeof(payload->'blocks') is distinct from 'array'
      or jsonb_typeof(payload->'groups') is distinct from 'array' then
    raise exception 'campaign_editor_invalid_draft' using errcode='22023';
  end if;
  if jsonb_array_length(payload->'blocks')>32 or jsonb_array_length(payload->'groups')>30
    or exists(select 1 from jsonb_array_elements(payload->'groups') g
      where jsonb_typeof(g)<>'string' or length(g#>>'{}')>200)
    or exists(select 1 from jsonb_array_elements(payload->'blocks') b
      where jsonb_typeof(b)<>'object' or coalesce(b->>'type','') not in ('text','image','file','link','product','document','community')
        or (b - array['id','type','text','label','ref','name','url','layout']) <> '{}'
        or coalesce(length(b->>'text'),0)>4000
        or (b->>'url' is not null and (b->>'type'<>'link'
          or b->>'url' !~ '^https://[^/@[:space:]?#]+([/?#][^[:space:]]*)?$'
          or b->>'url' ~* '/storage/v1/object/(sign|authenticated)/|[?&](token|signature|apikey|x-amz-[^=]*)='
          or length(b->>'url')>2000))) then
    raise exception 'campaign_editor_invalid_blocks' using errcode='22023';
  end if;
  if channel_name='app' and (jsonb_array_length(payload->'groups')<>0
     or coalesce(payload->>'audience','') not in ('all','free','premium')) then
    raise exception 'campaign_editor_invalid_app_audience' using errcode='22023';
  end if;
  if (payload - array['title','blocks','groups','planned_local','timezone','audience'])<>'{}'
     or coalesce(payload->>'timezone','')<>'America/Sao_Paulo'
     or (nullif(payload->>'planned_local','') is not null
         and (payload->>'planned_local') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$') then
    raise exception 'campaign_editor_invalid_review' using errcode='22023';
  end if;
  if nullif(payload->>'planned_local','') is not null then
    perform neo_private.campaign_wall_time(payload->>'planned_local',payload->>'timezone');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('campaign-editor:'||target,0));
  select * into saved from neo_private.campaign_editor_versions where request_id=request_key;
  if found then
    if row(saved.owner_id,saved.editor_id,saved.channel,saved.source_id,saved.draft)
       is distinct from row(actor,target,channel_name,source_campaign,payload) then
      raise exception 'campaign_editor_request_conflict' using errcode='23505';
    end if;
    return to_jsonb(saved)-'owner_id'-'request_id';
  end if;
  select * into previous from neo_private.campaign_editor_versions where editor_id=target
    order by revision desc limit 1;
  if found and row(previous.owner_id,previous.channel,previous.source_id)
    is distinct from row(actor,channel_name,source_campaign) then
    raise exception 'campaign_editor_owner_required' using errcode='42501';
  end if;
  if coalesce(previous.revision,0) is distinct from (p_data->>'revision')::int then
    raise exception 'campaign_editor_revision_changed' using errcode='40001';
  end if;
  if previous.campaign_id is not null then
    perform 1 from neo_private.campaigns where id=previous.campaign_id and status='draft' for update;
    if not found then raise exception 'campaign_editor_existing_campaign_changed' using errcode='40001'; end if;
  end if;
  if source_campaign is not null and not exists(select 1 from neo_private.campaigns where id=source_campaign) then
    raise exception 'campaign_editor_source_missing' using errcode='22023';
  end if;

  if exists(select 1 from jsonb_array_elements(payload->'blocks') b where
    (b->>'type'='product' and not exists(select 1 from neo_private.shop_products p
       left join neo_private.shop_product_visibility v on v.product_id=p.id
       where p.id::text=b->>'ref' and p.active and p.deleted_at is null and p.stock>0 and coalesce(v.mode,'public')='public'))
    or (b->>'type'='document' and not exists(select 1 from neo_private.community_materials m where m.id::text=b->>'ref'))
    or (b->>'type'='community' and not exists(select 1 from neo_private.community_posts p where p.id::text=b->>'ref' and p.status='published'))) then
    raise exception 'campaign_editor_reference_unavailable' using errcode='22023';
  end if;

  -- A title-only shadow in the existing list. Do not set popup/push/activation,
  -- publication rows, Connect tasks, or reminders from this review endpoint.
  new_campaign:=public.neo_campaign_admin('save',previous.campaign_id,jsonb_build_object(
    'title',title,'body','','structured_review_only',true,'whatsapp_enabled',false,'popup_enabled',false,'push_requested',false));
  insert into neo_private.campaign_editor_versions(editor_id,revision,request_id,campaign_id,source_id,owner_id,channel,draft)
    values(target,coalesce(previous.revision,0)+1,request_key,(new_campaign->>'id')::uuid,source_campaign,actor,channel_name,payload)
    returning * into saved;
  return to_jsonb(saved)-'owner_id'-'request_id';
end
$$;

revoke all on function public.neo_campaign_editor_v1(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_campaign_editor_v1(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
