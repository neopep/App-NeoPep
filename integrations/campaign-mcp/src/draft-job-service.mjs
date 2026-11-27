import {validateJobPayload,createDraftJobRunner} from './draft-job-runner.mjs';
import {jobTools} from './job-catalog.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[0-9a-f]{12}$/i.test(v);
export function createDraftJobService({broker,writeDraft,authorizeCurrent}){
 const runner=createDraftJobRunner({broker,writeDraft,authorizeCurrent});
 return async(p,name,input)=>{
  if(p?.environment!=='test'||p.campaignAdmin!==true||!p.scopes?.includes('campaigns:read')||!p.scopes?.includes('campaigns:drafts')||!await authorizeCurrent(p))throw Error('FORBIDDEN');
  const t=jobTools.find(t=>t.name===name),allowed=t&&Object.keys(t.inputSchema.properties).filter(k=>!['guideVersion','guideReceipt'].includes(k));
  if(!allowed||!input||allowed.some(k=>!Object.hasOwn(input,k))||Object.keys(input).some(k=>!allowed.includes(k))||!uuid(input.jobId))throw Error('INVALID_JOB');
  const {jobId,channel,campaignId,expected,offset,items,action}=input;
  if(name==='create_draft_job'){
   if(!['app','whatsapp'].includes(channel)||!uuid(campaignId)||!Number.isInteger(expected)||expected<1||expected>60)throw Error('INVALID_JOB');
   return broker.assemble(p,jobId,'begin',{channel,campaignId,expected});
  }
  if(name==='append_draft_job_items'){
   if(!Number.isInteger(offset)||offset<0||offset>59||!Array.isArray(items)||items.length>6)throw Error('INVALID_JOB');
   const v=validateJobPayload(p,{jobId,channel,campaignId,items});
   return broker.assemble(p,jobId,'append',{channel,campaignId,offset,items:v.items});
  }
  if(name==='seal_draft_job')return broker.assemble(p,jobId,'seal',{});
  if(name==='get_draft_job_assembly')return broker.assemble(p,jobId,'status',{});
  if(name==='get_draft_job')return runner.control(p,jobId,'status');
  if(name==='run_draft_job_chunk')return runner.runChunk(p,jobId);
  if(name==='control_draft_job'){
   if(action==='abandon')return broker.assemble(p,jobId,'abandon',{});
   return runner.control(p,jobId,action);
  }
  throw Error('INVALID_JOB');
 };
}
