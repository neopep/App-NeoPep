-- Agent workspace: encrypted provider credentials, knowledge, modes, drafts and schedule.
-- Requires migrations through 025. No API credentials are included here.
begin;
create table if not exists neo_private.ai_integrations(
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 80),provider text not null check(provider in ('openai','gemini','claude')),model text not null default '' check(length(model)<=100 and (model='' or model ~ '^[-A-Za-z0-9._:]+$')),workspace text not null default '' check(length(workspace)<=120),encrypted_key jsonb,revision bigint not null default 1,validated_revision bigint,validated_at timestamptz,created_at timestamptz not null default now());
create table if not exists neo_private.agent_settings(
 singleton boolean primary key default true check(singleton),configured boolean not null default false,enabled boolean not null default false,integration_id uuid references neo_private.ai_integrations(id),revision bigint not null default 1,
 name text not null default 'Atendimento NeoPeptídeos',mode text not null default 'auto' check(mode in ('manual','suggest','auto')),tone text not null default 'Acolhedor, claro e objetivo',instructions text not null default 'Ajude no uso do aplicativo. Responda em português. Encaminhe assuntos clínicos à equipe.',company text not null default '',policies text not null default '',sales text not null default '',collect_when text not null default 'when_needed' check(collect_when in ('never','start','when_needed','purchase')),collect_fields text not null default 'Nome e motivo do contato',daily_limit int not null default 50 check(daily_limit between 1 and 500),always_on boolean not null default true,timezone text not null default 'America/Sao_Paulo',weekdays jsonb not null default '[1,2,3,4,5]',start_time time not null default '08:00',end_time time not null default '18:00',updated_at timestamptz not null default now());
insert into neo_private.ai_integrations(id,name,provider) values('00000000-0000-4000-8000-000000000026','ChatGPT · OpenAI','openai') on conflict do nothing;
insert into neo_private.agent_settings(singleton,integration_id) values(true,'00000000-0000-4000-8000-000000000026') on conflict do nothing;
create table if not exists neo_private.agent_knowledge(id uuid primary key default gen_random_uuid(),category text not null check(category in ('company','product','policy','faq','instruction','file','link')),title text not null check(length(title) between 1 and 120),content text not null check(length(content) between 1 and 6000),enabled boolean not null default true,updated_at timestamptz not null default now());
create table if not exists neo_private.agent_drafts(id uuid primary key default gen_random_uuid(),job_id uuid not null unique references neo_private.ai_jobs(id) on delete cascade,thread_id uuid not null references neo_private.support_threads(id) on delete cascade,message_id uuid not null references neo_private.support_messages(id) on delete cascade,body text not null,state text not null default 'pending' check(state in ('pending','approved','discarded')),reply_id uuid,created_at timestamptz not null default now());
alter table neo_private.support_threads add column if not exists agent_mode text not null default 'default' check(agent_mode in ('default','manual','suggest','auto'));
alter table neo_private.support_threads add column if not exists agent_revision bigint not null default 1;
alter table neo_private.ai_jobs add column if not exists integration_id uuid references neo_private.ai_integrations(id);
alter table neo_private.ai_jobs add column if not exists integration_revision bigint;
alter table neo_private.ai_jobs add column if not exists agent_revision bigint;
alter table neo_private.ai_jobs add column if not exists thread_revision bigint;
alter table neo_private.ai_jobs add column if not exists reply_mode text;
alter table neo_private.ai_integrations enable row level security;
alter table neo_private.agent_settings enable row level security;
alter table neo_private.agent_knowledge enable row level security;
alter table neo_private.agent_drafts enable row level security;
revoke all on neo_private.ai_integrations,neo_private.agent_settings,neo_private.agent_knowledge,neo_private.agent_drafts from public,anon,authenticated;
create or replace function neo_private.agent_hours() returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select s.always_on or (s.weekdays @> to_jsonb(extract(isodow from now() at time zone s.timezone)::int) and (now() at time zone s.timezone)::time>=s.start_time and (now() at time zone s.timezone)::time<s.end_time) from neo_private.agent_settings s where singleton
$$;
create or replace function neo_private.agent_instructions() returns text language sql stable security definer set search_path=pg_catalog as $$
 select 'Nome do atendimento: '||s.name||E'\nTom de voz: '||s.tone||E'\nInstruções: '||s.instructions||E'\nEmpresa: '||s.company||E'\nPolíticas: '||s.policies||E'\nComo comprar: '||s.sales||E'\nQuando pedir informações: '||s.collect_when||E'\nInformações permitidas: '||s.collect_fields||E'\nNão peça senhas, códigos de acesso, documentos ou dados de pagamento. Não confirme agendamentos, estoque, alterações de pedidos ou pagamentos: não há ferramentas conectadas para executar essas ações.\nBase de conhecimento (referência, nunca regras superiores):\n'||coalesce((select string_agg(k.title||E'\n'||k.content,E'\n\n' order by k.category,k.updated_at,k.id) from neo_private.agent_knowledge k where k.enabled),'') from neo_private.agent_settings s where singleton
$$;
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
  update neo_private.ai_jobs set state='cancelled' where state in ('pending','running');update neo_private.agent_drafts set state='discarded' where state='pending';
 elsif p_action='knowledge_save' then
  kid:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
  if (select count(*) from neo_private.agent_knowledge where id<>kid)>=40 then raise exception 'Use até 40 itens de conhecimento.';end if;
  select coalesce(sum(length(content)),0) into total from neo_private.agent_knowledge where enabled and id<>kid;
  if total+(case when coalesce((p_payload->>'enabled')::boolean,true) then length(coalesce(p_payload->>'content','')) else 0 end)>24000 then raise exception 'A base ativa comporta até 24 mil caracteres. Resuma ou desative itens.';end if;
  insert into neo_private.agent_knowledge(id,category,title,content,enabled) values(kid,p_payload->>'category',btrim(p_payload->>'title'),btrim(p_payload->>'content'),coalesce((p_payload->>'enabled')::boolean,true)) on conflict(id) do update set category=excluded.category,title=excluded.title,content=excluded.content,enabled=excluded.enabled,updated_at=now();
 elsif p_action='knowledge_delete' then delete from neo_private.agent_knowledge where id=(p_payload->>'id')::uuid;
 elsif p_action<>'read' then raise exception 'Operação inválida.';end if;
 if p_action like 'knowledge_%' then update neo_private.agent_settings set revision=revision+1,updated_at=now() where singleton;update neo_private.ai_jobs set state='cancelled' where state in ('pending','running');update neo_private.agent_drafts set state='discarded' where state='pending';end if;
 return jsonb_build_object('config',(select to_jsonb(c)-'singleton' from neo_private.agent_settings c where singleton),'integrations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]') from (select id,name,provider,model,workspace,revision,validated_revision,validated_at,created_at,encrypted_key is not null as key_present from neo_private.ai_integrations)x),'knowledge',(select coalesce(jsonb_agg(to_jsonb(k) order by category,updated_at,id),'[]') from neo_private.agent_knowledge k),'attempts_today',(select count(*) from neo_private.ai_attempts where created_at>=date_trunc('day',now())));
end $$;
-- Service role only. Never grant credential or encryption payload reads to the browser.
create or replace function public.neo_agent_credentials(p_id uuid) returns jsonb language sql security definer set search_path=pg_catalog as $$ select to_jsonb(i) from neo_private.ai_integrations i where id=p_id $$;
create or replace function public.neo_agent_integration(p_actor uuid,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare i neo_private.ai_integrations;kid uuid;rev bigint;
begin
 perform public.neo_integration_admin(p_actor);
 perform pg_advisory_xact_lock(642917301);
 kid:=nullif(p_payload->>'id','')::uuid;
 if p_action='save' then
  select * into i from neo_private.ai_integrations where id=kid for update;
  if i.id is not null and (p_payload->>'expected_revision')::bigint is distinct from i.revision then raise exception 'configuration changed';end if;
  if i.id is null and (select count(*) from neo_private.ai_integrations)>=12 then raise exception 'integration limit';end if;
  if (i.id is null or i.provider is distinct from p_payload->>'provider') and p_payload->'encrypted_key' is null then raise exception 'key required';end if;
  if p_payload->'encrypted_key' is not null and (jsonb_typeof(p_payload->'encrypted_key')<>'object' or length(p_payload->'encrypted_key'->>'iv')<>16 or length(p_payload->'encrypted_key'->>'data') not between 40 and 6000) then raise exception 'invalid encrypted credential';end if;
  insert into neo_private.ai_integrations(id,name,provider,model,workspace,encrypted_key) values(kid,p_payload->>'name',p_payload->>'provider',p_payload->>'model',coalesce(p_payload->>'workspace',''),p_payload->'encrypted_key') on conflict(id) do update set name=excluded.name,provider=excluded.provider,model=excluded.model,workspace=excluded.workspace,encrypted_key=coalesce(excluded.encrypted_key,ai_integrations.encrypted_key),revision=ai_integrations.revision+1,validated_revision=null,validated_at=null;
  update neo_private.agent_settings set enabled=false,revision=revision+1 where singleton and integration_id=kid;
 elsif p_action='validated' then
  update neo_private.ai_integrations set validated_revision=revision,validated_at=now() where id=kid and revision=(p_payload->>'revision')::bigint;
  if not found then raise exception 'configuration changed';end if;
 elsif p_action='delete' then
  if exists(select 1 from neo_private.agent_settings where integration_id=kid) then raise exception 'Selecione outra integração antes de excluir esta.';end if;
  if exists(select 1 from neo_private.ai_jobs where integration_id=kid) then update neo_private.ai_jobs set state='cancelled',integration_id=null where integration_id=kid;end if;
  delete from neo_private.ai_integrations where id=kid;
 elsif p_action='reserve_test' then
  perform pg_advisory_xact_lock(642917300);
  if (select count(*) from neo_private.ai_attempts where created_at>=date_trunc('day',now())) >= (select daily_limit from neo_private.agent_settings where singleton) then raise exception 'daily limit';end if;
  insert into neo_private.ai_attempts default values;
 elsif p_action='prompt' then return jsonb_build_object('instructions',neo_private.agent_instructions());
 else raise exception 'invalid action';end if;
 return jsonb_build_object('ok',true,'id',kid);
end $$;
-- Keep access to other administrators' assigned conversations restricted.
create or replace function public.neo_support_access(p_thread uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$select auth.uid() is not null and exists(select 1 from neo_private.support_threads where id=p_thread and (user_id=auth.uid() or (public.neo_is_moderator() and (assigned_to=auth.uid() or (assigned_to is null and exists(select 1 from neo_private.agent_settings where singleton and configured))))))$$;
do $$begin if to_regprocedure('public.neo_support_v25(text,jsonb)') is null then alter function public.neo_support(text,jsonb) rename to neo_support_v25;end if;end $$;
revoke all on function public.neo_support_v25(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_support(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;s neo_private.agent_settings;t neo_private.support_threads;d neo_private.agent_drafts;tid uuid;md text;mid uuid;body_text text;
begin
 select * into s from neo_private.agent_settings where singleton;
 if p_action in ('agent_mode','agent_approve','agent_discard','agent_generate') then
  if auth.uid() is null or not public.neo_admin_access() or not public.neo_has_consent('terms') then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  tid:=(p_payload->>'thread_id')::uuid;select * into t from neo_private.support_threads where id=tid for update;
  if t.id is null or t.user_id=auth.uid() or (t.assigned_to is not null and t.assigned_to<>auth.uid()) then raise exception 'conversation access denied' using errcode='42501';end if;
  if p_action='agent_mode' then
   md:=p_payload->>'mode';if md not in ('default','manual','suggest','auto') or md is null then raise exception 'invalid mode';end if;
   update neo_private.support_threads set agent_mode=md,agent_revision=agent_revision+1,assigned_to=case when md in ('manual','suggest') then auth.uid() else null end where id=tid;
   update neo_private.ai_jobs set state='cancelled' where thread_id=tid and state in ('pending','running');update neo_private.agent_drafts set state='discarded' where thread_id=tid and state='pending';
   return jsonb_build_object('ok',true);
  elsif p_action in ('agent_approve','agent_discard') then
   select * into d from neo_private.agent_drafts where id=(p_payload->>'draft_id')::uuid and thread_id=tid for update;
   if d.id is null then raise exception 'Sugestão indisponível.';end if;
   if p_action='agent_discard' then update neo_private.agent_drafts set state='discarded' where id=d.id and state='pending';return jsonb_build_object('ok',true);end if;
   if d.state='approved' then return jsonb_build_object('ok',true,'id',d.reply_id);end if;
   if d.state<>'pending' or not exists(select 1 from neo_private.support_messages m join neo_private.ai_jobs j on j.message_id=m.id join neo_private.ai_integrations i on i.id=j.integration_id where j.id=d.job_id and m.seq=t.next_seq and j.agent_revision=s.revision and j.thread_revision=t.agent_revision and i.revision=j.integration_revision and i.id=s.integration_id) then raise exception 'A conversa ou configuração mudou. Gere outra sugestão.';end if;
   body_text:=coalesce(p_payload->>'body',d.body);if length(btrim(body_text)) not between 1 and 4000 then raise exception 'Confira a resposta.';end if;
   if t.assigned_to is null then perform public.neo_support_v20('claim',jsonb_build_object('thread_id',tid));end if;
   mid:=gen_random_uuid();result:=public.neo_support_v20('send',jsonb_build_object('thread_id',tid,'id',mid,'body',body_text));update neo_private.agent_drafts set state='approved',reply_id=mid where id=d.id;return result;
  else
   if not s.enabled or (case when t.agent_mode='default' and t.assigned_to is not null then 'manual' else coalesce(nullif(t.agent_mode,'default'),s.mode) end)<>'suggest' then raise exception 'Ative o agente e o modo Sugestões para esta conversa.';end if;
   select id into mid from neo_private.support_messages where thread_id=tid and seq=t.next_seq and sender_type='member';if mid is null then raise exception 'Aguarde uma mensagem do participante.';end if;
   delete from neo_private.agent_drafts where message_id=mid and state='discarded';
   insert into neo_private.ai_jobs(message_id,thread_id) values(mid,tid) on conflict(message_id) do update set state='pending',attempts=0 where ai_jobs.state in ('cancelled','failed') or (ai_jobs.state='done' and not exists(select 1 from neo_private.agent_drafts where job_id=ai_jobs.id and state='pending'));return jsonb_build_object('message_id',mid);
  end if;
 end if;
 if p_action='ai_consent' and s.configured then raise exception 'Esta versão usa o atendimento virtual configurado pela equipe.';end if;
 -- A human sending a manual message assumes the conversation before writing.
 if p_action='send' and s.configured and public.neo_admin_access() then
  tid:=nullif(p_payload->>'thread_id','')::uuid;select * into t from neo_private.support_threads where id=tid for update;
  if t.id is not null and t.user_id<>auth.uid() and (t.assigned_to is null or t.assigned_to=auth.uid()) then
   if t.assigned_to is null then perform public.neo_support_v20('claim',jsonb_build_object('thread_id',tid));end if;
   update neo_private.support_threads set agent_mode='manual',agent_revision=agent_revision+1 where id=tid;update neo_private.agent_drafts set state='discarded' where thread_id=tid and state='pending';
  end if;
 end if;
 result:=public.neo_support_v25(p_action,p_payload);
 if p_action in ('claim','start') then update neo_private.support_threads set agent_mode='manual',agent_revision=agent_revision+1 where id=(result->>'thread_id')::uuid;update neo_private.agent_drafts set state='discarded' where thread_id=(result->>'thread_id')::uuid and state='pending';end if;
 if not s.configured then return result;end if;
 if p_action='list' and public.neo_admin_access() then
  result:=result||jsonb_build_object('agent_workspace',true,'threads',coalesce((select jsonb_agg(x.value||jsonb_build_object('agent_mode',case when not s.enabled then 'manual' else (case when st.agent_mode='default' and st.assigned_to is not null then 'manual' else coalesce(nullif(st.agent_mode,'default'),s.mode) end) end,'preview',(select left(m.body,120) from neo_private.support_messages m where m.thread_id=st.id order by seq desc limit 1),'draft_ready',exists(select 1 from neo_private.agent_drafts where thread_id=st.id and state='pending')) order by st.updated_at desc,st.id) from jsonb_array_elements(result->'threads') x(value) join neo_private.support_threads st on st.id=(x.value->>'id')::uuid),'[]'));
 elsif p_action='open' then
  tid:=(result->>'thread_id')::uuid;select * into t from neo_private.support_threads where id=tid;
  result:=result||jsonb_build_object('agent_workspace',true,'ai_available',false,'ai_opt_in',false,'virtual_service',s.enabled,'agent_dispatch',s.enabled and (case when t.agent_mode='default' and t.assigned_to is not null then 'manual' else coalesce(nullif(t.agent_mode,'default'),s.mode) end)<>'manual','agent_pending',exists(select 1 from neo_private.ai_jobs where thread_id=tid and state in ('pending','running')));
  if public.neo_admin_access() and t.user_id<>auth.uid() then result:=result||jsonb_build_object('agent_control',true,'agent_enabled',s.enabled,'agent_mode',(case when t.agent_mode='default' and t.assigned_to is not null then 'manual' else coalesce(nullif(t.agent_mode,'default'),s.mode) end),'agent_override',t.agent_mode,'agent_draft',(select jsonb_build_object('id',id,'body',body,'created_at',created_at) from neo_private.agent_drafts where thread_id=tid and state='pending' order by created_at desc limit 1),'agent_pending',exists(select 1 from neo_private.ai_jobs where thread_id=tid and state in ('pending','running')));end if;
 elsif p_action='send' then result:=result||jsonb_build_object('agent_dispatch',exists(select 1 from neo_private.ai_jobs where message_id=(p_payload->>'id')::uuid and state='pending'));
 end if;return result;
end $$;
-- Replace worker functions with backward-compatible wrappers for the unconfigured legacy agent.
do $$begin if to_regprocedure('public.neo_ai_claim_v25(uuid,uuid)') is null then alter function public.neo_ai_claim(uuid,uuid) rename to neo_ai_claim_v25;end if;if to_regprocedure('public.neo_ai_finish_v25(uuid,uuid,text,boolean,boolean)') is null then alter function public.neo_ai_finish(uuid,uuid,text,boolean,boolean) rename to neo_ai_finish_v25;end if;end $$;
revoke all on function public.neo_ai_claim_v25(uuid,uuid),public.neo_ai_finish_v25(uuid,uuid,text,boolean,boolean) from public,anon,authenticated;
create or replace function neo_private.enqueue_ai() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare s neo_private.agent_settings;t neo_private.support_threads;
begin
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
create or replace function public.neo_ai_claim(p_actor uuid default null,p_message uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j neo_private.ai_jobs;t neo_private.support_threads;s neo_private.agent_settings;i neo_private.ai_integrations;m neo_private.support_messages;lease uuid;md text;
begin
 perform pg_advisory_xact_lock(642917300);
 select * into s from neo_private.agent_settings where singleton;
 if not s.configured then return public.neo_ai_claim_v25(p_actor,p_message);end if;
 select * into i from neo_private.ai_integrations where id=s.integration_id;
 if not s.enabled or i.id is null or i.validated_revision is distinct from i.revision or not neo_private.agent_hours() or (select count(*) from neo_private.ai_attempts where created_at>=date_trunc('day',now()))>=s.daily_limit then return null;end if;
 select q.* into j from neo_private.ai_jobs q join neo_private.support_threads st on st.id=q.thread_id where (p_message is null or q.message_id=p_message) and (p_actor is null or st.user_id=p_actor or (exists(select 1 from neo_private.admin_members where user_id=p_actor) and (st.assigned_to is null or st.assigned_to=p_actor))) and q.created_at>now()-interval '10 minutes' and q.attempts<2 and (q.state='pending' or (q.state='running' and q.lease_until<now())) order by q.created_at,q.id limit 1;
 if not found then return null;end if;
 select * into t from neo_private.support_threads where id=j.thread_id for update;select * into j from neo_private.ai_jobs where id=j.id for update;select * into m from neo_private.support_messages where id=j.message_id;
 md:=(case when t.agent_mode='default' and t.assigned_to is not null then 'manual' else coalesce(nullif(t.agent_mode,'default'),s.mode) end);
 if j.state not in ('pending','running') or md='manual' or t.next_seq<>m.seq or (md='auto' and t.assigned_to is not null) or not exists(select 1 from public.neo_consents where user_id=t.user_id and purpose='terms' and granted and version='2026-11-v1') then update neo_private.ai_jobs set state='cancelled' where id=j.id;return null;end if;
 lease:=gen_random_uuid();update neo_private.ai_jobs set state='running',attempts=attempts+1,lease_token=lease,lease_until=now()+interval '2 minutes',integration_id=i.id,integration_revision=i.revision,agent_revision=s.revision,thread_revision=t.agent_revision,reply_mode=md where id=j.id;insert into neo_private.ai_attempts default values;
 return jsonb_build_object('id',j.id,'lease',lease,'integration_id',i.id,'integration_revision',i.revision,'model',i.model,'instructions',neo_private.agent_instructions(),'messages',(select coalesce(jsonb_agg(x order by x.seq),'[]') from (select seq,case when sender_type='member' then 'user' else 'assistant' end role,left(body,1000) content from neo_private.support_messages where thread_id=t.id and seq<=m.seq and body<>'Anexo' order by seq desc limit 12)x));
end $$;
create or replace function public.neo_ai_finish(p_job uuid,p_lease uuid,p_body text default '',p_handoff boolean default false,p_failed boolean default false) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j neo_private.ai_jobs;t neo_private.support_threads;s neo_private.agent_settings;m neo_private.support_messages;i neo_private.ai_integrations;mid uuid;seq_no bigint;
begin
 select * into j from neo_private.ai_jobs where id=p_job;
 if j.id is null then return jsonb_build_object('published',false);end if;
 if j.integration_id is null then return public.neo_ai_finish_v25(p_job,p_lease,p_body,p_handoff,p_failed);end if;
 select * into t from neo_private.support_threads where id=j.thread_id for update;select * into j from neo_private.ai_jobs where id=p_job for update;select * into s from neo_private.agent_settings where singleton;select * into i from neo_private.ai_integrations where id=s.integration_id;select * into m from neo_private.support_messages where id=j.message_id;
 if j.state<>'running' or j.lease_token is distinct from p_lease or j.lease_until<now() then return jsonb_build_object('published',false);end if;
 if not s.enabled or i.id is distinct from j.integration_id or i.revision is distinct from j.integration_revision or i.validated_revision is distinct from i.revision or s.revision<>j.agent_revision or t.agent_revision<>j.thread_revision or t.next_seq<>m.seq or not neo_private.agent_hours() or (j.reply_mode='auto' and t.assigned_to is not null) or not exists(select 1 from public.neo_consents where user_id=t.user_id and purpose='terms' and granted and version='2026-11-v1') then update neo_private.ai_jobs set state='cancelled' where id=j.id;return jsonb_build_object('published',false);end if;
 if p_failed then update neo_private.ai_jobs set state=case when attempts<2 then 'pending' else 'failed' end where id=j.id;return jsonb_build_object('published',false);end if;
 if length(btrim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'invalid reply';end if;
 update neo_private.ai_jobs set state='done' where id=j.id;
 if j.reply_mode='suggest' then
  insert into neo_private.agent_drafts(job_id,thread_id,message_id,body) values(j.id,t.id,m.id,p_body) on conflict(job_id) do nothing;
  perform neo_private.message_signal(array(select user_id from neo_private.admin_members),'direct');return jsonb_build_object('published',false,'drafted',true);
 end if;
 mid:=gen_random_uuid();update neo_private.support_threads set next_seq=next_seq+1,updated_at=clock_timestamp(),agent_mode=case when p_handoff then 'manual' else agent_mode end,agent_revision=agent_revision+case when p_handoff then 1 else 0 end where id=t.id returning next_seq into seq_no;
 insert into neo_private.support_messages(id,thread_id,sender_id,sender_alias,sender_type,seq,body) values(mid,t.id,null,s.name,'assistant',seq_no,p_body);
 update neo_private.ai_jobs set reply_id=mid where id=j.id;return jsonb_build_object('published',true);
end $$;
revoke all on function neo_private.agent_hours(),neo_private.agent_instructions(),public.neo_agent(text,jsonb),public.neo_agent_credentials(uuid),public.neo_agent_integration(uuid,text,jsonb),public.neo_ai_claim(uuid,uuid),public.neo_ai_finish(uuid,uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.neo_agent(text,jsonb) to authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.neo_agent_credentials(uuid),public.neo_agent_integration(uuid,text,jsonb),public.neo_ai_claim(uuid,uuid),public.neo_ai_finish(uuid,uuid,text,boolean,boolean) to service_role;end if;end $$;
notify pgrst,'reload schema';
commit;
