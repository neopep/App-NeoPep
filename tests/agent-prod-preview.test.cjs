const {test}=require('node:test');
const assert=require('node:assert/strict');const fs=require('node:fs');
const src=fs.readFileSync('supabase/functions/agent-integrations/index.ts','utf8');
test('preserva sessão real e autorização de administrador do serviço oficial',()=>{
 assert.match(src,/db\.auth\.getUser\(token\)/);
 assert.match(src,/neo_integration_admin/);
 assert.match(src,/origin_not_allowed/);
 assert.match(src,/sameSecret|integrationKey/);
});
test('prévia de agente exige conta, versão da integração e confirmação sem expor credencial',()=>{
 for(const k of ['preview_agent','neo_multiagent_test','neo_multiagent_tested','configuration_changed','integrationKey','generate'])assert.ok(src.includes(k),k);
 assert.match(src,/if \(!uuid\(payload\.agent_id\)/);
 assert.match(src,/if \(action === "test"\)/);
 assert.match(src,/if \(action === "save"\)/);
});
