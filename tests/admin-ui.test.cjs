const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs'),{parseHTML}=require('linkedom'),C=require('../dist/core.js');
function app(summary,configured=true){const {document}=parseHTML(fs.readFileSync('dist/admin/index.html','utf8'));const cloud={configured,user:configured?{id:'user'}:null,init:async()=>null,adminSummary:async()=>{if(summary instanceof Error)throw summary;return summary}};const timers=[];let now=10000;const fakeDate=class extends Date{static now(){return now}};const ctx={document,Date:fakeDate,setTimeout:(callback,delay)=>{const timer={callback,delay,active:true};timers.push(timer);return timer},clearTimeout:timer=>{if(timer)timer.active=false},window:{NeoCore:C,NeoCloud:cloud},Number,confirm:()=>true};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/admin/admin.js','utf8'),ctx);return {document,cloud,timers,advance(ms){now+=ms;timers.findLast(timer=>timer.active)?.callback()},refresh:()=>vm.runInContext('refresh()',ctx)}}
test('painel administrativo não apresenta métricas inventadas sem backend nem dados após recusa',async()=>{const a=app(null,false);await a.refresh();assert.match(a.document.querySelector('#adminStatus').textContent,/não configurado/);assert.equal(a.document.querySelectorAll('.stat-value').length,0);const b=app(Error('administrator required'));await b.refresh();assert.match(b.document.querySelector('#adminStatus').textContent,/administrator required/);assert.equal(b.document.querySelectorAll('.stat-value').length,0)});
test('renderização administrativa usa apenas indicadores permitidos, sem dados individuais extras',async()=>{const data={users_total:12,signups_7d:3,active_24h:2,active_7d:6,active_30d:10,profiles_total:10,records_total:25,photos_total:8,server_time:'2026-11-12T00:00:00Z',private_storage:true,database_status:'reachable',schema_version:'202611120002',signups_daily:[{day:'2026-11-12',count:null}],app_errors_7d:[],email:'private@example.invalid',health:{weight:91},photo_url:'https://private/photo.jpg'};const a=app(data);await a.refresh();const text=a.document.querySelector('#adminContent').textContent;assert.equal(a.document.querySelectorAll('.stat-value').length,8);assert.ok(!text.includes('private@example.invalid'));assert.ok(!text.includes('photo.jpg'));assert.ok(!text.includes('91'));assert.match(text,/célula suprimida/)});

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
 assert.equal(doc.querySelectorAll('.admin-signup').length,20);
 const first=doc.querySelector('.admin-signup');
 assert.match(first.querySelector('summary').textContent,/<Nome Fictício>/);
 assert.equal(first.querySelector('nome'),null);
 assert.match(first.textContent,/Localização não disponível.*Google.*Ainda não registrado/s);
 assert.equal(first.hasAttribute('open'),false);
 assert.equal(calls[1][1].p_batch,'fixture-batch');
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
 const root=a.document.querySelector('#adminContent');
 assert.deepEqual([...root.children].slice(0,4).map(el=>el.hasAttribute('data-admin-signups')?'cadastros':
  el.hasAttribute('data-admin-audience')?'público':el.className),['stats','cadastros','público','two-cols']);
 assert.match(root.querySelector('[data-admin-audience]').textContent,/Estatísticas de público.*Dados insuficientes/s);
 const toast=a.document.querySelector('[data-signup-notice]');
 toast.querySelector('button').click();
 a.advance(200);
 assert.equal(toast.isConnected,false);
 assert.equal(a.timers.filter(timer=>timer.active&&timer.delay===100).length,0);
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
 const report=a.document.querySelector('[data-engagement-report]');
 assert.match(report.textContent,/Engajamento por funcionalidade.*Sessões8.*Mediana1 min 0 s/s);
 assert.match(report.textContent,/83% avançaram.*17% de abandono/);
 assert.match(report.querySelector('ol li:last-child').textContent,/Salvou pesagem · —/);
 assert.equal(report.querySelector('select[name=second] option[value=evolucao]').textContent,'Evolução');
});
