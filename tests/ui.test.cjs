const {test}=require('node:test'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom'),fs=require('fs'),vm=require('vm'),C=require('../dist/core.js');
function setup(seed={},options={}){const {document,Event}=parseHTML(fs.readFileSync('dist/index.html','utf8'));const data=new Map(Object.entries(seed)),writes=[];let counter=0;const ctx={document,console,Event,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(options.quota)throw Error('quota');data.set(k,v);writes.push(k)},removeItem:k=>data.delete(k)},location:{hash:'',href:options.url||'https://example.test/',protocol:'https:'},history:{replaceState(a,b,hash){ctx.location.hash=hash}},navigator:{onLine:true},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval(){},setTimeout(){},clearTimeout(){},addEventListener(){},scrollTo(){},confirm:()=>true,prompt:()=>null,URL,Blob,Date:options.date||Date,Number,String,JSON,FormData:class{},crypto:{randomUUID:()=>String(++counter)},NeoCore:C,NeoCloud:{configured:false,init:async()=>null,...options.cloud},NEO_CONFIG:{providers:{google:false,apple:false,email:false}},indexedDB:null};ctx.window=ctx;document.querySelector('#dialog').showModal=function(){this.setAttribute('open','')};document.querySelector('#dialog').close=function(){this.removeAttribute('open');this.dispatchEvent(new Event('close'))};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),ctx);return {ctx,document,data,writes,run:code=>vm.runInContext(code,ctx)}}
test('todos os módulos renderizam em DOM e branding não contém Elo fora da migração',async()=>{const a=setup();for(const route of ['inicio','evolucao','registros','diario','aplicacoes','protocolos','calculadora','relatorios','calendario','lembretes','perfil','bemvindo','privacidade','fotos','onboarding','termos']){await a.run(`go('${route}',false)`);assert.ok(a.document.querySelector('#content').textContent.length>50,route)}assert.match(a.document.title,/NeoPep/);assert.equal(a.document.querySelectorAll('#nav button').length,5);assert.equal(a.writes.length,0)});
test('prévia não migra nem grava elo-v1 automaticamente',()=>{const original=JSON.stringify({weights:[{id:1,date:C.today(),value:81}],measures:[],doses:[],settings:{}});const a=setup({'elo-v1':original});assert.equal(a.data.get('elo-v1'),original);assert.equal(a.writes.length,0);assert.equal(a.run('state.weights.length'),0)});
test('CRUD local persiste e volta após nova abertura sem sobrescrever Elo',async()=>{const original='original',a=setup({'elo-v1':original});await a.run(`putRecord('weights',{id:'x',date:C.today(),value:80,note:''})`);assert.equal(a.writes.at(-1),'neo-v2');assert.equal(a.data.get('elo-v1'),original);assert.equal(a.run('state.weights.length'),1);const b=setup(Object.fromEntries(a.data));assert.equal(b.run('state.weights[0].value'),80);await a.run(`putRecord('weights',{id:'y',date:C.today(),value:79,note:''})`);assert.equal(a.run('state.weights.length'),1);assert.equal(a.run('state.weights[0].id'),'x');assert.equal(a.run('state.weights[0].value'),79)});
test('falha de quota não confirma gravação nem modifica estado em memória',async()=>{const a=setup({}, {quota:true});await assert.rejects(a.run(`putRecord('weights',{id:'x',date:C.today(),value:80,note:''})`),/salvar/);assert.equal(a.run('state.weights.length'),0);assert.equal(a.data.has('neo-v2'),false)});
test('demonstração não escreve dados reais e retorna ao estado local',async()=>{const s=C.blank();s.profile.name='Real';s.weights=[{id:'real',date:C.today(),value:77}];const a=setup({'neo-v2':JSON.stringify(s)}),before=a.data.get('neo-v2');await a.run('enterDemo()');assert.equal(a.run('state.profile.name'),'Alex');await a.run(`putRecord('weights',{id:'demo',date:C.today(),value:60})`);assert.equal(a.data.get('neo-v2'),before);await a.run('switchLocal()');assert.equal(a.run('state.profile.name'),'Real');assert.equal(a.run('state.weights[0].value'),77)});
test('armazenamento corrompido permanece intacto e bloqueia gravação',async()=>{const a=setup({'neo-v2':'{broken'});assert.match(a.document.querySelector('#banner').textContent,/preservado/);await assert.rejects(a.run(`putRecord('weights',{id:'x',date:C.today(),value:80})`),/recupere/);assert.equal(a.data.get('neo-v2'),'{broken')});
test('login não configurado é explicitamente indisponível',()=>{const a=setup();assert.equal(a.document.querySelectorAll('[data-oauth][disabled]').length,2);assert.ok(a.document.querySelector('#authForm button.primary[disabled]'))});
test('valores de backup maliciosos não são executados como HTML',async()=>{const s=C.blank();s.profile.name='<img src=x onerror=alert(1)>';const a=setup({'neo-v2':JSON.stringify(s)});await a.run("go('inicio',false)");assert.equal(a.document.querySelector('#content img[onerror]'),null);assert.match(a.document.querySelector('h1').textContent,/<img/)});

test('login, cadastro e recuperação ficam sem cabeçalho, navegação e rodapé',async()=>{const a=setup();for(const auth of ['login','signup','reset','verifycode','newpassword']){await a.run(`authMode='${auth}';go('bemvindo',false)`);assert.equal(a.document.querySelector('.app-header').hidden,true);assert.equal(a.document.querySelector('#nav').hidden,true);assert.equal(a.document.querySelector('#app > footer').hidden,true);assert.equal(a.document.body.classList.contains('auth-screen'),true);assert.ok(a.document.querySelector('.auth-brand'))}});
test('espaço da conta e modos locais restauram a navegação; saída retorna ao login',async()=>{const a=setup();await a.run('switchLocal()');assert.equal(a.document.querySelector('#nav').hidden,false);await a.run('enterDemo()');assert.equal(a.document.querySelector('.app-header').hidden,false);await a.run('switchLocal(false)');assert.equal(a.document.querySelector('#nav').hidden,true);assert.equal(a.run('page'),'bemvindo');a.ctx.NeoCloud.user={id:'test'};a.ctx.NeoCloud.onboardingComplete=true;await a.run("mode='cloud';go('inicio',false)");assert.equal(a.document.querySelector('#nav').hidden,false);await a.run("authChanged('SIGNED_OUT',null)");assert.equal(a.document.querySelector('#nav').hidden,true);assert.equal(a.run('page'),'bemvindo')});

test('privacidade e termos acessados antes de entrar não exibem navegação pessoal',async()=>{const a=setup();for(const route of ['privacidade','termos']){await a.run(`go('${route}',false)`);assert.equal(a.document.querySelector('#nav').hidden,true);assert.equal(a.document.querySelector('.app-header').hidden,true)}await a.run('switchLocal()');await a.run("go('privacidade',false)");assert.equal(a.document.querySelector('#nav').hidden,false)});

test('histórico pagina no celular, mantém todas as linhas para impressão e filtra sem apagar',async()=>{const s=C.blank();s.profile.consent=true;for(let i=0;i<25;i++){const d=new Date();d.setDate(d.getDate()-i);s.weights.push({id:'w'+i,date:C.today(d),value:80-i*.1,note:i===1?'Alvo único':''})}const a=setup({'neo-v2':JSON.stringify(s)});await a.run("go('registros',false)");let block=a.document.querySelector('[data-history=weights]');assert.equal(block.querySelectorAll('.history-mobile .history-record').length,12);assert.equal(block.querySelectorAll('tbody tr').length,25);assert.equal(block.querySelectorAll('tr.print-only').length,13);await a.run("historyPrefs.weights={query:'alvo',page:0};render()");block=a.document.querySelector('[data-history=weights]');assert.equal(block.querySelectorAll('.history-mobile .history-record').length,1);assert.equal(a.run('state.weights.length'),25);assert.equal(JSON.parse(a.data.get('neo-v2')).weights.length,25)});
test('gráfico de medida sem dados oferece registro de medidas e não inventa zero',async()=>{const a=setup();await a.run("selectedMeasure='arm';go('evolucao',false)");const select=a.document.querySelector('#measureSeries');assert.ok(select);assert.equal(select.querySelectorAll('option').length,5);assert.ok(a.document.querySelector('[data-add=measure]'));assert.match(a.document.querySelector('#content').textContent,/Uma medida de cada vez/)});
test('protocolo mostra apenas suas aplicações ao abrir o filtro e lembretes podem ser pausados',async()=>{const s=C.blank();s.profile.consent=true;s.protocols=[{id:'p1',date:C.today(),name:'Protocolo A',status:'active',note:''},{id:'p2',date:C.today(),name:'Protocolo B',status:'closed',note:''}];s.doses=[{id:'d1',date:C.today(),product:'Produto A',amount:1,unit:'mg',protocolId:'p1',note:'',site:''},{id:'d2',date:C.today(),product:'Produto B',amount:2,unit:'mg',protocolId:'p2',note:'',site:''}];s.reminders=[{id:'r1',date:C.today(),title:'Meu lembrete',time:'09:00',repeat:'daily',enabled:true}];const a=setup({'neo-v2':JSON.stringify(s)});await a.run("selectedProtocol='p1';go('aplicacoes',false)");const block=a.document.querySelector('[data-history=doses]');assert.equal(block.querySelectorAll('.history-mobile .history-record').length,1);assert.ok(block.textContent.includes('Produto A'));assert.ok(!block.textContent.includes('Produto B'));await a.run("toggleReminder('r1')");assert.equal(a.run('state.reminders[0].enabled'),false);assert.equal(JSON.parse(a.data.get('neo-v2')).reminders[0].enabled,false);assert.equal(a.run('state.doses.length'),2)});
test('falha após gravação remota não anuncia perda e tentativa mantém o mesmo ID do formulário',async()=>{const a=setup();let fail=true,ids=[];a.ctx.FormData=class{constructor(){this.data=new Map(Object.entries({date:C.today(),waist:'88',note:''}))}[Symbol.iterator](){return this.data[Symbol.iterator]()}get(k){return this.data.get(k)}has(k){return this.data.has(k)}};Object.assign(a.ctx.NeoCloud,{user:{id:'user'},onboardingComplete:true,put:async(type,row)=>{ids.push(row.id);if(fail)throw Error('Falha de conexão');return {...row,_revision:1}},load:async()=>{throw Error('Leitura indisponível')},reportError(){}});await a.run("mode='cloud';state.profile.consent=true;openRecord('measure')");const form=a.document.querySelector('#recordForm');form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(a.run('state.measures.length'),0);assert.match(a.document.querySelector('#formError').textContent,/Falha de conexão/);fail=false;form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);assert.equal(a.run('state.measures.length'),1);assert.equal(a.run('state.measures[0]._revision'),1);assert.match(a.document.querySelector('#banner').textContent,/alteração foi salva/)});
test('novo diário vazio é recusado sem impedir leitura de backups antigos',async()=>{const a=setup();await assert.rejects(a.run("putRecord('journal',{id:'j1',date:C.today()})"),/ao menos um campo/);assert.equal(a.run('state.journal.length'),0);const old=C.validateBackup({...C.blank(),journal:[{id:'old',date:C.today()}]});assert.equal(old.journal.length,1)});
test('calendário mantém a data selecionada no período navegado',async()=>{const a=setup();await a.run("go('calendario',false);calendarDate=new Date(2026,10,1);calendarView='month';render()");a.document.querySelector('#nextMonth').dispatchEvent(new a.ctx.Event('click',{bubbles:true}));assert.equal(a.run('selectedDate'),'2026-12-01');assert.equal(a.run('calendarDate.getMonth()'),11)});
test('histórico de perfil fica separado da comparação e abre o visualizador',()=>{const a=setup();a.run("photoList=[{id:'body',date:C.today(),role:'progress',url:'data:image/png;base64,a'},{id:'avatar',date:C.today(),role:'avatar',url:'data:image/png;base64,b'}];document.querySelector('#content').innerHTML=photosPage()");assert.equal(a.document.querySelectorAll('.photo-card').length,2);assert.ok(a.document.querySelector('[data-photo-section=avatar] [data-photo-open=avatar]'));assert.equal(a.document.querySelector('.photo-card [data-photo-export]'),null);assert.equal(a.document.querySelectorAll('#comparisonPhotos [data-photo-side]').length,1);assert.equal(a.document.querySelectorAll('#comparisonPhotos .comparison-example').length,1)});
test('evento repetido da mesma sessão não apaga perfil em edição nem filtros',async()=>{const a=setup();a.ctx.NeoCloud.user={id:'same'};a.ctx.NeoCloud.hasConsent=()=>true;a.ctx.NeoCloud.onboardingComplete=true;await a.run("mode='cloud';signedInAccountId='same';historyPrefs.weights={query:'Minha busca'};state.profile.name='Rafael';document.querySelector('#content').innerHTML=profilePage();formDirty=true");const field=a.document.querySelector('input[name=name]');field.value='Nome em edição';await a.run("authChanged('SIGNED_IN',{id:'same'})");assert.equal(a.document.querySelector('input[name=name]'),field);assert.equal(field.value,'Nome em edição');assert.equal(a.run('historyPrefs.weights.query'),'Minha busca');assert.equal(a.run('formDirty'),true)});
test('falha ao atualizar galeria não apaga da tela o histórico já carregado',async()=>{const a=setup();a.ctx.NeoCloud.photos=async()=>{throw Error('Sem conexão')};await a.run("mode='cloud';photoList=[{id:'photo1',date:C.today(),role:'progress',url:'https://example.invalid/photo.jpg'}]");await assert.rejects(a.run('loadPhotos()'),/Sem conexão/);assert.equal(a.run('photoList.length'),1);assert.equal(a.run('photoList[0].id'),'photo1')});
test('navegação destaca comunidade ao centro, calendário no topo e atendimento abre Conversa',async()=>{const a=setup();let direct;a.ctx.NeoCommunity={beginVisit:value=>direct=value,view:()=>'<p>Comunidade</p>',load:()=>{}};await a.run("go('inicio',false)");assert.deepEqual(Array.from(a.document.querySelectorAll('#nav button')).map(b=>b.dataset.go),['inicio','evolucao','comunidade','registros','loja']);assert.ok(a.document.querySelector('#nav .nav-community'));assert.equal(a.document.querySelector('#nav [data-go=calendario]'),null);assert.ok(a.document.querySelector('#calendarShortcut[data-go=calendario]'));a.document.querySelector('#communityIcon').click();await new Promise(setImmediate);assert.equal(direct,true)});
test('início sem convite da comunidade, com adicionar redondo e atalho Dose',async()=>{const a=setup();a.ctx.NeoCommunityAlerts={home:()=>'<div class="old-community-promo">Convite</div>',refresh:()=>{}};await a.run("go('inicio',false)");assert.equal(a.document.querySelector('.old-community-promo'),null);assert.ok(a.document.querySelector('.home-quick-add[data-add=weight]'));assert.ok(a.document.querySelector('.home-dose-shortcut[data-go=calculadora]'));a.document.querySelector('.home-dose-shortcut').click();await new Promise(setImmediate);assert.ok(a.document.querySelector('#calcForm'))});
test('calculadora sincroniza seleção rápida, controles deslizantes e valores exatos',async()=>{
 const a=setup();await a.run("go('calculadora',false)");
 const doc=a.document,node=selector=>doc.querySelector(selector);
 const set=(selector,value,event='input')=>{
  const field=node(selector);
  if(field.tagName==='SELECT'){
   for(const option of field.options)option.toggleAttribute('selected',option.value===value);
  }else field.value=value;
  field.dispatchEvent(new a.ctx.Event(event,{bubbles:true}));
 };
 assert.equal(doc.querySelectorAll('.calc-capacity-choice').length,3);
 assert.equal(node('[data-calc-capacity="1"] input').hasAttribute('checked'),true);
 assert.equal(node('.syringe-reading'),null);
 assert.equal(node('#dose').value,'');
 assert.equal(node('#calcForm button[type=submit]'),null);
 assert.equal(node('#calc-range-mass').getAttribute('step'),'0.5');
 assert.equal(node('#calc-range-dose').getAttribute('step'),'0.1');
 assert.ok(node('[data-calc-chip=mass][data-value="15"]'));
 assert.deepEqual([...doc.querySelectorAll('[data-calc-chip=dose]')].map(button=>button.dataset.value),['0.5','1','1.5','2','2.5','3','7.5','10']);
 node('[data-calc-chip=mass][data-value="10"]').click();
 assert.equal(node('#mass').value,'10');
 assert.equal(node('#calc-range-mass').value,'10');
 assert.equal(node('[data-calc-chip=mass][data-value="10"]').getAttribute('aria-pressed'),'true');
 set('#calc-range-volume','2');
 assert.equal(node('#volume').value,'2');
 node('[data-calc-chip=dose][data-value="2.5"]').click();
 assert.match(node('.syringe-reading').textContent,/50 na escala U-100/);
 assert.match(node('#result .big').textContent,/0,5/);
 set('#doseUnit','mcg','change');
 assert.equal(node('#dose').value,'2500');
 assert.match(node('.syringe-reading').textContent,/50 na escala U-100/);
 set('#dose','2500.125');
 assert.equal(node('#dose').value,'2500.125');
 assert.match(node('#calc-range-dose').getAttribute('aria-valuetext'),/2.500,125 mcg/);
 const max=Number(node('#calc-range-dose').max);
 set('#calc-range-dose','1000');
 assert.equal(Number(node('#calc-range-dose').max),max);
 assert.equal(node('#dose').value,'1000');
 set('#dose','2500');
 set('[data-calc-capacity="0.3"] input','0.3','change');
 assert.equal(Number(node('#calc-range-dose').max),1500);
 assert.equal(node('#dose').value,'2500');
 assert.match(node('#calc-dose-limit').textContent,/1.500 mcg/);
 assert.match(node('[data-calc-bubble=dose]').textContent,/2.500 mcg/);
 assert.ok(node('.scale-overflow'));
 assert.match(node('#result .error').textContent,/capacidade/);
 assert.ok(node('[data-graduation="30"]'));
 set('#calc-range-dose','1500');
 assert.equal(node('#dose').value,'1500');
 assert.match(node('.syringe-reading').textContent,/30 na escala/);
 set('[data-calc-capacity="0.5"] input','0.5','change');
 assert.ok(node('[data-graduation="49"]'));
 set('#dose','1575');
 assert.match(node('.syringe-reading').textContent,/entre marcas/);
 const tick=node('[data-graduation="31"]').getAttribute('d').match(/^M([^ ]+)/)[1];
 assert.equal(node('.calc-syringe .calc-liquid').getAttribute('x'),tick);
 set('[data-calc-capacity="1"] input','1','change');
 assert.equal(node('[data-graduation="31"]'),null);
 assert.ok(node('[data-graduation="100"]'));
 set('#calc-range-mass','0');
 assert.equal(node('#mass').value,'');
 assert.match(node('#result').textContent,/Preencha/);
 set('#mass','0');
 assert.match(node('#result').textContent,/valores positivos/);
 set('#mass','');
 assert.match(node('#result').textContent,/Preencha/);
 set('#mass','0.025');
 set('#doseUnit','mg','change');
 assert.equal(node('#calc-range-dose').hasAttribute('disabled'),true);
 set('#calcDoseStep','0.001','change');
 assert.equal(Number(node('#calc-range-dose').max),0.012);
 assert.equal(node('#calc-range-dose').hasAttribute('disabled'),false);
 assert.match(node('#calc-dose-limit').textContent,/0,0125 mg/);
 const css=require('node:fs').readFileSync('dist/style.css','utf8');
 assert.match(css,/\.calc-layout,\.calc-inputs,\.calc-formula ol\{grid-template-columns:minmax\(0,1fr\)\}/);
});
function authFormData(a){a.ctx.FormData=class extends Map{constructor(form){super();for(const field of form.querySelectorAll('[name]'))if(field.type!=='checkbox'||field.checked||field.hasAttribute('checked'))this.set(field.getAttribute('name'),field.type==='checkbox'?'on':field.value)}}}
test('cadastro usa um aceite desmarcado, volta ao login e preserva só o e-mail, com manter conectado padrão',async()=>{const calls=[],a=setup({}, {cloud:{configured:true,email:async(...args)=>(calls.push(args),{session:null,user:{id:'new'}})}});a.ctx.NEO_CONFIG.providers.email=true;a.ctx.NEO_CONFIG.previewRegistration=true;authFormData(a);await a.run("authMode='signup';go('bemvindo',false)");let form=a.document.querySelector('#authForm');assert.equal(a.document.querySelectorAll('input[name=consent]').length,1);assert.equal(form.querySelector('[name=consent]').hasAttribute('checked'),false);assert.equal(a.document.querySelector('#oauthConsent'),null);assert.ok(form.querySelector('[name=remember]').hasAttribute('checked'));form.querySelector('[name=name]').value='Pessoa Nova';form.querySelector('[name=email]').value='new@example.test';form.querySelector('[name=password]').value='password-not-persisted';form.querySelector('[name=consent]').setAttribute('checked','');form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(a.run('authMode'),'login');assert.equal(a.document.querySelector('[name=email]').value,'new@example.test');assert.equal(a.document.querySelector('[name=password]').value,'');assert.match(a.document.querySelector('#authMessage').textContent,/confirmar seu e-mail/);assert.equal(a.document.querySelector('[name=consent]'),null);assert.equal(calls[0][4].remember,true);assert.equal(a.document.querySelectorAll('a[href="#privacidade"]').length,1);assert.ok(!JSON.stringify([...a.data]).includes('password-not-persisted'))});
test('login envia a escolha desmarcada e falha de cadastro mantém formulário sem anunciar confirmação',async()=>{const calls=[],a=setup({}, {cloud:{configured:true,email:async(...args)=>{calls.push(args);throw Error('Falha de teste')}}});a.ctx.NEO_CONFIG.providers.email=true;a.ctx.NEO_CONFIG.previewRegistration=true;authFormData(a);await a.run("go('bemvindo',false)");let form=a.document.querySelector('#authForm');form.querySelector('[name=email]').value='person@example.test';form.querySelector('[name=password]').value='password123456';form.querySelector('[name=remember]').removeAttribute('checked');form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(calls[0][4].remember,false);assert.match(a.document.querySelector('#authError').textContent,/Falha de teste/);await a.run("authMode='signup';render()");form=a.document.querySelector('#authForm');form.querySelector('[name=email]').value='person@example.test';form.querySelector('[name=password]').value='password123456';form.querySelector('[name=consent]').setAttribute('checked','');form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(a.run('authMode'),'signup');assert.equal(a.document.querySelector('#authMessage'),null);assert.match(a.document.querySelector('#authError').textContent,/Falha de teste/)});
test('sessão restaurada abre painel automaticamente e conta confirmada nova vai ao cadastro inicial',async()=>{for(const complete of [true,false]){const user={id:'restored'},state=C.blank();state.profile.name='Ana';const a=setup({}, {cloud:{configured:true,user,onboardingComplete:complete,init:async()=>user,load:async()=>state,heartbeat:async()=>{}}});await new Promise(setImmediate);assert.equal(a.run('mode'),'cloud');assert.equal(a.run('page'),complete?'inicio':'preparar');assert.equal(a.document.querySelector('#authForm'),null);if(complete)assert.match(a.document.querySelector('#content').textContent,/Ana/);else {assert.ok(a.document.querySelector('[data-start-profile]'));a.document.querySelector('[data-start-profile]').click();assert.equal(a.document.querySelector('#onboardingForm [name=name]').value,'Ana')}}});
test('link aberto sem sessão orienta entrar, sem declarar e-mail confirmado nem mostrar erro técnico',async()=>{const a=setup({}, {url:'https://example.test/?code=test-callback',cloud:{configured:true,init:async()=>null}});await new Promise(setImmediate);assert.equal(a.run('page'),'bemvindo');assert.match(a.document.querySelector('#authMessage').textContent,/Se já confirmou seu e-mail, entre/);assert.ok(!a.document.querySelector('#authMessage').textContent.includes('test-callback'));assert.equal(a.run('mode'),'local')});
test('cadastro com sessão real retornada pelo SDK segue direto ao cadastro inicial',async()=>{const state=C.blank(),user={id:'created'};state.profile.name='Nova Pessoa';const a=setup({}, {cloud:{configured:true,onboardingComplete:false,load:async()=>state}});a.ctx.NeoCloud.email=async()=>{a.ctx.NeoCloud.user=user;return {session:{user},user}};a.ctx.NEO_CONFIG.providers.email=true;a.ctx.NEO_CONFIG.previewRegistration=true;authFormData(a);await a.run("authMode='signup';go('bemvindo',false)");const form=a.document.querySelector('#authForm');form.querySelector('[name=email]').value='new@example.test';form.querySelector('[name=password]').value='test-password123';form.querySelector('[name=consent]').setAttribute('checked','');form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(a.run('page'),'preparar');assert.equal(a.document.querySelector('#authForm'),null);a.document.querySelector('[data-start-profile]').click();assert.equal(a.run('page'),'onboarding');assert.match(a.document.querySelector('#onboardingForm').textContent,/Nome completo/)});

test('login omite avisos de preparação e chamada antiga, preservando feedback de autenticação',async()=>{const a=setup({}, {cloud:{configured:true}});await new Promise(setImmediate);a.run("window.NEO_CONFIG.previewRegistration=true; window.NEO_CONFIG.cloudValidated=false; authMessage='Confira seu e-mail para confirmar o cadastro.'; go('bemvindo',false)");const content=a.document.querySelector('#content');assert.doesNotMatch(content.textContent,/prévia privada|Supabase vinculado|Cadastros públicos aguardam|conheça seu novo espaço/i);assert.match(content.querySelector('#authMessage').textContent,/Confira seu e-mail/);assert.ok(content.querySelector('#authError[role=alert]'));assert.equal(content.querySelector('#localMode'),null);assert.equal(content.querySelector('#demo'),null)});

test('preferência de fotos controla atalho sem consentir em nome do usuário',()=>{const a=setup();assert.match(a.run('dailyTasks(false)'),/Suas fotos de evolução/);a.run('state.profile.tracking.photos=false');assert.doesNotMatch(a.run('dailyTasks(false)'),/Suas fotos de evolução/);const {document}=parseHTML(a.run('onboarding()'));for(const name of ['health','terms']){const input=document.querySelector(`input[name=${name}]`);assert.ok(input.required||input.hasAttribute('required'));assert.equal(input.hasAttribute('checked'),false)}assert.match(a.run('profilePage()'),/Privacidade e autorizações/)});

test('atalho administrativo fica ao lado do calendário e acompanha a autorização da sessão',async()=>{const a=setup({}, {cloud:{configured:true,user:{id:'A'},admin:true,hasConsent:()=>true}});await new Promise(setImmediate);a.run("mode='cloud';page='inicio';render()");const link=a.document.querySelector('#adminShortcut');assert.equal(link.hidden,false);assert.equal(link.getAttribute('href'),'admin/');assert.equal(link.nextElementSibling.id,'calendarShortcut');assert.doesNotMatch(a.run('profilePage()'),/id="migrateLocal"|href="admin\/"/);a.ctx.NeoCloud.admin=false;a.run('render()');assert.equal(link.hidden,true);a.ctx.NeoCloud.admin=true;a.run("page='bemvindo';render()");assert.equal(link.hidden,true);a.run("page='inicio';demo=true;render()");assert.equal(link.hidden,true)});

test('entrada da biblioteca no início navega diretamente para a aba e material escolhidos',async()=>{const a=setup(),visits=[];a.ctx.NeoLibrary={session(){},home:()=>'<button data-go="comunidade" data-community-section="library" data-material="one">Ler material</button>'};a.ctx.NeoCommunity={beginVisit:(...args)=>visits.push(args),view:()=>'<h1>Comunidade</h1>',load(){}};await a.run('enterDemo()');a.document.querySelector('[data-community-section=library]').click();assert.equal(a.run('page'),'comunidade');assert.deepEqual(visits[0],[false,'library','one']);});

test('telas internas de registros oferecem retorno visível e fallback para registros',async()=>{const a=setup();await a.run('enterDemo()');for(const route of ['diario','aplicacoes','protocolos','fotos','calculadora','relatorios','lembretes']){await a.run(`go('${route}',false)`);assert.ok(a.document.querySelector('[data-back]'),route)}await a.run("go('lembretes',false)");a.document.querySelector('[data-back]').click();assert.equal(a.run('page'),'registros');});

test('link de publicação pede login e abre a Biblioteca no material depois da sessão',async()=>{const id='10000000-0000-4000-8000-000000000001',state=C.blank();state.profile.name='Pessoa';const a=setup({}, {url:'https://example.test/neo/?material='+id+'#comunidade',cloud:{configured:true,onboardingComplete:true,load:async()=>state}});await new Promise(setImmediate);assert.equal(a.run('page'),'bemvindo');a.ctx.history.replaceState=(state,title,value)=>{const url=new URL(value,a.ctx.location.href);a.ctx.location.href=url.href;a.ctx.location.hash=url.hash;a.ctx.history.state=state;};const visits=[];a.ctx.NeoCommunity={beginVisit:(...args)=>visits.push(args),view:()=>'<section data-community-root>Biblioteca</section>',load(){}};a.ctx.NeoCloud.user={id:'signed-in'};await a.run("authChanged('SIGNED_IN',NeoCloud.user)");assert.equal(a.run('page'),'comunidade');assert.deepEqual(visits.at(-1),[false,'library',id]);assert.equal(a.run('pendingLibraryMaterial()'),'');});

test('salvar perfil inicial leva ao início e arma o guia sem pedir novo login',async()=>{const user={id:'new-account'},state=C.blank(),calls=[];state.profile.name='Nome Completo';const a=setup({}, {cloud:{configured:true,user,onboardingComplete:false,init:async()=>user,load:async()=>state,onboard:async(p,settings,health,terms)=>{calls.push({p,health,terms});a.ctx.NeoCloud.onboardingComplete=true;},heartbeat:async()=>{}}});await new Promise(setImmediate);const tour=[];a.ctx.NeoArrival={arm:(...args)=>tour.push(args),sync(){}};a.document.querySelector('[data-start-profile]').click();const form=a.document.querySelector('#onboardingForm');form.reportValidity=()=>true;a.ctx.FormData=class extends Map{constructor(){super(Object.entries({name:'Nome Completo',height:'170',initialWeight:'80',goal:'70',health:'on',terms:'on',track_weight:'on',track_measures:'on',track_journal:'on',track_photos:'on',track_applications:'on'}))}};form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(calls.length,1);assert.equal(calls[0].p.name,'Nome Completo');assert.equal(calls[0].health,true);assert.equal(calls[0].terms,true);assert.equal(a.run('page'),'inicio');assert.deepEqual(tour.at(-1),['new-account',true]);assert.equal(a.document.querySelector('#authForm'),null);});

test('jornada aparece logo após saudação, contém peso e dose e não duplica card',()=>{const a=setup();a.ctx.NeoLibrary={home:()=>'<section data-test-library>Biblioteca</section>'};a.ctx.NeoShop={home:()=>'<section data-test-shop>Loja</section>'};const {document}=parseHTML(a.run('overview()'));assert.equal(document.querySelectorAll('.home-journey').length,1);assert.ok(document.querySelector('.home-journey .home-quick-add'));assert.ok(document.querySelector('.home-journey .home-dose-shortcut'));const text=document.body?.textContent||document.documentElement.textContent;const html=a.run('overview()');assert.ok(html.indexOf('home-journey')<html.indexOf('data-test-library'));assert.ok(html.indexOf('data-test-library')<html.indexOf('data-test-shop'));});

test('barra da jornada mostra peso atual na posição do progresso sem inventar peso sem registros',()=>{const a=setup();a.run("state.profile.initialWeight=100;state.profile.goal=80;state.weights=[{id:'peso',date:NeoCore.today(),value:90}]");let html=a.run('overview()');assert.match(html,/--journey-progress:50%/);assert.match(html,/Peso atual: 90/);a.run('state.weights=[]');html=a.run('overview()');assert.ok(!html.includes('journey-current-weight'));});

test('jornada identifica ganho no cadastro e mostra desvio vermelho sem trocar início',()=>{
 const a=setup();
 assert.equal(a.run('goalIntent(70,80)'), 'Meta de ganho de peso');
 assert.equal(a.run('goalIntent(80,70)'), 'Meta de redução de peso');
 a.run("state.profile.initialWeight=100;state.profile.goal=80;state.weights=[{id:'peso',date:NeoCore.today(),value:105}]");
 const html=a.run('overview()');
 assert.match(html,/journey-away/);assert.match(html,/journey-negative-percent">-25%/);assert.match(html,/Você se distanciou da sua meta/);assert.match(html,/Início: 100/);
 assert.match(html,/Peso atual: 105/);assert.match(html,/journey-delta-away[^>]*>\+5,00 kg<\/b>/);
 a.run('state.profile.goal=120;state.weights[0].value=110');
 const gain=a.run('overview()');assert.match(gain,/Meta de ganho de peso/);
 assert.match(gain,/>50%<\/b>/);assert.ok(!gain.includes('journey-away-note'));
});


test('variação mostra sinal físico e cor conforme a direção da meta',()=>{
 const a=setup();
 for(const [goal,current,cls,label] of [[80,90,'toward','−10,00 kg'],[80,110,'away','+10,00 kg'],[120,110,'toward','+10,00 kg'],[120,90,'away','−10,00 kg']]){
  const html=a.run(`journeyProgress({initial:100,goal:${goal},current:${current}})`);
  assert.ok(html.includes(`journey-delta-${cls}" aria-label="Variação desde o peso inicial">${label}</b>`));
 }
 assert.ok(a.run('journeyProgress({initial:100,goal:80,current:null})').includes('Variação desde o peso inicial">—</b>'));
});


test('históricos de peso e medidas ficam em Registros antes das aplicações',()=>{
 const a=setup(),records=a.run('records()'),evolution=a.run('evolution()');
 assert.ok(records.indexOf('Histórico de peso')<records.indexOf('Medidas corporais'));
 assert.ok(records.indexOf('Medidas corporais')<records.indexOf('Histórico de aplicações'));
 assert.match(records,/data-add="weight"/);assert.match(records,/data-add="measure"/);
 assert.ok(!evolution.includes('Histórico de peso'));assert.ok(!evolution.includes('Medidas corporais'));
 assert.match(evolution,/Evolução do peso/);assert.match(evolution,/Evolução das medidas/);
});

test('calendário distingue tipos por cor com legenda e mantém todos os tipos do dia',async()=>{
 const a=setup();
 a.run("state.weights=[{id:'w1',date:NeoCore.today(),value:80},{id:'w2',date:NeoCore.today(),value:81}];state.measures=[{id:'m',date:NeoCore.today(),waist:90}];state.doses=[{id:'d',date:NeoCore.today(),product:'Produto',amount:1,unit:'mg'}];state.journal=[{id:'j',date:NeoCore.today(),note:'Diário'}];state.protocols=[{id:'p',date:NeoCore.today(),name:'Protocolo'}];state.reminders=[{id:'r',date:NeoCore.today(),title:'Lembrete',time:'08:00',enabled:true,repeat:'daily'}]");
 await a.run("go('calendario',false)");
 const day=a.document.querySelector('.calendar-day.today');
 assert.equal(day.querySelectorAll('.calendar-mark').length,6);
 for(const kind of ['weights','measures','doses','journal','protocols','reminders']){
  assert.ok(day.querySelector('.calendar-'+kind));
  assert.ok(a.document.querySelector('.calendar-legend .calendar-'+kind));
 }
 assert.match(day.getAttribute('aria-label'),/Peso, Medidas, Aplicações/);
 a.run("calendarView='week';render()");
 assert.equal(a.document.querySelector('.calendar-day.today').querySelectorAll('.calendar-mark').length,6);
});

test('aviso de pendências espera guia, abre formulário e reaparece só no próximo acesso',()=>{
 const a=setup();a.run("mode='cloud';demo=false;Cloud.user={id:'daily-user'};state.settings.reminderIntroSeen=true;state.settings.reminderScheduleConfigured=true;Cloud.onboardingComplete=true;arrivalReady=true;page='inicio';state.profile.consent=true;state.profile.tracking.measures=false;state.profile.tracking.applications=false");
 a.document.body.insertAdjacentHTML('beforeend','<div data-arrival></div>');
 a.run('checkDailyRecords()');assert.equal(a.document.querySelector('.daily-record-prompt'),null);
 a.document.querySelector('[data-arrival]').remove();a.run('checkDailyRecords()');
 assert.equal(a.document.querySelector('.daily-record-item h3').textContent,'Peso');assert.match(a.document.querySelector('[data-daily-register]').textContent,/Registrar peso agora/);
 a.document.querySelector('[data-daily-register]').click();assert.equal(a.run('formKind'),'weight');
 a.document.querySelector('#dialog').close();a.run('checkDailyRecords()');assert.equal(a.document.querySelector('.daily-record-prompt'),null);
 a.run('resetDailyVisit();checkDailyRecords()');assert.ok(a.document.querySelector('.daily-record-prompt'));
 a.document.querySelector('[data-daily-later]').click();a.run('checkDailyRecords()');assert.equal(a.document.querySelector('.daily-record-prompt'),null);
 a.run("state.weights=[{id:'today',date:NeoCore.today(),value:80}];resetDailyVisit();checkDailyRecords()");assert.equal(a.document.querySelector('.daily-record-prompt'),null);
 a.run("state.weights=[];resetDailyVisit();checkDailyRecords();Cloud.user=null;checkDailyRecords()");assert.equal(a.document.querySelector('.daily-record-prompt'),null);
});

test('aviso aberto acompanha mudança do dia de medidas e conclusão dos registros',()=>{
 const a=setup();a.run("mode='cloud';Cloud.user={id:'daily-update'};state.settings.reminderIntroSeen=true;state.settings.reminderScheduleConfigured=true;Cloud.onboardingComplete=true;arrivalReady=true;page='inicio';state.profile.consent=true;state.weights=[{date:NeoCore.today(),value:80}];state.settings.measureDay=String(new Date(NeoCore.today()+'T12:00').getDay());checkDailyRecords()");
 assert.equal(a.document.querySelector('.daily-record-item h3').textContent,'Medidas');
 a.run("state.settings.measureDay=String((Number(state.settings.measureDay)+1)%7);checkDailyRecords()");
 assert.equal(a.document.querySelector('.daily-record-prompt'),null);
 a.run("resetDailyVisit();state.settings.measureDay=String(new Date(NeoCore.today()+'T12:00').getDay());checkDailyRecords();state.measures=[{date:NeoCore.today(),waist:90}];checkDailyRecords()");
 assert.equal(a.document.querySelector('.daily-record-prompt'),null);
});

test('formulário do lembrete permite associar aplicação sem depender do título',()=>{
 const a=setup();a.run("openRecord('reminder',{id:'r',date:NeoCore.today(),title:'Aplicação · Meu cuidado semanal',time:'09:00',repeat:'weekly',enabled:true})");
 assert.ok(a.document.querySelector('[name=recordTarget] option[value=dose][selected]'));
 assert.equal(a.document.querySelector('[name=title]').value,'Meu cuidado semanal');
});

test('orientação de lembretes vem depois das pendências e salva pular na conta',async()=>{
 const a=setup();a.run("mode='cloud';Cloud.user={id:'intro-skip'};Cloud.onboardingComplete=true;arrivalReady=true;page='inicio';state.profile.consent=true;state.profile.tracking.measures=false;state.profile.tracking.applications=false;window.savedIntro=null;Cloud.saveProfile=async(p,settings)=>{window.savedIntro={...state,profile:p,settings}};Cloud.load=async()=>window.savedIntro;checkDailyRecords()");
 assert.ok(a.document.querySelector('[data-daily-later]'));assert.ok(!a.document.querySelector('.reminder-setup-prompt'));
 a.document.querySelector('[data-daily-later]').click();a.run('checkDailyRecords()');
 assert.match(a.document.querySelector('.reminder-setup-prompt').textContent,/sininho no topo/);
 a.document.querySelector('[data-reminder-setup=skip]').click();
 for(let i=0;i<12;i++)await Promise.resolve();
 assert.equal(a.run('savedIntro.settings.reminderIntroSeen'),true);assert.equal(a.run('savedIntro.settings.reminderSetupPromptDate'),C.today());
 assert.ok(!a.document.querySelector('.reminder-setup-prompt'));
 a.run('resetDailyVisit();checkDailyRecords()');assert.ok(!a.document.querySelector('.reminder-setup-prompt'));
});

test('orientação inicial abre configuração pelo mesmo destino do sininho',async()=>{
 const a=setup();a.run("mode='cloud';Cloud.user={id:'intro-configure'};Cloud.onboardingComplete=true;arrivalReady=true;page='inicio';state.profile.consent=true;state.profile.tracking.weight=false;state.profile.tracking.measures=false;state.profile.tracking.applications=false;window.savedIntro=null;Cloud.saveProfile=async(p,settings)=>{window.savedIntro={...state,profile:p,settings}};Cloud.load=async()=>window.savedIntro;checkDailyRecords()");
 a.document.querySelector('[data-reminder-setup=configure]').click();for(let i=0;i<12;i++)await Promise.resolve();
 assert.equal(a.run('page'),'lembretes');assert.ok(!a.document.querySelector('.reminder-setup-prompt'));
 assert.equal(a.document.querySelector('#bell').dataset.go,'lembretes');
});

test('recuperação consome CAPTCHA, explica expiração e impede reenvio logo após sucesso',async()=>{
 const calls=[],a=setup({}, {cloud:{configured:true,email:async(...args)=>{calls.push(args);if(calls.length===1)throw Object.assign(Error('captcha protection: timeout-or-duplicate'),{code:'captcha_failed'});return {}}}});await new Promise(setImmediate);
 a.ctx.NEO_CONFIG.providers.email=true;authFormData(a);let token='first',resets=0;
 a.ctx.NeoCaptcha={mount(){},remove(){},take(){const value=token;token='';return value},reset(){token='fresh-'+(++resets)}};
 a.run("authMode='reset';go('bemvindo',false)");let form=a.document.querySelector('#authForm');form.querySelector('[name=email]').value='person@example.test';
 form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
 assert.match(a.document.querySelector('#authError').textContent,/verificação de segurança expirou/);assert.equal(calls[0][4].captchaToken,'first');
 form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
 assert.equal(calls[1][4].captchaToken,'fresh-1');assert.equal(a.document.querySelector('#authError').textContent,'');
 assert.match(a.document.querySelector('#authMessage').textContent,/receberá um código/);assert.equal(a.run('authMode'),'verifycode');a.run("authMode='reset';render()");
 form=a.document.querySelector('#authForm');assert.equal(form.querySelector('button.primary').disabled,true);assert.match(form.querySelector('button.primary').textContent,/Reenviar em/);
 form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(calls.length,2);
 a.run('resetNextAt=Date.now()-1;updateResetCooldown()');assert.equal(form.querySelector('button.primary').disabled,false);
});

test('recuperação por código segue até nova senha no app e rejeita código inválido e senhas diferentes',async()=>{
 const calls=[],a=setup({}, {cloud:{configured:true}});await new Promise(setImmediate);a.ctx.NEO_CONFIG.providers.email=true;authFormData(a);
 const saved=new Map();a.ctx.sessionStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const user={id:'otp-user',email:'person@example.test'};a.ctx.NeoCloud.email=async(mode,email,password,name,options)=>{calls.push({mode,email,password,options});if(mode==='verifycode'){if(options.code!=='00001234')throw Object.assign(Error('Token invalid'),{code:'otp_expired'});a.ctx.NeoCloud.user=user;await a.run("authChanged('SIGNED_IN',Cloud.user)");return {session:{user},user}}return {user}};
 a.ctx.NeoCloud.onboardingComplete=true;a.ctx.NeoCloud.load=async()=>({...C.blank(),profile:{...C.defaultProfile(),name:'Pessoa',consent:true}});
 a.run("authMode='reset';go('bemvindo',false)");let form=a.document.querySelector('#authForm');form.querySelector('[name=email]').value=user.email;form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
 assert.equal(a.run('authMode'),'verifycode');assert.equal(JSON.parse(saved.get('neo-recovery-request')).stage,'verifycode');
 form=a.document.querySelector('#authForm');assert.equal(form.querySelector('[name=code]').getAttribute('autocomplete'),'one-time-code');assert.ok(!form.querySelector('[name=password]'));
 form.querySelector('[name=code]').value='99999999';form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
 assert.equal(a.run('authMode'),'verifycode');assert.match(a.document.querySelector('#authError').textContent,/Código inválido ou expirado/);
 form.querySelector('[name=code]').value='00001234';form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
 assert.equal(a.run('authMode'),'newpassword');assert.equal(a.run('page'),'bemvindo');assert.equal(a.document.querySelector('#nav').hidden,true);
 form=a.document.querySelector('#authForm');form.querySelector('[name=password]').value='NewPass123';form.querySelector('[name=confirmPassword]').value='Different123';form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
 assert.equal(calls.filter(c=>c.mode==='newpassword').length,0);assert.match(a.document.querySelector('#authError').textContent,/senhas não conferem/);
 form.querySelector('[name=confirmPassword]').value='NewPass123';form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
 assert.equal(calls.filter(c=>c.mode==='newpassword').length,1);assert.equal(a.run('page'),'inicio');assert.equal(saved.has('neo-recovery-request'),false);
 assert.ok(!JSON.stringify([...a.data]).includes('NewPass123'));
});

test('tela de código pode ser restaurada sem guardar código ou senha',()=>{
 const a=setup();const data=new Map([['neo-recovery-request',JSON.stringify({email:'person@example.test',stage:'verifycode',requestedAt:Date.now()})]]);
 a.ctx.sessionStorage={getItem:k=>data.get(k),removeItem:k=>data.delete(k)};a.run('restoreRecovery();render()');
 assert.equal(a.run('authMode'),'verifycode');assert.ok(a.document.querySelector('[name=code]'));assert.ok(!a.document.querySelector('[name=password]'));
});

test('senha salva continua sendo confirmada se a atualização dos dados da conta falhar',async()=>{
 const a=setup({}, {cloud:{configured:true,email:async()=>({}),load:async()=>{throw Error('Sem conexão')}}});await new Promise(setImmediate);a.ctx.NEO_CONFIG.providers.email=true;authFormData(a);a.ctx.NeoCloud.user={id:'recovery-save'};
 a.run("mode='cloud';recoveryFlow=true;authMode='newpassword';go('bemvindo',false)");const form=a.document.querySelector('#authForm');form.querySelector('[name=password]').value='NewPass123';form.querySelector('[name=confirmPassword]').value='NewPass123';form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
 assert.match(a.document.querySelector('#authMessage').textContent,/Sua senha foi atualizada/);assert.equal(a.run('authMode'),'login');assert.equal(a.document.querySelector('[name=password]').value,'');
});

test('exclusão sem exportar pede senha e CAPTCHA, pode ser cancelada e não exige palavra',async()=>{
 const calls=[],a=setup({}, {cloud:{deleteAccount:async(...args)=>{calls.push(args)}}});let token='';a.ctx.NEO_CONFIG.captchaRequired=true;a.ctx.NeoCaptcha={mount(){},remove(){},reset(){},take(){const value=token;token='';return value}};a.ctx.prompt=()=>{throw Error('Não deve pedir palavra');};
 a.run("mode='cloud';Cloud.user={id:'delete-choice-test'};backupDone=false;deletionChoice('cloud')");
 assert.match(a.document.querySelector('.deletion-choice').textContent,/Exportar meus dados/);assert.match(a.document.querySelector('.deletion-choice').textContent,/Excluir sem exportar/);
 a.document.querySelector('[data-deletion-cancel]').click();assert.equal(calls.length,0);assert.ok(!a.document.querySelector('.deletion-choice'));
 a.run("deletionChoice('cloud')");a.document.querySelector('[data-deletion-continue]').click();
 const form=a.document.querySelector('#deletionPasswordForm'),field=form.querySelector('[name=deletionPassword]');assert.equal(field.type,'password');assert.equal(calls.length,0);
 form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(calls.length,0);assert.match(form.querySelector('[role=alert]').textContent,/Informe sua senha/);
 field.value='test-password';form.querySelector('[data-password-toggle]').click();assert.equal(field.type,'text');
 form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(calls.length,0);assert.match(form.querySelector('[role=alert]').textContent,/verificação de segurança/);
 token='captcha-proof';form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
 assert.equal(calls.length,1);assert.deepEqual(calls[0],['test-password','captcha-proof','delete-choice-test']);assert.equal(field.value,'');assert.equal(a.run('page'),'bemvindo');assert.equal(a.run('backupDone'),false);assert.ok(!JSON.stringify([...a.data]).includes('test-password'));
});

test('exportar na escolha não apaga a conta e troca de conta invalida a confirmação',async()=>{
 let deleted=0;const a=setup({}, {cloud:{deleteAccount:async()=>{deleted++}}});
 a.run("mode='cloud';Cloud.user={id:'export-owner'};window.exportsForDelete=0;backup=async()=>{window.exportsForDelete++};deletionChoice('cloud')");
 a.document.querySelector('[data-deletion-export]').click();await new Promise(setImmediate);
 assert.equal(a.run('exportsForDelete'),1);assert.equal(deleted,0);assert.equal(a.document.querySelector('[data-deletion-continue]').textContent,'Continuar com exclusão');
 a.run("Cloud.user={id:'other-account'}");a.ctx.prompt=()=> 'EXCLUIR';a.document.querySelector('[data-deletion-continue]').click();await new Promise(setImmediate);assert.equal(deleted,0);assert.ok(!a.document.querySelector('.deletion-choice'));
});

test('senha recusada mantém a conta e permite nova tentativa sem guardar senha',async()=>{
 const a=setup({}, {cloud:{deleteAccount:async()=>{throw Error('Senha incorreta.')}}});
 a.run("mode='cloud';Cloud.user={id:'delete-failure'};backupDone=false;deletionChoice('cloud')");a.document.querySelector('[data-deletion-continue]').click();
 const form=a.document.querySelector('#deletionPasswordForm');form.querySelector('[name=deletionPassword]').value='wrong';form.dispatchEvent(new a.ctx.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
 assert.equal(a.run('mode'),'cloud');assert.ok(a.document.querySelector('.deletion-choice'));assert.equal(form.querySelector('button[type=submit]').disabled,false);assert.match(form.querySelector('[role=alert]').textContent,/Senha incorreta/);assert.equal(form.querySelector('[name=deletionPassword]').value,'');
});

test('mostrar e ocultar senha preserva valor, não envia formulário e cada campo é independente',async()=>{
 let submitted=0;const a=setup({}, {cloud:{configured:true,email:async()=>{submitted++;return {}}}});await new Promise(setImmediate);
 for(const mode of ['login','signup','newpassword']){
  a.run(`authMode='${mode}';go('bemvindo',false)`);
  const form=a.document.querySelector('#authForm'),field=form.querySelector('[name=password]'),toggle=form.querySelector('[data-password-toggle=auth-password]');field.value='Example123';
  assert.equal(field.type,'password');assert.equal(toggle.getAttribute('type'),'button');assert.equal(toggle.getAttribute('aria-controls'),field.id);
  toggle.click();assert.equal(field.type,'text');assert.equal(field.value,'Example123');assert.equal(toggle.getAttribute('aria-pressed'),'true');assert.match(toggle.getAttribute('aria-label'),/Ocultar/);
  const confirmation=form.querySelector('[name=confirmPassword]');if(confirmation){assert.equal(confirmation.type,'password');form.querySelector('[data-password-toggle=auth-confirmPassword]').click();assert.equal(confirmation.type,'text');}
  toggle.click();assert.equal(field.type,'password');assert.equal(field.value,'Example123');assert.equal(toggle.getAttribute('aria-pressed'),'false');assert.equal(submitted,0);
  a.run('render()');assert.equal(a.document.querySelector('[name=password]').type,'password');
 }
});

test('acompanhamento inicia oculto abaixo da jornada, abre no botão e recolhe ao voltar ao início',async()=>{
 const a=setup();await a.run("go('inicio',false)");
 let panel=a.document.querySelector('#homeJourneyDetails'),button=a.document.querySelector('[data-home-details]');
 assert.equal(panel.hidden,true);assert.equal(button.getAttribute('aria-expanded'),'false');assert.ok(button.closest('.home-journey'));assert.equal(a.document.querySelector('.home-journey').nextElementSibling.id,'homeJourneyDetails');
 assert.deepEqual([...panel.querySelectorAll('h2')].map(h=>h.textContent),['Seu resumo','Minha evolução — Antes e Depois','Seu cuidado de hoje','Seus últimos passos']);
 button.click();assert.equal(panel.hidden,false);assert.equal(button.getAttribute('aria-expanded'),'true');assert.match(button.textContent,/Ocultar acompanhamento/);
 a.run('render()');assert.equal(a.document.querySelector('#homeJourneyDetails').hidden,false);
 a.document.querySelector('[data-home-details]').click();assert.equal(a.document.querySelector('#homeJourneyDetails').hidden,true);
 a.document.querySelector('[data-home-details]').click();
 a.document.querySelector('#homeJourneyDetails [data-go=fotos]').click();assert.equal(a.run('page'),'fotos');
 await a.run("go('inicio',false)");
 assert.equal(a.document.querySelector('#homeJourneyDetails').hidden,true);assert.equal(a.document.querySelector('[data-home-details]').getAttribute('aria-expanded'),'false');
});

test('login shows only account access and places circular provider icons between submit and signup',()=>{const a=setup();const content=a.document.querySelector('#content');assert.equal(content.querySelector('#localMode'),null);assert.equal(content.querySelector('#demo'),null);const social=content.querySelector('.auth-social-buttons');assert.equal(social.previousElementSibling.id,'authForm');assert.ok(social.nextElementSibling.classList.contains('auth-tabs'));for(const provider of ['apple','google']){const b=social.querySelector('[data-oauth="'+provider+'"]');assert.ok(b.querySelector('svg'));assert.equal(b.textContent,'');assert.equal(b.getAttribute('aria-label'),'Continuar com '+(provider==='apple'?'Apple':'Google'));assert.equal(b.getAttribute('type'),'button')}});

test('contador administrativo atualiza sem recarregar e some após leitura confirmada',async()=>{
 let count=0,calls=0;
 const a=setup({}, {cloud:{configured:true,user:{id:'A'},admin:true,hasConsent:()=>true,
  adminSignups:async action=>{assert.equal(action,'count');calls++;return {count}}
 }});
 await new Promise(setImmediate);
 a.run("mode='cloud';page='inicio';render()");
 await new Promise(setImmediate);
 const link=a.document.querySelector('#adminShortcut');
 assert.equal(link.querySelector('.admin-signup-badge'),null);
 count=3;
 await a.run('refreshSignupBadge()');
 assert.equal(link.querySelector('.admin-signup-badge').textContent,'3');
 assert.match(link.getAttribute('aria-label'),/3 novos cadastros/);
 count=0;
 await a.run('refreshSignupBadge()');
 assert.equal(link.querySelector('.admin-signup-badge'),null);
 const before=calls;
 a.run("Cloud.admin=false;render()");
 await a.run('refreshSignupBadge()');
 assert.equal(calls,before);
 assert.equal(link.hidden,true);
});

test('engajamento deduplica renderizações e descarta tempo de segundo plano',async()=>{
 let now=1000000,visibility='visible';
 const clock=class extends Date{static now(){return now}};
 const sent=[];
 const a=setup({}, {date:clock,cloud:{configured:true,user:{id:'A'},hasConsent:()=>true,
  engagement:async(action,batch)=>{if(action==='record')sent.push(...batch);return {allowed:true}}
 }});
 Object.defineProperty(a.document,'visibilityState',{get:()=>visibility});
 await new Promise(setImmediate);
 a.run("mode='cloud';page='inicio';render()");
 await new Promise(setImmediate);
 a.run('render();engagementView()');
 now+=15000;
 a.run('sampleEngagement()');
 visibility='hidden';
 a.document.dispatchEvent(new a.document.defaultView.Event('visibilitychange'));
 await new Promise(setImmediate);
 now+=60000;
 a.run('sampleEngagement()');
 visibility='visible';
 a.document.dispatchEvent(new a.document.defaultView.Event('visibilitychange'));
 a.run("page='evolucao';engagementView();engagementView()");
 await a.run('flushEngagement()');
 assert.deepEqual(sent.map(row=>[row.area,row.event,row.seconds]),
  [['inicio','home_view',0],['inicio','active_time',15],['evolucao','evolution_view',0]]);
 assert.equal(new Set(sent.map(row=>row.session_id)).size,1);
 assert.deepEqual(Object.keys(sent[0]).sort(),['area','event','id','occurred_at','seconds','sequence','session_id']);
});

test('qualidade mede apenas com consentimento e limita a frequência das amostras',async()=>{
 const calls=[];
 const a=setup({}, {cloud:{configured:true,user:{id:'A'},hasConsent:()=>true,
  engagement:async()=>({allowed:false}),qualityObserve:async(...values)=>calls.push(values)
 }});
 await new Promise(setImmediate);
 a.run("mode='cloud';page='inicio';render()");
 await new Promise(setImmediate);
 a.run("observeQuality('javascript_error')");
 await new Promise(setImmediate);
 assert.deepEqual(calls,[]);
 a.run("engagementAllowed=true;observeQuality('sync_response',350);observeQuality('sync_response',351)");
 await new Promise(setImmediate);
 assert.deepEqual(calls,[['sync_response',350,'']]);
});

test('campanha espera sessão pronta, abre uma vez e fecha ao trocar de conta',async()=>{
 const calls=[];
 const a=setup({}, {cloud:{user:{id:'ficticia'},onboardingComplete:true,campaignVisit:async(action,id)=>{
  calls.push([action,id]);
  if(action==='next')return {impression:'receipt',title:'<campanha>',body:'Oferta fictícia'};
  return true;
 }}});
 await new Promise(setImmediate);
 a.ctx.HTMLDialogElement=class {};
 const originalCreate=a.document.createElement.bind(a.document);
 a.document.createElement=tag=>{
  const node=originalCreate(tag);
  if(tag==='dialog'){
   node.showModal=()=>node.setAttribute('open','');
   node.close=()=>{node.removeAttribute('open');node.dispatchEvent(new a.ctx.Event('close'))};
  }
  return node;
 };
 a.run("mode='cloud'; page='inicio'; sessionLoading=true; arrivalReady=true; syncCampaign()");
 assert.equal(calls.length,0);
 a.run("sessionLoading=false; syncCampaign(); syncCampaign()");
 await new Promise(setImmediate);
 assert.deepEqual(calls,[['next',undefined],['displayed','receipt']]);
 assert.equal(a.document.querySelector('.neo-campaign-dialog h2').textContent,'<campanha>');
 a.run("mode='local'; syncCampaign()");
 assert.equal(a.document.querySelector('.neo-campaign-dialog'),null);
});
