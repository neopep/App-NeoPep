import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateMediaStorage} from '../src/media-storage.mjs';
import {testProfile,productionProfile} from '../src/environments.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p={id:id(1),ownerId:id(2),environment:'test',campaignAdmin:true,expiresAt:60000,scopes:['campaigns:read','campaigns:drafts']};
const bytes=new Uint8Array([255,216,255,255,217]);
const ticket={ticketId:id(6),requestId:id(6),ownerId:p.ownerId,connectionId:p.id,channel:'whatsapp',campaignId:id(3),publicationId:id(4),blockId:id(5),revision:1,mime:'image/jpeg',size:5,name:'fixture.jpg',bucket:'neo-campaign-images',path:p.ownerId+'/'+id(6)+'.jpg',blockType:'image',state:'uploading',expiresAt:new Date(50000).toISOString()};
function fixture(){
 const calls=[];let live=true,valid=true,readback=bytes;
 const deps={profile:testProfile,env:{NEO_CONNECT_AI_ENABLED:'1',NEO_CONNECT_AI_DRAFTS:'1',NEO_CONNECT_AI_MEDIA:'1'},publishableKey:'fixture',now:()=>0,verifyDatabase:async()=>{},freshSession:async()=>live?'fixture-token':null,validateBytes:async()=>valid,
 request:async(url,init)=>{calls.push({url,init});assert.equal(new URL(url).origin,testProfile.supabaseOrigin);assert.equal(init.headers.Authorization,'Bearer fixture-token');assert.equal(init.redirect,'error');
 if(init.method==='POST')return Response.json({Key:ticket.bucket+'/'+ticket.path});
 return new Response(readback,{headers:{'Content-Type':ticket.mime}});
 }};
 return {deps,calls,revoke:()=>live=false,invalid:()=>valid=false,replace:b=>readback=b};
}
test('uploads once, never overwrites, verifies private readback and digest',async()=>{
 const f=fixture(),r=await createPrivateMediaStorage(f.deps)(p,ticket,bytes);
 assert.equal(r.state,'bytes_verified');assert.equal(r.sha256.length,64);assert.equal(f.calls.length,2);assert.equal(f.calls[0].init.headers['x-upsert'],'false');assert.deepEqual(f.calls[0].init.body,bytes);assert.match(f.calls[1].url,/object\/authenticated\/neo-campaign-images\//);assert.equal(r.path,undefined);
});
test('missing trusted validator, invalid content, wrong owner or environment blocks upload',async()=>{
 const f=fixture();await assert.rejects(createPrivateMediaStorage({...f.deps,validateBytes:undefined})(p,ticket,bytes),/MEDIA_VALIDATOR_UNAVAILABLE/);
 await assert.rejects(createPrivateMediaStorage({...f.deps,profile:productionProfile})(p,ticket,bytes),/FORBIDDEN/);
 await assert.rejects(createPrivateMediaStorage(f.deps)(p,{...ticket,path:'wrong/path'},bytes),/INVALID_TICKET_RECEIPT/);
 await assert.rejects(createPrivateMediaStorage(f.deps)(p,{...ticket,ownerId:id(99)},bytes),/INVALID_TICKET_RECEIPT/);
 f.invalid();await assert.rejects(createPrivateMediaStorage(f.deps)(p,ticket,bytes),/INVALID_MEDIA/);assert.equal(f.calls.length,0);
});
test('mismatched bytes, oversized response and uncertain POST never retry',async()=>{
 for(const bad of [new Uint8Array([255,216,0,255,217]),new Uint8Array(6)]){
  const f=fixture();f.replace(bad);await assert.rejects(createPrivateMediaStorage(f.deps)(p,ticket,bytes),/MEDIA_UPLOAD_UNCONFIRMED/);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
 }
 const f=fixture();let n=0;f.deps.request=async()=>{n++;throw Error('timeout');};
 await assert.rejects(createPrivateMediaStorage(f.deps)(p,ticket,bytes),/timeout/);assert.equal(n,1);
});
test('revalidates session before upload',async()=>{
 const f=fixture();f.deps.validateBytes=async()=>{f.revoke();return true;};await assert.rejects(createPrivateMediaStorage(f.deps)(p,ticket,bytes),/FORBIDDEN/);assert.equal(f.calls.length,0);
});
