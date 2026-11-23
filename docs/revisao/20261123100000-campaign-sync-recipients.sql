begin;

-- Requires the separately installed Connect group synchronization contract.
do $$
declare legacy oid:=to_regprocedure('public.neo_campaign_wa(text,uuid,jsonb)');
begin
 if to_regprocedure('public.neo_connect_wa_list_connections()') is null
 or legacy is null
 or to_regclass('neo_private.connect_wa_selected_groups') is null
 or to_regclass('neo_private.connect_group_accounts') is null then
  raise exception 'Instale e verifique os contratos de Campanhas e Connect primeiro.';
 end if;
 if not exists(select from pg_proc where oid=legacy and prosecdef
   and encode(sha256(convert_to(prosrc,'UTF8')),'hex')=
   '32e19084e06db5328a3aad6365d93804daf3b978dda4994068ff50fcd024d087') then
  raise exception 'Corpo da RPC WhatsApp divergente do baseline revisado.';
 end if;
end $$;

create table neo_private.campaign_wa_sync_targets (
 group_id uuid primary key references neo_private.campaign_wa_groups(id),
 owner_id uuid not null,
 connection_id uuid not null,
 group_jid text not null check (group_jid ~ '^[0-9-]{1,64}@g[.]us$'),
 unique(owner_id,connection_id,group_jid)
);
create table neo_private.campaign_wa_recipients (
 campaign_id uuid not null references neo_private.campaigns(id),
 group_id uuid not null references neo_private.campaign_wa_sync_targets(group_id),
 primary key(campaign_id,group_id)
);
alter table neo_private.campaign_wa_sync_targets enable row level security;
alter table neo_private.campaign_wa_recipients enable row level security;
revoke all on neo_private.campaign_wa_sync_targets,neo_private.campaign_wa_recipients from public,anon,authenticated,service_role;

-- Keep the legacy queue, confirmation and scheduling logic. Scope reads before limiting.
alter function public.neo_campaign_wa(text,uuid,jsonb) set schema neo_private;
alter function neo_private.neo_campaign_wa(text,uuid,jsonb) rename to campaign_wa_legacy;
revoke all on function neo_private.campaign_wa_legacy(text,uuid,jsonb) from public,anon,authenticated,service_role;
do $$
declare sql text:=pg_get_functiondef('neo_private.campaign_wa_legacy(text,uuid,jsonb)'::regprocedure);
 changed text;
begin
 -- Parenthesize the original search predicate before adding the scope.
 changed:=replace(sql,'where
   position(lower(coalesce(left(p_data->>''search'',100),'''')) in lower(name||'' ''||category))>0 or nullif(p_data->>''search'','''') is null',
  'where (position(lower(coalesce(left(p_data->>''search'',100),'''')) in lower(name||'' ''||category))>0 or nullif(p_data->>''search'','''') is null)
   and not exists(select 1 from neo_private.campaign_wa_sync_targets t where t.group_id=campaign_wa_groups.id)');
 if changed=sql then raise exception 'Contrato legado de grupos divergente.'; end if;
 sql:=changed;
 changed:=replace(sql,'order by case when p.status=',
  'where not exists(select 1 from neo_private.campaign_wa_sync_targets t where t.group_id=p.group_id and t.owner_id<>account)
   order by case when p.status=');
 if changed=sql then raise exception 'Contrato legado da fila divergente.'; end if;
 sql:=changed;
 changed:=replace(sql,'where p.status=''pending'' and p.remind',
  'where not exists(select 1 from neo_private.campaign_wa_sync_targets t where t.group_id=p.group_id and t.owner_id<>account)
   and p.status=''pending'' and p.remind');
 if changed=sql then raise exception 'Contrato legado de lembretes divergente.'; end if;
 sql:=changed;
 changed:=replace(sql,'g.name as group_name,p.scheduled_at',
  'g.name as group_name,exists(select 1 from neo_private.campaign_wa_sync_targets t where t.group_id=p.group_id) as synced_target,p.scheduled_at');
 if changed=sql then raise exception 'Projeção legada da fila divergente.'; end if;
 execute changed;
end $$;

create function neo_private.campaign_wa_block_simulated_binding() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if exists(select 1 from neo_private.campaign_wa_sync_targets where group_id=new.group_id) then
  raise exception 'Grupo sincronizado reservado para divulgação manual.' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function neo_private.campaign_wa_block_simulated_binding() from public,anon,authenticated,service_role;
create trigger campaign_wa_no_simulated_binding before insert or update on neo_private.connect_group_accounts
for each row execute function neo_private.campaign_wa_block_simulated_binding();

create function public.neo_campaign_wa(p_action text,p_id uuid default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
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
end $$;
revoke all on function public.neo_campaign_wa(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_campaign_wa(text,uuid,jsonb) to authenticated;

create function neo_private.campaign_wa_sync_catalog(p_owner uuid)
returns table(id text,name text,connection text,participant_count integer,last_synced_at timestamptz,updated_at timestamptz,state text)
language sql stable set search_path=pg_catalog as $$
 select c.id::text||':'||g.group_jid,g.display_name,c.label,g.participant_count,c.last_synced_at,g.updated_at,
 case when d.state<>'approved' or c.status='revoked' then 'unavailable'
      when c.status<>'connected' then 'disconnected'
      when c.last_seen_at<statement_timestamp()-interval '5 minutes' then 'stale'
      else 'eligible' end
 from neo_private.connect_wa_selected_groups g join neo_private.connect_wa_connections c on c.id=g.connection_id
 join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=c.owner_id
 where c.owner_id=p_owner
$$;
revoke all on function neo_private.campaign_wa_sync_catalog(uuid) from public,anon,authenticated,service_role;

create function public.neo_campaign_wa_sync(p_action text,p_id uuid default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare owner uuid:=auth.uid(); saved jsonb; chosen jsonb; target_id uuid; target_key text;
 connection_id_value uuid; jid text; target_name text; targets uuid[]:='{}'; jids text[]:='{}';
 scheduled timestamptz;
begin
 if owner is null or not neo_private.campaign_admin_allowed() then
  raise exception 'Acesso administrativo obrigatório.' using errcode='42501';
 end if;
 if p_action='catalog' then
  return (select coalesce(jsonb_agg(to_jsonb(c) order by lower(c.name),c.id),'[]') from neo_private.campaign_wa_sync_catalog(owner) c);
 end if;
 if p_action='recipients' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',t.connection_id::text||':'||t.group_jid,
   'name',coalesce(c.name,h.name),'connection',c.connection,'state',coalesce(c.state,'unavailable'))
   order by h.name,t.group_id),'[]')
   from neo_private.campaign_wa_recipients r join neo_private.campaign_wa_sync_targets t using(group_id)
   join neo_private.campaign_wa_groups h on h.id=t.group_id
   left join neo_private.campaign_wa_sync_catalog(owner) c on c.id=t.connection_id::text||':'||t.group_jid
   where r.campaign_id=p_id and t.owner_id=owner);
 end if;
 if p_action not in ('save','schedule') then raise exception 'Operação indisponível.'; end if;
 chosen:=p_data->'recipients';
 if jsonb_typeof(chosen) is distinct from 'array' or jsonb_array_length(chosen)>30
 or (p_action='schedule' and jsonb_array_length(chosen)=0) then
  raise exception 'Selecione até 30 grupos sincronizados.' using errcode='22023';
 end if;
 if p_action='save' then
  saved:=public.neo_campaign_admin('save',p_id,p_data-'recipients');
  p_id:=(saved->>'id')::uuid;
 end if;
 perform 1 from neo_private.campaigns where id=p_id and (p_action='save' or status<>'archived')
   and (whatsapp_enabled or p_action='save' and chosen='[]') for update;
 if not found then raise exception 'Campanha WhatsApp indisponível.' using errcode='22023'; end if;
 if p_action='schedule' then
  scheduled:=neo_private.campaign_wall_time(p_data->>'local_time',coalesce(nullif(p_data->>'timezone',''),'America/Sao_Paulo'));
 end if;
 for target_key in select value from jsonb_array_elements_text(chosen) order by value loop
  if target_key is null or target_key !~ '^[a-f0-9-]{36}:[0-9-]{1,64}@g[.]us$' then raise exception 'Destinatário inválido.' using errcode='22023'; end if;
  connection_id_value:=split_part(target_key,':',1)::uuid;
  jid:=split_part(target_key,':',2);
  if jid=any(jids) then raise exception 'O mesmo grupo foi selecionado mais de uma vez.' using errcode='22023'; end if;
  jids:=array_append(jids,jid);
  select g.display_name into target_name
  from neo_private.connect_wa_selected_groups g join neo_private.connect_wa_connections c on c.id=g.connection_id
  join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=c.owner_id
  where c.id=connection_id_value and g.group_jid=jid and c.owner_id=owner
    and d.state='approved' and c.status='connected' and c.last_seen_at>=statement_timestamp()-interval '5 minutes'
  for share of c,d,g;
  if not found then
   -- An existing unavailable selection may survive edits, but is never scheduled.
   if p_action='save' then
    select t.group_id into target_id from neo_private.campaign_wa_sync_targets t
     join neo_private.campaign_wa_recipients r using(group_id)
     where r.campaign_id=p_id and t.owner_id=owner and t.connection_id=connection_id_value and t.group_jid=jid;
    if found then targets:=array_append(targets,target_id);continue;end if;
   end if;
   raise exception 'Grupo indisponível para esta conta.' using errcode='42501';
  end if;
  if p_action='schedule' and exists(
   select 1 from neo_private.campaign_wa_publications p join neo_private.campaign_wa_sync_targets t on p.group_id=t.group_id
    where p.campaign_id=p_id and t.group_jid=jid and p.status='pending' and p.scheduled_at is not distinct from scheduled
  ) then raise exception 'Já existe publicação pendente para este grupo e horário.' using errcode='23505'; end if;
  -- Serializes first registration across campaigns for this owner and connection.
  perform pg_advisory_xact_lock(hashtextextended(owner::text||target_key,0));
  select group_id into target_id from neo_private.campaign_wa_sync_targets
   where owner_id=owner and connection_id=connection_id_value and group_jid=jid;
  if not found then
   insert into neo_private.campaign_wa_groups(name) values(target_name) returning id into target_id;
   insert into neo_private.campaign_wa_sync_targets values(target_id,owner,connection_id_value,jid);
  end if;
  targets:=array_append(targets,target_id);
 end loop;
 if p_action='schedule' then
  return neo_private.campaign_wa_legacy('schedule',null,(p_data-'recipients')||jsonb_build_object('campaign_id',p_id,'groups',targets));
 end if;
 delete from neo_private.campaign_wa_recipients r using neo_private.campaign_wa_sync_targets t
  where r.campaign_id=p_id and r.group_id=t.group_id and t.owner_id=owner and not(r.group_id=any(targets));
 insert into neo_private.campaign_wa_recipients select p_id,target from unnest(targets) target on conflict do nothing;
 return saved;
end $$;
revoke all on function public.neo_campaign_wa_sync(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_campaign_wa_sync(text,uuid,jsonb) to authenticated;

commit;
