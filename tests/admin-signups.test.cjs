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
  await db.exec('reset role');
  await db.exec(fs.readFileSync('supabase/migrations/20261121181510_admin_audience.sql','utf8'));
  async function audience(name,args,params=[]){
   return (await db.query(`select public.neo_${name}(${args}) result`,params)).rows[0].result;
  }
  await as(regular);
  await assert.rejects(audience('admin_audience',''),{code:'42501'});
  await assert.rejects(db.query('select * from neo_private.audience_observations'),{code:'42501'});
  const observe=(d,c)=>audience('audience_self',"'observe',$1,$2",[JSON.stringify(d),JSON.stringify(c)]);
  assert.equal((await observe({browser:'Safari'},{utm_source:'ig'})).allowed,false);
  assert.equal((await audience('audience_self',"'allow'")).allowed,true);
  await observe({browser:'Safari',os:'iOS',category:'mobile',major:'18',context:'pwa',ip:'203.0.113.1'},
   {referrer:'Instagram',utm_source:'ig',utm_campaign:'lancamento',utm_term:'pessoa@example.invalid'});
  await observe({browser:'Edge',os:'Windows',category:'desktop',context:'browser'},{utm_source:'newsletter'});
  const own=await audience('audience_self',"'export'");
  assert.equal(own.first_device.os,'iOS');
  assert.equal(own.last_device.os,'Windows');
  assert.equal(own.first_campaign.utm_source,'ig');
  assert.equal(own.last_campaign.utm_source,'newsletter');
  assert.equal(own.first_device.ip,undefined);
  assert.equal(own.first_campaign.utm_term,undefined);
  await as(adminA);
  const stats=await audience('admin_audience','');
  assert.equal(stats.today,2502);
  assert.equal(stats.groups.length,0);
  assert.equal((await audience('admin_audience','p_users=>$1',[[regular]]))[regular].last_device.os,'Windows');
  await as(regular);
  assert.equal((await audience('audience_self',"'remove'")).allowed,false);
  assert.equal((await audience('audience_self',"'export'")).allowed,false);
  await db.exec('reset role');
  await db.exec(fs.readFileSync('supabase/migrations/20261121183535_product_engagement.sql','utf8'));
  const members=(await db.query("select md5('fixture'||n)::uuid id from generate_series(1,5)n")).rows;
  const events=['evolution_view','weight_record_started','weight_record_created','active_time'];
  for(const {id} of members){
   await as(id);
   const send=(action,payload=[])=>audience('engagement','$1,$2',[action,JSON.stringify(payload)]);
   const session=crypto.randomUUID();
   const batch=events.map((event,i)=>({id:crypto.randomUUID(),session_id:session,sequence:i+1,
    occurred_at:new Date().toISOString(),area:'evolucao',event,seconds:event==='active_time'?12:0,unwanted:'private fixture'}));
   assert.equal((await send('record',batch)).allowed,false);
   await audience('audience_self',"'allow'");
   assert.equal((await send('status')).allowed,false);
   assert.equal((await send('enable')).allowed,true);
   assert.equal((await send('record',[...batch,{...batch[0],id:crypto.randomUUID(),event:'unknown'}])).accepted,4);
   assert.equal((await send('record',batch)).accepted,0);
   await assert.rejects(audience('admin_engagement',''),{code:'42501'});
  }
  await as(adminA);
  const report=await audience('admin_engagement',"p_area=>'evolucao'");
  assert.equal(report.users,5);
  assert.equal(report.sessions,5);
  assert.equal(report.mean,12);
  assert.equal(report.median,12);
  assert.equal(report.ranking[0].users,5);
  assert.equal(report.ranking[0].active,60);
  assert.deepEqual(report.funnels[0].counts.slice(0,3),[5,5,5]);
  assert.ok(report.actions.every(event=>event.event!=='active_time'));
  assert.doesNotMatch(JSON.stringify(report),/private fixture/);
  await as(members[0].id);
  await audience('engagement',"'disable'");
  await as(adminA);
  const redacted=await audience('admin_engagement','');
  assert.equal(redacted.users,4);
  assert.deepEqual(redacted.ranking,[]);
  assert.deepEqual(redacted.funnels,[]);
  await db.exec("reset role");
  await db.query(`insert into neo_private.engagement_events(account,id,session_id,occurred_at,sequence,area,event,seconds)
   select $1,md5('event'||n)::uuid,md5('session'||n)::uuid,now(),1,'evolucao','evolution_view',0
   from generate_series(1,5000)n`,[members[1].id]);
  await as(adminA);
  const volume=await audience('admin_engagement','');
  assert.equal(volume.users,4);
  assert.equal(volume.sessions,5004);
 }finally{await db.close()}
});
