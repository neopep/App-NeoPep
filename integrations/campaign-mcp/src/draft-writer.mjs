// Candidate: deliberately not registered in the active MCP catalog.
import {testProfile} from './environments.mjs';
import {prepareDraftCreation,prepareDraftAddition,prepareDraftTextEdit,prepareMediaCaptionEdit} from './draft-plan.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const actions=new Set(['create','app_create','get','app_get','load','app_load','save','app_save']);
const known=new Set(['INVALID_DRAFT','FORBIDDEN','AUTH_REQUIRED','NOT_FOUND_OR_FORBIDDEN','REVISION_CONFLICT','DRAFT_LOCKED','REQUEST_CONFLICT','UPSTREAM_UNAVAILABLE']);
const shape=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error('INVALID_DRAFT');};
export function createDraftWriter({publishableKey,sessionFor,request=fetch,profile=testProfile,enabled=false}){
 if(profile.name!=='test'||profile.project!==testProfile.project||profile.supabaseOrigin!==testProfile.supabaseOrigin)throw Error('TEST_ONLY');
 if(!publishableKey||typeof sessionFor!=='function')throw Error('INVALID_CONFIGURATION');
 return async(principal,operation,input={})=>{
  if(!enabled||principal?.environment!=='test'||principal.campaignAdmin!==true||!principal.scopes?.includes('campaigns:drafts')||!principal.scopes?.includes('campaigns:read')||!uuid(principal.ownerId))throw Error('FORBIDDEN');
  if(!['create_campaign_draft','add_publications','update_publications'].includes(operation)||!['app','whatsapp'].includes(input.channel))throw Error('INVALID_DRAFT');
  const {channel,campaignId}=input;
  shape(input,operation==='create_campaign_draft'?['channel','title','requestId']:['channel','campaignId','items']);
  if(operation!=='create_campaign_draft'&&(!uuid(campaignId)||!Array.isArray(input.items)||!input.items.length||input.items.length>6))throw Error('INVALID_DRAFT');
  const token=await sessionFor(principal.id,principal.ownerId);
  if(!token)throw Error('AUTH_REQUIRED');
  const headers={apikey:publishableKey,Authorization:'Bearer '+token};
  const identity=await request(profile.supabaseOrigin+'/auth/v1/user',{headers,redirect:'manual',signal:AbortSignal.timeout(5000)});
  if(!identity.ok||(await identity.json()).id!==principal.ownerId)throw Error('FORBIDDEN');
  const prefix=channel==='app'?'app_':'';
  const rpc=async(p_action,p_data)=>{
   if(!actions.has(p_action))throw Error('FORBIDDEN');
   const res=await request(profile.supabaseOrigin+'/rest/v1/rpc/neo_campaign_central_v1',{method:'POST',headers:{...headers,'Content-Type':'application/json'},redirect:'manual',signal:AbortSignal.timeout(5000),body:JSON.stringify({p_action,p_data})});
   if(!res.ok){
    const code=(await res.json().catch(()=>({}))).code;
    if(res.status===403||res.status===404||code==='42501')throw Error('NOT_FOUND_OR_FORBIDDEN');
    if(code==='40001')throw Error('REVISION_CONFLICT');
    if(code==='23505')throw Error('REQUEST_CONFLICT');
    if(code==='55000')throw Error('DRAFT_LOCKED');
    if(code==='22023')throw Error('INVALID_DRAFT');
    throw Error('UPSTREAM_UNAVAILABLE');
   }
   return res.json();
  };
  if(operation==='create_campaign_draft'){
   const op=prepareDraftCreation(input),created=await rpc(op.p_action,op.p_data);
   if(!uuid(created?.campaign_id))throw Error('UPSTREAM_UNAVAILABLE');
   const detail=await rpc(prefix+'get',{campaign_id:created.campaign_id});
   if(detail?.campaign_id!==created.campaign_id||!Object.hasOwn(detail,'deleted_at')||detail.deleted_at||detail.title!==op.p_data.title)throw Error('REQUEST_CONFLICT');
   return {campaignId:created.campaign_id,channel,status:'draft_created_or_reused'};
  }
  const ids=new Set(),requests=new Set();
  const prepared=input.items.map(item=>{
   shape(item,operation==='add_publications'?['publicationId','requestId','title','blocks','plannedLocal']:['publicationId','requestId','revision','edits','mediaCaption']);
   if(!uuid(item.publicationId)||!uuid(item.requestId)||ids.has(item.publicationId)||requests.has(item.requestId))throw Error('INVALID_DRAFT');
   ids.add(item.publicationId);requests.add(item.requestId);
   if(operation==='add_publications')return {item,op:prepareDraftAddition({channel,campaignId,...item})};
   if(!Number.isSafeInteger(item.revision)||item.revision<1)throw Error('INVALID_DRAFT');
   if(Object.hasOwn(item,'mediaCaption')){
    if(channel!=='whatsapp'||Object.hasOwn(item,'edits'))throw Error('INVALID_DRAFT');
    shape(item.mediaCaption,['blockId','mode','text','separateBlockId']);
   }else if(!Array.isArray(item.edits)||!item.edits.length||item.edits.length>6)throw Error('INVALID_DRAFT');
   return {item};
  });
  const detail=await rpc(prefix+'get',{campaign_id:campaignId});
  if(detail?.campaign_id!==campaignId||!Array.isArray(detail.publications)||detail.archived_at||!Object.hasOwn(detail,'deleted_at')||detail.deleted_at)throw Error('DRAFT_LOCKED');
  const results=[];
  for(const {item,op:preparedOp} of prepared){
   try{
    let op=preparedOp;
    if(operation==='update_publications'){
     const current=detail.publications.find(row=>row.id===item.publicationId&&!row.deleted_at);
     if(!current||current.legacy_dispatch||!Array.isArray(current.batches)||current.batches.length)throw Error('DRAFT_LOCKED');
     if(current.revision!==item.revision)throw Error('REVISION_CONFLICT');
     const loaded=await rpc(prefix+'load',{campaign_id:campaignId,publication_id:item.publicationId});
     if(loaded?.revision!==item.revision||loaded.channel!==channel||loaded.editor_id!==(current.editor_id??current.id))throw Error('REVISION_CONFLICT');
     const currentDraft={channel,campaignId,publicationId:item.publicationId,revision:loaded.revision,status:'draft',draft:loaded.draft};
     op=item.mediaCaption
      ?prepareMediaCaptionEdit({channel,campaignId,...item,...item.mediaCaption,current:currentDraft})
      :prepareDraftTextEdit({channel,campaignId,...item,current:currentDraft});
    }
    const saved=await rpc(op.p_action,op.p_data);
    if(!Number.isSafeInteger(saved?.revision)||saved.revision!==op.p_data.revision+1)throw Error('UPSTREAM_UNAVAILABLE');
    results.push({publicationId:item.publicationId,status:'draft_saved_or_reused',revision:saved.revision});
   }catch(e){results.push({publicationId:item.publicationId,status:'not_confirmed',error:known.has(e.message)?e.message:'UPSTREAM_UNAVAILABLE'});}
  }
  return {campaignId,channel,results};
 };
}
