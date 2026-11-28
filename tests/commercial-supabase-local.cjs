'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const core=require('../dist/core.js');

function localURL(name){
 const url=new URL(process.env[name]);
 assert.equal(url.protocol,'http:');
 assert.equal(url.hostname,'127.0.0.1');
 return url.origin;
}
const auth=localURL('NEOPEP_AUTH_URL'),rest=localURL('NEOPEP_REST_URL'),mail=localURL('NEOPEP_MAIL_URL');
const db=process.env.NEOPEP_DB_CONTAINER;
assert.match(db,/^neopep-commercial-[0-9]+-db$/);
function sql(input){
 return execFileSync('docker',['exec','-i',db,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'],
  {input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
}
const base='http://127.0.0.1:4173';
const gateway='http://127.0.0.1:54321';
const key='sb_publishable_isolated_neopep_fixture';
const photoPath='fixture/caderno.png';
const photoBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPwQAAAAASUVORK5CYII=','base64');
async function fixtureStorage(url,init){
 const expected='/storage/v1/object/neo-shop-products/'+photoPath;
 if(url.pathname!==expected||url.search)return new Response('{}',{status:404});
 const headers=new Headers(init?.headers);
 if(headers.get('authorization')==='Bearer '+key)headers.delete('authorization');
 headers.set('content-type','application/json');
 const allowed=await fetch(rest+'/rpc/neo_shop_photo',{method:'POST',headers,body:JSON.stringify({p_path:photoPath})});
 if(!allowed.ok||await allowed.json()!==true)return new Response('{}',{status:403});
 return new Response(photoBytes,{headers:{'content-type':'image/png','cache-control':'no-store'}});
}
async function request(input,init){
 const url=new URL(input);
 assert.equal(url.origin,gateway);
 if(url.pathname.startsWith('/auth/v1/'))return fetch(auth+url.pathname.slice('/auth/v1'.length)+url.search,init);
 if(url.pathname.startsWith('/rest/v1/')){
  const headers=new Headers(init?.headers);
  if(headers.get('authorization')==='Bearer '+key)headers.delete('authorization');
  return fetch(rest+url.pathname.slice('/rest/v1'.length)+url.search,{...init,headers});
 }
 if(url.pathname.startsWith('/storage/v1/'))return fixtureStorage(url,init);
 throw Error('Serviço fora da instância isolada');
}
function storage(){
 const values=new Map();
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}
const source=fs.readFileSync('src/cloud.js','utf8').replace(/^import .*\n/gm,'');
function app(tab,local=storage()){
 const window={NEO_CONFIG:{supabaseUrl:gateway,supabasePublishableKey:key,commercialPreview:true,previewRegistration:true,authRedirectPath:'/neo/',providers:{email:true}},NeoCore:core,localStorage:local,sessionStorage:tab};
 const location=new URL(base+'/?loja=1#loja');
 const redirects=[];
 let sdk;
 location.assign=href=>redirects.push(href);
 vm.runInNewContext(source,{window,location,URL,setTimeout,localStorage:local,sessionStorage:tab,
  createClient:(url,publishable,options)=>{
   sdk=createClient(url,publishable,{...options,auth:{...options.auth,autoRefreshToken:false},global:{fetch:request}});
   return sdk;
  }});
 return {cloud:window.NeoCloud,location,redirects,local,get sdk(){return sdk;}};
}
const ok=result=>{
 if(result.error)throw result.error;
 return result.data;
};
async function mailCallback(email,type){
 for(let attempt=0;attempt<30;attempt++){
  const listed=await fetch(mail+'/api/v1/search?query='+encodeURIComponent('to:'+email));
  if(!listed.ok)throw Error('Caixa de e-mail isolada indisponível');
  for(const entry of (await listed.json()).messages||[]){
   const response=await fetch(mail+'/api/v1/message/'+entry.ID);
   const message=await response.json();
   const links=String(message.HTML||message.Text).replaceAll('&amp;','&').match(/http[^\s"'<>]+/g)||[];
   for(const href of links){
    const verify=new URL(href);
    if(verify.pathname!=='/verify'||verify.searchParams.get('type')!==type)continue;
    const res=await fetch(auth+verify.pathname+verify.search,{redirect:'manual'});
    const target=new URL(res.headers.get('location'));
    assert.equal(target.origin,base);
    assert.ok(target.searchParams.get('code'));
    return target;
   }
  }
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error('Mensagem sintética não recebida');
}
async function account(label){
 const tab=storage();
 const opened=app(tab);
 await opened.cloud.init(()=>{});
 const productID='11111111-0000-4000-8000-000000000001';
 if(label==='cliente')opened.location.href=base+'/?produto='+productID+'#loja';
 const email=label+'@example.test',password=randomBytes(20).toString('hex');
 const created=await opened.cloud.email('signup',email,password,'Conta fictícia',{remember:false});
 assert.equal(created.session,null);
 await assert.rejects(opened.cloud.email('login',email,password,null,{remember:false}),/confirm/i);
 const callback=await mailCallback(email,'signup');
 assert.equal(callback.pathname,'/neo/');
 assert.equal(callback.hash,'#loja');
 if(label==='cliente')assert.equal(callback.searchParams.get('produto'),productID);
 else assert.equal(callback.searchParams.get('loja'),'1');
 const confirmed=ok(await opened.sdk.auth.exchangeCodeForSession(callback.searchParams.get('code')));
 const id=created.user.id;
 assert.equal(confirmed.user.id,id);
 assert.match(id,/^[0-9a-f-]{36}$/);
 await opened.cloud.logout();
 const signed=await opened.cloud.email('login',email,password,null,{remember:false});
 assert.equal(signed.user.id,id);
 await opened.cloud.load();
 return {id,tab,...opened,sdk:opened.sdk};
}
(async()=>{
 const admin=await account('admin'),client=await account('cliente'),another=await account('outra');
 const anon=createClient(gateway,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:request}});
 assert.equal((await anon.rpc('neo_commercial_account')).error?.code,'42501');
 assert.equal((await anon.rpc('neo_shop_photo',{p_path:'fixture/private.jpg'})).error?.code,'42501');
 assert.equal((await client.sdk.rpc('neo_manage_commercial_account',{p_user:client.id,p_enrolled:true})).error?.code,'42501');
 assert.ok((await client.sdk.schema('neo_private').from('shop_commercial_accounts').select('*')).error);
 sql("insert into neo_private.admin_members(user_id) values ('"+admin.id+"');");
 await admin.cloud.load();
 await admin.cloud.manageCommercialAccount(client.id,true);
 assert.deepEqual({...await client.cloud.commercialAccount()},{id:client.id,commercialComplete:true,onboardingComplete:false});
 assert.deepEqual({...await another.cloud.commercialAccount()},{id:another.id,commercialComplete:false,onboardingComplete:false});
 assert.equal(ok(await client.sdk.rpc('neo_admin_access')),false);
 assert.equal(ok(await client.sdk.rpc('neo_shop_photo',{p_path:'fixture/private.jpg'})),false);
 assert.equal(ok(await client.sdk.rpc('neo_has_consent',{p_purpose:'health'})),false);
 const photo=photoPath;
 const item=sql(`insert into neo_private.shop_photos(path,user_id) values ('${photo}','${admin.id}');
  insert into storage.objects(id,name,bucket_id) values (gen_random_uuid(),'${photo}','neo-shop-products');
  insert into neo_private.shop_products(name,description,category,price_cents,stock,active,photo_path)
   values ('Caderno fictício','Item de teste','Papelaria',1800,1,true,'${photo}') returning id;`);
 assert.match(item,/^[0-9a-f-]{36}$/);
 const shop=(sdk,action,payload)=>sdk.rpc('neo_shop',{p_action:action,p_payload:payload});
 assert.ok((await shop(client.sdk,'visibility_mode',{product_id:item,mode:'allowlist'})).error);
 ok(await shop(admin.sdk,'visibility_mode',{product_id:item,mode:'allowlist'}));
 ok(await shop(admin.sdk,'visibility_set',{product_id:item,list:'allowlist',user_id:client.id,selected:true}));
 assert.equal(ok(await client.sdk.rpc('neo_shop_photo',{p_path:photo})),true);
 assert.equal(ok(await another.sdk.rpc('neo_shop_photo',{p_path:photo})),false);
 const rowsFor=id=>sql(`set role authenticated;
  set request.jwt.claims = '{"sub":"${id}"}';
  select count(*) from storage.objects where name='${photo}';`);
 assert.equal(rowsFor(client.id),'1');
 assert.equal(rowsFor(another.id),'0');
 assert.equal(sql("select public from storage.buckets where id='neo-shop-products'"),'f');
 const image=await client.sdk.storage.from('neo-shop-products').download(photo);
 assert.deepEqual(Buffer.from(await ok(image).arrayBuffer()),photoBytes);
 assert.ok((await anon.storage.from('neo-shop-products').download(photo)).error);
 assert.ok((await another.sdk.storage.from('neo-shop-products').download(photo)).error);
 assert.ok((await client.sdk.storage.from('neo-shop-products').download('fixture/outro.png')).error);
 ok(await shop(admin.sdk,'visibility_set',{product_id:item,list:'allowlist',user_id:client.id,selected:false}));
 assert.equal(rowsFor(client.id),'0');
 assert.ok((await client.sdk.storage.from('neo-shop-products').download(photo)).error);

 const rollback=fs.readFileSync('release/production/rollback/20261128174500_shop_commercial_accounts.sql','utf8');
 assert.throws(()=>sql(rollback),error=>String(error.stderr).includes('preservar os cadastros'));
 assert.equal((await client.cloud.commercialAccount()).commercialComplete,true);
 await client.cloud.openCommercialOnboarding(client.id);
 assert.deepEqual(client.redirects,[base+'/#onboarding']);
 const restored=app(client.tab,client.local);
 restored.location.href=client.redirects[0];
 assert.equal((await restored.cloud.init(()=>{})).id,client.id);
 await restored.cloud.load();
 assert.equal(await restored.cloud.consumeCommercialOnboarding(),true);
 assert.equal(await restored.cloud.consumeCommercialOnboarding(),false);
 await restored.cloud.onboard({...core.defaultProfile(),name:'Perfil sintético',consent:true,height:175,initialWeight:80,goal:75},
  core.blank().settings,true,true);
 await restored.cloud.load();
 assert.equal(restored.cloud.user.id,client.id);
 assert.equal(restored.cloud.onboardingComplete,true);
 assert.equal((await restored.cloud.commercialAccount()).commercialComplete,true);
 await assert.rejects(restored.cloud.openCommercialOnboarding(client.id),/conta mudou/);
 assert.deepEqual(ok(await another.sdk.from('neo_profiles').select('user_id').eq('user_id',client.id)),[]);
 const email='outra@example.test';
 await another.cloud.logout();
 await another.cloud.email('reset',email,null,null,{remember:false});
 const recovery=await mailCallback(email,'recovery');
 assert.equal(recovery.searchParams.get('loja'),'1');
 const recovering=ok(await another.sdk.auth.exchangeCodeForSession(recovery.searchParams.get('code')));
 assert.equal(recovering.user.id,another.id);
 const password=randomBytes(20).toString('hex');
 await another.cloud.email('newpassword',null,password);
 await another.cloud.logout();
 assert.equal((await another.cloud.email('login',email,password,null,{remember:false})).user.id,another.id);
 await admin.cloud.manageCommercialAccount(client.id,false);
 assert.equal((await restored.cloud.commercialAccount()).commercialComplete,false);
 console.log('Auth, isolamento, administração e onboarding validados com contas sintéticas.');
})().catch(error=>{console.error(error.stack||error.message||error);process.exitCode=1;});
