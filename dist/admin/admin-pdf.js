/* Leitor progressivo de PDFs administrativos da mesma origem. */
'use strict';
(() => {
 const base=new URL('../',document.currentScript.src);
 const asset=path=>new URL(path,base).href;
 let library,active;
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
  dialog.className='admin-pdf';dialog.setAttribute('aria-label',title);
  dialog.innerHTML='<button type="button" class="secondary admin-pdf-close" aria-label="Fechar manual" data-pdf="close" autofocus>×</button><div class="admin-pdf-view" tabindex="0" role="region" aria-label="Páginas do manual"><p data-pdf-status role="status">Carregando documento…</p><div data-pdf-pages></div></div>';
  const view=dialog.querySelector('.admin-pdf-view'),pages=dialog.querySelector('[data-pdf-pages]');
  const status=dialog.querySelector('[data-pdf-status]'),origin=[window.scrollX,window.scrollY];
  const slots=[];
  let task,doc,frame,observer,pinch,zoom=1,closed=false,updating=false;
  function drop(slot){
   slot.revision++;slot.job?.cancel();slot.job=null;
   if(slot.canvas){slot.canvas.width=slot.canvas.height=0;slot.canvas.remove();slot.canvas=null;}
   slot.rendered=0;
  }
  function cleanup(){
   closed=true;cancelAnimationFrame(frame);observer?.disconnect();
   for(const slot of slots)drop(slot);
   if(task)void task.destroy().catch(()=>{});
   dialog.remove();active=null;trigger?.focus({preventScroll:true});window.scrollTo(...origin);
  }
  function width(){return Math.max(1,view.clientWidth-16)*zoom;}
  async function paint(slot,target){
   if(slot.canvas&&Math.abs(slot.rendered-target)<2)return;
   drop(slot);const revision=slot.revision;
   try{
    const page=await doc.getPage(slot.number);
    if(closed||revision!==slot.revision)return;
    const initial=page.getViewport({scale:1}),viewport=page.getViewport({scale:target/initial.width});
    slot.node.style.aspectRatio=initial.width+' / '+initial.height;
    const pixels=Math.min(window.devicePixelRatio||1,2,Math.sqrt(4200000/(viewport.width*viewport.height)));
    const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
    canvas.width=Math.max(1,Math.ceil(viewport.width*pixels));canvas.height=Math.max(1,Math.ceil(viewport.height*pixels));
    slot.canvas=canvas;slot.rendered=target;slot.node.prepend(canvas);
    slot.job=page.render({canvas,viewport,transform:[pixels,0,0,pixels,0,0]});
    await slot.job.promise;
    if(!slot.text.textContent){
     const content=await page.getTextContent();
     if(!closed)slot.text.textContent=content.items.map(item=>item.str||'').join(' ');
    }
   }catch(error){
    if(!closed&&revision===slot.revision&&error.name!=='RenderingCancelledException')status.textContent='Não foi possível mostrar a página '+slot.number+'.';
   }
  }
  function schedule(){
   if(closed||!doc||frame||updating)return;
   frame=requestAnimationFrame(async()=>{
    frame=null;updating=true;
    try{
     const rect=view.getBoundingClientRect(),target=width();
     const near=[];
     for(const slot of slots){
      const bounds=slot.node.getBoundingClientRect();
      if(bounds.bottom>=rect.top-rect.height*.55&&bounds.top<=rect.bottom+rect.height*.55)near.push(slot);
      else if(slot.canvas)drop(slot);
     }
     // Render sequentially and keep only pages close to the viewport.
     for(const slot of near){if(closed)break;await paint(slot,target);}
    }finally{updating=false;if(!closed&&view.dataset.moved==='true'){delete view.dataset.moved;schedule();}}
   });
  }
  function moved(){if(updating)view.dataset.moved='true';schedule();}
  function setZoom(next,center){
   const previous=zoom;zoom=Math.min(3,Math.max(1,next));
   if(previous===zoom)return;
   const ratio=zoom/previous;
   pages.style.width=width()+'px';
   view.scrollLeft=Math.max(0,(view.scrollLeft+center.x)*ratio-center.x);
   view.scrollTop=Math.max(0,(view.scrollTop+center.y)*ratio-center.y);
   moved();
  }
  dialog.addEventListener('close',cleanup,{once:true});
  dialog.querySelector('[data-pdf=close]').addEventListener('click',()=>dialog.close());
  view.addEventListener('scroll',moved,{passive:true});
  const distance=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
  view.addEventListener('touchstart',event=>{
   if(event.touches.length!==2)return;
   const gap=distance(event.touches);if(!gap)return;
   event.preventDefault();pinch={gap,zoom};
  },{passive:false});
  view.addEventListener('touchmove',event=>{
   if(!pinch||event.touches.length!==2)return;
   event.preventDefault();
   const [a,b]=event.touches,rect=view.getBoundingClientRect();
   setZoom(pinch.zoom*distance(event.touches)/pinch.gap,{x:(a.clientX+b.clientX)/2-rect.left,y:(a.clientY+b.clientY)/2-rect.top});
  },{passive:false});
  for(const name of ['touchend','touchcancel'])view.addEventListener(name,()=>{pinch=null});
  document.body.append(dialog);
  try{dialog.showModal()}catch(error){cleanup();throw error}
  active=dialog;
  if(typeof ResizeObserver!=='undefined'){
   observer=new ResizeObserver(()=>{pages.style.width=width()+'px';moved()});observer.observe(view);
  }
  try{
   const pdf=await pdfLibrary();if(closed)return;
   task=pdf.getDocument({url:url.href,isEvalSupported:false});
   doc=await task.promise;if(closed)return;
   status.textContent='';
   pages.style.width=width()+'px';
   for(let number=1;number<=doc.numPages;number++){
    const node=document.createElement('section'),text=document.createElement('p');
    node.className='admin-pdf-page';node.setAttribute('aria-label','Página '+number);node.tabIndex=0;
    node.addEventListener('focus',moved);
    text.className='admin-pdf-accessible';node.append(text);pages.append(node);
    slots.push({node,text,number,revision:0,rendered:0});
   }
   schedule();
  }catch{if(!closed)status.textContent='Não foi possível carregar o manual. Feche e tente novamente.';}
 }
 window.NeoAdminPDF=Object.freeze({open});
})();
