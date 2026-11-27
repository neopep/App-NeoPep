import {testProfile} from './environments.mjs';
import postgres from 'postgres';
import {decodeJwt} from 'jose';
import {createNeoSession} from './neo-session.mjs';
import {createDraftWriter} from './draft-writer.mjs';
import {createPrivateDraftJobExecutor} from './draft-job-broker.mjs';
import {createPrivateMediaTickets} from './media-ticket-broker.mjs';
import {createMediaValidator} from './media-validator.mjs';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
const unhex=value=>Uint8Array.from(value.match(/../g),byte=>parseInt(byte,16));
const liveConnection=row=>row&&!row.revoked_at&&Date.parse(row.expires_at)>Date.now();

export async function openSessionBroker(env,request=fetch,connect=postgres,profile=testProfile){
 const keyHex=env.NEO_CONNECT_AI_SESSION_KEY;
 if(!/^[a-fA-F0-9]{64}$/.test(keyHex||'')||!env.NEO_CONNECT_AI_DB?.connectionString)throw Error('BROKER_CONFIGURATION');
 const key=await crypto.subtle.importKey('raw',unhex(keyHex),'AES-GCM',false,['encrypt','decrypt']);
 const sql=connect(env.NEO_CONNECT_AI_DB.connectionString,{max:1,prepare:false,connect_timeout:5,fetch_types:false});
 async function verifyDatabase(){
  const [row]=await sql`select project_ref from neo_private.connect_ai_environment`;
  if(row?.project_ref!==profile.project)throw Error('BROKER_ENVIRONMENT_MISMATCH');
 }
 const verify=createNeoSession({publishableKey:env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY,request,profile});
 const aad=(id,ownerId)=>encoder.encode(JSON.stringify([id,ownerId]));
 async function getConnection(id){
  const [row]=profile.name==='test'&&env.NEO_CONNECT_AI_DRAFTS==='1'
   ?await sql`select id,owner_id,client_id,expires_at,revoked_at,scopes from neo_private.connect_ai_connections where id=${id}`
   :await sql`select id,owner_id,client_id,expires_at,revoked_at from neo_private.connect_ai_connections where id=${id}`;
  return row;
 }
 async function readSession(id,ownerId){
  const [row]=await sql`select s.iv,s.ciphertext from neo_private.connect_ai_sessions s
   join neo_private.connect_ai_connections c on c.id=s.connection_id
   where s.connection_id=${id} and c.owner_id=${ownerId} and c.revoked_at is null
   and s.expires_at>now() and c.expires_at>now()`;
  if(!row)return null;
  return decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(row.iv),additionalData:aad(id,ownerId)},key,unhex(row.ciphertext)));
 }
 // No per-request session cache for jobs: check live connection, scope and administrative ACL every time.
 async function freshDraftSession(id,ownerId){
  const row=await getConnection(id);
  if(!liveConnection(row)||row.owner_id!==ownerId||!row.scopes?.includes('campaigns:read')||!row.scopes.includes('campaigns:drafts'))return null;
  const token=await readSession(id,ownerId);
  if(!token)return null;
  const checked=await verify(token,'inspect',{id});
  if(checked.ownerId!==ownerId||checked.data?.id!==id||checked.data.revoked_at)return null;
  return token;
 }
 const jobEnabled=profile.name==='test'&&env.NEO_CONNECT_AI_ENABLED==='1'&&env.NEO_CONNECT_AI_DRAFTS==='1'&&env.NEO_CONNECT_AI_DRAFT_JOBS==='1';
 const runDraftJob=jobEnabled?createPrivateDraftJobExecutor({profile,env,sql,verifyDatabase,freshSession:freshDraftSession,
  writeDraft:createDraftWriter({publishableKey:env.NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY,sessionFor:freshDraftSession,request,profile,enabled:true})}):undefined;
 const mediaEnabled=profile.name==='test'&&env.NEO_CONNECT_AI_ENABLED==='1'&&env.NEO_CONNECT_AI_DRAFTS==='1'&&env.NEO_CONNECT_AI_MEDIA==='1';
 const mediaTickets=mediaEnabled?createPrivateMediaTickets({profile,env,sql,verifyDatabase,freshSession:freshDraftSession,request,validateBytes:createMediaValidator(env.NEO_CONNECT_AI_MEDIA_VALIDATOR,env.NEO_CONNECT_AI_MEDIA_VALIDATOR_SECRET)}):undefined;
 return {
  verifyDatabase,
  ...(mediaTickets?{mediaTickets}:{}),
  ...(runDraftJob?{runDraftJob,reconcileDraftJob:runDraftJob.reconcile}:{}),
  close:()=>sql.end({timeout:2}),
  async fetch(req){
   const p=new URL(req.url).pathname;
   const d=await req.json();
   let result=null;
   if(p==='/consent/claim'){
    const digest=hex(await crypto.subtle.digest('SHA-256',encoder.encode(d.proof)));
    await sql`delete from neo_private.connect_ai_consent_claims where expires_at<now()`;
    const rows=await sql`insert into neo_private.connect_ai_consent_claims (proof,expires_at)
     values (${digest},now()+interval '2 minutes') on conflict do nothing returning proof`;
    result=rows.length===1;
   }else if(p==='/session/bind'){
    const expiry=new Date(decodeJwt(d.token).exp*1000);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(d.id,d.ownerId)},key,encoder.encode(d.token));
    await sql`delete from neo_private.connect_ai_sessions s using neo_private.connect_ai_connections c
     where s.connection_id=c.id and (s.expires_at<=now() or c.revoked_at is not null)`;
    const rows=await sql`insert into neo_private.connect_ai_sessions (connection_id,iv,ciphertext,expires_at)
     select id,${hex(iv)},${hex(cipher)},${expiry} from neo_private.connect_ai_connections
     where id=${d.id} and owner_id=${d.ownerId} and revoked_at is null and expires_at>now()
     on conflict do nothing returning connection_id`;
    result=rows.length===1;
   }else if(p==='/session/read'){
    result=await readSession(d.id,d.ownerId);
   }else if(p==='/connection/read'){
    const row=await getConnection(d.id);
    if(liveConnection(row))result={id:row.id,ownerId:row.owner_id,clientId:row.client_id,expiresAt:Date.parse(row.expires_at),
     environment:profile.name,resource:profile.resource,scopes:row.scopes??['campaigns:read']};
   }else if(p==='/grant/register'){
    await sql`insert into neo_private.connect_ai_oauth_grants (digest,connection_id,kind,redirect_uri,challenge,expires_at)
     values (${d.digest},${d.connectionId},'code',${d.redirectUri},${d.challenge},${new Date(d.expiresAt)})`;
    result=true;
   }else if(p==='/grant/rotate'){
    const [grant]=await sql`select connection_id from neo_private.connect_ai_oauth_grants where digest=${d.digest} and kind=${d.kind}`;
    const row=grant&&await getConnection(grant.connection_id);
    if(!liveConnection(row)||row.client_id!==d.clientId)return Response.json(null);
    const token=await readSession(row.id,row.owner_id);
    if(!token)return Response.json(null);
    const checked=await verify(token,'inspect',{id:row.id});
    if(checked.ownerId!==row.owner_id||!checked.data||checked.data.revoked_at)return Response.json(null);
    const [query]=await sql`select neo_private.connect_ai_rotate_grant(
     ${d.digest},${d.kind},${d.clientId},${d.redirectUri},${d.challenge},${d.nextDigest}) as rotated`;
    result=query.rotated?{...query.rotated,scopes:row.scopes??['campaigns:read']}:null;
   }else return new Response(null,{status:404});
   return Response.json(result);
  }
 };
}
