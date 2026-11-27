import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createCampaignReader} from '../src/campaign-reader.mjs';

test('leitura consulta apenas RPC nativo fixo e remove destinatários e recibos brutos',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const ownerId='22222222-2222-4222-8222-222222222222';
 const principal={id,ownerId,environment:'test',campaignAdmin:true,scopes:['campaigns:read']};
 let account=ownerId;const calls=[];
 const read=createCampaignReader({publishableKey:'fixture',sessionFor:async()=> 'session',request:async(url,options)=>{
  calls.push([url,options]);
  if(url.endsWith('/user'))return Response.json({id:account});
  return Response.json({campaign_id:id,title:'Campanha',default_destination:'privado',
   publications:[{id,title:'Publicação',revision:2,batches:[{destination:'privado'}]}]});
 }});
 const args={channel:'whatsapp',campaign_id:id};
 assert.deepEqual(await read(principal,'get_campaign',args),{
  campaign:{id,title:'Campanha',state:'active',channel:'whatsapp',next_at:null,archived_at:null,paused_at:null},publications:[{id,title:'Publicação',revision:2,schedules:[{due_at:null,cancelled_at:null,states:[],configured_at:null,sent_at:null,origin:null,delivery_status:'unknown',message_count:null,receipt_count:null,group_count:null,group_names:[]}]}],next_offset:null,history:[],recurrences:null
 });
 assert.equal(JSON.parse(calls[1][1].body).p_action,'get');
 await assert.rejects(read({...principal,environment:'production'},'get_campaign',args),/FORBIDDEN/);
 await assert.rejects(read(principal,'publish',args),/CAPABILITY_UNAVAILABLE/);
 assert.equal(calls.length,2);
 account=id;
 await assert.rejects(read(principal,'get_campaign',args),/FORBIDDEN/);
 assert.equal(calls.length,3);
});

test('canal App usa offset, filtra estado e projeta recorrências só quando autorizado',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const principal={id,ownerId:id,environment:'test',campaignAdmin:true,scopes:['campaigns:read']};
 const requests=[];
 const request=async(url,options)=>{
  if(url.endsWith('/user'))return Response.json({id});
  const query=JSON.parse(options.body);
  requests.push(query);
  if(query.p_action==='app_list')return Response.json([
   {campaign_id:id,title:'A',archived_at:'2026-01-01'},
   {campaign_id:id,title:'B',drafts:1,publications:1},
   {campaign_id:id,title:'C',next_at:'2027-01-01'}
  ]);
  if(query.p_action==='app_repeat_list')return Response.json([{id,state:'drafts',dates:['2027-01-01'],rule:{private:true}}]);
  return Response.json({campaign_id:id,title:'A',publications:[]});
 };
 const read=createCampaignReader({publishableKey:'fixture',sessionFor:async()=> 'session',request,channels:['app'],appRecurrences:true});
 const {items,next_offset}=await read(principal,'list_campaigns',{channel:'app',state:'draft',offset:5,limit:1});
 assert.equal(items[0].title,'B');
 assert.equal(next_offset,7);
 assert.deepEqual(requests[0],{p_action:'app_list',p_data:{offset:5}});
 const detail=await read(principal,'get_campaign',{channel:'app',campaign_id:id,include_recurrences:true});
 assert.deepEqual(detail.recurrences,[{id,state:'drafts',configured_at:null,timezone:null,dates:['2027-01-01']}]);
 assert.deepEqual(requests.slice(1).map(entry=>entry.p_action),['app_get','app_repeat_list']);
});

test('WhatsApp: agenda, pausas, recibos e recorrências sem expor identificadores brutos',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const principal={id,ownerId:id,environment:'test',campaignAdmin:true,scopes:['campaigns:read']};
 const requests=[];
 const due=new Date(Date.now()+86400000).toISOString();
 const sent='2026-11-26T21:17:00.000Z';
 const read=createCampaignReader({publishableKey:'fixture',sessionFor:async()=> 'session',request:async(url,options)=>{
  if(url.endsWith('/user'))return Response.json({id});
  const q=JSON.parse(options.body);requests.push([url,q.p_action]);
  if(url.endsWith('neo_campaign_weekly_v1'))return Response.json([{id,state:'active',dates:['2027-01-01T10:30','invalid'],configured_at:sent,rule:{private:'secret'}}]);
  if(q.p_action==='list')return Response.json([{campaign_id:id,title:'Ativa',publications:2,drafts:0},{campaign_id:id,title:'Pausada',paused_at:sent,publications:2}]);
  return Response.json({campaign_id:id,title:'Campanha',publications:[{id,title:'Material',revision:1,batches:[
   {states:['accepted'],message_count:2,receipt_count:2,group_count:1,group_names:['Grupo A'],configured_at:sent,sent_at:sent,origin:'publish',receipt_id:'secret',group_jid:'secret'},
   {states:['waiting'],due_at:due,configured_at:sent,origin:'recurring',message_count:1,receipt_count:0}
  ]}]});
 }});
 const list=await read(principal,'list_campaigns',{channel:'whatsapp'});
 assert.deepEqual(list.items.map(x=>x.state),['active','paused']);
 const detail=await read(principal,'get_campaign',{channel:'whatsapp',campaign_id:id,include_recurrences:true});
 assert.equal(detail.campaign.state,'scheduled');assert.equal(detail.campaign.next_at,due);
 assert.equal(detail.publications[0].schedules[0].delivery_status,'accepted_with_receipt');
 assert.equal(detail.publications[0].schedules[1].delivery_status,'scheduled');
 assert.deepEqual(detail.publications[0].schedules[0].group_names,['Grupo A']);
 assert.equal(detail.recurrences[0].timezone,'America/Sao_Paulo');
 assert.deepEqual(detail.recurrences[0].dates,['2027-01-01T10:30']);
 assert(!JSON.stringify(detail).includes('secret'));
 assert(requests.at(-1)[0].endsWith('neo_campaign_weekly_v1'));
 assert.equal(requests.at(-1)[1],'list');
 await assert.rejects(read({...principal,campaignAdmin:false},'get_campaign',{channel:'whatsapp',campaign_id:id}),/FORBIDDEN/);
});

test('leitura editorial exclui referências brutas e protege publicação excluída',async()=>{
 const id='11111111-1111-4111-8111-111111111111',pid='22222222-2222-4222-8222-222222222222';
 const principal={id,ownerId:id,environment:'test',campaignAdmin:true,scopes:['campaigns:read']};let deleted=false,loadCalls=0;
 const read=createCampaignReader({publishableKey:'fixture',sessionFor:async()=> 'session',request:async(url,opts)=>{
  if(url.endsWith('/user'))return Response.json({id});const q=JSON.parse(opts.body);
  if(q.p_action==='get')return Response.json({campaign_id:id,deleted_at:null,publications:[{id:pid,editor_id:pid,revision:2,batches:[],deleted_at:deleted?'2026-01-01':null}]});
  if(q.p_action==='load'){loadCalls++;return Response.json({editor_id:pid,channel:'whatsapp',revision:2,draft:{title:'Material',blocks:[{id:pid,type:'image',text:'Legenda',media_path:'secret/path',ref:'secret',url:'https://secret.invalid'}]}});}
  throw Error('unexpected RPC');
 }});
 const input={channel:'whatsapp',campaign_id:id,publication_id:pid};
 const result=await read(principal,'get_publication_content',input);
 assert.equal(result.editable_draft,true);assert.equal(result.blocks[0].has_attachment,true);assert(!JSON.stringify(result).includes('secret'));
 deleted=true;await assert.rejects(read(principal,'get_publication_content',input),/NOT_FOUND_OR_FORBIDDEN/);assert.equal(loadCalls,1);
});
test('catálogos limitam a projeção e não revelam JID ou campos extras',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const principal={id,ownerId:id,environment:'test',campaignAdmin:true,scopes:['campaigns:read']};
 const read=createCampaignReader({publishableKey:'fixture',sessionFor:async()=> 'session',request:async(url,opts)=>{
  if(url.endsWith('/user'))return Response.json({id});
  assert.equal(JSON.parse(opts.body).p_action,'catalog');
  if(url.endsWith('neo_campaign_editor_v1'))return Response.json([{id,label:'Material',price_cents:12345,secret:'x'}]);
  if(url.endsWith('neo_campaign_wa_sync'))return Response.json([{id:'private-jid',name:'Grupo',state:'eligible',members:['secret']},{name:'Indisponível',state:'unavailable'}]);
  throw Error('unexpected RPC');
 }});
 assert.deepEqual(await read(principal,'list_authorized_assets',{channel:'whatsapp',kind:'document'}),{items:[{id,label:'Material',kind:'document'}],limit:30});
 assert.deepEqual(await read(principal,'list_destinations',{channel:'whatsapp'}),{items:[{name:'Grupo',state:'eligible'}],selection_limit:30});
});
test('App diferencia exibição e disponibilidade de envio WhatsApp',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const principal={id,ownerId:id,environment:'test',campaignAdmin:true,scopes:['campaigns:read']};
 const read=createCampaignReader({publishableKey:'fixture',sessionFor:async()=> 'session',channels:['app'],request:async(url)=>{
  if(url.endsWith('/user'))return Response.json({id});
  return Response.json({campaign_id:id,title:'App',publications:[{id,title:'App',revision:1,batches:[{due_at:'2026-01-01T00:00:00Z',states:['accepted']},{due_at:'2026-01-01T00:00:00Z',states:['waiting']},{states:['cancelled']}]}]});
 }});
 const value=await read(principal,'get_campaign',{channel:'app',campaign_id:id});
 assert.deepEqual(value.publications[0].schedules.map(x=>x.delivery_status),['displayed','available_in_app','ended_or_cancelled']);
 assert.equal(value.publications[0].schedules[0].receipt_count,null);
});
