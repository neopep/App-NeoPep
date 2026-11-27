import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDraftJobRunner} from '../src/draft-job-runner.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p={id:id(1),ownerId:id(2),environment:'test',campaignAdmin:true,scopes:['campaigns:read','campaigns:drafts']};
const input={jobId:id(3),campaignId:id(4),channel:'app',items:Array.from({length:60},(_,i)=>({publicationId:id(100+i),requestId:id(200+i),title:'Fixture '+i,blocks:[{id:id(300+i),text:'Texto fictício'}]}))};
function fixture(){
 let rows=[],state='active',allow=true,failAt=-1,writes=0;
 const broker={
  async create(p,v){rows=v.items.map(item=>({item,...item,state:'pending',campaignId:v.campaignId,channel:v.channel}));return {id:v.jobId};},
  async claim(){if(state!=='active'||rows.some(r=>r.state==='leased'))return [];return rows.filter(r=>r.state==='pending').slice(0,6).map(r=>{r.state='leased';r.leaseId=id(5);return {...r};});},
  async control(p,id,action){if(action==='pause')state='paused';if(action==='resume')state='active';return {state,items:rows.map(({publicationId,state})=>({publicationId,state}))};},
  async result(p,id,request,lease,outcome,revision){const r=rows.find(x=>x.requestId===request&&x.leaseId===lease);r.state=outcome;return true;}
 };
 const runner=createDraftJobRunner({broker,authorizeCurrent:async()=>allow,writeDraft:async(p,op,v)=>{assert.equal(op,'add_publications');assert.equal(v.items.length,1);if(writes++===failAt)throw Error('lost response');return {campaignId:v.campaignId,channel:v.channel,results:[{publicationId:v.items[0].publicationId,status:'draft_saved_or_reused',revision:1}]};}});
 return {runner,rows:()=>rows,writes:()=>writes,block:()=>{allow=false;},fail:n=>{failAt=n;}};
}
test('60 persistent items run in ten chunks, using only native draft writer',async()=>{
 const f=fixture();await f.runner.create(p,input);
 for(let n=0;n<10;n++)assert.equal((await f.runner.runChunk(p,input.jobId)).results.length,6);
 assert.equal(f.writes(),60);assert.ok(f.rows().every(r=>r.state==='saved'));
 assert.deepEqual((await f.runner.runChunk(p,input.jobId)).results,[]);
});
test('uncertain result stops the chunk; no automatic retry; gate checked again',async()=>{
 const f=fixture();await f.runner.create(p,input);f.fail(1);
 const result=await f.runner.runChunk(p,input.jobId);
 assert.deepEqual(result.results.map(r=>r.state),['saved','uncertain']);
 assert.deepEqual((await f.runner.runChunk(p,input.jobId)).results,[]);
 f.block();await assert.rejects(f.runner.runChunk(p,input.jobId),/FORBIDDEN/);
 assert.equal(f.writes(),2);
});
test('reject invalid payload before creating job; no production or read-only writes',async()=>{
 const f=fixture();
 await assert.rejects(f.runner.create({...p,environment:'production'},input),/FORBIDDEN/);
 await assert.rejects(f.runner.create({...p,scopes:['campaigns:read']},input),/FORBIDDEN/);
 await assert.rejects(f.runner.create(p,{...input,items:[{...input.items[0],blocks:[{id:id(8),text:'x',url:'https://example.invalid'}]}]}),/INVALID_DRAFT/);
 assert.equal(f.rows().length,0);
});
