const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const admin='00000000-0000-4000-8000-000000000001';
const customer='00000000-0000-4000-8000-000000000002';

test('operações usa dados reais, suprime coortes imaturas e protege auditoria e coleta',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated;
   create schema auth;create schema neo_private;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table auth.users(id uuid primary key,created_at timestamptz,deleted_at timestamptz);
   create table neo_private.admin_members(user_id uuid primary key);
   create function public.neo_admin_access() returns boolean language sql stable as $$select true$$;
   create table neo_private.audience_observations(user_id uuid primary key,expires_at timestamptz,engagement_allowed boolean,last_device jsonb);
   create table neo_private.engagement_events(account uuid,session_id uuid,occurred_at timestamptz,event text);
   create table neo_private.system_monitor_snapshots(day date,data jsonb);
   create table neo_private.app_errors(day date,count int);
   create table neo_private.system_monitor_limits(k text,v int);
   create view neo_private.agents as select k from neo_private.system_monitor_limits;
   insert into neo_private.admin_members values ('${admin}');`);
  await db.exec(fs.readFileSync('supabase/migrations/20261121190211_admin_operations.sql','utf8'));
  async function as(uid,role='authenticated'){
   await db.exec('reset role');
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
   if(role!=='postgres')await db.exec('set role '+role);
  }
  async function ops(section,days=30,review=null){
   return (await db.query('select public.neo_admin_operations($1,$2,$3) d',[section,days,review])).rows[0].d;
  }
  await as(customer);
  await assert.rejects(ops('audit'),{code:'42501'});
  assert.equal((await db.query("select public.neo_quality_observe('javascript_error') v")).rows[0].v,false);
  await as(admin,'postgres');
  await db.exec("insert into neo_private.system_monitor_limits values('internal_fixture',8)");
  await as(admin);
  const logs=await ops('audit');
  assert.equal(logs.entries[0].action,'limits');
  assert.equal(logs.entries[0].actor,admin);
  assert.doesNotMatch(JSON.stringify(logs),/internal_fixture/);
  await assert.rejects(db.query("delete from neo_private.operations_audit"),{code:'42501'});
  assert.deepEqual((await ops('routines')).jobs,[]);
  assert.equal((await ops('routines')).source_available,false);
  await as(admin,'postgres');
  await db.exec(`create schema cron;
   create table cron.job(jobid int,jobname text,schedule text,active boolean);
   create table cron.job_run_details(jobid int,start_time timestamptz,end_time timestamptz,status text,return_message text);
   insert into cron.job values (1,'neo-test-run','*/5 * * * *',true),(2,'private-fixture','* * * * *',true);
   insert into cron.job_run_details values (1,now()-interval '1 minute',now()-interval '59 seconds','succeeded','não expor');
  `);
  await as(admin);
  const routines=await ops('routines');
  assert.equal(routines.source_available,true);
  assert.equal(routines.jobs.length,1);
  assert.equal(routines.jobs[0].last_status,'succeeded');
  assert.equal(routines.jobs[0].last_seconds,1);
  assert.doesNotMatch(JSON.stringify(routines),/não expor/);
  assert.deepEqual((await ops('insights')).recommendations,[]);
  await as(admin,'postgres');
  await db.exec(`insert into auth.users(id,created_at)
   select md5('person'||n)::uuid,(date_trunc('week',current_date::timestamp)::date-7+case when n<=5 then -28 else 0 end)::timestamp at time zone 'UTC'
   from generate_series(1,10)n;
   insert into neo_private.audience_observations select id,now()+interval '10 days',true,'{"os":"iOS","browser":"Safari"}' from auth.users;
   insert into neo_private.engagement_events
   select id,md5(id::text||d)::uuid,created_at+d*interval '1 day'+interval '1 hour','home_view'
   from auth.users cross join unnest(array[0,1,7,30]) d where created_at+d*interval '1 day'+interval '1 hour'<now();
   insert into neo_private.engagement_events
   select id,md5(id::text||'first')::uuid,created_at+interval '2 hour','calculator_view' from auth.users;
   insert into neo_private.system_monitor_snapshots values
    (current_date-10,'{"storage_bytes":100,"storage_objects":1,"storage_sized_objects":1}'),
    (current_date-5,'{"storage_bytes":110,"storage_objects":1,"storage_sized_objects":1}'),
    (current_date,'{"storage_bytes":150,"storage_objects":1,"storage_sized_objects":1}');`);
  const observers=(await db.query('select id from auth.users order by id limit 5')).rows;
  for(const {id} of observers){
   await as(id);
   for(let repeat=0;repeat<2;repeat++){
    assert.equal((await db.query("select public.neo_quality_observe('javascript_error',null,'123456789abc') v")).rows[0].v,true);
   }
  }
  await as(admin);
  const quality=await ops('quality');
  assert.equal(quality.metrics[0].samples,5);
  assert.ok(quality.segments.some(x=>x.kind==='Versão'));
  const journeys=await ops('journeys',90);
  assert.equal(journeys.cohorts.length,2);
  assert.equal(journeys.cohorts[0].d30,100);
  assert.equal(journeys.cohorts[1].d30,null);
  assert.equal(journeys.cohorts[1].d1,100);
  assert.ok(journeys.milestones.some(x=>x.label==='Calculadora'&&x.reached===10));
  const recommendation=(await ops('insights')).recommendations[0];
  assert.equal(recommendation.rule,'storage_growth');
  await ops('review',30,{rule:recommendation.rule,period:recommendation.evidence_period,state:'resolved'});
  assert.equal((await ops('insights')).recommendations[0].state,'resolved');
  await as(admin,'postgres');
  await db.query('update neo_private.audience_observations set engagement_allowed=false where user_id=$1',[observers[0].id]);
  assert.equal((await db.query('select count(*) n from neo_private.operations_quality where account=$1',[observers[0].id])).rows[0].n,0);
  await as(admin);
  assert.deepEqual((await ops('quality')).metrics,[]);
 }finally{await db.close()}
});
