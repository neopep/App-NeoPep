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
