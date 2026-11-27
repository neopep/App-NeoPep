// Signed proof of guide retrieval. Not a login credential or approval to publish.
import {guideVersion} from './publication-guide.mjs';
const ttl=10*60*1000;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export function createGuideReceipts(key,{now=Date.now}={}){
 const valid=p=>p?.environment==='test'&&uuid.test(p.id??'')&&uuid.test(p.ownerId??'')&&p.campaignAdmin===true&&p.scopes?.includes('campaigns:read')&&p.scopes?.includes('campaigns:drafts');
 const data=(p,expires)=>new TextEncoder().encode(JSON.stringify(['neopep-publication-guide-v1',guideVersion,p.environment,p.id,p.ownerId,expires]));
 return {
  async issue(p){
   if(!valid(p))return null;
   const expires=now()+ttl;
   return expires+'.'+hex(await crypto.subtle.sign('HMAC',key,data(p,expires)));
  },
  async verify(p,proof){
   if(!valid(p)||typeof proof!=='string'||!/^\d{13}\.[0-9a-f]{64}$/.test(proof))return false;
   const [time,signature]=proof.split('.'),expires=Number(time),clock=now();
   if(expires<=clock||expires>clock+ttl)return false;
   const bytes=Uint8Array.from(signature.match(/../g),b=>parseInt(b,16));
   return crypto.subtle.verify('HMAC',key,bytes,data(p,expires));
  }
 };
}
