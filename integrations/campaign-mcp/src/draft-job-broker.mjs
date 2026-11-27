// Private candidate, not an MCP or HTTP endpoint. All SQL is parameterized.
import {testProfile} from './environments.mjs';
import {createDraftJobRunner} from './draft-job-runner.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
export function createPrivateDraftJobExecutor({profile,env,sql,verifyDatabase,freshSession,writeDraft,now=Date.now}){
 const enabled=profile?.name==='test'&&profile.project===testProfile.project&&profile.supabaseOrigin===testProfile.supabaseOrigin&&env.NEO_CONNECT_AI_ENABLED==='1'&&env.NEO_CONNECT_AI_DRAFTS==='1'&&env.NEO_CONNECT_AI_DRAFT_JOBS==='1';
 const authorized=async p=>p?.environment==='test'&&p.campaignAdmin===true&&uuid(p.id)&&uuid(p.ownerId)&&Number.isFinite(p.expiresAt)&&p.expiresAt>now()&&p.scopes?.includes('campaigns:read')&&p.scopes.includes('campaigns:drafts')&&Boolean(await freshSession(p.id,p.ownerId));
 const run=createDraftJobRunner({enabled,now,authorize:authorized,
  claim:async(p,j)=>{const [row]=await sql`select neo_private.connect_ai_job_claim_payload(${p.id}::uuid,${p.ownerId}::uuid,${j}::uuid) as value`;return row?.value;},
  status:async(p,j)=>{const [row]=await sql`select neo_private.connect_ai_job_control(${p.id}::uuid,${p.ownerId}::uuid,${j}::uuid,'status') as value`;return row?.value;},
  result:async(p,j,r,l,o,v)=>{const [row]=await sql`select neo_private.connect_ai_job_result(${p.id}::uuid,${p.ownerId}::uuid,${j}::uuid,${r}::uuid,${l}::uuid,${o}::text,${v}::integer) as value`;return row?.value===true;},
  writeDraft:async(p,op,input)=>{if(!await authorized(p))throw Error('AUTH_REQUIRED');return writeDraft(p,op,input);}
 });
 return async(p,j)=>{if(!enabled||!uuid(j)||!await authorized(p))throw Error('FORBIDDEN');await verifyDatabase();return run(p,j);};
}
