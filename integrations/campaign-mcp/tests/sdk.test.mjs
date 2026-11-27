import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createHandler} from '../src/worker.mjs';

test('cliente do SDK oficial inicializa e consulta o transporte HTTP em fixture',async()=>{
 const handler=createHandler({authorize:async()=>({environment:'test',expiresAt:Date.now()+60000,
  campaignAdmin:true,scopes:['campaigns:read']})});
 const transport=new StreamableHTTPClientTransport(new URL('https://local.example.invalid/mcp'),{
  requestInit:{headers:{Authorization:'Bearer fixture'}},
  fetch:(input,init)=>handler(new Request(input,init))
 });
 const client=new Client({name:'neo-test',version:'1.0.0'});
 try{
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length,3);
  assert.equal((await client.callTool({name:'get_capabilities'})).structuredContent.environment,'test');
 }finally{await client.close();}
});
