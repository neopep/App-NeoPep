// Internal candidate. No scheduling or dispatch. Persistent payloads are immutable.
import {planDraftJob} from './draft-job.mjs';
import {prepareDraftAddition} from './draft-plan.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[0-9a-f]{12}$/i.test(v);
const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
const assertPrincipal=p=>{
 if(p?.environment!=='test'||p.campaignAdmin!==true||!uuid(p.id)||!uuid(p.ownerId)||!p.scopes?.includes('campaigns:read')||!p.scopes?.includes('campaigns:drafts'))throw Error('FORBIDDEN');
};
export function validateJobPayload(principal,input){
 assertPrincipal(principal);
 if(!input||Object.keys(input).some(k=>!['jobId','channel','campaignId','items'].includes(k)))throw Error('INVALID_JOB');
 const job=planDraftJob(input);
 for(const item of input.items){
  if(Object.keys(item).some(k=>!['publicationId','requestId','title','blocks','plannedLocal'].includes(k))||bytes(item)>15000)throw Error('INVALID_JOB');
  prepareDraftAddition({channel:job.channel,campaignId:job.campaignId,...item,ownerId:principal.ownerId});
 }
 if(bytes(input.items)>900000)throw Error('INVALID_JOB');
 return structuredClone(input);
}
export function createDraftJobRunner({broker,writeDraft,authorizeCurrent}){
 if(!broker||typeof writeDraft!=='function'||typeof authorizeCurrent!=='function')throw Error('INVALID_CONFIGURATION');
 async function gate(p){assertPrincipal(p);if(await authorizeCurrent(p)!==true)throw Error('FORBIDDEN');}
 return {
  async create(p,input){
   await gate(p);
   return broker.create(p,validateJobPayload(p,input));
  },
  async control(p,jobId,action){
   await gate(p);
   if(!uuid(jobId)||!['status','pause','resume','cancel'].includes(action))throw Error('INVALID_JOB');
   return broker.control(p,jobId,action);
  },
  async runChunk(p,jobId){
   await gate(p);if(!uuid(jobId))throw Error('INVALID_JOB');
   const chunk=await broker.claim(p,jobId);
   if(!Array.isArray(chunk)||chunk.length>6)throw Error('INVALID_BROKER_RESULT');
   const results=[];
   for(const row of chunk){
    // Lease and payload must come from the persistent broker, not from the caller.
    if(!uuid(row.requestId)||!uuid(row.publicationId)||!uuid(row.leaseId)||!uuid(row.campaignId)||!['app','whatsapp'].includes(row.channel)||row.item?.requestId!==row.requestId||row.item?.publicationId!==row.publicationId)throw Error('INVALID_BROKER_RESULT');
    let state='uncertain',revision=null;
    try{
     await gate(p);
     // Check pause/cancel/expiry immediately before starting a new native write.
     const status=await broker.control(p,jobId,'status');
     if(status.state!=='active')break; // existing leases expire to uncertain; do not replay
     const current=status.items?.find(x=>x.publicationId===row.publicationId);
     if(current?.state!=='leased')break;
     const reply=await writeDraft(p,'add_publications',{channel:row.channel,campaignId:row.campaignId,items:[row.item]});
     const receipt=reply?.results?.length===1?reply.results[0]:null;
     if(reply?.campaignId===row.campaignId&&reply.channel===row.channel&&receipt?.publicationId===row.publicationId&&receipt.status==='draft_saved_or_reused'&&Number.isSafeInteger(receipt.revision)&&receipt.revision>=1){state='saved';revision=receipt.revision;}
     // Any unconfirmed native result may have committed. Never auto-retry it.
    }catch{}
    let recorded=false;
    try{recorded=await broker.result(p,jobId,row.requestId,row.leaseId,state,revision)===true;}catch{}
    results.push({publicationId:row.publicationId,state:recorded?state:'uncertain',recorded,...(recorded&&state==='saved'?{revision}:{})});
    if(!recorded||state==='uncertain')break;
   }
   return {jobId,results};
  }
 };
}
