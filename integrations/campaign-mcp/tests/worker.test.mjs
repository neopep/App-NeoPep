import assert from 'node:assert/strict';
import {test} from 'node:test';
import worker,{createHandler} from '../src/worker.mjs';

const auth={environment:'test',expiresAt:Date.now()+60000,campaignAdmin:true,scopes:['campaigns:read']};
const invoke=(handler,method,params,token='fixture',extra={})=>handler(new Request('https://example.invalid/mcp',{
 method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...extra},
 body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})
}));

test('PoC negocia protocolo e anuncia somente ferramentas operacionais',async()=>{
 const handler=createHandler({authorize:async()=>auth});
 const init=await (await invoke(handler,'initialize')).json();
 assert.equal(init.result.protocolVersion,'2025-11-25');
 const {result:{tools}}=await (await invoke(handler,'tools/list')).json();
 assert.deepEqual(tools.map(tool=>tool.name),['get_capabilities','get_brand_context']);
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
