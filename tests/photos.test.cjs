const {test}=require('node:test'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom'),{indexedDB}=require('fake-indexeddb'),fs=require('fs'),vm=require('vm'),C=require('../dist/core.js');
function app(cloud={configured:false,init:async()=>null}){const {document}=parseHTML(fs.readFileSync('dist/index.html','utf8'));const ctx={window:null,document,indexedDB,NeoCore:C,NeoCloud:cloud,NEO_CONFIG:{providers:{}},localStorage:{getItem:()=>null},location:{hash:'',protocol:'file:',href:'file:///index.html'},navigator:{onLine:true},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval(){},setTimeout(){},clearTimeout(){},addEventListener(){},console,URL,Blob,Date,Number,String,JSON};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),ctx);const run=code=>vm.runInContext(code,ctx);run.document=document;return run}
test('fotos locais: IndexedDB preserva Blob, exporta e exclui individualmente',async()=>{const run=app();await run(`photoStore('put',{id:'p1',date:C.today(),role:'progress',blob:new Blob(['private-image'],{type:'image/jpeg'})})`);const rows=await run("photoStore('all')");assert.equal(rows.length,1);assert.equal(await rows[0].blob.text(),'private-image');await run("photoStore('put',{id:'p2',date:C.today(),role:'progress',blob:new Blob(['other'],{type:'image/jpeg'})})");await run("photoStore('delete','p1')");const left=await run("photoStore('all')");assert.equal(left.length,1);assert.equal(left[0].id,'p2');await run("photoStore('delete','p2')")});

test('históricos recolhidos agrupam por dia e não incluem src de mídia',()=>{
 const run=app();
 const html=run(`photoList=[
  {id:'b',date:'2026-02-02',role:'progress'},
  {id:'a',date:'2026-02-01',role:'progress'},
  {id:'p',date:'2026-01-01',role:'avatar'}
 ];photosPage()`);
 const {document}=parseHTML('<main>'+html+'</main>');
 assert.equal(document.querySelectorAll('details').length,2);
 assert.equal(document.querySelectorAll('[data-photo-comparison] input[type=range]').length,2);
 assert.equal(document.querySelectorAll('[data-photo-variant=original]').length,0);
 assert.equal(document.querySelectorAll('details[open]').length,0);
 assert.equal(document.querySelectorAll('[data-photo-media][src]').length,0);
 assert.deepEqual([...document.querySelectorAll('[data-photo-section=progress] [data-photo-open]')].map(x=>x.dataset.photoOpen),['a','b']);
 assert.match(document.querySelector('.compare').textContent,/Antes.*Depois/s);
});

test('lote de dez limita a dois envios, conserva IDs e repete somente os dois erros',async()=>{
 const run=app();
 const outcomes=await run(`(async()=>{
  const items=Array.from({length:10},(_,i)=>({id:i,status:'pending'}));
  let active=0,max=0;
  const tried=[];
  await runPhotoBatch(items,async item=>{
   tried.push(item.id);max=Math.max(max,++active);await Promise.resolve();active--;
   if(item.id===2||item.id===7)throw Error('conexão interrompida');
  },()=>{});
  const failed=items.filter(item=>item.status==='failed');
  await runPhotoBatch(failed,async item=>{tried.push(item.id)},()=>{});
  return JSON.stringify({max,tried,completed:items.filter(item=>item.status==='sent').length});
 })()`);
 const {max,tried,completed}=JSON.parse(outcomes);
 assert.equal(max,2);
 assert.equal(completed,10);
 assert.deepEqual(tried,[0,1,2,3,4,5,6,7,8,9,2,7]);
});

test('restauração de sessão evita exibir o formulário enquanto a promessa está pendente', async()=>{
 let finish;
 const run=app({configured:true,init:()=>new Promise(resolve=>{finish=resolve})});
 assert.match(run.document.getElementById('content').textContent,/Verificando sua sessão/);
 assert.equal(run.document.querySelector('#authForm'),null);
 finish(null);
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(run.document.querySelector('#authForm'));
});

test('seleção aceita uma foto ou várias e exibe o progresso sem depender de captura',()=>{
 const run=app();
 run.document.getElementById('dialog').showModal=()=>{};
 run("openRecord('photo')");
 assert.ok(run.document.querySelector('input[name=photo]').hasAttribute('multiple'));
 assert.equal(run.document.querySelector('#saveRecord').disabled,true);
 assert.match(run.document.querySelector('#photoBatchTotal').textContent,/0 selecionadas/);
});

test('seleções sucessivas acrescentam prévias e fechar antes do envio limpa o lote',async()=>{
 const run=app();
 const dialog=run.document.getElementById('dialog');
 dialog.showModal=()=>{};
 run("openRecord('photo')");
 const input=run.document.querySelector('input[name=photo]');
 const file=(name)=>Object.assign(new Blob(['not a JPEG'],{type:'image/jpeg'}),{name,lastModified:1});
 const choose=(files)=>{
  Object.defineProperty(input,'files',{value:files,configurable:true});
  input.dispatchEvent(new run.document.defaultView.Event('change',{bubbles:true}));
 };
 choose([file('uma.jpg')]);
 choose([file('duas.jpg'),file('tres.jpg')]);
 assert.equal(run.document.querySelectorAll('#photoBatchList img').length,3);
 assert.match(run.document.querySelector('#photoBatchTotal').textContent,/3 selecionadas/);
 run.document.querySelector('[data-photo-batch-remove]').dispatchEvent(new run.document.defaultView.Event('click',{bubbles:true}));
 assert.equal(run('photoBatch.length'),2);
 dialog.dispatchEvent(new run.document.defaultView.Event('close'));
 assert.equal(run('photoBatch.length'),0);
});

test('nuvem lista metadados, assina apenas a variante pedida e recupera retentativa sem duplicar',async()=>{
 const account={id:'fixture-owner'},calls=[],objects=new Set(),rows=new Map();
 const bucket={
  async upload(key){calls.push(['upload',key]);if(objects.has(key))return {error:{statusCode:'409',message:'Duplicate'}};objects.add(key);return {data:{}}},
  async createSignedUrl(key){calls.push(['sign',key]);return objects.has(key)?{data:{signedUrl:'https://example.invalid/fixture'}}:{error:{statusCode:'404',message:'Object not found'}}}
 };
 let failOnce=true;
 const sdk={auth:{onAuthStateChange(){},async getSession(){return {data:{session:{user:account}}}},async getUser(){return {data:{user:account}}}},
  storage:{from(){return bucket}},
  from(table){assert.equal(table,'neo_photos');let filter;
   return {select(){return this},eq(name,value){if(name==='id')filter=value;else assert.equal(value,account.id);return this},
    order(){return this},async range(){return {data:[...rows.values()]}},async maybeSingle(){return {data:rows.get(filter)||null}},
    async insert(row){if(failOnce){failOnce=false;return {error:{message:'interrompido'}}}rows.set(row.id,row);return {data:null}}
   };
  }
 };
 const ctx={window:null,NeoCore:C,NEO_CONFIG:{supabaseUrl:'https://project.supabase.co',supabasePublishableKey:'sb_publishable_fixture'},
  createClient:()=>sdk,URL,setTimeout};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync('src/cloud.js','utf8').replace(/^import[^\n]*\n/,''),ctx);
 const cloud=ctx.NeoCloud;
 await cloud.init(()=>{});
 vm.runInContext("consents=[{purpose:'health',version:'2026-11-v1',granted:true},{purpose:'terms',version:'2026-11-v1',granted:true},{purpose:'photos',version:'2026-11-v1',granted:true}]",ctx);
 const id='00000000-0000-4000-8000-000000000001',blob=new Blob(['fixture'],{type:'image/jpeg'});
 await assert.rejects(cloud.uploadProgressPhoto(blob,blob,'2026-01-01',id,blob),/interrompido/);
 await cloud.uploadProgressPhoto(blob,blob,'2026-01-01',id,blob);
 await cloud.uploadProgressPhoto(blob,blob,'2026-01-01',id,blob);
 assert.equal(rows.size,1);assert.equal(objects.size,3);
 const [photo]=await cloud.photos();
 assert.ok(!calls.some(([action])=>action==='sign'));
 assert.equal(await cloud.photoURL({path:account.id+'/legacy.jpg'},'thumbnail'),null);
 await cloud.photoURL(photo,'thumbnail');
 await cloud.photoURL(photo,'preview');
 assert.deepEqual(calls.filter(([action])=>action==='sign').map(([,key])=>key),[account.id+'/legacy.jpg.thumb.jpg',photo.path+'.thumb.jpg',photo.path+'.preview.jpg']);
 await assert.rejects(cloud.photoURL({path:'another-account/image.jpg'},'original'),/nesta conta/);
});

test('sugere somente a data de captura EXIF válida do JPEG',async()=>{
 const run=app();
 const exif=Buffer.alloc(70);
 exif.write('Exif\0\0',0);
 exif.write('II',6);
 exif.writeUInt16LE(42,8);
 exif.writeUInt32LE(8,10);
 exif.writeUInt16LE(1,14);
 exif.writeUInt16LE(0x8769,16);exif.writeUInt16LE(4,18);
 exif.writeUInt32LE(1,20);exif.writeUInt32LE(26,24);
 exif.writeUInt16LE(1,32);
 exif.writeUInt16LE(0x9003,34);exif.writeUInt16LE(2,36);
 exif.writeUInt32LE(20,38);exif.writeUInt32LE(44,42);
 const jpeg=stamp=>{
  exif.write(stamp+'\0',50);
  return [...Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe1,0,72]),exif,Buffer.from([0xff,0xd9])])];
 };
 assert.equal(await run('captureDate(new Blob([new Uint8Array('+JSON.stringify(jpeg('2026:01:02 12:34:56'))+')]))'),'2026-01-02');
 assert.equal(await run('captureDate(new Blob([new Uint8Array('+JSON.stringify(jpeg('2026:02:31 12:34:56'))+')]))'),null);
});

test('sliders ficam limitados à data e a seleção é compartilhada com o Início',()=>{
 const run=app();
 run(`page='fotos';photoList=[
  {id:'third',date:'2026-02-03',role:'progress'},
  {id:'second',date:'2026-02-02',role:'progress',created_at:'2026-02-02T15:00:00Z'},
  {id:'first',date:'2026-02-02',role:'progress',created_at:'2026-02-02T12:00:00Z'}
 ];document.querySelector('#content').innerHTML=photosPage();hydratePhotoImages()`);
 const before=run.document.querySelector('[data-photo-slider=Antes]');
 const after=run.document.querySelector('[data-photo-slider=Depois]');
 assert.equal(before.max,'1');
 assert.equal(after.disabled,true);
 before.value='1';
 before.dispatchEvent(new run.document.defaultView.Event('input',{bubbles:true}));
 assert.match(before.getAttribute('aria-valuetext'),/Foto 2 de 2/);
 assert.equal(before.style.getPropertyValue('--photo-progress'),'100%');
 assert.equal(before.closest('figure').querySelector('figcaption').textContent,'AntesFoto 2 de 2');
 assert.equal(before.closest('figure').querySelector('[data-photo-date]').getAttribute('aria-label'),'Data Antes');
 assert.doesNotMatch(before.closest('figure').textContent,/Antes · Data/);
 assert.equal(before.closest('figure').querySelector('[data-photo-open]').dataset.photoOpen,'second');
 assert.equal(after.closest('figure').querySelector('[data-photo-open]').dataset.photoOpen,'third');
 run("page='inicio';document.querySelector('#content').innerHTML=overview();setHomeDetails(true)");
 assert.match(run.document.querySelector('[data-photo-slider=Antes]').getAttribute('aria-valuetext'),/Foto 2 de 2/);
 assert.equal(run.document.querySelector('[data-photo-comparison] [data-photo-open]'),null);
 const select=run.document.querySelector('[data-photo-side="0"] [data-photo-date]');
 const choices=[...select.querySelectorAll('option')];
 assert.deepEqual(choices.map(option=>option.value),['2026-02-02','2026-02-03']);
 choices[0].removeAttribute('selected');choices[1].setAttribute('selected','');
 select.dispatchEvent(new run.document.defaultView.Event('change',{bubbles:true}));
 const updated=run.document.querySelector('[data-photo-slider=Antes]');
 assert.equal(updated.disabled,true);
 assert.match(updated.getAttribute('aria-valuetext'),/Foto 1 de 1/);
});

test('Início mostra exemplos locais sem datas e troca por uma foto sem duplicar registros',()=>{
 const run=app();
 const example=run('comparisonCard(true)');
 assert.equal((example.match(/Exemplo/g)||[]).length,2);
 assert.match(example,/Adicionar minhas fotos/);
 assert.doesNotMatch(example,/type="range"|data-photo-date/);
 const single=run("photoList=[{id:'single',date:C.today(),role:'progress'}];comparisonCard(true)");
 assert.equal((single.match(/Exemplo/g)||[]).length,1);
 assert.match(single,/Adicionar foto de outro dia/);
 assert.equal((single.match(/data-photo-side=/g)||[]).length,1);
});

test('o visualizador mantém as ações disponíveis enquanto a foto carrega e confirma a exclusão',async()=>{
 const run=app();
 const create=run.document.createElement.bind(run.document);
 run.document.createElement=(tag)=>{
  const el=create(tag);
  if(tag==='dialog'){
   el.showModal=()=>el.setAttribute('open','');
   el.close=()=>{el.removeAttribute('open');el.dispatchEvent(new run.document.defaultView.Event('close'))};
  }
  return el;
 };
 run(`photoList=[{id:'private',date:C.today(),role:'progress'}];
 photoSource=()=>new Promise(()=>{});confirm=()=>{window.confirmed=true;return false};void showPhoto('private')`);
 const dialog=run.document.querySelector('#photoViewer');
 assert.equal(dialog.querySelector('button[autofocus]').textContent,'Fechar');
 assert.equal(dialog.querySelector('[data-photo-export]').textContent,'Download');
 assert.equal(dialog.querySelector('[role=status]').textContent,'Carregando foto…');
 dialog.querySelector('[data-photo-delete]').dispatchEvent(new run.document.defaultView.Event('click',{bubbles:true}));
 await new Promise(setImmediate);
 assert.equal(run('window.confirmed'),true);
 assert.equal(run('photoList.length'),1);
 dialog.close();
 assert.equal(run.document.querySelector('#photoViewer'),null);
});

test('fila de miniaturas usa até dois pedidos e descarta resultado atrasado ao trocar de dia',async()=>{
 const run=app();
 run(`page='fotos';photoList=Array.from({length:100},(_,i)=>({
  id:'photo-'+i,date:i<50?'2026-02-01':'2026-02-02',role:'progress',created_at:String(i).padStart(3,'0')
 }));
 document.querySelector('#content').innerHTML=photosPage();
 window.observed=[];
 window.requests=[];
 window.IntersectionObserver=class{
  constructor(callback){window.deliverEntries=callback}
  disconnect(){}
  observe(target){window.observed.push(target)}
  unobserve(){}
 };
 photoSource=(photo,variant)=>new Promise(resolve=>window.requests.push({photo,variant,resolve}));
 window.fetch=async()=>({ok:true,blob:async()=>new Blob(['thumb'])});
 hydratePhotoImages();
 window.deliverEntries([{isIntersecting:true,target:window.observed[0]}]);
 `);
 assert.equal(run('window.observed.length'),2);
 assert.equal(run('window.requests.length'),2);
 assert.equal(run("window.requests.map(r=>r.photo.date).join(',')"),'2026-02-01,2026-02-01');
 const select=run.document.querySelector('[data-photo-side="0"] [data-photo-date]');
 const options=select.querySelectorAll('option');
 options[0].removeAttribute('selected');options[1].setAttribute('selected','');
 select.dispatchEvent(new run.document.defaultView.Event('change',{bubbles:true}));
 run("window.requests[0].resolve('stale');window.requests[1].resolve('stale')");
 await new Promise(setImmediate);
 assert.equal(run('window.requests.length'),4);
 assert.equal(run("window.requests[2].photo.date"),'2026-02-02');
 assert.equal(run("window.requests[2].photo.id"),'photo-50');
 assert.ok(run("window.requests.every(r=>r.variant==='preview')"));
 assert.equal(run.document.querySelectorAll('details img[src]').length,0);
 assert.equal(run.document.querySelector('[data-photo-side="0"] img').hasAttribute('src'),false);
 run("window.requests[2].resolve('current')");
 await new Promise(setImmediate);
 assert.match(run.document.querySelector('[data-photo-side="0"] img').getAttribute('src'),/^blob:/);
});

test('miniaturas prontas são reutilizadas e foto antiga nunca recorre ao original',async()=>{
 const run=app();
 const result=await run(`(async()=>{
  let calls=0,downloads=0;
  photoSource=async(photo,variant)=>{
   if(variant!=='thumbnail')throw Error('A comparação pediu um original.');
   calls++;
   return photo.id==='legacy'?null:'https://example.invalid/thumb';
  };
  window.fetch=async()=>{downloads++;return {ok:true,blob:async()=>new Blob(['thumb'])}};
  const photo={id:'current'},legacy={id:'legacy'};
  const [first,second]=await Promise.all([warmPhotoThumb(photo,()=>true),warmPhotoThumb(photo,()=>true)]);
  const again=await warmPhotoThumb(photo,()=>true);
  const unavailable=await warmPhotoThumb(legacy,()=>true);
  clearPhotoURLs();
  return JSON.stringify({calls,downloads,reused:first===second&&first===again,unavailable,cache:comparisonThumbs.size});
 })()`);
 assert.deepEqual(JSON.parse(result),{calls:2,downloads:1,reused:true,unavailable:null,cache:0});
});

test('a comparação do Início pertence ao acompanhamento e Ver fotos usa a navegação existente',()=>{
 const run=app();
 run("page='inicio';document.querySelector('#content').innerHTML=overview()");
 const details=run.document.getElementById('homeJourneyDetails');
 const card=run.document.querySelector('[data-photo-comparison]');
 assert.equal(details.contains(card),true);
 assert.equal(details.hidden,true);
 assert.equal(card.querySelector('[data-go=fotos]').textContent,'Ver fotos');
 assert.equal(run.document.querySelectorAll('[data-photo-comparison]').length,1);
 run('setHomeDetails(true)');
 assert.equal(details.hidden,false);
 assert.equal(card.querySelectorAll('.photo-example').length,2);
});

test('layout reserva linhas fixas para seletores, fotos, legendas e sliders dos dois lados',()=>{
 const css=fs.readFileSync('dist/style.css','utf8');
 assert.match(css,/grid-template-rows:var\(--comparison-date-height\) auto var\(--comparison-caption-height\) 44px/);
 assert.match(css,/\.comparison-slider-slot,\.comparison-slider-spacer\{min-height:44px/);
 assert.match(css,/\.photo-comparison \.comparison-preview img\{[^}]*object-fit:contain/);
 assert.match(css,/aspect-ratio:9\/16/);
 assert.match(css,/::-webkit-slider-thumb/);
 assert.match(css,/::-moz-range-thumb/);
});

test('prévia legada recorre à miniatura privada e nunca lê o original',async()=>{
 const run=app();
 const result=await run(`(async()=>{
  const variants=[];
  photoSource=async(_,variant)=>{variants.push(variant);return variant==='thumbnail'?'thumb':null};
  window.fetch=async()=>({ok:true,blob:async()=>new Blob(['thumb'])});
  await warmPhotoThumb({id:'legacy-preview'},()=>true,true,'preview');
  return JSON.stringify(variants);
 })()`);
 assert.deepEqual(JSON.parse(result),['preview','thumbnail']);
});

test('cache de prévias descarta as menos usadas ao passar do limite de memória',async()=>{
 const run=app();
 const result=await run(`(async()=>{
  photoSource=async()=> 'https://example.invalid/private-preview';
  window.fetch=async()=>({ok:true,blob:async()=>new Blob(['private'])});
  window.Image=class{constructor(){this.naturalWidth=800;this.naturalHeight=800}async decode(){}};
  for(let i=0;i<16;i++)await warmPhotoThumb({id:String(i)},()=>true,true,'preview');
  const report={size:comparisonThumbs.size,bytes:[...comparisonThumbs.values()].reduce((sum,item)=>sum+item.bytes,0),old:comparisonThumbs.has('0:preview'),last:comparisonThumbs.has('15:preview')};
  clearPhotoURLs();
  return JSON.stringify(report);
 })()`);
 const stats=JSON.parse(result);
 assert.ok(stats.bytes<=24*1024*1024);
 assert.ok(stats.size<16);
 assert.equal(stats.old,false);
 assert.equal(stats.last,true);
});

test('Início, Evolução e Fotos seguem o número de dias distintos em conta comum ou admin',()=>{
 for(const admin of [false,true]){
  const run=app({configured:false,init:async()=>null,admin});
  for(const screen of ['overview()','evolution()','photosPage()']){
   for(const rows of [[],[{id:'a',date:'2026-01-02',role:'progress'}],
    [{id:'a',date:'2026-01-02',role:'progress'},{id:'b',date:'2026-01-02',role:'progress'}],
    [{id:'a',date:'2026-01-02',role:'progress'},{id:'b',date:'2026-01-03',role:'progress'}]]){
    const {document}=parseHTML(run('comparisonSelection.fill(null);photoList='+JSON.stringify(rows)+';'+screen));
    const card=document.querySelector('[data-photo-comparison]');
    const dayCount=new Set(rows.map(photo=>photo.date)).size;
    assert.equal(card.querySelectorAll('.comparison-example').length,Math.max(0,2-dayCount));
    assert.equal(card.querySelectorAll('[data-photo-side]').length,dayCount);
    assert.equal(card.querySelector('.comparison-example [data-photo-date]'),null);
    if(dayCount===2){
     assert.equal(card.querySelector('[data-photo-side="0"] option[selected]').value,'2026-01-02');
     assert.equal(card.querySelector('[data-photo-side="1"] option[selected]').value,'2026-01-03');
    }
    if(screen==='evolution()')assert.equal(card.querySelector('[data-go=fotos]').textContent,'Ver fotos');
    if(screen==='photosPage()')assert.doesNotMatch(document.textContent||document.toString(),/os links expiram|Exporte-as individualmente/);
   }
  }
 }
});

test('comparação oferece composição em Início, Evolução e Fotos',()=>{
 const run=app();
 for(const page of ['homeJourneyDetails(false)','evolution()','photosPage()']){
  const {document}=parseHTML(run(page));
  const actions=document.querySelector('[data-photo-comparison] .comparison-card-actions');
  assert.match(actions.children[1].textContent,/Comparar e compartilhar/);
  assert.equal(actions.children[2].dataset.add,'photo');
 }
});

function exportFixture(cloud={}){
 const run=app(cloud),doc=run.document,draws=[],text=[],sizes=[],points=[],styles=[];
 const create=doc.createElement.bind(doc);
 doc.createElement=tag=>{
  const element=create(tag);
  if(tag==='dialog'){
   element.showModal=()=>{element.open=true};
   element.close=()=>{element.open=false};
  }
  if(tag==='canvas'){
   element.getContext=()=>({
    scale(){},fillRect(){},fillText(value,x,y){text.push(value);styles.push({value,y,font:this.font,alpha:this.globalAlpha})},
    beginPath(){},moveTo(x,y){points.push([x,y])},lineTo(x,y){points.push([x,y])},stroke(){},arc(){},fill(){},closePath(){},save(){},restore(){},setLineDash(){},
    createLinearGradient(){return {addColorStop(){}}},
    drawImage(image,...bounds){draws.push(bounds)}
   });
   element.toBlob=resolve=>{
    sizes.push([element.width,element.height]);
    resolve(new Blob(['fixture'],{type:'image/jpeg'}));
   };
  }
  return element;
 };
 run(`AbortController=class{
  constructor(){let listener;this.signal={aborted:false,addEventListener(_,f){listener=f},removeEventListener(){listener=null},cancel(){listener?.()}}}
  abort(){this.signal.aborted=true;this.signal.cancel()}
 };File=class extends Blob{constructor(parts,name,options){super(parts,options);this.name=name}};
 drawComparisonSource=async(source,signal,draw)=>{
  const kind=typeof source==='string'?'square':await source.text();
  if(!signal.aborted)draw({naturalWidth:kind==='landscape'?1600:800,naturalHeight:kind==='portrait'?1600:800});
 };
 document.body.insertAdjacentHTML('beforeend','<button id="exportTrigger">Comparar</button>');
 mode='cloud';demo=false;`);
 return {run,doc,draws,text,sizes,points,styles};
}
test('composição exporta só os dois originais selecionados, preserva proporções e usa o JPEG exibido',async()=>{
 const requests=[],{run,doc,draws,text,sizes,points,styles}=exportFixture({
  configured:false,init:async()=>null,user:{id:'owner'},
  async photoBlob(photo){requests.push(photo.id);return new Blob([photo.id])}
 });
 await run(`
  window.getComputedStyle=()=>({fontFamily:'"Teste Sans", sans-serif'});
  const loadedFonts=[];
  document.fonts={load:font=>{loadedFonts.push(font);return Promise.resolve()}};
  state.weights=[
   {date:'2026-01-03',value:250},{date:'2026-01-02',value:78},
   {date:'2025-12-31',value:310},{date:'2026-01-01',value:80}
  ];
  photoList=[
   {id:'skip',date:'2026-01-01',user_id:'owner',path:'owner/skip.jpg'},
   {id:'portrait',date:'2026-01-01',user_id:'owner',path:'owner/p.jpg'},
   {id:'landscape',date:'2026-01-02',user_id:'owner',path:'owner/l.jpg'}
  ];
  comparisonCard(true);
  comparisonSelection[0]={day:'2026-01-01',id:'portrait'};
  showComparisonExport($('#exportTrigger'));
 `);
 assert.deepEqual(requests,['portrait','landscape']);
 assert.deepEqual(sizes,[[1080,1920]]);
 assert.deepEqual(draws.map(([, ,w,h])=>[w,h]),[[466,932],[466,233],[196,196]]);
 assert.deepEqual(draws.map(([,y,,h])=>y+h),[1450,1450,1438]);
 assert.ok(points[8][0]<points[9][0]&&points[8][1]<points[9][1]);
 assert.ok(text.includes('Evolução do Peso'));
 assert.ok(text.includes('Variação entre as fotos: −2,0 kg'));
 assert.ok(!text.some(label=>label==='250 kg'||label==='310 kg'));
 assert.ok(styles.every(style=>style.font.endsWith('"Teste Sans", sans-serif')));
 assert.equal(styles.find(style=>style.value==='NeoPep').alpha,.36);
 assert.ok(styles.find(style=>style.value==='NeoPep').y<1450);
 assert.equal(run('loadedFonts.length'),2);
 assert.equal(doc.querySelector('[data-export-save]').href,doc.querySelector('.comparison-export-media img').src);
 assert.equal(doc.querySelector('[data-export-share]').disabled,false);
 assert.doesNotMatch(doc.querySelector('#comparisonExport').textContent,/Premium|Sem marca/);
 let saved=0;
 doc.querySelector('[data-export-save]').addEventListener('click',()=>saved++);
 run(`navigator.canShare=()=>false;$('#comparisonExport [data-export-share]').click()`);
 assert.equal(saved,1);
 assert.equal(run(`navigator.canShare=()=>true;navigator.share=({files})=>navigator.shared=files[0].name;
  $('#comparisonExport [data-export-share]').click();navigator.shared`),'NeoPep-Antes-e-Depois.jpg');
 run('clearPhotoURLs()');
 assert.equal(doc.querySelector('#comparisonExport'),null);
});
test('composição bloqueia exemplos, recusa foto de outra conta e limita a resolução',async()=>{
 const requests=[],{run,doc,text,sizes}=exportFixture({
  configured:false,init:async()=>null,user:{id:'owner'},
  async photoBlob(photo){requests.push(photo.id);return new Blob(['square'])}
 });
 await run(`navigator.deviceMemory=4;
  photoList=[{id:'mine',date:'2026-02-01',user_id:'owner',path:'owner/m.jpg'},
    {id:'other',date:'2026-02-02',user_id:'other',path:'other/o.jpg'}];
  comparisonCard(false);
  showComparisonExport($('#exportTrigger'));
 `);
 assert.deepEqual(requests,['mine']);
 assert.deepEqual(sizes,[[720,1280]]);
 assert.ok(text.includes('Exemplo'));
 assert.ok(text.includes('Registros insuficientes no período.'));
 assert.equal(doc.querySelector('[data-export-save]').hidden,true);
 assert.equal(doc.querySelector('[data-export-share]').disabled,true);
 run("$('#comparisonExport').dispose()");
 await run(`photoList=[];comparisonCard(false);showComparisonExport($('#exportTrigger'))`);
 assert.deepEqual(requests,['mine']);
 assert.equal(doc.querySelector('[data-export-share]').disabled,true);
 run("$('#comparisonExport').dispose()");
 await run(`photoList=[{id:'alone',date:'2026-02-03',user_id:'owner',path:'owner/a.jpg'}];
  comparisonCard(false);showComparisonExport($('#exportTrigger'))`);
 assert.deepEqual(requests,['mine','alone']);
 assert.equal(doc.querySelector('[data-export-share]').disabled,true);
 run("$('#comparisonExport').dispose()");
});

test('dias iguais bloqueiam exportação e fechar durante o download interrompe o preparo',async()=>{
 const requests=[];
 let finish;
 const {run,doc}=exportFixture({
  configured:false,init:async()=>null,user:{id:'owner'},
  photoBlob(photo){
   requests.push(photo.id);
   return photo.id==='pending'?new Promise(resolve=>{finish=resolve}):Promise.resolve(new Blob(['square']));
  }
 });
 await run(`
  photoList=[{id:'a',date:'2026-02-01',user_id:'owner',path:'owner/a.jpg'},
    {id:'pending',date:'2026-02-02',user_id:'owner',path:'owner/b.jpg'}];
  comparisonCard(false);
  comparisonSelection[1]={...comparisonSelection[0]};
  showComparisonExport($('#exportTrigger'));
 `);
 assert.equal(doc.querySelector('[data-export-share]').disabled,true);
 run("$('#comparisonExport').dispose();comparisonSelection[0]={day:'2026-02-02',id:'pending'}");
 const loading=run("showComparisonExport($('#exportTrigger'))");
 run('clearPhotoURLs()');
 finish(new Blob(['square']));
 await loading;
 assert.deepEqual(requests,['a','a','pending']);
 assert.equal(doc.querySelector('#comparisonExport'),null);
});

test('variação usa dias exatos, última pesagem, unidade e histórico quando faltar pesagem',()=>{
 const {run}=exportFixture({configured:false,init:async()=>null,user:{id:'owner'}});
 const result=code=>JSON.parse(run(`JSON.stringify(${code})`));
 run(`const a={date:'2026-01-01'},b={date:'2026-01-02'},c={date:'2026-01-03'},d={date:'2026-01-04'};
 state.weights=[
  {date:b.date,value:80,updated_at:'2026-01-02T15:00:00Z'},
  {date:b.date,value:83,updated_at:'2026-01-02T12:00:00Z'},
  {date:a.date,value:82},
  {date:c.date,value:80}
 ];`);
 assert.equal(result('comparisonWeight([a,b])').display,'−2,0 kg');
 assert.equal(result('comparisonWeight([b,a])').display,'+2,0 kg');
 assert.equal(result('comparisonWeight([b,c])').display,'0,0 kg');
 assert.equal(result('comparisonWeight([null,c])').type,'none');
 assert.equal(result('comparisonWeight([a,d])').type,'total');
 assert.equal(result("comparisonWeight([d,{date:'2026-01-05'}])").rows.length,3);
 run("state.profile.units='imperial';state.profile.initialWeight=84");
 const total=result('comparisonWeight([d,c])');
 assert.equal(total.display,'−8,8 lb');
 assert.equal(total.reference,84);
 assert.equal(total.references[0].origin,'profile');
 run('state.weights=[]');
 assert.equal(result('comparisonWeight([a,b])').type,'none');
});

test('indicador atualiza ao mudar datas e o modal preserva a variação enquanto prepara o JPEG',async()=>{
 let finish;
 const requests=[],{run,doc,text}=exportFixture({
  configured:false,init:async()=>null,user:{id:'owner'},
  photoBlob(photo){requests.push(photo.id);return photo.id==='b'?new Promise(resolve=>{finish=resolve}):new Blob(['square'])}
 });
 const request=run(`
  photoList=['a','b','c'].map((id,i)=>({id,date:'2026-01-0'+(i+1),user_id:'owner',path:'owner/'+id+'.jpg'}));
  state.weights=photoList.map((p,i)=>({date:p.date,value:80-i}));
  document.body.insertAdjacentHTML('beforeend',comparisonCard(false));
  const before=document.querySelector('[data-photo-side="0"]');
  paintComparison(before,'2026-01-02',0);
  paintComparison(before,'2026-01-01',0);
  paintComparison(before,'2026-01-02',0);
  showComparisonExport(document.querySelector('[data-comparison-export]'));
 `);
 assert.match(doc.querySelector('[data-comparison-weight]').textContent,/−1,0 kg/);
 run("paintComparison(before,'2026-01-01',0);state.weights=[]");
 finish(new Blob(['square']));
 await request;
 assert.deepEqual(requests,['b','c']);
 assert.ok(text.includes('Variação entre as fotos: −1,0 kg'));
 assert.ok(text.includes('02/01/2026 a 03/01/2026'));
});
