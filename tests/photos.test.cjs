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
 await assert.rejects(cloud.uploadProgressPhoto(blob,blob,'2026-01-01',id),/interrompido/);
 await cloud.uploadProgressPhoto(blob,blob,'2026-01-01',id);
 await cloud.uploadProgressPhoto(blob,blob,'2026-01-01',id);
 assert.equal(rows.size,1);assert.equal(objects.size,2);
 const [photo]=await cloud.photos();
 assert.ok(!calls.some(([action])=>action==='sign'));
 assert.equal(await cloud.photoURL({path:account.id+'/legacy.jpg'},'thumbnail'),null);
 await cloud.photoURL(photo,'thumbnail');
 assert.deepEqual(calls.filter(([action])=>action==='sign').map(([,key])=>key),[account.id+'/legacy.jpg.thumb.jpg',photo.path+'.thumb.jpg']);
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

test('sliders independentes atualizam posição imediatamente, inclusive com datas iguais',()=>{
 const run=app();
 run(`photoList=[
  {id:'third',date:'2026-02-03',role:'progress'},
  {id:'second',date:'2026-02-02',role:'progress',created_at:'2026-02-02T15:00:00Z'},
  {id:'first',date:'2026-02-02',role:'progress',created_at:'2026-02-02T12:00:00Z'}
 ];document.querySelector('#content').innerHTML=photosPage()`);
 const before=run.document.querySelector('[data-photo-slider=Antes]');
 const after=run.document.querySelector('[data-photo-slider=Depois]');
 assert.equal(before.getAttribute('value'),'0');
 assert.equal(after.getAttribute('value'),'2');
 const first=before.closest('figure').querySelector('img');
 before.value='1';
 before.dispatchEvent(new run.document.defaultView.Event('input',{bubbles:true}));
 assert.equal(first.isConnected,false);
 assert.equal(before.closest('figure').querySelector('img').dataset.photoMedia,'second');
 assert.match(before.getAttribute('aria-valuetext'),/2 de 3/);
 assert.match(before.closest('figure').querySelector('figcaption').textContent,/2 de 3/);
 assert.equal(after.closest('figure').querySelector('img').dataset.photoMedia,'third');
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

test('resposta atrasada do slider é descartada e históricos recolhidos não são observados',async()=>{
 const run=app();
 run(`page='fotos';photoList=Array.from({length:100},(_,i)=>({
  id:'photo-'+i,date:'2026-02-01',role:'progress',created_at:String(i).padStart(3,'0')
 }));
 document.querySelector('#content').innerHTML=photosPage();
 window.observed=[];
 window.requests=[];
 window.IntersectionObserver=class{
  constructor(callback){window.deliverEntries=callback;window.observed=[]}
  disconnect(){}
  observe(button){window.observed.push(button)}
  unobserve(){}
 };
 photoSource=(photo,variant)=>new Promise(resolve=>window.requests.push({photo,variant,resolve}));
 hydratePhotoImages();
 window.deliverEntries([{isIntersecting:true,target:window.observed[0]}]);
 window.setTimeout=fn=>fn();
 const slider=document.querySelector('[data-photo-slider=Antes]');
 slider.value='50';changePhotoComparison(slider);
 window.deliverEntries([{isIntersecting:true,target:window.observed[0]}]);
 `);
 assert.equal(run('window.observed.length'),2);
 assert.equal(run("window.requests.map(r=>r.variant).join(',')"),'thumbnail,thumbnail');
 run("window.requests[1].resolve('https://example.invalid/current');window.requests[0].resolve('https://example.invalid/stale')");
 await new Promise(setImmediate);
 const first=run.document.querySelector('[data-photo-slider=Antes]').closest('figure');
 assert.equal(first.querySelector('img').getAttribute('src'),'https://example.invalid/current');
 assert.equal(run.document.querySelectorAll('details [src]').length,0);
});
