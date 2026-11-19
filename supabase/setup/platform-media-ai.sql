-- NeoPeptídeos: Biblioteca e configurações. Transação única; IA permanece desligada.
-- Não contém segredos. Não apaga registros, pedidos ou materiais existentes.
begin;
-- 202611120019_library_featured.sql
-- Library highlights: independent of the shop update; no personal records copied.
do $$begin if to_regclass('neo_private.community_materials') is null then raise exception 'Instale antes a configuração da comunidade.';end if;end $$;
alter table neo_private.community_materials add column if not exists featured boolean not null default false;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();pid uuid;flag boolean;
begin
 if u is null then raise exception 'Entre na sua conta para acessar a biblioteca.' using errcode='42501';end if;
 if not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=u) then raise exception 'Conclua seu cadastro antes de acessar a biblioteca.' using errcode='42501';end if;
 if p_action='featured' then
  return jsonb_build_object('materials',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id) from(select id,title,left(body,180) as excerpt,url<>'' as has_link,created_at from neo_private.community_materials where featured order by created_at desc,id limit 12)m),'[]'));
 elsif p_action='read' then
  return jsonb_build_object('materials',coalesce((select jsonb_agg(to_jsonb(m) order by m.featured desc,m.created_at desc,m.id) from(select id,title,body,url,featured,created_at from neo_private.community_materials order by featured desc,created_at desc,id limit 100)m),'[]'),'can_manage',public.neo_admin_access());
 elsif p_action='get' then
  return jsonb_build_object('material',(select to_jsonb(m) from neo_private.community_materials m where id=(p_payload->>'id')::uuid));
 end if;
 if not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
 if p_action not in ('create','set_featured') then raise exception 'Operação da biblioteca inválida.';end if;
 perform neo_private.take_limit('community_material',30,3600);
 if jsonb_typeof(p_payload->'featured') is distinct from 'boolean' then raise exception 'Destaque inválido.';end if;
 flag:=(p_payload->>'featured')::boolean;
 if p_action='create' then
  if p_payload->>'title' is null or p_payload->>'body' is null then raise exception 'Informe título e texto.';end if;
  insert into neo_private.community_materials(title,body,url,featured) values(btrim(p_payload->>'title'),btrim(p_payload->>'body'),coalesce(p_payload->>'url',''),flag) returning id into pid;
 else
  pid:=(p_payload->>'id')::uuid;
  update neo_private.community_materials set featured=flag where id=pid;
  if not found then raise exception 'Material não encontrado.';end if;
 end if;
 return jsonb_build_object('ok',true,'id',pid);
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;
grant execute on function public.neo_library(text,jsonb) to authenticated;
notify pgrst,'reload schema';

-- 202611120020_library_media.sql
do $$begin if to_regprocedure('public.neo_library(text,jsonb)') is null then raise exception 'Instale antes os destaques da Biblioteca.';end if;end $$;
create table if not exists neo_private.library_uploads(path text primary key,user_id uuid references auth.users(id) on delete set null,material_id uuid references neo_private.community_materials(id) on delete cascade,name text not null check(length(name) between 1 and 120 and name !~ '[/\\[:cntrl:]]'),mime text not null check(mime in ('image/jpeg','application/pdf','text/plain')),size int not null check(size between 1 and 10485760),created_at timestamptz not null default now());
alter table neo_private.library_uploads enable row level security;
revoke all on neo_private.library_uploads from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('neo-library','neo-library',false,10485760,array['image/jpeg','application/pdf','text/plain']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.neo_library_media_access(p_path text,p_upload boolean default false) returns boolean language sql stable security definer set search_path=pg_catalog as $$select auth.uid() is not null and exists(select 1 from neo_private.library_uploads f where f.path=p_path and case when p_upload then public.neo_admin_access() and f.user_id=auth.uid() and f.material_id is null and f.created_at>now()-interval '1 hour' else (f.material_id is not null and public.neo_has_consent('terms')) or (f.user_id=auth.uid() and public.neo_admin_access()) end)$$;
drop policy if exists neo_library_media_read on storage.objects;
create policy neo_library_media_read on storage.objects for select to authenticated using(bucket_id='neo-library' and public.neo_library_media_access(name,false));
drop policy if exists neo_library_media_insert on storage.objects;
create policy neo_library_media_insert on storage.objects for insert to authenticated with check(bucket_id='neo-library' and public.neo_library_media_access(name,true));
do $$begin if to_regprocedure('public.neo_library_text(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_text;end if;end $$;
revoke all on function public.neo_library_text(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;paths jsonb;upload_row neo_private.library_uploads;v_path text;pid uuid;
begin
 if auth.uid() is null or not public.neo_has_consent('terms') then raise exception 'Entre na sua conta e conclua o cadastro.' using errcode='42501';end if;
 if p_action='reserve' then
  if not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  perform neo_private.take_limit('library_upload',60,3600);
  v_path:=auth.uid()::text||'/'||gen_random_uuid()::text||case p_payload->>'mime' when 'image/jpeg' then '.jpg' when 'application/pdf' then '.pdf' else '.txt' end;
  insert into neo_private.library_uploads(path,user_id,name,mime,size) values(v_path,auth.uid(),p_payload->>'name',p_payload->>'mime',(p_payload->>'size')::int);
  return jsonb_build_object('path',v_path);
 elsif p_action='create' then
  if not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  paths:=coalesce(p_payload->'attachments','[]');
  if jsonb_typeof(paths) is distinct from 'array' or jsonb_array_length(paths)>6 or (select count(distinct value) from jsonb_array_elements(paths))<>jsonb_array_length(paths) then raise exception 'Use até 6 anexos diferentes.';end if;
  if jsonb_array_length(paths)>0 then
   for upload_row in select * from neo_private.library_uploads where path in(select jsonb_array_elements_text(paths)) for update loop
    if upload_row.user_id<>auth.uid() or upload_row.material_id is not null or not exists(select 1 from storage.objects where bucket_id='neo-library' and name=upload_row.path) then raise exception 'Anexo inválido.';end if;
   end loop;
   if (select count(*) from neo_private.library_uploads where path in(select jsonb_array_elements_text(paths)))<>jsonb_array_length(paths) then raise exception 'Anexo inválido.';end if;
  end if;
  result:=public.neo_library_text('create',p_payload);pid:=(result->>'id')::uuid;
  update neo_private.library_uploads set material_id=pid where path in(select jsonb_array_elements_text(paths));return result;
 end if;
 result:=public.neo_library_text(p_action,p_payload);
 if p_action='read' then
  result:=result||jsonb_build_object('media_ready',true,'materials',coalesce((select jsonb_agg(m.value||jsonb_build_object('attachments',coalesce((select jsonb_agg(jsonb_build_object('path',f.path,'name',f.name,'mime',f.mime,'size',f.size) order by f.created_at,f.path) from neo_private.library_uploads f where f.material_id=(m.value->>'id')::uuid),'[]')) order by m.ordinality) from jsonb_array_elements(result->'materials') with ordinality m),'[]'));
 elsif p_action='get' and result->'material'<>'null'::jsonb then
  result:=jsonb_build_object('material',(result->'material')||jsonb_build_object('attachments',coalesce((select jsonb_agg(jsonb_build_object('path',f.path,'name',f.name,'mime',f.mime,'size',f.size)) from neo_private.library_uploads f where f.material_id=(result->'material'->>'id')::uuid),'[]')));
 end if;
 return result;
end $$;
revoke all on function public.neo_library(text,jsonb),public.neo_library_media_access(text,boolean) from public,anon;
grant execute on function public.neo_library(text,jsonb),public.neo_library_media_access(text,boolean) to authenticated;
notify pgrst,'reload schema';

-- 202611120021_platform_ai.sql
-- Non-secret administration and opt-in private AI support. Disabled by default.
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

-- 202611120022_library_video.sql
alter table neo_private.library_uploads drop constraint if exists library_uploads_mime_check;
alter table neo_private.library_uploads drop constraint if exists library_uploads_size_check;
alter table neo_private.library_uploads drop constraint if exists library_uploads_media_check;
alter table neo_private.library_uploads add constraint library_uploads_media_check check(mime in ('image/jpeg','application/pdf','text/plain','video/mp4','video/webm','video/quicktime') and size between 1 and case when mime like 'video/%' then 52428800 else 10485760 end);
update storage.buckets set public=false,file_size_limit=52428800,allowed_mime_types=array['image/jpeg','application/pdf','text/plain','video/mp4','video/webm','video/quicktime'] where id='neo-library';
do $$begin if to_regprocedure('public.neo_library_media_v21(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_media_v21;end if;end $$;
revoke all on function public.neo_library_media_v21(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;v_path text;
begin
 if auth.uid() is null or not public.neo_has_consent('terms') then raise exception 'Entre na sua conta e conclua o cadastro.' using errcode='42501';end if;
 if p_action='reserve' and p_payload->>'mime' like 'video/%' then
  if not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  perform neo_private.take_limit('library_upload',60,3600);
  v_path:=auth.uid()::text||'/'||gen_random_uuid()::text||case p_payload->>'mime' when 'video/mp4' then '.mp4' when 'video/webm' then '.webm' when 'video/quicktime' then '.mov' else '.invalid' end;
  insert into neo_private.library_uploads(path,user_id,name,mime,size) values(v_path,auth.uid(),p_payload->>'name',p_payload->>'mime',(p_payload->>'size')::int);
  return jsonb_build_object('path',v_path);
 end if;
 result:=public.neo_library_media_v21(p_action,p_payload);
 if p_action='read' then result:=result||jsonb_build_object('video_ready',true);end if;
 return result;
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;
grant execute on function public.neo_library(text,jsonb) to authenticated;
-- New memberships default to notices on. Never overwrite an explicit saved opt-out.
alter table neo_private.community_preferences alter column push_enabled set default true;
insert into neo_private.community_preferences(user_id,push_enabled,activated_after) select user_id,true,(select coalesce(max(published_seq),0) from neo_private.community_posts) from neo_private.community_members on conflict(user_id) do nothing;
notify pgrst,'reload schema';

-- 202611130024_library_file_controls.sql
-- Additive file controls. Existing materials and attachments remain intact.
do $$begin if to_regclass('neo_private.library_uploads') is null or to_regprocedure('public.neo_library_media_v21(text,jsonb)') is null then raise exception 'Instale antes a atualização de anexos da Biblioteca (020 a 022).';end if;end $$;
alter table neo_private.library_uploads add column if not exists allow_download boolean not null default true;
do $$begin if to_regprocedure('public.neo_library_v23(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_v23;end if;end $$;
revoke all on function public.neo_library_v23(text,jsonb) from public,anon,authenticated;
create or replace function neo_private.library_file_list(p_material uuid) returns jsonb language sql stable set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('path',path,'name',name,'mime',mime,'size',size,'allow_download',allow_download) order by created_at,path),'[]') from neo_private.library_uploads where material_id=p_material
$$;
revoke all on function neo_private.library_file_list(uuid) from public,anon,authenticated;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;files jsonb;paths jsonb:='[]';item jsonb;path_value text;flag boolean;pid uuid;f neo_private.library_uploads;seen text[]:='{}';n int;
begin
 if auth.uid() is null or not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=auth.uid()) then raise exception 'Entre na sua conta e conclua o cadastro.' using errcode='42501';end if;
 if p_action='read' then
  return jsonb_build_object('media_ready',true,'video_ready',true,'file_controls_ready',true,'can_manage',public.neo_admin_access(),'materials',coalesce((select jsonb_agg(m.value||jsonb_build_object('attachments',neo_private.library_file_list((m.value->>'id')::uuid)) order by m.featured desc,m.created_at desc,m.id) from(select to_jsonb(p) value,p.featured,p.created_at,p.id from neo_private.community_materials p order by p.featured desc,p.created_at desc,p.id limit 100)m),'[]'));
 elsif p_action='get' then
  pid:=(p_payload->>'id')::uuid;return jsonb_build_object('material',(select to_jsonb(m)||jsonb_build_object('attachments',neo_private.library_file_list(m.id)) from neo_private.community_materials m where m.id=pid));
 elsif p_action='media_access' then
  path_value:=p_payload->>'path';select * into f from neo_private.library_uploads where path=path_value;
  if not found or not public.neo_library_media_access(path_value,false) then raise exception 'Anexo indisponível.' using errcode='42501';end if;
  if p_payload->'download'='true'::jsonb and not f.allow_download then raise exception 'O administrador não disponibilizou o download deste arquivo.' using errcode='42501';end if;
  return jsonb_build_object('path',f.path,'name',f.name,'mime',f.mime,'size',f.size,'allow_download',f.allow_download);
 end if;
 if p_action in ('set_download','attach_files','create','reserve') then
  if not public.neo_admin_access() then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  if p_action='set_download' then
   if jsonb_typeof(p_payload->'allow_download') is distinct from 'boolean' then raise exception 'Informe se o download é permitido.';end if;
   perform neo_private.take_limit('library_controls',120,3600);
   update neo_private.library_uploads set allow_download=(p_payload->>'allow_download')::boolean where path=p_payload->>'path' and (material_id is not null or user_id=auth.uid());
   if not found then raise exception 'Anexo não encontrado.';end if;return '{"ok":true}';
  elsif p_action='reserve' then
   if p_payload?'allow_download' and jsonb_typeof(p_payload->'allow_download') is distinct from 'boolean' then raise exception 'Permissão de download inválida.';end if;
   result:=public.neo_library_v23(p_action,p_payload);update neo_private.library_uploads set allow_download=coalesce((p_payload->>'allow_download')::boolean,true) where path=result->>'path';return result;
  end if;
  files:=coalesce(p_payload->'attachments','[]');if jsonb_typeof(files) is distinct from 'array' or jsonb_array_length(files)>6 then raise exception 'Use até 6 anexos.';end if;
  if p_action='attach_files' then
   pid:=(p_payload->>'id')::uuid;perform 1 from neo_private.community_materials where id=pid for update;if not found then raise exception 'Material não encontrado.';end if;
   select count(*) into n from neo_private.library_uploads where material_id=pid;
   if n+jsonb_array_length(files)>6 or jsonb_array_length(files)=0 then raise exception 'O material deve ter no máximo 6 anexos. Selecione pelo menos um arquivo.';end if;
   perform neo_private.take_limit('community_material',30,3600);
  end if;
  for item in select value from jsonb_array_elements(files) loop
   if jsonb_typeof(item)='string' then path_value:=item#>>'{}';flag:=true;
   elsif jsonb_typeof(item)='object' and jsonb_typeof(item->'path')='string' and jsonb_typeof(item->'allow_download')='boolean' then path_value:=item->>'path';flag:=(item->>'allow_download')::boolean;
   else raise exception 'Anexo inválido.';end if;
   if path_value=any(seen) then raise exception 'Anexo duplicado.';end if;seen:=array_append(seen,path_value);
   select * into f from neo_private.library_uploads where path=path_value for update;
   if not found or f.user_id is distinct from auth.uid() or f.material_id is not null or not exists(select 1 from storage.objects where bucket_id='neo-library' and name=path_value) then raise exception 'Anexo inválido, ainda não enviado ou indisponível. Envie novamente.';end if;
   paths:=paths||jsonb_build_array(path_value);update neo_private.library_uploads set allow_download=flag where path=path_value;
  end loop;
  if p_action='create' then result:=public.neo_library_v23('create',p_payload||jsonb_build_object('attachments',paths));pid:=(result->>'id')::uuid;
  else update neo_private.library_uploads set material_id=pid where path=any(seen);result:=jsonb_build_object('ok',true,'id',pid);end if;
  return result;
 end if;
 return public.neo_library_v23(p_action,p_payload);
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;grant execute on function public.neo_library(text,jsonb) to authenticated;
notify pgrst,'reload schema';

-- 202611130025_library_discovery.sql
-- Library discovery: newest-first, filtering and authenticated daily views.
do $$begin if to_regprocedure('public.neo_library_v23(text,jsonb)') is null or not exists(select 1 from information_schema.columns where table_schema='neo_private' and table_name='library_uploads' and column_name='allow_download') then raise exception 'Instale antes os controles de arquivos da Biblioteca (024).';end if;end $$;
alter table neo_private.community_materials add column if not exists view_count bigint not null default 0 check(view_count>=0);
create table if not exists neo_private.library_visits(material_id uuid not null references neo_private.community_materials(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,view_day date not null,created_at timestamptz not null default now(),primary key(material_id,user_id,view_day));
alter table neo_private.library_visits enable row level security;
revoke all on neo_private.library_visits from public,anon,authenticated;
create index if not exists neo_library_recent on neo_private.community_materials(created_at desc,id desc);
create index if not exists neo_library_popular on neo_private.community_materials(view_count desc,created_at desc,id desc);
do $$begin if to_regprocedure('public.neo_library_v24(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_v24;end if;end $$;
revoke all on function public.neo_library_v24(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();pid uuid;v_sort text:=coalesce(p_payload->>'sort','recent');v_type text:=coalesce(p_payload->>'type','all');q text:=lower(left(btrim(coalesce(p_payload->>'search','')),100));v_featured boolean:=p_payload->'featured_only'='true'::jsonb;changed int;total bigint;
begin
 if u is null or not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=u) then raise exception 'Entre na sua conta e conclua o cadastro.' using errcode='42501';end if;
 if p_action='view' then
  pid:=(p_payload->>'id')::uuid;perform 1 from neo_private.community_materials where id=pid;if not found then raise exception 'Material não encontrado.';end if;
  perform neo_private.take_limit('library_views',120,60);
  insert into neo_private.library_visits(material_id,user_id,view_day) values(pid,u,(now() at time zone 'America/Sao_Paulo')::date) on conflict do nothing;
  get diagnostics changed=row_count;
  if changed>0 then update neo_private.community_materials set view_count=view_count+1 where id=pid;end if;
  select view_count into total from neo_private.community_materials where id=pid;
  return jsonb_build_object('id',pid,'view_count',total,'counted',changed>0);
 elsif p_action='read' then
  if v_sort not in ('recent','oldest','popular') or v_type not in ('all','pdf','text','image','video','link') then raise exception 'Filtro da Biblioteca inválido.';end if;
  return jsonb_build_object('media_ready',true,'video_ready',true,'file_controls_ready',true,'views_ready',true,'can_manage',public.neo_admin_access(),'materials',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('attachments',neo_private.library_file_list(m.id)) order by case when v_sort='popular' then m.view_count end desc,case when v_sort='oldest' then m.created_at end asc,case when v_sort<>'oldest' then m.created_at end desc,m.id desc) from(select p.* from neo_private.community_materials p where (q='' or position(q in lower(p.title||' '||p.body))>0) and (not coalesce(v_featured,false) or p.featured) and (v_type='all' or (v_type='link' and p.url<>'') or (v_type='text' and p.url='' and not exists(select 1 from neo_private.library_uploads where material_id=p.id)) or exists(select 1 from neo_private.library_uploads f where f.material_id=p.id and ((v_type='pdf' and f.mime='application/pdf') or (v_type='text' and f.mime='text/plain') or (v_type='image' and f.mime like 'image/%') or (v_type='video' and f.mime like 'video/%')))) order by case when v_sort='popular' then p.view_count end desc,case when v_sort='oldest' then p.created_at end asc,case when v_sort<>'oldest' then p.created_at end desc,p.id desc limit 100)m),'[]'));
 end if;
 return public.neo_library_v24(p_action,p_payload);
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;grant execute on function public.neo_library(text,jsonb) to authenticated;
notify pgrst,'reload schema';

-- 202611130026_library_editor.sql
-- Full administrator editing and administrator-only view counts.
do $$begin if to_regprocedure('public.neo_library_v24(text,jsonb)') is null then raise exception 'Instale antes a organização da Biblioteca (025).';end if;end $$;
alter table neo_private.community_materials add column if not exists revision bigint not null default 1;
alter table neo_private.community_materials add column if not exists updated_at timestamptz not null default now();
do $$begin if to_regprocedure('public.neo_library_v25(text,jsonb)') is null then alter function public.neo_library(text,jsonb) rename to neo_library_v25;end if;end $$;
revoke all on function public.neo_library_v25(text,jsonb) from public,anon,authenticated;
create or replace function public.neo_library(p_action text default 'read',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a boolean;result jsonb;pid uuid;m neo_private.community_materials;f neo_private.library_uploads;entry jsonb;files jsonb;paths text[]:='{}';path_value text;flag boolean;
begin
 if auth.uid() is null or not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=auth.uid()) then raise exception 'Entre na sua conta e conclua o cadastro.' using errcode='42501';end if;
 a:=public.neo_admin_access();
 if p_action='update' then
  if not a then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
  pid:=(p_payload->>'id')::uuid;select * into m from neo_private.community_materials where id=pid for update;
  if not found then raise exception 'Material não encontrado.';end if;
  if (p_payload->>'expected_revision')::bigint is distinct from m.revision then raise exception 'Este material foi alterado por outro administrador. Reabra a edição para conferir a versão atual.';end if;
  if jsonb_typeof(p_payload->'featured') is distinct from 'boolean' then raise exception 'Destaque inválido.';end if;
  if length(btrim(coalesce(p_payload->>'title',''))) not between 1 and 120 or length(btrim(coalesce(p_payload->>'body',''))) not between 1 and 10000 then raise exception 'Confira o título e a descrição do material.';end if;
  files:=p_payload->'attachments';if jsonb_typeof(files) is distinct from 'array' or jsonb_array_length(files)>6 then raise exception 'Use no máximo 6 anexos por material.';end if;
  perform neo_private.take_limit('community_material',30,3600);
  for entry in select value from jsonb_array_elements(files) loop
   if jsonb_typeof(entry->'path') is distinct from 'string' or jsonb_typeof(entry->'allow_download') is distinct from 'boolean' then raise exception 'Anexo inválido.';end if;
   path_value:=entry->>'path';flag:=(entry->>'allow_download')::boolean;
   if path_value=any(paths) then raise exception 'Anexo duplicado.';end if;
   select * into f from neo_private.library_uploads where path=path_value for update;
   if not found or (f.material_id is distinct from pid and (f.material_id is not null or f.user_id is distinct from auth.uid())) or not exists(select 1 from storage.objects where bucket_id='neo-library' and name=path_value) then raise exception 'Anexo não pertence a este material ou ainda não foi enviado.';end if;
   paths:=array_append(paths,path_value);
  end loop;
  -- Removed files cease to be visible in the publication. Previously issued links expire normally.
  update neo_private.library_uploads set material_id=null where material_id=pid and not(path=any(paths));
  for entry in select value from jsonb_array_elements(files) loop
   update neo_private.library_uploads set material_id=pid,allow_download=(entry->>'allow_download')::boolean where path=entry->>'path';
  end loop;
  update neo_private.community_materials set title=btrim(p_payload->>'title'),body=btrim(p_payload->>'body'),url=coalesce(p_payload->>'url',''),featured=(p_payload->>'featured')::boolean,revision=revision+1,updated_at=now() where id=pid;
  return jsonb_build_object('ok',true,'id',pid,'revision',m.revision+1);
 end if;
 result:=public.neo_library_v25(p_action,p_payload);
 if p_action='read' then
  result:=result||jsonb_build_object('edit_ready',true,'can_view_counts',a,'materials',coalesce((select jsonb_agg(case when a then item.value else item.value-'view_count' end order by item.ordinality) from jsonb_array_elements(result->'materials') with ordinality item),'[]'));
 elsif p_action='get' and not a and jsonb_typeof(result->'material')='object' then
  result:=jsonb_set(result,'{material}',(result->'material')-'view_count');
 elsif p_action='view' and not a then result:=result-'view_count';
 elsif p_action in ('set_featured','attach_files','set_download') then
  if p_action='set_download' then select material_id into pid from neo_private.library_uploads where path=p_payload->>'path';else pid:=(p_payload->>'id')::uuid;end if;
  update neo_private.community_materials set revision=revision+1,updated_at=now() where id=pid;
 end if;
 return result;
end $$;
revoke all on function public.neo_library(text,jsonb) from public,anon;grant execute on function public.neo_library(text,jsonb) to authenticated;
notify pgrst,'reload schema';

commit;
