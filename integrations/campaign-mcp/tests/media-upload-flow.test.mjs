import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateMediaTickets} from '../src/media-ticket-broker.mjs';
import {testProfile} from '../src/environments.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p={id:id(1),ownerId:id(2),environment:'test',campaignAdmin:true,expiresAt:60000,scopes:['campaigns:read','campaigns:drafts']};
const bytes=new Uint8Array([255,216,255,255,217]),ticket=id(6);
function fixture(){
 let state='issued',sha256=null,revision=1;const calls=[],draft={title:'Original',blocks:[{id:id(9),type:'text',text:'Preserve'}],groups:[],audience:'all',timezone:'America/Sao_Paulo',planned_local:''};
 const deps={profile:testProfile,env:{NEO_CONNECT_AI_ENABLED:'1',NEO_CONNECT_AI_DRAFTS:'1',NEO_CONNECT_AI_MEDIA:'1',NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY:'fixture'},now:()=>0,verifyDatabase:async()=>{},freshSession:async()=> 'fixture',validateBytes:async()=>true,
 sql:async(parts,...args)=>{assert.match(parts.join('?'),/connect_ai_media_ticket/);const action=args[3],data=JSON.parse(args[4]);calls.push(action);
 if(action==='claim'){assert.equal(state,'issued');state='uploading';}
 if(action==='finish'){assert.equal(data.leaseId,id(8));state=data.state;sha256=data.sha256??null;}
 return [{value:{ticketId:ticket,requestId:ticket,connectionId:p.id,ownerId:p.ownerId,channel:'whatsapp',campaignId:id(3),publicationId:id(4),blockId:id(5),revision:1,mime:'image/jpeg',size:5,name:'fixture.jpg',bucket:'neo-campaign-images',path:p.ownerId+'/'+ticket+'.jpg',blockType:'image',state,sha256,expiresAt:new Date(50000).toISOString(),leaseId:action==='claim'?id(8):null}}];},
 request:async(url,init)=>{
 if(url.includes('/storage/')){calls.push(init.method);return init.method==='POST'?Response.json({}):new Response(bytes,{headers:{'Content-Type':'image/jpeg'}});}
 const {p_action,p_data}=JSON.parse(init.body);calls.push(p_action);
 if(p_action==='get')return Response.json({campaign_id:id(3),deleted_at:null,publications:[{id:id(4),revision,batches:[]}]});
 if(p_action==='load')return Response.json({editor_id:id(4),source_id:id(3),channel:'whatsapp',revision,draft});
 assert.equal(p_action,'save');assert.equal(state,'stored');assert.equal(p_data.revision,1);assert.equal(p_data.request_id,ticket);assert.deepEqual(p_data.draft.blocks[0],draft.blocks[0]);assert.equal(p_data.draft.blocks[1].media_path,p.ownerId+'/'+ticket+'.jpg');
 return Response.json({editor_id:id(4),source_id:id(3),channel:'whatsapp',revision:2});
 }};
 return {deps,calls,stale:()=>revision=2};
}
test('private upload verifies storage and finishes ticket before revision-checked attachment',async()=>{
 const f=fixture(),r=await createPrivateMediaTickets(f.deps).uploadAndAttach(p,ticket,bytes);
 assert.deepEqual(r,{ticketId:ticket,state:'attached',publicationId:id(4),revision:2});
 assert.deepEqual(f.calls,['inspect','get','load','claim','POST','GET','finish','get','load','save']);
});
test('missing validator or stale draft blocks claim and object write',async()=>{
 const f=fixture();await assert.rejects(createPrivateMediaTickets({...f.deps,validateBytes:undefined}).uploadAndAttach(p,ticket,bytes),/MEDIA_VALIDATOR_UNAVAILABLE/);
 f.stale();await assert.rejects(createPrivateMediaTickets(f.deps).uploadAndAttach(p,ticket,bytes),/REVISION_CONFLICT/);assert.ok(!f.calls.includes('claim'));
});
test('ambiguous upload marks uncertain, never saves or retries',async()=>{
 const f=fixture(),request=f.deps.request;f.deps.request=async(url,init)=>{if(url.includes('/storage/')&&init.method==='POST'){f.calls.push('POST');throw Error('timeout');}return request(url,init);};
 const r=await createPrivateMediaTickets(f.deps).uploadAndAttach(p,ticket,bytes);assert.equal(r.state,'upload_unconfirmed');assert.equal(f.calls.filter(x=>x==='POST').length,1);assert.ok(!f.calls.includes('save'));assert.equal(f.calls.at(-1),'finish');
});
test('changed revision after storage leaves attachment unconfirmed and never rewrites',async()=>{
 const f=fixture(),request=f.deps.request;f.deps.request=async(url,init)=>{const r=await request(url,init);if(url.includes('/storage/')&&init.method==='GET')f.stale();return r;};
 const r=await createPrivateMediaTickets(f.deps).uploadAndAttach(p,ticket,bytes);assert.equal(r.state,'stored_attachment_unconfirmed');assert.ok(!f.calls.includes('save'));
});
