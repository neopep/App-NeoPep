const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const old='release/pacote-final-20261125/';
const next='release/pacote-campanhas-20261126-01/';
test('campanhas: replay integral de migracoes e rotas de pausa (banco descartavel)',async()=>{
 const db=new PGlite();
 const apply=async path=>{try{await db.exec(fs.readFileSync(path,'utf8'));}catch(e){throw Error(path+': '+e.message);}};
 const actor='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002';
 try{
 const fixture=fs.readFileSync('tests/shop.test.cjs','utf8').match(/db\.exec\(`(create role service_role;[^\x60]+)`\)/)[1];
 await db.exec(fixture+`alter table storage.objects add column metadata jsonb default '{}'::jsonb; create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;`);
 for(const f of fs.readdirSync('supabase/migrations').sort())await apply('supabase/migrations/'+f);
 await apply('tests/fixtures/connect/whatsapp-grupos.sql');
 for(const path of ['campaign-editor/20261124233000_campaign_editor_versions.sql','campaign-dispatch/20261124234500_campaign_dispatch.sql','campaign-homologation/20261125020000_campaign_homologation.sql','campaign-wa-homologation/20261125023000_campaign_wa_homologation.sql',...fs.readdirSync('release/campaign-rich').filter(f=>f.endsWith('.sql')).sort().map(f=>'campaign-rich/'+f)])await apply('release/'+path);
 await apply('tests/campaign-central-seed.sql');
 await apply('release/campaign-central/preflight.sql');
 await apply('release/campaign-central/20261125143000_campaign_central.sql');
 for(const f of ['20261125210000_campaign_delete.sql','20261125210500_campaign_reference_jpeg.sql','20261125211000_campaign_weekly.sql','auditoria-final-preflight.sql','20261125222000_campaign_publication_delete.sql','20261125223000_campaign_recurrence_times.sql','20261125224000_campaign_manual_delete.sql','auditoria-final-postflight.sql','campaign_originals_candidate.sql','campaign_shared_queue_candidate.sql','campaign_app_central_candidate.sql','campaign_app_settings_candidate.sql','campaign_app_rich_popup_candidate.sql','campaign_weekday_times.sql','campaign_cross_channel_candidate.sql','campaign_app_draft_repeat_candidate.sql','campaign_app_repeat_manage_candidate.sql','campaign_wa_independent_review_candidate.sql'])await apply(old+f);
 await apply('tests/fixtures/connect/campaign-wa-legacy-preclaim.sql');
 await apply(old+'campaign_manual_claim_candidate.sql');
 await apply(next+'campaign_pause_test_candidate.sql');
 await apply(next+'campaign_pause_manual_test_candidate.sql');
 const rpc=async(action,payload={})=>(await db.query('select public.neo_campaign_central_v1($1,$2::jsonb) as result',[action,JSON.stringify(payload)])).rows[0].result;
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({iss:'https://qnuluspqfazdppciermw.supabase.co/auth/v1'})]);await db.exec('set role authenticated');};
 const request=()=>require('node:crypto').randomUUID();
 await as(actor);
 for(const prefix of ['', 'app_']){
  const parent=await rpc(prefix+'create',{title:'Campanha fictícia',request_id:request()});
  const id=parent.campaign_id;
  assert.ok((await rpc(prefix+'list')).some(row=>row.campaign_id===id&&row.paused_at===null));
  await rpc(prefix+'set_enabled',{campaign_id:id,enabled:false,expected_enabled:true,confirmed:true});
  assert.ok((await rpc(prefix+'get',parent)).paused_at);
  await as(other);
  await assert.rejects(rpc(prefix+'set_enabled',{campaign_id:id,enabled:true,expected_enabled:false,confirmed:true}),/campaign_pause_owner_required/);
  await as(actor);
  await rpc(prefix+'set_enabled',{campaign_id:id,enabled:true,expected_enabled:false,confirmed:true});
  assert.equal((await rpc(prefix+'get',parent)).paused_at,null);
 }
 await db.exec('reset role');
 const result=(await db.query("select originals_enabled,(select count(*)::int from neo_private.campaign_wa_rich_messages) as messages from neo_private.campaign_wa_rich_control where singleton")).rows[0];
 assert.equal(result.originals_enabled,false);assert.equal(result.messages,0);
 assert.equal((await db.query("select has_function_privilege('anon','public.neo_campaign_central_v1(text,jsonb)','execute') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
