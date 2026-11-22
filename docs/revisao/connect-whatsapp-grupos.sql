-- Candidato para revisão. Destino previsto: qnuluspqfazdppciermw.
alter table neo_private.connect_devices add constraint connect_devices_id_owner_unique unique (id, owner_id);

create table neo_private.connect_wa_connections (
  id uuid primary key,
  owner_id uuid not null,
  device_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  status text not null default 'connected' check (status in ('connected','disconnected','revoked')),
  last_seen_at timestamptz not null default now(),
  last_synced_at timestamptz,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  foreign key (device_id, owner_id) references neo_private.connect_devices (id, owner_id) on delete cascade
);
create index connect_wa_connections_owner_device on neo_private.connect_wa_connections(owner_id,device_id,id);
create index connect_wa_connections_device_owner on neo_private.connect_wa_connections(device_id,owner_id);

create table neo_private.connect_wa_selected_groups (
  connection_id uuid not null references neo_private.connect_wa_connections(id) on delete cascade,
  group_jid text not null check (group_jid ~ '^[0-9-]{1,64}@g[.]us$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  participant_count integer check (participant_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (connection_id,group_jid)
);
alter table neo_private.connect_wa_connections enable row level security;
alter table neo_private.connect_wa_selected_groups enable row level security;
revoke all on neo_private.connect_wa_connections,neo_private.connect_wa_selected_groups from public,anon,authenticated;

-- Lock device approval for the duration of a write without granting table access.
create function neo_private.connect_wa_assert_device(p_device uuid,p_secret text) returns uuid
language plpgsql security invoker set search_path=pg_catalog as $$
declare owner uuid := auth.uid();
begin
  if owner is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'Computador não autorizado.' using errcode='42501';
  end if;
  perform 1 from neo_private.connect_devices d where d.id=p_device and d.owner_id=owner
    and d.state='approved' and d.secret_hash=sha256(convert_to(p_secret,'UTF8')) for share;
  if not found then raise exception 'Computador não autorizado.' using errcode='42501'; end if;
  return owner;
end $$;
revoke all on function neo_private.connect_wa_assert_device(uuid,text) from public,anon,authenticated;

create function public.neo_connect_wa_replace_selection(p_device uuid,p_secret text,p_connection uuid,
  p_expected_revision bigint,p_label text,p_groups jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare owner uuid := neo_private.connect_wa_assert_device(p_device,p_secret);
  connection neo_private.connect_wa_connections%rowtype;
  saved_at timestamptz := statement_timestamp();
begin
  if p_connection is null or p_expected_revision is null or p_expected_revision < 0
     or p_label is null or char_length(btrim(p_label)) not between 1 and 80
     or jsonb_typeof(p_groups) is distinct from 'array' or pg_column_size(p_groups)>131072 then
    raise exception 'Seleção inválida.' using errcode='22023';
  end if;
  if jsonb_array_length(p_groups)>500 or exists (
    select 1 from jsonb_array_elements(p_groups) rows(item)
    where case when jsonb_typeof(item)<>'object' then true else
      (item - array['group_jid','display_name','participant_count']) <> '{}'::jsonb
      or coalesce(item->>'group_jid','') !~ '^[0-9-]{1,64}@g[.]us$'
      or jsonb_typeof(item->'group_jid') is distinct from 'string'
      or jsonb_typeof(item->'display_name') is distinct from 'string'
      or char_length(btrim(item->>'display_name')) not between 1 and 120
      or case when item->>'participant_count' is null then false
        when jsonb_typeof(item->'participant_count')<>'number' or item->>'participant_count' !~ '^[0-9]{1,10}$' then true
        else (item->>'participant_count')::numeric > 2147483647 end
      end
  ) or exists (
    select 1 from jsonb_array_elements(p_groups) rows(item) group by item->>'group_jid' having count(*)>1
  ) then raise exception 'Seleção inválida.' using errcode='22023'; end if;

  if p_expected_revision=0 then
    insert into neo_private.connect_wa_connections(id,owner_id,device_id,label)
    values(p_connection,owner,p_device,btrim(p_label)) on conflict(id) do nothing;
  end if;
  select * into connection from neo_private.connect_wa_connections c where c.id=p_connection
    and c.owner_id=owner and c.device_id=p_device and c.status<>'revoked' for update;
  if not found then raise exception 'Conexão indisponível.' using errcode='42501'; end if;
  if connection.revision<>p_expected_revision then raise exception 'Revise a seleção atual.' using errcode='40001'; end if;

  delete from neo_private.connect_wa_selected_groups g where g.connection_id=p_connection
    and not exists (select 1 from jsonb_array_elements(p_groups) rows(item) where item->>'group_jid'=g.group_jid);
  insert into neo_private.connect_wa_selected_groups(connection_id,group_jid,display_name,participant_count,updated_at)
  select p_connection,item->>'group_jid',btrim(item->>'display_name'),(item->>'participant_count')::integer,saved_at
  from jsonb_array_elements(p_groups) rows(item)
  on conflict(connection_id,group_jid) do update set display_name=excluded.display_name,
    participant_count=excluded.participant_count,updated_at=excluded.updated_at;

  update neo_private.connect_wa_connections set label=btrim(p_label),last_synced_at=saved_at,
    revision=revision+1 where id=p_connection;
  return jsonb_build_object('revision',connection.revision+1,'last_synced_at',saved_at);
end $$;

create function public.neo_connect_wa_set_status(p_device uuid,p_secret text,p_connection uuid,p_status text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare owner uuid := neo_private.connect_wa_assert_device(p_device,p_secret);
begin
  if p_status is null or p_status not in ('connected','disconnected','revoked') then
    raise exception 'Estado inválido.' using errcode='22023';
  end if;
  update neo_private.connect_wa_connections set status=p_status,last_seen_at=statement_timestamp()
    where id=p_connection and owner_id=owner and device_id=p_device and status<>'revoked';
  if not found then raise exception 'Conexão indisponível.' using errcode='42501'; end if;
end $$;

create function public.neo_connect_wa_list_connections()
returns table(id uuid,label text,status text,revision bigint,last_synced_at timestamptz,group_count bigint)
language sql stable security definer set search_path=pg_catalog as $$
  select c.id,c.label,case when c.status='connected' and c.last_seen_at<statement_timestamp()-interval '5 minutes'
      then 'stale' else c.status end,c.revision,c.last_synced_at,
    (select count(*) from neo_private.connect_wa_selected_groups g where g.connection_id=c.id)
  from neo_private.connect_wa_connections c
  join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=c.owner_id
  where c.owner_id=(select auth.uid()) and d.state='approved' and c.status<>'revoked'
  order by c.created_at desc,c.id;
$$;

create function public.neo_connect_wa_list_groups(p_connection uuid,p_after text default null,p_limit integer default 50)
returns table(group_jid text,display_name text,participant_count integer,updated_at timestamptz)
language sql stable security definer set search_path=pg_catalog as $$
  select g.group_jid,g.display_name,g.participant_count,g.updated_at
  from neo_private.connect_wa_selected_groups g
  join neo_private.connect_wa_connections c on c.id=g.connection_id
  join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=c.owner_id
  where c.id=p_connection and c.owner_id=(select auth.uid()) and d.state='approved' and c.status<>'revoked'
    and (p_after is null or g.group_jid>p_after)
  order by g.group_jid limit greatest(1,least(100,coalesce(p_limit,50)));
$$;

revoke all on function public.neo_connect_wa_replace_selection(uuid,text,uuid,bigint,text,jsonb),
  public.neo_connect_wa_set_status(uuid,text,uuid,text),public.neo_connect_wa_list_connections(),
  public.neo_connect_wa_list_groups(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.neo_connect_wa_replace_selection(uuid,text,uuid,bigint,text,jsonb),
  public.neo_connect_wa_set_status(uuid,text,uuid,text),public.neo_connect_wa_list_connections(),
  public.neo_connect_wa_list_groups(uuid,text,integer) to authenticated;
