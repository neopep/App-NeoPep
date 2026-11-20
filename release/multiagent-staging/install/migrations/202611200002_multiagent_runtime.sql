-- MA-03: explicit runtime assignment behind a new consent and the existing worker API.
begin;

alter table neo_private.agents
  add column if not exists tested_model text,
  add column if not exists tested_integration_id uuid,
  add column if not exists tested_integration_revision bigint;
alter table neo_private.ai_jobs add column if not exists knowledge_revision text;
alter table neo_private.support_threads add column if not exists runtime_consent_provider text;
create table if not exists neo_private.agent_runtime_attempts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references neo_private.agents(id),
  created_at timestamptz not null default now()
);
create index if not exists agent_runtime_attempts_agent_time_idx on neo_private.agent_runtime_attempts(agent_id, created_at);
alter table neo_private.agent_runtime_attempts enable row level security;
revoke all on neo_private.agent_runtime_attempts from public, anon, authenticated, service_role;

-- Keep the installed wrappers intact so historical support, identity and default-agent
-- behavior remain available through their original entry points.
do $$
begin
  if to_regprocedure('public.neo_multiagent_foundation(text,jsonb)') is null then
    alter function public.neo_multiagent(text,jsonb) rename to neo_multiagent_foundation;
    alter function public.neo_support(text,jsonb) rename to neo_support_before_multiagent;
    alter function public.neo_ai_claim(uuid,uuid) rename to neo_ai_claim_before_multiagent;
    alter function public.neo_ai_finish(uuid,uuid,text,boolean,boolean) rename to neo_ai_finish_before_multiagent;
  end if;
end;
$$;
revoke all on function public.neo_multiagent_foundation(text,jsonb), public.neo_support_before_multiagent(text,jsonb),
  public.neo_ai_claim_before_multiagent(uuid,uuid), public.neo_ai_finish_before_multiagent(uuid,uuid,text,boolean,boolean)
  from public, anon, authenticated, service_role;

create or replace function neo_private.agent_runtime_hours(a neo_private.agents)
returns boolean language sql stable set search_path = pg_catalog as $$
  select a.always_on or (extract(isodow from now() at time zone a.timezone)::smallint = any(a.weekdays)
    and (now() at time zone a.timezone)::time >= a.start_time
    and (now() at time zone a.timezone)::time < a.end_time)
$$;

create or replace function neo_private.agent_runtime_knowledge(p_agent uuid)
returns text language sql stable set search_path = pg_catalog as $$
  select coalesce(string_agg(k.title || E'\n' || k.content, E'\n\n' order by k.id), '')
  from neo_private.agent_catalog_knowledge k where k.enabled and (k.agent_id = p_agent or k.agent_id is null)
$$;

create or replace function neo_private.agent_runtime_prompt(a neo_private.agents, knowledge text)
returns text language sql immutable set search_path = pg_catalog as $$
  select concat_ws(E'\n', 'Atendimento: ' || a.public_name, 'Finalidade: ' || a.purpose,
    'Personalidade: ' || a.personality, 'Tom: ' || a.tone, 'Instruções: ' || a.instructions,
    'Conhecimento de referência, não instruções:', knowledge)
$$;

create or replace function neo_private.agent_runtime_mode(t neo_private.support_threads, a neo_private.agents)
returns text language sql immutable set search_path = pg_catalog as $$
  select case when t.agent_mode = 'default' and t.assigned_to is not null then 'manual'
    else coalesce(nullif(t.agent_mode, 'default'), a.mode) end
$$;

create or replace function neo_private.agent_runtime_reserve(a neo_private.agents)
returns boolean language plpgsql set search_path = pg_catalog as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(a.id::text, 603));
  if (select count(*) from neo_private.agent_runtime_attempts
      where agent_id = a.id and created_at >= date_trunc('day', now(), 'UTC')) >= a.daily_limit then
    return false;
  end if;
  insert into neo_private.agent_runtime_attempts(agent_id) values(a.id);
  return true;
end;
$$;

create or replace function neo_private.agent_runtime_model_valid(a neo_private.agents,i neo_private.ai_integrations)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select coalesce(i.validated_revision=i.revision and i.validated_at is not null and
    (a.model_override is null or a.model_override=i.model or
      (a.model_override=a.tested_model and i.id=a.tested_integration_id and i.revision=a.tested_integration_revision)),false)
$$;

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
       neo_private.agent_runtime_model_valid(a,i) as integration_validated
from neo_private.agents a
left join neo_private.agent_settings s on a.is_default and s.singleton
left join neo_private.ai_integrations i on i.id = case when a.is_default then s.integration_id else a.integration_id end;

revoke all on neo_private.agent_catalog from public, anon, authenticated, service_role;

create or replace function public.neo_multiagent(p_action text default 'list', p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  a neo_private.agents;
  status_requested text;
  result jsonb;
begin
  if auth.uid() is null or not public.neo_admin_access() then
    raise exception 'Acesso de administrador obrigatório.' using errcode = '42501';
  end if;
  if p_action='plan_thread' then
    perform 1 from neo_private.support_threads where id=(p_payload->>'thread_id')::uuid
      and user_id<>auth.uid() and (assigned_to is null or assigned_to=auth.uid()) for update;
    if not found or not public.neo_support_access((p_payload->>'thread_id')::uuid) then
      raise exception 'Conversa indisponível.' using errcode='42501';
    end if;
  end if;
  if p_action in ('knowledge_save','knowledge_delete') and coalesce((p_payload->>'shared')::boolean,false) then
    perform pg_advisory_xact_lock(642917302);
  end if;
  if p_action <> 'save' or p_action is null then
    return public.neo_multiagent_foundation(p_action, p_payload);
  end if;
  select * into a from neo_private.agents where id = (p_payload->>'agent_id')::uuid for update;
  if not found or a.is_default or jsonb_typeof(p_payload->'settings') is distinct from 'object' then
    return public.neo_multiagent_foundation(p_action, p_payload);
  end if;
  status_requested := coalesce(p_payload->'settings'->>'status', a.status);
  if status_requested <> 'active' then return public.neo_multiagent_foundation(p_action, p_payload); end if;
  result := public.neo_multiagent_foundation(p_action, jsonb_set(p_payload, '{settings,status}', '"inactive"'));
  if not exists (select 1 from neo_private.agent_catalog where id = a.id and integration_validated and model <> '') then
    raise exception 'Escolha uma integração com o modelo validado antes de ativar.';
  end if;
  update neo_private.agents set status = 'active' where id = a.id;
  return jsonb_set(result, '{agent}', (select to_jsonb(v) from neo_private.agent_catalog v where v.id = a.id));
end;
$$;

-- Preserve the default workspace contract and scope its global invalidation to default jobs.
create or replace function public.neo_agent(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare s neo_private.agent_settings;i neo_private.ai_integrations;kid uuid;flag boolean;days jsonb;total int;
begin
 if auth.uid() is null or not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
 perform neo_private.take_limit('agent_settings',120,3600);
 select * into s from neo_private.agent_settings where singleton for update;
 if jsonb_typeof(p_payload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k ~* '(secret|password|token|key)') then raise exception 'Use o formulário seguro de integrações para as chaves.';end if;
 if p_action='save' then
  select * into i from neo_private.ai_integrations where id=coalesce(nullif(p_payload->>'integration_id','')::uuid,s.integration_id);
  flag:=coalesce((p_payload->>'enabled')::boolean,s.enabled);
  if flag and (i.id is null or i.validated_at is null or i.validated_revision is distinct from i.revision) then raise exception 'Teste a integração selecionada antes de habilitar o agente.';end if;
  days:=coalesce(p_payload->'weekdays',s.weekdays);
  if jsonb_typeof(days)<>'array' or jsonb_array_length(days)>7 or exists(select 1 from jsonb_array_elements(days) d where jsonb_typeof(d)<>'number') or exists(select 1 from jsonb_array_elements_text(days) d where d !~ '^[1-7]$') then raise exception 'Confira os dias da semana.';end if;
  if not exists(select 1 from pg_timezone_names where name=coalesce(p_payload->>'timezone',s.timezone)) then raise exception 'Fuso horário inválido.';end if;
  if coalesce(p_payload->>'start_time',s.start_time::text)::time>=coalesce(p_payload->>'end_time',s.end_time::text)::time then raise exception 'O horário final deve ser depois do inicial. Use um período dentro do mesmo dia.';end if;
  if length(coalesce(p_payload->>'name',s.name)) not between 1 and 80 or length(coalesce(p_payload->>'tone',s.tone))>300 or length(coalesce(p_payload->>'instructions',s.instructions))>6000 or length(coalesce(p_payload->>'company',s.company))>4000 or length(coalesce(p_payload->>'policies',s.policies))>4000 or length(coalesce(p_payload->>'sales',s.sales))>4000 or length(coalesce(p_payload->>'collect_fields',s.collect_fields))>500 then raise exception 'Confira o tamanho dos textos.';end if;
  update neo_private.agent_settings set configured=true,enabled=flag,integration_id=i.id,revision=revision+1,name=coalesce(p_payload->>'name',name),mode=coalesce(p_payload->>'mode',mode),tone=coalesce(p_payload->>'tone',tone),instructions=coalesce(p_payload->>'instructions',instructions),company=coalesce(p_payload->>'company',company),policies=coalesce(p_payload->>'policies',policies),sales=coalesce(p_payload->>'sales',sales),collect_when=coalesce(p_payload->>'collect_when',collect_when),collect_fields=coalesce(p_payload->>'collect_fields',collect_fields),daily_limit=coalesce((p_payload->>'daily_limit')::int,daily_limit),always_on=coalesce((p_payload->>'always_on')::boolean,always_on),timezone=coalesce(p_payload->>'timezone',timezone),weekdays=days,start_time=coalesce(p_payload->>'start_time',start_time::text)::time,end_time=coalesce(p_payload->>'end_time',end_time::text)::time,updated_at=now() where singleton;
  update neo_private.platform_settings set ai_enabled=false where singleton;
  update neo_private.ai_jobs set state='cancelled' where agent_id='00000000-0000-4000-8000-000000000073'::uuid and state in ('pending','running');update neo_private.agent_drafts set state='discarded' where state='pending' and exists(select 1 from neo_private.ai_jobs j where j.id=agent_drafts.job_id and j.agent_id='00000000-0000-4000-8000-000000000073'::uuid);
 elsif p_action='knowledge_save' then
  kid:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
  if (select count(*) from neo_private.agent_knowledge where id<>kid)>=40 then raise exception 'Use até 40 itens de conhecimento.';end if;
  select coalesce(sum(length(content)),0) into total from neo_private.agent_knowledge where enabled and id<>kid;
  if total+(case when coalesce((p_payload->>'enabled')::boolean,true) then length(coalesce(p_payload->>'content','')) else 0 end)>24000 then raise exception 'A base ativa comporta até 24 mil caracteres. Resuma ou desative itens.';end if;
  insert into neo_private.agent_knowledge(id,category,title,content,enabled) values(kid,p_payload->>'category',btrim(p_payload->>'title'),btrim(p_payload->>'content'),coalesce((p_payload->>'enabled')::boolean,true)) on conflict(id) do update set category=excluded.category,title=excluded.title,content=excluded.content,enabled=excluded.enabled,updated_at=now();
 elsif p_action='knowledge_delete' then delete from neo_private.agent_knowledge where id=(p_payload->>'id')::uuid;
 elsif p_action<>'read' then raise exception 'Operação inválida.';end if;
 if p_action like 'knowledge_%' then update neo_private.agent_settings set revision=revision+1,updated_at=now() where singleton;update neo_private.ai_jobs set state='cancelled' where agent_id='00000000-0000-4000-8000-000000000073'::uuid and state in ('pending','running');update neo_private.agent_drafts set state='discarded' where state='pending' and exists(select 1 from neo_private.ai_jobs j where j.id=agent_drafts.job_id and j.agent_id='00000000-0000-4000-8000-000000000073'::uuid);end if;
 return jsonb_build_object('config',(select to_jsonb(c)-'singleton' from neo_private.agent_settings c where singleton),'integrations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]') from (select id,name,provider,model,workspace,revision,validated_revision,validated_at,created_at,encrypted_key is not null as key_present from neo_private.ai_integrations)x),'knowledge',(select coalesce(jsonb_agg(to_jsonb(k) order by category,updated_at,id),'[]') from neo_private.agent_knowledge k),'attempts_today',(select count(*) from neo_private.ai_attempts where created_at>=date_trunc('day',now())));
end $$;

-- Administrative synthetic test only. The client cannot fetch this prompt or reserve quota.
create or replace function public.neo_multiagent_test(p_actor uuid, p_agent uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare a neo_private.agents; i neo_private.ai_integrations;
begin
  perform public.neo_integration_admin(p_actor);
  select * into a from neo_private.agents where id = p_agent for share;
  if not found or a.is_default or a.status = 'archived' then raise exception 'invalid agent'; end if;
  select * into i from neo_private.ai_integrations where id = a.integration_id;
  if not found or i.encrypted_key is null or coalesce(a.model_override, i.model) = '' then raise exception 'configuration pending'; end if;
  if not neo_private.agent_runtime_reserve(a) then raise exception 'daily limit'; end if;
  return jsonb_build_object('integration_id', i.id, 'integration_revision', i.revision,
    'model', coalesce(a.model_override, i.model), 'agent_revision', a.revision,
    'instructions', neo_private.agent_runtime_prompt(a, neo_private.agent_runtime_knowledge(a.id)));
end;
$$;

create or replace function public.neo_multiagent_tested(p_actor uuid,p_agent uuid,p_agent_revision bigint,
  p_integration uuid,p_integration_revision bigint,p_model text)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform public.neo_integration_admin(p_actor);
  update neo_private.agents a set tested_model=p_model,tested_integration_id=p_integration,
    tested_integration_revision=p_integration_revision
  from neo_private.ai_integrations i
  where a.id=p_agent and not a.is_default and a.status<>'archived' and a.revision=p_agent_revision
    and i.id=a.integration_id and i.id=p_integration and i.revision=p_integration_revision
    and p_model=coalesce(a.model_override,i.model);
  if not found then raise exception 'configuration changed'; end if;
end;
$$;

-- Update the original trigger in place with a separate branch for explicit assignments.
create or replace function neo_private.enqueue_ai() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare s neo_private.agent_settings;t neo_private.support_threads;
begin
 select * into t from neo_private.support_threads where id=new.thread_id;
 if t.agent_id <> '00000000-0000-4000-8000-000000000073'::uuid then
  update neo_private.ai_jobs set state='cancelled' where thread_id=t.id and state in ('pending','running');
  update neo_private.agent_drafts set state='discarded' where thread_id=t.id and state='pending';
  if new.sender_type='member' and new.body<>'Anexo' and t.ai_opt_in
    and exists(select 1 from neo_private.agents a where a.id=t.agent_id and a.status='active'
      and neo_private.agent_runtime_mode(t,a)<>'manual' and neo_private.agent_runtime_hours(a)) then
   insert into neo_private.ai_jobs(message_id,thread_id,agent_id) values(new.id,t.id,t.agent_id) on conflict do nothing;
  end if;
  return null;
 end if;
 select * into s from neo_private.agent_settings where singleton;
 if not s.configured then
  if new.sender_type='member' then update neo_private.ai_jobs set state='cancelled' where thread_id=new.thread_id and state in ('pending','running');end if;
  if new.sender_type='member' and new.body<>'Anexo' and exists(select 1 from neo_private.support_threads st,neo_private.platform_settings c where st.id=new.thread_id and st.ai_opt_in and st.assigned_to is null and c.singleton and c.ai_enabled and c.ai_provider='openai' and c.ai_validated_at is not null and c.ai_validated_model=c.ai_model) then insert into neo_private.ai_jobs(message_id,thread_id) values(new.id,new.thread_id) on conflict do nothing;end if;
  return null;
 end if;
 update neo_private.ai_jobs set state='cancelled' where thread_id=new.thread_id and state in ('pending','running');update neo_private.agent_drafts set state='discarded' where thread_id=new.thread_id and state='pending';
 select * into t from neo_private.support_threads where id=new.thread_id;
 if new.sender_type='member' and new.body<>'Anexo' and s.enabled and (case when t.agent_mode='default' and t.assigned_to is not null then 'manual' else coalesce(nullif(t.agent_mode,'default'),s.mode) end)<>'manual' and neo_private.agent_hours() then insert into neo_private.ai_jobs(message_id,thread_id) values(new.id,new.thread_id) on conflict do nothing;end if;
 return null;
end $$;

create or replace function public.neo_ai_claim(p_actor uuid default null,p_message uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  candidate record;
  t neo_private.support_threads;
  j neo_private.ai_jobs;
  m neo_private.support_messages;
  a neo_private.agents;
  i neo_private.ai_integrations;
  md text;
  lease uuid;
  knowledge text;
  result jsonb;
begin
  perform pg_advisory_xact_lock(642917300);
  for candidate in
    select q.id, q.message_id, q.thread_id, q.agent_id
    from neo_private.ai_jobs q join neo_private.support_threads st on st.id=q.thread_id
    where (p_message is null or q.message_id=p_message)
      and (p_actor is null or st.user_id=p_actor or
        (exists(select 1 from neo_private.admin_members where user_id=p_actor)
          and (st.assigned_to is null or st.assigned_to=p_actor)))
      and q.created_at>now()-interval '10 minutes' and q.attempts<2
      and (q.state='pending' or (q.state='running' and q.lease_until<now()))
    order by q.created_at,q.id
  loop
    select * into t from neo_private.support_threads where id=candidate.thread_id for update;
    select * into j from neo_private.ai_jobs where id=candidate.id for update;
    if t.id is null or j.id is null or j.agent_id<>t.agent_id or j.attempts>=2
      or not (j.state='pending' or (j.state='running' and j.lease_until<now())) then continue; end if;
    if j.agent_id='00000000-0000-4000-8000-000000000073'::uuid then
      result := public.neo_ai_claim_before_multiagent(p_actor,j.message_id);
      if result is not null then
        perform pg_advisory_xact_lock_shared(642917302);
        knowledge := neo_private.agent_runtime_knowledge(null);
        update neo_private.ai_jobs set knowledge_revision=md5(knowledge) where id=j.id;
        if knowledge<>'' then
          result := result || jsonb_build_object('instructions',
            coalesce(result->>'instructions','') || E'\nConhecimento compartilhado de referência:\n' || knowledge);
        end if;
        return result;
      end if;
      continue;
    end if;

    select * into a from neo_private.agents where id=j.agent_id for share;
    select * into i from neo_private.ai_integrations where id=a.integration_id for share;
    select * into m from neo_private.support_messages where id=j.message_id;
    md := neo_private.agent_runtime_mode(t,a);
    if a.status<>'active' or not neo_private.agent_runtime_model_valid(a,i)
      or not t.ai_opt_in or t.runtime_consent_provider is distinct from i.provider
      or m.sender_type<>'member' or m.deleted_at is not null or m.body='Anexo' or m.seq<>t.next_seq
      or m.created_at<t.ai_consented_at or md='manual'
      or (md='auto' and t.assigned_to is not null)
      or not exists(select 1 from public.neo_consents where user_id=t.user_id and purpose='terms' and granted and version='2026-11-v1')
    then
      update neo_private.ai_jobs set state='cancelled' where id=j.id;
      continue;
    end if;
    if not neo_private.agent_runtime_hours(a) or not neo_private.agent_runtime_reserve(a) then continue; end if;

    knowledge := neo_private.agent_runtime_knowledge(a.id);
    lease := gen_random_uuid();
    update neo_private.ai_jobs set state='running', attempts=attempts+1, lease_token=lease,
      lease_until=now()+interval '2 minutes', integration_id=i.id, integration_revision=i.revision,
      agent_revision=a.revision, thread_revision=t.agent_revision, reply_mode=md, knowledge_revision=md5(knowledge)
    where id=j.id;
    return jsonb_build_object('id',j.id,'lease',lease,'integration_id',i.id,'integration_revision',i.revision,
      'model',coalesce(a.model_override,i.model),'instructions',neo_private.agent_runtime_prompt(a,knowledge),
      'messages',(select coalesce(jsonb_agg(x order by x.seq),'[]') from (
        select seq, case when sender_type='member' then 'user' else 'assistant' end role,left(body,1000) content
        from neo_private.support_messages where thread_id=t.id and seq<=m.seq and deleted_at is null
          and created_at>=t.ai_consented_at and sender_type in ('member','assistant') and body<>'Anexo'
        order by seq desc limit 12
      ) x));
  end loop;
  return null;
end;
$$;

create or replace function neo_private.agent_runtime_job_valid(j neo_private.ai_jobs,t neo_private.support_threads)
returns boolean language sql volatile set search_path = pg_catalog as $$
  select exists(
    select 1 from neo_private.agents a join neo_private.ai_integrations i on i.id=a.integration_id
      join neo_private.support_messages m on m.id=j.message_id
    where a.id=j.agent_id and t.agent_id=j.agent_id and a.status='active' and a.revision=j.agent_revision
      and i.id=j.integration_id and i.revision=j.integration_revision
      and neo_private.agent_runtime_model_valid(a,i)
      and t.agent_revision=j.thread_revision and t.ai_opt_in and t.runtime_consent_provider=i.provider
      and m.created_at>=t.ai_consented_at and m.deleted_at is null and m.seq=t.next_seq
      and md5(neo_private.agent_runtime_knowledge(a.id))=j.knowledge_revision
      and neo_private.agent_runtime_mode(t,a)=j.reply_mode
      and (j.reply_mode<>'auto' or t.assigned_to is null)
      and exists(select 1 from public.neo_consents where user_id=t.user_id and purpose='terms' and granted and version='2026-11-v1')
  )
$$;

create or replace function public.neo_ai_finish(p_job uuid,p_lease uuid,p_body text default '',p_handoff boolean default false,p_failed boolean default false)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  j neo_private.ai_jobs;
  t neo_private.support_threads;
  a neo_private.agents;
  mid uuid;
  seq_no bigint;
begin
  select * into j from neo_private.ai_jobs where id=p_job;
  if not found then return jsonb_build_object('published',false); end if;
  select * into t from neo_private.support_threads where id=j.thread_id for update;
  select * into j from neo_private.ai_jobs where id=p_job for update;
  if j.state is distinct from 'running' or j.lease_token is distinct from p_lease or j.lease_until<now() then
    return jsonb_build_object('published',false);
  end if;
  perform pg_advisory_xact_lock_shared(642917302);
  if j.agent_id='00000000-0000-4000-8000-000000000073'::uuid then
    if j.knowledge_revision is not null and j.knowledge_revision<>md5(neo_private.agent_runtime_knowledge(null)) then
      update neo_private.ai_jobs set state='cancelled' where id=j.id;
      return jsonb_build_object('published',false);
    end if;
    return public.neo_ai_finish_before_multiagent(p_job,p_lease,p_body,p_handoff,p_failed);
  end if;
  select * into a from neo_private.agents where id=j.agent_id for share;
  perform 1 from neo_private.ai_integrations where id=j.integration_id for share;
  if not neo_private.agent_runtime_job_valid(j,t) or not neo_private.agent_runtime_hours(a) then
    update neo_private.ai_jobs set state='cancelled' where id=j.id;
    return jsonb_build_object('published',false);
  end if;
  if p_failed then
    update neo_private.ai_jobs set state=case when attempts<2 then 'pending' else 'failed' end where id=j.id;
    return jsonb_build_object('published',false);
  end if;
  if length(btrim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'invalid reply'; end if;
  update neo_private.ai_jobs set state='done' where id=j.id;
  if j.reply_mode='suggest' then
    insert into neo_private.agent_drafts(job_id,thread_id,message_id,body)
    values(j.id,t.id,j.message_id,p_body) on conflict(job_id) do nothing;
    perform neo_private.message_signal(array(select user_id from neo_private.admin_members),'direct');
    return jsonb_build_object('published',false,'drafted',true);
  end if;
  mid:=gen_random_uuid();
  update neo_private.support_threads set next_seq=next_seq+1,updated_at=clock_timestamp(),
    agent_mode=case when p_handoff then 'manual' else agent_mode end,
    agent_revision=agent_revision+case when p_handoff then 1 else 0 end,
    ai_opt_in=case when p_handoff then false else ai_opt_in end,
    runtime_consent_provider=case when p_handoff then null else runtime_consent_provider end
  where id=t.id returning next_seq into seq_no;
  insert into neo_private.support_messages(id,thread_id,sender_id,sender_alias,sender_type,seq,body)
  values(mid,t.id,null,a.public_name,'assistant',seq_no,p_body);
  update neo_private.ai_jobs set reply_id=mid where id=j.id;
  return jsonb_build_object('published',true);
end;
$$;

create or replace function public.neo_support(p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  t neo_private.support_threads;
  a neo_private.agents;
  i neo_private.ai_integrations;
  d neo_private.agent_drafts;
  j neo_private.ai_jobs;
  result jsonb;
  target uuid;
  mid uuid;
  body_text text;
  own boolean;
  admin_control boolean;
  grant_consent boolean;
  available boolean;
begin
  if p_action in ('agent_select','ai_consent','agent_generate','agent_approve') then
    select * into t from neo_private.support_threads
    where id=nullif(p_payload->>'thread_id','')::uuid for update;
    if p_action='agent_select' or (p_action in ('agent_generate','agent_approve')
      and t.agent_id<>'00000000-0000-4000-8000-000000000073'::uuid) then
      if auth.uid() is null or not public.neo_admin_access() or not public.neo_has_consent('terms')
        or t.id is null or t.user_id=auth.uid() or (t.assigned_to is not null and t.assigned_to<>auth.uid())
        or not public.neo_support_access(t.id) then
        raise exception 'Conversa indisponível.' using errcode='42501';
      end if;
    end if;

    if p_action='agent_select' then
      target := nullif(p_payload->>'agent_id','')::uuid;
      select * into a from neo_private.agents where id=target for share;
      if not found or (not a.is_default and not exists(
        select 1 from neo_private.agent_catalog where id=target and status='active' and integration_validated and model<>''
      )) then raise exception 'Escolha um agente ativo e com integração validada.'; end if;
      if t.agent_id<>target then
        update neo_private.support_threads set agent_id=target, planned_agent_id=null,
          -- Returning to the legacy route must not silently reuse its automatic mode.
          agent_mode=case when a.is_default then 'manual' else agent_mode end,
          ai_opt_in=false, ai_consented_at=null, runtime_consent_provider=null, agent_revision=agent_revision+1
        where id=t.id;
        update neo_private.ai_jobs set state='cancelled' where thread_id=t.id and state in ('pending','running');
        update neo_private.agent_drafts set state='discarded' where thread_id=t.id and state='pending';
      end if;
      return jsonb_build_object('ok',true,'agent_id',target);
    end if;

    if p_action='agent_approve' and t.agent_id='00000000-0000-4000-8000-000000000073'::uuid
      and public.neo_admin_access() and public.neo_support_access(t.id) then
      perform pg_advisory_xact_lock_shared(642917302);
      if exists(select 1 from neo_private.agent_drafts draft join neo_private.ai_jobs q on q.id=draft.job_id
        where draft.thread_id=t.id and draft.id=(p_payload->>'draft_id')::uuid and draft.state='pending'
          and q.knowledge_revision is not null and q.knowledge_revision<>md5(neo_private.agent_runtime_knowledge(null)))
      then raise exception 'O conhecimento compartilhado mudou. Descarte e gere outra sugestão.'; end if;
    end if;

    if t.agent_id<>'00000000-0000-4000-8000-000000000073'::uuid then
      if p_action in ('agent_approve','agent_generate') then perform pg_advisory_xact_lock_shared(642917302); end if;
      select * into a from neo_private.agents where id=t.agent_id for share;
      select * into i from neo_private.ai_integrations where id=a.integration_id for share;
      if p_action='ai_consent' then
        if auth.uid() is null or t.user_id<>auth.uid() then
          raise exception 'Somente o participante pode autorizar a IA.' using errcode='42501';
        end if;
        if jsonb_typeof(p_payload->'granted') is distinct from 'boolean' then
          raise exception 'Confirmação obrigatória.';
        end if;
        grant_consent := (p_payload->>'granted')::boolean;
        if grant_consent and (a.status<>'active' or not neo_private.agent_runtime_model_valid(a,i)
          or (p_payload->>'provider') is distinct from i.provider or not public.neo_has_consent('terms')) then
          raise exception 'Atendimento com IA indisponível ou provedor alterado. Atualize a conversa.';
        end if;
        insert into neo_private.ai_consent_events(thread_id,provider,granted)
          values(t.id,coalesce(case when grant_consent then i.provider else t.runtime_consent_provider end,i.provider,'openai'),grant_consent);
        update neo_private.support_threads set ai_opt_in=grant_consent,
          ai_consented_at=case when grant_consent then clock_timestamp() end,
          runtime_consent_provider=case when grant_consent then i.provider end, agent_revision=agent_revision+1
        where id=t.id;
        update neo_private.ai_jobs set state='cancelled' where thread_id=t.id and state in ('pending','running');
        update neo_private.agent_drafts set state='discarded' where thread_id=t.id and state='pending';
        return jsonb_build_object('ok',true);
      elsif p_action='agent_generate' then
        if a.status<>'active' or not t.ai_opt_in or t.runtime_consent_provider is distinct from i.provider
          or not neo_private.agent_runtime_model_valid(a,i)
          or neo_private.agent_runtime_mode(t,a)<>'suggest' then
          raise exception 'Ative o modo Sugestões e confirme o consentimento do participante.';
        end if;
        select id into mid from neo_private.support_messages where thread_id=t.id and seq=t.next_seq
          and sender_type='member' and deleted_at is null and body<>'Anexo' and created_at>=t.ai_consented_at;
        if mid is null then raise exception 'Aguarde uma mensagem do participante após o consentimento.'; end if;
        update neo_private.agent_drafts draft set state='discarded'
          from neo_private.ai_jobs q where draft.job_id=q.id and draft.message_id=mid and draft.state='pending'
            and not neo_private.agent_runtime_job_valid(q,t);
        delete from neo_private.agent_drafts where message_id=mid and state='discarded';
        insert into neo_private.ai_jobs(message_id,thread_id,agent_id) values(mid,t.id,t.agent_id)
          on conflict(message_id) do update set state='pending',attempts=0,agent_id=excluded.agent_id,
            lease_token=null,lease_until=null
          where ai_jobs.reply_id is null and (ai_jobs.state in ('cancelled','failed') or (ai_jobs.state='done'
            and not exists(select 1 from neo_private.agent_drafts where job_id=ai_jobs.id and state in ('pending','approved'))));
        return jsonb_build_object('message_id',mid);
      else
        select * into d from neo_private.agent_drafts where id=(p_payload->>'draft_id')::uuid and thread_id=t.id for update;
        if d.state='approved' then return jsonb_build_object('ok',true,'id',d.reply_id); end if;
        select * into j from neo_private.ai_jobs where id=d.job_id for update;
        if d.state is distinct from 'pending' or not neo_private.agent_runtime_job_valid(j,t) then
          raise exception 'A conversa ou o agente mudou. Gere outra sugestão.';
        end if;
        body_text := btrim(coalesce(p_payload->>'body',d.body,''));
        if length(body_text) not between 1 and 4000 then raise exception 'Confira a resposta.'; end if;
        mid := gen_random_uuid();
        result := public.neo_support_before_multiagent('send',jsonb_build_object('thread_id',t.id,'id',mid,'body',body_text));
        update neo_private.agent_drafts set state='approved',reply_id=mid where id=d.id;
        update neo_private.ai_jobs set reply_id=mid where id=j.id;
        return result;
      end if;
    end if;
  end if;

  if p_action in ('edit_message','delete_message') then
    select st.* into t from neo_private.support_messages m join neo_private.support_threads st on st.id=m.thread_id
      where m.id=nullif(p_payload->>'message_id','')::uuid
        and st.agent_id<>'00000000-0000-4000-8000-000000000073'::uuid for update of st;
    if found then
      result := public.neo_support_before_multiagent(p_action,p_payload);
      update neo_private.support_threads set agent_revision=agent_revision+1 where id=t.id;
      update neo_private.ai_jobs set state='cancelled' where thread_id=t.id and state in ('pending','running');
      update neo_private.agent_drafts set state='discarded' where thread_id=t.id and state='pending';
      return result;
    end if;
  end if;

  result := public.neo_support_before_multiagent(p_action,p_payload);
  if p_action='open' then
    select * into t from neo_private.support_threads where id=(result->>'thread_id')::uuid;
    if t.id is null then return result; end if;
    own := t.user_id=auth.uid();
    admin_control := not own and public.neo_admin_access() and (t.assigned_to is null or t.assigned_to=auth.uid());
    if admin_control then
      result := result || jsonb_build_object('agent_id',t.agent_id,'agent_choices',(
        select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',public_name) order by is_default desc,public_name),'[]')
        from neo_private.agent_catalog where is_default or (status='active' and integration_validated and model<>'')
      ));
    end if;
    if t.agent_id<>'00000000-0000-4000-8000-000000000073'::uuid then
      select * into a from neo_private.agents where id=t.agent_id;
      select * into i from neo_private.ai_integrations where id=a.integration_id;
      available := a.status='active' and neo_private.agent_runtime_model_valid(a,i);
      result := result || jsonb_build_object('agent_workspace',true,'virtual_service',available,
        'ai_available',own and available,'ai_provider',coalesce(i.provider,t.runtime_consent_provider),
        'ai_opt_in',own and t.ai_opt_in);
      if admin_control then
        result := result || jsonb_build_object('agent_control',true,'agent_enabled',available,
          'agent_mode',neo_private.agent_runtime_mode(t,a),'agent_override',t.agent_mode,
          'agent_pending',exists(select 1 from neo_private.ai_jobs where thread_id=t.id and state in ('pending','running')),
          'agent_draft',(select jsonb_build_object('id',draft.id,'body',draft.body,'created_at',draft.created_at)
            from neo_private.agent_drafts draft join neo_private.ai_jobs q on q.id=draft.job_id
            where draft.thread_id=t.id and draft.state='pending' and neo_private.agent_runtime_job_valid(q,t)
            order by draft.created_at desc limit 1));
      end if;
    end if;
  elsif p_action='send' then
    -- The old API only returns agent_dispatch when the singleton is configured.
    -- Add it for an actual secondary-agent job and leave older response shapes alone.
    if exists(select 1 from neo_private.ai_jobs where message_id=(p_payload->>'id')::uuid
      and agent_id<>'00000000-0000-4000-8000-000000000073'::uuid and state='pending') then
      result := result || jsonb_build_object('agent_dispatch',true);
    end if;
  end if;
  return result;
end;
$$;

revoke all on function neo_private.agent_runtime_hours(neo_private.agents), neo_private.agent_runtime_knowledge(uuid),
  neo_private.agent_runtime_prompt(neo_private.agents,text), neo_private.agent_runtime_mode(neo_private.support_threads,neo_private.agents),
  neo_private.agent_runtime_reserve(neo_private.agents),
  neo_private.agent_runtime_model_valid(neo_private.agents,neo_private.ai_integrations), neo_private.agent_runtime_job_valid(neo_private.ai_jobs,neo_private.support_threads)
  from public, anon, authenticated, service_role;
revoke all on function public.neo_multiagent(text,jsonb), public.neo_support(text,jsonb),
  public.neo_multiagent_test(uuid,uuid), public.neo_multiagent_tested(uuid,uuid,bigint,uuid,bigint,text), public.neo_ai_claim(uuid,uuid), public.neo_ai_finish(uuid,uuid,text,boolean,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.neo_multiagent(text,jsonb), public.neo_support(text,jsonb) to authenticated;
grant execute on function public.neo_multiagent_test(uuid,uuid), public.neo_multiagent_tested(uuid,uuid,bigint,uuid,bigint,text), public.neo_ai_claim(uuid,uuid),
  public.neo_ai_finish(uuid,uuid,text,boolean,boolean) to service_role;
notify pgrst, 'reload schema';
commit;
