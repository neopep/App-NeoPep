const fs=require('node:fs');
const assert=require('node:assert/strict');
const test=require('node:test');
const central=fs.readFileSync('dist/admin/campaign-central.js','utf8');
const editor=fs.readFileSync('dist/admin/campaign-editor.js','utf8');
const admin=fs.readFileSync('dist/admin/admin.js','utf8');
const folder='release/pacote-final-20261125/';
const read=name=>fs.readFileSync(folder+name,'utf8');
const weekly=new Function('Date',central.slice(central.indexOf('  function weeklyDates('),central.indexOf('  let loadEpoch='))+';return weeklyDates;')(class extends Date{constructor(...a){super(...(a.length?a:['2026-11-25T12:00:00Z']))}});
const rule={start:'2026-11-26',end:'2026-12-04',frequency:'weekly',times:['09:00'],count:24,days:[1,3,5],day_times:{1:'09:00',3:'18:30',5:'12:15'}};
test('recorrência por dia preserva horários e rejeita regras inválidas',()=>{
 assert.deepEqual(weekly(rule),['2026-11-27T12:15','2026-11-30T09:00','2026-12-02T18:30','2026-12-04T12:15']);
 for(const invalid of [{...rule,day_times:{1:'09:00',3:'18:30'}},{...rule,day_times:{...rule.day_times,5:'25:00'}},{...rule,day_times:{...rule.day_times,0:'10:00'}},{...rule,frequency:'daily'}])assert.deepEqual(weekly(invalid),[]);
 assert.deepEqual(weekly({...rule,day_times:undefined,times:['09:00','18:00'],count:3}),['2026-11-27T09:00','2026-11-27T18:00','2026-11-30T09:00']);
 assert.match(read('campaign_weekday_times.sql'),/campaign_weekly_invalid_day_times/);
});
test('central App exige contrato de servidor, mantém gate e não amplia público de Teste',()=>{
 assert.match(admin,/appCentralAvailable=Array\.isArray\(await cloud\.campaignCentral\('app_list'/);
 assert.match(editor,/publication&&channel==='whatsapp'\?gates\.whatsapp_rich/);
 assert.match(read('campaign_app_central_candidate.sql'),/campaign_app_owner_required/);
 assert.match(read('campaign_app_central_candidate.sql'),/neo_campaign_test_admin_v1\('publish'/);
 assert.match(read('campaign_app_central_candidate.sql'),/revoke all on function neo_private\.campaign_app_central/);
});
test('cópia é transacional, conserva conteúdo e não dispara publicação',()=>{
 const sql=read('campaign_cross_channel_candidate.sql');
 assert.match(sql,/campaign_copy_original_media_unavailable/);
 assert.match(sql,/campaign_copy_missing_revision/);
 assert.match(sql,/campaign_copy_request_conflict/);
 assert.match(sql,/item\.draft\|\|jsonb_build_object/);
 assert.doesNotMatch(sql,/public\.neo_campaign_(?:rich_admin_v1|test_admin_v1|dispatch_admin_v1)\(/);
 assert.match(central,/editable&&onCross/);
});
test('fila compartilhada é administrativa e somente leitura',()=>{
 const sql=read('campaign_shared_queue_candidate.sql');
 assert.match(sql,/campaign_queue_admin_required/);
 assert.match(sql,/revoke all on function neo_private\.campaign_shared_queue/);
 assert.doesNotMatch(sql,/\b(?:insert into|update neo_private|delete from)\b/i);
 assert.match(fs.readFileSync('dist/admin/admin-whatsapp.js','utf8'),/campaignCentral\('shared_queue'/);
});
