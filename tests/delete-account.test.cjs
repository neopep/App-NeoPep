// Handler real com Auth/Storage simulados; nenhuma conta hospedada é excluída.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),esbuild=require('esbuild');
async function handler(options={}){
 const calls=[],files={'neo-private':['photo.jpg','avatar.jpg'],'neo-community':['shared.jpg'],'neo-community-files':['document.pdf'],'neo-support':['audio.webm'],'neo-comparisons':['private-before-after.jpg']};let fn;
 const admin={rpc:async name=>name==='neo_shop_deletion_check'?{data:options.invalidCheck?{}:{allowed:!options.openOrders},error:options.checkMissing?{code:'PGRST202'}:null}:{data:[],error:options.mediaMissing?{code:'PGRST202'}:null},auth:{getUser:async token=>(calls.push(['identity',token]),{data:{user:options.noUser||token!=='user-token'?null:{id:'authenticated-owner',email:options.noEmail?'':'owner@example.test',last_sign_in_at:new Date(Date.now()-3600000).toISOString()}},error:null}),admin:{deleteUser:async id=>(calls.push(['deleteUser',id]),{error:null})}},storage:{getBucket:async id=>(calls.push(['bucket-check',id]),options.comparisonsBucket?{data:{id},error:null}:{data:null,error:{statusCode:'404',message:'Bucket not found'}}),from:bucket=>({list:async prefix=>(calls.push(['list',prefix]),{data:files[bucket].map(name=>({name})),error:null}),remove:async paths=>{calls.push(['remove',paths]);if(options.storageFail)return {error:Error('storage')};files[bucket]=[];return {error:null}}})}};
 const verifier={auth:{signInWithPassword:async input=>{calls.push(['password-check',input.email,input.options.captchaToken]);return {data:{user:{id:options.otherUser?'other-account':'authenticated-owner'},session:options.noVerifiedSession?null:{access_token:'temporary-session'}},error:options.captchaError?{code:'captcha_failed'}:options.rateLimit?{status:429}:options.wrongPassword||input.password!=='test-password'?{code:'invalid_credentials'}:null}},signOut:async input=>(calls.push(['cleanup',input.scope]),{error:null})}};
 const source=fs.readFileSync('supabase/functions/delete-account/index.ts','utf8').replace("import {createClient} from 'npm:@supabase/supabase-js@2.80.0';",'');
 vm.runInNewContext((await esbuild.transform(source,{loader:'ts',format:'iife'})).code,{Deno:{env:{get:key=>({ALLOWED_ORIGIN:'https://app.test',ALLOWED_ORIGINS:options.multiple?'https://app.neopep.com.br, https://elo-minha-evolucao.supplemast3.chatgpt.site':'',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-test-secret',SUPABASE_ANON_KEY:options.noPublicKey?'':'public-test-key'})[key]},serve:f=>fn=f},createClient:(url,key)=>key==='server-test-secret'?admin:verifier,Response,Date,Error,JSON});
 return {calls,handle:fn,request:(body={password:'test-password',captchaToken:'captcha-test',user_id:'victim',email:'victim@example.test'},headers={})=>fn(new Request('https://edge.test',{method:'POST',headers:{Origin:'https://app.test',Authorization:'Bearer user-token','Content-Type':'application/json',...headers},body:JSON.stringify(body)}))};
}
const removed=h=>h.calls.some(c=>['remove','deleteUser'].includes(c[0]));
test('senha é validada para a identidade da sessão antes de remover arquivos ou conta',async()=>{
 const h=await handler(),r=await h.request();assert.equal(r.status,200);assert.deepEqual(await r.json(),{deleted:true});
 assert.deepEqual(h.calls.find(c=>c[0]==='password-check').slice(1),['owner@example.test','captcha-test']);assert.equal(h.calls.find(c=>c[0]==='deleteUser')[1],'authenticated-owner');assert.ok(!JSON.stringify(h.calls).includes('victim'));
 assert.equal(h.calls.filter(c=>c[0]==='remove').length,4);assert.ok(h.calls.findIndex(c=>c[0]==='password-check')<h.calls.findIndex(c=>c[0]==='remove'));assert.ok(h.calls.findIndex(c=>c[0]==='remove')<h.calls.findIndex(c=>c[0]==='deleteUser'));assert.equal(h.calls.at(-1)[1],'local');
});
test('sessão válida não basta: senha ausente, errada ou de outra conta impede exclusão',async()=>{
 for(const options of [{wrongPassword:true},{otherUser:true},{noVerifiedSession:true},{noEmail:true}]){const h=await handler(options),r=await h.request();assert.ok(r.status>=400);assert.ok(!removed(h));}
 const h=await handler();assert.equal((await h.request({confirmation:'EXCLUIR'})).status,400);assert.equal((await h.request({password:''})).status,400);assert.ok(!h.calls.some(c=>c[0]==='password-check'));assert.ok(!removed(h));
});
test('CAPTCHA, limite de tentativas e configuração incompleta bloqueiam sem apagar dados',async()=>{
 for(const [options,status] of [[{captchaError:true},400],[{rateLimit:true},429],[{noPublicKey:true},503]]){const h=await handler(options);assert.equal((await h.request()).status,status);assert.ok(!removed(h));}
});
test('sessão inválida e origem incorreta são recusadas antes da senha',async()=>{
 const h=await handler({noUser:true});assert.equal((await h.request()).status,401);assert.ok(!h.calls.some(c=>c[0]==='password-check'));
 for(const headers of [{Authorization:''},{Authorization:'Bearer bad'},{Origin:'https://other.test'}]){const x=await handler();assert.ok((await x.request({},headers)).status>=400);assert.ok(!removed(x));}
});
test('origens atual e anterior são aceitas, preflight não executa operações e origem externa não recebe CORS',async()=>{
 const h=await handler({multiple:true});for(const origin of ['https://app.neopep.com.br','https://elo-minha-evolucao.supplemast3.chatgpt.site']){const r=await h.handle(new Request('https://edge.test',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);}assert.equal(h.calls.length,0);
 const r=await h.request({}, {Origin:'https://unauthorized.example'});assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);assert.equal(h.calls.length,0);
 assert.equal((await h.handle(new Request('https://edge.test',{method:'GET',headers:{Origin:'https://app.neopep.com.br'}}))).status,405);
});
test('pedidos abertos, verificações ausentes e falha no armazenamento não confirmam exclusão',async()=>{
 for(const [options,status] of [[{openOrders:true},409],[{checkMissing:true},503],[{invalidCheck:true},503],[{mediaMissing:true},503],[{storageFail:true},500]]){const h=await handler(options),r=await h.request();assert.equal(r.status,status);assert.ok(!h.calls.some(c=>c[0]==='deleteUser'));if(!options.storageFail)assert.ok(!removed(h));assert.ok(h.calls.some(c=>c[0]==='cleanup'));}
});
test('corpo da solicitação tem limite antes de validar a senha',async()=>{const h=await handler();assert.equal((await h.request({password:'test-password',extra:'x'.repeat(9000)})).status,413);assert.ok(!h.calls.some(c=>c[0]==='password-check'));assert.ok(!removed(h));});

test('exclusão remove comparações privadas se o bucket já foi instalado',async()=>{
 const h=await handler({comparisonsBucket:true});
 const response=await h.request();
 assert.equal(response.status,200);
 assert.ok(h.calls.some(([event,paths])=>event==='remove'&&Array.isArray(paths)&&paths.some(path=>path.startsWith('authenticated-owner/private-before-after'))));
 assert.ok(h.calls.findIndex(([event])=>event==='remove')<h.calls.findIndex(([event])=>event==='deleteUser'));
 assert.equal(h.calls.filter(([event])=>event==='remove').length,5);
});
