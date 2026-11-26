-- Test fixture only: pre-claim legacy RPC reconstructed from catalog definitions of Teste.
-- No data, credentials or changes to live database. Preserve authorization and sync filtering.
CREATE OR REPLACE FUNCTION neo_private.campaign_wa_legacy(p_action text, p_id uuid DEFAULT NULL::uuid, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare account uuid:=auth.uid(); result jsonb; group_row neo_private.campaign_wa_groups; publication neo_private.campaign_wa_publications;
 campaign uuid; group_id_value uuid; wall timestamp; next_at timestamptz; zone text; attached text[]; days int[]; target_day date;
begin
 if not neo_private.campaign_admin_allowed() then raise exception 'Acesso administrativo obrigatório.' using errcode='42501';end if;
 if p_action='groups' then
  select coalesce(jsonb_agg(to_jsonb(g) order by g.active desc,g.category,g.name,g.id),'[]') into result from (
   select * from neo_private.campaign_wa_groups where (position(lower(coalesce(left(p_data->>'search',100),'')) in lower(name||' '||category))>0 or nullif(p_data->>'search','') is null)
   and not exists(select 1 from neo_private.campaign_wa_sync_targets t where t.group_id=campaign_wa_groups.id)
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
   select p.id,p.campaign_id,p.group_id,c.title,g.name as group_name,exists(select 1 from neo_private.campaign_wa_sync_targets t where t.group_id=p.group_id) as synced_target,p.scheduled_at,p.timezone,p.weekdays,p.remind,
    case when p.status<>'pending' then p.status when p.scheduled_at is null then 'pending'
     when p.scheduled_at<=now() then 'late' else 'scheduled' end as state,
    (h.confirmed_at is not null) as manually_confirmed,h.confirmed_at
   from neo_private.campaign_wa_publications p join neo_private.campaigns c on c.id=p.campaign_id
   join neo_private.campaign_wa_groups g on g.id=p.group_id
   left join lateral (select confirmed_at from neo_private.campaign_wa_confirmation
     where publication_id=p.id order by scheduled_at desc limit 1) h on true
   where not exists(select 1 from neo_private.campaign_wa_sync_targets t where t.group_id=p.group_id and t.owner_id<>account)
   order by case when p.status='pending' then 0 else 1 end,p.scheduled_at nulls last,p.id limit 100
  ) j;
  return result;
 elsif p_action='reminders' then
  with due as (
   select p.id,p.scheduled_at,c.title,g.name group_name
   from neo_private.campaign_wa_publications p join neo_private.campaigns c on c.id=p.campaign_id
   join neo_private.campaign_wa_groups g on g.id=p.group_id and g.active
   where not exists(select 1 from neo_private.campaign_wa_sync_targets t where t.group_id=p.group_id and t.owner_id<>account)
   and p.status='pending' and p.remind and p.scheduled_at<=now() and c.whatsapp_enabled and c.status<>'archived'
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
end $function$;
CREATE OR REPLACE FUNCTION public.neo_campaign_wa(p_action text, p_id uuid DEFAULT NULL::uuid, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if auth.uid() is null or not neo_private.campaign_admin_allowed() then
  raise exception 'Acesso administrativo obrigatório.' using errcode='42501';
 end if;
 if (p_action='group_save' and exists(select 1 from neo_private.campaign_wa_sync_targets where group_id=p_id))
 or (p_action='schedule' and jsonb_typeof(p_data->'groups')='array' and exists(
  select 1 from jsonb_array_elements_text(p_data->'groups') i(id)
  join neo_private.campaign_wa_sync_targets t on t.group_id=i.id::uuid))
 or (p_action in ('confirm','cancel','prepare') and exists(
  select 1 from neo_private.campaign_wa_publications p join neo_private.campaign_wa_sync_targets t on t.group_id=p.group_id
   where p.id=case when p_action='prepare' then nullif(p_data->>'publication','')::uuid else p_id end
   and t.owner_id<>auth.uid())) then
  raise exception 'Destinatário indisponível.' using errcode='42501';
 end if;
 return neo_private.campaign_wa_legacy(p_action,p_id,p_data);
end $function$;
revoke all on function neo_private.campaign_wa_legacy(text,uuid,jsonb) from public,anon,authenticated;
