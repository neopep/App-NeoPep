'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const editor=fs.readFileSync(path.join(root,'dist/admin/campaign-editor.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'release/campaign-rich/20261125102000_editable_reference_captions.sql'),'utf8');
const kindMigration=fs.readFileSync(path.join(root,'release/campaign-rich/20261125102100_allow_library_community_kinds.sql'),'utf8');
const html=fs.readFileSync(path.join(root,'dist/admin/index.html'),'utf8');

test('product/library/community blocks can be edited as captions in the same bubble',()=>{
 assert.match(editor,/\['text','image','product','document','community','file','link'\]\.includes\(block\.type\)/);
 assert.match(editor,/data-editor="edit"/);
 assert.match(editor,/captionTarget=id;if\(!keepText\)\{editing=id;message\.value=''/);
 assert.match(editor,/Escreva a legenda deste bloco/);
 assert.match(editor,/edited\.text=text/);
 assert.match(editor,/Legenda adicional:/);
 assert.match(editor,/richMode\(\)/);
 assert.match(editor,/\['text','image','link','product','document','community','file'\]/);
 assert.match(editor,/block\.type!=='file'\|\|\(gates\.whatsapp_rich\?\.originals_enabled===true/);
});

test('product preserves authoritative name, bold price, and canonical shop link',()=>{
 assert.match(migration,/select p\.name,p\.price_cents,p\.photo_path into product_row/);
 assert.match(migration,/p\.active and p\.deleted_at is null and p\.stock>0/);
 assert.match(migration,/\*R\$ /);
 assert.match(migration,/case when length\(btrim\(body\)\)>0 then E'/);
 assert.ok(migration.includes("https://teste.app.neopep.com.br/?produto='||(bl->>'ref')||'#loja'"));
 assert.match(editor,/<strong>\$\{e\(price\)\}<\/strong>/);
});

test('library and community deep links never disclose private signed media URLs',()=>{
 assert.match(migration,/neo_private\.community_materials/);
 assert.match(migration,/neo_private\.community_posts cp/);
 assert.match(migration,/cp\.status='published'/);
 assert.match(migration,/https:\/\/teste\.app\.neopep\.com\.br\/\?material=/);
 assert.match(migration,/https:\/\/teste\.app\.neopep\.com\.br\/#comunidade/);
 assert.doesNotMatch(migration,/storage\/v1\/object\/(?:authenticated|sign)/);
 assert.match(kindMigration,/kind in \('text','image','link','product','document','community'\)/);
});

test('admin loads new iPhone caption editor, while no send is added to the migration',()=>{
 assert.match(html,/campaign-editor\.js\?v=campanhas-central-25/);
 const sql=migration.replace(/^--[^\n]*\n/gm,'').trim();
 assert.match(sql,/^CREATE OR REPLACE FUNCTION public\.neo_campaign_rich_admin_v1/);
 assert.match(sql,/\$function\$\s*;$/);
 assert.doesNotMatch(sql,/\$function\$\s*;\s*(?:UPDATE|INSERT|DELETE|SELECT)\b/i);
});

test('media caption conversion preserves text and WhatsApp marks without hidden dispatch flags',()=>{
 const fn=editor.slice(editor.indexOf(' function mediaCaptionMode('),editor.indexOf(' // Locally generated canvas covers'));
 const apply=new Function(fn+';return mediaCaptionMode;')();
 for(const type of ['image','file']){
  const blocks=[{id:'media',type,text:'*Negrito* e _itálico_',layout:'caption'}];
  assert.equal(apply(blocks,0,'separate',()=> 'text'),null);
  assert.deepEqual(blocks,[{id:'media',type,text:'',layout:'separate'},{id:'text',type:'text',text:'*Negrito* e _itálico_'}]);
  assert.equal(apply(blocks,0,'join',()=> 'unused'),null);
  assert.equal(blocks.length,1);assert.equal(blocks[0].text,'*Negrito* e _itálico_');assert.equal(blocks[0].layout,'caption');
 }
 const tooLong=[{type:'file',text:''},{type:'text',text:'a'.repeat(1001)}];
 assert.equal(apply(tooLong,0,'join',()=>''),'CAPTION_LIMIT');assert.equal(tooLong.length,2);
 const full=Array.from({length:32},()=>({type:'image',text:'caption'}));
 assert.equal(apply(full,0,'separate',()=>''),'BLOCK_LIMIT');assert.equal(full[0].text,'caption');
});
