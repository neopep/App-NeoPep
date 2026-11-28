'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/shop-core.js');
const id='11111111-0000-4000-8000-000000000001',user='22222222-0000-4000-8000-000000000001';
const path='fixture/image.jpg',image=new Blob([new Uint8Array([255,216,255,217])],{type:'image/jpeg'});
const metadata=()=>({records:[{id,name:'Caderno fictício',category:'Papelaria',description:'',price_cents:1000,stock:2,active:false,featured:true,payment_name:'Caderno',photo_path:path,photo_paths:[path]}],visibility_rules:[{product_id:id,mode:'allowlist'}],visibility_members:[{product_id:id,list:'allowlist',user_id:user},{product_id:id,list:'blocklist',user_id:user}],promotions:[{id:'fixture-promo'}],discount_mode:'best',acquisitions:[],costs:[],fx_rates:[],files:[{path,exists:true,size:'4'}]});
const make=()=>C.createCatalogArchive(async()=>metadata(),async()=>image,()=>true);
test('complete backup includes both visibility lists, gallery order, settings and original photo bytes',async()=>{
 const result=await make();
 assert.deepEqual(result.metadata,metadata());
 assert.equal(result.images[0].base64,'/9j/2Q==');
 assert.equal(result.images[0].sha256.length,64);
 assert.deepEqual(await C.inspectCatalogArchive(JSON.stringify(result)),{count:1,complete:true,images:1});
});
test('missing photos, modified metadata and changed session abort export',async()=>{
 const m=metadata();m.files[0].exists=false;
 await assert.rejects(()=>C.createCatalogArchive(async()=>m,async()=>image,()=>true),/ausente/);
 let calls=0;await assert.rejects(()=>C.createCatalogArchive(async()=>{const m=metadata();if(++calls>1)m.records[0].active=true;return m;},async()=>image,()=>true),/mudou/);
 let current=true;await assert.rejects(()=>C.createCatalogArchive(async()=>metadata(),async()=>{current=false;return image;},()=>current),/sessão/);
 await assert.rejects(()=>C.createCatalogArchive(async()=>metadata(),async()=>new Blob([]),()=>true),/Imagem/);
});
test('archive rejects altered bytes, missing member rules and missing images; old files identified as incomplete',async()=>{
 const result=await make();result.images[0].base64='AAAAAA==';
 await assert.rejects(()=>C.inspectCatalogArchive(JSON.stringify(result)),/Integridade/);
 const a=await make();a.images=[];await assert.rejects(()=>C.inspectCatalogArchive(JSON.stringify(a)),/incompleto/);
 const b=await make();b.metadata.visibility_rules=[];await assert.rejects(()=>C.inspectCatalogArchive(JSON.stringify(b)),/incompletas/);
 const old=C.inventorySnapshot(metadata().records);assert.equal((await C.inspectCatalogArchive(JSON.stringify(old))).complete,false);
});

test('read-only recovery audit compares every archived section and does not return product payloads',async()=>{
 const backup=await make();
 const live=metadata();live.records[0].stock=7;live.visibility_rules[0].mode='blocklist';live.visibility_members.pop();live.promotions=[];live.discount_mode='different';live.files[0].version='new';
 let reads=0;
 const result=await C.auditCatalogRecovery(JSON.stringify(backup),async()=>{reads++;return live;},()=>true);
 assert.equal(reads,1);
 assert.deepEqual(result.comparison.products,{missing:0,different:1,unchanged:0,liveOnly:0});
 assert.equal(result.comparison.visibilityRules.different,1);
 assert.equal(result.comparison.visibilityMembers.missing,1);
 assert.equal(result.comparison.promotions.missing,1);
 assert.equal(result.comparison.imageReferences.different,1);
 assert.equal(result.comparison.discountModeChanged,true);
 assert.doesNotMatch(JSON.stringify(result),/Caderno fictício|fixture\/image.jpg|base64/);
});
test('recovery audit rejects incomplete archives and ignores a changed session',async()=>{
 let reads=0;
 await assert.rejects(()=>C.auditCatalogRecovery(JSON.stringify(C.inventorySnapshot(metadata().records)),async()=>{reads++;return metadata();},()=>true),/antigo/);
 assert.equal(reads,0);
 let current=true;
 const backup=await make();
 await assert.rejects(()=>C.auditCatalogRecovery(JSON.stringify(backup),async()=>{current=false;return metadata();},()=>current),/sessão/);
 const invalid=metadata();invalid.promotions.push(invalid.promotions[0]);
 await assert.rejects(()=>C.auditCatalogRecovery(JSON.stringify(backup),async()=>invalid,()=>true),/duplicado/);
});
