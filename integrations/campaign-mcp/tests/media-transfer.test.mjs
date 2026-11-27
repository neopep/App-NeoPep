import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMediaTransfer,createNativeMediaStorage} from '../src/media-transfer.mjs';
import {prepareStagedDraftAddition} from '../src/staged-draft-media.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p={id:id(1),ownerId:id(2),environment:'test',campaignAdmin:true,scopes:['campaigns:read','campaigns:drafts']};
const input={channel:'whatsapp',campaignId:id(3),publicationId:id(4),blockId:id(5),requestId:id(6),revision:0,mime:'image/jpeg',size:5,name:'fixture.jpg'};
const bytes=new Uint8Array([255,216,255,255,217]); // signature fixture only, not a decoded JPEG
function fixture({valid=true,corrupt=false}={}){
 let row,stored,writes=0;
 const broker={async ticket(p,i,a,d){
  if(a==='issue')row={...d,ticketId:i,requestId:i,connectionId:p.id,ownerId:p.ownerId,bucket:'neo-campaign-images',path:p.ownerId+'/'+i+'.jpg',blockType:'image',state:'issued',expiresAt:new Date(Date.now()+60000).toISOString()};
  if(a==='claim')row={...row,state:'uploading',leaseId:id(9)};
  if(a==='finish')row={...row,state:d.state,sha256:d.sha256};
  return structuredClone(row);
 }};
 const storage={async put(p,plan,b){writes++;stored=new Uint8Array(b);},async read(){return corrupt?new Uint8Array(5):stored;}};
 const transfer=createMediaTransfer({broker,storage,authorizeCurrent:async()=>true,validateFull:async()=>valid});
 return {transfer,writes:()=>writes};
}
test('ticket transfer verifies bytes, readback hash, immutable target and no private paths in public receipt',async()=>{
 const f=fixture();const issued=await f.transfer.issue(p,input);
 assert.equal(issued.state,'issued');assert.equal(issued.path,undefined);
 const done=await f.transfer.upload(p,input.requestId,bytes,input.mime);
 assert.equal(done.state,'stored');assert.equal(done.sha256.length,64);assert.equal(done.bucket,undefined);
 const native=await prepareStagedDraftAddition(p,{channel:input.channel,campaignId:input.campaignId,publicationId:input.publicationId,requestId:id(10),title:'Fixture',blocks:[{id:input.blockId,text:'*Legenda*',mediaTicketId:input.requestId}]},f.transfer.resolve);
 assert.equal(native.p_data.draft.blocks[0].media_path,p.ownerId+'/'+input.requestId+'.jpg');
 assert.equal(native.p_data.draft.blocks[0].text,'*Legenda*');
 await assert.rejects(f.transfer.resolve(p,input.requestId,{...input,blockId:id(99)}),/MEDIA_NOT_VERIFIED/);
 await assert.rejects(f.transfer.upload(p,input.requestId,bytes,input.mime),/TICKET_NOT_AVAILABLE/);
 assert.equal(f.writes(),1);
});
test('full format validation required; uncertain upload never automatically repeats',async()=>{
 const f=fixture({valid:false});await f.transfer.issue(p,input);
 await assert.rejects(f.transfer.upload(p,input.requestId,bytes,input.mime),/INVALID_MEDIA/);
 assert.equal(f.writes(),0);
 const g=fixture({corrupt:true});await g.transfer.issue(p,input);
 await assert.rejects(g.transfer.upload(p,input.requestId,bytes,input.mime),/UPLOAD_UNCERTAIN/);
 await assert.rejects(g.transfer.upload(p,input.requestId,bytes,input.mime),/TICKET_NOT_AVAILABLE/);
 assert.equal(g.writes(),1);
 await assert.rejects(f.transfer.issue({...p,environment:'production'},input),/FORBIDDEN/);
 await assert.rejects(f.transfer.issue(p,{...input,size:1048577}),/INVALID_MEDIA/);
});
test('native adapter uses fixed private storage, no upsert, no redirects, and verifies identity',async()=>{
 const calls=[];
 const storage=createNativeMediaStorage({publishableKey:'fixture',sessionFor:async()=>'fixture-token',request:async(url,opts)=>{
  calls.push({url,opts});if(url.endsWith('/auth/v1/user'))return Response.json({id:p.ownerId});
  return opts.method==='POST'?Response.json({}):new Response(bytes);
 }});
 const f=fixture();await f.transfer.issue(p,input);await f.transfer.upload(p,input.requestId,bytes,input.mime);
 const plan=await f.transfer.resolve(p,input.requestId,input);
 await storage.put(p,plan,bytes);assert.deepEqual(await storage.read(p,plan),bytes);
 assert.equal(calls[1].opts.headers['x-upsert'],'false');assert.equal(calls[1].opts.redirect,'manual');
 assert.match(calls[3].url,/\/storage\/v1\/object\/authenticated\/neo-campaign-images\//);
 await assert.rejects(storage.put(p,{...plan,path:'other/private.jpg'},bytes),/INVALID_MEDIA/);
});
