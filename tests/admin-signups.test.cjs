const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');

const migration=fs.readFileSync('supabase/migrations/20261121170551_admin_signup_notices.sql','utf8');
const adminA='00000000-0000-4000-8000-000000000001';
const adminB='00000000-0000-4000-8000-000000000002';
const regular='00000000-0000-4000-8000-000000000003';
const moderator='00000000-0000-4000-8000-000000000004';
const apple='00000000-0000-4000-8000-000000000005';

test('cadastros têm leitura individual, paginação estável e acesso restrito',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated;
   create schema auth; create schema neo_private;
   create table auth.users(id uuid primary key, email text, created_at timestamptz, last_sign_in_at timestamptz,
    raw_user_meta_data jsonb, raw_app_meta_data jsonb, deleted_at timestamptz, is_anonymous boolean);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create table neo_private.admin_members(user_id uuid primary key);
   create table neo_private.activity(user_id uuid primary key,last_seen timestamptz);
   create table public.neo_profiles(user_id uuid primary key,data jsonb);
   create function public.neo_admin_access() returns boolean language sql stable security definer set search_path=pg_catalog as
    $$ select auth.uid() in ('${adminA}','${adminB}','${moderator}') $$;
   insert into auth.users(id,created_at) values
    ('${adminA}',now()-interval '1 day'),('${adminB}',now()-interval '1 day'),('${moderator}',now()-interval '1 day');
   insert into neo_private.admin_members values ('${adminA}'),('${adminB}');
  `);
  await db.exec(migration);
  await db.exec(`
   insert into auth.users(id,email,created_at,raw_app_meta_data,raw_user_meta_data)
   values ('${regular}','signup@example.invalid',now(),'{"provider":"google"}','{"full_name":"Nome Fictício"}'),
    ('${apple}','apple@example.invalid',now(),'{"provider":"apple"}','{}');
   insert into public.neo_profiles values ('${apple}','{"profile":{"name":"Perfil Fictício"}}');
   insert into neo_private.activity values ('${apple}',now());
  `);
  async function as(id){
   await db.exec('reset role');
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
   await db.exec('set role authenticated');
  }
  async function rpc(args,params=[]){
   return (await db.query('select public.neo_admin_signups('+args+') result',params)).rows[0].result;
  }
  await as(regular);
  await assert.rejects(rpc("'page'"),{code:'42501'});
  await as(moderator);
  await assert.rejects(rpc("'count'"),{code:'42501'});
  await db.exec('reset role; set role anon');
  await assert.rejects(rpc("'page'"),{code:'42501'});
  await as(adminA);
  await assert.rejects(db.query('select * from neo_private.signup_notice_reads'),{code:'42501'});
  assert.equal((await rpc("'count'")).count,2);
  const opened=await rpc("'open'");
  assert.equal(opened.read_count,2);
  assert.equal(opened.rows.find(row=>row.id===regular).full_name,'Nome Fictício');
  assert.equal(opened.rows.find(row=>row.id===regular).last_access,null);
  assert.equal(opened.rows.find(row=>row.id===apple).provider,'apple');
  assert.ok(opened.rows.find(row=>row.id===apple).last_access);
  assert.equal((await rpc("'count'")).count,0);
  assert.equal((await rpc("'open'")).read_count,0);
  assert.equal((await rpc("'page', p_new=>true,p_batch=>$1",[opened.batch])).rows.length,2);
  await as(adminB);
  assert.equal((await rpc("'count'")).count,2);
  assert.equal((await rpc("'open'")).read_count,2);
  await db.exec(`reset role;
   update auth.users set last_sign_in_at=now() where id='${regular}';
   insert into auth.users(id,email,created_at,raw_app_meta_data)
    select md5('fixture'||n)::uuid,'page-'||n||'@example.invalid',now(),'{"provider":"email"}' from generate_series(1,2500) n;
  `);
  await as(adminA);
  assert.equal((await rpc("'count'")).count,2500);
  const first=(await rpc("'page',p_query=>'page-',p_new=>true")).rows;
  assert.equal(first.length,21);
  const cursor=first[19];
  const second=(await rpc("'page',p_query=>'page-',p_new=>true,p_before=>$1,p_before_id=>$2",[cursor.created_at,cursor.id])).rows;
  assert.equal(second.length,21);
  assert.equal(second[0].id,first[20].id);
  assert.ok(second.every(row=>!first.slice(0,20).some(previous=>previous.id===row.id)));
  assert.equal((await rpc("'page',p_query=>'Fictício'")).rows.length,2);
  assert.equal((await rpc("'page',p_from=>now()+interval '1 day'")).rows.length,0);
  const bulk=await rpc("'open'");
  assert.equal(bulk.read_count,2500);
  assert.equal(bulk.rows.length,5);
  assert.equal((await rpc("'count'")).count,0);
 }finally{await db.close()}
});
