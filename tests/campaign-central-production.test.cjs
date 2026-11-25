const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {render}=require('../release/production/ciclo-20261125/render-campaigns.cjs');

test('Central oficial preserva propriedade, isolamento, idempotência e cancelamento',async()=>{
 const db=new PGlite();
 const apply=path=>db.exec(fs.readFileSync(path,'utf8'));
 try{
  const fixture=fs.readFileSync('tests/shop.test.cjs','utf8').match(/db\.exec\(`(create role service_role;[^\x60]+)`\)/)[1];
  await db.exec(fixture+`create function auth.jwt() returns jsonb language sql stable as $$
   select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;`);
  for(const file of fs.readdirSync('supabase/migrations').sort())await apply('supabase/migrations/'+file);
  await apply('tests/fixtures/connect/whatsapp-grupos.sql');
  await apply('release/campaign-editor/20261124233000_campaign_editor_versions.sql');
  await apply('tests/campaign-central-seed.sql');
  const sql=render();
  assert.doesNotMatch(sql,/qnuluspqfazdppciermw|teste\.app\.neopep\.com\.br|campaign_wa_test_config/);
  await db.exec(sql);
  assert.deepEqual((await db.query(`select enabled, owner_id from neo_private.campaign_wa_official_config`)).rows,
   [{enabled:false,owner_id:null}]);
  const cases=fs.readFileSync('tests/campaign-central.sql','utf8')
   .replaceAll('qnuluspqfazdppciermw','cpslafpzjtbpmoxxysaa')
   .replaceAll('campaign_wa_test_config','campaign_wa_official_config');
  await db.exec(cases);
  await apply('release/campaign-central/postflight.sql');
  await apply('release/campaign-central/rollback.sql');
  const {rows}=await db.query(`select not has_function_privilege('authenticated','public.neo_campaign_central_v1(text,jsonb)','execute') as revoked,
   (select count(*)::int from neo_private.campaign_wa_rich_batches)=3 as preserved`);
  assert.deepEqual(rows,[{revoked:true,preserved:true}]);
 }catch(error){delete error.query;throw error;}
 finally{await db.close();}
});
