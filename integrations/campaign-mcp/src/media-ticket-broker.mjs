// Teste candidate: private ticket reservation and inspection only; no upload or finish.
import {testProfile} from './environments.mjs';
import {planUpload} from './media-plan.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
export function createPrivateMediaTickets({profile,env,sql,verifyDatabase,freshSession,now=Date.now}){
 const enabled=profile?.name==='test'&&profile.project===testProfile.project&&profile.supabaseOrigin===testProfile.supabaseOrigin&&env.NEO_CONNECT_AI_ENABLED==='1'&&env.NEO_CONNECT_AI_DRAFTS==='1'&&env.NEO_CONNECT_AI_MEDIA==='1';
 async function authorize(p){
  if(!enabled||p?.environment!=='test'||p.campaignAdmin!==true||!uuid(p.id)||!uuid(p.ownerId)||!Number.isFinite(p.expiresAt)||p.expiresAt<=now()||!p.scopes?.includes('campaigns:read')||!p.scopes.includes('campaigns:drafts')||!await freshSession(p.id,p.ownerId))throw Error('FORBIDDEN');
  await verifyDatabase();
 }
 async function call(p,ticket,action,data,expected){
  const [row]=await sql`select neo_private.connect_ai_media_ticket(${p.id}::uuid,${p.ownerId}::uuid,${ticket}::uuid,${action}::text,${JSON.stringify(data)}::jsonb) as value`;
  const v=row?.value;
  if(!v||v.ticketId!==ticket||v.requestId!==ticket||v.ownerId!==p.ownerId||v.connectionId!==p.id||!['issued','uploading','stored','uncertain'].includes(v.state)||!['app','whatsapp'].includes(v.channel)||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=now()||v.leaseId!=null)throw Error('INVALID_TICKET_RECEIPT');
  const plan=planUpload(p,{campaignId:v.campaignId,publicationId:v.publicationId,blockId:v.blockId,requestId:ticket,revision:v.revision,mime:v.mime,size:v.size,name:v.name});
  if(v.bucket!==plan.bucket||v.path!==plan.path||v.blockType!==plan.blockType||(v.mime==='image/jpeg'&&v.size>1048576)||(v.channel==='app'&&v.mime!=='image/jpeg')||(expected&&Object.keys(expected).some(k=>v[k]!==expected[k])))throw Error('INVALID_TICKET_RECEIPT');
  return {ticketId:ticket,channel:v.channel,campaignId:v.campaignId,publicationId:v.publicationId,blockId:v.blockId,revision:v.revision,mime:v.mime,size:v.size,name:v.name,state:v.state,expiresAt:v.expiresAt,uploadAvailable:false};
 }
 return {
  async issue(p,input){
   await authorize(p);
   if(!input||!['app','whatsapp'].includes(input.channel))throw Error('INVALID_MEDIA');
   const {channel,...fields}=input;
   const plan=planUpload(p,fields);
   if((plan.mime==='image/jpeg'&&plan.size>1048576)||(channel==='app'&&plan.mime!=='image/jpeg'))throw Error('INVALID_MEDIA');
   const data={channel,campaignId:plan.campaignId,publicationId:plan.publicationId,blockId:plan.blockId,revision:plan.revision,mime:plan.mime,size:plan.size,name:plan.name};
   return call(p,plan.requestId,'issue',data,data);
  },
  async inspect(p,ticket){await authorize(p);if(!uuid(ticket))throw Error('INVALID_MEDIA');return call(p,ticket,'inspect',{});}
 };
}
