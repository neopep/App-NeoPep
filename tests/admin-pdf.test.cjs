const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');
const bytes=fs.readFileSync('dist/assets/manual-campanhas-neopep.pdf');

test('manual original tem 10 páginas e texto pesquisável em português',async()=>{
 const pdf=await import('pdfjs-dist/legacy/build/pdf.min.mjs');
 const task=pdf.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,verbosity:0});
 try{
  const document=await task.promise;
  assert.equal(document.numPages,10);
  const pages=await Promise.all(Array.from({length:10},async(_,i)=>{
   const page=await document.getPage(i+1);
   return (await page.getTextContent()).items.map(item=>item.str).join(' ');
  }));
  assert.ok(pages.every(page=>page.length>100));
  assert.match(pages[0],/Guia prático/);
  assert.match(pages.join(' '),/público/);
 }finally{await task.destroy();}
});

test('leitor contínuo carrega páginas próximas, amplia com pinça e restaura formulário, foco e rolagem',async()=>{
 const {document,Event}=parseHTML('<html><body><form><input value="Rascunho"><button type="button">Manual</button></form></body></html>');
 let script='https://teste.example/neo/pdf-reader.js';
 Object.defineProperty(document,'currentScript',{get:()=>({src:script})});
 const original=document.createElement.bind(document),renders=[],opened=[],scroll=[];
 document.createElement=name=>{
  const node=original(name);
  if(name==='section')node.getBoundingClientRect=()=>{
   const view=document.querySelector('.admin-pdf-view');
   const top=(Number(node.getAttribute('aria-label')?.split(' ').at(-1))-1)*430-(view?.scrollTop||0);
   return {top,bottom:top+420};
  };
  if(name==='dialog'){
   node.showModal=()=>node.setAttribute('open','');
   node.close=()=>node.dispatchEvent(new Event('close'));
  }
  return node;
 };
 const trigger=document.querySelector('button');
 let focused=false,destroyed=false;
 trigger.focus=()=>{focused=true};
 const library={GlobalWorkerOptions:{},getDocument(options){
  opened.push(options.url);
  return {destroy:async()=>{destroyed=true},promise:Promise.resolve({numPages:options.url.includes("private.example")?50:10,async getPage(number){
   return {getViewport:({scale})=>({width:300*scale,height:400*scale}),
    render({viewport}){renders.push([number,viewport.width]);return {promise:Promise.resolve(),cancel(){}}},
    async getTextContent(){return {items:[{str:'Página '+number}]}}};
  }})};
 }};
 const window={scrollX:8,scrollY:42,scrollTo:(...position)=>scroll.push(position)};
 const context={window,document,URL,requestAnimationFrame:callback=>setTimeout(callback,0),cancelAnimationFrame:clearTimeout,loadLibrary:async()=>library};
 vm.runInNewContext(fs.readFileSync('dist/pdf-reader.js','utf8').replace('import(asset(', 'loadLibrary(asset('),context);
 script='https://teste.example/neo/admin/admin-pdf.js';
 vm.runInNewContext(fs.readFileSync('dist/admin/admin-pdf.js','utf8'),context);
 await assert.rejects(window.NeoAdminPDF.open({path:'https://private.example/file.pdf'}),/inválido/);
 await window.NeoAdminPDF.open({path:'assets/manual-campanhas-neopep.pdf',title:'Manual',trigger});
 const dialog=document.querySelector('dialog'),view=dialog.querySelector('.admin-pdf-view');
 Object.defineProperty(view,'clientWidth',{value:336});
 view.getBoundingClientRect=()=>({top:0,bottom:360,height:360,left:0});
 dialog.querySelector('[data-pdf-pages]').getBoundingClientRect=()=>({top:-view.scrollTop,left:-view.scrollLeft,width:320});
 view.scrollTop=view.scrollLeft=0;
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(opened[0],'https://teste.example/neo/assets/manual-campanhas-neopep.pdf');
 assert.equal(library.GlobalWorkerOptions.workerSrc,'https://teste.example/neo/vendor/pdfjs/pdf.worker.mjs');
 assert.equal(dialog.querySelectorAll('.admin-pdf-page').length,10);
 assert.equal(dialog.querySelectorAll('button').length,1);
 assert.deepEqual(renders[0],[1,320]);
 assert.ok(dialog.querySelectorAll('canvas').length<4);
 view.scrollTop=1600;
 view.dispatchEvent(new Event('scroll'));
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.ok(renders.some(([page])=>page===5));
 assert.equal(Boolean(dialog.querySelector('.admin-pdf-page').querySelector('canvas')),false);
 assert.match(dialog.querySelector('.admin-pdf-accessible').textContent,/Página 1/);
 const pinch=(type,x,touches)=>{
  const event=new Event(type,{cancelable:true});
  Object.defineProperty(event,'touches',{value:touches??(type==='touchend'?[]:[{clientX:0,clientY:0},{clientX:x,clientY:0}])});
  view.dispatchEvent(event);
 };
 pinch('touchstart',100);pinch('touchmove',150);
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(dialog.querySelector('[data-pdf-pages]').style.width,'480px');
 assert.equal(renders.at(-1)[1],320);
 const replacement=[{clientX:20,clientY:20},{clientX:220,clientY:20}];
 pinch('touchend',0,replacement);
 pinch('touchmove',0,replacement);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(dialog.querySelector('[data-pdf-pages]').style.width,'480px');
 assert.equal(renders.at(-1)[1],320);
 pinch('touchend',150);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(renders.at(-1)[1],480);
 assert.equal(dialog.querySelector('a,[download],iframe'),null);
 dialog.querySelector('[data-pdf=close]').click();
 assert.equal(document.querySelector('dialog'),null);
 assert.equal(document.querySelector('input').value,'Rascunho');
 assert.equal(focused,true);
 assert.equal(destroyed,true);
 assert.deepEqual(scroll,[[8,42]]);
 window.addEventListener=()=>{};
 const files=vm.runInNewContext(fs.readFileSync('dist/library-files.js','utf8')+'\nwindow.NeoLibraryFiles',{window,document,URL,location:{href:'https://teste.example/'}});
 await files.open({mime:'application/pdf',view_url:'https://private.example/signed?token=fixture',name:'Anexo'});
 assert.equal(opened.at(-1),'https://private.example/signed?token=fixture');
 assert.equal(document.querySelectorAll('.admin-pdf-page').length,50);
 files.session({id:'nova-conta'});
 assert.equal(document.querySelector('dialog'),null);
});
