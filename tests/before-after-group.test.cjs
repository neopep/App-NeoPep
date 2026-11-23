'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('Before/After private save requires explicit action and confirmation',()=>{
 const app=read('src/app.js');
 assert.match(app,/data-export-cloud[^>]*hidden disabled/);
 assert.match(app,/Cloud\.beforeAfterAvailable\(\)/);
 assert.match(app,/window\.confirm\('Salvar esta comparação/);
 assert.match(app,/Cloud\.saveBeforeAfter\(file,photos\)/);
});
test('owner-only private comparison read and image validation',()=>{
 const cloud=read('src/cloud.js');
 assert.match(cloud,/async savedBeforeAfter\(\)/);
 assert.match(cloud,/async beforeAfterBlob\(item\)/);
 assert.match(cloud,/async saveBeforeAfter\(blob,photos\)/);
 assert.match(cloud,/!api\.hasConsent\('photos'\)/);
 assert.match(cloud,/\.eq\('user_id',account\)/);
 assert.match(cloud,/bucket\.upload\(path,blob,\{contentType:'image\/jpeg',upsert:false/);
});
test('group picker does not automatically publish and confirms chosen comparison',()=>{
 const c=read('dist/community.js');
 assert.match(c,/data-community="choose_comparison"/);
 assert.match(c,/async function openComparisonPicker\(\)/);
 assert.match(c,/async function selectSavedComparison\(id,trigger\)/);
 assert.match(c,/NeoCloud\.beforeAfterBlob\(item\)/);
 assert.match(c,/selectedComparison=\{id:item\.id/);
 assert.match(c,/window\.confirm\('Publicar esta comparação Antes\/Depois no Grupo/);
 const confirm=c.indexOf("window.confirm('Publicar esta comparação Antes/Depois");
 const upload=c.indexOf('window.NeoCloud.uploadCommunityPhoto(photo)');
 assert.ok(confirm>=0&&upload>confirm,'confirmation precedes upload');
 assert.match(c,/const clearPhoto=\(\)=>\{[^\n]*selectedComparison=null/);
});
test('draft SQL uses private bucket and RLS owner checks; does not touch payment functions',()=>{
 const sql=read('release/before-after/prepare.sql');
 assert.match(sql,/neo-comparisons','neo-comparisons',false/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/user_id = \(select auth\.uid\(\)\)/);
 assert.doesNotMatch(sql,/mercadopago|neo_shop_payment|payment_event/i);
});
