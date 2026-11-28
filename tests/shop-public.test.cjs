'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');

const first = '11111111-0000-4000-8000-000000000001';
const second = '11111111-0000-4000-8000-000000000002';
const restricted = '11111111-0000-4000-8000-000000000003';
const closed = '11111111-0000-4000-8000-000000000004';
const product = {id:first, name:'Caderno pautado', description:'<script>alert(1)</script>',
 category:'Papelaria', price_cents:1800, active:true, available:true, publicEligible:true, restricted:false,
 photos:['/tests/fixtures/shop-public/caderno.jpg','https://externo.example/caderno.jpg','/private/caderno.jpg','/tests/fixtures/shop-public/capa.jpg'],
 offer:{price_cents:1500,valid_until:'2099-01-01'},cost_cents:99999, supplier:'Fornecedor privado'};
const data = [product,
 {...product,id:second,name:'Caneca',category:'Casa',available:false,offer:null},
 {...product,id:restricted,name:'Item privado',restricted:true},
 {...product,id:closed,name:'Item desativado',active:false}];

function boot(url='http://localhost/?loja=1#loja'){
 const {window} = parseHTML('<html><body><main></main></body></html>');
 const {document} = window;
 const root = document.querySelector('main');
 const storage = new Map();
 const localStorage = {getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
 const location = new URL(url);
 const history = {pushState:(_state,_title,next)=>location.href=String(next)};
 const navigator = {userAgent:'Android Chrome/130'};
 window.matchMedia=()=>({matches:false,addEventListener(){}});
 window.NeoCore=require('../dist/core.js');
 window.NeoShopCore=require('../dist/shop-core.js');
 window.NeoCloud={shop(){throw new Error('A prévia não deve chamar a loja interna');}};
 const sandbox = vm.createContext({window,document,navigator,location,history,URL,localStorage,
  sessionStorage:{getItem:()=>null},Event:window.Event,setInterval:()=>0});
 for(const file of ['appearance','shop','shop-public','install']){
  vm.runInContext(fs.readFileSync('dist/'+file+'.js','utf8'),sandbox);
 }
 let transitions=0;
 const account={id:'synthetic',commercialComplete:true,onboardingComplete:false};
 const options = {rows:data,register:async()=>account,readAccount:async()=>account,
  openApp:id=>{assert.equal(id,account.id);transitions++;}};
 return {window,document,root,location,storage,install:window.NeoInstall,shop:window.NeoPublicShop,
  mount:(overrides={})=>window.NeoPublicShop.mount(root,{...options,...overrides}),
  click:selector=>root.querySelector(selector).dispatchEvent(new window.Event('click',{bubbles:true})),
  transitions:()=>transitions};
}

test('public routes preserve the existing product URL and validate context independently',()=>{
 const b=boot();
 assert.equal(b.shop.route(new URL('http://localhost/?produto='+first+'#loja')).product,first);
 for(const path of ['/?produto=qualquer#loja','/?loja=1#perfil','/?loja=1&produto=#loja','/?loja=2#loja']){
  assert.equal(b.shop.route(new URL(path,b.location)),null);
 }
 assert.equal(b.shop.context(null),'visitor');
 assert.equal(b.shop.context({id:'synthetic',onboardingComplete:false,commercialComplete:true}),'commercial');
 assert.equal(b.shop.context({id:'synthetic',onboardingComplete:true,commercialComplete:true}),'app');
 assert.equal(b.shop.context({id:'synthetic',onboardingComplete:false}),'app');
 assert.equal(b.mount({account:{id:'synthetic',onboardingComplete:true}}),null);
 assert.equal(boot('https://app.neopep.com.br/?loja=1#loja').mount(),null);
});

test('synthetic browsing reuses catalogue, offers and gallery while excluding ineligible products',()=>{
 const b=boot();
 const close=b.mount();
 assert.equal(b.root.querySelectorAll('.shop-product').length,2);
 assert.match(b.root.textContent,/OFERTA/);
 assert.doesNotMatch(b.root.innerHTML,/Item privado|Item desativado|Fornecedor privado|99999|externo\.example/);
 b.click('[data-category="Casa"]');
 assert.equal(b.root.querySelectorAll('.shop-product').length,1);
 b.click('[data-category=""]');
 b.click('[data-shop=detail][data-id="'+first+'"]');
 assert.equal(b.location.search,'?produto='+first);
 assert.equal(b.root.querySelectorAll('.shop-gallery-thumb').length,2);
 b.click('[data-index="1"]');
 assert.equal(b.root.querySelector('.shop-detail-photo img').getAttribute('src'),'/tests/fixtures/shop-public/capa.jpg');
 assert.equal(b.root.querySelector('script'),null);
 b.click('[data-shop=buy]');
 assert.match(b.root.querySelector('[role=status]').textContent,/desativadas/);
 b.location.href='http://localhost/?produto='+restricted+'#loja';
 b.window.dispatchEvent(new b.window.Event('popstate'));
 assert.match(b.root.textContent,/Produto indisponível/);
 assert.doesNotMatch(b.root.textContent,/Item privado/);
 b.click('[data-shop=catalog]');
 assert.equal(b.location.search,'?loja=1');
 close();
 assert.equal(b.root.textContent,'');
});

test('commercial signup simulation preserves the product and suppresses PWA prompts only while mounted',async()=>{
 const b=boot('http://localhost/?produto='+first+'#loja');
 assert.equal(b.install.blocking,true);
 b.window.dispatchEvent(new b.window.Event('beforeinstallprompt',{cancelable:true}));
 assert.doesNotMatch(b.install.guide(),/data-install-native hidden/);
 const close=b.mount();
 assert.equal(b.install.blocking,false);
 assert.equal(b.install.guide(),'');
 assert.equal(b.install.screen(),'');
 assert.equal(b.install.loginNotice(),'');
 const prompt=new b.window.Event('beforeinstallprompt',{cancelable:true});
 b.window.dispatchEvent(prompt);
 assert.equal(prompt.defaultPrevented,true);
 b.window.dispatchEvent(new b.window.Event('appinstalled'));
 assert.equal(b.storage.size,0);
 b.click('[data-commercial=register]');
 const form=b.root.querySelector('[data-commercial-register]');
 form.querySelector('[name=consent]').checked=true;
 form.dispatchEvent(new b.window.Event('submit',{bubbles:true,cancelable:true}));
 await new Promise(setImmediate);
 assert.equal(b.location.search,'?produto='+first);
 assert.match(b.root.textContent,/Cadastro fictício concluído/);
 b.click('[data-commercial=app]');
 await new Promise(setImmediate);
 assert.equal(b.transitions(),1);
 close();
 assert.equal(b.install.blocking,true);
 assert.match(b.install.loginNotice(),/Ainda não tem o aplicativo/);
 assert.doesNotMatch(b.install.guide(),/data-install-native hidden/);
});

test('voluntary onboarding rejects a changed account and ignores duplicate clicks',async()=>{
 const b=boot();
 const account={id:'synthetic',commercialComplete:true,onboardingComplete:false};
 let resolveAccount;
 let reads=0;
 b.mount({account,readAccount:()=>{reads++;return new Promise(resolve=>{resolveAccount=resolve;});}});
 b.click('[data-commercial=app]');
 b.click('[data-commercial=app]');
 assert.equal(reads,1);
 resolveAccount({...account,id:'other-synthetic'});
 await new Promise(setImmediate);
 assert.equal(b.transitions(),0);
 assert.match(b.root.querySelector('[role=status]').textContent,/mesma conta/);
 assert.equal(b.install.blocking,false);
});

test('Supabase adapter mounts only a commercial account and delegates handoff with the same identity',async()=>{
 const b=boot();
 const calls=[];
 const account={id:'synthetic-cloud',commercialComplete:true,onboardingComplete:false};
 b.window.NeoCloud={commercialPreview:false,commercialAccount:async()=>{calls.push('read');return account;},
  openCommercialOnboarding:async id=>calls.push(id)};
 assert.equal(await b.shop.mountWithCloud(b.root,data),null);
 assert.deepEqual(calls,[]);
 b.window.NeoCloud.commercialPreview=true;
 const close=await b.shop.mountWithCloud(b.root,data);
 assert.equal(typeof close,'function');
 assert.equal(b.root.querySelector('[data-commercial=register]'),null);
 assert.equal(b.install.blocking,false);
 b.click('[data-commercial=app]');
 await new Promise(setImmediate);
 assert.deepEqual(calls,['read','read',account.id]);
 close();
 assert.equal(b.install.blocking,true);
});

test('local preview adapter never reads a session outside an eligible loopback route',async()=>{
 for(const url of ['https://app.neopep.com.br/?loja=1#loja','http://localhost/?loja=1#perfil']){
  const b=boot(url);
  let reads=0;
  b.window.NeoCloud={commercialPreview:true,commercialAccount:async()=>{reads++;throw Error('Unexpected session read');}};
  assert.equal(await b.shop.mountWithCloud(b.root,data),null);
  assert.equal(reads,0);
 }
});

test('local preview adapter discards a pending session response after context changes',async()=>{
 for(const change of [
  b=>{b.location.hash='perfil';},
  b=>{b.window.NeoCloud={commercialPreview:true};},
  b=>{b.window.NeoCloud.commercialPreview=false;}
 ]){
  const b=boot();
  let resolve;
  b.window.NeoCloud={commercialPreview:true,commercialAccount:()=>new Promise(r=>{resolve=r;})};
  const pending=b.shop.mountWithCloud(b.root,data);
  change(b);
  resolve({id:'synthetic-cloud',commercialComplete:true,onboardingComplete:false});
  assert.equal(await pending,null);
  assert.equal(b.shop.active,false);
  assert.equal(b.root.textContent,'');
 }
});

test('local onboarding does not redirect after leaving the preview destination',async()=>{
 const b=boot();
 const account={id:'synthetic',commercialComplete:true,onboardingComplete:false};
 let resolve;
 const close=b.mount({account,readAccount:()=>new Promise(r=>{resolve=r;})});
 b.click('[data-commercial=app]');
 b.location.hash='perfil';
 b.window.dispatchEvent(new b.window.Event('popstate'));
 resolve(account);
 await new Promise(setImmediate);
 assert.equal(b.transitions(),0);
 close();
});

test('leaving the local preview restores PWA behavior and permits a clean remount',()=>{
 for(const event of ['popstate','hashchange']){
  const b=boot();
  const close=b.mount();
  assert.equal(b.install.blocking,false);
  b.location.hash='perfil';
  b.window.dispatchEvent(new b.window.Event(event));
  assert.equal(b.shop.active,false);
  assert.equal(b.install.blocking,true);
  assert.equal(b.root.textContent,'');
  b.location.hash='loja';
  const next=b.mount();
  assert.equal(typeof next,'function');
  close();
  assert.equal(b.shop.active,true);
  next();
  assert.equal(b.install.blocking,true);
 }
});

test('late simulated registration cannot remount the local preview after navigation',async()=>{
 const b=boot();
 let resolve;
 const close=b.mount({register:()=>new Promise(r=>{resolve=r;})});
 b.click('[data-commercial=register]');
 const form=b.root.querySelector('[data-commercial-register]');
 form.querySelector('[name=consent]').checked=true;
 form.dispatchEvent(new b.window.Event('submit',{bubbles:true,cancelable:true}));
 b.location.hash='perfil';
 b.window.dispatchEvent(new b.window.Event('hashchange'));
 resolve({id:'synthetic',commercialComplete:true,onboardingComplete:false});
 await new Promise(setImmediate);
 assert.equal(b.shop.active,false);
 assert.equal(b.root.textContent,'');
 assert.equal(b.install.blocking,true);
 close();
});
