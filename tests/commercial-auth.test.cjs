'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const core=require('../dist/core.js');

const code=fs.readFileSync('src/cloud.js','utf8').replace(/^import .*\n/gm,'');
const owner='11111111-0000-4000-8000-000000000001';
const other='11111111-0000-4000-8000-000000000002';

async function setup({origin='http://localhost:4173',url='http://localhost:54321',enabled=true,
 account={id:owner},admin=false,complete=false,storage=new Map(),captchaRequired=false}={}){
 const calls=[];
 let callback,respondCommercial;
 const config={commercialPreview:enabled,supabaseUrl:url,supabasePublishableKey:'sb_publishable_syntheticexample',authRedirectPath:'/neo/',providers:{email:true},captchaRequired};
 const location=new URL(origin+'/tests/fixtures/shop-public/?loja=1#loja');
 const redirects=[];
 location.assign=href=>redirects.push(href);
 const storageAPI={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 const profile=complete?{data:{profile:{...core.defaultProfile(),height:175,initialWeight:80,goal:75},settings:core.blank().settings}}:null;
 const consents=complete?['terms','health'].map(purpose=>({purpose,version:'2026-11-v1',granted:true})):[];
 const sdk={
  auth:{
   async signInWithPassword(args){calls.push(['login',args]);return {data:{user:account}};},
   async resetPasswordForEmail(email,options){calls.push(['reset',{email,options}]);return {data:{}};},
   onAuthStateChange(fn){callback=fn;},
   async getSession(){return {data:{session:account?{user:account}:null}};},
   async getUser(){return {data:{user:account}};}
  },
  from(table){
   const result={data:table==='neo_consents'?consents:[]};
   const query={select:()=>query,eq:()=>query,order:()=>query,
    maybeSingle:async()=>({data:profile}),range:async()=>result,then(fn){return Promise.resolve(result).then(fn);}};
   return query;
  },
  async rpc(name,payload){
   calls.push([name,payload]);
   if(name==='neo_admin_access')return {data:admin};
   if(name==='neo_vial_diary'||name==='neo_manage_commercial_account')return {data:null};
   if(name==='neo_commercial_account'){
    if(respondCommercial)return respondCommercial();
    return {data:{id:account.id,commercialComplete:true,privateField:'fixture must not be returned'}};
   }
   throw Error('RPC inesperada '+name);
  }
 };
 const window={NEO_CONFIG:config,NeoCore:core};
 vm.runInNewContext(code,{window,createClient:()=>sdk,location,URL,setTimeout,
  localStorage:storageAPI,sessionStorage:storageAPI});
 const cloud=window.NeoCloud;
 await cloud.init(()=>{});
 return {cloud,calls,location,redirects,storage,change:id=>{account=id?{id}:null;callback('SIGNED_IN',account?{user:account}:null);},
  respond:fn=>{respondCommercial=fn;}};
}

test('commercial bridge only runs with app and Supabase on loopback and an explicit flag',async()=>{
 for(const options of [{origin:'https://app.neopep.com.br'},{url:'https://example.supabase.co'},{enabled:false}]){
  const s=await setup(options);
  assert.equal(s.cloud.commercialPreview,false);
  await assert.rejects(s.cloud.commercialAccount(),/indisponível/);
  assert.equal(await s.cloud.consumeCommercialOnboarding(),false);
  assert.deepEqual(s.calls,[]);
 }
});

test('commercial handoff uses the same initialized session, returns once and rejects a mismatched account',async()=>{
 const s=await setup();
 await assert.rejects(s.cloud.commercialAccount(),/Aguarde/);
 await s.cloud.load();
 assert.deepEqual({...await s.cloud.commercialAccount()},{id:owner,commercialComplete:true,onboardingComplete:false});
 await assert.rejects(s.cloud.openCommercialOnboarding(other),/A conta mudou/);
 assert.deepEqual(s.redirects,[]);
 await s.cloud.openCommercialOnboarding(owner);
 assert.deepEqual(s.redirects,['http://localhost:4173/#onboarding']);
 s.location.href=s.redirects[0];
 assert.equal(await s.cloud.consumeCommercialOnboarding(),true);
 assert.equal(await s.cloud.consumeCommercialOnboarding(),false);
 await s.cloud.openCommercialOnboarding(owner);
 s.change(other);
 assert.equal(await s.cloud.consumeCommercialOnboarding(),false);
});

test('a stale RPC cannot bind enrollment to a new session and completed onboarding stays on the app',async()=>{
 const s=await setup();
 await s.cloud.load();
 let finish;
 s.respond(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=s.cloud.commercialAccount();
 s.change(other);
 finish({data:{id:owner,commercialComplete:true}});
 await assert.rejects(pending,/A conta mudou/);
 const complete=await setup({complete:true});
 await complete.cloud.load();
 assert.equal((await complete.cloud.commercialAccount()).onboardingComplete,true);
 await assert.rejects(complete.cloud.openCommercialOnboarding(owner),/A conta mudou/);
});

test('administrative client uses the existing role and delegates the enrollment write to RPC',async()=>{
 const regular=await setup();
 await regular.cloud.load();
 await assert.rejects(regular.cloud.manageCommercialAccount(other,true),/Autorização/);
 assert.equal(regular.calls.some(([name])=>name==='neo_manage_commercial_account'),false);
 const admin=await setup({admin:true});
 await admin.cloud.load();
 await admin.cloud.manageCommercialAccount(other,false);
 const [name,args]=admin.calls.at(-1);
 assert.equal(name,'neo_manage_commercial_account');
 assert.deepEqual({...args},{p_user:other,p_enrolled:false});
});

test('app restoration sends only an authorized local intent to the original onboarding screen',async()=>{
 const app=fs.readFileSync('src/app.js','utf8');
 const authChanged=app.split('\n').find(line=>line.startsWith('async function authChanged('));
 assert.ok(authChanged);
 for(const [flags,expected] of [
  [{commercialPreview:true,approved:true},'onboarding'],
  [{commercialPreview:true,approved:false},'preparar'],
  [{commercialPreview:false,approved:true},'preparar'],
  [{commercialPreview:true,approved:true,onboardingComplete:true},'existing-destination']
 ]){
  const visits=[];
  let reads=0;
  const user={id:owner};
  const sandbox={suppressAuth:false,demo:false,mode:'local',signedInAccountId:null,recoveryFlow:false,
   arrivalReady:false,arrivalWelcomeStarted:false,loadGeneration:0,window:{},C:core,URL,
   location:{href:'http://localhost:4173/#onboarding'},state:null,
   Cloud:{user,...flags,async consumeCommercialOnboarding(){reads++;return flags.approved;}},
   resetRecordView(){},resetDailyVisit(){},clearPhotoURLs(){},render(){},
   reloadCloud:async()=>{},go:async page=>visits.push(page),
   openAccountDestination:async()=>visits.push('existing-destination'),toast:message=>assert.fail(message)};
  await vm.runInNewContext(authChanged+"\nauthChanged('INITIAL_SESSION',Cloud.user)",sandbox);
  assert.deepEqual(visits,[expected]);
  assert.equal(reads,flags.commercialPreview&&!flags.onboardingComplete?1:0);
 }
});

test('CAPTCHA gate and callback context are scoped to the approved local destination',async()=>{
 const s=await setup({captchaRequired:true});
 s.location.href='http://localhost:4173/?produto='+owner+'&status=approved&next=https://example.test#loja';
 await assert.rejects(s.cloud.email('login','fixture@example.test','synthetic',null),/verificação/);
 await assert.rejects(s.cloud.email('reset','fixture@example.test',null,null),/verificação/);
 assert.deepEqual(s.calls,[]);
 await s.cloud.email('login','fixture@example.test','synthetic',null,{captchaToken:'fixture-token'});
 assert.equal(s.calls.at(-1)[1].options.captchaToken,'fixture-token');
 await s.cloud.email('reset','fixture@example.test',null,null,{captchaToken:'fixture-token'});
 assert.equal(s.calls.at(-1)[1].options.redirectTo,'http://localhost:4173/neo/?produto='+owner+'#loja');
 const original=await setup({origin:'https://app.neopep.com.br',url:'https://example.supabase.co'});
 original.location.href='https://app.neopep.com.br/?loja=1#loja';
 await original.cloud.email('reset','fixture@example.test',null,null);
 assert.equal(original.calls.at(-1)[1].options.redirectTo,'https://app.neopep.com.br/neo/');
});

test('local onboarding handoff expires and rejects malformed or future navigation markers',async()=>{
 const s=await setup();
 await s.cloud.load();
 await s.cloud.openCommercialOnboarding(owner);
 s.location.href=s.redirects[0];
 const key='neo-commercial-onboarding';
 for(const raw of [owner,'null','{}',JSON.stringify({id:owner,createdAt:Date.now()+60000}),JSON.stringify({id:owner,createdAt:Date.now()-600001})]){
  s.storage.set(key,raw);
  assert.equal(await s.cloud.consumeCommercialOnboarding(),false);
  assert.equal(s.storage.has(key),false);
 }
 await s.cloud.openCommercialOnboarding(owner);
 assert.equal(await s.cloud.consumeCommercialOnboarding(),true);
 assert.equal(await s.cloud.consumeCommercialOnboarding(),false);
});

test('local handoff refuses a missing account and an account switched during the server check',async()=>{
 const s=await setup();
 await s.cloud.load();
 let resolve;
 s.respond(()=>new Promise(r=>{resolve=r;}));
 const pending=s.cloud.openCommercialOnboarding(owner);
 s.change(other);
 resolve({data:{id:owner,commercialComplete:true}});
 await assert.rejects(pending,/A conta mudou/);
 assert.equal(s.storage.has('neo-commercial-onboarding'),false);
 assert.deepEqual(s.redirects,[]);
 s.change(null);
 await assert.rejects(s.cloud.openCommercialOnboarding(null),/A conta mudou/);
});

test('local handoff is discarded when the account changes during consumption',async()=>{
 const s=await setup();
 await s.cloud.load();
 await s.cloud.openCommercialOnboarding(owner);
 s.location.href=s.redirects[0];
 let resolve;
 s.respond(()=>new Promise(r=>{resolve=r;}));
 const pending=s.cloud.consumeCommercialOnboarding();
 s.change(other);
 resolve({data:{id:owner,commercialComplete:true}});
 assert.equal(await pending,false);
 assert.equal(s.storage.has('neo-commercial-onboarding'),false);
});
