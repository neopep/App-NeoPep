-- MA-01/02: catalog and attribution alongside the existing singleton runtime.
begin;

create table if not exists neo_private.agents (
  id uuid primary key default gen_random_uuid(),
  is_default boolean not null default false,
  public_name text not null check (length(btrim(public_name)) between 1 and 80),
  admin_name text not null check (length(btrim(admin_name)) between 1 and 80),
  description text not null default '' check (length(description) <= 1000),
  purpose text not null default '' check (length(purpose) <= 1000),
  visual_identity jsonb not null default '{}' check (jsonb_typeof(visual_identity) = 'object'),
  status text not null default 'inactive' check (status in ('active', 'inactive', 'archived')),
  integration_id uuid references neo_private.ai_integrations(id),
  model_override text check (model_override ~ '^[-A-Za-z0-9._:]{1,100}$'),
  instructions text not null default '' check (length(instructions) <= 6000),
  personality text not null default '' check (length(personality) <= 1000),
  tone text not null default '' check (length(tone) <= 300),
  mode text not null default 'manual' check (mode in ('manual', 'suggest', 'auto')),
  daily_limit integer not null default 50 check (daily_limit between 1 and 500),
  always_on boolean not null default true,
  timezone text not null default 'America/Sao_Paulo',
  weekdays smallint[] not null default array[1,2,3,4,5]::smallint[]
    check (cardinality(weekdays) <= 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
      and array_position(weekdays, null) is null),
  start_time time not null default '08:00',
  end_time time not null default '18:00',
  revision bigint not null default 1,
  -- Reserved for backend policy and routing. No capability or entitlement is implied.
  permissions jsonb not null default '[]' check (jsonb_typeof(permissions) = 'array'),
  tools jsonb not null default '[]' check (jsonb_typeof(tools) = 'array'),
  routing_policy jsonb not null default '{}' check (jsonb_typeof(routing_policy) = 'object'),
  allowed_plans text[] not null default '{}',
  check (start_time < end_time),
  check (model_override is null or integration_id is not null),
  check (is_default = (id = '00000000-0000-4000-8000-000000000073'::uuid))
);

insert into neo_private.agents (id, is_default, public_name, admin_name)
select '00000000-0000-4000-8000-000000000073', true, s.name, 'Agente padrão'
from neo_private.agent_settings s where s.singleton
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from neo_private.agent_settings where singleton) then
    raise exception 'A configuração do agente padrão é obrigatória.';
  end if;
end;
$$;

create table if not exists neo_private.agent_catalog_knowledge (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references neo_private.agents(id),
  category text not null check (category in ('company','product','policy','faq','instruction','file','link')),
  title text not null check (length(btrim(title)) between 1 and 120),
  content text not null check (length(btrim(content)) between 1 and 6000),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  check (agent_id is distinct from '00000000-0000-4000-8000-000000000073'::uuid)
);
create index if not exists agent_catalog_knowledge_scope_idx on neo_private.agent_catalog_knowledge(agent_id);

-- Existing inserts, including legacy jobs and attempts, keep their original runtime owner.
-- Dedicated identities are reserved for the later worker cutover.
alter table neo_private.support_threads
  add column if not exists agent_id uuid not null default '00000000-0000-4000-8000-000000000073' references neo_private.agents(id),
  add column if not exists planned_agent_id uuid references neo_private.agents(id);
alter table neo_private.ai_jobs
  add column if not exists agent_id uuid not null default '00000000-0000-4000-8000-000000000073' references neo_private.agents(id);
alter table neo_private.ai_attempts
  add column if not exists agent_id uuid not null default '00000000-0000-4000-8000-000000000073' references neo_private.agents(id),
  add column if not exists input_tokens bigint check (input_tokens >= 0),
  add column if not exists output_tokens bigint check (output_tokens >= 0),
  add column if not exists cost_microusd bigint check (cost_microusd >= 0);

alter table neo_private.agents enable row level security;
alter table neo_private.agent_catalog_knowledge enable row level security;
revoke all on neo_private.agents, neo_private.agent_catalog_knowledge from public, anon, authenticated, service_role;

-- The default agent reads the original row live. Legacy writes need no dual-write,
-- and the catalog does not copy, convert or expose encrypted provider credentials.
create or replace view neo_private.agent_catalog as
select a.id, a.is_default, a.admin_name, a.description, a.purpose, a.visual_identity,
       case when a.is_default then s.name else a.public_name end as public_name,
       case when a.is_default then case when s.enabled then 'active' else 'inactive' end else a.status end as status,
       case when a.is_default then to_jsonb(s) - 'singleton'
         else jsonb_build_object(
           'instructions', a.instructions, 'personality', a.personality, 'tone', a.tone,
           'mode', a.mode, 'daily_limit', a.daily_limit, 'always_on', a.always_on,
           'timezone', a.timezone, 'weekdays', a.weekdays, 'start_time', a.start_time,
           'end_time', a.end_time, 'revision', a.revision, 'enabled', false
         ) end as settings,
       i.id as integration_id, i.provider,
       case when a.is_default then i.model else coalesce(a.model_override, i.model) end as model,
       coalesce(i.validated_revision = i.revision and i.validated_at is not null
         and (a.model_override is null or a.model_override = i.model), false) as integration_validated
from neo_private.agents a
left join neo_private.agent_settings s on a.is_default and s.singleton
left join neo_private.ai_integrations i on i.id = case when a.is_default then s.integration_id else a.integration_id end;

revoke all on neo_private.agent_catalog from public, anon, authenticated, service_role;

create or replace function public.neo_multiagent(p_action text default 'list', p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  target uuid;
  picked neo_private.agents;
  item_id uuid;
  expected_revision bigint;
  edits jsonb;
  shared boolean;
  known_items integer;
  active_size integer;
begin
  if auth.uid() is null or not public.neo_admin_access() then
    raise exception 'Acesso de administrador obrigatório.' using errcode = '42501';
  end if;
  perform neo_private.take_limit('agent_settings', 120, 3600);
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Dados do agente inválidos.';
  end if;

  if p_action = 'list' then
    return coalesce((select jsonb_agg(to_jsonb(a) order by a.is_default desc, a.admin_name, a.id)
                     from neo_private.agent_catalog a), '[]');
  end if;

  if p_action = 'create' then
    insert into neo_private.agents(public_name, admin_name)
    values (btrim(p_payload->>'public_name'), btrim(p_payload->>'admin_name'))
    returning id into target;
  else
    target := (p_payload->>'agent_id')::uuid;
    select * into picked from neo_private.agents where id = target for update;
    if not found then raise exception 'Agente não encontrado.'; end if;
  end if;

  if p_action = 'save' then
    if picked.is_default then raise exception 'Use a configuração atual para o agente padrão.'; end if;
    expected_revision := (p_payload->>'expected_revision')::bigint;
    if picked.revision is distinct from expected_revision then
      raise exception 'A configuração do agente mudou. Recarregue antes de salvar.' using errcode = '40001';
    end if;
    edits := p_payload->'settings';
    if jsonb_typeof(edits) is distinct from 'object' or exists (
      select 1 from jsonb_object_keys(edits) as fields(key)
      where key not in ('public_name','admin_name','description','purpose','visual_identity','status',
        'integration_id','model_override','instructions','personality','tone','mode','daily_limit',
        'always_on','timezone','weekdays','start_time','end_time')
    ) then raise exception 'Configuração do agente inválida.'; end if;
    picked := jsonb_populate_record(picked, edits);
    if picked.status not in ('inactive','archived') then
      raise exception 'A ativação de agentes adicionais não está disponível.';
    end if;
    if not exists (select 1 from pg_timezone_names where name = picked.timezone) then
      raise exception 'Fuso horário inválido.';
    end if;

    update neo_private.agents set
      public_name = btrim(picked.public_name), admin_name = btrim(picked.admin_name),
      description = picked.description, purpose = picked.purpose, visual_identity = picked.visual_identity,
      status = picked.status, integration_id = picked.integration_id, model_override = picked.model_override,
      instructions = picked.instructions, personality = picked.personality, tone = picked.tone,
      mode = picked.mode, daily_limit = picked.daily_limit, always_on = picked.always_on,
      timezone = picked.timezone, weekdays = picked.weekdays, start_time = picked.start_time,
      end_time = picked.end_time, revision = revision + 1
    where id = target;

  elsif p_action = 'plan_thread' then
    if picked.status = 'archived' then raise exception 'Agente arquivado.'; end if;
    update neo_private.support_threads
      set planned_agent_id = case when picked.is_default then null else target end
      where id = (p_payload->>'thread_id')::uuid;
    if not found then raise exception 'Conversa não encontrada.'; end if;

  elsif p_action in ('knowledge_save','knowledge_delete') then
    shared := coalesce((p_payload->>'shared')::boolean, false);
    if picked.is_default and not shared then
      raise exception 'Use a base atual para o conhecimento do agente padrão.';
    end if;
    if picked.status = 'archived' then raise exception 'Agente arquivado.'; end if;
    -- Per-agent writes already hold the catalog row lock. All shared writers use one lock.
    if shared then perform pg_advisory_xact_lock(642917301); end if;
    item_id := (p_payload->>'item_id')::uuid;
    if item_id is not null then
      perform 1 from neo_private.agent_catalog_knowledge
        where id = item_id and agent_id is not distinct from case when shared then null else target end
        for update;
      if not found then raise exception 'Item não encontrado neste escopo.'; end if;
    end if;
    if p_action = 'knowledge_delete' then
      if item_id is null then raise exception 'Identifique o item.'; end if;
      delete from neo_private.agent_catalog_knowledge where id = item_id;
    else
      select count(*), coalesce(sum(length(content)) filter (where enabled), 0)
        into known_items, active_size
        from neo_private.agent_catalog_knowledge
        where agent_id is not distinct from case when shared then null else target end
          and id is distinct from item_id;
      if known_items >= 40 or active_size +
        (case when coalesce((p_payload->>'enabled')::boolean, true)
          then coalesce(length(btrim(p_payload->>'content')), 0) else 0 end) > 24000
      then raise exception 'Limite da base de conhecimento excedido.'; end if;

      insert into neo_private.agent_catalog_knowledge(id, agent_id, category, title, content, enabled)
      values (coalesce(item_id, gen_random_uuid()), case when shared then null else target end,
        p_payload->>'category', btrim(p_payload->>'title'), btrim(p_payload->>'content'),
        coalesce((p_payload->>'enabled')::boolean, true))
      on conflict (id) do update set category = excluded.category, title = excluded.title,
        content = excluded.content, enabled = excluded.enabled, updated_at = now();
    end if;
    if not shared then
      update neo_private.agents set revision = revision + 1 where id = target;
    end if;

  elsif p_action not in ('create','read') or p_action is null then
    raise exception 'Operação inválida.';
  end if;

  return jsonb_build_object(
    'agent', (select to_jsonb(a) from neo_private.agent_catalog a where id = target),
    'knowledge', (select coalesce(jsonb_agg(to_jsonb(k) order by k.category, k.updated_at, k.id), '[]')
      from (
        select id, agent_id, category, title, content, enabled, updated_at, agent_id is null as shared
        from neo_private.agent_catalog_knowledge where agent_id = target or agent_id is null
        union all
        select id, target, category, title, content, enabled, updated_at, false
        from neo_private.agent_knowledge where target = '00000000-0000-4000-8000-000000000073'::uuid
      ) k)
  );
end;
$$;

revoke all on function public.neo_multiagent(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.neo_multiagent(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
