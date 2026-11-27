import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateDraftJobExecutor} from '../src/draft-job-broker.mjs';
import {testProfile,productionProfile} from '../src/environments.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p={id:id(1),ownerId:id(2),campaignAdmin:true,environment:'test',scopes:['campaigns:read','campaigns:drafts'],expiresAt:60000},j=id(3);
function fixture(){
 const item={ordinal:0,publicationId:id(4),requestId:id(5),leaseId:id(6),campaignId:id(7),channel:'app',item:{publicationId:id(4),requestId:id(5),title:'Fixture',blocks:[]}};
 const calls=[];let live=true,checks=0,writes=0,verified=false,clock=0;
 const deps={profile:testProfile,env:{NEO_CONNECT_AI_ENABLED:'1',NEO_CONNECT_AI_DRAFTS:'1',NEO_CONNECT_AI_DRAFT_JOBS:'1'},now:()=>clock,
 freshSession:async(a,b)=>{assert.deepEqual([a,b],[p.id,p.ownerId]);checks++;return live?'fixture':null;},
 verifyDatabase:async()=>{verified=true;},
 sql:async(parts,...args)=>{assert.ok(verified);const query=parts.join('?');calls.push({query,args});assert.deepEqual(args.slice(0,3),[p.id,p.ownerId,j]);
 if(query.includes('claim_payload'))return [{value:[item]}];
 if(query.includes('job_control')){assert.match(query,/'status'/);return [{value:{id:j,state:'active',items:[{ordinal:0,publicationId:id(4),state:'leased'}]}}];}
 if(query.includes('job_result')){assert.deepEqual(args,[p.id,p.ownerId,j,id(5),id(6),'saved',1]);return [{value:true}];}
 throw Error('Unexpected SQL');},
 writeDraft:async(principal,op,input)=>{assert.equal(op,'add_publications');assert.deepEqual(input.items,[item.item]);writes++;return {channel:'app',campaignId:id(7),results:[{publicationId:id(4),status:'draft_saved_or_reused',revision:1}]};}};
 return {deps,calls,get checks(){return checks;},get writes(){return writes;},revoke:()=>live=false,tick:()=>clock=60000};
}
test('private adapter connects exact SQL signatures and records lease receipt',async()=>{
 const f=fixture(),r=await createPrivateDraftJobExecutor(f.deps)(p,j);
 assert.equal(r.receipts[0].state,'saved');assert.equal(f.writes,1);assert.equal(f.calls.length,3);assert.ok(f.checks>=4);
 assert.ok(!JSON.stringify(r).includes('Fixture'));
});
test('each flag, other profile, expired principal or revoked session blocks before SQL',async()=>{
 for(const key of ['NEO_CONNECT_AI_ENABLED','NEO_CONNECT_AI_DRAFTS','NEO_CONNECT_AI_DRAFT_JOBS']){
  const f=fixture();await assert.rejects(createPrivateDraftJobExecutor({...f.deps,env:{...f.deps.env,[key]:'0'}})(p,j),/FORBIDDEN/);assert.equal(f.calls.length,0);
 }
 for(const mode of ['production','expired','revoked']){
  const f=fixture();if(mode==='expired')f.tick();if(mode==='revoked')f.revoke();
  await assert.rejects(createPrivateDraftJobExecutor({...f.deps,profile:mode==='production'?productionProfile:testProfile})(p,j),/FORBIDDEN/);assert.equal(f.calls.length,0);
 }
});
test('database marker mismatch prevents claim',async()=>{
 const f=fixture();await assert.rejects(createPrivateDraftJobExecutor({...f.deps,verifyDatabase:async()=>{throw Error('BROKER_ENVIRONMENT_MISMATCH');}})(p,j),/BROKER_ENVIRONMENT_MISMATCH/);assert.equal(f.calls.length,0);
});
test('revocation after claim prevents status or write',async()=>{
 const f=fixture(),sql=f.deps.sql;f.deps.sql=async(...args)=>{const r=await sql(...args);f.revoke();return r;};
 const r=await createPrivateDraftJobExecutor(f.deps)(p,j);assert.equal(r.stopped,'authorization_or_deadline');assert.equal(f.calls.length,1);assert.equal(f.writes,0);
});

test('private reconciliation uses only job and request identifiers and returns projected receipt',async()=>{
 const f=fixture();f.deps.sql=async(parts,...args)=>{assert.match(parts.join('?'),/connect_ai_job_reconcile/);assert.deepEqual(args,[p.id,p.ownerId,j,id(5)]);return [{value:{publicationId:id(4),state:'saved',revision:1,reconciled:true,draft:'must not leak'}}];};
 const run=createPrivateDraftJobExecutor(f.deps);
 assert.deepEqual(await run.reconcile(p,j,id(5)),{publicationId:id(4),state:'saved',revision:1,reconciled:true});
 assert.equal(f.writes,0);
 f.revoke();await assert.rejects(run.reconcile(p,j,id(5)),/FORBIDDEN/);
});
test('reconciliation rejects invalid receipt and requires same flags',async()=>{
 const f=fixture();f.deps.sql=async()=>[{value:{publicationId:id(4),state:'uncertain',reconciled:true}}];
 await assert.rejects(createPrivateDraftJobExecutor(f.deps).reconcile(p,j,id(5)),/INVALID_RECEIPT/);
 await assert.rejects(createPrivateDraftJobExecutor({...f.deps,env:{...f.deps.env,NEO_CONNECT_AI_DRAFT_JOBS:'0'}}).reconcile(p,j,id(5)),/FORBIDDEN/);
});
