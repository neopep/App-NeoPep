const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {PGlite}=require('@electric-sql/pglite');
const {transformSync}=require('esbuild');

test('medição interna de saúde, limites e preços versionados ficam restritos a administradores',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema neo_private;create schema storage;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table auth.users(id uuid primary key);create table neo_private.admin_members(user_id uuid primary key);
    create function public.neo_admin_access() returns boolean language sql stable as $$select true$$;
    create table storage.objects(bucket_id text,metadata jsonb);
    create table neo_private.app_errors(day date,code text,count int);
    insert into neo_private.admin_members values ('00000000-0000-4000-8000-000000000011');
    insert into storage.objects values ('private','{"size":"500"}'),('private','{"size":"unknown"}');
    insert into neo_private.app_errors values(current_date,'photo_failed',3);`);
  await db.exec(fs.readFileSync('supabase/migrations/20261121184939_admin_system_monitor.sql','utf8'));
  const rpc=async(args,params=[])=>(await db.query('select public.neo_admin_system('+args+') result',params)).rows[0].result;
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);`);
  await assert.rejects(rpc("'snapshot'"),{code:'42501'});
  await assert.rejects(db.query("select public.neo_system_ai_record('{}')"),{code:'42501'});
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',false);`);
  const snapshot=await rpc("'snapshot'");
  assert.equal(snapshot.data.storage_bytes,500);
  assert.equal(snapshot.data.storage_sized_objects,1);
  assert.equal(snapshot.data.storage_objects,2);
  assert.equal(snapshot.data.errors[0].total,3);
  assert.ok(snapshot.data.database_bytes>0);
  const limited=await rpc("'limit',$1",[JSON.stringify({resource:'database_bytes',amount:50,attention:70,warning:85,critical:95})]);
  assert.equal(limited.alerts.length,1);
  assert.equal(limited.alerts[0].severity,'critical');
  assert.equal((await rpc("'snapshot'")).alerts.length,1);
  assert.equal((await rpc("'snapshot'")).observed_at,snapshot.observed_at);
  await rpc("'price',$1",[JSON.stringify({provider:'openai',model:'fixture-model',currency:'USD',
   effective_from:'2000-01-01',input_per_million:2,output_per_million:5,cached_per_million:1})]);
  await db.exec('reset role;set role service_role');
  const call={id:crypto.randomUUID(),provider:'openai',model:'fixture-model',status:'ok',duration_ms:300,
   input_tokens:1000,output_tokens:200,cached_tokens:300,reasoning_tokens:50,total_tokens:1200};
  for(let i=0;i<2;i++)await db.query('select public.neo_system_ai_record($1)',[JSON.stringify(call)]);
  await db.exec('reset role;set role authenticated');
  const ai=await rpc("'ai'");
  assert.equal(ai.calls,1);
  assert.equal(ai.total_tokens,1200);
  assert.equal(ai.cached_tokens,300);
  assert.equal(ai.reasoning_tokens,50);
  assert.equal(ai.costs[0].estimated,.0027);
  assert.equal(ai.costs[0].no_cache,.003);
  assert.equal(ai.p95,null);
 }finally{await db.close()}
});

test('normalização de tokens preserva totais e não divulga entrada ou resposta',async()=>{
 const file=fs.readFileSync('supabase/functions/_shared/ai-usage.ts','utf8');
 const ctx={module:{exports:{}},crypto,performance};
 vm.runInNewContext(transformSync(file,{loader:'ts',format:'cjs'}).code,ctx);
 const {normalizeUsage,withAIUsage}=ctx.module.exports;
 assert.equal(normalizeUsage('openai',{usage:{input_tokens:120,output_tokens:30,total_tokens:150,
  input_tokens_details:{cached_tokens:80},output_tokens_details:{reasoning_tokens:10}}}).total_tokens,150);
 assert.equal(normalizeUsage('claude',{usage:{input_tokens:120,cache_creation_input_tokens:80,cache_read_input_tokens:60,output_tokens:30}}).total_tokens,290);
 let observed;
 const answer=await withAIUsage('openai','fixture',async value=>{observed=value;throw Error('RPC unavailable')},async capture=>{
  capture({usage:{total_tokens:10},input:'Mensagens privadas'});return 'Resposta privada';
 });
 assert.equal(answer,'Resposta privada');
 assert.equal(observed.total_tokens,10);
 assert.equal(observed.status,'ok');
 assert.doesNotMatch(JSON.stringify(observed),/privad/);
});

test('backend externo verifica administração e rejeita um projeto Vercel que não seja staging',async()=>{
 const source=fs.readFileSync('release/production/staging-api/admin-monitor.js','utf8');
 const calls=[],env={VERCEL_GIT_COMMIT_REF:'staging/permanente',NEO_STAGING_SUPABASE_PUBLISHABLE_KEY:'public-test',
  NEO_MONITOR_VERCEL_TOKEN:'backend-fixture',NEO_MONITOR_VERCEL_PROJECT_ID:'fixture'};
 let admin=false;
 const ctx={module:{exports:{}},process:{env},AbortSignal,fetch:async(url,options)=>{
  calls.push({url,authorization:options.headers.Authorization});
  const data=url.includes('/rest/v1/')?{authorized:admin}:{id:'fixture',name:'app-neopep'};
  return {ok:true,json:async()=>data};
 }};
 vm.runInNewContext(source,ctx);
 const ask=async provider=>{
  const req={method:'GET',query:{provider},headers:{authorization:'Bearer valid.fixture'}};
  const res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
  return ctx.module.exports(req,res);
 };
 assert.equal((await ask('vercel')).code,403);
 assert.equal(calls.length,1);
 admin=true;
 const result=await ask('vercel');
 assert.equal(result.code,200);
 assert.equal(result.body.connected,false);
 assert.equal(calls.filter(x=>x.url.includes('/v6/deployments')).length,0);
 assert.equal(calls.at(-1).authorization,'Bearer backend-fixture');
 assert.doesNotMatch(JSON.stringify(result.body),/backend-fixture/);
 env.VERCEL_GIT_COMMIT_REF='main';
 assert.equal((await ask('github')).code,404);
});
