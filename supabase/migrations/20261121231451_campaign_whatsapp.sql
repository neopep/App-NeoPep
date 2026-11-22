alter table neo_private.campaigns
 add column whatsapp_enabled boolean not null default false,
 add column whatsapp_message text not null default '' check (length(whatsapp_message)<=4000);
alter table neo_private.campaigns drop constraint campaign_has_channel;
alter table neo_private.campaigns add constraint campaign_has_channel
 check (popup_enabled or push_requested or whatsapp_enabled);

create function neo_private.campaign_display_state(c neo_private.campaigns,t timestamptz) returns text
language sql stable set search_path=pg_catalog as $$
 select case
  when c.status<>'active' then c.status
  when c.ends_at<=t then 'expired'
  when c.starts_at>t or not (extract(dow from t at time zone c.timezone)::int=any(c.weekdays))
   or (t at time zone c.timezone)::time<c.opens_at or (t at time zone c.timezone)::time>=c.closes_at then 'scheduled'
  else 'active' end
$$;
revoke all on function neo_private.campaign_display_state(neo_private.campaigns,timestamptz) from public,anon,authenticated;

create or replace function public.neo_campaign_admin(p_action text, p_id uuid default null, p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare item neo_private.campaigns; result jsonb; next_status text;
begin
 if not neo_private.campaign_admin_allowed() then
  raise exception 'Acesso administrativo obrigatório.' using errcode='42501';
 end if;
 if p_action='catalog' then
  select coalesce(jsonb_agg(to_jsonb(v) order by v.label,v.id),'[]') into result
  from (
   select r.id,r.label from (
    select id,title as label from neo_private.community_materials where p_data->>'kind'='document'
    union all select id,name from neo_private.shop_products where p_data->>'kind'='product' and active
    union all select id,name from neo_private.shop_promotions where p_data->>'kind' in ('offer','promotion')
     and active and not restricted_to_user and restricted_user_id is null and kind<>'tracking'
   ) r where position(lower(coalesce(nullif(left(p_data->>'search',100),''),r.label)) in lower(r.label))>0
   order by r.label,r.id limit 30
  ) v;
  return result;
 end if;
 if p_action='assign_plan' then
  if p_data->>'plan' is null or p_id is null then raise exception 'Conta e plano obrigatórios.';end if;
  if p_data->>'plan'='' then
   delete from neo_private.campaign_plans where user_id=p_id;
  else
   insert into neo_private.campaign_plans(user_id,plan,assigned_by) values(p_id,p_data->>'plan',auth.uid())
   on conflict(user_id) do update set plan=excluded.plan,assigned_by=excluded.assigned_by,updated_at=now();
  end if;
  return jsonb_build_object('saved',true);
 end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object(
   'starts_local',to_char(c.starts_at at time zone c.timezone,'YYYY-MM-DD"T"HH24:MI'),
   'ends_local',to_char(c.ends_at at time zone c.timezone,'YYYY-MM-DD"T"HH24:MI'),'views',s.views,'clicks',s.clicks,'display_state',c.display_state) order by c.rank,c.updated_at desc,c.id),'[]')
   into result from (
    select t.*,v.display_state,array_position(array['active','scheduled','draft','paused','expired','archived'],v.display_state) rank
    from neo_private.campaigns t cross join lateral (select neo_private.campaign_display_state(t,now()) display_state) v
    order by rank,updated_at desc,id limit 50
    offset greatest(0,coalesce((p_data->>'offset')::integer,0))) c
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
   item.whatsapp_enabled:=false;item.whatsapp_message:='';item.popup_enabled:=true;item.frequency_hours:=24;item.max_views:=1;item.priority:=0;item.push_requested:=false;item.popup_enabled:=true;
  end if;
  item:=jsonb_populate_record(item,p_data - array['id','status','updated_at']);
  if not exists(select 1 from pg_timezone_names where name=item.timezone) then raise exception 'Fuso horário inválido.';end if;
  if p_data ? 'starts_local' then item.starts_at:=neo_private.campaign_wall_time(p_data->>'starts_local',item.timezone);end if;
  if p_data ? 'ends_local' then item.ends_at:=neo_private.campaign_wall_time(p_data->>'ends_local',item.timezone);end if;
  if item.content_id is not null then
   item.link_url:=neo_private.campaign_destination(item.kind,item.content_id);
   if item.link_url is null then raise exception 'Destino indisponível.';end if;
  end if;
  if item.image_path is not null and not exists (
   select 1 from storage.objects where bucket_id='neo-campaign-images' and name=item.image_path
  ) then raise exception 'Imagem não encontrada.';end if;
  if item.audience='segment' and not item.targets <@ array['recent','established','community'] then raise exception 'Segmento inválido.';end if;
  if item.id is null then
   item.id:=gen_random_uuid(); item.status:='draft'; item.updated_at:=now();
   insert into neo_private.campaigns select (item).*;
  else
   update neo_private.campaigns set
    title=item.title,body=item.body,image_url=item.image_url,link_url=item.link_url,link_label=item.link_label,kind=item.kind,
    audience=item.audience,targets=item.targets,starts_at=item.starts_at,ends_at=item.ends_at,timezone=item.timezone,
    weekdays=item.weekdays,opens_at=item.opens_at,closes_at=item.closes_at,frequency_hours=item.frequency_hours,
    max_views=item.max_views,priority=item.priority,push_requested=item.push_requested,popup_enabled=item.popup_enabled,content_id=item.content_id,image_path=item.image_path,whatsapp_enabled=item.whatsapp_enabled,whatsapp_message=item.whatsapp_message,updated_at=now() where id=item.id;
  end if;
 elsif p_action='duplicate' and p_id is not null then
  item.id:=gen_random_uuid();item.title:=left(item.title,111)||' (cópia)';item.status:='draft';item.updated_at:=now();
  insert into neo_private.campaigns select (item).*;
 elsif p_action in ('activate','pause','archive') and p_id is not null and item.status<>'archived' then
  next_status:=case p_action when 'activate' then 'active' when 'pause' then 'paused' else 'archived' end;
  update neo_private.campaigns set status=next_status,updated_at=now() where id=p_id returning * into item;
 else
  raise exception 'Operação de campanha inválida.';
 end if;
 return to_jsonb(item);
end $$;

create table neo_private.campaign_wa_groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 120),
 invite text check(invite ~ '^https://chat[.]whatsapp[.]com/[A-Za-z0-9_-]{10,80}$'),
 category text not null default '' check(length(category)<=80),
 notes text not null default '' check(length(notes)<=1000),
 active boolean not null default true
);
create table neo_private.campaign_wa_publications (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references neo_private.campaigns(id),
 group_id uuid not null references neo_private.campaign_wa_groups(id),
 scheduled_at timestamptz,
 timezone text not null default 'America/Sao_Paulo',
 weekdays int[] not null default '{}' check(weekdays <@ array[0,1,2,3,4,5,6]),
 remind boolean not null default false,
 attachments text[] not null default '{}' check(cardinality(attachments)<=8),
 status text not null default 'pending' check(status in ('pending','done','cancelled')),
 created_at timestamptz not null default now()
);
create index campaign_wa_publications_campaign_idx on neo_private.campaign_wa_publications(campaign_id);
create index campaign_wa_publications_group_idx on neo_private.campaign_wa_publications(group_id);
create index campaign_wa_publications_due_idx on neo_private.campaign_wa_publications(scheduled_at) where status='pending' and remind;
create table neo_private.campaign_wa_confirmation (
 publication_id uuid not null references neo_private.campaign_wa_publications(id),
 scheduled_at timestamptz not null,
 confirmed_by uuid references auth.users(id) on delete set null,
 confirmed_at timestamptz not null default now(),
 primary key(publication_id,scheduled_at)
);
create table neo_private.campaign_wa_reminder_seen (
 publication_id uuid not null references neo_private.campaign_wa_publications(id),
 scheduled_at timestamptz not null,
 admin_id uuid not null references auth.users(id) on delete cascade,
 primary key(publication_id,scheduled_at,admin_id)
);
create index campaign_wa_confirmation_admin_idx on neo_private.campaign_wa_confirmation(confirmed_by);
create index campaign_wa_reminder_seen_admin_idx on neo_private.campaign_wa_reminder_seen(admin_id);
alter table neo_private.campaign_wa_groups enable row level security;
alter table neo_private.campaign_wa_publications enable row level security;
alter table neo_private.campaign_wa_confirmation enable row level security;
alter table neo_private.campaign_wa_reminder_seen enable row level security;
revoke all on neo_private.campaign_wa_groups,neo_private.campaign_wa_publications,neo_private.campaign_wa_confirmation,
 neo_private.campaign_wa_reminder_seen from public,anon,authenticated;

create function public.neo_campaign_wa(p_action text,p_id uuid default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare account uuid:=auth.uid(); result jsonb; group_row neo_private.campaign_wa_groups; publication neo_private.campaign_wa_publications;
 campaign uuid; group_id_value uuid; wall timestamp; next_at timestamptz; zone text; attached text[]; days int[]; target_day date;
begin
 if not neo_private.campaign_admin_allowed() then raise exception 'Acesso administrativo obrigatório.' using errcode='42501';end if;
 if p_action='groups' then
  select coalesce(jsonb_agg(to_jsonb(g) order by g.active desc,g.category,g.name,g.id),'[]') into result from (
   select * from neo_private.campaign_wa_groups where
   position(lower(coalesce(left(p_data->>'search',100),'')) in lower(name||' '||category))>0 or nullif(p_data->>'search','') is null
   order by active desc,category,name,id limit 200
  ) g;
  return result;
 elsif p_action='group_save' then
  if p_id is null then
   insert into neo_private.campaign_wa_groups(name,invite,category,notes,active)
    values(trim(p_data->>'name'),nullif(trim(p_data->>'invite'),''),coalesce(p_data->>'category',''),coalesce(p_data->>'notes',''),coalesce((p_data->>'active')::boolean,true))
    returning * into group_row;
  else
   update neo_private.campaign_wa_groups set name=trim(p_data->>'name'),invite=nullif(trim(p_data->>'invite'),''),
    category=coalesce(p_data->>'category',''),notes=coalesce(p_data->>'notes',''),active=coalesce((p_data->>'active')::boolean,true)
   where id=p_id returning * into strict group_row;
  end if;
  return to_jsonb(group_row);
 elsif p_action='attachments' then
  select coalesce(jsonb_agg(to_jsonb(f) order by f.name,f.path),'[]') into result from (
   select path,name,mime,allow_download from neo_private.library_uploads
   where material_id is not null and allow_download and size<=10485760
    and mime in ('application/pdf','text/plain','image/jpeg')
    and (nullif(p_data->>'search','') is null or position(lower(left(p_data->>'search',100)) in lower(name))>0)
   order by name,path limit 50
  ) f;
  return result;
 elsif p_action='prepare' then
  select jsonb_build_object('id',c.id,'title',c.title,'message',coalesce(nullif(c.whatsapp_message,''),c.body),
   'image_path',c.image_path,'image_url',c.image_url,'link_url',case when c.content_id is null then c.link_url
     else neo_private.campaign_destination(c.kind,c.content_id) end)
  into strict result from neo_private.campaigns c where c.id=p_id and c.whatsapp_enabled and c.status<>'archived';
  if p_data ? 'publication' then
   select * into strict publication from neo_private.campaign_wa_publications where id=(p_data->>'publication')::uuid and campaign_id=p_id;
   result:=result||jsonb_build_object('attachments',coalesce((select jsonb_agg(jsonb_build_object('path',f.path,'name',f.name,
    'mime',f.mime,'allow_download',true)) from neo_private.library_uploads f
    where f.path=any(publication.attachments) and f.allow_download and f.material_id is not null and f.size<=10485760
     and f.mime in ('application/pdf','text/plain','image/jpeg')),'[]'));
  end if;
  return result;
 elsif p_action='queue' then
  select coalesce(jsonb_agg(to_jsonb(j) order by j.scheduled_at nulls last,j.id),'[]') into result from (
   select p.id,p.campaign_id,p.group_id,c.title,g.name as group_name,p.scheduled_at,p.timezone,p.weekdays,p.remind,
    case when p.status<>'pending' then p.status when p.scheduled_at is null then 'pending'
     when p.scheduled_at<=now() then 'late' else 'scheduled' end as state,
    (h.confirmed_at is not null) as manually_confirmed,h.confirmed_at
   from neo_private.campaign_wa_publications p join neo_private.campaigns c on c.id=p.campaign_id
   join neo_private.campaign_wa_groups g on g.id=p.group_id
   left join lateral (select confirmed_at from neo_private.campaign_wa_confirmation
     where publication_id=p.id order by scheduled_at desc limit 1) h on true
   order by case when p.status='pending' then 0 else 1 end,p.scheduled_at nulls last,p.id limit 100
  ) j;
  return result;
 elsif p_action='reminders' then
  with due as (
   select p.id,p.scheduled_at,c.title,g.name group_name
   from neo_private.campaign_wa_publications p join neo_private.campaigns c on c.id=p.campaign_id
   join neo_private.campaign_wa_groups g on g.id=p.group_id and g.active
   where p.status='pending' and p.remind and p.scheduled_at<=now() and c.whatsapp_enabled and c.status<>'archived'
    and not exists(select 1 from neo_private.campaign_wa_reminder_seen s where s.publication_id=p.id and s.scheduled_at=p.scheduled_at and s.admin_id=account)
   order by p.scheduled_at,p.id limit 20
  ), marked as (
   insert into neo_private.campaign_wa_reminder_seen(publication_id,scheduled_at,admin_id)
    select id,scheduled_at,account from due on conflict do nothing returning publication_id
  ) select coalesce(jsonb_agg(to_jsonb(due)),'[]') into result from due join marked on marked.publication_id=due.id;
  return result;
 elsif p_action='schedule' then
  campaign:=(p_data->>'campaign_id')::uuid;
  if not exists(select 1 from neo_private.campaigns where id=campaign and whatsapp_enabled and status<>'archived')
  then raise exception 'Campanha WhatsApp indisponível.';end if;
  zone:=coalesce(nullif(p_data->>'timezone',''),'America/Sao_Paulo');
  if not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'Fuso inválido.';end if;
  next_at:=neo_private.campaign_wall_time(p_data->>'local_time',zone);
  attached:=array(select distinct jsonb_array_elements_text(coalesce(p_data->'attachments','[]')));
  days:=array(select distinct jsonb_array_elements_text(coalesce(p_data->'weekdays','[]'))::int);
  if next_at is null and cardinality(days)>0 then raise exception 'Informe data e horário para recorrência.';end if;
  if cardinality(attached)>8 or exists(select 1 from unnest(attached) a where not exists (
   select 1 from neo_private.library_uploads f where f.path=a and f.allow_download and f.material_id is not null
    and f.size<=10485760 and f.mime in ('application/pdf','text/plain','image/jpeg'))) then raise exception 'Anexo indisponível.';end if;
  if jsonb_typeof(p_data->'groups') is distinct from 'array' or jsonb_array_length(p_data->'groups') not between 1 and 30
   then raise exception 'Selecione entre 1 e 30 grupos.';end if;
  for group_id_value in select distinct jsonb_array_elements_text(p_data->'groups')::uuid loop
   if not exists(select 1 from neo_private.campaign_wa_groups where id=group_id_value and active) then raise exception 'Grupo indisponível.';end if;
   insert into neo_private.campaign_wa_publications(campaign_id,group_id,scheduled_at,timezone,weekdays,remind,attachments)
    values(campaign,group_id_value,next_at,zone,days,coalesce((p_data->>'remind')::boolean,false) and next_at is not null,attached);
  end loop;
  return jsonb_build_object('saved',true);
 elsif p_action in ('confirm','cancel') then
  select * into strict publication from neo_private.campaign_wa_publications where id=p_id for update;
  if publication.status<>'pending' then return jsonb_build_object('saved',false);end if;
  if p_action='cancel' then
   update neo_private.campaign_wa_publications set status='cancelled' where id=p_id;
  else
   -- The client must confirm the occurrence it actually read, including an unscheduled occurrence.
   if not (p_data ? 'expected_at') or publication.scheduled_at is distinct from (p_data->>'expected_at')::timestamptz then
    raise exception 'A ocorrência mudou. Atualize a fila.';
   end if;
   insert into neo_private.campaign_wa_confirmation(publication_id,scheduled_at,confirmed_by)
    values(p_id,coalesce(publication.scheduled_at,'-infinity'),account);
   next_at:=null;
   if cardinality(publication.weekdays)>0 and publication.scheduled_at is not null then
    wall:=publication.scheduled_at at time zone publication.timezone;
    select day::date into target_day from generate_series(1,7) as n
     cross join lateral (select greatest(wall::date,(now() at time zone publication.timezone)::date)+n as day) d
     where extract(dow from day)::int=any(publication.weekdays) order by day limit 1;
    next_at:=(target_day+wall::time) at time zone publication.timezone;
   end if;
   update neo_private.campaign_wa_publications set status=case when next_at is null then 'done' else 'pending' end,
    scheduled_at=coalesce(next_at,scheduled_at) where id=p_id;
  end if;
  return jsonb_build_object('saved',true);
 else raise exception 'Operação WhatsApp inválida.';
 end if;
end $$;

revoke all on function public.neo_campaign_wa(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.neo_campaign_wa(text,uuid,jsonb) to authenticated;
