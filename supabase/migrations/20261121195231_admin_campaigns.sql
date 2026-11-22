create table neo_private.campaigns (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 1 and 120),
 body text not null default '' check (length(body) <= 2000),
 image_url text check (length(image_url) <= 1000 and image_url ~ '^/(assets|campaign-media)/[a-zA-Z0-9_./-]+$' and position('..' in image_url)=0),
 link_url text check (length(link_url) <= 1000 and (link_url ~ '^/[a-zA-Z0-9_?#.-][a-zA-Z0-9_/?#.=+&%:-]*$' or link_url ~ '^https://[a-zA-Z0-9.-]+(:443)?([/?#][^[:space:]]*)?$') and position(chr(92) in link_url)=0),
 link_label text not null default 'Saiba mais' check (length(link_label) between 1 and 60),
 kind text not null default 'link' check (kind in ('link','document','product','offer','promotion')),
 status text not null default 'draft' check (status in ('draft','active','paused','archived')),
 audience text not null default 'all' check (audience in ('all','segment','plan')),
 targets text[] not null default '{}' check (cardinality(targets)<=20 and (audience='all' or cardinality(targets)>0)),
 starts_at timestamptz,
 ends_at timestamptz,
 timezone text not null default 'America/Sao_Paulo',
 weekdays integer[] not null default '{0,1,2,3,4,5,6}' check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]),
 opens_at time not null default '00:00',
 closes_at time not null default '24:00',
 frequency_hours integer not null default 24 check (frequency_hours between 1 and 8760),
 max_views integer not null default 1 check (max_views between 1 and 100),
 priority integer not null default 0 check (priority between 0 and 100),
 push_requested boolean not null default false,
 updated_at timestamptz not null default now(),
 check (ends_at is null or starts_at is null or ends_at>starts_at),
 check (closes_at>opens_at)
);

create table neo_private.campaign_impressions (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references neo_private.campaigns(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 reserved_at timestamptz not null default now(),
 displayed_at timestamptz,
 clicked_at timestamptz
);
create index campaign_impressions_user_idx on neo_private.campaign_impressions(user_id, campaign_id, reserved_at desc);
create index campaign_impressions_campaign_idx on neo_private.campaign_impressions(campaign_id);
create index campaigns_active_idx on neo_private.campaigns(priority desc,updated_at desc,id) where status='active';

alter table neo_private.campaigns enable row level security;
alter table neo_private.campaign_impressions enable row level security;
revoke all on neo_private.campaigns,neo_private.campaign_impressions from public,anon,authenticated;

create function public.neo_campaign_admin(p_action text, p_id uuid default null, p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare item neo_private.campaigns; result jsonb; next_status text;
begin
 if auth.uid() is null or not public.neo_admin_access() or not exists
 (select 1 from neo_private.admin_members where user_id=auth.uid()) then
  raise exception 'Acesso administrativo obrigatório.' using errcode='42501';
 end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('views',s.views,'clicks',s.clicks) order by c.updated_at desc,c.id),'[]')
   into result from (select * from neo_private.campaigns order by updated_at desc,id limit 50
    offset greatest(0,least(coalesce((p_data->>'offset')::integer,0),100000))) c
   cross join lateral (select count(displayed_at) views,count(clicked_at) clicks from neo_private.campaign_impressions where campaign_id=c.id) s;
  return result;
 end if;
 if p_id is not null then
  select * into strict item from neo_private.campaigns where id=p_id for update;
 end if;
 if p_action='save' then
  if item.status='archived' then raise exception 'Campanha arquivada.'; end if;
  if item.id is null then
   item.body:='';item.link_label:='Saiba mais';item.kind:='link';item.audience:='all';item.targets:='{}';
   item.timezone:='America/Sao_Paulo';item.weekdays:='{0,1,2,3,4,5,6}';item.opens_at:='00:00';item.closes_at:='24:00';
   item.frequency_hours:=24;item.max_views:=1;item.priority:=0;item.push_requested:=false;
  end if;
  item:=jsonb_populate_record(item,p_data - array['id','status','updated_at']);
  if not exists(select 1 from pg_timezone_names where name=item.timezone) then raise exception 'Fuso horário inválido.';end if;
  if item.audience='segment' and not item.targets <@ array['recent','established','community'] then raise exception 'Segmento inválido.';end if;
  if item.id is null then
   item.id:=gen_random_uuid(); item.status:='draft'; item.updated_at:=now();
   insert into neo_private.campaigns select (item).*;
  else
   update neo_private.campaigns set
    title=item.title,body=item.body,image_url=item.image_url,link_url=item.link_url,link_label=item.link_label,kind=item.kind,
    audience=item.audience,targets=item.targets,starts_at=item.starts_at,ends_at=item.ends_at,timezone=item.timezone,
    weekdays=item.weekdays,opens_at=item.opens_at,closes_at=item.closes_at,frequency_hours=item.frequency_hours,
    max_views=item.max_views,priority=item.priority,push_requested=item.push_requested,updated_at=now() where id=item.id;
  end if;
 elsif p_action='duplicate' and p_id is not null then
  item.id:=gen_random_uuid();item.title:=left(item.title,111)||' (cópia)';item.status:='draft';item.push_requested:=false;item.updated_at:=now();
  insert into neo_private.campaigns select (item).*;
 elsif p_action in ('activate','pause','archive') and p_id is not null and item.status<>'archived' then
  next_status:=case p_action when 'activate' then 'active' when 'pause' then 'paused' else 'archived' end;
  update neo_private.campaigns set status=next_status,updated_at=now() where id=p_id returning * into item;
 else
  raise exception 'Operação de campanha inválida.';
 end if;
 return to_jsonb(item);
end $$;

create function public.neo_campaign_visit(p_action text, p_impression uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare account uuid:=auth.uid(); current_time_utc timestamptz:=now(); campaign neo_private.campaigns; receipt uuid;
begin
 if account is null then raise exception 'Sessão obrigatória.' using errcode='42501'; end if;
 if not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=account) then return null; end if;
 if p_action='displayed' then
  update neo_private.campaign_impressions set displayed_at=coalesce(displayed_at,current_time_utc)
   where id=p_impression and user_id=account and reserved_at>current_time_utc-interval '5 minutes'
   and exists(select 1 from neo_private.campaigns where id=campaign_id and status='active');
  return to_jsonb(found);
 elsif p_action='clicked' then
  update neo_private.campaign_impressions set clicked_at=coalesce(clicked_at,current_time_utc)
   where id=p_impression and user_id=account and displayed_at>current_time_utc-interval '2 hours';
  return to_jsonb(found);
 elsif p_action<>'next' or p_action is null then
  raise exception 'Operação de campanha inválida.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('neo-campaign:'||account,0));
 if exists(select 1 from neo_private.campaign_impressions where user_id=account
  and reserved_at>current_time_utc-interval '5 minutes') then return null; end if;
 select c.* into campaign from neo_private.campaigns c
 join auth.users u on u.id=account
 cross join lateral (select current_time_utc at time zone c.timezone as local_at) schedule
 where c.status='active' and (c.starts_at is null or c.starts_at<=current_time_utc)
  and (c.ends_at is null or c.ends_at>current_time_utc)
  and extract(dow from schedule.local_at)::integer=any(c.weekdays)
  and schedule.local_at::time>=c.opens_at and schedule.local_at::time<c.closes_at
  and (c.audience='all' or (c.audience='plan' and u.raw_app_meta_data->>'campaign_plan'=any(c.targets))
   or (c.audience='segment' and (
    ('recent'=any(c.targets) and u.created_at>=current_time_utc-interval '30 days')
    or ('established'=any(c.targets) and u.created_at<current_time_utc-interval '30 days')
    or ('community'=any(c.targets) and exists(select 1 from neo_private.community_members where user_id=account)))))
  and (select count(*) from neo_private.campaign_impressions where user_id=account and campaign_id=c.id and displayed_at is not null)<c.max_views
  and not exists(select 1 from neo_private.campaign_impressions where user_id=account and campaign_id=c.id
   and displayed_at>current_time_utc-make_interval(hours=>c.frequency_hours))
 order by c.priority desc,c.updated_at desc,c.id limit 1;
 if not found then return null;end if;
 insert into neo_private.campaign_impressions(campaign_id,user_id) values(campaign.id,account) returning id into receipt;
 return jsonb_build_object('impression',receipt,'title',campaign.title,'body',campaign.body,'image_url',campaign.image_url,
  'link_url',campaign.link_url,'link_label',campaign.link_label,'kind',campaign.kind);
end $$;

revoke all on function public.neo_campaign_admin(text,uuid,jsonb),public.neo_campaign_visit(text,uuid) from public,anon,authenticated;
grant execute on function public.neo_campaign_admin(text,uuid,jsonb),public.neo_campaign_visit(text,uuid) to authenticated;
