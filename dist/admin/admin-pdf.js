/* Leitor de documentos administrativos estáticos da mesma origem. */
'use strict';
(() => {
 const base=new URL('../',document.currentScript.src);
 let library,active;
 const asset=path=>new URL(path,base).href;
 function pdfLibrary(){
  return library??=import(asset('vendor/pdfjs/pdf.mjs')).then(pdf=>{
   pdf.GlobalWorkerOptions.workerSrc=asset('vendor/pdfjs/pdf.worker.mjs');
   return pdf;
  }).catch(error=>{library=null;throw error});
 }
 async function open({path,title,trigger}){
  if(active)return;
  const url=new URL(path,base);
  if(url.origin!==base.origin||!url.pathname.startsWith(new URL('assets/',base).pathname)||!url.pathname.endsWith('.pdf'))throw Error('PDF administrativo inválido.');
  const dialog=document.createElement('dialog');
  dialog.className='admin-pdf';
  dialog.setAttribute('aria-labelledby','adminPdfTitle');
  dialog.innerHTML=`<div class="admin-pdf-shell">
   <header><h2 id="adminPdfTitle"></h2><button type="button" class="secondary" data-pdf="close" autofocus>Fechar</button></header>
   <div class="admin-pdf-toolbar" aria-label="Controles do documento">
    <button type="button" class="secondary" data-pdf="prev" aria-label="Página anterior" disabled>←</button>
    <span data-pdf-page role="status"></span>
    <button type="button" class="secondary" data-pdf="next" aria-label="Próxima página" disabled>→</button>
    <button type="button" class="secondary" data-pdf="less" aria-label="Reduzir ampliação" disabled>−</button>
    <button type="button" class="secondary" data-pdf="fit" disabled>Ajustar</button>
    <button type="button" class="secondary" data-pdf="more" aria-label="Aumentar ampliação" disabled>+</button>
   </div>
   <div class="admin-pdf-view" tabindex="0" role="region" aria-label="Página do manual">
    <p data-pdf-status role="status">Carregando documento…</p>
    <canvas hidden aria-hidden="true"></canvas>
   </div>
   <details class="admin-pdf-text" hidden><summary>Texto da página</summary><p></p></details>
  </div>`;
  const view=dialog.querySelector('.admin-pdf-view'),canvas=dialog.querySelector('canvas');
  const status=dialog.querySelector('[data-pdf-status]'),counter=dialog.querySelector('[data-pdf-page]');
  const transcript=dialog.querySelector('.admin-pdf-text');
  const button=name=>dialog.querySelector(`[data-pdf="${name}"]`);
  dialog.querySelector('h2').textContent=title;
  let task,doc,renderTask,pageNumber=1,zoom=1,version=0,pinch,timer,observer,closed=false;
  const origin={x:window.scrollX,y:window.scrollY};
  function cleanup(){
   closed=true;++version;clearTimeout(timer);observer?.disconnect();renderTask?.cancel();
   if(task)void task.destroy().catch(()=>{});
   canvas.width=canvas.height=0;dialog.remove();active=null;
   if(trigger?.isConnected)trigger.focus({preventScroll:true});
   window.scrollTo(origin.x,origin.y);
  }
  function controls(){
   button('prev').disabled=!doc||pageNumber===1;
   button('next').disabled=!doc||pageNumber===doc.numPages;
   button('less').disabled=!doc||zoom<=0.5;
   button('more').disabled=!doc||zoom>=3;
   button('fit').disabled=!doc||zoom===1;
   counter.textContent=doc?`Página ${pageNumber} de ${doc.numPages}`:'';
  }
  async function render(){
   if(!doc||closed)return;
   const current=++version;
   renderTask?.cancel();controls();
   try{
    const page=await doc.getPage(pageNumber);
    if(current!==version)return;
    const initial=page.getViewport({scale:1});
    const width=Math.max(1,view.clientWidth-24);
    const height=view.clientHeight>24?view.clientHeight-12:Infinity;
    const fit=Math.min(width/initial.width,height/initial.height);
    const viewport=page.getViewport({scale:fit*zoom});
    const pixels=Math.min(window.devicePixelRatio||1,2,Math.sqrt(5000000/(viewport.width*viewport.height)));
    canvas.width=Math.max(1,Math.floor(viewport.width*pixels));
    canvas.height=Math.max(1,Math.floor(viewport.height*pixels));
    canvas.style.width=viewport.width+'px';
    canvas.style.height=viewport.height+'px';
    renderTask=page.render({canvas,viewport,transform:[pixels,0,0,pixels,0,0]});
    await renderTask.promise;
    if(current!==version)return;
    canvas.hidden=false;status.hidden=true;
    const content=await page.getTextContent();
    if(current!==version)return;
    transcript.querySelector('p').textContent=content.items.map(item=>item.str||'').join(' ');
    transcript.hidden=!transcript.querySelector('p').textContent;
   }catch(error){
    if(current===version&&error.name!=='RenderingCancelledException'){
     canvas.hidden=true;transcript.hidden=true;status.hidden=false;status.textContent='Não foi possível mostrar esta página.';
    }
   }
  }
  function schedule(){
   if(!doc||closed)return;
   clearTimeout(timer);timer=setTimeout(render,70);
  }
  function enlarge(value){
   zoom=Math.min(3,Math.max(0.5,value));controls();schedule();
  }
  function move(offset){
   if(!doc)return;
   const next=Math.min(doc.numPages,Math.max(1,pageNumber+offset));
   if(next===pageNumber)return;
   pageNumber=next;view.scrollTop=view.scrollLeft=0;transcript.hidden=true;
   void render();
  }
  dialog.addEventListener('close',cleanup,{once:true});
  button('close').addEventListener('click',()=>dialog.close());
  button('prev').addEventListener('click',()=>move(-1));
  button('next').addEventListener('click',()=>move(1));
  button('less').addEventListener('click',()=>enlarge(zoom/1.25));
  button('more').addEventListener('click',()=>enlarge(zoom*1.25));
  button('fit').addEventListener('click',()=>{view.scrollLeft=0;enlarge(1)});
  dialog.addEventListener('keydown',event=>{
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();move(event.key==='ArrowLeft'?-1:1);
   }
  });
  const distance=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
  view.addEventListener('touchstart',event=>{
   if(event.touches.length!==2)return;
   const gap=distance(event.touches);
   if(!gap)return;
   event.preventDefault();pinch={gap,zoom};
  },{passive:false});
  view.addEventListener('touchmove',event=>{
   if(!pinch||event.touches.length!==2)return;
   event.preventDefault();enlarge(pinch.zoom*distance(event.touches)/pinch.gap);
  },{passive:false});
  for(const name of ['touchend','touchcancel'])view.addEventListener(name,()=>{pinch=null});
  document.body.append(dialog);
  try{dialog.showModal()}catch(error){cleanup();throw error}
  active=dialog;
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(schedule);observer.observe(view);}
  try{
   const pdf=await pdfLibrary();
   if(closed)return;
   task=pdf.getDocument({url:url.href,isEvalSupported:false,disableRange:true,disableStream:true});
   doc=await task.promise;
   if(!closed)void render();
  }catch{
   if(!closed)status.textContent='Não foi possível carregar o manual. Feche e tente novamente.';
  }
 }
 window.NeoAdminPDF=Object.freeze({open});
})();
