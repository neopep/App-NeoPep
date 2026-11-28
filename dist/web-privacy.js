/* Optional website analytics consent. No advertising, fingerprinting or health data. */
(function(){
'use strict';
const key='neo_web_statistics_v1',maxAge=180*86400;
let decision=null,box=null,preferences=false,active=null,busy=false,pendingNativeAccount=null;
try{const value=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1);if(value==='allow'||value==='deny')decision=value;}catch{}
const allowed=()=>decision==='allow';
const standalone=()=>navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches===true;
function paint(){
 if(!box)return;
 box.querySelector('[data-privacy-choices]').hidden=preferences;
 box.querySelector('[data-privacy-detail]').hidden=!preferences;
 box.querySelector('[name=statistics]').checked=allowed();
}
function show(detail=false){preferences=detail;box.hidden=false;paint();box.querySelector('h2').focus({preventScroll:true});}
function save(value){
 decision=value;try{document.cookie=key+'='+value+'; Max-Age='+maxAge+'; Path=/; SameSite=Lax; Secure';}catch{}
 box.hidden=true;preferences=false;
 if(allowed())void observeCurrent();else {active=null;pendingNativeAccount=null;}
 window.dispatchEvent(new Event('neo-web-statistics-change'));
}
function mount(){
 if(box)return;
 box=document.createElement('section');box.className='neo-web-privacy';box.setAttribute('role','region');box.setAttribute('aria-labelledby','neo-web-privacy-title');box.hidden=true;
 box.innerHTML='<h2 id="neo-web-privacy-title" tabindex="-1">Sua privacidade</h2><p>Usamos cookies necessários para o funcionamento do NeoPep. Com sua autorização, medimos acessos e uso do aplicativo para melhorar sua experiência.</p><div data-privacy-choices><div class="privacy-actions"><button type="button" class="primary" data-web-privacy="accept">OK, permitir</button><button type="button" class="secondary" data-web-privacy="deny">Só necessários</button></div><button type="button" class="text-btn privacy-options-link" data-web-privacy="preferences">Preferências</button></div><div data-privacy-detail hidden><p>Os necessários mantêm a sessão e as configurações. As estatísticas são opcionais e não incluem dados de saúde.</p><label class="privacy-option">Estatísticas e instalação PWA<input type="checkbox" name="statistics" role="switch"></label><p>Em contas autenticadas, também respeitamos a autorização de estatísticas do Perfil. Você pode alterar ou retirar sua escolha a qualquer momento.</p><div class="privacy-actions"><button type="button" class="primary" data-web-privacy="save">Salvar escolhas</button><button type="button" class="secondary" data-web-privacy="deny">Só necessários</button></div></div>';
 document.body.append(box);
 box.addEventListener('click',e=>{const action=e.target.closest('[data-web-privacy]')?.dataset.webPrivacy;if(action==='preferences')show(true);if(action==='accept')save('allow');if(action==='deny')save('deny');if(action==='save')save(box.querySelector('[name=statistics]').checked?'allow':'deny');});
 if(!decision&&!/[?&](code|token_hash|error)=/.test(location.search)&&!/access_token=|type=recovery|error=/.test(location.hash))show();
}
async function observeCurrent(native=false){
 const ctx=active;
 if(native&&allowed()&&ctx?.cloud.user?.id===ctx?.account&&ctx)pendingNativeAccount=ctx.account;
 if(!allowed()||!ctx||busy||navigator.onLine===false||ctx.cloud.user?.id!==ctx.account)return;
 busy=true;
 const nativeRequested=pendingNativeAccount===ctx.account;
 try{
  const result=await ctx.cloud.audience('web_telemetry',{context:standalone()?'pwa':'browser',os:ctx.device.os,native_install:pendingNativeAccount===ctx.account});
  if(result?.allowed!==true){active=null;pendingNativeAccount=null;}else if(pendingNativeAccount===ctx.account&&nativeRequested)pendingNativeAccount=null;
 }catch{/* Before the coordinated migration, optional telemetry remains unavailable. */}
 finally{busy=false;}
}
window.NeoWebPrivacy={allowed,open(){mount();show(true);},observe(cloud,account,device){if(!allowed()||!account||cloud.user?.id!==account){active=null;pendingNativeAccount=null;return;}if(active?.account!==account)pendingNativeAccount=null;active={cloud,account,device};void observeCurrent();},clear(){active=null;pendingNativeAccount=null;},addLink(root){if(!root||root.querySelector('[data-web-privacy-open]'))return;const link=document.createElement('button');link.type='button';link.className='text-btn neo-web-privacy-link';link.setAttribute('data-web-privacy-open','');link.textContent='Preferências de cookies';root.append(link);}};
window.addEventListener('appinstalled',()=>{if(allowed()&&active?.cloud.user?.id===active.account)void observeCurrent(true);});
document.addEventListener('click',event=>{if(event.target.closest('[data-web-privacy-open]')){event.preventDefault();window.NeoWebPrivacy.open();}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
