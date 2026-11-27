import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planUpload,inspectUpload,prepareAttachment} from '../src/media-plan.mjs';
import {planDraftJob,nextDraftChunk,recordDraftResult,jobProgress} from '../src/draft-job.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const principal={environment:'test',campaignAdmin:true,scopes:['campaigns:drafts'],ownerId:id(1),id:id(2)};
const input={campaignId:id(3),publicationId:id(4),blockId:id(5),requestId:id(6),revision:1,mime:'image/jpeg',size:5,name:'creative.jpg'};
test('media restricts destination, type, size, environment and arbitrary URLs',async()=>{
 const plan=planUpload(principal,input);
 assert.equal(plan.path,id(1)+'/'+id(6)+'.jpg');assert.equal(planUpload(principal,{...input,size:5242880}).limit,5242880);
 assert.throws(()=>planUpload({...principal,environment:'production'},input),/FORBIDDEN/);
 assert.throws(()=>planUpload(principal,{...input,url:'http://127.0.0.1/'}),/INVALID_MEDIA/);
 assert.throws(()=>planUpload(principal,{...input,size:5242881}),/INVALID_MEDIA/);
 await assert.rejects(inspectUpload(plan,new Uint8Array([0,1,2,3,4]),input.mime),/INVALID_MEDIA/);
 const check=await inspectUpload(plan,new Uint8Array([255,216,255,255,217]),input.mime);
 assert.equal(check.readyForUpload,false);assert.equal(check.sha256.length,64);
});
test('attachment is bound to owner, revision, connection, publication and block',()=>{
 const plan=planUpload(principal,input);
 const current={ownerId:principal.ownerId,campaignId:input.campaignId,publicationId:input.publicationId,revision:1,status:'draft',draft:{blocks:[{id:input.blockId,type:'image',text:'Legenda'}]}};
 const verified={...plan,state:'stored_and_validated'};
 assert.throws(()=>prepareAttachment(plan,current,{...verified,connectionId:id(99)}),/MEDIA_NOT_VERIFIED/);
 assert.throws(()=>prepareAttachment(plan,{...current,revision:2},verified),/REVISION_CONFLICT/);
 assert.equal(prepareAttachment(plan,current,verified).blocks[0].media_path,plan.path);
 assert.equal(current.draft.blocks[0].media_path,undefined);
});
test('60 drafts chunked into 6; completed and uncertain items are not replayed',()=>{
 const items=Array.from({length:60},(_,i)=>({publicationId:id(100+i),requestId:id(200+i)}));
 let job=planDraftJob({jobId:id(7),channel:'app',campaignId:id(3),items});
 assert.equal(nextDraftChunk(job).length,6);
 job=recordDraftResult(job,{...items[0],state:'saved',revision:1});
 job=recordDraftResult(job,{...items[1],state:'uncertain'});
 job=recordDraftResult(job,{...items[2],state:'retryable'});
 assert.equal(nextDraftChunk(job)[0].requestId,items[2].requestId);
 assert.equal(jobProgress(job).saved,1);assert.equal(jobProgress(job).uncertain,1);
 assert.throws(()=>recordDraftResult(job,{...items[0],state:'saved',revision:2}),/INVALID_RECEIPT/);
 assert.throws(()=>planDraftJob({jobId:id(7),channel:'app',campaignId:id(3),items:[items[0],items[0]]}),/INVALID_JOB/);
});
