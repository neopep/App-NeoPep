'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/cloud.js'),'utf8');
const built=fs.readFileSync(path.join(root,'dist/cloud.js'),'utf8');
const editor=fs.readFileSync(path.join(root,'dist/admin/campaign-editor.js'),'utf8');
const admin=fs.readFileSync(path.join(root,'dist/admin/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');

test('rich WhatsApp API exists in the source of truth AND in the esbuild artifact',()=>{
 for(const [name,body] of [['source',source],['esbuild output',built]]){
  assert.match(body,/async campaignRich\(/,name+' missing campaignRich');
  assert.match(body,/async campaignMediaUpload\(/,name+' missing campaignMediaUpload');
  assert.match(body,/neo_campaign_rich_admin_v1/,name+' missing RPC');
  assert.match(body,/neo-campaign-images/,name+' missing private storage bucket');
 }
});

test('upload always stays on the authenticated actor in the TESTE JPEG bucket',()=>{
 assert.match(source,/path\.split\('\/'\)\[0\]!==owner/);
 assert.match(source,/jpeg\.type!=='image\/jpeg'/);
 assert.match(source,/jpeg\.size>5242880/);
 assert.match(source,/upsert:false/);
 assert.match(editor,/block\.media_path=stored/);
 assert.match(editor,/typeof cloud\.campaignMediaUpload==='function'/);
 assert.match(editor,/typeof cloud\.uploadCampaignImage==='function'/);
});

test('iPhone PWA and admin load the current cache-busted SDK',()=>{
 assert.match(app,/cloud\.js\?v=20261126biblioteca61/);
 assert.match(admin,/cloud\.js\?v=connect-ai-6/);
 assert.match(admin,/campaign-editor\.js\?v=campanhas-central-22/);
});

test('JPEG apto preserva bytes e resolução, e executor antigo usa limite de 1 MiB',async()=>{
 const vm=require('node:vm');
 const start=editor.indexOf('  const dispatchImageLimit=');
 const end=editor.indexOf('  }finally{URL.revokeObjectURL(url);}',start);
 const optimize=editor.slice(start,end)+'  }finally{URL.revokeObjectURL(url);}\n  }\njpegForDispatch';
 for(const limit of [1048576,5242880]){
  let conversions=0;
  const fn=vm.runInNewContext(optimize,{
   channel:'whatsapp',gates:{whatsapp_rich:{max_image_bytes:limit}},Uint8Array,
   Image:class {naturalWidth=4200;naturalHeight=3200;set src(value){this.onload();}},
   URL:{createObjectURL:()=> 'fixture',revokeObjectURL(){}},
   document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),
    toBlob(callback){conversions++;callback(new Blob(['1234'],{type:'image/jpeg'}));}})}
  });
  const file=new Blob([Uint8Array.of(255,216,255),new Uint8Array(5242880-3)],{type:'image/jpeg'});
  const result=await fn(file);
  if(limit===5242880){assert.equal(result,file);assert.equal(conversions,0);}
  else{assert.notEqual(result,file);assert.equal(conversions,1);}
 }
});

test('seleção múltipla salva blocos individuais em ordem e não deixa lote parcial quando a conversão falha',async()=>{
 const vm=require('node:vm');
 const start=editor.indexOf("   if(channel==='whatsapp'&&input.multiple&&selections.length>1)");
 const end=editor.indexOf('   const file=selections[0];',start);
 const execute=vm.runInNewContext('(async ({selections,draft,prepareImage,storeMedia,uuid,tell})=>{'+editor.slice(start,end)+'})',{
  channel:'whatsapp',input:{multiple:true},field:()=>({value:'caption'}),
  state:{editorId:'draft'},current:()=>true,mediaKey:id=>'draft:'+id,render(){},changed(){},closeSheet(){}
 });
 const selections=['b.jpg','a.jpg'].map(name=>({name,type:'image/jpeg',size:100}));
 for(const fail of [false,true]){
  const draft={blocks:[]},stored=[],errors=[];
  let counter=0;
  await execute({selections,draft,uuid:()=>String(++counter),tell:t=>errors.push(t),
   prepareImage:async file=>{if(fail&&file===selections[1])throw Error('JPEG inválido');return file;},
   storeMedia:async(mode,apply)=>apply({put:(asset,key)=>stored.push([asset.name,key])})
  });
  assert.deepEqual(draft.blocks.map(block=>[block.type,block.name]),fail?[]:[['image','b.jpg'],['image','a.jpg']]);
  assert.equal(stored.length,fail?0:2);
  assert.equal(errors.length,fail?1:0);
 }
});
