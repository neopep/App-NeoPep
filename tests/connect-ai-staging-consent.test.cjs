const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
test('consentimento Teste preserva conhecimento e restringe escopo',()=>{
 const panel=fs.readFileSync('dist/admin/admin-connect-ai.js','utf8'),cloud=fs.readFileSync('src/cloud.js','utf8'),html=fs.readFileSync('dist/admin/index.html','utf8');
 assert.match(panel,/mountKnowledge\(dialog\);mountConsent\(dialog,window.NeoCloud\)/);
 assert.match(panel,/Autorizar leitura/);assert.match(panel,/params.get\('scope'\)!=='campaigns:read'/);
 assert.match(panel,/dialog.showModal\(\)/);assert.match(cloud,/location.origin==='https:\/\/teste.app.neopep.com.br'&&config.supabaseUrl==='https:\/\/qnuluspqfazdppciermw.supabase.co'/);
 assert.match(cloud,/permission!=='approve'\|\|wantsDrafts/);assert.match(cloud,/validateConnectAIReturn\(target,redirect\)/);
 assert.match(html,/connect-src 'self' https:\/\/qnuluspqfazdppciermw.supabase.co https:\/\/connect-teste.neopep.com.br;/);
});
