import {jobTools} from './job-catalog.mjs';
import {getPublicationGuide,guideVersion} from './publication-guide.mjs';
import {draftTools} from './draft-catalog.mjs';
import {handleTokenRequest,makeDiscoveryHandler} from './oauth-issuer.mjs';
import {campaignTools,scopeByTool,tools,version} from './catalog.mjs';

const protocol='2025-11-25';
const maximumBytes=16384;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const error=(id,code,message)=>json({jsonrpc:'2.0',id,error:{code,message}});
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

async function readBody(request){
 const reader=request.body?.getReader();
 if(!reader)throw Error('BODY');
 const decoder=new TextDecoder('utf-8',{fatal:true});
 let length=0,text='';
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>maximumBytes)throw Error('LIMIT');
   text+=decoder.decode(value,{stream:true});
  }
  return JSON.parse(text+decoder.decode());
 }catch(err){
  await reader.cancel().catch(()=>{});
  throw err;
 }
}

export function createHandler({authorize=async()=>null,environment='test',origins=[],readCampaign,writeDraft,runJob,guideReceipts,oauth,consent,readChannels=['whatsapp']}={}){
 if(!['test','production'].includes(environment))throw Error('Invalid environment');
 const discovery=oauth?makeDiscoveryHandler(oauth):null;
 const metadataUrl=oauth?new URL('/.well-known/oauth-protected-resource/mcp',oauth.protectedResource.resource).href:null;
 const authHeader=metadataUrl?'Bearer resource_metadata="'+metadataUrl+'"':'Bearer';
 const allowedOrigins=new Set(origins);
 const nativeReads=typeof readCampaign==='function'?campaignTools.map(tool=>({
  ...tool,inputSchema:{...tool.inputSchema,properties:{...tool.inputSchema.properties,
   channel:{enum:readChannels.filter(value=>tool.inputSchema.properties.channel.enum.includes(value))}}}
 })).filter(tool=>tool.inputSchema.properties.channel.enum.length>0):[];
 const nativeWrites=environment==='test'&&typeof writeDraft==='function'&&guideReceipts?.issue&&guideReceipts?.verify?[...draftTools,...(typeof runJob==='function'?jobTools:[])]:[];
 return async request=>{
  const path=new URL(request.url).pathname;
  if(path==='/oauth/authorize'&&consent)return consent(request);
  const publicMetadata=discovery?.(request);
  if(publicMetadata)return publicMetadata;
  if(oauth&&path==='/oauth/token')return handleTokenRequest(oauth,request);
  if(path!=='/mcp')return json({error:'NOT_FOUND'},404);
  if(request.headers.has('origin')&&!allowedOrigins.has(request.headers.get('origin')))return json({error:'FORBIDDEN'},403);
  if(request.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'POST'}});
  const token=/^Bearer ([A-Za-z0-9._~+/=-]{1,8192})$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return new Response(null,{status:401,headers:{...headers,'WWW-Authenticate':authHeader}});
  let principal;
  try{principal=await authorize(token);}catch{return json({error:'AUTH_UNAVAILABLE'},503);}
  if(!principal||principal.revoked||!Number.isFinite(principal.expiresAt)||principal.expiresAt<=Date.now())
   return new Response(null,{status:401,headers:{...headers,'WWW-Authenticate':authHeader}});
  if(principal.environment!==environment||principal.campaignAdmin!==true||!principal.scopes?.includes('campaigns:read'))
   return json({error:'FORBIDDEN'},403);
  const writes=principal.scopes.includes('campaigns:drafts')?nativeWrites:[];
  const available=[...tools,...nativeReads,...writes];
  const requestVersion=request.headers.get('mcp-protocol-version');
  if(requestVersion&&requestVersion!==protocol)return json({error:'PROTOCOL_UNSUPPORTED'},400);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return json({error:'UNSUPPORTED_MEDIA'},415);
  let input;
  try{input=await readBody(request);}catch(err){
   return err.message==='LIMIT'?json({error:'BODY_TOO_LARGE'},413):error(null,-32700,'JSON inválido.');
  }
  if(!isObject(input)||input.jsonrpc!=='2.0'||typeof input.method!=='string'||
   (Object.hasOwn(input,'id')&&typeof input.id!=='string'&&!Number.isSafeInteger(input.id)))
   return error(null,-32600,'Requisição inválida.');
  if(!Object.hasOwn(input,'id'))return new Response(null,{status:202,headers});
  const {id,method,params}=input;
  const result=value=>json({jsonrpc:'2.0',id,result:value});
  if(method==='initialize')return result({protocolVersion:protocol,
   capabilities:{tools:{}},instructions:'Antes de preparar campanhas, consulte get_capabilities, get_publication_guide e get_brand_context. Use o guia atual e apenas as ferramentas anunciadas.',serverInfo:{name:'neopep-connect-ai',version}});
  if(method==='ping')return result({});
  if(method==='tools/list')return result({tools:available});
  if(method!=='tools/call')return error(id,-32601,'Método indisponível.');
  if(!isObject(params)||!isObject(params.arguments??{}))return error(id,-32602,'Parâmetros inválidos.');
  const args=params.arguments??{};
  const draft=writes.find(tool=>tool.name===params.name);
  if(draft){
   if(args.guideVersion!==guideVersion||!await guideReceipts.verify(principal,args.guideReceipt).catch(()=>false))return result({isError:true,content:[{type:'text',text:'GUIDE_REFRESH_REQUIRED: consulte get_publication_guide e use guide_version e guide_receipt como guideVersion e guideReceipt.'}]});
   if(draft.inputSchema.required.some(k=>!Object.hasOwn(args,k))||Object.keys(args).some(k=>!Object.hasOwn(draft.inputSchema.properties,k))||(Object.hasOwn(draft.inputSchema.properties,'channel')&&!['app','whatsapp'].includes(args.channel))|| (args.items!==undefined&&(!Array.isArray(args.items)||args.items.length>6)))
    return error(id,-32602,'Parâmetros inválidos.');
   try{
    const {guideVersion:acknowledgedVersion,guideReceipt:retrievalProof,...payload}=args;
    const data=await (jobTools.includes(draft)?runJob:writeDraft)(principal,draft.name,payload);
    return result({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});
   }catch(err){
    const known=['INVALID_DRAFT','FORBIDDEN','AUTH_REQUIRED','NOT_FOUND_OR_FORBIDDEN','REVISION_CONFLICT','DRAFT_LOCKED','REQUEST_CONFLICT','INVALID_JOB'];
    return result({isError:true,content:[{type:'text',text:known.includes(err.message)?err.message:'UPSTREAM_UNAVAILABLE'}]});
   }
  }
  if([...draftTools,...jobTools].some(t=>t.name===params.name))return error(id,-32602,'Ferramenta ou parâmetros inválidos.');
  const native=nativeReads.find(tool=>tool.name===params.name);
  if(native){
   if(!native.inputSchema.properties.channel.enum.includes(args.channel)||native.inputSchema.required.some(key=>!Object.hasOwn(args,key))||
    Object.keys(args).some(key=>!Object.hasOwn(native.inputSchema.properties,key)))
    return error(id,-32602,'Parâmetros inválidos.');
   try{
    const data=await readCampaign(principal,native.name,args);
    return result({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});
   }catch(err){
    const known=['INVALID_INPUT','FORBIDDEN','AUTH_REQUIRED','NOT_FOUND_OR_FORBIDDEN','CAPABILITY_UNAVAILABLE'];
    const code=known.includes(err.message)?err.message:'UPSTREAM_UNAVAILABLE';
    return result({isError:true,content:[{type:'text',text:code}]});
   }
  }
  if(!scopeByTool.has(params.name)||Object.keys(args).length)return error(id,-32602,'Ferramenta ou parâmetros inválidos.');
  const value=params.name==='get_publication_guide'?getPublicationGuide(environment,available.map(t=>t.name),writes.length?await guideReceipts.issue(principal):null):params.name==='get_capabilities'
   ?{environment,contract_version:version,enabled_tools:available.map(t=>t.name),restrictions:writes.length?['Teste: leitura e criação/edição de rascunhos textuais.','Sem envio, agendamento, destinos ou exclusão.']:nativeReads.length?['Somente leitura nos canais habilitados: '+readChannels.join(', '),'Não criar, editar, enviar ou agendar publicações por este catálogo.']:['Somente leitura de contexto','Sem operações sobre campanhas nesta versão']}
   :{brand_version:'2026-11-27.1',name:'NeoPep',editorial_rules:['Use informações verificáveis e somente materiais autorizados pela Central.','Escreva em português claro; diferencie rascunho, agendamento, envio aceito e entrega confirmada.','Não invente preços, grupos, estoque, links, resultados clínicos ou depoimentos.','Preserve privacidade; não use dados, fotos ou informações de saúde de membros.','Não produza publicidade de medicamentos controlados ou experimentais, nem alegações médicas não fundamentadas.','Nunca agende ou publique a partir de uma proposta sem autorização verificável.']};
  return result({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
 }
}

// The deployable entry cannot select the local fixture authorizer.
export default {fetch:createHandler()};
