const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {PGlite}=require('@electric-sql/pglite');
const admin='00000000-0000-4000-8000-000000000001';
const person='00000000-0000-4000-8000-000000000002';
const run=(db,q,p=[])=>db.query(q,p).then(r=>r.rows[0]?.result);
const migration=file=>fs.readFileSync('supabase/migrations/'+file,'utf8');

test('auditoria restringe ingestão, preserva primeiro local e separa custos de dois agentes',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema auth;create schema neo_private;create schema storage;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
   create function public.neo_admin_access() returns boolean language sql stable as $$select true$$;
   create table auth.users(id uuid primary key,email text,created_at timestamptz,deleted_at timestamptz,is_anonymous boolean,
    last_sign_in_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
   insert into auth.users(id,email,created_at) values ('${person}','fixture@example.invalid',now());
   create table neo_private.admin_members(user_id uuid primary key);
   insert into neo_private.admin_members values ('${admin}');
   create table neo_private.ai_jobs(id uuid primary key,agent_id uuid);
   create table neo_private.audience_observations(user_id uuid primary key,expires_at timestamptz,engagement_allowed boolean,
    first_device jsonb,last_device jsonb,first_campaign jsonb,last_campaign jsonb);
   create table neo_private.operations_quality(account uuid,bucket timestamptz,metric text,revision text,duration_ms integer,primary key(account,bucket,metric,revision));
   create table neo_private.activity(user_id uuid primary key,last_seen timestamptz);
   create table neo_private.signup_notice_rollout(started_at timestamptz);
   insert into neo_private.signup_notice_rollout values(now()-interval '1 day');
   create table neo_private.signup_notice_reads(admin_id uuid,signup_id uuid,read_at timestamptz);
   create table public.neo_profiles(user_id uuid primary key,data jsonb);
   create table storage.objects(bucket_id text,metadata jsonb);
   create table neo_private.app_errors(day date,code text,count int);`);
  await db.exec(migration('20261121184939_admin_system_monitor.sql'));
  await db.exec(migration('20261121192900_staging_audit_hardening.sql'));
  async function as(uid,role){
   await db.exec('reset role');
   await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[uid,role]);
   if(role!=='postgres')await db.exec('set role '+role);
  }
  await as(person,'authenticated');
  await assert.rejects(run(db,"select public.neo_admin_geo($1) result",[[person]]),{code:'42501'});
  await assert.rejects(run(db,"select public.neo_geo_observe($1,'BR') result",[person]),{code:'42501'});
  await assert.rejects(run(db,'select public.neo_admin_signup_export() result'),{code:'42501'});
  assert.equal((await run(db,"select public.neo_geo_control('allow') result")).allowed,true);
  assert.equal(await run(db,"select public.neo_quality_observe('web_lcp',100) result"),false);
  await as(admin,'authenticated');
  await assert.rejects(run(db,"select public.neo_admin_system('scheduled_snapshot') result"),{code:'22023'});
  await as('', 'service_role');
  assert.equal(await run(db,"select public.neo_geo_observe($1,'BR','SP','São Paulo') result",[person]),true);
  assert.equal(await run(db,"select public.neo_geo_observe($1,'BR','RJ','Rio de Janeiro') result",[person]),false);
  await run(db,"select public.neo_admin_system('scheduled_snapshot') result");
  await run(db,"select public.neo_admin_system('scheduled_failure') result");
  await as('', 'postgres');
  await db.query("update neo_private.account_geo set last_location=jsonb_set(last_location,'{observed_at}',to_jsonb(now()-interval '6 minutes'))");
  await db.query("insert into neo_private.audience_observations(user_id,expires_at,engagement_allowed) values($1,now()+interval '1 day',true)",[person]);
  const jobs=[{id:crypto.randomUUID(),agent:crypto.randomUUID(),idempotency:crypto.randomUUID()},{id:crypto.randomUUID(),agent:crypto.randomUUID(),idempotency:crypto.randomUUID()}];
  for(const job of jobs)await db.query("insert into neo_private.ai_jobs values($1,$2)",[job.id,job.agent]);
  await as(admin,'authenticated');
  await run(db,"select public.neo_admin_system('price',$1) result",[JSON.stringify({provider:'openai',model:'fixture',currency:'USD',
   effective_from:'2000-01-01',input_per_million:2,output_per_million:5,cached_per_million:1})]);
  await as('', 'service_role');
  assert.equal(await run(db,"select public.neo_geo_observe($1,'BR','RJ','Rio de Janeiro') result",[person]),true);
  for(const [i,job] of jobs.entries()){
   const metric={id:job.idempotency,job_id:job.id,provider:'openai',model:'fixture',status:i?'error':'ok',duration_ms:110,
    ...(i?{}:{input_tokens:1000,output_tokens:200,cached_tokens:300,total_tokens:1200})};
   await run(db,'select public.neo_system_ai_record($1) result',[JSON.stringify(metric)]);
   await run(db,'select public.neo_system_ai_record($1) result',[JSON.stringify(metric)]);
  }
  await as(admin,'authenticated');
  const ai=await run(db,"select public.neo_admin_system('ai') result");
  assert.equal(ai.calls,2);assert.equal(ai.errors,1);assert.equal(ai.costs[0].estimated,.0027);
  assert.deepEqual(new Set(ai.models.map(x=>x.agent_id)),new Set(jobs.map(x=>x.agent)));
  assert.ok(ai.models.every(x=>x.feature==='agent_support'&&x.environment==='staging'));
  const exported=await run(db,"select public.neo_admin_signup_export(p_query=>'fixture') result");
  assert.equal(exported.rows.length,1);
  assert.equal(exported.rows[0].first_location.city,'São Paulo');
  assert.equal(exported.rows[0].last_location.city,'Rio de Janeiro');
  assert.doesNotMatch(JSON.stringify(exported),/job_id|encrypted|password/);
  assert.equal((await run(db,"select public.neo_admin_system('scheduled_status') result")).runs.length,2);
  await as(person,'authenticated');
  assert.equal(await run(db,"select public.neo_quality_observe('web_lcp',620,'123456789abc') result"),true);
  assert.equal(await run(db,"select public.neo_quality_observe('web_cls',70,'123456789abc') result"),true);
  assert.equal((await run(db,"select public.neo_geo_control('remove') result")).allowed,false);
 }finally{await db.close()}
});

test('rota de observação bloqueia cron sem token e transmite só a localização da hospedagem',async()=>{
 const source=fs.readFileSync('api/staging-observe.js','utf8');
 const calls=[],env={VERCEL_GIT_COMMIT_REF:'staging/permanente',NEO_STAGING_GEO_ENABLED:'1',CRON_SECRET:'x'.repeat(40),
  NEO_STAGING_SUPABASE_PUBLISHABLE_KEY:'public-fixture',NEO_STAGING_SERVER_SUPABASE_KEY:'server-fixture'};
 const ctx={module:{exports:{}},require,process:{env},Buffer,AbortSignal,fetch:async(url,options)=>{
  calls.push({url,...options});
  return {ok:true,json:async()=>url.endsWith('/auth/v1/user')?{id:person}:true};
 }};
 vm.runInNewContext(source,ctx);
 async function hit(mode,method,authorization){
  const res={setHeader(){},status(status){this.code=status;return this},end(){return this},json(body){this.body=body;return this}};
  return ctx.module.exports({query:{mode},method,headers:{authorization,'x-vercel-ip-country':'BR','x-vercel-ip-country-region':'SP',
   'x-vercel-ip-city':'S%C3%A3o%20Paulo','x-forwarded-for':'192.0.2.100'}},res);
 }
 assert.equal((await hit('snapshot','GET','Bearer wrong')).code,401);
 assert.equal(calls.length,0);
 assert.equal((await hit('geo','POST','Bearer valid.fixture')).code,200);
 assert.deepEqual(JSON.parse(calls.at(-1).body),{p_user:person,p_country:'BR',p_region:'SP',p_city:'São Paulo'});
 assert.ok(!calls.some(call=>JSON.stringify(call).includes('192.0.2.100')));
 assert.equal((await hit('snapshot','GET','Bearer '+env.CRON_SECRET)).code,200);
 assert.deepEqual(JSON.parse(calls.at(-1).body),{p_action:'scheduled_snapshot'});
 env.VERCEL_GIT_COMMIT_REF='homologacao/ciclo-completo-2026-11-24';
 const baseline=calls.length;
 assert.equal((await hit('snapshot','GET','Bearer '+env.CRON_SECRET)).code,404);
 assert.equal((await hit('geo','POST','Bearer inválido')).code,401);
 assert.equal(calls.length,baseline);
 assert.equal((await hit('geo','POST','Bearer valid.fixture')).code,200);
 assert.equal(calls.at(-1).url,'https://qnuluspqfazdppciermw.supabase.co/rest/v1/rpc/neo_geo_observe');
 assert.equal(calls.at(-1).headers.Authorization,'Bearer server-fixture');
 delete env.NEO_STAGING_SERVER_SUPABASE_KEY;
 assert.equal((await hit('geo','POST','Bearer valid.fixture')).body.configured,false);
 env.VERCEL_GIT_COMMIT_REF='main';
 assert.equal((await hit('geo','POST','Bearer valid.fixture')).code,404);
});
