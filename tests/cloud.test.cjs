// Testes de contrato com transporte simulado. NÃO validam provedores ou credenciais reais.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),C=require('../dist/core.js');
function adapter({hasSession=true,putRows=[{revision:2}],authError=null}={}){const calls=[],u={id:'00000000-0000-4000-8000-000000000001',email:'test@example.invalid'},chain={update(v){calls.push(['update',v]);return this},eq(){return this},select(){return Promise.resolve({data:putRows,error:null})}};const sdk={auth:{onAuthStateChange(f){calls.push(['listener',f])},getSession:async()=>({data:{session:hasSession?{user:u}:null},error:null}),getUser:async()=>({data:{user:u},error:null}),signInWithOAuth:async v=>(calls.push(['oauth',v]),{data:{},error:authError}),signInWithPassword:async v=>(calls.push(['password',v]),{data:{user:u},error:authError}),signUp:async v=>(calls.push(['signup',v]),{data:{user:u},error:authError}),resetPasswordForEmail:async(e,o)=>(calls.push(['reset',e,o]),{data:{},error:authError}),updateUser:async v=>({data:{user:u},error:null}),signOut:async v=>(calls.push(['signout',v]),{error:null})},from:()=>chain};const ctx={window:null,NeoCore:C,NEO_CONFIG:{supabaseUrl:'https://project-test.supabase.co',supabasePublishableKey:'sb_publishable_test_only',providers:{google:true,apple:true,email:true},publicRegistration:true},sessionStorage:{},location:{href:'https://app.test/neo/?code=example#perfil'},URL,setTimeout:fn=>fn(),createClient:(url,key,options)=>(calls.push(['create',url,key,options]),sdk)};ctx.window=ctx;vm.createContext(ctx);const src=fs.readFileSync('src/cloud.js','utf8').replace("import { createClient } from '@supabase/supabase-js';",'');vm.runInContext(src,ctx);return {api:ctx.NeoCloud,calls,ctx,sdk}}
test('contrato SDK: PKCE, armazenamento adaptável de sessão e redirects exatos',async()=>{const a=adapter();await a.api.init(()=>{});const options=a.calls.find(c=>c[0]==='create')[3];assert.equal(options.auth.flowType,'pkce');assert.equal(typeof options.auth.storage.getItem,'function');assert.equal(a.api.remember,true);await a.api.oauth('google');const r=a.calls.find(c=>c[0]==='oauth')[1];assert.equal(r.provider,'google');assert.equal(r.options.redirectTo,'https://app.test/neo/');await a.api.oauth('apple');assert.equal(a.calls.filter(c=>c[0]==='oauth')[1][1].options.scopes,'name email')});
test('contrato e-mail: cadastro, senha, recuperação e logout usam SDK oficial',async()=>{const a=adapter();await a.api.init(()=>{});await a.api.email('signup','test@example.invalid','long-password','Teste');await a.api.email('login','test@example.invalid','long-password');await a.api.email('reset','test@example.invalid');assert.equal(a.calls.find(c=>c[0]==='signup')[1].options.data.full_name,'Teste');assert.equal(a.calls.find(c=>c[0]==='reset')[2].redirectTo,'https://app.test/neo/');await a.api.logout();assert.equal(a.api.user,null);assert.equal(a.calls.find(c=>c[0]==='signout')[1].scope,'local')});
test('erro de autenticação não retorna sucesso e não cria usuário',async()=>{const a=adapter({hasSession:false,authError:{message:'Invalid credentials'}});assert.equal(await a.api.init(()=>{}),null);await assert.rejects(a.api.email('login','test@example.invalid','bad'),/Invalid credentials/);assert.equal(a.api.user,null)});
test('controle de concorrência: revisão desatualizada é rejeitada',async()=>{const a=adapter({putRows:[]});await a.api.init(()=>{});a.api.hasConsent=()=>true;await assert.rejects(a.api.put('weights',{id:'x',date:C.today(),value:80,_revision:1}),/outro aparelho/)});

test('limite de envio de e-mail tem mensagem clara e preserva o código do servidor',async()=>{for(const source of [{code:'over_email_send_rate_limit',status:429,message:'email rate limit exceeded'},{status:429,message:'email rate limit exceeded'}]){const a=adapter({hasSession:false,authError:source});await a.api.init(()=>{});await assert.rejects(a.api.email('signup','test@example.invalid','long-password','Teste'),err=>{assert.match(err.message,/limite de envio de e-mails/);assert.equal(err.status,429);assert.equal(err.code,source.code||null);return true});assert.equal(a.calls.filter(c=>c[0]==='signup').length,1);assert.equal(a.api.user,null)}});

test('acesso pela raiz preserva callbacks existentes; não permite retorno externo',async()=>{
 const a=adapter();a.ctx.location.href='https://app.test/?code=old#perfil';a.ctx.NEO_CONFIG.authRedirectPath='/neo/';await a.api.init(()=>{});
 await a.api.email('signup','test@example.invalid','long-password','Teste');await a.api.email('reset','test@example.invalid');await a.api.oauth('google');
 assert.equal(a.calls.find(c=>c[0]==='signup')[1].options.emailRedirectTo,'https://app.test/neo/');assert.equal(a.calls.find(c=>c[0]==='reset')[2].redirectTo,'https://app.test/neo/');assert.equal(a.calls.find(c=>c[0]==='oauth')[1].options.redirectTo,'https://app.test/neo/');
 a.ctx.NEO_CONFIG.authRedirectPath='https://other.test/';await assert.rejects(a.api.email('reset','test@example.invalid'),/neste site/);
});

test('anexos: download bloqueado não gera link; leitura consulta permissão e preserva compatibilidade antiga',async()=>{const a=adapter(),calls=[];a.sdk.rpc=async(name,args)=>{calls.push(['rpc',name,args]);return {data:{ok:true},error:null}};a.sdk.storage={from:()=>({createSignedUrl:async(path,seconds,options)=>{calls.push(['sign',path,seconds,options]);return {data:{signedUrl:'https://storage.test/file'},error:null}}})};await a.api.init(()=>{});const f={path:'A/file.pdf',name:'File.pdf',mime:'application/pdf',allow_download:false};await assert.rejects(a.api.libraryMediaURL(f,true),/não foi disponibilizado/);assert.equal(calls.length,0);await a.api.libraryMediaURL(f);assert.equal(calls[0][1],'neo_library');assert.equal(calls[0][2].p_action,'media_access');assert.equal(calls[1][2],1800);calls.length=0;await a.api.libraryMediaURL({...f,allow_download:undefined});assert.equal(calls[0][0],'sign');});

test('cadastro e troca aceitam 8 caracteres e recusam 7 antes do SDK',async()=>{const a=adapter();await a.api.init(()=>{});await a.api.email('signup','test@example.invalid','Abcd1234','Teste');assert.equal(a.calls.filter(c=>c[0]==='signup').length,1);await assert.rejects(a.api.email('signup','test@example.invalid','Abcd123','Teste'),/8 a 128/);await assert.rejects(a.api.email('newpassword',null,'Abcd123'),/8 a 128/);assert.equal(a.calls.filter(c=>c[0]==='signup').length,1);});

test('recuperação verifica código diretamente com tipo recovery, sem PKCE ou CAPTCHA adicional',async()=>{
 const a=adapter({hasSession:false}),u={id:'recover-user',email:'test@example.invalid'},session={user:u,access_token:'fake-test-token'};let request;
 await a.api.init(()=>{});a.ctx.NEO_CONFIG.captchaRequired=true;
 a.sdk.auth.verifyOtp=async value=>{request=value;a.calls.find(c=>c[0]==='listener')[1]('PASSWORD_RECOVERY',session);return {data:{session,user:u},error:null}};
 await assert.rejects(a.api.email('verifycode',u.email,null,null,{code:'bad'}),/código numérico/);assert.equal(request,undefined);
 const result=await a.api.email('verifycode',u.email,null,null,{code:'00001234'});
 assert.equal(request.token,'00001234');assert.equal(request.type,'recovery');assert.equal(request.email,u.email);assert.equal(result.session.user.id,u.id);assert.equal(a.api.user.id,u.id);
 assert.equal(a.calls.filter(c=>c[0]==='reset').length,0);
 a.sdk.auth.verifyOtp=async()=>({data:{session:null,user:null},error:{code:'otp_expired',message:'Token expired'}});
 await assert.rejects(a.api.email('verifycode',u.email,null,null,{code:'00001234'}),/Token expired/);
});

test('exclusão envia senha ao endpoint com token fixado na conta e só encerra sessão após confirmação',async()=>{
 const a=adapter();await a.api.init(()=>{});const user=a.api.user;a.sdk.auth.getSession=async()=>({data:{session:{user,access_token:'owner-session-token'}}});let request;
 a.sdk.functions={invoke:async(name,options)=>{request={name,...options};return {data:{deleted:true},error:null}}};
 await a.api.deleteAccount('test-password','captcha-proof',user.id);
 assert.equal(request.name,'delete-account');assert.equal(request.headers.Authorization,'Bearer owner-session-token');assert.equal(request.body.password,'test-password');assert.equal(request.body.captchaToken,'captcha-proof');assert.equal(request.body.confirmation,undefined);assert.equal(a.api.user,null);
});
test('senha ausente, troca de conta, rejeição do servidor e resposta sem confirmação nunca simulam exclusão',async()=>{
 const a=adapter();await a.api.init(()=>{});const user=a.api.user;a.sdk.auth.getSession=async()=>({data:{session:{user,access_token:'owner-session-token'}}});let calls=0;
 a.sdk.functions={invoke:async()=>{calls++;return {error:{context:{json:async()=>({error:'Senha incorreta.'})}}}}};
 await assert.rejects(a.api.deleteAccount('','captcha',user.id),/senha/);await assert.rejects(a.api.deleteAccount('test-password','captcha','other-user'),/conta mudou/);assert.equal(calls,0);
 await assert.rejects(a.api.deleteAccount('wrong','captcha',user.id),/Senha incorreta/);assert.equal(a.api.user.id,user.id);assert.equal(a.calls.filter(c=>c[0]==='signout').length,0);
 a.sdk.functions.invoke=async()=>({data:{deleted:false}});await assert.rejects(a.api.deleteAccount('test-password','captcha',user.id),/não foi confirmada/);assert.equal(a.api.user.id,user.id);
});

test('uma conta conectada durante a exclusão da anterior não tem sua sessão encerrada',async()=>{
 const a=adapter();await a.api.init(()=>{});const original=a.api.user;a.sdk.auth.getSession=async()=>({data:{session:{user:original,access_token:'original-token'}}});
 a.sdk.functions={invoke:async()=>{a.calls.find(c=>c[0]==='listener')[1]('SIGNED_IN',{user:{id:'new-user',email:'new@example.invalid'}});return {data:{deleted:true}}}};
 await a.api.deleteAccount('test-password','captcha',original.id);assert.equal(a.api.user.id,'new-user');assert.equal(a.calls.filter(c=>c[0]==='signout').length,0);
});

test('peso inicial do cadastro e enviado uma unica vez, com data local, na RPC transacional',async()=>{
 const a=adapter(),calls=[];
 await a.api.init(()=>{});
 a.sdk.rpc=async(name,payload)=>{calls.push({name,payload});return {data:null,error:null}};
 const profile={name:'Pessoa Teste',height:170,initialWeight:83.45,goal:76,consent:true};
 await a.api.onboard(profile,C.blank().settings,true,true);
 assert.equal(calls.length,1,'cadastro e peso devem ser uma unica operacao');
 assert.equal(calls[0].name,'neo_complete_onboarding');
 assert.equal(calls[0].payload.p_profile.initialWeight,83.45);
 assert.equal(calls[0].payload.p_profile.initialRecordDate,C.today());
 assert.equal(calls[0].payload.p_health,true);
 assert.equal(calls[0].payload.p_terms,true);
 assert.equal(profile.initialRecordDate,undefined,'o campo transitorio nao deve alterar o perfil do formulario');
});
