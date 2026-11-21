alter table neo_private.campaigns
 add column popup_enabled boolean not null default true,
 add column content_id uuid,
 add column image_path text check (image_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$'),
 add constraint campaign_has_channel check (popup_enabled or push_requested);

create table neo_private.campaign_plans (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null check (plan ~ '^[a-z0-9_-]{1,40}$'),
 assigned_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table neo_private.campaign_plans enable row level security;
revoke all on neo_private.campaign_plans from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('neo-campaign-images','neo-campaign-images',false,5242880,array['image/jpeg','image/png','image/webp']);

create function neo_private.campaign_admin_allowed() returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and public.neo_admin_access()
 and exists (select 1 from neo_private.admin_members where user_id=auth.uid())
$$;

create function public.neo_campaign_image_allowed(p_path text,p_write boolean)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and case when p_write then
  neo_private.campaign_admin_allowed() and split_part(p_path,'/',1)=auth.uid()::text
  and p_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$'
 else neo_private.campaign_admin_allowed() or (
  public.neo_has_consent('terms') and exists (
   select 1 from neo_private.campaigns c join neo_private.campaign_impressions i on i.campaign_id=c.id
   where c.image_path=p_path and c.status='active' and c.popup_enabled
    and i.user_id=auth.uid() and i.reserved_at>now()-interval '5 minutes'
  )
 ) end
$$;
revoke all on function neo_private.campaign_admin_allowed(),public.neo_campaign_image_allowed(text,boolean) from public,anon,authenticated;
grant execute on function public.neo_campaign_image_allowed(text,boolean) to authenticated;
create policy campaign_images_read on storage.objects for select to authenticated
 using (bucket_id='neo-campaign-images' and (select public.neo_campaign_image_allowed(name,false)));
create policy campaign_images_upload on storage.objects for insert to authenticated
 with check (bucket_id='neo-campaign-images' and (select public.neo_campaign_image_allowed(name,true)));

create function neo_private.campaign_wall_time(p_value text,p_timezone text)
returns timestamptz language plpgsql stable set search_path=pg_catalog as $$
declare local_at timestamp; instant timestamptz;
begin
 if nullif(p_value,'') is null then return null;end if;
 if p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' then
  raise exception 'Data e hora local inválidas.';
 end if;
 local_at:=p_value::timestamp;
 instant:=local_at at time zone p_timezone;
 if instant at time zone p_timezone<>local_at then
  raise exception 'Horário inexistente no fuso informado.';
 end if;
 return instant;
end $$;

create function neo_private.campaign_destination(p_kind text,p_id uuid)
returns text language sql stable set search_path=pg_catalog as $$
 select case
  when p_kind='document' and exists(select 1 from neo_private.community_materials where id=p_id)
   then '/?material='||p_id||'#comunidade'
  when p_kind='product' and exists(select 1 from neo_private.shop_products where id=p_id and active)
   then '/?produto='||p_id||'#loja'
  when p_kind in ('offer','promotion') and exists (
   select 1 from neo_private.shop_promotions where id=p_id and active and not restricted_to_user and restricted_user_id is null
    and kind<>'tracking' and coalesce(starts_at,'-infinity')<=now() and coalesce(ends_at,'infinity')>now()
  ) then '/#loja'
 end
$$;

create function neo_private.campaign_matches(c neo_private.campaigns,p_account uuid,p_now timestamptz)
returns boolean language sql stable set search_path=pg_catalog as $$
 select c.status='active' and coalesce(c.starts_at,'-infinity')<=p_now and coalesce(c.ends_at,'infinity')>p_now
  and extract(dow from (p_now at time zone c.timezone))::integer=any(c.weekdays)
  and (p_now at time zone c.timezone)::time>=c.opens_at and (p_now at time zone c.timezone)::time<c.closes_at
  and exists(select 1 from auth.users u where u.id=p_account and
   (c.audience='all' or (c.audience='plan' and exists (
    select 1 from neo_private.campaign_plans p where p.user_id=u.id and p.plan=any(c.targets)))
   or (c.audience='segment' and (
    ('recent'=any(c.targets) and u.created_at>=p_now-interval '30 days')
    or ('established'=any(c.targets) and u.created_at<p_now-interval '30 days')
    or ('community'=any(c.targets) and exists(select 1 from neo_private.community_members where user_id=u.id))))))
  and (c.content_id is null or neo_private.campaign_destination(c.kind,c.content_id) is not null)
$$;
revoke all on function neo_private.campaign_wall_time(text,text),neo_private.campaign_destination(text,uuid),
 neo_private.campaign_matches(neo_private.campaigns,uuid,timestamptz) from public,anon,authenticated;

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
   'ends_local',to_char(c.ends_at at time zone c.timezone,'YYYY-MM-DD"T"HH24:MI'),'views',s.views,'clicks',s.clicks) order by c.updated_at desc,c.id),'[]')
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
   item.popup_enabled:=true;item.frequency_hours:=24;item.max_views:=1;item.priority:=0;item.push_requested:=false;item.popup_enabled:=true;
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
    max_views=item.max_views,priority=item.priority,push_requested=item.push_requested,popup_enabled=item.popup_enabled,content_id=item.content_id,image_path=item.image_path,updated_at=now() where id=item.id;
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

create or replace function public.neo_campaign_visit(p_action text, p_impression uuid default null)
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
 where c.popup_enabled and neo_private.campaign_matches(c,account,current_time_utc)
  and (select count(*) from neo_private.campaign_impressions where user_id=account and campaign_id=c.id and displayed_at is not null)<c.max_views
  and not exists(select 1 from neo_private.campaign_impressions where user_id=account and campaign_id=c.id
   and displayed_at>current_time_utc-make_interval(hours=>c.frequency_hours))
 order by c.priority desc,c.updated_at desc,c.id limit 1;
 if not found then return null;end if;
 insert into neo_private.campaign_impressions(campaign_id,user_id) values(campaign.id,account) returning id into receipt;
 return jsonb_build_object('impression',receipt,'title',campaign.title,'body',campaign.body,'image_url',campaign.image_url,'image_path',campaign.image_path,
  'link_url',case when campaign.content_id is null then campaign.link_url else neo_private.campaign_destination(campaign.kind,campaign.content_id) end,'link_label',campaign.link_label,'kind',campaign.kind);
end $$;

drop trigger neo_campaign_push_after_display on neo_private.campaign_impressions;

create or replace function public.neo_campaign_push_claim() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role' is distinct from 'service_role'
 then raise exception 'Somente o worker.' using errcode='42501';end if;
 insert into neo_private.campaign_push_delivery(campaign_id,device_id,expires_at)
 select c.id,d.id,least(now()+interval '1 hour',c.ends_at)
 from neo_private.campaigns c cross join neo_private.campaign_push_opt_in o
 join neo_private.push_devices d on d.user_id=o.user_id
 where c.status='active' and c.push_requested and neo_private.campaign_matches(c,d.user_id,now())
 and exists(select 1 from public.neo_consents x where x.user_id=d.user_id and x.purpose='terms' and x.version='2026-11-v1' and x.granted)
 and exists(select 1 from public.neo_profiles x where x.user_id=d.user_id)
 and not exists(select 1 from neo_private.campaign_push_delivery j where j.campaign_id=c.id and j.device_id=d.id)
 order by c.priority desc,c.updated_at desc,c.id,d.id limit 100
 on conflict(campaign_id,device_id) do nothing;
 with picked as (
  select j.id from neo_private.campaign_push_delivery j join neo_private.push_devices d on d.id=j.device_id
  join neo_private.campaigns c on c.id=j.campaign_id
  join neo_private.campaign_push_opt_in o on o.user_id=d.user_id
  where current_setting('request.jwt.claims',true)::jsonb->>'role'='service_role'
   and c.status='active' and c.push_requested and neo_private.campaign_matches(c,d.user_id,now())
   and j.outcome is null and j.attempts<3 and j.expires_at>now() and coalesce(j.lease_until,'-infinity')<now()
   and exists(select 1 from public.neo_consents x where x.user_id=d.user_id and x.purpose='terms' and x.version='2026-11-v1' and x.granted)
  order by j.expires_at,j.id limit 20 for update of j skip locked
 ), claimed as (
  update neo_private.campaign_push_delivery j set lease_until=now()+interval '5 minutes',attempts=j.attempts+1
  from picked where j.id=picked.id returning j.id,j.device_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'endpoint',d.endpoint,'keys',d.keys,'kind','campaign')),'[]')
 into result from claimed j join neo_private.push_devices d on d.id=j.device_id;
 return result;
end $$;
