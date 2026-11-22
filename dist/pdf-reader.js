/* Leitor contínuo de PDFs para a Biblioteca e o painel administrativo. */
'use strict';
(() => {
 const base=new URL('./',document.currentScript?.src||document.baseURI||location.href);
 const asset=path=>new URL(path,base).href;
 let library,active;
 function pdfLibrary(){
  return library??=import(asset('vendor/pdfjs/pdf.mjs')).then(pdf=>{
   pdf.GlobalWorkerOptions.workerSrc=asset('vendor/pdfjs/pdf.worker.mjs');
   return pdf;
  }).catch(error=>{library=null;throw error});
 }
 async function open({url,title,trigger,owner}){
  if(active)return;
  const dialog=document.createElement('dialog');
  dialog.className='admin-pdf';dialog.setAttribute('aria-label',title);
  dialog.innerHTML='<button type="button" class="secondary admin-pdf-close" aria-label="Fechar documento" data-pdf="close" autofocus>×</button><div class="admin-pdf-view" tabindex="0" role="region" aria-label="Páginas do documento" aria-keyshortcuts="+ - 0"><p data-pdf-status role="status">Carregando documento…</p><div data-pdf-pages></div></div>';
  const view=dialog.querySelector('.admin-pdf-view'),pages=dialog.querySelector('[data-pdf-pages]');
  const status=dialog.querySelector('[data-pdf-status]'),origin=[window.scrollX,window.scrollY];
  const slots=[];
  let task,doc,frame,zoomFrame,observer,pinch,pending,zoom=1,closed=false,updating=false,dirty=false;
  function drop(slot){
   slot.revision++;slot.job?.cancel();slot.job=null;
   if(slot.canvas){slot.canvas.width=slot.canvas.height=0;slot.canvas.remove();slot.canvas=null;}
   slot.rendered=0;
  }
  function cleanup(){
   if(closed)return;
   closed=true;cancelAnimationFrame(frame);cancelAnimationFrame(zoomFrame);observer?.disconnect();
   for(const slot of slots)drop(slot);
   if(task)void task.destroy().catch(()=>{});
   dialog.remove();active=null;trigger?.focus({preventScroll:true});window.scrollTo(...origin);
  }
  function width(){return Math.max(1,view.clientWidth-16)*zoom;}
  async function paint(slot,target){
   if(slot.canvas&&Math.abs(slot.rendered-target)<2)return;
   const revision=++slot.revision;
   try{
    const page=await doc.getPage(slot.number);
    if(closed||pinch||revision!==slot.revision)return;
    const initial=page.getViewport({scale:1}),viewport=page.getViewport({scale:target/initial.width});
    slot.node.style.aspectRatio=initial.width+' / '+initial.height;
    const pixels=Math.min(window.devicePixelRatio||1,2,Math.sqrt(4200000/(viewport.width*viewport.height)));
    const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
    canvas.width=Math.max(1,Math.ceil(viewport.width*pixels));canvas.height=Math.max(1,Math.ceil(viewport.height*pixels));
    const job=slot.job=page.render({canvas,viewport,transform:[pixels,0,0,pixels,0,0]});
    await job.promise;
    if(closed||pinch||revision!==slot.revision){canvas.width=canvas.height=0;return;}
    slot.job=null;
    if(slot.canvas){slot.canvas.width=slot.canvas.height=0;slot.canvas.remove();}
    slot.canvas=canvas;slot.rendered=target;slot.node.prepend(canvas);
    if(!slot.text.textContent){
     const content=await page.getTextContent();
     if(!closed)slot.text.textContent=content.items.map(item=>item.str||'').join(' ');
    }
   }catch(error){
    if(!closed&&revision===slot.revision&&error.name!=='RenderingCancelledException')status.textContent='Não foi possível mostrar a página '+slot.number+'.';
   }
  }
  function schedule(){
   if(closed||!doc||pinch||frame||updating)return;
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
     for(const slot of near){if(closed||pinch)break;await paint(slot,target);}
    }finally{updating=false;if(dirty){dirty=false;schedule();}}
   });
  }
  function moved(){if(updating)dirty=true;schedule();}
  function point(event){
   const [a,b]=event.touches;
   return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2,
    gap:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)};
  }
  function resizeAround(next,from,to){
   const previous=zoom;
   zoom=Math.min(3,Math.max(1,next));
   const before=pages.getBoundingClientRect(),ratio=zoom/previous;
   pages.style.width=width()+'px';
   const after=pages.getBoundingClientRect(),rect=view.getBoundingClientRect();
   const origin=before.width?before:rect,target=after.width?after:rect;
   view.scrollLeft=Math.max(0,view.scrollLeft+target.left+(from.x-origin.left)*ratio-to.x);
   view.scrollTop=Math.max(0,view.scrollTop+target.top+(from.y-origin.top)*ratio-to.y);
  }
  function visualZoom(){
   zoomFrame=null;
   if(!pinch||!pending)return;
   resizeAround(pinch.zoom*pending.gap/pinch.gap,pinch.last,pending);
   pinch.last=pending;pending=null;
  }
  dialog.addEventListener('close',cleanup,{once:true});
  dialog.querySelector('[data-pdf=close]').addEventListener('click',()=>dialog.close());
  view.addEventListener('scroll',moved,{passive:true});
  view.addEventListener('touchstart',event=>{
   if(event.touches.length<2)return;
   event.preventDefault();
   if(event.touches.length!==2)return;
   const center=point(event);if(!center.gap)return;
   cancelAnimationFrame(zoomFrame);visualZoom();
   cancelAnimationFrame(frame);frame=null;
   for(const slot of slots)if(slot.job){slot.revision++;slot.job.cancel();slot.job=null;}
   pinch={gap:center.gap,zoom,last:center};
  },{passive:false});
  view.addEventListener('touchmove',event=>{
   if(!pinch)return;
   event.preventDefault();
   if(event.touches.length!==2)return;
   pending=point(event);
   if(!zoomFrame)zoomFrame=requestAnimationFrame(visualZoom);
  },{passive:false});
  for(const name of ['touchend','touchcancel'])view.addEventListener(name,event=>{
   if(!pinch)return;
   cancelAnimationFrame(zoomFrame);visualZoom();
   if(name==='touchend'&&event.touches.length===2){
    const center=point(event);
    if(center.gap){pinch={gap:center.gap,zoom,last:center};return;}
   }
   pinch=null;moved();
  });
  view.addEventListener('keydown',event=>{
   if(!['+','=','-','0'].includes(event.key)||event.ctrlKey||event.metaKey||event.altKey)return;
   event.preventDefault();
   const rect=view.getBoundingClientRect(),center={x:rect.left+view.clientWidth/2,y:rect.top+view.clientHeight/2};
   resizeAround(event.key==='0'?1:zoom*(event.key==='-'?.8:1.25),center,center);moved();
  });
  document.body.append(dialog);
  try{dialog.showModal()}catch(error){cleanup();throw error}
  active={cleanup,owner};
  if(typeof ResizeObserver!=='undefined'){
   observer=new ResizeObserver(()=>{pages.style.width=width()+'px';moved()});observer.observe(view);
  }
  try{
   const pdf=await pdfLibrary();if(closed)return;
   task=pdf.getDocument({url,isEvalSupported:false,enableXfa:false,useWasm:false,isOffscreenCanvasSupported:false,
    cMapUrl:asset('vendor/pdfjs/cmaps/'),cMapPacked:true,standardFontDataUrl:asset('vendor/pdfjs/standard_fonts/')});
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
  }catch{if(!closed)status.textContent='Não foi possível carregar o documento. Feche e tente novamente.';}
 }
 window.NeoPDFReader=Object.freeze({open,close(owner){if(active?.owner===owner)active?.cleanup();}});
})();
