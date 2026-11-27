// Private binding only; no HTTP/MCP route exposed to clients.
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[0-9a-f]{12}$/i.test(v);
const actions=new Set(['issue','inspect','claim','finish']);
export function createMediaBroker({sql,authorize}){
 return async d=>{
  if(!d||![d.id,d.ownerId,d.ticketId].every(uuid)||await authorize(d.id,d.ownerId)!==true)return new Response(null,{status:403});
  if(!actions.has(d.action)||!d.data||typeof d.data!=='object'||Array.isArray(d.data))return new Response(null,{status:400});
  const [row]=await sql`select neo_private.connect_ai_media_ticket(${d.id},${d.ownerId},${d.ticketId},${d.action},${JSON.stringify(d.data)}::jsonb) as value`;
  return Response.json(row?.value??null,{headers:{'Cache-Control':'no-store'}});
 };
}
export function createMediaBrokerClient(call){
 return {ticket:(p,ticketId,action,data)=>call('media/ticket',{id:p.id,ownerId:p.ownerId,ticketId,action,data})};
}
