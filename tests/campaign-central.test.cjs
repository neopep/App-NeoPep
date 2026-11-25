const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');

test('central adota revisões, salva publicações separadas e protege os agendamentos',async()=>{
 const db=new PGlite();
 const apply=path=>db.exec(fs.readFileSync(path,'utf8'));
 try{
  const fixture=fs.readFileSync('tests/shop.test.cjs','utf8').match(/db\.exec\(`(create role service_role;[^\x60]+)`\)/)[1];
  await db.exec(fixture+`create function auth.jwt() returns jsonb language sql stable as $$
   select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;`);
  for(const file of fs.readdirSync('supabase/migrations').sort())await apply('supabase/migrations/'+file);
  await apply('tests/fixtures/connect/whatsapp-grupos.sql');
  for(const path of [
   'campaign-editor/20261124233000_campaign_editor_versions.sql',
   'campaign-dispatch/20261124234500_campaign_dispatch.sql',
   'campaign-wa-homologation/20261125023000_campaign_wa_homologation.sql',
   ...fs.readdirSync('release/campaign-rich').filter(file=>file.endsWith('.sql')).sort().map(file=>'campaign-rich/'+file)
  ])await apply('release/'+path);
  await apply('tests/campaign-central-seed.sql');
  await apply('release/campaign-central/preflight.sql');
  await apply('release/campaign-central/20261125143000_campaign_central.sql');
  await apply('tests/campaign-central.sql');
  await apply('release/campaign-central/postflight.sql');
  await apply('release/campaign-central/rollback.sql');
  const {rows}=await db.query(`select not has_function_privilege('authenticated','public.neo_campaign_central_v1(text,jsonb)','execute') as revoked,
   (select count(*)::int from neo_private.campaign_wa_rich_batches)=3 as preserved`);
  assert.deepEqual(rows,[{revoked:true,preserved:true}]);
 }catch(error){delete error.query;throw error;}
 finally{await db.close();}
});
