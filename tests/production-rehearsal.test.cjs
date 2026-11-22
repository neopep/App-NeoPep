const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {test}=require('node:test');
const {PGlite}=require('@electric-sql/pglite');

test('lotes de ensaio recusam destino errado e colisão, preservam Auth e verificam RLS e ACL',async()=>{
 const db=new PGlite();
 const render=(lot,rollback=false)=>execFileSync('python3',[
  'release/production/batches/render.py',lot,...(rollback?['--rollback']:[])
 ],{encoding:'utf8'});
 const fixtureDatabase=(await db.query('select current_database() as name')).rows[0].name;
 assert.match(fixtureDatabase,/^[a-z0-9_]+$/);
 const fixture=sql=>sql.replace("current_database() <> 'neopep_release_rehearsal'", "current_database() <> '"+fixtureDatabase+"'");
 const getTables=async()=>Number((await db.query(
  "select count(*) from pg_tables where schemaname='neo_private' and tablename in ('signup_notice_reads','signup_notice_rollout','audience_observations','engagement_events')"
 )).rows[0].count);
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema neo_private;
   create table auth.users(id uuid primary key,email text,created_at timestamptz,last_sign_in_at timestamptz,
    deleted_at timestamptz,is_anonymous boolean,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
   create table public.neo_profiles(user_id uuid primary key,data jsonb);
   create table neo_private.activity(user_id uuid primary key,last_seen timestamptz);
   create table neo_private.admin_members(user_id uuid primary key);
   create function auth.uid() returns uuid language sql as $$select null::uuid$$;
   create function public.neo_admin_access() returns boolean language sql as $$select false$$;
   insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000001','fixture@example.invalid');`);
  const seed=(await db.query('select * from auth.users')).rows;
  const signup=render('01-cadastros'),audience=render('02-audiencia-engajamento');
  await assert.rejects(db.exec(signup),/Banco fora do ensaio/);
  await db.exec('rollback');
  await db.exec(fixture(render('01-cadastros',true)));
  assert.equal(await getTables(),0);
  await db.exec(fixture(signup));
  assert.equal(await getTables(),2);
  await assert.rejects(db.exec(fixture(signup)),/Objeto existente/);
  await db.exec('rollback');
  await db.exec(fixture(audience));
  assert.equal(await getTables(),4);
  assert.deepEqual((await db.query('select * from auth.users')).rows,seed);
  await db.exec('set role authenticated');
  await assert.rejects(db.query("select public.neo_admin_signups('count')"),{code:'42501'});
  await assert.rejects(db.query("select public.neo_engagement('status')"),{code:'42501'});
 }finally{await db.close();}
});

test('aplica os sete lotes sobre uma instalação isolada da base oficial',async()=>{
 const fs=require('node:fs');
 const manifest=require('../release/production/batches/manifest.json');
 const db=new PGlite();
 const protectedTables=['neo_photos','neo_records','neo_consents','neo_profiles','neo_consent_events','neo_message_events','neo_migration_receipts'];
 try{
  await db.exec(fs.readFileSync('tests/fixtures/production/base.sql','utf8'));
  async function apply(label,sql){
   try{await db.exec(sql);}catch(error){throw new Error(`${label}: ${error.message} ${error.where??''}`);}
  }
  for(const file of fs.readdirSync('supabase/migrations').sort().filter(file=>file<='202611160072_avatar_versions.sql')){
   await apply(file,fs.readFileSync('supabase/migrations/'+file,'utf8'));
  }
  await db.exec(`alter table neo_private.community_preferences alter column push_enabled set default true;
   grant select,insert,update,delete on ${protectedTables.map(name=>'public.'+name).join(',')} to service_role;`);
  const tables=async()=>(await db.query("select tablename as name from pg_tables where schemaname='neo_private' order by 1")).rows.map(row=>row.name);
  const before=new Set(await tables());
  const counts=async()=>(await db.query(`select
   (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','neo_private')) as routines,
   (select count(*) from pg_indexes where schemaname in ('public','neo_private')) as indexes,
   (select count(*) from pg_trigger where not tgisinternal) as triggers,
   (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','neo_private')) as constraints,
   (select count(*) from pg_policies where schemaname='storage') as storage_policies`)).rows[0];
  const baseCounts=await counts();
  const database=(await db.query('select current_database() as name')).rows[0].name;
  assert.match(database,/^[a-z0-9_]+$/);
  for(const name of Object.keys(manifest)){
   const sql=execFileSync('python3',['release/production/batches/render.py',name],{encoding:'utf8'});
   await apply(name,sql.replace("current_database() <> 'neopep_release_rehearsal'",`current_database() <> '${database}'`));
  }
  const afterCounts=await counts();
  const delta=Object.fromEntries(Object.keys(baseCounts).map(key=>[key,Number(afterCounts[key])-Number(baseCounts[key])]));
  assert.deepEqual(delta,{routines:42,indexes:70,triggers:13,constraints:182,storage_policies:3});
  console.log('Delta isolado por classe',delta);
  assert.equal((await db.query("select has_function_privilege('service_role','public.neo_connect_admin(text,jsonb)','EXECUTE') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('service_role','public.neo_campaign_push_claim()','EXECUTE') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query('select paused from neo_private.connect_config')).rows[0].paused,true);
  const expected=Object.values(manifest).flatMap(lot=>lot.tables.map(table=>table.split('.')[1])).sort();
  assert.equal(expected.length,38);
  assert.deepEqual((await tables()).filter(table=>!before.has(table)),expected);
  assert.equal(Object.values(manifest).flatMap(lot=>Object.keys(lot.new_columns??{})).length,9);
  assert.equal((await db.query("select column_default from information_schema.columns where table_schema='neo_private' and table_name='community_preferences' and column_name='push_enabled'")).rows[0].column_default,'true');
  assert.deepEqual((await db.query('select * from cron.job')).rows,[{jobid:1,jobname:'neo-push-dispatch',schedule:'* * * * *',active:true,command:'select 1'}]);
  for(const table of protectedTables){
   const result=await db.query("select privilege_type from information_schema.table_privileges where table_schema='public' and table_name=$1 and grantee='service_role' order by 1",[table]);
   assert.deepEqual(result.rows.map(row=>row.privilege_type),['DELETE','INSERT','SELECT','UPDATE']);
  }
  assert.deepEqual((await db.query("select id from storage.buckets where not public and id in ('neo-campaign-images','neo-connect-releases') order by id")).rows.map(row=>row.id),['neo-campaign-images','neo-connect-releases']);

  // CRLF fingerprint de produção: a função é semanticamente a mesma quando os
  // finais de linha são convertidos, mas o SHA bruto é diferente.
  const currentHash=async()=> (await db.query("select encode(sha256(convert_to(prosrc,'UTF8')),'hex') as sha from pg_proc where oid=to_regprocedure('public.neo_shop_v36(text,jsonb)')")).rows[0].sha;
  const sourcePatch=fs.readFileSync('supabase/migrations/20261122190100_shop_checkout_retry.sql','utf8');
  const sourceRollback=fs.readFileSync('release/production/rollback/20261122190100_shop_checkout_retry.sql','utf8');
  const oldSha='2ce19e73bcb43f0d86793b99155143ef841c9559d665129278dd6749cbb222c9';
  const prodCrLfSha='fc8d0d088eee0df77db4718b0a398585ee3f17fd7d36f198914c23d978723080';
  const patchedSha='cba1a27d4d54e0cb050877b3434003440a3ba9493cd27dad43b4a4ebd1038521';
  assert.equal(await currentHash(),patchedSha);
  await apply('rollback financeiro LF',sourceRollback);
  assert.equal(await currentHash(),oldSha);
  const oldDefinition=(await db.query("select pg_get_functiondef(to_regprocedure('public.neo_shop_v36(text,jsonb)')) as ddl")).rows[0].ddl;
  await apply('simular função com CRLF',oldDefinition.replace(/\r?\n/g,'\r\n'));
  assert.equal(await currentHash(),prodCrLfSha);
  await apply('patch financeiro CRLF',sourcePatch);
  assert.equal(await currentHash(),patchedSha);
  await apply('idempotência do patch CRLF',sourcePatch);
  assert.equal(await currentHash(),patchedSha);
 }finally{await db.close();}
});
