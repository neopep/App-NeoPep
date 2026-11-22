-- Non-secret administration and opt-in private AI support. Disabled by default.
begin;
create table if not exists neo_private.platform_settings(singleton boolean primary key default true check(singleton),support_email text not null default '',site_url text not null default '',ai_provider text not null default 'openai' check(ai_provider in ('openai','other')),ai_model text not null default '',ai_enabled boolean not null default false,ai_prompt text not null default 'Ajude a usar o aplicativo e encaminhe assuntos de saúde para atendimento humano.',ai_daily_limit int not null default 50 check(ai_daily_limit between 1 and 500),ai_validated_model text not null default '',ai_validated_at timestamptz,updated_at timestamptz not null default now());
insert into neo_private.platform_settings(singleton) values(true) on conflict do nothing;
alter table neo_private.platform_settings enable row level security;
revoke all on neo_private.platform_settings from public,anon,authenticated;
alter table neo_private.support_threads add column if not exists ai_opt_in boolean not null default false;
alter table neo_private.support_threads add column if not exists ai_consented_at timestamptz;
alter table neo_private.support_messages alter column sender_id drop not null;
alter table neo_private.support_messages drop constraint if exists support_messages_sender_type_check;
do $$begin if not exists(select 1 from pg_constraint where conrelid='neo_private.support_messages'::regclass and conname='neo_support_sender_kind') then alter table neo_private.support_messages add constraint neo_support_sender_kind check((sender_type in ('member','team') and sender_id is not null) or (sender_type='assistant' and sender_id is null));end if;end $$;
create table if not exists neo_private.ai_consent_events(id uuid primary key default gen_random_uuid(),thread_id uuid not null references neo_private.support_threads(id) on delete cascade,provider text not null default 'openai',version text not null default '2026-11-ai-v1',granted boolean not null,created_at timestamptz not null default now());
create table if not exists neo_private.ai_jobs(id uuid primary key default gen_random_uuid(),message_id uuid not null unique references neo_private.support_messages(id) on delete cascade,thread_id uuid not null references neo_private.support_threads(id) on delete cascade,state text not null default 'pending' check(state in ('pending','running','done','cancelled','failed')),attempts int not null default 0,lease_token uuid,lease_until timestamptz,reply_id uuid,created_at timestamptz not null default now());
create table if not exists neo_private.ai_attempts(id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now());
alter table neo_private.ai_consent_events enable row level security;
alter table neo_private.ai_jobs enable row level security;
alter table neo_private.ai_attempts enable row level security;
revoke all on neo_private.ai_consent_events,neo_private.ai_jobs,neo_private.ai_attempts from public,anon,authenticated;
create index if not exists neo_ai_jobs_pending on neo_private.ai_jobs(state,created_at);
create or replace function public.neo_platform(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare cfg neo_private.platform_settings;enabled boolean;provider text;model text;limit_count int;
begin
 if auth.uid() is null or not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
 perform neo_private.take_limit('platform_settings',120,3600);
 select * into cfg from neo_private.platform_settings where singleton for update;
 if p_action='save' then
  if jsonb_typeof(p_payload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k ~* '(secret|password|token|key)') then raise exception 'Não envie chaves ou segredos por este formulário.';end if;
  provider:=coalesce(p_payload->>'ai_provider',cfg.ai_provider);model:=btrim(coalesce(p_payload->>'ai_model',cfg.ai_model));enabled:=coalesce((p_payload->>'ai_enabled')::boolean,cfg.ai_enabled);limit_count:=coalesce((p_payload->>'ai_daily_limit')::int,cfg.ai_daily_limit);
  if provider not in ('openai','other') or length(model)>100 or (model<>'' and model !~ '^[A-Za-z0-9._:-]+$') or limit_count not between 1 and 500 or length(coalesce(p_payload->>'ai_prompt',cfg.ai_prompt))>4000 then raise exception 'Confira o modelo, as instruções e o limite diário.';end if;
  if enabled and (provider<>'openai' or provider<>cfg.ai_provider or model<>cfg.ai_model or cfg.ai_validated_model<>model or cfg.ai_validated_at is null) then raise exception 'Salve o modelo com a IA desligada e valide a integração no servidor antes de ativar.';end if;
  if coalesce(p_payload->>'support_email','')<>'' and p_payload->>'support_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido.';end if;
  if coalesce(p_payload->>'site_url','')<>'' and p_payload->>'site_url' !~ '^https://[^/@[:space:]]+([/?#]|$)' then raise exception 'URL HTTPS inválida.';end if;
  update neo_private.platform_settings set support_email=left(coalesce(p_payload->>'support_email',support_email),254),site_url=left(coalesce(p_payload->>'site_url',site_url),2000),ai_provider=provider,ai_model=model,ai_enabled=enabled,ai_prompt=coalesce(p_payload->>'ai_prompt',ai_prompt),ai_daily_limit=limit_count,ai_validated_at=case when provider<>cfg.ai_provider or model<>cfg.ai_model then null else ai_validated_at end,ai_validated_model=case when provider<>cfg.ai_provider or model<>cfg.ai_model then '' else ai_validated_model end,updated_at=now() where singleton;
  if p_payload?'require_approval' then update neo_private.community_settings set require_approval=(p_payload->>'require_approval')::boolean where singleton;end if;
 elsif p_action<>'read' then raise exception 'Operação inválida.';end if;
 return jsonb_build_object('config',(select to_jsonb(s)-'singleton' from neo_private.platform_settings s where singleton),'require_approval',(select require_approval from neo_private.community_settings where singleton),'shop',(select to_jsonb(s)-'singleton' from neo_private.shop_settings s where singleton),'ai_pending',(select count(*) from neo_private.ai_jobs where state in ('pending','running')),'ai_attempts_today',(select count(*) from neo_private.ai_attempts where created_at>=date_trunc('day',now())));
end $$;
-- Server-only identity check: do not authorize administration from user_metadata.
create or replace function public.neo_integration_admin(p_actor uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin
 if p_actor is null or not (exists(select 1 from neo_private.admin_members where user_id=p_actor) or exists(select 1 from neo_private.community_moderators where user_id=p_actor)) then raise exception 'administrator required' using errcode='42501';end if;
 return (select to_jsonb(s)-'singleton' from neo_private.platform_settings s where singleton);
end $$;
create or replace function public.neo_ai_validated(p_actor uuid,p_model text) returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 perform public.neo_integration_admin(p_actor);
 update neo_private.platform_settings set ai_validated_at=now(),ai_validated_model=p_model where singleton and ai_provider='openai' and ai_model=p_model and p_model<>'';
 if not found then raise exception 'configuration changed';end if;
end $$;
-- Keep old clients working; new clients can explicitly authorize AI for their own thread.
do $$begin if to_regprocedure('public.neo_support_v20(text,jsonb)') is null then alter function public.neo_support(text,jsonb) rename to neo_support_v20;end if;end $$;
revoke all on function public.neo_support_v20(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_support(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;tid uuid;cfg neo_private.platform_settings;flag boolean;
begin
 if p_action='ai_consent' then
  if jsonb_typeof(p_payload->'granted') is distinct from 'boolean' then raise exception 'Confirmação obrigatória.';end if;
  result:=public.neo_support_v20('open',p_payload);tid:=(result->>'thread_id')::uuid;
  if result->'own_thread' is distinct from 'true'::jsonb then raise exception 'Somente o participante pode autorizar a IA.' using errcode='42501';end if;
  flag:=(p_payload->>'granted')::boolean;
  select * into cfg from neo_private.platform_settings where singleton;
  if flag and not (cfg.ai_enabled and cfg.ai_provider='openai' and cfg.ai_validated_at is not null and cfg.ai_validated_model=cfg.ai_model and result->'assigned'='false'::jsonb) then raise exception 'Atendimento com IA indisponível.';end if;
  insert into neo_private.ai_consent_events(thread_id,granted) values(tid,flag);
  update neo_private.support_threads set ai_consented_at=case when flag and not ai_opt_in then clock_timestamp() else ai_consented_at end,ai_opt_in=flag where id=tid;
  if not flag then update neo_private.ai_jobs set state='cancelled' where thread_id=tid and state in ('pending','running');end if;
  return jsonb_build_object('ok',true);
 end if;
 result:=public.neo_support_v20(p_action,p_payload);
 if p_action in ('claim','start') then update neo_private.support_threads set ai_opt_in=false where id=(result->>'thread_id')::uuid;update neo_private.ai_jobs set state='cancelled' where thread_id=(result->>'thread_id')::uuid and state in ('pending','running');end if;
 if p_action='open' then
  select * into cfg from neo_private.platform_settings where singleton;
  result:=result||jsonb_build_object('ai_available',cfg.ai_enabled and cfg.ai_provider='openai' and cfg.ai_validated_at is not null and cfg.ai_validated_model=cfg.ai_model,'ai_opt_in',(select ai_opt_in from neo_private.support_threads where id=(result->>'thread_id')::uuid));
 end if;
 return result;
end $$;
-- Incoming text only; no historical health records, photographs or attachments enter the AI queue.
create or replace function neo_private.enqueue_ai() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if new.sender_type='member' then update neo_private.ai_jobs set state='cancelled' where thread_id=new.thread_id and state in ('pending','running');end if;
 if new.sender_type='member' and new.body<>'Anexo' and exists(select 1 from neo_private.support_threads t,neo_private.platform_settings c where t.id=new.thread_id and t.ai_opt_in and t.assigned_to is null and c.singleton and c.ai_enabled and c.ai_provider='openai' and c.ai_validated_at is not null and c.ai_validated_model=c.ai_model) then insert into neo_private.ai_jobs(message_id,thread_id) values(new.id,new.thread_id) on conflict do nothing;end if;
 return null;end $$;
drop trigger if exists neo_enqueue_ai on neo_private.support_messages;
create trigger neo_enqueue_ai after insert on neo_private.support_messages for each row execute function neo_private.enqueue_ai();
revoke all on function neo_private.enqueue_ai() from public,anon,authenticated;
create or replace function public.neo_ai_claim(p_actor uuid default null,p_message uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j neo_private.ai_jobs;t neo_private.support_threads;c neo_private.platform_settings;m neo_private.support_messages;lease uuid;
begin
 perform pg_advisory_xact_lock(642917300);
 select * into c from neo_private.platform_settings where singleton;
 if not c.ai_enabled or c.ai_provider<>'openai' or c.ai_validated_at is null or c.ai_validated_model<>c.ai_model then return null;end if;
 -- Count attempts, not just successful replies, to bound retries as well.
 if (select count(*) from neo_private.ai_attempts where created_at>=date_trunc('day',now()))>=c.ai_daily_limit then return null;end if;
 select q.* into j from neo_private.ai_jobs q join neo_private.support_threads s on s.id=q.thread_id where (p_message is null or q.message_id=p_message) and (p_actor is null or s.user_id=p_actor) and q.created_at>now()-interval '10 minutes' and q.attempts<2 and (q.state='pending' or (q.state='running' and q.lease_until<now())) order by q.created_at,q.id limit 1;
 if not found then return null;end if;
 select * into t from neo_private.support_threads where id=j.thread_id for update;select * into j from neo_private.ai_jobs where id=j.id for update;if j.state not in ('pending','running') then return null;end if;select * into m from neo_private.support_messages where id=j.message_id;
 if not t.ai_opt_in or t.assigned_to is not null or t.next_seq<>m.seq or m.created_at<t.ai_consented_at or not exists(select 1 from public.neo_consents where user_id=t.user_id and purpose='terms' and granted and version='2026-11-v1') then update neo_private.ai_jobs set state='cancelled' where id=j.id;return null;end if;
 lease:=gen_random_uuid();update neo_private.ai_jobs set state='running',attempts=attempts+1,lease_token=lease,lease_until=now()+interval '2 minutes' where id=j.id;insert into neo_private.ai_attempts default values;
 return jsonb_build_object('id',j.id,'lease',lease,'model',c.ai_model,'instructions',c.ai_prompt||case when c.support_email<>'' then E'\nContato operacional informado: '||c.support_email else '' end||case when c.site_url<>'' then E'\nSite informado: '||c.site_url else '' end,'messages',coalesce((select jsonb_agg(x order by x.seq) from(select seq,case when sender_type='assistant' then 'assistant' else 'user' end as role,left(body,1000) as content from neo_private.support_messages where thread_id=t.id and created_at>=t.ai_consented_at and sender_type in ('member','assistant') and seq<=m.seq and body<>'Anexo' order by seq desc limit 12)x),'[]'));
end $$;
create or replace function public.neo_ai_finish(p_job uuid,p_lease uuid,p_body text default '',p_handoff boolean default false,p_failed boolean default false) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare j neo_private.ai_jobs;t neo_private.support_threads;m neo_private.support_messages;c neo_private.platform_settings;mid uuid;seq_no bigint;
begin
 select * into j from neo_private.ai_jobs where id=p_job;
 if not found or j.state<>'running' or j.lease_token is distinct from p_lease or j.lease_until<now() then return jsonb_build_object('published',false);end if;
 select * into t from neo_private.support_threads where id=j.thread_id for update;select * into j from neo_private.ai_jobs where id=p_job for update;if j.state<>'running' or j.lease_token is distinct from p_lease then return jsonb_build_object('published',false);end if;select * into m from neo_private.support_messages where id=j.message_id;select * into c from neo_private.platform_settings where singleton;
 if not c.ai_enabled or not t.ai_opt_in or t.assigned_to is not null or t.next_seq<>m.seq or not exists(select 1 from public.neo_consents where user_id=t.user_id and purpose='terms' and granted and version='2026-11-v1') then update neo_private.ai_jobs set state='cancelled' where id=j.id;return jsonb_build_object('published',false);end if;
 if p_failed then update neo_private.ai_jobs set state=case when attempts<2 then 'pending' else 'failed' end where id=j.id;return jsonb_build_object('published',false);end if;
 if p_body is null or length(btrim(p_body)) not between 1 and 4000 then raise exception 'invalid reply';end if;
 mid:=gen_random_uuid();update neo_private.support_threads set next_seq=next_seq+1,updated_at=clock_timestamp(),ai_opt_in=case when p_handoff then false else ai_opt_in end where id=t.id returning next_seq into seq_no;
 insert into neo_private.support_messages(id,thread_id,sender_id,sender_alias,sender_type,seq,body) values(mid,t.id,null,'Assistente IA · NeoPeptídeos','assistant',seq_no,p_body);
 update neo_private.ai_jobs set state='done',reply_id=mid where id=j.id;return jsonb_build_object('published',true);
end $$;
-- Export the owner's AI authorization history along with that owner's conversations.
do $$begin if to_regprocedure('public.neo_support_export_v20()') is null then alter function public.neo_support_export() rename to neo_support_export_v20;end if;end $$;
revoke all on function public.neo_support_export_v20() from public,anon,authenticated;
create or replace function public.neo_support_export() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare result jsonb;begin
 result:=public.neo_support_export_v20();
 return coalesce((select jsonb_agg(item.value||jsonb_build_object('ai_consents',coalesce((select jsonb_agg(jsonb_build_object('granted',ev.granted,'provider',ev.provider,'version',ev.version,'created_at',ev.created_at) order by ev.created_at) from neo_private.ai_consent_events ev where ev.thread_id=(item.value->>'id')::uuid),'[]'))) from jsonb_array_elements(result) item),'[]');
end $$;
revoke all on function public.neo_support_export() from public,anon;
grant execute on function public.neo_support_export() to authenticated;
-- Null sender IDs belong only to clearly identified automated replies.
do $queries$ declare r record;def text;begin for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','neo_private') and (p.proname like 'neo_support%' or p.proname like 'neo_community%') loop
 def:=pg_get_functiondef(r.oid);def:=replace(def,'m.sender_id<>u','m.sender_id is distinct from u');def:=replace(def,'m.sender_id<>d.user_id','m.sender_id is distinct from d.user_id');def:=replace(def,'m.sender_id=u as own','coalesce(m.sender_id=u,false) as own');execute def;
 end loop;end $queries$;
revoke all on function public.neo_platform(text,jsonb),public.neo_support(text,jsonb) from public,anon;
grant execute on function public.neo_platform(text,jsonb),public.neo_support(text,jsonb) to authenticated;
revoke all on function public.neo_integration_admin(uuid),public.neo_ai_validated(uuid,text),public.neo_ai_claim(uuid,uuid),public.neo_ai_finish(uuid,uuid,text,boolean,boolean) from public,anon,authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.neo_integration_admin(uuid),public.neo_ai_validated(uuid,text),public.neo_ai_claim(uuid,uuid),public.neo_ai_finish(uuid,uuid,text,boolean,boolean) to service_role;end if;end $$;
notify pgrst,'reload schema';
commit;
