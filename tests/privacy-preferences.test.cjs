const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');
const {PGlite}=require('@electric-sql/pglite');

const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const migration=name=>readFileSync('supabase/migrations/'+name+'.sql','utf8');
function functionSql(source,name){
 const start=source.indexOf('create function public.'+name+'(');
 assert.notEqual(start,-1);
 return source.slice(start,source.indexOf('end $$;',start)+7);
}

test('consentimentos independentes, etapa por conta e histórico de revogação no banco',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon;create role authenticated;create role service_role;
   create schema auth;create schema neo_private;
   create table auth.users(id uuid primary key);
   insert into auth.users values('${alice}'),('${bob}');
   create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table public.neo_consents(user_id uuid,purpose text,version text default '2026-11-v1',
    granted boolean,changed_at timestamptz,primary key(user_id,purpose,version));
   create table public.neo_consent_events(user_id uuid,purpose text,version text,granted boolean);
   create table public.neo_profiles(user_id uuid primary key,data jsonb);
   create table neo_private.account_geo(user_id uuid primary key);
   create table neo_private.campaign_push_opt_in(user_id uuid primary key);
   create table neo_private.campaign_push_delivery(device_id uuid,outcome text);
   create table neo_private.push_devices(id uuid,user_id uuid);
   create function public.neo_has_consent(text) returns boolean language sql as
    $$select exists (select 1 from public.neo_consents where user_id=auth.uid() and purpose=$1 and granted)$$;
   create function public.neo_valid_profile(jsonb) returns boolean language sql as $$select true$$;
   create function public.neo_number(jsonb,text,numeric,numeric) returns boolean language sql as $$select true$$;
   create function neo_private.take_limit(text,integer,integer) returns boolean language sql as $$select true$$;
  `);
  await db.exec(migration('20261121181510_admin_audience'));
  await db.exec(migration('20261121183535_product_engagement'));
  await db.exec(migration('20261121190211_admin_operations'));
  await db.exec(functionSql(migration('20261121195245_campaign_push'),'neo_campaign_push_preference'));
  await db.exec(functionSql(migration('20261121192900_staging_audit_hardening'),'neo_geo_control'));
  await db.exec(`
   insert into public.neo_consents(user_id,purpose,granted) values('${bob}','health',true),('${bob}','terms',true);
   insert into neo_private.audience_observations(user_id,expires_at,engagement_allowed) values('${bob}',now()+interval '45 days',true);
  `);
  await db.exec(migration('20261123190000_privacy_preferences'));
  const as=async (user,role='authenticated')=>{
   await db.exec('reset role');
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
   await db.exec('set role '+role);
  };
  const value=async (sql,params)=>(await db.query(sql,params)).rows[0].v;
  const preferences=(choices=null,complete=false)=>value('select public.neo_privacy_preferences($1,$2) v',[choices,complete]);
  const defaults={pending:false,statistics:false,usage:false,campaigns:false,location:false};
  const onboard=()=>db.query('select public.neo_complete_onboarding($1,$2,true,true)',[
   {tracking:{weight:true,measures:true,journal:true,photos:false,applications:true}},{}
  ]);

  await as('', 'anon');
  await assert.rejects(preferences(),{code:'42501'});
  await as(alice);
  assert.deepEqual(await preferences(),defaults);
  await assert.rejects(preferences({statistics:true,campaigns:true}),{code:'42501'});
  assert.deepEqual(await preferences(),defaults);
  await onboard();
  assert.deepEqual(await preferences(),{...defaults,pending:true});
  assert.deepEqual(await preferences(null,true),defaults);
  await onboard();
  assert.deepEqual(await preferences(),defaults);

  assert.deepEqual(await preferences({usage:true}),{...defaults,usage:true});
  assert.equal((await value("select public.neo_audience_self('observe',jsonb_build_object('category','mobile')) v")).allowed,false);
  const event={id:alice,session_id:alice,area:'inicio',event:'home_view',sequence:1,occurred_at:new Date().toISOString()};
  assert.equal((await value("select public.neo_engagement('record',$1) v",[[event]])).accepted,1);
  assert.equal(await value("select public.neo_quality_observe('javascript_error') v"),true);
  assert.deepEqual(await preferences({statistics:true,campaigns:true,location:true}),{
   ...defaults,statistics:true,usage:true,campaigns:true,location:true
  });
  assert.deepEqual(await preferences({statistics:false,campaigns:false}),{...defaults,usage:true,location:true});
  await assert.rejects(preferences({usage:false,unknown:true}),{code:'22023'});
  assert.deepEqual(await preferences(),{...defaults,usage:true,location:true});
  assert.deepEqual(await preferences({statistics:true,usage:false,location:false}),{...defaults,statistics:true});
  assert.equal((await value("select public.neo_engagement('record',$1) v",[[event]])).accepted,0);
  await assert.rejects(db.exec('select * from neo_private.privacy_setup'),{code:'42501'});

  await as(bob);
  assert.deepEqual(await preferences(),{...defaults,statistics:true,usage:true});
  await onboard();
  assert.equal((await preferences()).pending,false);
  await as('', 'postgres');
  assert.equal(await value('select count(*)::int v from neo_private.engagement_events where account=$1',[alice]),0);
  assert.equal(await value('select count(*)::int v from neo_private.operations_quality where account=$1',[alice]),0);
  assert.equal(await value("select count(*)::int v from public.neo_consent_events where user_id=$1 and purpose='optional_usage' and not granted",[alice]),1);
  const expiry=await value('select engagement_expires_at=expires_at v from neo_private.audience_observations where user_id=$1',[bob]);
  assert.equal(expiry,true);
 }finally{await db.close();}
});

test('permissão nativa de campanhas exige ação, respeita recusa e não ativa notificações essenciais',async()=>{
 const {window}=parseHTML('<html><body></body></html>');
 const requests=[];
 const notification={permission:'denied',requestPermission:async()=>{requests.push('native');return 'granted';}};
 window.Notification=notification;
 window.PushManager={};
 window.NEO_CONFIG={pushVapidPublicKey:'a'.repeat(87)};
 window.NeoCloud={user:{id:alice},pushDevice:async()=>requests.push('device'),communityActivity:async()=>requests.push('essential')};
 const navigator={userAgent:'iPhone',standalone:false,serviceWorker:{
  getRegistration:async()=>({active:true,update:async()=>{},pushManager:{getSubscription:async()=>null}})
 }};
 const ctx=vm.createContext({window,document:window.document,navigator,Notification:notification,
  matchMedia:()=>({matches:false}),setTimeout:()=>0,setInterval:()=>0});
 vm.runInContext(readFileSync('dist/push.js','utf8'),ctx);
 assert.match(await window.NeoPush.requestPermission(),/bloqueadas/);
 notification.permission='default';
 assert.match(await window.NeoPush.requestPermission(),/ícone da tela inicial/);
 assert.deepEqual(requests,[]);
 navigator.standalone=true;
 assert.match(await window.NeoPush.requestPermission(),/Lembretes/);
 assert.deepEqual(requests,['native']);
});

test('consulta nativa pede localização aproximada e descarta as coordenadas',async()=>{
 const app=readFileSync('src/app.js','utf8');
 const source=app.slice(app.indexOf('function requestDeviceLocation()'),app.indexOf('function mountPrivacyPreferences()'));
 const native=async geolocation=>vm.runInNewContext(source+'\nrequestDeviceLocation()',{
  navigator:{geolocation},setTimeout,clearTimeout
 });
 let calls=0;
 assert.equal(await native({getCurrentPosition(success,_error,options){
  calls++;
  assert.equal(options.enableHighAccuracy,false);
  assert.equal(options.timeout,8000);
  success({coords:{get latitude(){throw Error('Coordenadas não devem ser lidas');}}});
 }}),true);
 assert.equal(calls,1);
 assert.equal(await native({getCurrentPosition(_success,error){error({code:1});}}),false);
 assert.equal(await native(undefined),false);
});

test('personalização registra decisão versionada, data, revogação e isolamento por conta',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role authenticated;create role anon;create schema auth;create schema neo_private;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function public.neo_has_consent(text) returns boolean language sql stable as $$select auth.uid() is not null and $1='terms'$$;
   create function neo_private.take_limit(text,integer,integer) returns boolean language sql as $$select true$$;
   create table public.neo_consent_events(
    id bigint generated always as identity primary key,user_id uuid not null,purpose text not null,
    version text not null,granted boolean not null,changed_at timestamptz not null default now());
   grant usage on schema auth to authenticated;
   alter table public.neo_consent_events enable row level security;
   create policy own_events on public.neo_consent_events for select to authenticated using(user_id=auth.uid());
   grant select on public.neo_consent_events to authenticated;
  `);
  const sql=migration('20261124150000_personalization_consent');
  await db.exec(sql);await db.exec(sql);
  const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  const rpc=async(value=null)=>(await db.query('select neo_personalization_consent($1) as d',[value])).rows[0].d;
  await db.exec('set role anon');await assert.rejects(rpc(),{code:'42501'});
  await as(alice);
  assert.deepEqual(await rpc(),{purpose:'optional_personalization',version:'2026-11-personalization-v1',decided:false,granted:false,changed_at:null});
  const allowed=await rpc(true);
  assert.equal(allowed.granted,true);assert.ok(Number.isFinite(Date.parse(allowed.changed_at)));
  assert.deepEqual(await rpc(true),allowed);
  await as(bob);assert.equal((await rpc()).decided,false);
  await rpc(false);assert.equal((await rpc()).granted,false);
  const ledger=()=>db.query('select purpose,granted from public.neo_consent_events order by id').then(r=>r.rows);
  assert.deepEqual(await ledger(),[{purpose:'optional_personalization',granted:false}]);
  await as(alice);assert.equal((await rpc()).granted,true);
  await rpc(false);assert.equal((await rpc()).granted,false);
  assert.deepEqual(await ledger(),[{purpose:'optional_personalization',granted:true},{purpose:'optional_personalization',granted:false}]);
  await assert.rejects(db.query('update public.neo_consent_events set granted=true'),{code:'42501'});
 }finally{await db.close();}
});
