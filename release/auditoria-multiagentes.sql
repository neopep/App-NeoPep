-- Metadados apenas. Execute com acesso autorizado ao catálogo do Supabase.
-- Não imprime dados de usuários, conteúdo de conversas, credenciais ou corpos de funções.
begin read only;
set local statement_timeout = '15s';

select current_setting('server_version_num') as server_version,
       (select rolname from pg_roles where rolname = current_user) as audit_role;

select name as expected_role, exists(select 1 from pg_roles where rolname = name) as present
from unnest(array['anon','authenticated','service_role']) as roles(name);

select extname, extversion, extnamespace::regnamespace as extension_schema
from pg_extension order by extname;

with targets(name) as (values
  ('agent_settings'), ('agent_knowledge'), ('ai_integrations'), ('support_threads'),
  ('support_messages'), ('ai_jobs'), ('ai_attempts'), ('agent_drafts'), ('ai_consent_events'),
  ('admin_members'), ('community_moderators'), ('platform_settings'), ('agents'),
  ('agent_catalog_knowledge'), ('agent_catalog'), ('agent_runtime_attempts')
)
select t.name, c.oid is not null as present, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) as owner
from targets t
left join pg_class c on c.oid=to_regclass('neo_private.'||t.name)
order by t.name;

with targets(schema_name, object_name) as (values
  ('neo_private','agent_settings'), ('neo_private','agent_knowledge'), ('neo_private','ai_integrations'),
  ('neo_private','support_threads'), ('neo_private','support_messages'), ('neo_private','ai_jobs'),
  ('neo_private','ai_attempts'), ('neo_private','agent_drafts'), ('neo_private','ai_consent_events'),
  ('neo_private','agents'), ('neo_private','agent_catalog_knowledge'), ('neo_private','agent_runtime_attempts'),
  ('public','neo_consents')
)
select n.nspname, c.relname, a.attnum, a.attname, format_type(a.atttypid,a.atttypmod) as data_type,
       a.attnotnull, a.atthasdef, a.attidentity
from targets t
join pg_namespace n on n.nspname=t.schema_name
join pg_class c on c.relnamespace=n.oid and c.relname=t.object_name
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
order by n.nspname,c.relname,a.attnum;

select c.relname, con.conname, con.contype, con.convalidated,
       case when con.confrelid<>0 then con.confrelid::regclass::text end as referenced_table
from pg_constraint con join pg_class c on c.oid=con.conrelid
where c.relnamespace=to_regnamespace('neo_private') and
  c.relname in ('agent_settings','agent_knowledge','ai_integrations','support_threads','ai_jobs',
    'ai_attempts','agent_drafts','ai_consent_events','agents','agent_catalog_knowledge','agent_runtime_attempts')
order by c.relname,con.conname;

select tablename,indexname from pg_indexes
where schemaname='neo_private' and tablename in ('ai_jobs','support_threads','agent_catalog_knowledge','agent_runtime_attempts')
order by tablename,indexname;

select tablename,policyname,permissive,roles,cmd from pg_policies
where (schemaname='neo_private' and tablename in ('agent_settings','agent_knowledge','ai_integrations',
  'support_threads','ai_jobs','ai_attempts','agent_drafts','ai_consent_events','agents','agent_catalog_knowledge','agent_runtime_attempts'))
  or (schemaname='public' and tablename='neo_consents')
order by tablename,policyname;

select r.rolname,c.relname,has_schema_privilege(r.oid,c.relnamespace,'USAGE') as schema_usage,
       has_table_privilege(r.oid,c.oid,'SELECT') as can_select,
       has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE') as can_mutate
from pg_roles r cross join pg_class c
where r.rolname in ('anon','authenticated','service_role')
  and c.relnamespace=to_regnamespace('neo_private')
  and c.relname in ('agent_settings','agent_knowledge','ai_integrations','support_threads','ai_jobs',
    'ai_attempts','agent_catalog','agents','agent_catalog_knowledge','agent_runtime_attempts')
order by r.rolname,c.relname;

select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result,p.prosecdef,p.provolatile,
       md5(pg_get_functiondef(p.oid)) as definition_fingerprint,
       array(select r.rolname from pg_roles r where r.rolname in ('anon','authenticated','service_role')
         and has_function_privilege(r.oid,p.oid,'EXECUTE') order by r.rolname) as executable_by
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.prokind='f' and n.nspname in ('public','neo_private') and
  (p.proname in ('neo_admin_access','neo_integration_admin','neo_has_consent','neo_agent','neo_agent_credentials',
    'neo_agent_integration','neo_support','neo_support_access','neo_ai_claim','neo_ai_finish',
    'enqueue_ai','take_limit','message_signal','agent_hours','agent_instructions')
    or p.proname like 'neo_multiagent%' or p.proname like 'agent_runtime_%'
    or p.proname in ('neo_support_before_multiagent','neo_ai_claim_before_multiagent','neo_ai_finish_before_multiagent'))
order by n.nspname,p.proname,arguments;

select c.relname,t.tgname,t.tgenabled,p.proname
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal and c.relnamespace=to_regnamespace('neo_private')
  and c.relname in ('support_threads','support_messages','ai_jobs')
order by c.relname,t.tgname;

-- Read only the migration identifiers, when the CLI history is visible.
select to_regclass('supabase_migrations.schema_migrations') as migration_history;
-- If the preceding result is present, run this SELECT in the same read-only session:
-- select version from supabase_migrations.schema_migrations order by version;
rollback;
