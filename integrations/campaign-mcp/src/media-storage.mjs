// Candidate only: no public route, service role, overwrite or automatic retry.
import {testProfile} from './environments.mjs';
import {planUpload,inspectUpload} from './media-plan.mjs';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export function createPrivateMediaStorage({profile,env,publishableKey,freshSession,verifyDatabase,request=fetch,validateBytes,now=Date.now}){
 const enabled=profile?.name==='test'&&profile.project===testProfile.project&&profile.supabaseOrigin===testProfile.supabaseOrigin&&env.NEO_CONNECT_AI_ENABLED==='1'&&env.NEO_CONNECT_AI_DRAFTS==='1'&&env.NEO_CONNECT_AI_MEDIA==='1';
 async function auth(p){
  if(!enabled||!publishableKey||p?.environment!=='test'||p.campaignAdmin!==true||!p.scopes?.includes('campaigns:read')||!p.scopes.includes('campaigns:drafts')||!Number.isFinite(p.expiresAt)||p.expiresAt<=now())throw Error('FORBIDDEN');
  await verifyDatabase();const token=await freshSession(p.id,p.ownerId);
  if(!token)throw Error('FORBIDDEN');return {apikey:publishableKey,Authorization:'Bearer '+token};
 }
 async function readObject(p,plan){
  const object=plan.bucket+'/'+plan.path,url=profile.supabaseOrigin+'/storage/v1/object/';
  const downloaded=await request(url+'authenticated/'+object,{method:'GET',headers:await auth(p),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!downloaded.ok||downloaded.headers.get('content-type')?.split(';')[0].trim()!==plan.mime||!downloaded.body)throw Error('MEDIA_UPLOAD_UNCONFIRMED');
  const declared=downloaded.headers.get('content-length');
  if(declared!==null&&Number(declared)!==plan.size)throw Error('MEDIA_UPLOAD_UNCONFIRMED');
  const reader=downloaded.body.getReader(),stored=new Uint8Array(plan.size);let offset=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;
   if(!(value instanceof Uint8Array)||offset+value.length>plan.size){await reader.cancel();throw Error('MEDIA_UPLOAD_UNCONFIRMED');}
   stored.set(value,offset);offset+=value.length;
  }}finally{reader.releaseLock();}
  if(offset!==plan.size)throw Error('MEDIA_UPLOAD_UNCONFIRMED');
  return stored;
 }
 const store=async function store(p,ticket,bytes){
  // Only a trusted server validator may authorize bytes; magic bytes are insufficient.
  if(typeof validateBytes!=='function')throw Error('MEDIA_VALIDATOR_UNAVAILABLE');
  if(!ticket||ticket.state!=='uploading'||ticket.ownerId!==p?.ownerId||ticket.connectionId!==p?.id||!['app','whatsapp'].includes(ticket.channel)||!Number.isFinite(Date.parse(ticket.expiresAt))||Date.parse(ticket.expiresAt)<=now())throw Error('INVALID_TICKET_RECEIPT');
  const plan=planUpload(p,{campaignId:ticket.campaignId,publicationId:ticket.publicationId,blockId:ticket.blockId,requestId:ticket.ticketId,revision:ticket.revision,mime:ticket.mime,size:ticket.size,name:ticket.name});
  if(ticket.requestId!==plan.requestId||ticket.bucket!==plan.bucket||ticket.path!==plan.path||ticket.blockType!==plan.blockType||(plan.mime==='image/jpeg'&&plan.size>1048576)||(ticket.channel==='app'&&plan.mime!=='image/jpeg'))throw Error('INVALID_TICKET_RECEIPT');
  await auth(p);
  if(!(bytes instanceof Uint8Array)||bytes.byteLength!==plan.size)throw Error('INVALID_MEDIA');
  const content=Uint8Array.from(bytes),check=await inspectUpload(plan,content,plan.mime);
  if(await validateBytes(plan.mime,Uint8Array.from(content))!==true)throw Error('INVALID_MEDIA');
  const object=plan.bucket+'/'+plan.path,url=profile.supabaseOrigin+'/storage/v1/object/',headers=await auth(p);
  if(Date.parse(ticket.expiresAt)<=now())throw Error('INVALID_TICKET_RECEIPT');
  const response=await request(url+object,{method:'POST',headers:{...headers,'Content-Type':plan.mime,'x-upsert':'false','cache-control':'0'},body:content,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('MEDIA_UPLOAD_UNCONFIRMED');
  const stored=await readObject(p,plan);
  if(await hash(stored)!==check.sha256)throw Error('MEDIA_UPLOAD_UNCONFIRMED');
  return {state:'bytes_verified',sha256:check.sha256,size:plan.size,ticketId:plan.requestId};
 };
 // Recovery is GET-only. It never returns bytes or trusts user-supplied hashes.
 store.recover=async(p,ticket)=>{
  await auth(p);
  if(typeof validateBytes!=='function')throw Error('MEDIA_VALIDATOR_UNAVAILABLE');
  if(!ticket||!['uncertain','stored'].includes(ticket.state)||ticket.ownerId!==p.ownerId||ticket.connectionId!==p.id||ticket.requestId!==ticket.ticketId||!['app','whatsapp'].includes(ticket.channel)||!(Date.parse(ticket.expiresAt)>now()))throw Error('INVALID_TICKET_RECEIPT');
  const plan=planUpload(p,{campaignId:ticket.campaignId,publicationId:ticket.publicationId,blockId:ticket.blockId,requestId:ticket.ticketId,revision:ticket.revision,mime:ticket.mime,size:ticket.size,name:ticket.name});
  if(ticket.path!==plan.path||ticket.bucket!==plan.bucket||ticket.blockType!==plan.blockType||(plan.mime==='image/jpeg'&&plan.size>1048576)||(ticket.channel==='app'&&plan.mime!=='image/jpeg'))throw Error('INVALID_TICKET_RECEIPT');
  const bytes=await readObject(p,plan),proof=await inspectUpload(plan,bytes,plan.mime);
  if(await validateBytes(plan.mime,Uint8Array.from(bytes))!==true)throw Error('INVALID_MEDIA');
  return {state:'bytes_verified',sha256:proof.sha256,size:proof.size,ticketId:plan.requestId};
 };
 return store;
}
