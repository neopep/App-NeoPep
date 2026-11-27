import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareDraftCreation,prepareDraftTextEdit} from '../src/draft-plan.mjs';
test('rascunho usa ações e idempotência nativas sem destino ou envio',()=>{
 const requestId='11111111-1111-4111-8111-111111111111';
 for(const [channel,action] of [['app','app_create'],['whatsapp','create']]){
  assert.deepEqual(prepareDraftCreation({channel,title:' Revisão ',requestId,destination:'ignored'}),{
   p_action:action,p_data:{title:'Revisão',request_id:requestId}
  });
 }
 assert.throws(()=>prepareDraftCreation({channel:'app',title:'',requestId}),/INVALID_DRAFT/);
});

test('edição candidata exige revisão e IDs estáveis e não herda agenda ou destino',()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const draft={channel:'app',title:'Texto',requestId:id,campaignId:id,publicationId:id,revision:3,
  blocks:[{id,type:'text',text:'Conteúdo'}],planned_local:'2027-12-01T09:00',confirmed:true};
 const args=prepareDraftTextEdit(draft);
 assert.equal(args.p_action,'app_save');
 assert.equal(args.p_data.revision,3);
 assert.equal(args.p_data.draft.planned_local,'');
 assert.deepEqual(args.p_data.draft.groups,[]);
 assert.ok(!Object.hasOwn(args.p_data,'confirmed'));
 assert.throws(()=>prepareDraftTextEdit({...draft,revision:-1}),/INVALID_DRAFT/);
 assert.throws(()=>prepareDraftTextEdit({...draft,blocks:[{id,type:'image',url:'https://invalid.example'}]}),/INVALID_DRAFT/);
});
