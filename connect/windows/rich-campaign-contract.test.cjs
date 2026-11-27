'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const connect=fs.readFileSync(path.join(__dirname,'Connect.cs'),'utf8');
const whatsapp=fs.readFileSync(path.join(__dirname,'WhatsApp.cs'),'utf8');
const migration=fs.readFileSync(path.join(root,'release/campaign-rich/20261125042000_campaign_rich_staging.sql'),'utf8');
const editor=fs.readFileSync(path.join(root,'dist/admin/campaign-editor.js'),'utf8');
const cloud=fs.readFileSync(path.join(root,'dist/cloud.js'),'utf8');

test('worker oficial e Teste exigem opt-in local e gate remoto',()=>{
  assert.match(connect,/profile\.IsProduction\|\|Environment\.GetEnvironmentVariable\("NEO_CONNECT_CAMPAIGN_WORKER"\)/);
  assert.match(connect,/Value\(local,"campaign_worker_enabled"\)!="1"\|\|!deviceApproved\|\|!SessionReady\(\)/);
  assert.match(connect,/TickRichCampaign\(window,connection\)/);
  assert.match(connect,/neo_campaign_rich_device_v1/);
});
test('worker baixa midia autenticada, JPEG de ate 5 MB e originais sob gate',()=>{
  assert.match(connect,/neo-campaign-images/);
  assert.match(connect,/neo-shop-products/);
  assert.match(connect,/storage\/v1\/object\/authenticated/);
  assert.match(connect,/data\.Length>5\*1024\*1024/);
  assert.match(whatsapp,/DispatchCampaignImageAsync/);
  assert.match(whatsapp,/jpeg\.Length>5\*1024\*1024/);
  assert.match(whatsapp,/action="send_image"/);
});
test('outbox e segura, sequencial e sem repeticao automatica',()=>{
  assert.match(migration,/enabled boolean not null default false/);
  assert.match(migration,/check\(sequence between 1 and 6\)/);
  assert.match(migration,/preceding\.state<>'accepted'/);
  assert.match(migration,/lease_until<now\(\)/);
  assert.match(migration,/state='uncertain'/);
  assert.match(migration,/select job\.\* into m/);
  assert.match(migration,/d\.version='0\.2\.12'/);
  assert.match(migration,/campaign_wa_test_ready/);
});
test('editor so libera multi-blocos via gate rico e confirmacao',()=>{
  assert.match(editor,/gates\.whatsapp_rich\?\.ready===true/);
  assert.match(editor,/rich\?await cloud\.campaignRich\('publish'/);
  assert.match(editor,/cloud\.campaignMediaUpload/);
  assert.match(editor,/if\(\(testWA\|\|testApp\|\|channel==='app'&&gates\.app_rich_popup===true\|\|gates\.album_drafts\?\.album_drafts===true&&draft\.blocks\.some\(b=>b\.album_id\)\)&&draft\.blocks\.some/);
  assert.match(editor,/draft\.blocks\.some\(b=>b\.type==='file'\)&&!libraryOriginalReady\(\)/);
  const snippet=editor.slice(editor.indexOf('  function libraryOriginalReady(){'),editor.indexOf('  function libraryShareActive('));
  const ready=(channel,testWA,testApp,gates,testGate={})=>new Function('channel','testWA','testApp','gates','testGate',snippet+';return libraryOriginalReady();')(channel,testWA,testApp,gates,testGate);
  assert.equal(ready('whatsapp',true,false,{whatsapp_rich:{originals_enabled:false}}),false);
  assert.equal(ready('whatsapp',true,false,{whatsapp_rich:{originals_enabled:true}}),true);
  assert.equal(ready('whatsapp',false,false,{whatsapp_rich:{originals_enabled:true}}),false);
  assert.equal(ready('app',false,true,{},{rich_popup:false}),false);
  assert.equal(ready('app',false,true,{},{rich_popup:true}),true);
  assert.equal(ready('app',false,false,{app_rich_popup:false}),false);
  assert.match(editor,/block\.type!=='file'\|\|\(gates\.whatsapp_rich\?\.originals_enabled===true/);
  assert.match(cloud,/async campaignRich\(/);
  assert.match(cloud,/async campaignMediaUpload\(/);
});

test('originais exigem transporte privado, opt-in e capacidade do cliente',()=>{
 assert.match(connect,/LoadRichCampaignOriginal/);
 assert.match(connect,/neo-campaign-originals/);
 assert.match(connect,/originals_v1=true/);
 assert.match(connect,/data\.Length>5\*1024\*1024/);
 assert.match(whatsapp,/DispatchCampaignFileAsync/);
 assert.match(whatsapp,/action="send_file"/);
});

test('álbum candidato passa capability independente e mantém o transporte desligado',()=>{
 const worker=fs.readFileSync(path.join(__dirname,'Connect.cs'),'utf8');
 const whatsapp=fs.readFileSync(path.join(__dirname,'WhatsApp.cs'),'utf8');
 assert.match(whatsapp,/AlbumTransportApproved=false/);
 assert.match(whatsapp,/action="send_album"/);
 assert.match(whatsapp,/automatedAlbum\.TrySetResult\(result\)/);
 assert.match(worker,/RichCampaign\("claim",new \{originals_v1=true,image5_v1=true,album_v1=window\.CampaignAlbumReady\}/);
 assert.match(worker,/RichCampaign\("start",new \{id=id,fence=fence,originals_v1=true,image5_v1=true,album_v1=window\.CampaignAlbumReady\}/);
 assert.match(worker,/album_receipt=albumReceipt/);
});
