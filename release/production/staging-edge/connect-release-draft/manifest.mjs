export const maxBytes=50*1024*1024;
export const staging='https://qnuluspqfazdppciermw.supabase.co';
export const fileName='NeoPepConnectSetup.exe';
export const bucket='neo-connect-releases';
export function parseManifest(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Manifesto inválido.');
 const {version,profile,channel,bytes,sha256,artifact,signature}=input;
 if(typeof version!=='string'||! /^(0|[1-9][0-9]{0,7})([.](0|[1-9][0-9]{0,7})){2}$/.test(version)||
  profile!=='staging'||channel!=='stable'||!Number.isSafeInteger(bytes)||bytes<1||bytes>maxBytes||
  typeof sha256!=='string'||! /^[0-9a-f]{64}$/.test(sha256)||
  typeof artifact!=='string'||! /^[A-Za-z0-9._-]{1,120}$/.test(artifact)||
  typeof signature!=='string'||signature.length<344||signature.length>1024||signature.length%4||
  !/^[A-Za-z0-9+/]+={0,2}$/.test(signature))throw Error('Confira versão, perfil Teste, canal, tamanho, SHA-256, artefato e assinatura.');
 if(version==='0.2.5'&&(bytes!==50102784||sha256!=='314d03ffba3871da65ffb95df82fba3b35f19e4aba14038ef583590db7d9b759'))
  throw Error('Tamanho ou SHA-256 diverge do instalador 0.2.5 de referência.');
 return {version,profile,channel,bytes,sha256,artifact,signature};
}
export function canonical(m){
 return ['neopep-connect/v1',m.version,m.profile,m.channel,String(m.bytes),m.sha256,m.artifact].join('\n');
}
export async function verifyManifest(manifest,jwk,subtle=crypto.subtle){
 if(jwk.kty!=='RSA'||typeof jwk.n!=='string'||typeof jwk.e!=='string'||'d'in jwk)throw Error('Chave pública inválida.');
 const algorithm={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'};
 const key=await subtle.importKey('jwk',{kty:'RSA',n:jwk.n,e:jwk.e},algorithm,false,['verify']);
 if(key.algorithm.modulusLength<2048)return false;
 return subtle.verify(algorithm,key,Uint8Array.from(atob(manifest.signature),c=>c.charCodeAt(0)),new TextEncoder().encode(canonical(manifest)));
}
export async function verifyObject(body,manifest,hash){
 if(!body)return false;
 const reader=body.getReader();
 let bytes=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>manifest.bytes){await reader.cancel();return false;}
   hash.update(value);
  }
  return bytes===manifest.bytes&&hash.digest('hex')===manifest.sha256;
 }finally{reader.releaseLock();}
}
export function sameRelease(existing,m){
 return ['version','profile','channel','bytes','sha256','artifact','signature'].every(k=>
  (k==='signature'?existing.signature??existing.release_signature:existing[k])===m[k]);
}
export function precedes(a,b){
 const x=a.split('.').map(Number),y=b.split('.').map(Number);
 for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]<y[i];}
 return false;
}
