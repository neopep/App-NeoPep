import {SignJWT} from 'jose';
import {challengeS256} from './pkce.mjs';

const encode=value=>new TextEncoder().encode(value);
const hex=bytes=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encode(value)));
const secret=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const scope='campaigns:read';
const isSecret=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const ok=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
const invalid=()=>Error('INVALID_GRANT');

export function createIssuer({issuer,resource,key,keyId,clients,store,confirmNeoPepSession}){
 if(new URL(issuer).protocol!=='https:'||new URL(resource).protocol!=='https:'||!key||!keyId||
  !(clients instanceof Map)||!store||typeof confirmNeoPepSession!=='function')throw Error('Invalid issuer configuration');
 const metadata={issuer,authorization_endpoint:issuer+'/oauth/authorize',token_endpoint:issuer+'/oauth/token',
  jwks_uri:issuer+'/.well-known/jwks.json',response_types_supported:['code'],
  grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],
  token_endpoint_auth_methods_supported:['none'],scopes_supported:[scope]};
 const protectedResource={resource,authorization_servers:[issuer],scopes_supported:[scope]};
 const allowClient=(clientId,redirectUri)=>clients.get(clientId)?.includes(redirectUri)===true;
 return {
  metadata,protectedResource,
  // Call only behind the host's explicit consent and CSRF-protected session flow.
  async issueCode({session,clientId,redirectUri,challenge,method,requestedResource,requestedScope,consent}){
   if(consent!==true||!allowClient(clientId,redirectUri)||requestedResource!==resource||requestedScope!==scope||
     method!=='S256'||typeof challenge!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(challenge))throw invalid();
   const identity=await confirmNeoPepSession(session,{clientId,resource});
   if(!identity?.connectionId||identity.campaignAdmin!==true)throw invalid();
   const code=secret();
   await store.registerCode({digest:await digest(code),connectionId:identity.connectionId,clientId,
    redirectUri,challenge,expiresAt:Date.now()+120000});
   return code;
  },
  async exchange(fields){
   const clientId=fields.client_id;
   if(!clients.has(clientId)||fields.resource!==resource)throw invalid();
   const codeGrant=fields.grant_type==='authorization_code';
   if(!codeGrant&&fields.grant_type!=='refresh_token')throw invalid();
   const previous=codeGrant?fields.code:fields.refresh_token;
   const redirectUri=codeGrant?fields.redirect_uri:null;
   if(!isSecret(previous)||(codeGrant&&!allowClient(clientId,redirectUri)))throw invalid();
   let challenge=null;
   if(codeGrant){try{challenge=await challengeS256(fields.code_verifier);}catch{throw invalid();}}
   const next=secret();
   const grant=await store.rotate({digest:await digest(previous),kind:codeGrant?'code':'refresh',
    clientId,redirectUri,challenge,nextDigest:await digest(next)});
   if(!grant?.id||!grant.ownerId)throw invalid();
   const token=await new SignJWT({connection_id:grant.id,client_id:clientId,scope})
    .setProtectedHeader({alg:'ES256',kid:keyId,typ:'at+jwt'}).setIssuer(issuer).setAudience(resource)
    .setSubject(grant.ownerId).setIssuedAt().setExpirationTime('5m').sign(key);
   return {access_token:token,token_type:'Bearer',expires_in:300,refresh_token:next,scope};
  }
 };
}

export function makeDiscoveryHandler(issuer){
 return request=>{
  if(request.method!=='GET')return null;
  const path=new URL(request.url).pathname;
  if(path==='/.well-known/oauth-authorization-server')return ok(issuer.metadata);
  if(path==='/.well-known/oauth-protected-resource/mcp'||path==='/.well-known/oauth-protected-resource')
   return ok(issuer.protectedResource);
  return null;
 };
}

export async function handleTokenRequest(issuer,request){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
 if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('content-type')||''))
  return ok({error:'invalid_request'},400);
 const reader=request.body?.getReader();
 if(!reader)return ok({error:'invalid_request'},400);
 try{
  let size=0,raw='';
  const decoder=new TextDecoder('utf-8',{fatal:true});
  for(;;){
   const {value,done}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>8192){await reader.cancel();return ok({error:'invalid_request'},400);}
   raw+=decoder.decode(value,{stream:true});
  }
  const values=new URLSearchParams(raw+decoder.decode());
  if(new Set(values.keys()).size!==[...values.keys()].length)return ok({error:'invalid_request'},400);
  return ok(await issuer.exchange(Object.fromEntries(values)));
 }catch(err){
  if(err.message==='INVALID_GRANT')return ok({error:'invalid_grant'},400);
  if(err instanceof TypeError)return ok({error:'invalid_request'},400);
  return ok({error:'temporarily_unavailable'},503);
 }
}
