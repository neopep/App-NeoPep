// Teste candidate only: one bounded chunk, no scheduling, no dispatch, no automatic replay.
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const allowed=p=>p?.environment==='test'&&p.campaignAdmin===true&&uuid(p.id)&&uuid(p.ownerId)&&p.scopes?.includes('campaigns:read')&&p.scopes.includes('campaigns:drafts');
const classify=r=>r?.status==='draft_saved_or_reused'&&Number.isSafeInteger(r.revision)&&r.revision>0?'saved':
 r?.status!=='not_confirmed'?'uncertain':
 ['REVISION_CONFLICT','REQUEST_CONFLICT'].includes(r.error)?'conflict':
 ['INVALID_DRAFT','DRAFT_LOCKED','NOT_FOUND_OR_FORBIDDEN','FORBIDDEN','AUTH_REQUIRED'].includes(r.error)?'blocked':'uncertain';
export function createDraftJobRunner({enabled=false,authorize,claim,status,result,writeDraft,now=Date.now}){
 if([authorize,claim,status,result,writeDraft,now].some(fn=>typeof fn!=='function'))throw Error('INVALID_CONFIGURATION');
 return async function run(principal,jobId){
  if(!enabled||!allowed(principal)||!uuid(jobId)||!await authorize(principal))throw Error('FORBIDDEN');
  const start=now(), rows=await claim(principal,jobId);
  if(!Array.isArray(rows)||rows.length>6)throw Error('INVALID_CLAIM');
  const seen=new Set(),pubs=new Set();
  for(const row of rows){
   if(!row||!uuid(row.publicationId)||!uuid(row.requestId)||!uuid(row.leaseId)||!uuid(row.campaignId)||!['app','whatsapp'].includes(row.channel)||!Number.isSafeInteger(row.ordinal)||row.ordinal<0||row.ordinal>59||seen.has(row.requestId)||pubs.has(row.publicationId)||row.item?.publicationId!==row.publicationId||row.item?.requestId!==row.requestId||!Array.isArray(row.item.blocks)||typeof row.item.title!=='string'||Object.keys(row.item).some(k=>!['publicationId','requestId','title','blocks','plannedLocal'].includes(k))||row.leaseId!==rows[0].leaseId||row.channel!==rows[0].channel||row.campaignId!==rows[0].campaignId)throw Error('INVALID_CLAIM');
   seen.add(row.requestId);pubs.add(row.publicationId);
  }
  const receipts=[];
  for(const row of rows){
   // Leave outstanding leases for explicit reconciliation if authorization or timing is lost.
   if(now()-start>=90000||!await authorize(principal))return {jobId,claimed:rows.length,receipts,stopped:'authorization_or_deadline'};
   const current=await status(principal,jobId);
   if(current?.id!==jobId||!['active','paused','cancelled'].includes(current.state)||!Array.isArray(current.items))throw Error('INVALID_STATUS');
   if(!current.items.some(i=>i.ordinal===row.ordinal&&i.publicationId===row.publicationId&&i.state==='leased'))return {jobId,claimed:rows.length,receipts,stopped:'lease_lost'};
   let outcome=current.state==='paused'?'retryable':current.state==='cancelled'?'blocked':null,revision=null;
   if(!outcome){
    try{
     const response=await writeDraft(principal,'add_publications',{channel:row.channel,campaignId:row.campaignId,items:[row.item]});
     const r=response?.results?.length===1&&response.campaignId===row.campaignId&&response.channel===row.channel&&response.results[0].publicationId===row.publicationId?response.results[0]:null;
     outcome=classify(r);if(outcome==='saved')revision=r.revision;
    }catch{outcome='uncertain';}
   }
   // A false receipt or transport failure cannot establish the persisted state. Never repeat the write.
   let recorded=false;
   try{recorded=await result(principal,jobId,row.requestId,row.leaseId,outcome,revision)===true;}catch{}
   if(!recorded)return {jobId,claimed:rows.length,receipts,stopped:'receipt_unconfirmed'};
   receipts.push({publicationId:row.publicationId,state:outcome,...(revision===null?{}:{revision})});
  }
  return {jobId,claimed:rows.length,receipts,stopped:null};
 };
}
