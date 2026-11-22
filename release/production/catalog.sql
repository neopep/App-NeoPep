-- psql -XqAt. Inventário sem linhas de aplicação, tokens ou corpos de funções.
\set ON_ERROR_STOP on
begin transaction isolation level repeatable read read only;
set local statement_timeout = '45s';
set local lock_timeout = '3s';
set local search_path = pg_catalog;
with relations as (
 select c.*,n.nspname as schema_name from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','neo_private','storage','auth') and c.relkind in ('r','p','v','m','S','f')
), objects(kind,identity,definition) as (
 select 'relation',format('%I.%I',schema_name,relname),
  jsonb_build_object('kind',relkind,'rls',relrowsecurity,'force_rls',relforcerowsecurity,
   'owner',pg_get_userbyid(relowner),'acl',relacl,'options',reloptions,
   'view_hash',case when relkind in ('v','m') then md5(pg_get_viewdef(oid)) end)
 from relations
 union all
 select 'column',format('%I.%I.%I',r.schema_name,r.relname,a.attname),
  jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,
   'default_hash',md5(pg_get_expr(d.adbin,d.adrelid)),'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl)
 from relations r join pg_attribute a on a.attrelid=r.oid and a.attnum>0 and not a.attisdropped
 left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 union all
 select 'routine',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),
  jsonb_build_object('body_hash',md5(pg_get_functiondef(p.oid)),'definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),
   'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'service_role',has_function_privilege('service_role',p.oid,'EXECUTE'),'acl',p.proacl)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','neo_private','storage','auth') and p.prokind in ('f','p','w')
 union all
 select 'constraint',format('%I.%I.%I',r.schema_name,r.relname,c.conname),
  jsonb_build_object('kind',c.contype,'validated',c.convalidated,'definition_hash',md5(pg_get_constraintdef(c.oid)))
 from relations r join pg_constraint c on c.conrelid=r.oid
 union all
 select 'index',format('%I.%I',r.schema_name,i.relname),
  jsonb_build_object('valid',x.indisvalid,'ready',x.indisready,'definition_hash',md5(pg_get_indexdef(i.oid)))
 from relations r join pg_index x on x.indrelid=r.oid join pg_class i on i.oid=x.indexrelid
 union all
 select 'trigger',format('%I.%I.%I',r.schema_name,r.relname,t.tgname),
  jsonb_build_object('state',t.tgenabled,'definition_hash',md5(pg_get_triggerdef(t.oid)))
 from relations r join pg_trigger t on t.tgrelid=r.oid and not t.tgisinternal
 union all
 select 'policy',format('%I.%I.%I',r.schema_name,r.relname,p.polname),
  jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,
   'roles',array(select case when role=0 then 'PUBLIC' else pg_get_userbyid(role) end from unnest(p.polroles) role order by 1),
   'using_hash',md5(pg_get_expr(p.polqual,p.polrelid)),'check_hash',md5(pg_get_expr(p.polwithcheck,p.polrelid)))
 from relations r join pg_policy p on p.polrelid=r.oid
 union all
 select 'extension',extname,jsonb_build_object('version',extversion) from pg_extension
 union all
 select 'schema',nspname,jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl)
 from pg_namespace where nspname in ('public','neo_private','storage','auth')
 union all
 select 'event_trigger',evtname,jsonb_build_object('event',evtevent,'enabled',evtenabled,'tags',evttags,'routine',evtfoid::regprocedure::text)
 from pg_event_trigger
 union all
 select 'bucket',id,jsonb_build_object('public',public,'max_bytes',file_size_limit,'mime',allowed_mime_types)
 from storage.buckets
)
select jsonb_build_object('kind',kind,'id',identity,'definition',definition)
from objects order by kind,identity;

select (to_regclass('supabase_migrations.schema_migrations') is not null)::int as has_ledger,
       (to_regclass('cron.job') is not null)::int as has_cron \gset
\if :has_ledger
select jsonb_build_object('kind','migration','id',m.version,'definition',
 jsonb_build_object('name',to_jsonb(m)->>'name','statements_hash',md5((to_jsonb(m)->'statements')::text)))
from supabase_migrations.schema_migrations m order by m.version;
\endif
\if :has_cron
select jsonb_build_object('kind','cron','id',coalesce(jobname,jobid::text),'definition',
 jsonb_build_object('schedule',schedule,'active',active,'command_hash',md5(command)))
from cron.job order by jobid;
\endif
select jsonb_build_object('kind','meta','id','server','definition',
 jsonb_build_object('version',current_setting('server_version'),'ledger',:has_ledger=1,'cron',:has_cron=1));
rollback;
