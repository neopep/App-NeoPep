// Pure batch planning, no runner or send path. IDs stay stable on retry.
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[0-9a-f]{12}$/i.test(v);
export function planDraftJob({jobId,channel,campaignId,items}){
 if(!uuid(jobId)||!uuid(campaignId)||!['app','whatsapp'].includes(channel)||!Array.isArray(items)||!items.length||items.length>60)throw Error('INVALID_JOB');
 const p=new Set(),r=new Set();
 const rows=items.map((item,index)=>{
  if(!item||!uuid(item.publicationId)||!uuid(item.requestId)||p.has(item.publicationId)||r.has(item.requestId))throw Error('INVALID_JOB');
  p.add(item.publicationId);r.add(item.requestId);
  return {index,publicationId:item.publicationId,requestId:item.requestId,state:'pending',attempts:0};
 });
 return {jobId,channel,campaignId,rows,total:rows.length,chunkSize:6};
}
export function nextDraftChunk(job){
 if(!job||!Array.isArray(job.rows))throw Error('INVALID_JOB');
 return job.rows.filter(r=>r.state==='pending'||r.state==='retryable').slice(0,6).map(r=>({...r}));
}
export function recordDraftResult(job,receipt){
 if(!receipt||!['saved','retryable','conflict','blocked','uncertain'].includes(receipt.state))throw Error('INVALID_RECEIPT');
 const row=job.rows.find(r=>r.requestId===receipt.requestId&&r.publicationId===receipt.publicationId);
 if(!row||!['pending','retryable'].includes(row.state))throw Error('INVALID_RECEIPT');
 if(receipt.state==='saved'&&(!Number.isSafeInteger(receipt.revision)||receipt.revision<1))throw Error('INVALID_RECEIPT');
 return {...job,rows:job.rows.map(r=>r!==row?r:{...r,state:receipt.state,attempts:r.attempts+1,...(receipt.state==='saved'?{revision:receipt.revision}:{})})};
}
export function jobProgress(job){
 const counts={pending:0,retryable:0,saved:0,conflict:0,blocked:0,uncertain:0};
 for(const row of job.rows)counts[row.state]++;
 return {total:job.total,...counts,complete:counts.pending+counts.retryable+counts.uncertain===0};
}
