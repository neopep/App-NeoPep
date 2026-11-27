// Private native revision-checked attachment. No schedule/publish actions.
import {testProfile} from './environments.mjs';
import {planUpload,prepareAttachment} from './media-plan.mjs';
export function createMediaAttachmentWriter({profile,env,freshSession,verifyDatabase,request=fetch,now=Date.now}){
 const enabled=profile?.name==='test'&&profile.project===testProfile.project&&profile.supabaseOrigin===testProfile.supabaseOrigin&&env.NEO_CONNECT_AI_ENABLED==='1'&&env.NEO_CONNECT_AI_DRAFTS==='1'&&env.NEO_CONNECT_AI_MEDIA==='1';
 return async(p,ticket,digest)=>{
  if(!enabled||p?.environment!=='test'||p.campaignAdmin!==true||!p.scopes?.includes('campaigns:read')||!p.scopes.includes('campaigns:drafts')||!Number.isFinite(p.expiresAt)||p.expiresAt<=now()||!env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY)throw Error('FORBIDDEN');
  if(!ticket||ticket.ownerId!==p.ownerId||ticket.connectionId!==p.id||ticket.requestId!==ticket.ticketId||!['app','whatsapp'].includes(ticket.channel)||!Number.isFinite(Date.parse(ticket.expiresAt))||Date.parse(ticket.expiresAt)<=now())throw Error('INVALID_TICKET_RECEIPT');
  const plan=planUpload(p,{campaignId:ticket.campaignId,publicationId:ticket.publicationId,blockId:ticket.blockId,requestId:ticket.ticketId,revision:ticket.revision,mime:ticket.mime,size:ticket.size,name:ticket.name});
  if(ticket.path!==plan.path||ticket.bucket!==plan.bucket||ticket.blockType!==plan.blockType||(plan.mime==='image/jpeg'&&plan.size>1048576)||(ticket.channel==='app'&&plan.mime!=='image/jpeg'))throw Error('INVALID_TICKET_RECEIPT');
  if(digest!==null&&(ticket.state!=='stored'||!(/^[a-f0-9]{64}$/.test(digest))||ticket.sha256!==digest))throw Error('MEDIA_NOT_VERIFIED');
  await verifyDatabase();
  const rpc=async(action,data)=>{
   if(p.expiresAt<=now())throw Error('FORBIDDEN');
   const token=await freshSession(p.id,p.ownerId);if(!token)throw Error('FORBIDDEN');
   const result=await request(profile.supabaseOrigin+'/rest/v1/rpc/neo_campaign_central_v1',{method:'POST',headers:{apikey:env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(5000),body:JSON.stringify({p_action:(ticket.channel==='app'?'app_':'')+action,p_data:data})});
   if(!result.ok)throw Error('NATIVE_DRAFT_UNCONFIRMED');return result.json();
  };
  const detail=await rpc('get',{campaign_id:plan.campaignId});
  if(detail?.campaign_id!==plan.campaignId||!Object.hasOwn(detail,'deleted_at')||detail.deleted_at||detail.archived_at||!Array.isArray(detail.publications))throw Error('DRAFT_LOCKED');
  const publication=detail.publications.find(x=>x.id===plan.publicationId&&!x.deleted_at);
  if(!publication||publication.revision!==plan.revision||publication.legacy_dispatch||!Array.isArray(publication.batches)||publication.batches.length)throw Error('REVISION_CONFLICT');
  const loaded=await rpc('load',{campaign_id:plan.campaignId,publication_id:plan.publicationId});
  if(loaded?.revision!==plan.revision||loaded.channel!==ticket.channel||loaded.editor_id!==(publication.editor_id??publication.id)||loaded.source_id!==plan.campaignId||!Array.isArray(loaded.draft?.blocks))throw Error('REVISION_CONFLICT');
  const draft=structuredClone(loaded.draft),matches=draft.blocks.filter(b=>b.id===plan.blockId);
  // A new media block may be appended by explicit ticket block ID; existing type must match.
  if(matches.length>1||(matches.length===1&&matches[0].type!==plan.blockType)||(matches.length===0&&draft.blocks.length>=32))throw Error('INVALID_MEDIA_BLOCK');
  if(digest===null)return {state:'revision_checked'};
  if(!matches.length)draft.blocks.push({id:plan.blockId,type:plan.blockType,text:''});
  const next=prepareAttachment(plan,{ownerId:p.ownerId,campaignId:plan.campaignId,publicationId:plan.publicationId,revision:plan.revision,status:'draft',draft},{...plan,state:'stored_and_validated'});
  const saved=await rpc('save',{campaign_id:plan.campaignId,publication_id:plan.publicationId,request_id:plan.requestId,revision:plan.revision,draft:next});
  if(saved?.revision!==plan.revision+1||saved.editor_id!==loaded.editor_id||saved.channel!==ticket.channel||saved.source_id!==plan.campaignId)throw Error('NATIVE_DRAFT_UNCONFIRMED');
  return {publicationId:plan.publicationId,revision:saved.revision};
 };
}
