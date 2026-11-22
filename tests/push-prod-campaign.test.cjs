const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('supabase/functions/push-dispatch/index.ts','utf8');

test('preserva autenticação por segredo e notificações oficiais',()=>{
 assert.match(source,/NEO_PUSH_CRON_SECRET/);
 assert.match(source,/sameSecret\(receivedSecret, configuredSecret\)/);
 for(const name of ['neo_push_claim','neo_community_push_claim','neo_support_push_claim','neo_event_push_claim','neo_push_finish','neo_community_push_finish','neo_support_push_finish','neo_event_push_finish'])assert.ok(source.includes(name),name);
});
test('adiciona push campanha como fila opcional e finalização própria',()=>{
 assert.match(source,/client\.rpc\("neo_campaign_push_claim"\)/);
 assert.match(source,/\.\.\.\(campaigns\.error[\s\S]*?campaigns\.data/);
 assert.match(source,/job\.kind === "campaign"[\s\S]*?"neo_campaign_push_finish"/);
 assert.match(source,/campaign_available: false/);
 assert.match(source,/"campaign",[\s\S]*?\]\.includes\(job\.kind/);
});
test('nunca usa chaves VAPID no frontend nem altera role de aplicação',()=>{
 assert.match(source,/Deno\.env\.get\("NEO_VAPID_PRIVATE_KEY"\)/);
 assert.match(source,/Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
 assert.doesNotMatch(source,/sb_secret_/);
});
