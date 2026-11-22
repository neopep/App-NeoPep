const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');

test('RPC de rascunho recusa downgrade e duplicatas conflitantes e preserva aprovação separada',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create schema neo_private; create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create function neo_private.campaign_admin_allowed() returns boolean language sql as $$
     select current_setting('fixture.admin',true)='true' $$;
    create table neo_private.connect_releases(version text primary key,path text,sha256 text,bytes bigint,
     artifact text,release_signature text,notes text,distribution_state text,profile text default 'staging',
     channel text default 'stable',created_at timestamptz default now(),approved_at timestamptz,required boolean default false);
    create table neo_private.connect_audit(id bigint generated always as identity,actor_id uuid,event text,
     release_version text,release_result text,created_at timestamptz default now());
    create table neo_private.connect_update_events(id bigint,created_at timestamptz);
    create table storage.buckets(id text,public boolean);
    create table storage.objects(bucket_id text,name text,metadata jsonb);
    set fixture.admin='false';`);
  await db.exec(readFileSync('docs/revisao/connect-release-register.sql','utf8'));
  const draft={version:'0.2.6',artifact:'run',bytes:42,sha256:'a'.repeat(64),signature:'A'.repeat(342)+'=='};
  const call=(action='register',data=draft)=>db.query('select public.neo_connect_update_admin($1,$2) as result',[action,JSON.stringify(data)]).then(r=>r.rows[0].result);
  await assert.rejects(call(),{code:'42501'});
  await db.exec("set fixture.admin='true'");
  assert.deepEqual(await call(),{ok:true});
  assert.deepEqual(await call(),{ok:true,reused:true});
  assert.equal((await call('list',{})).audit.length,1);
  assert.equal((await call('list',{})).releases[0].distribution_state,'draft');
  await assert.rejects(call('register',{...draft,artifact:'outro'}),{code:'23505'});
  assert.deepEqual(await call('register',{...draft,version:'0.2.5'}),{ok:false,code:'release_version'});
  assert.deepEqual(await call('approve',{version:draft.version}),{ok:false,code:'release_storage'});
 }finally{await db.close();}
});
