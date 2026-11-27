import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateMediaTickets} from '../src/media-ticket-broker.mjs';
import {testProfile,productionProfile} from '../src/environments.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p={id:id(1),ownerId:id(2),environment:'test',campaignAdmin:true,expiresAt:60000,scopes:['campaigns:read','campaigns:drafts']};
const input={channel:'whatsapp',campaignId:id(3),publicationId:id(4),blockId:id(5),requestId:id(6),revision:1,mime:'image/jpeg',size:1048576,name:'fixture.jpg'};
function fixture(){
 const calls=[];let verified=false,live=true;
 const value={ticketId:input.requestId,requestId:input.requestId,ownerId:p.ownerId,connectionId:p.id,channel:input.channel,campaignId:input.campaignId,publicationId:input.publicationId,blockId:input.blockId,revision:1,mime:input.mime,size:input.size,name:input.name,bucket:'neo-campaign-images',path:p.ownerId+'/'+input.requestId+'.jpg',blockType:'image',state:'issued',expiresAt:new Date(50000).toISOString(),leaseId:null};
 const deps={profile:testProfile,env:{NEO_CONNECT_AI_ENABLED:'1',NEO_CONNECT_AI_DRAFTS:'1',NEO_CONNECT_AI_MEDIA:'1'},now:()=>0,verifyDatabase:async()=>{verified=true;},freshSession:async()=>live?'fixture':null,
 sql:async(parts,...args)=>{assert.ok(verified);assert.match(parts.join('?'),/connect_ai_media_ticket/);assert.deepEqual(args.slice(0,3),[p.id,p.ownerId,input.requestId]);assert.ok(['issue','inspect'].includes(args[3]));calls.push(args);return [{value}];}};
 return {deps,value,calls,revoke:()=>live=false};
}
test('private ticket issue/inspect match deployed contract and do not expose path or lease',async()=>{
 const f=fixture(),api=createPrivateMediaTickets(f.deps),r=await api.issue(p,input);
 assert.equal(r.uploadAvailable,false);assert.equal(r.ticketId,input.requestId);assert.equal(r.path,undefined);assert.equal(r.leaseId,undefined);assert.equal(r.ownerId,undefined);
 assert.equal((await api.inspect(p,input.requestId)).state,'issued');
 assert.equal(f.calls.length,2);assert.equal(JSON.parse(f.calls[0][4]).size,1048576);assert.equal(api.claim,undefined);assert.equal(api.finish,undefined);
});
test('native image cap and App MIME policy are enforced before SQL',async()=>{
 const f=fixture(),api=createPrivateMediaTickets(f.deps);
 await assert.rejects(api.issue(p,{...input,size:1048577}),/INVALID_MEDIA/);
 await assert.rejects(api.issue(p,{...input,channel:'app',mime:'application/pdf'}),/INVALID_MEDIA/);
 await assert.rejects(api.issue(p,{...input,url:'https://invalid.example'}),/INVALID_MEDIA/);
 assert.equal(f.calls.length,0);
});
test('scope, flags, environment, revocation and marker mismatch reject calls',async()=>{
 const f=fixture();
 for(const flag of ['NEO_CONNECT_AI_ENABLED','NEO_CONNECT_AI_DRAFTS','NEO_CONNECT_AI_MEDIA'])await assert.rejects(createPrivateMediaTickets({...f.deps,env:{...f.deps.env,[flag]:'0'}}).issue(p,input),/FORBIDDEN/);
 await assert.rejects(createPrivateMediaTickets({...f.deps,profile:productionProfile}).issue(p,input),/FORBIDDEN/);
 await assert.rejects(createPrivateMediaTickets(f.deps).issue({...p,scopes:['campaigns:drafts']},input),/FORBIDDEN/);
 await assert.rejects(createPrivateMediaTickets({...f.deps,verifyDatabase:async()=>{throw Error('MARKER');}}).issue(p,input),/MARKER/);
 f.revoke();await assert.rejects(createPrivateMediaTickets(f.deps).issue(p,input),/FORBIDDEN/);assert.equal(f.calls.length,0);
});
test('mismatched ownership, path, size or lease never becomes trusted ticket',async()=>{
 for(const change of [{ownerId:id(99)},{path:'other/path.jpg'},{size:1},{leaseId:id(9)}]){
  const f=fixture();Object.assign(f.value,change);await assert.rejects(createPrivateMediaTickets(f.deps).issue(p,input),/INVALID_TICKET_RECEIPT/);
 }
});
