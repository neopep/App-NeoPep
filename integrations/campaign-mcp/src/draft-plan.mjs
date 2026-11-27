const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

// Pure preparation only. Do not enable a mutation before native ACL and revision tests.
export function prepareDraftCreation({channel,title,requestId}){
 const value=typeof title==='string'?title.trim():'';
 if(!['app','whatsapp'].includes(channel)||!value||value.length>120||
    typeof requestId!=='string'||!uuid.test(requestId))throw Error('INVALID_DRAFT');
 return {p_action:channel==='app'?'app_create':'create',p_data:{title:value,request_id:requestId}};
}

// Text-only candidate, scoped to a caller-supplied stable publication and revision.
export function prepareDraftTextEdit({channel,campaignId,publicationId,requestId,revision,title,blocks}){
 const action=prepareDraftCreation({channel,title,requestId});
 if(![campaignId,publicationId].every(value=>typeof value==='string'&&uuid.test(value))||
  !Number.isSafeInteger(revision)||revision<0||!Array.isArray(blocks)||blocks.length<1||blocks.length>6)
  throw Error('INVALID_DRAFT');
 const safeBlocks=blocks.map(block=>{
  if(block?.type!=='text'||typeof block.id!=='string'||!uuid.test(block.id)||typeof block.text!=='string'||
   !block.text.trim()||block.text.length>2000)throw Error('INVALID_DRAFT');
  return {id:block.id,type:'text',text:block.text};
 });
 if(new Set(safeBlocks.map(block=>block.id)).size!==safeBlocks.length)throw Error('INVALID_DRAFT');
 return {p_action:channel==='app'?'app_save':'save',p_data:{
  campaign_id:campaignId,publication_id:publicationId,request_id:requestId,revision,
  draft:{title:action.p_data.title,timezone:'America/Sao_Paulo',planned_local:'',groups:[],audience:'all',blocks:safeBlocks}
 }};
}
