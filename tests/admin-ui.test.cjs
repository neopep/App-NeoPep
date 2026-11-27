const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs'),{parseHTML}=require('linkedom'),C=require('../dist/core.js');
function app(summary,configured=true){const {document}=parseHTML(fs.readFileSync('dist/admin/index.html','utf8'));const selectPrototype=Object.getPrototypeOf(document.createElement('select'));
 const nativeValue=Object.getOwnPropertyDescriptor(selectPrototype,'value');
 Object.defineProperty(selectPrototype,'value',{configurable:true,get(){return nativeValue.get.call(this)||''},set(value){
  this.querySelectorAll('option').forEach(option=>{option.selected=option.value===value;});
 }});
 const formPrototype=Object.getPrototypeOf(document.createElement('form'));
 if(!Object.getOwnPropertyDescriptor(formPrototype,'elements'))Object.defineProperty(formPrototype,'elements',{get(){
  return Object.fromEntries([...this.querySelectorAll('[name]')].map(field=>[field.name,field]));
 }});
 formPrototype.reset??=function(){for(const field of this.querySelectorAll('[name]')){field.value='';if(field.type==='checkbox')field.checked=field.hasAttribute('checked');}};
 class TestFormData{
  constructor(form){this.fields=[...form.querySelectorAll('[name]')].filter(field=>field.type!=='checkbox'||field.checked);}
  getAll(name){return this.fields.filter(field=>field.name===name).map(field=>field.value);}
  get(name){return this.getAll(name)[0]??null;}
  has(name){return this.get(name)!==null;}
  *[Symbol.iterator](){for(const f of this.fields)yield [f.name,f.value];}
 }
const cloud={configured,user:configured?{id:'user'}:null,init:async()=>null,adminSummary:async()=>{if(summary instanceof Error)throw summary;return summary}};const timers=[];let now=10000;const fakeDate=class extends Date{static now(){return now}};const ctx={document,FormData:TestFormData,URL,URLSearchParams,location:new URL('https://teste.app.neopep.com.br/admin/'),Date:fakeDate,setTimeout:(callback,delay)=>{const timer={callback,delay,active:true};timers.push(timer);return timer},clearTimeout:timer=>{if(timer)timer.active=false},window:{NeoCore:C,NeoCloud:cloud},Number,confirm:()=>true};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/admin/admin.js','utf8'),ctx);return {document,cloud,timers,run:code=>vm.runInContext(code,ctx),select(tab){return vm.runInContext('tab='+JSON.stringify(tab)+';refresh()',ctx)},advance(ms){now+=ms;timers.findLast(timer=>timer.active)?.callback()},refresh:()=>vm.runInContext('refresh()',ctx)}}
test('painel administrativo não apresenta métricas inventadas sem backend nem dados após recusa',async()=>{const a=app(null,false);await a.refresh();assert.match(a.document.querySelector('#adminStatus').textContent,/não configurado/);assert.equal(a.document.querySelectorAll('.stat-value').length,0);const b=app(Error('administrator required'));await b.refresh();assert.match(b.document.querySelector('#adminStatus').textContent,/administrator required/);assert.equal(b.document.querySelectorAll('.stat-value').length,0)});
test('renderização administrativa usa apenas indicadores permitidos, sem dados individuais extras',async()=>{const data={users_total:12,signups_7d:3,active_24h:2,active_7d:6,active_30d:10,profiles_total:10,records_total:25,photos_total:8,server_time:'2026-11-12T00:00:00Z',private_storage:true,database_status:'reachable',schema_version:'202611120002',signups_daily:[{day:'2026-11-12',count:null}],app_errors_7d:[],email:'private@example.invalid',health:{weight:91},photo_url:'https://private/photo.jpg'};const a=app(data);await a.refresh();const text=a.document.querySelector('#adminContent').textContent;assert.equal(a.document.querySelectorAll('.stat-value').length,8);assert.ok(!text.includes('private@example.invalid'));assert.ok(!text.includes('photo.jpg'));assert.ok(!text.includes('91'));assert.doesNotMatch(text,/Cadastros por dia/)});

test('Configurações usa API autorizada e não oferece armazenamento de chaves no navegador',async()=>{const d={users_total:1,signups_7d:1,active_24h:1,active_7d:1,active_30d:1,profiles_total:1,records_total:0,photos_total:0,server_time:'agora',private_storage:true,database_status:'reachable',schema_version:'test',signups_daily:[],app_errors_7d:[]};const a=app(d);a.cloud.platform=async()=>({config:{ai_provider:'openai',ai_model:'',ai_enabled:false,ai_prompt:'Suporte operacional',ai_daily_limit:50,ai_validated_at:null},shop:{},require_approval:true,ai_pending:0,ai_attempts_today:0});await a.refresh();a.document.querySelector('[data-admin-tab=settings]').click();await new Promise(setImmediate);assert.ok(a.document.querySelector('#platformForm'));assert.ok(a.document.querySelector('#adminShopForm'));assert.ok(a.document.querySelector('[data-agent-admin]'));assert.equal(a.document.querySelector('input[type=password]'),null);assert.match(a.document.querySelector('#adminContent').textContent,/Mercado Pago/);});

test('controle de cadastro só habilita após consultar e bloqueia estado após falha',async()=>{const d={users_total:1,signups_7d:1,active_24h:1,active_7d:1,active_30d:1,profiles_total:1,records_total:0,photos_total:0,server_time:'agora',private_storage:true,database_status:'reachable',schema_version:'test',signups_daily:[],app_errors_7d:[]};const a=app(d),calls=[];let failed=false;a.cloud.platform=async()=>({config:{},shop:{}});a.cloud.authSettings=async(action,payload)=>{calls.push([action,payload]);if(failed)throw Error('unavailable');return {require_email_confirmation:action==='status'?true:payload.require_email_confirmation,verified:true};};await a.refresh();a.document.querySelector('[data-admin-tab=settings]').click();await new Promise(setImmediate);const box=a.document.querySelector('#requireEmailConfirmation'),button=a.document.querySelector('#authSettingsForm button');assert.equal(box.disabled,true);assert.equal(button.disabled,true);a.document.querySelector('#authSettingsRead').click();await new Promise(setImmediate);assert.equal(box.checked,true);assert.equal(box.disabled,false);box.checked=false;const form=a.document.querySelector('#authSettingsForm');form.dispatchEvent(new a.document.defaultView.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(calls.at(-1)[0],'set');assert.equal(calls.at(-1)[1].expected_confirmation,true);assert.equal(calls.at(-1)[1].require_email_confirmation,false);assert.match(a.document.querySelector('#authSettingsStatus').textContent,/Alteração confirmada.*desativada/);failed=true;a.document.querySelector('#authSettingsRead').click();await new Promise(setImmediate);assert.equal(button.disabled,true);assert.equal(box.disabled,true);assert.match(a.document.querySelector('#authSettingsStatus').textContent,/Não foi possível confirmar/);});

test('cadastros ficam na visão geral e o aviso temporário preserva a lista paginada',async()=>{
 const a=app({signups_daily:[],app_errors_7d:[]}),calls=[];
 const rows=Array.from({length:21},(_,i)=>({
  id:'fixture-'+i,full_name:i===0?'<Nome Fictício>':'Pessoa Fictícia',
  email:'conta@example.invalid',created_at:'2026-11-21T15:00:00Z',
  provider:'google',last_access:null,is_new:i===0
 }));
 let opened=false;
 a.cloud.adminSignups=async(action,filters)=>{
  calls.push([action,filters]);
  if(action==='open'){
   if(opened)return {read_count:0,rows:[]};
   opened=true;
   return {read_count:40,rows:rows.slice(0,5),batch:'fixture-batch'};
  }
  return {rows:filters.p_before?[rows.at(-1)]:rows};
 };
 await a.refresh();
 await new Promise(setImmediate);
 const doc=a.document,notice=doc.querySelector('[data-signup-notice]');
 assert.match(notice.textContent,/40 novos cadastros/);
 assert.equal(notice.parentNode,doc.body);
 assert.equal(notice.querySelector('[data-signup-seconds]').textContent,'9 s');
 a.advance(1000);
 assert.equal(notice.querySelector('[data-signup-seconds]').textContent,'8 s');
 assert.equal(notice.querySelectorAll('li').length,5);
 assert.equal(doc.querySelectorAll('.admin-preview-user').length,5);
 assert.equal(calls.filter(([action])=>action==='page').length,1);
 await a.select('signups');
 await new Promise(setImmediate);
 assert.equal(doc.querySelectorAll('.admin-signup').length,20);
 const first=doc.querySelector('.admin-signup');
 assert.match(first.querySelector('summary').textContent,/<Nome Fictício>/);
 assert.equal(first.querySelector('nome'),null);
 assert.match(first.textContent,/Localização não disponível.*Google.*Ainda não registrado/s);
 assert.equal(first.hasAttribute('open'),false);
 assert.equal(calls.findLast(([action])=>action==='page')[1].p_batch,'fixture-batch');
 doc.querySelector('[data-signup-more]').click();
 await new Promise(setImmediate);
 assert.equal(calls.at(-1)[1].p_before_id,'fixture-19');
 assert.equal(doc.querySelectorAll('.admin-signup').length,21);
 a.advance(8000);
 assert.equal(notice.querySelector('[data-signup-seconds]').textContent,'0 s');
 assert.ok(notice.classList.contains('is-closing'));
 a.advance(200);
 assert.equal(notice.isConnected,false);
 assert.equal(doc.querySelectorAll('.admin-signup').length,21);
 await a.refresh();
 await new Promise(setImmediate);
 assert.equal(doc.querySelector('[data-signup-notice]'),null);
});

test('visão geral coloca cadastros e estatísticas entre indicadores e funcionamento',async()=>{
 const a=app({signups_daily:[],app_errors_7d:[]});
 a.cloud.adminSignups=async action=>action==='open'?{read_count:1,rows:[]}: {rows:[]};
 a.cloud.adminAudience=async()=>({today:3,signups_7:4,signups_30:5,period_signups:5,active_1:1,active_7:2,
  active_30:3,new_active:null,returning_active:0,from:'2026-11-01',to:'2026-11-21',groups:[],daily:[],monthly:[]});
 await a.refresh();
 await new Promise(setImmediate);
 const root=a.document.querySelector('.admin-overview');
 assert.equal(root.children.length,5);
 assert.ok(root.children[0].matches('[data-admin-tab="campaigns"].admin-campaign-shortcut'));
 assert.ok(root.children[1].matches('.stats'));
 assert.ok(root.children[2].hasAttribute('data-admin-signups'));
 assert.match(root.children[3].textContent,/Estatísticas de público/);
 assert.equal(root.children[4].hasAttribute('open'),false);
 const toast=a.document.querySelector('[data-signup-notice]');
 toast.querySelector('button').click();
 a.advance(200);
 assert.equal(toast.isConnected,false);
 assert.equal(a.timers.filter(timer=>timer.active&&timer.delay===100).length,0);
 await a.select('audience');
 await new Promise(setImmediate);
 assert.match(a.document.querySelector('[data-admin-audience]').textContent,/Estatísticas de público.*Dados insuficientes/s);

});

test('aviso aguarda aba visível e pausa a contagem enquanto fica oculta',async()=>{
 const a=app({signups_daily:[],app_errors_7d:[]});
 let visibility='hidden';
 Object.defineProperty(a.document,'visibilityState',{get:()=>visibility});
 a.cloud.adminSignups=async action=>action==='open'?{read_count:1,rows:[]}: {rows:[]};
 await a.refresh();
 await new Promise(setImmediate);
 const toast=a.document.querySelector('[data-signup-notice]');
 const remaining=()=>toast.querySelector('[data-signup-seconds]').textContent;
 a.advance(12000);
 assert.equal(remaining(),'9 s');
 const change=value=>{visibility=value;a.document.dispatchEvent(new a.document.defaultView.Event('visibilitychange'))};
 change('visible');
 a.advance(2000);
 assert.equal(remaining(),'7 s');
 change('hidden');
 a.advance(30000);
 assert.equal(remaining(),'7 s');
 change('visible');
 a.advance(7000);
 a.advance(200);
 assert.equal(toast.isConnected,false);
});

test('painel mostra engajamento distinto de audiência e funis somente com etapas disponíveis',async()=>{
 const a=app({signups_daily:[],app_errors_7d:[]});
 a.cloud.adminAudience=async()=>({today:1,signups_7:1,signups_30:1,period_signups:1,active_1:1,active_7:1,
  active_30:1,new_active:null,returning_active:0,from:'2026-11-01',to:'2026-11-21',groups:[],daily:[],monthly:[]});
 a.cloud.adminEngagement=async()=>({started_at:null,users:6,sessions:8,mean:75,median:60,areas:1.5,returning:null,
  ranking:[{area:'evolucao',users:6,visits:15,sessions:8,active:600,completed:7,previous_users:5}],
  funnels:[{name:'Evolução',steps:['evolution_view','weight_record_started','weight_record_created'],counts:[6,5,null]}]});
 await a.refresh();
 await new Promise(setImmediate);
 await a.select('engagement');
 await new Promise(setImmediate);
 const report=a.document.querySelector('[data-engagement-report]');
 assert.match(report.textContent,/Engajamento por funcionalidade.*Sessões8.*Mediana1 min 0 s/s);
 assert.match(report.textContent,/83% avançaram.*17% de abandono/);
 assert.match(report.querySelector('ol li:last-child').textContent,/Salvou pesagem · —/);
 assert.equal(report.querySelector('select[name=second] option[value=evolucao]').textContent,'Evolução');
});

test('exportação atravessa as páginas com filtros e protege células do Excel',async()=>{
 const a=app({signups_daily:[],app_errors_7d:[]}),calls=[];
 a.cloud.adminSignups=async(action,filters)=>{
  calls.push(filters);
  return {rows:Array.from({length:filters.p_before_id?1:21},(_,i)=>({id:String(i),
   full_name:i?'Álvaro':'=HYPERLINK("x")',email:'teste@example.invalid',created_at:'2026-11-21T15:00:00Z'}))};
 };
 const rows=await a.run("signupExport(window.NeoCloud,{p_query:'Ál',p_new:true,p_from:'2026-11-21'},()=>true)");
 assert.equal(rows.length,22);
 assert.equal(calls.length,2);
 assert.equal(calls[1].p_before_id,'19');
 assert.equal(calls[1].p_query,'Ál');
 assert.equal(calls[1].p_new,true);
 assert.equal(calls[1].p_from,'2026-11-21');
 const csv=a.run('adminCsvText('+JSON.stringify(rows)+')');
 assert.equal(csv.charCodeAt(0),0xfeff);
 assert.match(csv,/"'=HYPERLINK\(""x""\)"/);
 assert.match(csv,/Álvaro/);
});

test('saúde busca dados somente ao expandir e calcula projeções com histórico suficiente',async()=>{
 const a=app({signups_daily:[],app_errors_7d:[]});
 let calls=0;
 a.cloud.adminSystem=async()=>{calls++;return {data:{database_bytes:100,storage_bytes:0,storage_sized_objects:0,storage_objects:0},history:[],limits:[]}};
 await a.select('health');
 assert.equal(calls,0);
 const part=a.document.querySelector('[data-system-source=overview]');
 part.open=true;
 part.dispatchEvent(new a.document.defaultView.Event('toggle'));
 await new Promise(setImmediate);
 assert.equal(calls,1);
 assert.match(part.textContent,/100 B/);
 const agent=a.document.querySelector('[data-report-agent=system_health]');
 agent.dispatchEvent(new a.document.defaultView.Event('click',{bubbles:true}));
 assert.match(a.document.querySelector('[data-agent-placeholder]').textContent,/em breve/);
 assert.equal(calls,1);
 const forecast=a.run("monitorProjection([{day:'2026-11-01',bytes:100},{day:'2026-11-04',bytes:130},{day:'2026-11-11',bytes:200}],'bytes',200,250)");
 assert.equal(forecast.daily,10);
 assert.equal(forecast.forecast[1],800);
 assert.equal(forecast.until,5);
 assert.equal(a.run("monitorProjection([],'bytes',200,250)"),null);
 assert.equal(a.document.querySelector('.admin-back-app').getAttribute('href'),'../');
});

test('inteligência operacional carrega seções sob demanda e mantém hipóteses separadas de preços',async()=>{
 const a=app({signups_daily:[],app_errors_7d:[]}),calls=[];
 a.cloud.adminOperations=async(section,days)=>{
  calls.push([section,days]);
  return {observed_at:'2026-11-21T12:00:00Z',recommendations:[]};
 };
 await a.select('operations');
 assert.equal(calls.length,0);
 const node=a.document.querySelector('[data-operation-section=insights]');
 node.open=true;
 node.dispatchEvent(new a.document.defaultView.Event('toggle'));
 await new Promise(setImmediate);
 assert.deepEqual(calls,[['insights',30]]);
 assert.match(node.textContent,/Nenhuma recomendação com evidência suficiente/);
 node.querySelector('[data-report-agent]').dispatchEvent(new a.document.defaultView.Event('click',{bubbles:true}));
 assert.match(node.textContent,/Agente de planejamento — em breve/);
 assert.equal(calls.length,1);
 const rows=a.run(`operationScenarios({
  active:50,sessions:2,stored_mib:10,uploads:1,upload_mib:2,traffic_mib:4,ai:2,input_tokens:100,
  output_tokens:50,api:20,growth:0,currency:'USD',transfer_price:0,api_price:0,fixed:5
 },{input_per_million:10,output_per_million:20,currency:'USD'},[{resource:'storage_bytes',amount:107374182400}])`);
 assert.equal(rows.length,5);
 assert.equal(rows[0].active,500);
 assert.equal(rows[0].ai,1000);
 assert.equal(rows[0].inputs,100000);
 assert.equal(rows[0].total,7);
 assert.equal(rows.at(-1).users,100000);
 assert.equal(a.run("operationScenarios({active:50,ai:2,input_tokens:100,currency:'USD'},null,[])[0].total"),null);
});

test('painel de campanhas escapa conteúdo e confirma ações via servidor',async()=>{
 const screen=app({signups_daily:[],app_errors_7d:[]}),calls=[];
 let status='draft';
 screen.cloud.campaignAdmin=async(action,id,data)=>{
  calls.push({action,id,data});
  if(action==='list')return [{id:'sample',title:'<img src=x>',status,views:2,clicks:1}];
  if(action==='activate')status='active';
  if(action==='pause')status='paused';
 };
 await screen.select('campaigns');
 await new Promise(setImmediate);
 const panel=screen.document.querySelector('#adminContent');
 assert.match(panel.textContent,/<img src=x>/);
 assert.equal(panel.querySelector('article img'),null);
 assert.match(panel.textContent,/2 exibições · 1 cliques · 50.0%/);
 panel.querySelector('[data-campaign-action=activate]').click();
 await new Promise(setImmediate);
 assert.equal(calls.at(-2).action,'activate');
 assert.match(panel.textContent,/✓ Ativa/);
 panel.querySelector('[data-campaign-action=pause]').click();
 await new Promise(setImmediate);
 assert.equal(calls.at(-2).id,'sample');
 assert.match(panel.textContent,/Pausada/);
});

test('ajudas de campanha preservam campos e manual usa leitor interno',async()=>{
 const screen=app({signups_daily:[],app_errors_7d:[]});
 screen.cloud.campaignAdmin=async()=>[];
 const openings=[];
 const reader={open:async payload=>openings.push(payload)};
 screen.run('window.NeoAdminPDF = {}').open=reader.open;
 await screen.select('campaigns');
 await new Promise(setImmediate);
 assert.equal(screen.run('Object.keys(campaignHelp).length'),26);
 screen.document.querySelector('[data-campaign-action=view_plans]').click();
 const account=screen.document.querySelector('[name=account]');
 account.value='Rascunho';
 const help=screen.document.querySelector('[aria-controls=campaign-help-account]');
 assert.equal(help.type,'button');
 help.click();
 assert.equal(help.getAttribute('aria-expanded'),'true');
 assert.equal(screen.document.getElementById('campaign-help-account').textContent,'Informe o UUID da conta cujo plano será administrado.');
 const escape=new screen.document.defaultView.Event('keydown',{bubbles:true,cancelable:true});
 Object.defineProperty(escape,'key',{value:'Escape'});
 help.dispatchEvent(escape);
 assert.equal(help.getAttribute('aria-expanded'),'false');
 screen.document.querySelector('[data-campaign-action=manual]').click();
 assert.equal(openings.length,1);
 assert.equal(openings[0].path,'assets/manual-campanhas-neopep.pdf');
 assert.equal(account.value,'Rascunho');
});

test('central separa canais e oferece balões WhatsApp sem deslocar o formulário',async()=>{
 const screen=app({signups_daily:[],app_errors_7d:[]}),calls=[];
 screen.cloud.campaignAdmin=async()=>[
  {id:'app',title:'Somente App',status:'active',display_state:'scheduled',popup_enabled:true,views:0,clicks:0},
  {id:'wa',title:'Somente WhatsApp',status:'draft',popup_enabled:false,whatsapp_enabled:true,views:0,clicks:0}
 ];
 screen.cloud.campaignWhatsApp=async(action,id)=>{
  calls.push(action);
  if(action==='prepare')return {id,title:'Fictícia',message:'Mensagem manual',link_url:'/#loja'};
  if(action==='queue')return [{id:'job',campaign_id:'wa',title:'Fictícia',group_name:'Grupo teste',state:'pending',timezone:'America/Sao_Paulo'}];
  return [];
 };
 const connection='10000000-0000-4000-8000-000000000004';
 screen.cloud.campaignWhatsAppSync=async()=>[
  {id:connection+':123@g.us',name:'Grupo sincronizado',connection:'Minha conexão',state:'eligible'},
  {id:connection+':124@g.us',name:'Segundo grupo',connection:'Minha conexão',state:'eligible'}
 ];
 screen.cloud.campaignWhatsAppIdentities=async()=>[{id:connection,account_name:'Conta <fixture>',account_number:'12025550123',state:'connected'}];
 screen.run("globalThis.setInterval=()=>1;globalThis.location={origin:'https://teste.app.neopep.com.br'};globalThis.URL=class {constructor(){this.href='https://teste.app.neopep.com.br/#loja';this.protocol='https:'}};window.innerWidth=320;window.innerHeight=600;");
 screen.run(fs.readFileSync('dist/admin/admin-whatsapp.js','utf8'));
 await screen.select('campaigns');await new Promise(setImmediate);
 const list=screen.document.querySelector('[data-campaign-list]');
 assert.match(list.textContent,/Somente App.*Agendada/s);
 assert.doesNotMatch(list.textContent,/Somente WhatsApp/);
 assert.equal(Boolean(screen.document.querySelector('[data-campaign-action=next]')),false);
 screen.document.querySelector('[data-campaign-action=whatsapp]').click();await new Promise(setImmediate);
 assert.match(list.textContent,/Somente WhatsApp/);
 assert.equal(screen.document.querySelector('[data-wa-publication]'),null);
 screen.document.querySelector('[data-campaign-action=view_groups]').click();await new Promise(setImmediate);
 const catalog=screen.document.querySelector('[data-wa-sync-catalog]');
 assert.match(catalog.textContent,/Conta <fixture>.*\+12025550123.*Conectada.*Grupo sincronizado.*Segundo grupo/s);
 assert.equal(catalog.textContent.match(/12025550123/g).length,1);
 assert.equal(catalog.querySelector('fixture'),null);
 assert.equal(screen.document.querySelector('[data-wa-group]').hidden,true);
 assert.equal(screen.document.querySelector('[data-wa=new_item]').closest('.neo-campaign-actions').hidden,true);
 screen.document.querySelector('[data-campaign-action=view_publications]').click();
 screen.document.querySelector('[data-wa=prepare]').click();await new Promise(setImmediate);
 for(const key of ['preview','title','message','link','share','copy_message','copy_link','confirm','cancel']){
  assert.ok(screen.document.querySelector('[aria-controls=wa-preview-'+key+']'),key+' '+screen.document.querySelector('[data-wa-status]').textContent);
 }
 assert.ok(calls.includes('prepare'));
 assert.ok(!calls.some(action=>['confirm','send'].includes(action)));
});


test('barra compacta alterna App e WhatsApp com botões acessíveis e ação de nova campanha',async()=>{
 const screen=app({signups_daily:[],app_errors_7d:[]});
 screen.cloud.campaignAdmin=async()=>[];
 await screen.select('campaigns');await new Promise(setImmediate);
 const root=screen.document.querySelector('.neo-campaign-toolbar');
 assert.ok(root,'barra de campanhas deve existir');
 const tabs=root.querySelector('.neo-campaign-switch');
 assert.ok(tabs,'seletor de canal deve ser separado das ações');
 assert.deepEqual([...tabs.querySelectorAll('button')].map(button=>button.textContent.trim()),['App','WhatsApp']);
 const appButton=root.querySelector('[data-campaign-action="app"]');
 const waButton=root.querySelector('[data-campaign-action="whatsapp"]');
 const add=screen.document.querySelector('[data-campaign-action="new"]');
 const help=root.querySelector('[data-campaign-action="manual"]');
 assert.equal(add.getAttribute('aria-label'),'Nova campanha');
 assert.equal(help.getAttribute('aria-label'),'Ajuda para campanhas');
 assert.equal(appButton.getAttribute('aria-pressed'),'true');
 assert.equal(waButton.getAttribute('aria-pressed'),'false');
 waButton.click();await new Promise(setImmediate);
 assert.equal(appButton.getAttribute('aria-pressed'),'false');
 assert.equal(waButton.getAttribute('aria-pressed'),'true');
 assert.equal(add.closest('.neo-campaign-actionbar')!==null,true);
 const css=fs.readFileSync('dist/admin/connect-ui.css','utf8');
 assert.match(css,/\.neo-campaign-switch button\[aria-pressed="true"\]/);
 assert.match(css,/@media\(max-width:460px\)/);
 assert.match(css,/\.neo-campaign-new-label\{display:none\}/);
});

test('prévia e compartilhamento manual compõem texto, emojis e links, com mídia separada no painel',()=>{
 const screen=app(null);
 screen.run(fs.readFileSync('dist/admin/admin-whatsapp.js','utf8'));
 const payload=route=>JSON.parse(screen.run(`
  JSON.stringify(neoWhatsappPayload({
   title:'Campanha',message:'Olá ✨\\nSegunda linha',link_url:'/#loja',
   link_label:'Ver oferta',image_path:'private.jpg'
  }, '${route}'))
 `));
 assert.deepEqual(payload('web'),{
  link:'https://teste.app.neopep.com.br/#loja',message:'Olá ✨\nSegunda linha',
  text:'Campanha\n\nOlá ✨\nSegunda linha\n\nhttps://teste.app.neopep.com.br/#loja',
  imageInBubble:false,separateMedia:true,attachments:[]
 });
 const connect=payload('connect');
 assert.equal(connect.imageInBubble,true);
 assert.equal(connect.separateMedia,false);
 assert.match(connect.text,/Ver oferta https:/);
 assert.equal(screen.run("neoWhatsappPayload({link_url:'javascript:alert(1)'}).link"),'');
});

test('grupo sincronizado recupera seleção e exclui duplicata ou conexão indisponível',async()=>{
 const screen=app(null);
 screen.run(fs.readFileSync('dist/admin/admin-whatsapp.js','utf8'));
 const root=screen.document.createElement('section');
 root.id='syncedTest';
 screen.document.body.append(root);
 const calls=[];
 screen.cloud.campaignWhatsAppSync=async(action,id)=>{
  calls.push([action,id]);
  if(action==='recipients')return [{id:'one:group@g.us',name:'Grupo antigo',connection:'Um',state:'eligible'}];
  return [
   {id:'one:group@g.us',name:'Grupo atual',connection:'Um',state:'eligible'},
   {id:'two:group@g.us',name:'Mesmo grupo',connection:'Dois',state:'eligible'},
   {id:'two:stale@g.us',name:'Desconectado',connection:'Dois',state:'disconnected'}
  ];
 };
 const picker=screen.run("mountSyncedCampaignGroups(document.getElementById('syncedTest'),{cloud:window.NeoCloud,picking:true})");
 assert.equal(await picker.load('campaign'),true);
 assert.deepEqual(calls,[['catalog',undefined],['recipients','campaign']]);
 assert.deepEqual(Array.from(picker.values()),['one:group@g.us']);
 assert.equal(root.querySelector('[data-sync-id="one:group@g.us"]').hasAttribute('checked'),true);
 assert.equal(root.querySelector('[data-sync-id="two:stale@g.us"]').disabled,true);
 const duplicate=root.querySelector('[data-sync-id="two:group@g.us"]');
 duplicate.checked=true;
 duplicate.dispatchEvent(new screen.document.defaultView.Event('change',{bubbles:true}));
 assert.equal(duplicate.checked,false);
 assert.deepEqual(Array.from(picker.values()),['one:group@g.us']);
});
