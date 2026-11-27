import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createDraftWriter} from '../src/draft-writer.mjs';
import {prepareDraftAddition} from '../src/draft-plan.mjs';
import {productionProfile} from '../src/environments.mjs';
const id='11111111-1111-4111-8111-111111111111',pub='22222222-2222-4222-8222-222222222222',req='33333333-3333-4333-8333-333333333333',block='44444444-4444-4444-8444-444444444444';
const principal={id,ownerId:id,environment:'test',campaignAdmin:true,scopes:['campaigns:read','campaigns:drafts']};
const item={publicationId:pub,requestId:req,title:'Material',blocks:[{id:block,text:'Texto sintético'}]};
test('candidata bloqueada por padrão, em produção e sem escopo',async()=>{
 let calls=0;const o={publishableKey:'fixture',sessionFor:async()=>{calls++;return 'token'}};
 await assert.rejects(createDraftWriter(o)(principal,'add_publications',{channel:'app',campaignId:id,items:[item]}),/FORBIDDEN/);
 await assert.rejects(createDraftWriter({...o,enabled:true})({...principal,scopes:['campaigns:read']},'add_publications',{channel:'app',campaignId:id,items:[item]}),/FORBIDDEN/);
 assert.throws(()=>createDraftWriter({...o,profile:productionProfile,enabled:true}),/TEST_ONLY/);assert.equal(calls,0);
});
test('adição prepara apenas rascunho sem destino e valida data',()=>{
 const op=prepareDraftAddition({channel:'app',campaignId:id,...item});
 assert.equal(op.p_action,'app_save');assert.equal(op.p_data.revision,0);assert.deepEqual(op.p_data.draft.groups,[]);
 assert.throws(()=>prepareDraftAddition({channel:'app',campaignId:id,...item,plannedLocal:'2027-02-30T10:00'}),/INVALID_DRAFT/);
 assert.throws(()=>prepareDraftAddition({channel:'app',campaignId:id,...item,blocks:[{...item.blocks[0],url:'https://example.invalid'}]}),/INVALID_DRAFT/);
});
test('edição preserva mídia/destinos e rejeita revisão antiga',async()=>{
 let calls=[];let draft=prepareDraftAddition({channel:'whatsapp',campaignId:id,...item}).p_data.draft;
 draft.groups=['destino-preservado'];draft.blocks.push({id:req,type:'image',media_path:'private/asset.jpg'});let revision=1;
 const write=createDraftWriter({enabled:true,publishableKey:'fixture',sessionFor:async()=> 'session',request:async(url,opts)=>{
  if(url.endsWith('/user'))return Response.json({id});const q=JSON.parse(opts.body);calls.push(q);
  if(q.p_action==='create')return Response.json({campaign_id:id});
  if(q.p_action==='get')return Response.json({campaign_id:id,title:'Material',publications:[{id:pub,editor_id:pub,revision,batches:[]}]});
  if(q.p_action==='load')return Response.json({editor_id:pub,channel:'whatsapp',revision,draft});
  if(q.p_action==='save'){revision=q.p_data.revision+1;draft=q.p_data.draft;return Response.json({revision});}
  throw Error('unexpected RPC');
 }});
 assert.equal((await write(principal,'create_campaign_draft',{channel:'whatsapp',title:'Material',requestId:req})).campaignId,id);
 const input={channel:'whatsapp',campaignId:id,items:[{publicationId:pub,requestId:req,revision:1,edits:[{id:block,text:'Novo'}]}]};
 assert.equal((await write(principal,'update_publications',input)).results[0].revision,2);assert.equal(draft.blocks[0].text,'Novo');assert.equal(draft.blocks[1].media_path,'private/asset.jpg');assert.deepEqual(draft.groups,['destino-preservado']);
 assert.equal((await write(principal,'update_publications',input)).results[0].error,'REVISION_CONFLICT');await assert.rejects(write(principal,'publish',{channel:'whatsapp'}),/INVALID_DRAFT/);assert.equal(calls.filter(q=>q.p_action==='save').length,1);
});
