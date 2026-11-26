const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const js=fs.readFileSync('dist/admin/campaign-central.js','utf8');
const helper=js.slice(js.indexOf(' function canRepublish('),js.indexOf(' function mount('));
const canRepublish=vm.runInNewContext(helper+';canRepublish');
test('republicar exige envio anterior resolvido e conserva o histórico',()=>{
 const pub=(states,extra={})=>({batches:[{states}],...extra});
 assert.equal(canRepublish(pub(['accepted'])),true);
 assert.equal(canRepublish(pub(['accepted','cancelled'])),true);
 for(const states of [[],['waiting'],['accepted','waiting'],['accepted','uncertain'],['accepted','started'],['accepted','leased'],['accepted','failed']])assert.equal(canRepublish(pub(states)),false);
 assert.equal(canRepublish(pub(['accepted'],{deleted_at:'now'})),false);
 assert.equal(canRepublish(pub(['accepted'],{legacy_dispatch:true})),false);
});
test('republicar cria rascunho separado, sem agendar ou enviar',()=>{
 const action=js.slice(js.indexOf("    if(action==='republish_edit'"),js.indexOf("    if(action==='duplicate_form'"));
 assert.match(action,/getLocal\(key\)\|\|crypto\.randomUUID/);
 assert.match(action,/await rpc\('duplicate',\{publication_id:id,request_id:request,planned_local:''\}\)/);
 assert.match(action,/copy\.batches\?\.length/);
 assert.match(action,/await editor\(copy\.id,control,\{fresh:true\}\)/);
 assert.doesNotMatch(action,/rpc\('(publish|schedule|delete_publication)'/);
});
