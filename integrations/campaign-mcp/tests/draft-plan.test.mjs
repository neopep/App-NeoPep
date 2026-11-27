import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareDraftCreation} from '../src/draft-plan.mjs';
test('rascunho usa ações e idempotência nativas sem destino ou envio',()=>{
 const requestId='11111111-1111-4111-8111-111111111111';
 for(const [channel,action] of [['app','app_create'],['whatsapp','create']]){
  assert.deepEqual(prepareDraftCreation({channel,title:' Revisão ',requestId,destination:'ignored'}),{
   p_action:action,p_data:{title:'Revisão',request_id:requestId}
  });
 }
 assert.throws(()=>prepareDraftCreation({channel:'app',title:'',requestId}),/INVALID_DRAFT/);
});
