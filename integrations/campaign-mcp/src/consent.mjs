const noStore={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
const allowedKeys=['response_type','client_id','redirect_uri','code_challenge','code_challenge_method','resource','scope','state'];
const fail=(status=400)=>Response.json({error:'invalid_request'},{status,headers:noStore});
const utf8=new TextEncoder();
const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');

export function createConsentHandler({issuer,clients,approvalOrigin,csrfKey,sessionFor}){
 const resource=issuer.protectedResource.resource;
 if(new URL(approvalOrigin).origin!==approvalOrigin||new URL(approvalOrigin).protocol!=='https:'||
  typeof sessionFor!=='function'||!csrfKey)throw Error('Invalid consent configuration');
 async function challenge(params,expires){
  return base64url(await crypto.subtle.sign('HMAC',csrfKey,utf8.encode(JSON.stringify([params,expires]))));
 }
 function fields(params){
  // RFC 6749 §3.1: ignore unrecognized extensions (e.g. ui_locales), reject duplicates.
  if([...params.keys()].some(key=>params.getAll(key).length!==1))return null;
  const p=Object.fromEntries(allowedKeys.map(key=>[key,params.get(key)]));
  if(p.response_type!=='code'||!clients.get(p.client_id)?.includes(p.redirect_uri)||
   p.code_challenge_method!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(p.code_challenge||'')||
   p.resource!==resource||p.scope!=='campaigns:read'||!p.state||p.state.length>512)return null;
  const redirect=new URL(p.redirect_uri);
  if(redirect.protocol!=='https:'||redirect.hash||redirect.username||redirect.password)return null;
  return p;
 }
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/oauth/authorize')return null;
  if(url.search.length>2048)return fail();
  const p=fields(url.searchParams);
  if(!p)return fail();
  if(request.method==='GET'){
   const expires=Date.now()+120000;
   const target=new URL('/admin/',approvalOrigin);
   target.searchParams.set('admin','campaigns');
   target.searchParams.set('connectAiRequest',new URLSearchParams(p).toString());
   target.searchParams.set('connectAiExpires',String(expires));
   target.searchParams.set('connectAiCsrf',await challenge(p,expires));
   return new Response(null,{status:303,headers:{...noStore,Location:target.href}});
  }
  if(request.headers.get('origin')!==approvalOrigin)return fail(403);
  const cors={...noStore,'Access-Control-Allow-Origin':approvalOrigin,Vary:'Origin'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,
   'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Authorization,X-Neo-Consent,X-Neo-Csrf,X-Neo-Expires'}});
  if(request.method!=='POST'||request.headers.get('x-neo-consent')!=='approve')return fail(403);
  const expires=Number(request.headers.get('x-neo-expires'));
  const proof=request.headers.get('x-neo-csrf')||'';
  if(!Number.isSafeInteger(expires)||expires<=Date.now()||expires>Date.now()+120000||
   !/^[A-Za-z0-9_-]{43}$/.test(proof))return fail(403);
  // Verify the challenge with WebCrypto and require a live, explicitly supplied NeoPep bearer.
  const signature=Uint8Array.from(atob(proof.replaceAll('-','+').replaceAll('_','/')+'='),char=>char.charCodeAt(0));
  if(!await crypto.subtle.verify('HMAC',csrfKey,signature,utf8.encode(JSON.stringify([p,expires]))))return fail(403);
  const bearer=/^Bearer ([A-Za-z0-9_.-]{1,8192})$/.exec(request.headers.get('authorization')||'')?.[1];
  if(!bearer)return fail(401);
  try{
   const session=await sessionFor(bearer,{clientId:p.client_id,proof});
   if(!session)return fail(403);
   const code=await issuer.issueCode({session,clientId:p.client_id,redirectUri:p.redirect_uri,challenge:p.code_challenge,
    method:p.code_challenge_method,requestedResource:p.resource,requestedScope:p.scope,consent:true});
   const redirect=new URL(p.redirect_uri);
   redirect.searchParams.set('state',p.state);
   redirect.searchParams.set('code',code);
   return Response.json({redirect:redirect.href},{headers:cors});
  }catch{return Response.json({error:'authorization_unavailable'},{status:403,headers:cors});}
 };
}
