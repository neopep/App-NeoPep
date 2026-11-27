import {createGuideReceipts} from '../src/guide-receipts.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import worker,{createHandler} from '../src/worker.mjs';

const auth={id:'11111111-1111-4111-8111-111111111111',ownerId:'22222222-2222-4222-8222-222222222222',environment:'test',expiresAt:Date.now()+60000,campaignAdmin:true,scopes:['campaigns:read']};
const invoke=(handler,method,params,token='fixture',extra={})=>handler(new Request('https://example.invalid/mcp',{
 method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...extra},
 body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})
}));

test('PoC negocia protocolo e anuncia somente ferramentas operacionais',async()=>{
 const handler=createHandler({authorize:async()=>auth});
 const init=await (await invoke(handler,'initialize')).json();
 assert.equal(init.result.protocolVersion,'2025-11-25');
 const {result:{tools}}=await (await invoke(handler,'tools/list')).json();
 assert.deepEqual(tools.map(tool=>tool.name),['get_capabilities','get_brand_context','get_publication_guide']);
 for(const tool of tools){
  const response=await (await invoke(handler,'tools/call',{name:tool.name,arguments:{}})).json();
  assert.ok(response.result.structuredContent);
 }
 const response=await (await invoke(handler,'tools/call',{name:'create_campaign_draft'})).json();
 assert.equal(response.error.code,-32602);
});

test('nega por padrão, restringe ambientes e origens e revalida o principal por chamada',async()=>{
 assert.equal((await invoke(worker.fetch,'tools/list')).status,401);
 for(const attributes of [{revoked:true},{expiresAt:0},{campaignAdmin:false},{environment:'production'},{scopes:[]}]){
  const handler=createHandler({authorize:async()=>({...auth,...attributes})});
  assert.ok([401,403].includes((await invoke(handler,'tools/list')).status));
 }
 let principal=auth;
 const handler=createHandler({authorize:async()=>principal});
 assert.equal((await invoke(handler,'tools/list',null,'fixture',{Origin:'https://other.invalid'})).status,403);
 assert.equal((await invoke(handler,'tools/list')).status,200);
 principal={...auth,revoked:true};
 assert.equal((await invoke(handler,'tools/list')).status,401);
});

test('limita bytes lidos e não aceita entradas extras',async()=>{
 const handler=createHandler({authorize:async()=>auth});
 const oversized=await invoke(handler,'tools/call',{data:'x'.repeat(17000)});
 assert.equal(oversized.status,413);
 const response=await (await invoke(handler,'tools/call',{name:'get_capabilities',arguments:{environment:'production'}})).json();
 assert.equal(response.error.code,-32602);
});

test('leitura nativa exige adaptação explícita, escopo e ambiente do principal',async()=>{
 let called=0;
 const readCampaign=async(principal,tool,args)=>{
  called++;
  assert.equal(principal.environment,'test');
  assert.equal(tool,'list_campaigns');
  assert.equal(args.channel,'whatsapp');
  return {items:[]};
 };
 const handler=createHandler({authorize:async()=>auth,readCampaign});
 assert.equal((await (await invoke(handler,'tools/list')).json()).result.tools.length,8);
 const params={name:'list_campaigns',arguments:{channel:'whatsapp'}};
 assert.deepEqual((await (await invoke(handler,'tools/call',params)).json()).result.structuredContent,{items:[]});
 await invoke(handler,'tools/call',{...params,arguments:{...params.arguments,owner:'other'}});
 const production=createHandler({environment:'production',authorize:async()=>auth,readCampaign});
 assert.equal((await invoke(production,'tools/list')).status,403);
 assert.equal(called,1);
});

test('catálogo não anuncia destinos WhatsApp para canal App isolado',async()=>{
 const handler=createHandler({authorize:async()=>auth,readCampaign:async()=>({}),readChannels:['app']});
 const result=(await (await invoke(handler,'tools/list')).json()).result.tools;
 assert.ok(!result.some(t=>t.name==='list_destinations'));
 assert.deepEqual(result.find(t=>t.name==='get_campaign').inputSchema.properties.channel.enum,['app']);
});

test('escrita anunciada somente com escopo novo, ambiente Teste e adaptador ativo',async()=>{
 let calls=0;const writeDraft=async()=>{calls++;return {status:'draft_created_or_reused'};};
 let principal=auth;
 const key=await crypto.subtle.importKey('raw',new Uint8Array(32).fill(1),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 let clock=Date.now();
 const guideReceipts=createGuideReceipts(key,{now:()=>clock});
 const handler=createHandler({authorize:async()=>principal,writeDraft,guideReceipts});
 const params={name:'create_campaign_draft',arguments:{channel:'app',title:'Fixture',requestId:'11111111-1111-4111-8111-111111111111'}};
 assert.ok(!(await (await invoke(handler,'tools/list')).json()).result.tools.some(t=>t.name===params.name));
 assert.equal((await (await invoke(handler,'tools/call',params)).json()).error.code,-32602);
 principal={...auth,scopes:['campaigns:read','campaigns:drafts']};
 assert.match((await (await invoke(handler,'tools/call',params)).json()).result.content[0].text,/GUIDE_REFRESH_REQUIRED/);
 const guide=(await (await invoke(handler,'tools/call',{name:'get_publication_guide',arguments:{}})).json()).result.structuredContent;
 assert.equal(guide.operations.find(o=>o.name==='criar_rascunhos').available,true);
 assert.equal(guide.operations.find(o=>o.name==='agendar').available,false);
 assert.equal(guide.examples[2].blocks[1].type,'text');
 params.arguments.guideVersion=guide.guide_version;
 assert.match((await (await invoke(handler,'tools/call',params)).json()).result.content[0].text,/GUIDE_REFRESH_REQUIRED/);
 params.arguments.guideReceipt=guide.guide_receipt;
 const previous=principal;principal={...principal,id:'33333333-3333-4333-8333-333333333333'};
 assert.match((await (await invoke(handler,'tools/call',params)).json()).result.content[0].text,/GUIDE_REFRESH_REQUIRED/);
 principal=previous;
 assert.ok((await (await invoke(handler,'tools/list')).json()).result.tools.some(t=>t.name===params.name));
 assert.equal((await (await invoke(handler,'tools/call',params)).json()).result.structuredContent.status,'draft_created_or_reused');
 clock+=11*60*1000;
 assert.match((await (await invoke(handler,'tools/call',params)).json()).result.content[0].text,/GUIDE_REFRESH_REQUIRED/);
 const prod=createHandler({environment:'production',authorize:async()=>({...principal,environment:'production'}),writeDraft});
 assert.ok(!(await (await invoke(prod,'tools/list')).json()).result.tools.some(t=>t.name===params.name));
 assert.equal((await (await invoke(prod,'tools/call',params)).json()).error.code,-32602);
 assert.equal(calls,1);
});
