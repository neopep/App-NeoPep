// Teste only. Trusted binary transport, not a public MCP route.
// Require a real format validator: magic bytes alone never authorize storage.
import {planUpload,inspectUpload} from './media-plan.mjs';
import {testProfile} from './environments.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[0-9a-f]{12}$/i.test(v);
const allowed=p=>p?.environment==='test'&&p.campaignAdmin===true&&uuid(p.id)&&uuid(p.ownerId)&&p.scopes?.includes('campaigns:read')&&p.scopes?.includes('campaigns:drafts');
const publicTicket=t=>({ticketId:t.ticketId,state:t.state,mime:t.mime,size:t.size,expiresAt:t.expiresAt,...(t.state==='stored'?{sha256:t.sha256}:{})});
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export function stagedPlan(p,input){
 if(!allowed(p))throw Error('FORBIDDEN');
 if(!input||!['app','whatsapp'].includes(input.channel))throw Error('INVALID_MEDIA');
 const {channel,...fields}=input;
 if(channel==='app'&&fields.mime!=='image/jpeg'||fields.mime==='image/jpeg'&&fields.size>1048576)throw Error('INVALID_MEDIA');
 const plan=planUpload(p,fields);
 return {...plan,channel};
}
function verifiedPlan(p,t,id){
 if(!t||t.ticketId!==id||t.requestId!==id||t.connectionId!==p.id||t.ownerId!==p.ownerId||Date.parse(t.expiresAt)<=Date.now())throw Error('MEDIA_NOT_VERIFIED');
 const expected=stagedPlan(p,{channel:t.channel,campaignId:t.campaignId,publicationId:t.publicationId,blockId:t.blockId,requestId:id,revision:t.revision,mime:t.mime,size:t.size,name:t.name});
 if(t.bucket!==expected.bucket||t.path!==expected.path||t.blockType!==expected.blockType)throw Error('MEDIA_NOT_VERIFIED');
 return expected;
}
export function createMediaTransfer({broker,storage,authorizeCurrent,validateFull}){
 if(typeof authorizeCurrent!=='function'||typeof validateFull!=='function'||!broker||!storage)throw Error('INVALID_CONFIGURATION');
 const gate=async p=>{if(!allowed(p)||await authorizeCurrent(p)!==true)throw Error('FORBIDDEN');};
 return {
  async issue(p,input){
   await gate(p);const plan=stagedPlan(p,input);
   const t=await broker.ticket(p,plan.requestId,'issue',{channel:plan.channel,campaignId:plan.campaignId,publicationId:plan.publicationId,blockId:plan.blockId,revision:plan.revision,mime:plan.mime,size:plan.size,name:plan.name});
   verifiedPlan(p,t,plan.requestId);return publicTicket(t);
  },
  async status(p,id){
   await gate(p);if(!uuid(id))throw Error('INVALID_MEDIA');
   const t=await broker.ticket(p,id,'inspect',{});verifiedPlan(p,t,id);return publicTicket(t);
  },
  async upload(p,id,bytes,mime){
   await gate(p);if(!uuid(id))throw Error('INVALID_MEDIA');
   const t=await broker.ticket(p,id,'inspect',{}),plan=verifiedPlan(p,t,id);
   if(t.state!=='issued')throw Error('TICKET_NOT_AVAILABLE');
   const checked=await inspectUpload(plan,bytes,mime);
   if(await validateFull(plan,bytes)!==true)throw Error('INVALID_MEDIA');
   // Freeze the verified bytes, and reject mutation by an injected validator.
   if(await hash(bytes)!==checked.sha256)throw Error('INVALID_MEDIA');
   const content=new Uint8Array(bytes);
   await gate(p);
   const claim=await broker.ticket(p,id,'claim',{});
   verifiedPlan(p,claim,id);
   if(claim.state!=='uploading'||!uuid(claim.leaseId))throw Error('TICKET_NOT_AVAILABLE');
   try{
    await gate(p);
    await storage.put(p,plan,content);
    const stored=await storage.read(p,plan);
    if(!(stored instanceof Uint8Array)||stored.length!==plan.size||await hash(stored)!==checked.sha256)throw Error('MEDIA_NOT_VERIFIED');
    await gate(p);
    const done=await broker.ticket(p,id,'finish',{leaseId:claim.leaseId,state:'stored',sha256:checked.sha256});
    verifiedPlan(p,done,id);
    if(done.state!=='stored'||done.sha256!==checked.sha256)throw Error('MEDIA_NOT_VERIFIED');
    return publicTicket(done);
   }catch{
    try{await broker.ticket(p,id,'finish',{leaseId:claim.leaseId,state:'uncertain'});}catch{}
    throw Error('UPLOAD_UNCERTAIN');
   }
  },
  async resolve(p,id,target){
   await gate(p);if(!uuid(id))throw Error('INVALID_MEDIA');
   const t=await broker.ticket(p,id,'inspect',{}),plan=verifiedPlan(p,t,id);
   if(t.state!=='stored'||!/^[a-f0-9]{64}$/.test(t.sha256)||['channel','campaignId','publicationId','blockId','revision'].some(k=>target[k]!==plan[k]))throw Error('MEDIA_NOT_VERIFIED');
   const stored=await storage.read(p,plan);
   if(!(stored instanceof Uint8Array)||stored.length!==plan.size||await hash(stored)!==t.sha256)throw Error('MEDIA_NOT_VERIFIED');
   return {...plan,state:'stored_and_validated',sha256:t.sha256};
  }
 };
}
export function createNativeMediaStorage({publishableKey,sessionFor,request=fetch,profile=testProfile}){
 if(profile.name!=='test'||profile.project!==testProfile.project||profile.supabaseOrigin!==testProfile.supabaseOrigin||!publishableKey||typeof sessionFor!=='function')throw Error('INVALID_CONFIGURATION');
 async function context(p,plan){
  if(!allowed(p)||plan.ownerId!==p.ownerId||plan.connectionId!==p.id||!uuid(plan.requestId))throw Error('FORBIDDEN');
  const expected=stagedPlan(p,{channel:plan.channel,campaignId:plan.campaignId,publicationId:plan.publicationId,blockId:plan.blockId,requestId:plan.requestId,revision:plan.revision,mime:plan.mime,size:plan.size,name:plan.name});
  if(plan.path!==expected.path||plan.bucket!==expected.bucket)throw Error('INVALID_MEDIA');
  const token=await sessionFor(p.id,p.ownerId);if(!token)throw Error('AUTH_REQUIRED');
  const headers={apikey:publishableKey,Authorization:'Bearer '+token};
  const identity=await request(profile.supabaseOrigin+'/auth/v1/user',{headers,redirect:'manual',signal:AbortSignal.timeout(5000)});
  if(!identity.ok||(await identity.json()).id!==p.ownerId)throw Error('FORBIDDEN');
  const suffix=plan.bucket+'/'+plan.path.split('/').map(encodeURIComponent).join('/');
  return {headers,suffix};
 }
 return {
  async put(p,plan,bytes){
   if(!(bytes instanceof Uint8Array)||bytes.length!==plan.size)throw Error('INVALID_MEDIA');
   const {headers,suffix}=await context(p,plan);
   const r=await request(profile.supabaseOrigin+'/storage/v1/object/'+suffix,{method:'POST',headers:{...headers,'Content-Type':plan.mime,'x-upsert':'false','Cache-Control':'no-store'},body:bytes,redirect:'manual',signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw Error('UPLOAD_UNCERTAIN');
  },
  async read(p,plan){
   const {headers,suffix}=await context(p,plan);
   const r=await request(profile.supabaseOrigin+'/storage/v1/object/authenticated/'+suffix,{headers,redirect:'manual',signal:AbortSignal.timeout(20000)});
   if(!r.ok||!r.body)throw Error('MEDIA_NOT_VERIFIED');
   const reader=r.body.getReader(),out=new Uint8Array(plan.size);let offset=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;if(offset+value.length>out.length)throw Error('MEDIA_NOT_VERIFIED');out.set(value,offset);offset+=value.length;}}finally{await reader.cancel().catch(()=>{});}
   if(offset!==out.length)throw Error('MEDIA_NOT_VERIFIED');return out;
  }
 };
}
