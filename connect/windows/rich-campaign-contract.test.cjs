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

test('worker rico permanece isolado do perfil Producao e do gate local',()=>{
  assert.match(connect,/if\(profile\.IsProduction\|\|\(Value\(local,"campaign_worker_enabled"\)/);
  assert.match(connect,/if\(profile\.IsProduction\|\|!window\.CampaignSessionReady\)return;/);
  assert.match(connect,/TickRichCampaign\(window,connection\)/);
  assert.match(connect,/neo_campaign_rich_device_v1/);
});
test('worker baixa apenas media autenticada e imagem JPEG de ate 1 MB',()=>{
  assert.match(connect,/neo-campaign-images/);
  assert.match(connect,/neo-shop-products/);
  assert.match(connect,/storage\/v1\/object\/authenticated/);
  assert.match(connect,/data\.Length>1048576/);
  assert.match(whatsapp,/DispatchCampaignImageAsync/);
  assert.match(whatsapp,/jpeg\.Length>1048576/);
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
  assert.match(editor,/testWA&&Object\.prototype\.hasOwnProperty\.call\(gates\.whatsapp_rich\|\|\{\},'originals_enabled'\)\)&&draft\.blocks\.some\(b=>b\.type==='file'&&!b\.media_path\)/);
  assert.match(cloud,/async campaignRich\(/);
  assert.match(cloud,/async campaignMediaUpload\(/);
});

test('worker permite MP4 de 25 MiB com capacidade negociada',()=>{
 assert.match(connect,/data\.Length>\(mime=="application\/pdf"\?5:25\)\*1024\*1024/);
 assert.match(connect,/originals_25mb=true/);
});

test('MOV exige capacidade própria',()=>assert.match(connect,/originals_mov=true/));
