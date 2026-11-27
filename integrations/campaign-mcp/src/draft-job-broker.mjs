// Internal broker only. No public HTTP route or dispatch operations.
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[0-9a-f]{12}$/i.test(v);
const actions=new Set(['status','pause','resume','cancel']);
const outcomes=new Set(['saved','conflict','blocked','uncertain']); // no automatic retry of uncertain saves
export function createDraftJobBroker({sql,authorize}){
 if(typeof sql!=='function'||typeof authorize!=='function')throw Error('INVALID_CONFIGURATION');
 return async function handle(path,d){
  if(!['/jobs/create','/jobs/claim','/jobs/control','/jobs/result','/jobs/assemble'].includes(path))return new Response(null,{status:404});
  if(!d||!uuid(d.id)||!uuid(d.ownerId)||!uuid(d.jobId)||await authorize(d.id,d.ownerId)!==true)return new Response(null,{status:403});
  let rows;
  if(path==='/jobs/assemble'){
   if(!['begin','append','seal','status','abandon'].includes(d.action)||!d.data||typeof d.data!=='object'||Array.isArray(d.data))return new Response(null,{status:400});
   rows=await sql`select neo_private.connect_ai_job_assemble(${d.id},${d.ownerId},${d.jobId},${d.action},${JSON.stringify(d.data)}::jsonb) as value`;
  }else if(path==='/jobs/create'){
   if(!uuid(d.campaignId)||!['app','whatsapp'].includes(d.channel)||!Array.isArray(d.items)||!d.items.length||d.items.length>60)return new Response(null,{status:400});
   rows=await sql`select neo_private.connect_ai_job_create_payload(${d.id},${d.ownerId},${d.jobId},${d.channel},${d.campaignId},${JSON.stringify(d.items)}::jsonb) as value`;
  }else if(path==='/jobs/claim'){
   rows=await sql`select neo_private.connect_ai_job_claim_payload(${d.id},${d.ownerId},${d.jobId}) as value`;
  }else if(path==='/jobs/control'){
   if(!actions.has(d.action))return new Response(null,{status:400});
   rows=await sql`select neo_private.connect_ai_job_control(${d.id},${d.ownerId},${d.jobId},${d.action}) as value`;
  }else{
   if(!uuid(d.requestId)||!uuid(d.leaseId)||!outcomes.has(d.state)||(d.state==='saved'?(!Number.isSafeInteger(d.revision)||d.revision<1):d.revision!==null))return new Response(null,{status:400});
   rows=await sql`select neo_private.connect_ai_job_result(${d.id},${d.ownerId},${d.jobId},${d.requestId},${d.leaseId},${d.state},${d.revision}) as value`;
  }
  return Response.json(rows[0]?.value??null,{headers:{'Cache-Control':'no-store'}});
 };
}
export function createDraftJobBrokerClient(call){
 const send=(path,p,body)=>call(path,{...body,id:p.id,ownerId:p.ownerId});
 return {
  assemble:(p,jobId,action,data)=>send('jobs/assemble',p,{jobId,action,data}),
  create:(p,input)=>send('jobs/create',p,input),
  claim:(p,jobId)=>send('jobs/claim',p,{jobId}),
  control:(p,jobId,action)=>send('jobs/control',p,{jobId,action}),
  result:(p,jobId,requestId,leaseId,state,revision)=>send('jobs/result',p,{jobId,requestId,leaseId,state,revision})
 };
}
