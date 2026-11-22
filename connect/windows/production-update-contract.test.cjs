const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('connect/backend/production/connect-update.ts','utf8');
test('Função de distribuição pertence apenas ao Supabase de Produção',()=>{
 assert.match(source,/const projectUrl = "https:\/\/cpslafpzjtbpmoxxysaa\.supabase\.co"/);
 assert.match(source,/Deno\.env\.get\("SUPABASE_URL"\) !== projectUrl/);
 assert.doesNotMatch(source,/qnuluspqfazdppciermw|teste\.app\.neopep/);
});
test('Somente usuário autenticado com computador autorizado recebe manifesto',()=>{
 assert.match(source,/auth\.getUser/);
 assert.match(source,/neo_connect_update/);
 for(const k of ['Bearer ','Content-Length','4096','p_device:body.device','p_secret:body.secret','action:body.action'])assert.ok(source.includes(k),k);
});
test('Download usa bucket privado e URL assinada restrita ao próprio projeto',()=>{
 assert.match(source,/neo-connect-releases/);
 assert.match(source,/createSignedUrl\(path,90\)/);
 assert.match(source,/url\.origin !== projectUrl/);
 assert.match(source,/url\.pathname !== "\/storage\/v1\/object\/sign\/neo-connect-releases\/"/);
});
