import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareDraftCreation,prepareDraftTextEdit,reviewDraftTextBatch} from '../src/draft-plan.mjs';
test('rascunho usa ações e idempotência nativas sem destino ou envio',()=>{
 const requestId='11111111-1111-4111-8111-111111111111';
 for(const [channel,action] of [['app','app_create'],['whatsapp','create']]){
  assert.deepEqual(prepareDraftCreation({channel,title:' Revisão ',requestId,destination:'ignored'}),{
   p_action:action,p_data:{title:'Revisão',request_id:requestId}
  });
 }
 assert.throws(()=>prepareDraftCreation({channel:'app',title:'',requestId}),/INVALID_DRAFT/);
});

test('edição altera apenas o texto selecionado e rejeita revisões e estados incompatíveis',()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const imageId='22222222-2222-4222-8222-222222222222';
 const draft={title:'Título',groups:['grupo'],timezone:'America/Sao_Paulo',planned_local:'2027-12-01T09:00',
  audience:'members',app_settings:{priority:3},blocks:[{id,type:'text',text:'Original',meta:{language:'pt'}},
   {id:imageId,type:'image',path:'private/asset.jpg',caption:'Legenda'}]};
 const args={channel:'app',requestId:id,campaignId:id,publicationId:id,revision:3,edits:[{id,text:'Novo'}],
  current:{channel:'app',campaignId:id,publicationId:id,revision:3,status:'draft',draft}};
 const result=prepareDraftTextEdit(args);
 assert.equal(result.p_action,'app_save');
 assert.equal(result.p_data.revision,3);
 const batch=reviewDraftTextBatch([args,args,{...args,revision:2}]);
 assert.deepEqual(batch,[
  {index:0,eligible:true,operation:result},
  {index:1,eligible:false,reason:'DUPLICATE_DRAFT'},
  {index:2,eligible:false,reason:'INVALID_DRAFT'}
 ]);
 assert.throws(()=>reviewDraftTextBatch(Array(21).fill(args)),/INVALID_BATCH/);
 assert.deepEqual(result.p_data.draft,{...draft,blocks:[{...draft.blocks[0],text:'Novo'},draft.blocks[1]]});
 assert.equal(draft.blocks[0].text,'Original');
 assert.throws(()=>prepareDraftTextEdit({...args,revision:2}),/INVALID_DRAFT/);
 assert.throws(()=>prepareDraftTextEdit({...args,current:{...args.current,status:'scheduled'}}),/INVALID_DRAFT/);
 assert.throws(()=>prepareDraftTextEdit({...args,edits:[{id:imageId,text:'Outro'}]}),/INVALID_DRAFT/);
 assert.throws(()=>prepareDraftTextEdit({...args,edits:[...args.edits,...args.edits]}),/INVALID_DRAFT/);
});
