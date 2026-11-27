import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createCampaignReader} from '../src/campaign-reader.mjs';

test('leitura consulta apenas RPC nativo fixo e remove destinatários e recibos brutos',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const ownerId='22222222-2222-4222-8222-222222222222';
 const principal={id,ownerId,environment:'test',campaignAdmin:true,scopes:['campaigns:read']};
 let account=ownerId;const calls=[];
 const read=createCampaignReader({publishableKey:'fixture',sessionFor:async()=> 'session',request:async(url,options)=>{
  calls.push([url,options]);
  if(url.endsWith('/user'))return Response.json({id:account});
  return Response.json({campaign_id:id,title:'Campanha',default_destination:'privado',
   publications:[{id,title:'Publicação',revision:2,batches:[{destination:'privado'}]}]});
 }});
 const args={channel:'whatsapp',campaign_id:id};
 assert.deepEqual(await read(principal,'get_campaign',args),{
  campaign:{id,title:'Campanha',state:'active',channel:'whatsapp'},publications:[{id,title:'Publicação',revision:2}]
 });
 assert.equal(JSON.parse(calls[1][1].body).p_action,'get');
 await assert.rejects(read({...principal,environment:'production'},'get_campaign',args),/FORBIDDEN/);
 await assert.rejects(read(principal,'publish',args),/CAPABILITY_UNAVAILABLE/);
 assert.equal(calls.length,2);
 account=id;
 await assert.rejects(read(principal,'get_campaign',args),/FORBIDDEN/);
 assert.equal(calls.length,3);
});
