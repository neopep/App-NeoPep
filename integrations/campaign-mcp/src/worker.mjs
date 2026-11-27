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

export function createHandler({authorize=async()=>null,environment='test',origins=[],readCampaign,oauth,readChannels=['whatsapp']}={}){
 if(!['test','production'].includes(environment))throw Error('Invalid environment');
 const discovery=oauth?makeDiscoveryHandler(oauth):null;
 const metadataUrl=oauth?new URL('/.well-known/oauth-protected-resource/mcp',oauth.protectedResource.resource).href:null;
 const authHeader=metadataUrl?'Bearer resource_metadata="'+metadataUrl+'"':'Bearer';
 const allowedOrigins=new Set(origins);
 const nativeReads=environment==='test'&&typeof readCampaign==='function'?campaignTools.map(tool=>({
  ...tool,inputSchema:{...tool.inputSchema,properties:{...tool.inputSchema.properties,
   channel:{enum:readChannels.filter(value=>['app','whatsapp'].includes(value))}}}
 })):[];
 const available=[...tools,...nativeReads];
 return async request=>{
  const path=new URL(request.url).pathname;
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
   capabilities:{tools:{}},serverInfo:{name:'neopep-connect-ai',version}});
  if(method==='ping')return result({});
  if(method==='tools/list')return result({tools:available});
  if(method!=='tools/call')return error(id,-32601,'Método indisponível.');
  if(!isObject(params)||!isObject(params.arguments??{}))return error(id,-32602,'Parâmetros inválidos.');
  const args=params.arguments??{};
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
  const value=params.name==='get_capabilities'
   ?{environment,contract_version:version,enabled_tools:available.map(t=>t.name),restrictions:nativeReads.length?['Somente leitura nos canais habilitados de Teste']:['Somente leitura de contexto','Sem operações sobre campanhas nesta versão']}
   :{brand_version:'preview.1',name:'NeoPep',editorial_rules:['Use informações verificáveis.','Preserve a privacidade e evite alegações médicas não fundamentadas.']};
  return result({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
 }
}

// The deployable entry cannot select the local fixture authorizer.
export default {fetch:createHandler()};
