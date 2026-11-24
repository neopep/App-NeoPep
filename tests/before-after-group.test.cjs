'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('Before/After private save requires explicit action and confirmation',()=>{
 const app=read('src/app.js');
 assert.match(app,/data-export-cloud[^>]*hidden disabled/);
 assert.match(app,/Cloud\.beforeAfterAvailable\(\)/);
 assert.match(app,/window\.confirm\('Salvar esta comparação/);
 assert.match(app,/Cloud\.saveBeforeAfter\(file,photos\)/);
});
test('owner-only private comparison read and image validation',()=>{
 const cloud=read('src/cloud.js');
 assert.match(cloud,/async savedBeforeAfter\(\)/);
 assert.match(cloud,/async beforeAfterBlob\(item\)/);
 assert.match(cloud,/async saveBeforeAfter\(blob,photos\)/);
 assert.match(cloud,/!api\.hasConsent\('photos'\)/);
 assert.match(cloud,/\.eq\('user_id',account\)/);
 assert.match(cloud,/bucket\.upload\(path,blob,\{contentType:'image\/jpeg',upsert:false/);
});
test('group picker does not automatically publish and confirms chosen comparison',()=>{
 const c=read('dist/community.js');
 assert.match(c,/data-community="choose_comparison"/);
 assert.match(c,/async function openComparisonPicker\(\)/);
 assert.match(c,/async function selectSavedComparison\(id,trigger\)/);
 assert.match(c,/NeoCloud\.beforeAfterBlob\(item\)/);
 assert.match(c,/selectedComparison=\{id:item\.id/);
 assert.match(c,/window\.confirm\('Publicar esta comparação Antes\/Depois no Grupo/);
 const confirm=c.indexOf("window.confirm('Publicar esta comparação Antes/Depois");
 const upload=c.indexOf('window.NeoCloud.uploadCommunityPhoto(photo)');
 assert.ok(confirm>=0&&upload>confirm,'confirmation precedes upload');
 assert.match(c,/const clearPhoto=\(\)=>\{[^\n]*selectedComparison=null/);
});
test('draft SQL uses private bucket and RLS owner checks; does not touch payment functions',()=>{
 const sql=read('release/before-after/prepare.sql');
 assert.match(sql,/neo-comparisons','neo-comparisons',false/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/user_id = \(select auth\.uid\(\)\)/);
 assert.doesNotMatch(sql,/p\.user_id\s*=\s*user_id\b/,'photo owner must never be inferred from shadowed column');
 assert.match(sql,/p\.user_id\s*=\s*\(select auth\.uid\(\)\)/);
 assert.match(sql,/\[\.\]jpg\$/,'storage path must end in JPEG');
 assert.doesNotMatch(sql,/mercadopago|neo_shop_payment|payment_event/i);
});

test('private comparison deletion keeps storage read policy valid until removal',()=>{
 const cloud=read('src/cloud.js');
 const method=cloud.slice(cloud.indexOf('async deleteBeforeAfter(item)'),cloud.indexOf('async photos()'));
 const storage=method.indexOf("client.storage.from('neo-comparisons').remove([item.path])");
 const metadata=method.indexOf("client.from('neo_saved_comparisons').delete()");
 assert.ok(storage>=0&&metadata>storage,'delete storage object before deleting required metadata');
});

test('account deletion includes private comparison files and remains compatible before bucket migration',()=>{
 const edge=read('supabase/functions/delete-account/index.ts');
 assert.match(edge,/getBucket\('neo-comparisons'\)/);
 assert.match(edge,/storage\.from\('neo-comparisons'\)\.list\(user\.id/);
 assert.match(edge,/storage\.from\('neo-comparisons'\)\.remove\(/);
 assert.match(edge,/status!=='404'/);
 assert.ok(edge.indexOf("storage.from('neo-comparisons').remove(")<edge.indexOf('admin.auth.admin.deleteUser(user.id)'), 'remove personal comparisons before deleting auth user');
});

test('saved comparison gallery allows private view and confirmed deletion',()=>{
 const app=read('src/app.js');
 assert.match(app,/data-saved-comparisons/);
 assert.match(app,/async function showSavedComparisons\(trigger\)/);
 assert.match(app,/Cloud\.savedBeforeAfter\(\)/);
 assert.match(app,/Cloud\.beforeAfterURL\(item\)/);
 assert.match(app,/Cloud\.deleteBeforeAfter\(item\)/);
 assert.match(app,/window\.confirm\('Excluir permanentemente esta comparação privada/);
 assert.match(app,/generation===loadGeneration&&mode==='cloud'&&Cloud\.user\?\.id===account/);
 assert.equal(read('dist/app.js'),app,'build output must match frontend source');
});
test('comparison RLS requires explicit health photos and terms consent for both inserts',()=>{
 const sql=read('release/before-after/prepare.sql');
 for(const consent of ['health','photos','terms']){
  assert.equal(sql.split("public.neo_has_consent('"+consent+"')").length-1,2,'both metadata and Storage must enforce '+consent);
 }
});
test('consent revocation does not block user deletion of private comparisons',()=>{
 const cloud=read('src/cloud.js');
 const list=cloud.slice(cloud.indexOf('async savedBeforeAfter(){'),cloud.indexOf('async saveBeforeAfter('));
 const removal=cloud.slice(cloud.indexOf('async deleteBeforeAfter(item){'),cloud.indexOf('async photos(){'));
 assert.match(list,/\bneed\(\)/);
 assert.doesNotMatch(list,/needsHealth\(\)/);
 assert.match(removal,/\bneed\(\)/);
 assert.doesNotMatch(removal,/needsHealth\(\)/);
});

test('deployment rebuilds client bundle from tracked source, preventing stale dist/cloud.js',()=>{
 const config=JSON.parse(read('vercel.json'));
 const scripts=JSON.parse(read('package.json')).scripts;
 const build=read('scripts/build.cjs');
 assert.match(config.buildCommand,/npm run build/);
 assert.match(scripts.build,/scripts\/build\.cjs/);
 assert.match(build,/entryPoints: \['src\/cloud\.js'\]/);
 assert.match(build,/outfile: 'dist\/cloud\.js'/);
 assert.match(build,/fs\.copyFileSync\('src\/app\.js', 'dist\/app\.js'\)/);
 const ci=read('.github/workflows/staging-ci.yml');
 assert.match(ci,/npm run build/);
 assert.match(ci,/npm run check/);
});
test('post-build bundle contains private comparison client APIs',()=>{
 const compiled=read('dist/cloud.js');
 assert.match(compiled,/neo_saved_comparisons/);
 assert.match(compiled,/neo-comparisons/);
});
