/* Home library highlights: official materials only; never fetches private group messages. */
window.NeoLibrary=(()=>{
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const book='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M24 11c-6-5-13-5-19-3v30c7-2 13-1 19 3 6-4 12-5 19-3V8c-6-2-13-2-19 3Zm0 0v30M11 15c3 0 5 0 8 2m-8 5c3 0 5 0 8 2m10-7c3-2 5-2 8-2m-8 9c3-2 5-2 8-2"/></svg>';
 const previews=new Map();
 let activeCover=null;
 function stopCover(){activeCover?.controller.abort();activeCover=null;}
 let owner='',generation=0,context={},rows=[],index=0,last=0,busy=false,paused=false,revision=0;
 function session(user){const next=user?.id||'';if(next===owner)return;owner=next;stopCover();previews.clear();generation++;revision++;rows=[];index=0;last=0;busy=false;paused=false;paint();}
 function cover(material){
  const preview=previews.get(material.id);
  if(preview?.state==='loading')return `<span class="library-home-cover-loading" role="status" aria-label="Carregando capa">${book}</span>`;
  if(!preview?.url||preview.expires<=Date.now())return book;
  const url=e(preview.url);
  if(preview.mime.startsWith('image/')||preview.mime==='application/pdf')return `<img src="${url}" alt="" decoding="async" referrerpolicy="no-referrer">`;
  return `<video src="${url}" data-video-thumb="${e(material.id)}" crossorigin="anonymous" muted playsinline preload="metadata" aria-hidden="true"></video>`;
 }
 async function loadCover(){
  const material=rows[index],cloud=window.NeoCloud;
  if(!material||!cloud.libraryMediaURL||activeCover?.id===material.id)return;
  if(previews.get(material.id)?.expires>Date.now())return;
  const controller=new AbortController(),{signal}=controller;
  const job={id:material.id,controller},entry={state:'loading'};
  activeCover=job;
  previews.set(material.id,entry);
  paint();
  const timeout=setTimeout(()=>{
   if(activeCover!==job)return;
   stopCover();
   entry.state='fallback';entry.expires=Date.now()+60000;
   if(rows[index]?.id===material.id)paint();
  },12000);
  try{
   const {material:detail}=await cloud.library('get',{id:material.id});
   if(signal.aborted)return;
   const files=detail?.attachments||[];
   const document=files.find(file=>file.mime==='application/pdf');
   const file=document||files.find(item=>item.mime?.startsWith('image/'))||files.find(item=>item.mime?.startsWith('video/'));
   if(!file)return;
   const signed=await cloud.libraryMediaURL(file,false);
   if(signal.aborted||!/^https:\/\//i.test(signed))return;
   entry.mime=file.mime;
   entry.url=document?await window.NeoLibraryFiles?.pdfCover?.(signed,signal):signed;
  }catch{/* The standard cover is restored when signing or rendering fails. */}
  finally{
   clearTimeout(timeout);
   if(activeCover===job){
    activeCover=null;
    entry.state=entry.url?'ready':'fallback';
    entry.expires=Date.now()+(entry.mime==='application/pdf'&&entry.url?300000:50000);
    if(rows[index]?.id===material.id)paint();
   }
  }
 }
 function home(){const m=rows[index];return `<section class="card library-home" data-library-home aria-label="Materiais da biblioteca" aria-roledescription="carrossel"><div class="between"><span class="eyebrow">BIBLIOTECA NEOPEP</span><button class="text-btn" data-go="comunidade" data-community-section="library">Ver biblioteca ↗</button></div>${m?`<div class="library-home-slide"><span class="library-home-symbol">${cover(m)}</span><div><span class="tag">Em destaque</span><h2>${e(m.title)}</h2><p>${e(m.excerpt||'')}</p><button class="primary" data-go="comunidade" data-community-section="library" data-material="${e(m.id)}">Ler material ${m.has_link?'↗':'→'}</button></div></div>${rows.length>1?`<div class="library-carousel-controls"><button class="icon-btn" data-library-step="-1" aria-label="Material anterior">‹</button><span>${index+1} / ${rows.length}</span><button class="icon-btn" data-library-step="1" aria-label="Próximo material">›</button><button class="text-btn" data-library-pause aria-pressed="${paused}" aria-label="${paused?'Retomar':'Pausar'} materiais">${paused?'▶':'Ⅱ'}</button></div>`:''}`:`<div class="library-home-slide"><span class="library-home-symbol">${book}</span><div><h2>Conhecimento para sua jornada.</h2><p>Explore textos, vídeos e materiais selecionados pela equipe.</p><button class="secondary" data-go="comunidade" data-community-section="library">Explorar biblioteca →</button></div></div>`}</section>`;}
 function paint(){if(activeCover&&activeCover.id!==rows[index]?.id){previews.delete(activeCover.id);stopCover();}const root=document.querySelector('[data-library-home]');if(!root)return;const active=document.activeElement,step=active?.dataset?.libraryStep,pause=active?.hasAttribute?.('data-library-pause');root.outerHTML=home();window.NeoLibraryFiles?.scan(document.querySelector('[data-library-home]'));void loadCover();if(step)document.querySelector('[data-library-step="'+step+'"]')?.focus({preventScroll:true});else if(pause)document.querySelector('[data-library-pause]')?.focus({preventScroll:true});}
 async function loadHome(ctx=context){context=ctx;session(ctx.cloud?ctx.user:null);if(!owner||busy||last&&Date.now()-last<60000||!window.NeoCloud.library)return;busy=true;const token=generation,request=revision;try{const result=await window.NeoCloud.library('featured');if(token!==generation||request!==revision)return;const current=rows[index]?.id;rows=(result.materials||[]).filter(m=>m&&typeof m.id==='string'&&typeof m.title==='string');index=Math.max(0,rows.findIndex(m=>m.id===current));last=Date.now();paint();}catch{if(token===generation&&request===revision){last=Date.now();rows=[];index=0;paint();}}finally{if(token===generation){busy=false;if(request!==revision&&document.querySelector('[data-library-home]'))loadHome(context);}}}
 function invalidate(){revision++;stopCover();previews.clear();last=0;rows=[];index=0;paint();if(document.querySelector('[data-library-home]'))loadHome(context);}
 document.addEventListener('error',event=>{
  const media=event.target;
  const symbol=media.closest?.('[data-library-home] .library-home-symbol');
  if(!symbol||!media.matches('img,video'))return;
  symbol.innerHTML=book;
 },true);
 document.addEventListener('click',event=>{const step=event.target.closest('[data-library-step]'),pause=event.target.closest('[data-library-pause]');if(step&&rows.length){index=(index+Number(step.dataset.libraryStep)+rows.length)%rows.length;paused=true;paint();}if(pause){paused=!paused;paint();}});
 setInterval(()=>{if(document.visibilityState!=='visible'||paused||rows.length<2||!document.querySelector('[data-library-home]')||document.querySelector('[data-library-home]:focus-within')||document.querySelector('[data-library-home]:hover')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;index=(index+1)%rows.length;paint();},6500);
 setInterval(()=>{if(document.visibilityState==='visible'&&document.querySelector('[data-library-home]'))loadHome(context);},60000);
 let refreshTimer;
 document.addEventListener('neo:messages',event=>{if(event.detail?.group===false||!document.querySelector('[data-library-home]')||document.visibilityState==='hidden')return;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{last=0;loadHome(context);},1000);});
 return {home,loadHome,session,invalidate};
})();
