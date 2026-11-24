/* Immersive playback for authorized Library attachments and the official YouTube embed. */
window.NeoLibraryVideo=(()=>{
 const icons={
  close:'M6 6l12 12M18 6L6 18',play:'M8 5l12 7-12 7z',pause:'M9 5v14m6-14v14',
  mute:'M4 9h4l5-4v14l-5-4H4z M17 9l5 6m0-6-5 6',
  volume:'M4 9h4l5-4v14l-5-4H4z M17 8a6 6 0 0 1 0 8',
  expand:'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
  shrink:'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5'
 };
 let current;
 function buttonMarkup(action,label){
  return `<button type="button" data-video-action="${action}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[action]}"/></svg></button>`;
 }
 function buttonState(button,label,icon){
  button.setAttribute('aria-label',label);
  button.querySelector('path').setAttribute('d',icons[icon]);
 }
 function clock(seconds){
  const total=Math.floor(Number.isFinite(seconds)?Math.max(0,seconds):0);
  const hours=Math.floor(total/3600),minutes=Math.floor(total/60)%60,secs=String(total%60).padStart(2,'0');
  return hours?`${hours}:${String(minutes).padStart(2,'0')}:${secs}`:`${minutes}:${secs}`;
 }
 const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
 async function leaveFullscreen(){
  const exit=document.exitFullscreen||document.webkitExitFullscreen;
  try{await exit?.call(document);}catch{}
 }
 function close(){
  const state=current;
  if(!state)return;
  current=null;
  state.events.abort();
  clearTimeout(state.timer);
  if(state.shell.contains(fullscreenElement()))void leaveFullscreen();
  if(state.video){
   if(state.video.webkitDisplayingFullscreen){
    try{state.video.webkitExitFullscreen?.();}catch{}
   }
   state.video.pause?.();
   state.video.removeAttribute('src');
   state.video.load?.();
  }
  state.dialog.close?.();
  state.dialog.remove();
  for(const item of state.inert)item.inert=false;
  document.documentElement.classList.remove('library-video-open');
  const focus=state.focus?.isConnected?state.focus:
   document.querySelector('[data-community-tab=library][aria-pressed=true], [data-go=biblioteca]');
  focus?.focus?.({preventScroll:true});
 }
 function open({src='',embed='',title='Vídeo',trigger=document.activeElement}){
  close();
  const dialog=document.createElement('dialog');
  dialog.className='library-video-dialog';
  dialog.setAttribute('aria-label',title);
  dialog.setAttribute('aria-modal','true');
  dialog.innerHTML=`<div class="library-video-shell">
   <div class="library-video-stage"></div>
   <div class="library-video-top"><span class="library-video-title"></span>${buttonMarkup('close','Fechar vídeo')}</div>
   ${embed?'':`<div class="library-video-center">${buttonMarkup('play','Reproduzir')}</div>
   <div class="library-video-controls">
    <input type="range" min="0" max="0" value="0" step="any" data-video-progress aria-label="Posição do vídeo" disabled>
    <div class="library-video-toolbar"><span data-video-time>0:00 / 0:00</span>
     <div class="library-video-volume">${buttonMarkup('mute','Silenciar')}<input type="range" min="0" max="1" step="0.05" value="1" data-video-volume aria-label="Volume" hidden></div>
     ${buttonMarkup('expand','Tela cheia do sistema')}
    </div>
   </div>`}
   <p class="library-video-status" role="status" hidden></p>
  </div>`;
  const shell=dialog.firstElementChild,stage=shell.querySelector('.library-video-stage');
  const state={dialog,shell,focus:trigger,events:new AbortController(),inert:[],timer:null};
  current=state;
  const on=(target,type,listener)=>target.addEventListener(type,listener,{signal:state.events.signal});
  dialog.querySelector('.library-video-title').textContent=title;
  const closeButton=dialog.querySelector('[data-video-action=close]');
  on(closeButton,'click',close);
  on(dialog,'cancel',event=>{event.preventDefault();close();});
  on(dialog,'close',()=>{if(current===state)close();});
  if(embed){
   stage.classList.add('library-video-embed');
   const frame=document.createElement('iframe'),uri=new URL(embed);
   uri.searchParams.set('autoplay','1');uri.searchParams.set('playsinline','1');
   frame.src=uri.href;frame.title=title;frame.allow='autoplay; fullscreen; encrypted-media';
   frame.allowFullscreen=true;
   frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
   frame.referrerPolicy='strict-origin-when-cross-origin';
   stage.append(frame);
  }else configureVideo(state,stage,src,on);
  on(dialog,'keydown',event=>{
   if(event.key==='Escape'&&!fullscreenElement()){event.preventDefault();close();}
   if(event.key!=='Tab'||!state.inert.length)return;
   const controls=[...dialog.querySelectorAll('button:not([hidden]):not(:disabled),input:not([hidden]):not(:disabled),iframe')];
   if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
   else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
  });
  document.body.append(dialog);
  document.documentElement.classList.add('library-video-open');
  if(typeof dialog.showModal==='function')dialog.showModal();
  else{
   dialog.setAttribute('open','');
   dialog.setAttribute('role','dialog');
   state.inert=[...document.body.children].filter(node=>node!==dialog&&!node.inert);
   for(const node of state.inert)node.inert=true;
  }
  closeButton.focus({preventScroll:true});
 }
 function configureVideo(state,stage,src,on){
  const {dialog,shell}=state;
  const video=state.video=document.createElement('video');
  video.playsInline=true;video.preload='metadata';video.disablePictureInPicture=true;video.disableRemotePlayback=true;
  video.setAttribute('controlslist','nodownload noremoteplayback');
  stage.append(video);
  const get=selector=>shell.querySelector(selector);
  const play=get('[data-video-action=play]'),mute=get('[data-video-action=mute]'),expand=get('[data-video-action=expand]');
  const progress=get('[data-video-progress]'),volume=get('[data-video-volume]'),time=get('[data-video-time]'),status=get('.library-video-status');
  let keyboard=false,hover=false,scrubbing=false,failed=false,playing=false;
  function message(text){status.textContent=text;status.hidden=!text;}
  function reveal(){
   delete shell.dataset.controlsHidden;
   clearTimeout(state.timer);
   if(playing&&!keyboard&&!hover&&!scrubbing&&!failed){
    state.timer=setTimeout(()=>{shell.dataset.controlsHidden='true';},3000);
   }
  }
  function syncTime(){
   const duration=Number.isFinite(video.duration)?video.duration:0;
   progress.disabled=duration<=0||failed;
   progress.max=String(duration);
   if(!scrubbing)progress.value=String(video.currentTime||0);
   const elapsed=clock(video.currentTime),total=clock(duration);
   time.textContent=`${elapsed} / ${total}`;
   progress.setAttribute('aria-valuetext',`${elapsed} de ${total}`);
  }
  async function toggle(){
   if(failed)return;
   reveal();
   if(!video.paused){video.pause();return;}
   try{await video.play();}catch{
    if(state===current&&!failed&&video.paused)message('Não foi possível iniciar a reprodução. Toque em Reproduzir para tentar novamente.');
   }
  }
  function syncVolume(){
   volume.value=String(video.volume);
   buttonState(mute,video.muted?'Ativar som':'Silenciar',video.muted?'mute':'volume');
  }
  const initialVolume=video.volume;
  try{video.volume=.75;volume.hidden=video.volume!==.75;video.volume=initialVolume;}catch{}
  syncVolume();
  function syncFullscreen(){
   const active=shell.contains(fullscreenElement())||video.webkitDisplayingFullscreen;
   buttonState(expand,active?'Sair da tela cheia':'Tela cheia do sistema',active?'shrink':'expand');
   reveal();
  }
  const request=shell.requestFullscreen||shell.webkitRequestFullscreen;
  const native=video.webkitEnterFullscreen;
  expand.hidden=!(request||native);
  on(expand,'click',async()=>{
   if(shell.contains(fullscreenElement())){await leaveFullscreen();return;}
   if(request){try{await request.call(shell);return;}catch{}}
   if(native&&state===current){try{native.call(video);return;}catch{}}
   if(state===current)message('O navegador mantém a visualização imersiva nesta janela.');
  });
  for(const event of ['fullscreenchange','webkitfullscreenchange'])on(document,event,syncFullscreen);
  for(const event of ['webkitbeginfullscreen','webkitendfullscreen'])on(video,event,syncFullscreen);
  if(window.screen?.orientation?.addEventListener)on(window.screen.orientation,'change',reveal);
  on(window,'resize',reveal);
  on(play,'click',toggle);
  on(stage,'click',reveal);
  on(video,'contextmenu',event=>event.preventDefault());
  on(mute,'click',()=>{video.muted=!video.muted;reveal();});
  on(volume,'input',()=>{video.volume=Number(volume.value);video.muted=false;reveal();});
  on(progress,'pointerdown',()=>{scrubbing=true;reveal();});
  for(const event of ['pointerup','pointercancel'])on(window,event,()=>{if(scrubbing){scrubbing=false;syncTime();reveal();}});
  on(progress,'input',()=>{
   if(!progress.disabled)video.currentTime=Number(progress.value);
   syncTime();reveal();
  });
  for(const event of ['loadedmetadata','durationchange','timeupdate','seeked'])on(video,event,syncTime);
  on(video,'volumechange',syncVolume);
  on(video,'playing',()=>{playing=true;message('');buttonState(play,'Pausar','pause');reveal();});
  for(const event of ['pause','ended','waiting'])on(video,event,()=>{
   playing=false;buttonState(play,video.paused?'Reproduzir':'Pausar',video.paused?'play':'pause');reveal();
  });
  on(video,'error',()=>{
   failed=true;playing=false;play.disabled=true;syncTime();reveal();
   message('Não foi possível reproduzir o vídeo. Confira a conexão ou reabra o material.');
  });
  on(shell,'pointerdown',()=>{keyboard=false;reveal();});
  on(shell,'pointermove',event=>{if(event.pointerType==='mouse')reveal();});
  for(const control of shell.querySelectorAll('.library-video-top,.library-video-center,.library-video-controls')){
   on(control,'pointerenter',event=>{if(event.pointerType==='mouse'){hover=true;reveal();}});
   on(control,'pointerleave',()=>{hover=false;reveal();});
  }
  on(dialog,'keydown',()=>{keyboard=true;reveal();});
  on(dialog,'focusin',event=>{if(keyboard||event.target!==dialog.querySelector('[data-video-action=close]')&&event.target.matches(':focus-visible')){keyboard=true;reveal();}});
  video.src=src;
 }
 return {open,close};
})();
