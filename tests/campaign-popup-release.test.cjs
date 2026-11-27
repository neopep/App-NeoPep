'use strict';
const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const release='release/pacote-final-20261125/';
test('official and test popup use shared safe renderer and retain legacy fallback',()=>{
 const src=read('src/app.js'),dist=read('dist/app.js');
 assert.equal(src,dist);
 assert.match(src,/function renderCampaignBlocks\(dialog,blocks,owner,onClicked\)/);
 assert.match(src,/p\.textContent=value/);
 assert.match(src,/!rich&&item\.link_url/);
 assert.match(src,/renderCampaignBlocks\(dialog,item\.blocks,owner/);
 assert.match(src,/Cloud\.campaignOriginalURL/);
 assert.match(read('src/cloud.js'),/async campaignOriginalURL\(path\)/);
});
test('test popup retains allowlist, consent, media reservation and no push lane',()=>{
 const sql=read(release+'campaign_app_rich_popup_candidate.sql');
 assert.match(sql,/campaign_test_accounts where user_id=auth\.uid\(\) and enabled/);
 assert.match(sql,/public\.neo_has_consent\('terms'\)/);
 assert.match(sql,/r\.offered_at>now\(\)-interval '5 minutes'/);
 assert.match(sql,/x->>'media_path'=p_path/);
 assert.doesNotMatch(sql,/neo_campaign_push_claim\(/);
});
test('official popup and central have independent preconditions and preserve dispatch gate',()=>{
 const popup=read(release+'campaign_official_app_popup_candidate.sql'),central=read(release+'campaign_official_app_central_candidate.sql');
 assert.match(popup,/official_app_gate_must_remain_disabled_during_migration/);
 assert.match(popup,/campaign_app_confirmation_required/);
 assert.match(popup,/not config\.app_enabled/);
 assert.match(popup,/neo_private\.campaign_matches\(c,auth\.uid\(\),now\(\)\)/);
 assert.match(central,/neo_campaign_dispatch_admin_v1\('publish_app'/);
 for(const sql of [popup,central])assert.doesNotMatch(sql,/qnuluspqfazdppciermw|campaign_test_batches/);
 assert.doesNotMatch(popup,/update neo_private\.campaign_dispatch_config/i);
});
test('web assets invalidate previous campaign cache and permit video preview',()=>{
 assert.match(read('dist/admin/index.html'),/media-src 'self' blob:/);
 assert.match(read('dist/admin/index.html'),/campaign-editor\.js\?v=campanhas-central-20/);
 assert.match(read('scripts/build-staging.cjs'),/pwa-v67-agenda/);
 assert.equal(JSON.parse(read('vercel.json')).git.deploymentEnabled['fix/gps-cidade-estado-teste-20261125'],false);
});
