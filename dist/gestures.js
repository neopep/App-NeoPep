/* Touch navigation. Never hijacks typing, media, horizontal carousels or scrolled chat history. */
window.NeoGestures=(()=>{
 let handlers={},start=null,busy=false,indicator=null;const ios=/iPad|iPhone|iPod/.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const ignored=target=>target.closest?.('input,textarea,select,button,a,audio,video,dialog,[role=dialog],[contenteditable=true],.community-tabs,.shop-categories,.shop-gallery-thumbnails,.library-carousel-controls');
 function atTop(target){for(let el=target;el&&el!==document.body;el=el.parentElement)if(el.scrollHeight>el.clientHeight+3&&el.scrollTop>0)return false;return (document.scrollingElement?.scrollTop||window.scrollY||0)<=0;}
 function show(text,amount=0){if(!indicator){indicator=document.createElement('div');indicator.className='pull-refresh-indicator';indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');document.body.append(indicator);}indicator.textContent=text;indicator.hidden=false;indicator.style.transform=`translate(-50%,${Math.min(70,amount/2)}px)`;}
 function hide(){if(indicator)indicator.hidden=true;}
 async function refresh(){if(busy||!handlers.refresh)return;busy=true;show('Atualizando…',0);try{await handlers.refresh();show('Atualizado',0);}catch{show('Não foi possível atualizar. Tente novamente.',0);}finally{busy=false;setTimeout(hide,1500);}}
 document.addEventListener('touchstart',event=>{start=null;if(busy||event.touches.length!==1||ignored(event.target)||document.querySelector('dialog[open],[role=dialog]'))return;const t=event.touches[0];start={x:t.clientX,y:t.clientY,top:atTop(event.target),edge:t.clientX<24,pull:false,back:false,dy:0};},{passive:true});
 document.addEventListener('touchmove',event=>{if(!start||event.touches.length!==1)return;const t=event.touches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;start.dy=dy;if(!ios&&start.edge&&dx>24&&Math.abs(dy)<35&&dx>Math.abs(dy)*2){if(event.cancelable){event.preventDefault();start.back=dx>100;}return;}if(start.top&&dy>12&&Math.abs(dx)<35&&dy>Math.abs(dx)*2&&handlers.refresh&&event.cancelable){start.pull=true;show(dy>90?'Solte para atualizar':'Puxe para atualizar',dy);if(event.cancelable)event.preventDefault();}},{passive:false});
 document.addEventListener('touchend',()=>{const gesture=start;start=null;if(!gesture)return;if(gesture.back&&handlers.back){hide();handlers.back();return;}if(gesture.pull&&gesture.dy>90)refresh();else hide();},{passive:true});
 document.addEventListener('touchcancel',()=>{start=null;hide();},{passive:true});
 return {configure:options=>handlers=options,refresh};
})();
