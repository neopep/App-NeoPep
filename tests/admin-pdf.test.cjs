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

test('leitor mantém formulário, navega, amplia, ajusta e restaura foco e rolagem',async()=>{
 const {document,Event}=parseHTML('<html><body><form><input value="Rascunho"><button type="button">Manual</button></form></body></html>');
 Object.defineProperty(document,'currentScript',{value:{src:'https://teste.example/neo/admin/admin-pdf.js'}});
 const original=document.createElement.bind(document),renders=[],opened=[],scroll=[];
 document.createElement=name=>{
  const node=original(name);
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
  return {destroy:async()=>{destroyed=true},promise:Promise.resolve({numPages:10,async getPage(number){
   return {getViewport:({scale})=>({width:300*scale,height:400*scale}),
    render({viewport}){renders.push([number,viewport.width]);return {promise:Promise.resolve(),cancel(){}}},
    async getTextContent(){return {items:[{str:'Página '+number}]}}};
  }})};
 }};
 const window={scrollX:8,scrollY:42,scrollTo:(...position)=>scroll.push(position)};
 const context={window,document,URL,setTimeout,clearTimeout,loadLibrary:async()=>library};
 vm.runInNewContext(fs.readFileSync('dist/admin/admin-pdf.js','utf8').replace('import(asset(', 'loadLibrary(asset('),context);
 await window.NeoAdminPDF.open({path:'assets/manual-campanhas-neopep.pdf',title:'Manual',trigger});
 await new Promise(setImmediate);
 assert.equal(opened[0],'https://teste.example/neo/assets/manual-campanhas-neopep.pdf');
 assert.equal(library.GlobalWorkerOptions.workerSrc,'https://teste.example/neo/vendor/pdfjs/pdf.worker.mjs');
 assert.equal(document.querySelector('[data-pdf-page]').textContent,'Página 1 de 10');
 const dialog=document.querySelector('dialog'),view=dialog.querySelector('.admin-pdf-view');
 Object.defineProperty(view,'clientWidth',{value:344});
 dialog.querySelector('[data-pdf=next]').click();
 await new Promise(setImmediate);
 assert.deepEqual(renders.at(-1),[2,320]);
 dialog.querySelector('[data-pdf=more]').click();
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.deepEqual(renders.at(-1),[2,400]);
 dialog.querySelector('[data-pdf=fit]').click();
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.deepEqual(renders.at(-1),[2,320]);
 const pinch=(type,x)=>{
  const event=new Event(type,{cancelable:true});
  Object.defineProperty(event,'touches',{value:[{clientX:0,clientY:0},{clientX:x,clientY:0}]});
  view.dispatchEvent(event);
 };
 pinch('touchstart',100);pinch('touchmove',150);
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.deepEqual(renders.at(-1),[2,480]);
 assert.equal(dialog.querySelector('a,[download],iframe'),null);
 dialog.querySelector('[data-pdf=close]').click();
 assert.equal(document.querySelector('dialog'),null);
 assert.equal(document.querySelector('input').value,'Rascunho');
 assert.equal(focused,true);
 assert.equal(destroyed,true);
 assert.deepEqual(scroll,[[8,42]]);
});
