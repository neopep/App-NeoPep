const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/core.js');
const d=C.today();
test('regressão de cálculo validada: 10 mg / 2 mL e 2,5 mg = 0,5 mL / 50 U-100',()=>{const r=C.convertDose(10,2,2.5,'mg',1);assert.equal(r.concentration,5);assert.equal(r.ml,.5);assert.equal(r.units,50);assert.equal(r.doses,4);assert.equal(r.warning,'')});
test('conversão mcg e limites matemáticos',()=>{assert.equal(C.convertDose(10,2,2500,'mcg',1).units,50);assert.match(C.convertDose(10,2,20,'mg',1).warning,/conteúdo/);assert.match(C.convertDose(10,2,2.5,'mg',.3).warning,/capacidade/);assert.match(C.convertDose(10,2,.001,'mg',1).warning,/Menos/);for(const n of [0,-1,Infinity,NaN])assert.throws(()=>C.convertDose(n,2,1,'mg',1));assert.throws(()=>C.convertDose(1e308,1e-308,1,'mg',1));assert.throws(()=>C.convertDose(10,2,1,'g',1))});
test('datas reais e anos bissextos',()=>{assert.equal(C.validDate('2024-02-29'),true);for(const date of ['2025-02-29','2026-02-30','2026-13-01','12/11/2026','x'])assert.equal(C.validDate(date),false)});
test('backup legado continua compatível sem alterar original',()=>{const old={weights:[{id:1,date:d,value:80,note:'Legado'}],measures:[],doses:[],settings:{weightTime:'08:00',measureTime:'09:00',measureDay:'1'}};const raw=JSON.stringify(old),v=C.validateBackup(old);assert.equal(JSON.stringify(old),raw);assert.equal(v.weights[0].value,80);assert.equal(v.weights[0].id,'1');assert.deepEqual(v.journal,[])});
test('importação aditiva é idempotente e preserva perfil',()=>{const a=C.blank(),b=C.blank();a.profile.name='Original';b.profile.name='Outro';b.weights.push({id:'a',date:d,value:80,note:''});let m=C.merge(a,b);assert.equal(m.added,1);assert.equal(m.data.profile.name,'Original');m=C.merge(m.data,b);assert.equal(m.added,0);assert.equal(m.skipped,1);assert.equal(m.data.weights.length,1)});
test('colisão de ids não sobrescreve registros diferentes',()=>{const a=C.blank(),b=C.blank();a.weights=[{id:'same',date:d,value:80}];b.weights=[{id:'same',date:d,value:81}];const m=C.merge(a,b);assert.equal(m.data.weights.length,2);assert.notEqual(m.data.weights[0].id,m.data.weights[1].id)});
test('backup rejeita datas e números inválidos antes de modificar estado',()=>{for(const r of [{id:'x',date:'2026-02-30',value:80},{id:'x',date:d,value:-1},{id:'x',date:d,value:NaN},{id:'<script>',date:d,value:80}])assert.throws(()=>C.validateBackup({...C.blank(),weights:[r]}));assert.throws(()=>C.validateBackup({...C.blank(),settings:{weightTime:'25:00'}}))});
test('dashboard: IMC, meta para perda e ganho e janela temporal',()=>{const s=C.blank();s.profile.height=200;s.profile.initialWeight=100;s.profile.goal=80;s.weights=[{id:'1',date:d,value:90}];let m=C.metrics(s);assert.equal(m.bmi,22.5);assert.equal(m.progress,50);assert.equal(m.days,1);s.profile.goal=120;s.weights[0].value=110;assert.equal(C.metrics(s).progress,50);const old=new Date();old.setDate(old.getDate()-10);s.weights.push({id:'2',date:C.today(old),value:100});assert.equal(C.periodRows(s.weights,7).length,1)});
test('dados fictícios ficam em objeto separado',()=>{const a=C.blank(),b=C.demoState();b.weights[0].value=200;assert.equal(a.weights.length,0);assert.equal(C.demoState().weights[0].value,84.2);assert.equal(b.profile.name,'Alex')});
test('CSV evita fórmulas e inclui diário',()=>{const s=C.blank();s.weights.push({id:'1',date:d,value:80,note:'=HYPERLINK("x")'});s.journal.push({id:'2',date:d,note:'Olá',sleep:7});const csv=C.exportCsv(s);assert.match(csv,/'=HYPERLINK/);assert.match(csv,/Diário/);assert.match(csv,/Sono h/)});
test('agenda tem eventos recorrentes e alerta sem prefixos Elo',()=>{const ics=C.calendar(C.blank());assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,/RRULE:FREQ=DAILY/);assert.match(ics,/RRULE:FREQ=WEEKLY/);assert.match(ics,/BEGIN:VALARM/);assert.ok(!ics.includes('Elo'));assert.match(ics,/NeoPeptídeos/)});
test('escaping de dados protege HTML',()=>assert.equal(C.escape('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;'));
test('chaves administrativas nunca são aceitas como chave pública Supabase',()=>{assert.equal(C.isPublicSupabaseKey('sb_publishable_example'),true);assert.equal(C.isPublicSupabaseKey('sb_secret_private'),false);const jwt=role=>'header.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';assert.equal(C.isPublicSupabaseKey(jwt('anon')),true);assert.equal(C.isPublicSupabaseKey(jwt('service_role')),false);assert.equal(C.isPublicSupabaseKey('anything'),false)});
test('preferências de acompanhamento respeitam os lembretes sem excluir módulos',()=>{const s=C.blank();s.profile.tracking.weight=false;s.profile.tracking.measures=false;assert.equal(C.nextReminders(s).length,0);assert.ok(Array.isArray(s.weights));const legacy=C.validateBackup({weights:[],measures:[],doses:[]});assert.equal(legacy.profile.tracking.weight,true)});

test('novas preferências completas não concedem consentimento nem substituem escolhas salvas',()=>{const p=C.profile();assert.equal(Object.values(p.tracking).every(Boolean),true);assert.equal(p.consent,false);const saved=C.profile({...p,tracking:{weight:false,measures:false,journal:false,photos:false,applications:false}});assert.equal(Object.values(saved.tracking).every(v=>v===false),true)});

test('preferência do guia sobrevive à validação e tem padrão ativo em dados antigos',()=>{assert.equal(C.validateBackup({settings:{showArrivalGuide:false}}).settings.showArrivalGuide,false);assert.equal(C.validateBackup({settings:{}}).settings.showArrivalGuide,true);assert.throws(()=>C.validateBackup({settings:{showArrivalGuide:'false'}}));});

test('jornada preserva marco zero e desenha movimento contrário à esquerda',()=>{
 for(const [initial,goal,current] of [[100,80,105],[100,120,95]]){
  const j=C.weightJourney({initial,goal,current});
  assert.equal(j.percent,-25);assert.equal(j.away,true);assert.ok(j.position<j.zero);
  assert.equal(j.fillStart,j.position);assert.equal(j.fillWidth,j.zero-j.position);
  assert.equal(j.kind,goal>initial?'gain':'loss');
 }
 for(const [goal,current] of [[80,90],[120,110]]){
  const j=C.weightJourney({initial:100,goal,current});assert.equal(j.percent,50);
  assert.equal(j.zero,0);assert.equal(j.position,50);assert.equal(j.away,false);
 }
 assert.equal(C.weightJourney({initial:100,goal:80,current:75}).percent,100);
 assert.equal(C.weightJourney({initial:100,goal:80,current:null}).percent,null);
 assert.equal(C.weightJourney({initial:100,goal:100,current:100}).kind,'maintain');
 const s=C.blank();s.profile=C.profile({...s.profile,initialWeight:70,goal:80});
 assert.equal(s.profile.goal,80);
});

test('pendências diárias acompanham registros, dia configurado, pausas e recorrência',()=>{
 const s=C.blank(),now=new Date('2026-11-14T12:00:00'),date=C.today(now);
 s.settings.measureDay='6';s.reminders=[{id:'d',title:'Aplicação semanal',date:'2026-11-07',repeat:'weekly',weekday:6,enabled:true}];
 assert.deepEqual(C.pendingDailyRecords(s,now).map(r=>r.kind),['weight','measure','dose']);
 s.weights=[{date,value:80}];s.measures=[{date,waist:90}];s.doses=[{date,product:'Produto'}];
 assert.equal(C.pendingDailyRecords(s,now).length,0);
 s.weights=[{date:'2026-11-13',value:80}];s.measures=[];s.doses=[];s.settings.measureDay='1';s.reminders[0].weekday=1;
 assert.deepEqual(C.pendingDailyRecords(s,now).map(r=>r.kind),['weight']);
 s.settings.measureDay='6';s.reminders[0].weekday=6;s.reminders[0].enabled=false;
 assert.deepEqual(C.pendingDailyRecords(s,now).map(r=>r.kind),['weight','measure']);
 s.profile.tracking.weight=false;s.profile.tracking.measures=false;
 assert.equal(C.pendingDailyRecords(s,now).length,0);
 s.reminders[0]={title:'Dose',date:'2026-11-15',repeat:'daily',enabled:true};assert.equal(C.pendingDailyRecords(s,now).length,0);
 s.reminders[0].date='2026-11-14';assert.equal(C.pendingDailyRecords(s,now)[0].kind,'dose');
 s.reminders[0].repeat='once';s.reminders[0].date='2026-11-13';assert.equal(C.pendingDailyRecords(s,now).length,0);
});

test('tipo associado ao lembrete sobrevive à validação e permite título livre',()=>{
 const r=C.validRecord('reminders',{id:'dose-schedule',date:C.today(),title:C.reminderTitle('dose','Meu cuidado semanal'),time:'09:00',repeat:'weekly',weekday:new Date().getDay(),enabled:true});
 assert.equal(C.reminderRecordKind(r),'dose');
 assert.equal(C.reminderTitle('dose',r.title),r.title);
 assert.equal(C.reminderRecordKind({title:C.reminderTitle('general','Conversar sobre a dose')}),'');
 const s=C.blank();s.profile.tracking.weight=false;s.profile.tracking.measures=false;s.reminders=[r];
 assert.equal(C.pendingDailyRecords(C.validateBackup(s))[0].kind,'dose');
});

test('orientação inicial de lembretes é persistida e validada separadamente do guia',()=>{
 assert.equal(C.validateBackup({settings:{}}).settings.reminderIntroSeen,false);
 const settings=C.validateBackup({settings:{reminderIntroSeen:true,showArrivalGuide:true}}).settings;
 assert.equal(settings.reminderIntroSeen,true);assert.equal(settings.showArrivalGuide,true);
 assert.throws(()=>C.validateBackup({settings:{reminderIntroSeen:'true'}}));
});

test('convite de lembretes aparece somente ate uma decisao, preservando horario escolhido',()=>{
 const s=C.blank();assert.equal(C.shouldOfferReminderSetup(s,'2026-11-14'),true);
 s.settings.reminderSetupPromptDate='2026-11-14';
 assert.equal(C.shouldOfferReminderSetup(s,'2026-11-15'),true);
 s.settings.reminderIntroSeen=true;
 assert.equal(C.shouldOfferReminderSetup(s,'2026-11-14'),false);
 assert.equal(C.shouldOfferReminderSetup(s,'2026-11-15'),false);
 const copy=C.validateBackup(s);assert.equal(copy.settings.reminderSetupPromptDate,'2026-11-14');
 copy.settings.reminderScheduleConfigured=true;assert.equal(C.shouldOfferReminderSetup(copy,'2026-11-15'),false);
 s.settings.measureDay='3';assert.equal(C.shouldOfferReminderSetup(s,'2026-11-15'),false);
 s.settings.measureDay='1';s.reminders=[{id:'r'}];assert.equal(C.shouldOfferReminderSetup(s,'2026-11-15'),false);
 assert.throws(()=>C.validateBackup({settings:{reminderSetupPromptDate:'2026-02-30'}}));
 assert.throws(()=>C.validateBackup({settings:{reminderScheduleConfigured:'true'}}));
});

test('peso usa duas casas em pt-BR e exportação CSV sem mudar o valor original',()=>{
 const s=C.blank();
 s.weights=[{id:'one',date:d,value:111.1}];
 assert.equal(C.formatWeight(111.1),'111,10');
 assert.equal(C.formatWeight(-1.8),'-1,80');
 assert.equal(C.formatWeight(0),'0,00');
 assert.match(C.exportCsv(s),/"111,10"/);
 assert.equal(s.weights[0].value,111.1);
});
