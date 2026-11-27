// Private Teste tickets; lease and storage receipt never cross the client boundary.
import {testProfile} from './environments.mjs';
import {createPrivateMediaStorage} from './media-storage.mjs';
import {createMediaAttachmentWriter} from './media-attachment-writer.mjs';
import {planUpload,inspectUpload} from './media-plan.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
export function createPrivateMediaTickets({profile,env,sql,verifyDatabase,freshSession,request=fetch,validateBytes,now=Date.now}){
 const enabled=profile?.name==='test'&&profile.project===testProfile.project&&profile.supabaseOrigin===testProfile.supabaseOrigin&&env.NEO_CONNECT_AI_ENABLED==='1'&&env.NEO_CONNECT_AI_DRAFTS==='1'&&env.NEO_CONNECT_AI_MEDIA==='1';
 async function authorize(p){
  if(!enabled||p?.environment!=='test'||p.campaignAdmin!==true||!uuid(p.id)||!uuid(p.ownerId)||!Number.isFinite(p.expiresAt)||p.expiresAt<=now()||!p.scopes?.includes('campaigns:read')||!p.scopes.includes('campaigns:drafts')||!await freshSession(p.id,p.ownerId))throw Error('FORBIDDEN');
  await verifyDatabase();
 }
 async function call(p,ticket,action,data,expected){
  const [row]=await sql`select neo_private.connect_ai_media_ticket(${p.id}::uuid,${p.ownerId}::uuid,${ticket}::uuid,${action}::text,${JSON.stringify(data)}::jsonb) as value`;
  const v=row?.value;
  if(!v||v.ticketId!==ticket||v.requestId!==ticket||v.ownerId!==p.ownerId||v.connectionId!==p.id||!['issued','uploading','stored','uncertain'].includes(v.state)||!['app','whatsapp'].includes(v.channel)||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=now()||(action==='claim'?!uuid(v.leaseId):v.leaseId!=null))throw Error('INVALID_TICKET_RECEIPT');
  const plan=planUpload(p,{campaignId:v.campaignId,publicationId:v.publicationId,blockId:v.blockId,requestId:ticket,revision:v.revision,mime:v.mime,size:v.size,name:v.name});
  if(v.bucket!==plan.bucket||v.path!==plan.path||v.blockType!==plan.blockType||(v.mime==='image/jpeg'&&v.size>1048576)||(v.channel==='app'&&v.mime!=='image/jpeg')||(expected&&Object.keys(expected).some(k=>v[k]!==expected[k])))throw Error('INVALID_TICKET_RECEIPT');
  return v;
 }
 const project=v=>({ticketId:v.ticketId,channel:v.channel,campaignId:v.campaignId,publicationId:v.publicationId,blockId:v.blockId,revision:v.revision,mime:v.mime,size:v.size,name:v.name,state:v.state,expiresAt:v.expiresAt,uploadAvailable:false});
 const store=createPrivateMediaStorage({profile,env,publishableKey:env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY,freshSession,verifyDatabase,request,validateBytes,now});
 const attach=createMediaAttachmentWriter({profile,env,freshSession,verifyDatabase,request,now});
 return {
  async issue(p,input){
   await authorize(p);
   if(!input||!['app','whatsapp'].includes(input.channel))throw Error('INVALID_MEDIA');
   const {channel,...fields}=input;
   const plan=planUpload(p,fields);
   if((plan.mime==='image/jpeg'&&plan.size>1048576)||(channel==='app'&&plan.mime!=='image/jpeg'))throw Error('INVALID_MEDIA');
   const data={channel,campaignId:plan.campaignId,publicationId:plan.publicationId,blockId:plan.blockId,revision:plan.revision,mime:plan.mime,size:plan.size,name:plan.name};
   return project(await call(p,plan.requestId,'issue',data,data));
  },
  async inspect(p,ticket){await authorize(p);if(!uuid(ticket))throw Error('INVALID_MEDIA');return project(await call(p,ticket,'inspect',{}));},
  async reconcileAttachment(p,ticket){
   await authorize(p);if(!uuid(ticket))throw Error('INVALID_MEDIA');
   const [row]=await sql`select neo_private.connect_ai_media_attachment_receipt(${p.id}::uuid,${p.ownerId}::uuid,${ticket}::uuid) as value`;
   const v=row?.value;
   if(v?.ticketId!==ticket||!uuid(v.publicationId)||!['attached_historically','unconfirmed'].includes(v.state)||(v.state==='attached_historically'&&(!Number.isSafeInteger(v.revision)||v.revision<2)))throw Error('INVALID_TICKET_RECEIPT');
   return {ticketId:ticket,publicationId:v.publicationId,state:v.state,...(v.state==='attached_historically'?{revision:v.revision}:{})};
  },
  async uploadAndAttach(p,ticket,bytes){
   await authorize(p);
   if(typeof validateBytes!=='function')throw Error('MEDIA_VALIDATOR_UNAVAILABLE');
   if(!uuid(ticket))throw Error('INVALID_MEDIA');
   const initial=await call(p,ticket,'inspect',{});
   if(initial.state!=='issued')throw Error('TICKET_NOT_AVAILABLE');
   const plan=planUpload(p,{campaignId:initial.campaignId,publicationId:initial.publicationId,blockId:initial.blockId,requestId:ticket,revision:initial.revision,mime:initial.mime,size:initial.size,name:initial.name});
   // Validate before acquiring lease; keep a stable byte copy.
   if(!(bytes instanceof Uint8Array)||bytes.length!==plan.size)throw Error('INVALID_MEDIA');
   const content=Uint8Array.from(bytes);
   const inspection=await inspectUpload(plan,content,plan.mime);
   if(await validateBytes(plan.mime,Uint8Array.from(content))!==true)throw Error('INVALID_MEDIA');
   await authorize(p);
   // No object write if the draft is no longer at the ticket revision.
   await attach(p,initial,null);
   const expected=Object.fromEntries(['channel','campaignId','publicationId','blockId','revision','mime','size','name'].map(k=>[k,initial[k]]));
   const claimed=await call(p,ticket,'claim',{},expected);
   if(claimed.state!=='uploading')throw Error('INVALID_TICKET_RECEIPT');
   let stored;
   try{
    const proof=await store(p,claimed,content);
    if(proof.state!=='bytes_verified'||proof.ticketId!==ticket||proof.sha256!==inspection.sha256||proof.size!==plan.size)throw Error('MEDIA_UPLOAD_UNCONFIRMED');
    await authorize(p);
    stored=await call(p,ticket,'finish',{leaseId:claimed.leaseId,state:'stored',sha256:proof.sha256},expected);
    if(stored.state!=='stored'||stored.sha256!==proof.sha256)throw Error('MEDIA_UPLOAD_UNCONFIRMED');
   }catch{
    try{await authorize(p);await call(p,ticket,'finish',{leaseId:claimed.leaseId,state:'uncertain'},expected);}catch{}
    return {ticketId:ticket,state:'upload_unconfirmed'};
   }
   try{
    const receipt=await attach(p,stored,inspection.sha256);
    return {ticketId:ticket,state:'attached',publicationId:receipt.publicationId,revision:receipt.revision};
   }catch{return {ticketId:ticket,state:'stored_attachment_unconfirmed'};}
  }
 };
}
